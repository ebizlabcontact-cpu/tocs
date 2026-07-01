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
  MembershipRole,
} from '@prisma/client';

import { closeFormula } from '../actions/close.actions.js';
import { ActionError, createFormula } from '../actions/formula.actions.js';
import type { CreateFormulaRequest } from '../actions/formula.actions.js';
import {
  createParticipant,
  getParticipantById,
  listParticipantsByFormulaId,
  type CreateParticipantRequest,
  type ParticipantVersionRequest,
} from '../actions/participant.actions.js';
import { prisma } from '../lib/prisma.js';
import {
  bearerHeaders,
  createTestAuthFixture,
  deleteTestAuthFixture,
  withBearer,
  withCompanyScopeAll,
} from './helpers/http-auth.helper.js';
import type { CreateFormulaInput } from '../types/formula.types.js';
import type {
  CreateParticipantInputPayload,
  ParticipantVersionPayloadInput,
  ValidatedCreateParticipantInput,
} from '../types/participant.types.js';
import { validateCreateFormula } from '../utils/formula.validation.js';
import {
  validateCreateParticipant,
  ValidationError,
} from '../utils/participant.validation.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const sampleFormulaId = 'cccccccc-cccc-cccc-cccc-cccccccccc01';
const sampleCompanyId = 'dddddddd-dddd-dddd-dddd-dddddddddd01';
const missingCompanyId = '00000000-0000-0000-0000-000000000099';

function readJsonBody(payload: string): Record<string, unknown> {
  return JSON.parse(payload) as Record<string, unknown>;
}

function toRequestQuantity(value: CreateFormulaInput['quantity']): number | string {
  return typeof value === 'object' && value !== null && 'toString' in value
    ? value.toString()
    : value;
}

function toCreateFormulaRequest(input: CreateFormulaInput): CreateFormulaRequest {
  return {
    trade_type: input.tradeType,
    item_id: input.itemId,
    quantity: toRequestQuantity(input.quantity),
    base_currency: input.baseCurrency,
  };
}

function buildValidVersionPayload(label = 'participant-create'): ParticipantVersionPayloadInput {
  return {
    snapshot: { label },
    changedBy: 'participant.integration.test',
    changeReason: 'integration test',
    calculation: {
      quantity: 1000,
      totalBuyAmount: 100_000,
      totalSellAmount: 120_000,
      totalCost: 5000,
      totalShare: 0,
      netProfit: 14_000,
      snapshotData: { source: 'participant.integration.test', label },
    },
  };
}

function buildValidCreateParticipantPayload(
  formulaId: string = sampleFormulaId,
  companyId: string = sampleCompanyId,
  overrides: Partial<CreateParticipantInputPayload> = {},
): CreateParticipantInputPayload {
  return {
    formulaId,
    companyId,
    sequenceOrder: 1,
    roleGroup: 'SUPPLIER',
    version: buildValidVersionPayload(),
    ...overrides,
  };
}

function toAmount(value: number | string | { toString(): string }): number | string {
  return typeof value === 'object' && value !== null && 'toString' in value
    ? value.toString()
    : value;
}

function toParticipantVersionRequest(
  version: ValidatedCreateParticipantInput['version'],
): ParticipantVersionRequest {
  const calculation = version.calculation;

  return {
    snapshot: version.snapshot,
    changed_by: version.changedBy,
    change_reason: version.changeReason,
    calculation: {
      quantity: toAmount(calculation.quantity),
      total_buy_amount: toAmount(calculation.totalBuyAmount),
      total_sell_amount: toAmount(calculation.totalSellAmount),
      total_cost: toAmount(calculation.totalCost),
      total_share: toAmount(calculation.totalShare),
      net_profit: toAmount(calculation.netProfit),
      snapshot_data: calculation.snapshotData,
    },
  };
}

function toCreateParticipantRequest(
  validated: ValidatedCreateParticipantInput,
): CreateParticipantRequest {
  const body: CreateParticipantRequest = {
    company_id: validated.companyId,
    sequence_order: validated.sequenceOrder,
    role_group: validated.roleGroup,
    version: toParticipantVersionRequest(validated.version),
  };

  if (validated.natureGroup !== undefined) body.nature_group = validated.natureGroup;
  if (validated.paymentGroup !== undefined) body.payment_group = validated.paymentGroup;
  if (validated.buyUnitPrice !== undefined) body.buy_unit_price = toAmount(validated.buyUnitPrice);
  if (validated.sellUnitPrice !== undefined) body.sell_unit_price = toAmount(validated.sellUnitPrice);
  if (validated.quantity !== undefined) body.quantity = toAmount(validated.quantity);
  if (validated.directCostAmount !== undefined) {
    body.direct_cost_amount = toAmount(validated.directCostAmount);
  }
  if (validated.isStartPoint !== undefined) body.is_start_point = validated.isStartPoint;
  if (validated.isEndPoint !== undefined) body.is_end_point = validated.isEndPoint;
  if (validated.memo !== undefined) body.memo = validated.memo;

  return body;
}

function assertActionError(error: unknown, status: number): boolean {
  assert.ok(error instanceof ActionError);
  assert.equal(error.status, status);
  return true;
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
      itemCode: `TEST-PAR-INT-${Date.now()}`,
      itemName: 'Participant Integration Test Item',
      defaultUnit: 'kg',
      isActive: true,
    },
  });

  return { itemId: created.id, created: true };
}

async function createTestCompany(prismaClient: PrismaClient, label: string): Promise<string> {
  const company = await prismaClient.company.create({
    data: {
      companyName: `Participant Integration Test Co ${label} ${Date.now()}`,
      isActive: true,
    },
  });

  return company.id;
}

async function createTestFormula(
  itemId: string,
  quantity: number,
): Promise<{ id: string; quantity: string }> {
  const validatedFormula = validateCreateFormula({
    tradeType: TradeType.DOMESTIC,
    itemId,
    quantity,
    unit: 'kg',
    content: 'participant integration test',
    createdBy: 'participant.integration.test',
  });

  const formula = await createFormula(toCreateFormulaRequest(validatedFormula));

  return { id: formula.id, quantity: String(quantity) };
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

async function cleanupParticipantTestArtifacts(params: {
  prisma: PrismaClient;
  auditLogIds: string[];
  snapshotIds: string[];
  versionIds: string[];
  participantIds: string[];
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

function trackVersionArtifacts(
  result: Awaited<ReturnType<typeof createParticipant>>,
  auditLogIds: string[],
  snapshotIds: string[],
  versionIds: string[],
  participantIds: string[],
): void {
  participantIds.push(result.participant.id);
  versionIds.push(result.version.version.id);
  snapshotIds.push(result.version.snapshot.id);
  auditLogIds.push(result.version.audit_log.id);
}

// ---------------------------------------------------------------------------
// 1. validateCreateParticipant
// ---------------------------------------------------------------------------

test('1a. validateCreateParticipant passes valid payload', () => {
  const validated = validateCreateParticipant(
    buildValidCreateParticipantPayload(sampleFormulaId, sampleCompanyId),
  );

  assert.equal(validated.formulaId, sampleFormulaId);
  assert.equal(validated.companyId, sampleCompanyId);
  assert.equal(validated.sequenceOrder, 1);
  assert.equal(validated.roleGroup, 'SUPPLIER');
  assert.equal(validated.version.calculation.netProfit, 14_000);
});

test('1b. validateCreateParticipant rejects missing formulaId', () => {
  const payload = buildValidCreateParticipantPayload(sampleFormulaId, sampleCompanyId);
  const { formulaId: _formulaId, ...withoutFormulaId } = payload;

  assert.throws(
    () => validateCreateParticipant(withoutFormulaId),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'formulaId');
      return true;
    },
  );
});

test('1c. validateCreateParticipant rejects missing companyId', () => {
  const payload = buildValidCreateParticipantPayload(sampleFormulaId, sampleCompanyId);
  const { companyId: _companyId, ...withoutCompanyId } = payload;

  assert.throws(
    () => validateCreateParticipant(withoutCompanyId),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'companyId');
      return true;
    },
  );
});

test('1d. validateCreateParticipant rejects missing sequenceOrder', () => {
  const payload = buildValidCreateParticipantPayload(sampleFormulaId, sampleCompanyId);
  const { sequenceOrder: _sequenceOrder, ...withoutSequenceOrder } = payload;

  assert.throws(
    () => validateCreateParticipant(withoutSequenceOrder),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'sequenceOrder');
      return true;
    },
  );
});

test('1e. validateCreateParticipant rejects sequenceOrder 0', () => {
  assert.throws(
    () =>
      validateCreateParticipant(
        buildValidCreateParticipantPayload(sampleFormulaId, sampleCompanyId, {
          sequenceOrder: 0,
        }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'sequenceOrder');
      return true;
    },
  );
});

test('1f. validateCreateParticipant rejects missing roleGroup', () => {
  const payload = buildValidCreateParticipantPayload(sampleFormulaId, sampleCompanyId);
  const { roleGroup: _roleGroup, ...withoutRoleGroup } = payload;

  assert.throws(
    () => validateCreateParticipant(withoutRoleGroup),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'roleGroup');
      return true;
    },
  );
});

test('1g. validateCreateParticipant rejects invalid roleGroup', () => {
  assert.throws(
    () =>
      validateCreateParticipant(
        buildValidCreateParticipantPayload(sampleFormulaId, sampleCompanyId, {
          roleGroup: 'INVALID_ROLE',
        }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'roleGroup');
      return true;
    },
  );
});

test('1h. validateCreateParticipant rejects missing version payload', () => {
  const payload = buildValidCreateParticipantPayload(sampleFormulaId, sampleCompanyId);
  const { version: _version, ...withoutVersion } = payload;

  assert.throws(
    () => validateCreateParticipant(withoutVersion),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'version');
      return true;
    },
  );
});

test('1i. validateCreateParticipant rejects missing calculation.netProfit', () => {
  const version = buildValidVersionPayload('missing-net-profit');
  const { netProfit: _netProfit, ...calculationWithoutNetProfit } = version.calculation!;

  assert.throws(
    () =>
      validateCreateParticipant(
        buildValidCreateParticipantPayload(sampleFormulaId, sampleCompanyId, {
          version: {
            ...version,
            calculation: calculationWithoutNetProfit,
          },
        }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'version.calculation.netProfit');
      return true;
    },
  );
});

test('1j. validateCreateParticipant allows omitted quantity', () => {
  const payload = buildValidCreateParticipantPayload(sampleFormulaId, sampleCompanyId);
  const validated = validateCreateParticipant(payload);

  assert.equal(validated.quantity, undefined);
});

// ---------------------------------------------------------------------------
// DB integration
// ---------------------------------------------------------------------------

test('Participant integration flow', { skip: !hasDatabase }, async (t) => {
  let createdItemId: string | undefined;
  let createdItemWasNew = false;
  const auditLogIds: string[] = [];
  const snapshotIds: string[] = [];
  const versionIds: string[] = [];
  const participantIds: string[] = [];
  const formulaIds: string[] = [];
  const companyIds: string[] = [];

  t.after(async () => {
    await cleanupParticipantTestArtifacts({
      prisma,
      auditLogIds,
      snapshotIds,
      versionIds,
      participantIds,
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

  await t.test('2. createParticipant creates participant and version artifacts', async () => {
    const companyId = await createTestCompany(prisma, 'version-trigger');
    companyIds.push(companyId);

    const formula = await createTestFormula(itemId, 1000);
    formulaIds.push(formula.id);

    const validated = validateCreateParticipant(
      buildValidCreateParticipantPayload(formula.id, companyId, {
        isStartPoint: true,
        isEndPoint: true,
      }),
    );

    const result = await createParticipant(formula.id, toCreateParticipantRequest(validated));
    trackVersionArtifacts(result, auditLogIds, snapshotIds, versionIds, participantIds);

    assert.equal(result.participant.formula_id, formula.id);
    assert.equal(result.participant.company_id, companyId);
    assert.equal(result.participant.sequence_order, 1);
    assert.equal(result.version.version.version_no, 1);
    assert.equal(result.version.audit_log.action, 'VERSION_CREATE');

    const participantRow = await prisma.formulaParticipant.findUnique({
      where: { id: result.participant.id },
    });
    const versionRow = await prisma.formulaVersion.findUnique({
      where: { id: result.version.version.id },
    });
    const snapshotRow = await prisma.calculationSnapshot.findUnique({
      where: { id: result.version.snapshot.id },
    });
    const auditRow = await prisma.auditLog.findUnique({
      where: { id: result.version.audit_log.id },
    });

    assert.ok(participantRow);
    assert.ok(versionRow);
    assert.ok(snapshotRow);
    assert.ok(auditRow);
    assert.equal(snapshotRow.formulaVersionId, result.version.version.id);
    assert.equal(auditRow.tableName, 'formula_versions');
  });

  await t.test('3. createParticipant inherits formula quantity when body.quantity is omitted', async () => {
    const companyId = await createTestCompany(prisma, 'quantity-inherit');
    companyIds.push(companyId);

    const formula = await createTestFormula(itemId, 2500);
    formulaIds.push(formula.id);

    const validated = validateCreateParticipant(
      buildValidCreateParticipantPayload(formula.id, companyId, {
        sequenceOrder: 1,
      }),
    );

    const body = toCreateParticipantRequest(validated);
    assert.equal(body.quantity, undefined);

    const result = await createParticipant(formula.id, body);
    trackVersionArtifacts(result, auditLogIds, snapshotIds, versionIds, participantIds);

    assert.equal(result.participant.quantity, formula.quantity);
  });

  await t.test('4. duplicate sequence_order returns ActionError 409', async () => {
    const companyId = await createTestCompany(prisma, 'sequence-conflict');
    companyIds.push(companyId);

    const formula = await createTestFormula(itemId, 1000);
    formulaIds.push(formula.id);

    const firstValidated = validateCreateParticipant(
      buildValidCreateParticipantPayload(formula.id, companyId, { sequenceOrder: 1 }),
    );
    const firstResult = await createParticipant(formula.id, toCreateParticipantRequest(firstValidated));
    trackVersionArtifacts(firstResult, auditLogIds, snapshotIds, versionIds, participantIds);

    const duplicateValidated = validateCreateParticipant(
      buildValidCreateParticipantPayload(formula.id, companyId, { sequenceOrder: 1 }),
    );

    await assert.rejects(
      () => createParticipant(formula.id, toCreateParticipantRequest(duplicateValidated)),
      (error: unknown) => assertActionError(error, 409),
    );
  });

  await t.test('5a. duplicate is_start_point returns ActionError 409', async () => {
    const companyId = await createTestCompany(prisma, 'start-point-conflict');
    companyIds.push(companyId);

    const formula = await createTestFormula(itemId, 1000);
    formulaIds.push(formula.id);

    const firstValidated = validateCreateParticipant(
      buildValidCreateParticipantPayload(formula.id, companyId, {
        sequenceOrder: 1,
        isStartPoint: true,
      }),
    );
    const firstResult = await createParticipant(formula.id, toCreateParticipantRequest(firstValidated));
    trackVersionArtifacts(firstResult, auditLogIds, snapshotIds, versionIds, participantIds);

    const secondValidated = validateCreateParticipant(
      buildValidCreateParticipantPayload(formula.id, companyId, {
        sequenceOrder: 2,
        isStartPoint: true,
      }),
    );

    await assert.rejects(
      () => createParticipant(formula.id, toCreateParticipantRequest(secondValidated)),
      (error: unknown) => assertActionError(error, 409),
    );
  });

  await t.test('5b. duplicate is_end_point returns ActionError 409', async () => {
    const companyId = await createTestCompany(prisma, 'end-point-conflict');
    companyIds.push(companyId);

    const formula = await createTestFormula(itemId, 1000);
    formulaIds.push(formula.id);

    const firstValidated = validateCreateParticipant(
      buildValidCreateParticipantPayload(formula.id, companyId, {
        sequenceOrder: 1,
        isEndPoint: true,
      }),
    );
    const firstResult = await createParticipant(formula.id, toCreateParticipantRequest(firstValidated));
    trackVersionArtifacts(firstResult, auditLogIds, snapshotIds, versionIds, participantIds);

    const secondValidated = validateCreateParticipant(
      buildValidCreateParticipantPayload(formula.id, companyId, {
        sequenceOrder: 2,
        isEndPoint: true,
      }),
    );

    await assert.rejects(
      () => createParticipant(formula.id, toCreateParticipantRequest(secondValidated)),
      (error: unknown) => assertActionError(error, 409),
    );
  });

  await t.test('6. same company_id with different sequence_order is allowed', async () => {
    const companyId = await createTestCompany(prisma, 'same-company');
    companyIds.push(companyId);

    const formula = await createTestFormula(itemId, 1000);
    formulaIds.push(formula.id);

    const firstValidated = validateCreateParticipant(
      buildValidCreateParticipantPayload(formula.id, companyId, { sequenceOrder: 1 }),
    );
    const firstResult = await createParticipant(formula.id, toCreateParticipantRequest(firstValidated));
    trackVersionArtifacts(firstResult, auditLogIds, snapshotIds, versionIds, participantIds);

    const secondValidated = validateCreateParticipant(
      buildValidCreateParticipantPayload(formula.id, companyId, {
        sequenceOrder: 2,
        roleGroup: 'BUYER',
      }),
    );
    const secondResult = await createParticipant(formula.id, toCreateParticipantRequest(secondValidated));
    trackVersionArtifacts(secondResult, auditLogIds, snapshotIds, versionIds, participantIds);

    assert.equal(firstResult.participant.company_id, companyId);
    assert.equal(secondResult.participant.company_id, companyId);
    assert.notEqual(firstResult.participant.id, secondResult.participant.id);
    assert.equal(firstResult.participant.sequence_order, 1);
    assert.equal(secondResult.participant.sequence_order, 2);
  });

  await t.test('7. missing company_id returns ActionError 404', async () => {
    const formula = await createTestFormula(itemId, 1000);
    formulaIds.push(formula.id);

    const validated = validateCreateParticipant(
      buildValidCreateParticipantPayload(formula.id, missingCompanyId, { sequenceOrder: 1 }),
    );

    await assert.rejects(
      () => createParticipant(formula.id, toCreateParticipantRequest(validated)),
      (error: unknown) => assertActionError(error, 404),
    );
  });

  await t.test('8. closed formula rejects createParticipant with ActionError 409', async () => {
    const companyId = await createTestCompany(prisma, 'closed-formula');
    companyIds.push(companyId);

    const formula = await createTestFormula(itemId, 1000);
    formulaIds.push(formula.id);

    await setFormulaStatusesForClose(prisma, formula.id);

    await closeFormula(formula.id, { closed_by: 'participant.integration.test' });

    const validated = validateCreateParticipant(
      buildValidCreateParticipantPayload(formula.id, companyId, { sequenceOrder: 1 }),
    );

    await assert.rejects(
      () => createParticipant(formula.id, toCreateParticipantRequest(validated)),
      (error: unknown) => assertActionError(error, 409),
    );
  });

  const app = await createTestApp();
  const authFixture = await createTestAuthFixture(
    MembershipRole.SUPER_ADMIN,
    'participant-http',
  );

  t.after(async () => {
    await app.close();
    await deleteTestAuthFixture(authFixture);
  });

  let httpFormulaId: string | undefined;
  let httpCompanyId: string | undefined;
  let httpParticipantId: string | undefined;

  await t.test('9a. HTTP POST /api/v1/formulas/:formulaId/participants returns 201', async () => {
    httpCompanyId = await createTestCompany(prisma, 'http');
    companyIds.push(httpCompanyId);

    const formula = await createTestFormula(itemId, 1000);
    httpFormulaId = formula.id;
    formulaIds.push(formula.id);

    const validated = validateCreateParticipant(
      buildValidCreateParticipantPayload(formula.id, httpCompanyId, { sequenceOrder: 1 }),
    );

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/formulas/${formula.id}/participants`,
      headers: withBearer(authFixture.accessToken, { 'content-type': 'application/json' }),
      payload: toCreateParticipantRequest(validated),
    });

    assert.equal(response.statusCode, 201);

    const body = readJsonBody(response.payload) as {
      participant: { id: string; formula_id: string };
      version: {
        version: { id: string };
        snapshot: { id: string };
        audit_log: { id: string; action: string };
      };
    };

    assert.equal(typeof body.participant.id, 'string');
    assert.equal(body.participant.formula_id, formula.id);
    assert.equal(body.version.audit_log.action, 'VERSION_CREATE');

    httpParticipantId = body.participant.id;
    participantIds.push(body.participant.id);
    versionIds.push(body.version.version.id);
    snapshotIds.push(body.version.snapshot.id);
    auditLogIds.push(body.version.audit_log.id);
  });

  await t.test('9b. HTTP GET /api/v1/formulas/:formulaId/participants returns 200', async () => {
    assert.ok(httpFormulaId);
    assert.ok(httpParticipantId);

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/formulas/${httpFormulaId}/participants`,
      headers: withCompanyScopeAll(authFixture.accessToken),
    });

    assert.equal(response.statusCode, 200);

    const body = readJsonBody(response.payload) as { items: Array<{ id: string }> };
    assert.ok(Array.isArray(body.items));
    assert.ok(body.items.some((item) => item.id === httpParticipantId));
  });

  await t.test('9c. HTTP GET /api/v1/participants/:participantId returns 200', async () => {
    assert.ok(httpParticipantId);

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/participants/${httpParticipantId}`,
      headers: bearerHeaders(authFixture.accessToken),
    });

    assert.equal(response.statusCode, 200);

    const body = readJsonBody(response.payload) as { id: string };
    assert.equal(body.id, httpParticipantId);

    const actionParticipant = await getParticipantById(httpParticipantId);
    assert.equal(actionParticipant.id, httpParticipantId);
  });

  await t.test('9d. HTTP POST with invalid body returns 400', async () => {
    assert.ok(httpFormulaId);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/formulas/${httpFormulaId}/participants`,
      headers: withBearer(authFixture.accessToken, { 'content-type': 'application/json' }),
      payload: {},
    });

    assert.equal(response.statusCode, 400);

    const body = readJsonBody(response.payload);
    assert.equal(typeof body.message, 'string');
  });

  await t.test('Action listParticipantsByFormulaId returns created participants', async () => {
    assert.ok(httpFormulaId);
    assert.ok(httpParticipantId);

    const list = await listParticipantsByFormulaId(httpFormulaId);
    assert.ok(list.items.some((item) => item.id === httpParticipantId));
  });
});
