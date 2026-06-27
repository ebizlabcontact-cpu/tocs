/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import 'dotenv/config';

import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import {
  InvoiceStatus,
  PaymentStatus,
  TradeStatus,
  TradeType,
} from '@prisma/client';

import { closeFormula } from '../actions/close.actions.js';
import {
  ActionError,
  createFormula,
  patchFormula,
  type CreateFormulaRequest,
  type PatchFormulaRequest,
} from '../actions/formula.actions.js';
import { prisma } from '../lib/prisma.js';
import type { CreateFormulaInput, PatchFormulaInputPayload } from '../types/formula.types.js';
import { validateCreateFormula, validatePatchFormula, ValidationError } from '../utils/formula.validation.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const sampleFormulaId = '11111111-1111-1111-1111-111111111101';
const missingFormulaId = '00000000-0000-0000-0000-000000000099';

function readJsonBody(payload: string): Record<string, unknown> {
  return JSON.parse(payload) as Record<string, unknown>;
}

function toRequestQuantity(value: CreateFormulaInput['quantity']): number | string {
  return typeof value === 'object' && value !== null && 'toString' in value
    ? value.toString()
    : value;
}

function toCreateFormulaRequest(input: CreateFormulaInput): CreateFormulaRequest {
  const body: CreateFormulaRequest = {
    trade_type: input.tradeType,
    item_id: input.itemId,
    quantity: toRequestQuantity(input.quantity),
    base_currency: input.baseCurrency,
  };

  if (input.unit !== undefined) body.unit = input.unit;
  if (input.content !== undefined) body.content = input.content;
  if (input.note !== undefined) body.note = input.note;
  if (input.createdBy !== undefined) body.created_by = input.createdBy;

  return body;
}

function assertActionError(error: unknown, status: number): boolean {
  assert.ok(error instanceof ActionError);
  assert.equal(error.status, status);
  return true;
}

function patchPayloadWithExtraKey(
  base: PatchFormulaInputPayload,
  extraKey: string,
  extraValue: unknown,
): PatchFormulaInputPayload {
  return {
    ...base,
    [extraKey]: extraValue,
  } as PatchFormulaInputPayload;
}

async function resolveTestItemId(
  prismaClient: PrismaClient,
): Promise<{ itemId: string; created: boolean }> {
  const existing = await prismaClient.item.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) {
    return { itemId: existing.id, created: false };
  }

  const created = await prismaClient.item.create({
    data: {
      itemCode: `TEST-FP-INT-${Date.now()}`,
      itemName: 'Formula PATCH Integration Test Item',
      defaultUnit: 'kg',
      isActive: true,
    },
  });

  return { itemId: created.id, created: true };
}

async function createTestFormula(itemId: string): Promise<{ id: string }> {
  const validated = validateCreateFormula({
    tradeType: TradeType.DOMESTIC,
    itemId,
    quantity: 1000,
    unit: 'kg',
    content: 'initial content',
    note: 'initial note',
    createdBy: 'formula.patch.integration.test',
  });

  const formula = await createFormula(toCreateFormulaRequest(validated));

  return { id: formula.id };
}

async function setFormulaStatusesForClose(
  prismaClient: PrismaClient,
  formulaId: string,
): Promise<void> {
  await prismaClient.formula.update({
    where: { id: formulaId },
    data: {
      tradeStatus: TradeStatus.COMPLETED,
      deliveryStatus: TradeStatus.COMPLETED,
      cashInStatus: PaymentStatus.COMPLETED,
      cashOutStatus: PaymentStatus.COMPLETED,
      invoiceStatus: InvoiceStatus.AMOUNT_MATCHED,
      logisticsStatus: TradeStatus.COMPLETED,
    },
  });
}

async function cleanupFormulaPatchTestArtifacts(params: {
  prisma: PrismaClient;
  auditLogIds: string[];
  snapshotIds: string[];
  versionIds: string[];
  participantIds: string[];
  logisticsIds: string[];
  formulaIds: string[];
  companyIds: string[];
  itemId?: string;
  itemWasNew?: boolean;
}): Promise<void> {
  for (const id of params.auditLogIds) {
    await params.prisma.auditLog.delete({ where: { id } });
  }

  for (const id of params.snapshotIds) {
    await params.prisma.calculationSnapshot.delete({ where: { id } });
  }

  for (const id of params.versionIds) {
    await params.prisma.formulaVersion.delete({ where: { id } });
  }

  for (const id of params.participantIds) {
    await params.prisma.formulaParticipant.delete({ where: { id } });
  }

  for (const id of params.logisticsIds) {
    await params.prisma.logistics.delete({ where: { id } });
  }

  for (const id of params.formulaIds) {
    await params.prisma.formula.delete({ where: { id } });
  }

  for (const id of params.companyIds) {
    await params.prisma.company.delete({ where: { id } });
  }

  if (params.itemWasNew && params.itemId) {
    await params.prisma.item.delete({ where: { id: params.itemId } });
  }
}

async function createTestApp(): Promise<FastifyInstance> {
  const { createServer } = await import('../http/server.js');
  return createServer();
}

async function countFormulaArtifacts(prismaClient: PrismaClient, formulaId: string) {
  const versions = await prismaClient.formulaVersion.findMany({
    where: { formulaId },
    select: { id: true },
  });
  const versionIdList = versions.map((version) => version.id);

  const [versionCount, snapshotCount, auditLogCount] = await Promise.all([
    prismaClient.formulaVersion.count({ where: { formulaId } }),
    prismaClient.calculationSnapshot.count({ where: { formulaId } }),
    versionIdList.length === 0
      ? Promise.resolve(0)
      : prismaClient.auditLog.count({
          where: {
            tableName: 'formula_versions',
            recordId: { in: versionIdList },
          },
        }),
  ]);

  return { versionCount, snapshotCount, auditLogCount };
}

// ---------------------------------------------------------------------------
// 1. validatePatchFormula
// ---------------------------------------------------------------------------

test('1a. validatePatchFormula passes with content only', () => {
  const validated = validatePatchFormula({
    formulaId: sampleFormulaId,
    content: 'patched content',
  });

  assert.equal(validated.formulaId, sampleFormulaId);
  assert.equal(validated.content, 'patched content');
  assert.equal(validated.note, undefined);
  assert.equal(validated.unit, undefined);
});

test('1b. validatePatchFormula passes with note only', () => {
  const validated = validatePatchFormula({
    formulaId: sampleFormulaId,
    note: 'patched note',
  });

  assert.equal(validated.note, 'patched note');
  assert.equal(validated.content, undefined);
});

test('1c. validatePatchFormula passes with unit only', () => {
  const validated = validatePatchFormula({
    formulaId: sampleFormulaId,
    unit: 'ton',
  });

  assert.equal(validated.unit, 'ton');
});

test('1d. validatePatchFormula passes with content, note, and unit', () => {
  const validated = validatePatchFormula({
    formulaId: sampleFormulaId,
    content: 'content-all',
    note: 'note-all',
    unit: 'box',
  });

  assert.equal(validated.content, 'content-all');
  assert.equal(validated.note, 'note-all');
  assert.equal(validated.unit, 'box');
});

test('1e. validatePatchFormula rejects empty patch body', () => {
  assert.throws(
    () =>
      validatePatchFormula({
        formulaId: sampleFormulaId,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      return true;
    },
  );
});

test('1f. validatePatchFormula rejects forbidden field quantity', () => {
  assert.throws(
    () =>
      validatePatchFormula(
        patchPayloadWithExtraKey(
          { formulaId: sampleFormulaId, content: 'x' },
          'quantity',
          10,
        ),
      ),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'quantity');
      return true;
    },
  );
});

test('1g. validatePatchFormula rejects forbidden field trade_status', () => {
  assert.throws(
    () =>
      validatePatchFormula(
        patchPayloadWithExtraKey(
          { formulaId: sampleFormulaId, content: 'x' },
          'trade_status',
          TradeStatus.COMPLETED,
        ),
      ),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'trade_status');
      return true;
    },
  );
});

test('1h. validatePatchFormula rejects forbidden field is_closed', () => {
  assert.throws(
    () =>
      validatePatchFormula(
        patchPayloadWithExtraKey({ formulaId: sampleFormulaId, note: 'x' }, 'is_closed', true),
      ),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'is_closed');
      return true;
    },
  );
});

test('1i. validatePatchFormula rejects unit length over 50', () => {
  assert.throws(
    () =>
      validatePatchFormula({
        formulaId: sampleFormulaId,
        unit: 'x'.repeat(51),
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'unit');
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// DB integration
// ---------------------------------------------------------------------------

test('Formula PATCH integration flow', { skip: !hasDatabase }, async (t) => {
  let createdItemId: string | undefined;
  let createdItemWasNew = false;
  const auditLogIds: string[] = [];
  const snapshotIds: string[] = [];
  const versionIds: string[] = [];
  const participantIds: string[] = [];
  const logisticsIds: string[] = [];
  const formulaIds: string[] = [];
  const companyIds: string[] = [];

  t.after(async () => {
    await cleanupFormulaPatchTestArtifacts({
      prisma,
      auditLogIds,
      snapshotIds,
      versionIds,
      participantIds,
      logisticsIds,
      formulaIds,
      companyIds,
      ...(createdItemId ? { itemId: createdItemId } : {}),
      ...(createdItemWasNew ? { itemWasNew: createdItemWasNew } : {}),
    });
    await prisma.$disconnect();
  });

  const { itemId, created: itemCreated } = await resolveTestItemId(prisma);
  createdItemId = itemId;
  createdItemWasNew = itemCreated;

  await t.test('2. patchFormula updates metadata without version artifacts', async () => {
    const formula = await createTestFormula(itemId);
    formulaIds.push(formula.id);

    const beforeRow = await prisma.formula.findUniqueOrThrow({ where: { id: formula.id } });
    const countsBefore = await countFormulaArtifacts(prisma, formula.id);

    const body: PatchFormulaRequest = {
      content: 'patched content',
      note: 'patched note',
      unit: 'ton',
    };

    const result = await patchFormula(formula.id, body);

    assert.equal(result.content, 'patched content');
    assert.equal(result.note, 'patched note');
    assert.equal(result.unit, 'ton');

    const afterRow = await prisma.formula.findUniqueOrThrow({ where: { id: formula.id } });
    assert.equal(afterRow.content, 'patched content');
    assert.equal(afterRow.note, 'patched note');
    assert.equal(afterRow.unit, 'ton');
    assert.ok(afterRow.updatedAt.getTime() >= beforeRow.updatedAt.getTime());

    const countsAfter = await countFormulaArtifacts(prisma, formula.id);
    assert.equal(countsAfter.versionCount, countsBefore.versionCount);
    assert.equal(countsAfter.snapshotCount, countsBefore.snapshotCount);
    assert.equal(countsAfter.auditLogCount, countsBefore.auditLogCount);
  });

  await t.test('3. closed formula rejects patchFormula with ActionError 409', async () => {
    const formula = await createTestFormula(itemId);
    formulaIds.push(formula.id);

    await setFormulaStatusesForClose(prisma, formula.id);
    await closeFormula(formula.id, { closed_by: 'formula.patch.integration.test' });

    await assert.rejects(
      () =>
        patchFormula(formula.id, {
          content: 'should not patch closed formula',
        }),
      (error: unknown) => assertActionError(error, 409),
    );
  });

  await t.test('4. missing formula returns ActionError 404', async () => {
    await assert.rejects(
      () =>
        patchFormula(missingFormulaId, {
          note: 'missing formula patch',
        }),
      (error: unknown) => assertActionError(error, 404),
    );
  });

  const app = await createTestApp();
  t.after(async () => {
    await app.close();
  });

  let httpFormulaId: string | undefined;

  await t.test('5a. HTTP PATCH /api/v1/formulas/:formulaId returns 200', async () => {
    const formula = await createTestFormula(itemId);
    httpFormulaId = formula.id;
    formulaIds.push(formula.id);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/formulas/${formula.id}`,
      headers: { 'content-type': 'application/json' },
      payload: {
        content: 'http patched content',
        note: 'http patched note',
        unit: 'box',
      } satisfies PatchFormulaRequest,
    });

    assert.equal(response.statusCode, 200);

    const body = readJsonBody(response.payload) as {
      id: string;
      content: string;
      note: string;
      unit: string;
    };

    assert.equal(body.id, formula.id);
    assert.equal(body.content, 'http patched content');
    assert.equal(body.note, 'http patched note');
    assert.equal(body.unit, 'box');
  });

  await t.test('5b. HTTP PATCH with invalid body returns 400', async () => {
    assert.ok(httpFormulaId);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/formulas/${httpFormulaId}`,
      headers: { 'content-type': 'application/json' },
      payload: { quantity: 10 },
    });

    assert.equal(response.statusCode, 400);

    const body = readJsonBody(response.payload);
    assert.equal(typeof body.message, 'string');
  });

  await t.test('5c. HTTP PATCH on closed formula returns 409', async () => {
    const formula = await createTestFormula(itemId);
    formulaIds.push(formula.id);

    await setFormulaStatusesForClose(prisma, formula.id);
    await closeFormula(formula.id, { closed_by: 'formula.patch.integration.test' });

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/formulas/${formula.id}`,
      headers: { 'content-type': 'application/json' },
      payload: { content: 'closed patch attempt' },
    });

    assert.equal(response.statusCode, 409);
  });

  await t.test('5d. HTTP PATCH on missing formula returns 404', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/formulas/${missingFormulaId}`,
      headers: { 'content-type': 'application/json' },
      payload: { note: 'missing formula http patch' },
    });

    assert.equal(response.statusCode, 404);
  });
});
