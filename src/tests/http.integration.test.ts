/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import 'dotenv/config';

import { PaymentDirection, RoleGroup, TradeType, MembershipRole } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import {
  createTestAuthFixture,
  deleteTestAuthFixture,
  withBearer,
} from './helpers/http-auth.helper.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const sampleFormulaIdForValidation = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa9001';
const missingFormulaId = '00000000-0000-0000-0000-000000000099';
const sampleParticipantIdForValidation = 'ffffffff-ffff-ffff-ffff-ffffffff9001';

function readJsonBody(payload: string): Record<string, unknown> {
  return JSON.parse(payload) as Record<string, unknown>;
}

async function createTestApp(): Promise<FastifyInstance> {
  const { createServer } = await import('../http/server.js');
  return createServer();
}

async function resolveTestItemId(
  prisma: PrismaClient,
): Promise<{ itemId: string; created: boolean }> {
  const existing = await prisma.item.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) {
    return { itemId: existing.id, created: false };
  }

  const created = await prisma.item.create({
    data: {
      itemCode: `TEST-HTTP-INT-${Date.now()}`,
      itemName: 'HTTP Integration Test Item',
      defaultUnit: 'kg',
      isActive: true,
    },
  });

  return { itemId: created.id, created: true };
}

async function createTestCompany(prisma: PrismaClient): Promise<string> {
  const company = await prisma.company.create({
    data: {
      companyName: `HTTP Integration Test Co ${Date.now()}`,
      isActive: true,
    },
  });

  return company.id;
}

async function createOpenFormulaViaPrisma(
  prisma: PrismaClient,
  itemId: string,
): Promise<string> {
  const formula = await prisma.formula.create({
    data: {
      tradeType: TradeType.DOMESTIC,
      itemId,
      quantity: 1000,
      unit: 'kg',
      content: 'http integration test',
      createdBy: 'http.integration.test',
    },
  });

  return formula.id;
}

async function createTestParticipant(
  prisma: PrismaClient,
  formulaId: string,
  companyId: string,
): Promise<string> {
  const participant = await prisma.formulaParticipant.create({
    data: {
      formulaId,
      companyId,
      sequenceOrder: 1,
      roleGroup: RoleGroup.SUPPLIER,
      quantity: 1000,
      buyUnitPrice: 0,
      sellUnitPrice: 100,
      isStartPoint: true,
      isEndPoint: true,
    },
  });

  return participant.id;
}

async function cleanupHttpTestArtifacts(params: {
  prisma: PrismaClient;
  formulaId?: string;
  companyId?: string;
  itemId?: string;
  itemWasNew?: boolean;
}): Promise<void> {
  if (params.formulaId) {
    await params.prisma.formula.delete({ where: { id: params.formulaId } });
  }

  if (params.companyId) {
    await params.prisma.company.delete({ where: { id: params.companyId } });
  }

  if (params.itemWasNew && params.itemId) {
    await params.prisma.item.delete({ where: { id: params.itemId } });
  }
}

test('1. Health Route GET /api/v1/health', async () => {
  const app = await createTestApp();

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    assert.equal(response.statusCode, 200);

    const body = readJsonBody(response.payload);
    assert.equal(body.ok, true);
  } finally {
    await app.close();
  }
});

test('2. Settlement Payment Schedule Validation returns 400 when participant_id is missing', async () => {
  const authFixture = await createTestAuthFixture(
    MembershipRole.SUPER_ADMIN,
    'http-settlement-val',
  );
  const app = await createTestApp();

  try {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/formulas/${sampleFormulaIdForValidation}/settlement/payment-schedules`,
      headers: withBearer(authFixture.accessToken, { 'content-type': 'application/json' }),
      payload: {
        direction: 'RECEIVE',
        scheduled_amount: 1000,
        due_date: '2026-01-01',
      },
    });

    assert.equal(response.statusCode, 400);

    const body = readJsonBody(response.payload);
    assert.equal(typeof body.message, 'string');
  } finally {
    await app.close();
    await deleteTestAuthFixture(authFixture);
  }
});

test('3. Settlement Note Validation returns 400 when note is empty', async () => {
  const authFixture = await createTestAuthFixture(
    MembershipRole.SUPER_ADMIN,
    'http-settlement-note-val',
  );
  const app = await createTestApp();

  try {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/formulas/${sampleFormulaIdForValidation}/settlement/notes`,
      headers: withBearer(authFixture.accessToken, { 'content-type': 'application/json' }),
      payload: {
        note: '',
      },
    });

    assert.equal(response.statusCode, 400);

    const body = readJsonBody(response.payload);
    assert.equal(typeof body.message, 'string');
  } finally {
    await app.close();
    await deleteTestAuthFixture(authFixture);
  }
});

test('HTTP settlement DB integration flow', { skip: !hasDatabase }, async (t) => {
  const prismaLib = await import('../lib/prisma.js');
  const prisma = prismaLib.prisma;

  let createdFormulaId: string | undefined;
  let createdCompanyId: string | undefined;
  let createdItemId: string | undefined;
  let createdItemWasNew = false;
  let createdParticipantId: string | undefined;

  t.after(async () => {
    await cleanupHttpTestArtifacts({
      prisma,
      ...(createdFormulaId ? { formulaId: createdFormulaId } : {}),
      ...(createdCompanyId ? { companyId: createdCompanyId } : {}),
      ...(createdItemId ? { itemId: createdItemId } : {}),
      ...(createdItemWasNew ? { itemWasNew: createdItemWasNew } : {}),
    });
    await prisma.$disconnect();
  });

  const app = await createTestApp();
  const authFixture = await createTestAuthFixture(
    MembershipRole.SUPER_ADMIN,
    'http-settlement-db',
  );

  t.after(async () => {
    await app.close();
    await deleteTestAuthFixture(authFixture);
  });

  const { itemId, created: itemCreated } = await resolveTestItemId(prisma);
  createdItemId = itemId;
  createdItemWasNew = itemCreated;

  createdFormulaId = await createOpenFormulaViaPrisma(prisma, itemId);
  createdCompanyId = await createTestCompany(prisma);
  createdParticipantId = await createTestParticipant(
    prisma,
    createdFormulaId,
    createdCompanyId,
  );

  const openSchedulePayload = {
    participant_id: createdParticipantId,
    direction: PaymentDirection.IN,
    scheduled_amount: 500_000,
    due_date: '2026-12-15',
  };

  await t.test('4a. Open Formula POST settlement/payment-schedules returns 409', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/formulas/${createdFormulaId}/settlement/payment-schedules`,
      headers: withBearer(authFixture.accessToken, { 'content-type': 'application/json' }),
      payload: openSchedulePayload,
    });

    assert.equal(response.statusCode, 409);

    const body = readJsonBody(response.payload);
    assert.equal(typeof body.message, 'string');
  });

  await t.test('4b. Open Formula POST settlement/notes returns 409', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/formulas/${createdFormulaId}/settlement/notes`,
      headers: withBearer(authFixture.accessToken, { 'content-type': 'application/json' }),
      payload: {
        note: 'should fail on open formula',
      },
    });

    assert.equal(response.statusCode, 409);

    const body = readJsonBody(response.payload);
    assert.equal(typeof body.message, 'string');
  });

  const missingSchedulePayload = {
    participant_id: sampleParticipantIdForValidation,
    direction: PaymentDirection.IN,
    scheduled_amount: 1000,
    due_date: '2026-01-01',
  };

  await t.test('5a. Missing Formula POST settlement/payment-schedules returns 404', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/formulas/${missingFormulaId}/settlement/payment-schedules`,
      headers: withBearer(authFixture.accessToken, { 'content-type': 'application/json' }),
      payload: missingSchedulePayload,
    });

    assert.equal(response.statusCode, 404);

    const body = readJsonBody(response.payload);
    assert.equal(typeof body.message, 'string');
  });

  await t.test('5b. Missing Formula POST settlement/notes returns 404', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/formulas/${missingFormulaId}/settlement/notes`,
      headers: withBearer(authFixture.accessToken, { 'content-type': 'application/json' }),
      payload: {
        note: 'missing formula note',
      },
    });

    assert.equal(response.statusCode, 404);

    const body = readJsonBody(response.payload);
    assert.equal(typeof body.message, 'string');
  });
});
