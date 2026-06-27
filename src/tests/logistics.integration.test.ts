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
import { ActionError, createFormula } from '../actions/formula.actions.js';
import type { CreateFormulaRequest } from '../actions/formula.actions.js';
import {
  createLogistics,
  getLogisticsById,
  listLogisticsByFormulaId,
  updateLogisticsStatus,
  type CreateLogisticsRequest,
  type LogisticsVersionRequest,
} from '../actions/logistics.actions.js';
import { prisma } from '../lib/prisma.js';
import type { CreateFormulaInput } from '../types/formula.types.js';
import type {
  CreateLogisticsInputPayload,
  LogisticsVersionPayloadInput,
  UpdateLogisticsStatusInputPayload,
  ValidatedCreateLogisticsInput,
} from '../types/logistics.types.js';
import { validateCreateFormula } from '../utils/formula.validation.js';
import {
  validateCreateLogistics,
  validateUpdateLogisticsStatus,
  ValidationError,
} from '../utils/logistics.validation.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const sampleFormulaId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01';
const sampleCompanyId = 'ffffffff-ffff-ffff-ffff-fffffffffff01';
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

function toAmount(value: number | string | { toString(): string }): number | string {
  return typeof value === 'object' && value !== null && 'toString' in value
    ? value.toString()
    : value;
}

function buildValidVersionPayload(label = 'logistics-create'): LogisticsVersionPayloadInput {
  return {
    snapshot: { label },
    changedBy: 'logistics.integration.test',
    changeReason: 'integration test',
    calculation: {
      quantity: 1000,
      totalBuyAmount: 100_000,
      totalSellAmount: 120_000,
      totalCost: 5000,
      totalShare: 0,
      netProfit: 14_000,
      snapshotData: { source: 'logistics.integration.test', label },
    },
  };
}

function buildValidCreateLogisticsPayload(
  formulaId: string = sampleFormulaId,
  carrierCompanyId: string = sampleCompanyId,
  overrides: Partial<CreateLogisticsInputPayload> = {},
): CreateLogisticsInputPayload {
  return {
    formulaId,
    carrierCompanyId,
    totalLogisticsCost: 300_000,
    version: buildValidVersionPayload(),
    ...overrides,
  };
}

function toLogisticsVersionRequest(
  version: ValidatedCreateLogisticsInput['version'],
): LogisticsVersionRequest {
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

function toCreateLogisticsRequest(
  validated: ValidatedCreateLogisticsInput,
): CreateLogisticsRequest {
  const body: CreateLogisticsRequest = {
    carrier_company_id: validated.carrierCompanyId,
    total_logistics_cost: toAmount(validated.totalLogisticsCost),
    version: toLogisticsVersionRequest(validated.version),
  };

  if (validated.departureCompanyId !== undefined) {
    body.departure_company_id = validated.departureCompanyId;
  }
  if (validated.arrivalCompanyId !== undefined) {
    body.arrival_company_id = validated.arrivalCompanyId;
  }
  if (validated.costBearerCompanyId !== undefined) {
    body.cost_bearer_company_id = validated.costBearerCompanyId;
  }
  if (validated.costType !== undefined) body.cost_type = validated.costType;
  if (validated.departureLocation !== undefined) body.departure_location = validated.departureLocation;
  if (validated.arrivalLocation !== undefined) body.arrival_location = validated.arrivalLocation;
  if (validated.itemDescription !== undefined) body.item_description = validated.itemDescription;
  if (validated.transportQuantity !== undefined) {
    body.transport_quantity = toAmount(validated.transportQuantity);
  }
  if (validated.vehicleCount !== undefined) body.vehicle_count = validated.vehicleCount;
  if (validated.scheduledDate !== undefined) {
    body.scheduled_date = validated.scheduledDate.toISOString().slice(0, 10);
  }
  if (validated.memo !== undefined) body.memo = validated.memo;

  return body;
}

function buildValidUpdateLogisticsStatusPayload(
  formulaId: string = sampleFormulaId,
  overrides: Partial<UpdateLogisticsStatusInputPayload> = {},
): UpdateLogisticsStatusInputPayload {
  return {
    formulaId,
    status: TradeStatus.IN_PROGRESS,
    changedBy: 'logistics.integration.test',
    changeReason: 'integration test',
    ...overrides,
  };
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
      itemCode: `TEST-LOG-INT-${Date.now()}`,
      itemName: 'Logistics Integration Test Item',
      defaultUnit: 'kg',
      isActive: true,
    },
  });

  return { itemId: created.id, created: true };
}

async function createTestCompany(prismaClient: PrismaClient, label: string): Promise<string> {
  const company = await prismaClient.company.create({
    data: {
      companyName: `Logistics Integration Test Co ${label} ${Date.now()}`,
      isActive: true,
    },
  });

  return company.id;
}

async function createTestFormula(
  itemId: string,
  quantity: number,
): Promise<{ id: string }> {
  const validatedFormula = validateCreateFormula({
    tradeType: TradeType.DOMESTIC,
    itemId,
    quantity,
    unit: 'kg',
    content: 'logistics integration test',
    createdBy: 'logistics.integration.test',
  });

  const formula = await createFormula(toCreateFormulaRequest(validatedFormula));

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

async function cleanupLogisticsTestArtifacts(params: {
  prisma: PrismaClient;
  auditLogIds: string[];
  snapshotIds: string[];
  versionIds: string[];
  statusLogIds: string[];
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

  for (const id of params.statusLogIds) {
    await params.prisma.statusLog.delete({ where: { id } });
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

function trackCreateLogisticsArtifacts(
  result: Awaited<ReturnType<typeof createLogistics>>,
  auditLogIds: string[],
  snapshotIds: string[],
  versionIds: string[],
  logisticsIds: string[],
): void {
  logisticsIds.push(result.logistics.id);
  versionIds.push(result.version.version.id);
  snapshotIds.push(result.version.snapshot.id);
  auditLogIds.push(result.version.audit_log.id);
}

// ---------------------------------------------------------------------------
// 1. validateCreateLogistics
// ---------------------------------------------------------------------------

test('1a. validateCreateLogistics passes valid payload', () => {
  const validated = validateCreateLogistics(
    buildValidCreateLogisticsPayload(sampleFormulaId, sampleCompanyId),
  );

  assert.equal(validated.formulaId, sampleFormulaId);
  assert.equal(validated.carrierCompanyId, sampleCompanyId);
  assert.equal(validated.totalLogisticsCost, 300_000);
  assert.equal(validated.version.calculation.netProfit, 14_000);
});

test('1b. validateCreateLogistics rejects missing formulaId', () => {
  const payload = buildValidCreateLogisticsPayload(sampleFormulaId, sampleCompanyId);
  const { formulaId: _formulaId, ...withoutFormulaId } = payload;

  assert.throws(
    () => validateCreateLogistics(withoutFormulaId),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'formulaId');
      return true;
    },
  );
});

test('1c. validateCreateLogistics rejects missing carrierCompanyId', () => {
  const payload = buildValidCreateLogisticsPayload(sampleFormulaId, sampleCompanyId);
  const { carrierCompanyId: _carrierCompanyId, ...withoutCarrierCompanyId } = payload;

  assert.throws(
    () => validateCreateLogistics(withoutCarrierCompanyId),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'carrierCompanyId');
      return true;
    },
  );
});

test('1d. validateCreateLogistics rejects missing totalLogisticsCost', () => {
  const payload = buildValidCreateLogisticsPayload(sampleFormulaId, sampleCompanyId);
  const { totalLogisticsCost: _totalLogisticsCost, ...withoutTotalLogisticsCost } = payload;

  assert.throws(
    () => validateCreateLogistics(withoutTotalLogisticsCost),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'totalLogisticsCost');
      return true;
    },
  );
});

test('1e. validateCreateLogistics rejects negative totalLogisticsCost', () => {
  assert.throws(
    () =>
      validateCreateLogistics(
        buildValidCreateLogisticsPayload(sampleFormulaId, sampleCompanyId, {
          totalLogisticsCost: -1,
        }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'totalLogisticsCost');
      return true;
    },
  );
});

test('1f. validateCreateLogistics rejects invalid costType', () => {
  assert.throws(
    () =>
      validateCreateLogistics(
        buildValidCreateLogisticsPayload(sampleFormulaId, sampleCompanyId, {
          costType: 'INVALID_COST_TYPE',
        }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'costType');
      return true;
    },
  );
});

test('1g. validateCreateLogistics rejects invalid scheduledDate', () => {
  assert.throws(
    () =>
      validateCreateLogistics(
        buildValidCreateLogisticsPayload(sampleFormulaId, sampleCompanyId, {
          scheduledDate: 'not-a-date',
        }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'scheduledDate');
      return true;
    },
  );
});

test('1h. validateCreateLogistics rejects missing version payload', () => {
  const payload = buildValidCreateLogisticsPayload(sampleFormulaId, sampleCompanyId);
  const { version: _version, ...withoutVersion } = payload;

  assert.throws(
    () => validateCreateLogistics(withoutVersion),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'version');
      return true;
    },
  );
});

test('1i. validateCreateLogistics rejects missing calculation.netProfit', () => {
  const version = buildValidVersionPayload('missing-net-profit');
  const { netProfit: _netProfit, ...calculationWithoutNetProfit } = version.calculation!;

  assert.throws(
    () =>
      validateCreateLogistics(
        buildValidCreateLogisticsPayload(sampleFormulaId, sampleCompanyId, {
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

// ---------------------------------------------------------------------------
// 2. validateUpdateLogisticsStatus
// ---------------------------------------------------------------------------

test('2a. validateUpdateLogisticsStatus passes valid payload', () => {
  const validated = validateUpdateLogisticsStatus(
    buildValidUpdateLogisticsStatusPayload(sampleFormulaId),
  );

  assert.equal(validated.formulaId, sampleFormulaId);
  assert.equal(validated.status, TradeStatus.IN_PROGRESS);
  assert.equal(validated.changedBy, 'logistics.integration.test');
  assert.equal(validated.changeReason, 'integration test');
});

test('2b. validateUpdateLogisticsStatus rejects missing formulaId', () => {
  const payload = buildValidUpdateLogisticsStatusPayload(sampleFormulaId);
  const { formulaId: _formulaId, ...withoutFormulaId } = payload;

  assert.throws(
    () => validateUpdateLogisticsStatus(withoutFormulaId),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'formulaId');
      return true;
    },
  );
});

test('2c. validateUpdateLogisticsStatus rejects missing status', () => {
  const payload = buildValidUpdateLogisticsStatusPayload(sampleFormulaId);
  const { status: _status, ...withoutStatus } = payload;

  assert.throws(
    () => validateUpdateLogisticsStatus(withoutStatus),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'status');
      return true;
    },
  );
});

test('2d. validateUpdateLogisticsStatus rejects invalid status', () => {
  assert.throws(
    () =>
      validateUpdateLogisticsStatus(
        buildValidUpdateLogisticsStatusPayload(sampleFormulaId, {
          status: 'INVALID_STATUS',
        }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'status');
      return true;
    },
  );
});

test('2e. validateUpdateLogisticsStatus rejects missing changedBy', () => {
  const payload = buildValidUpdateLogisticsStatusPayload(sampleFormulaId);
  const { changedBy: _changedBy, ...withoutChangedBy } = payload;

  assert.throws(
    () => validateUpdateLogisticsStatus(withoutChangedBy),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'changedBy');
      return true;
    },
  );
});

test('2f. validateUpdateLogisticsStatus rejects empty changedBy', () => {
  assert.throws(
    () =>
      validateUpdateLogisticsStatus(
        buildValidUpdateLogisticsStatusPayload(sampleFormulaId, {
          changedBy: '   ',
        }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'changedBy');
      return true;
    },
  );
});

test('2g. validateUpdateLogisticsStatus rejects missing changeReason', () => {
  const payload = buildValidUpdateLogisticsStatusPayload(sampleFormulaId);
  const { changeReason: _changeReason, ...withoutChangeReason } = payload;

  assert.throws(
    () => validateUpdateLogisticsStatus(withoutChangeReason),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'changeReason');
      return true;
    },
  );
});

test('2h. validateUpdateLogisticsStatus rejects empty changeReason', () => {
  assert.throws(
    () =>
      validateUpdateLogisticsStatus(
        buildValidUpdateLogisticsStatusPayload(sampleFormulaId, {
          changeReason: '',
        }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'changeReason');
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// DB integration
// ---------------------------------------------------------------------------

test('Logistics integration flow', { skip: !hasDatabase }, async (t) => {
  let createdItemId: string | undefined;
  let createdItemWasNew = false;
  const auditLogIds: string[] = [];
  const snapshotIds: string[] = [];
  const versionIds: string[] = [];
  const statusLogIds: string[] = [];
  const logisticsIds: string[] = [];
  const formulaIds: string[] = [];
  const companyIds: string[] = [];

  t.after(async () => {
    await cleanupLogisticsTestArtifacts({
      prisma,
      auditLogIds,
      snapshotIds,
      versionIds,
      statusLogIds,
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

  await t.test('3. createLogistics creates logistics and version artifacts', async () => {
    const carrierCompanyId = await createTestCompany(prisma, 'version-trigger');
    const costBearerCompanyId = await createTestCompany(prisma, 'cost-bearer');
    companyIds.push(carrierCompanyId, costBearerCompanyId);

    const formula = await createTestFormula(itemId, 1000);
    formulaIds.push(formula.id);

    const validated = validateCreateLogistics(
      buildValidCreateLogisticsPayload(formula.id, carrierCompanyId, {
        costBearerCompanyId,
      }),
    );

    const result = await createLogistics(formula.id, toCreateLogisticsRequest(validated));
    trackCreateLogisticsArtifacts(result, auditLogIds, snapshotIds, versionIds, logisticsIds);

    assert.equal(result.logistics.formula_id, formula.id);
    assert.equal(result.logistics.carrier_company_id, carrierCompanyId);
    assert.equal(result.logistics.cost_bearer_company_id, costBearerCompanyId);
    assert.equal(result.version.version.version_no, 1);
    assert.equal(result.version.audit_log.action, 'VERSION_CREATE');

    const logisticsRow = await prisma.logistics.findUnique({
      where: { id: result.logistics.id },
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

    assert.ok(logisticsRow);
    assert.ok(versionRow);
    assert.ok(snapshotRow);
    assert.ok(auditRow);
    assert.equal(snapshotRow.formulaVersionId, result.version.version.id);
    assert.equal(auditRow.tableName, 'formula_versions');
  });

  await t.test('4a. cost_bearer rule rejects positive cost without bearer with ActionError 400', async () => {
    const carrierCompanyId = await createTestCompany(prisma, 'cost-bearer-missing');
    companyIds.push(carrierCompanyId);

    const formula = await createTestFormula(itemId, 1000);
    formulaIds.push(formula.id);

    const validated = validateCreateLogistics(
      buildValidCreateLogisticsPayload(formula.id, carrierCompanyId, {
        totalLogisticsCost: 1000,
      }),
    );

    await assert.rejects(
      () => createLogistics(formula.id, toCreateLogisticsRequest(validated)),
      (error: unknown) => assertActionError(error, 400),
    );
  });

  await t.test('4b. zero totalLogisticsCost without costBearerCompanyId succeeds', async () => {
    const carrierCompanyId = await createTestCompany(prisma, 'zero-cost');
    companyIds.push(carrierCompanyId);

    const formula = await createTestFormula(itemId, 1000);
    formulaIds.push(formula.id);

    const validated = validateCreateLogistics(
      buildValidCreateLogisticsPayload(formula.id, carrierCompanyId, {
        totalLogisticsCost: 0,
      }),
    );

    const result = await createLogistics(formula.id, toCreateLogisticsRequest(validated));
    trackCreateLogisticsArtifacts(result, auditLogIds, snapshotIds, versionIds, logisticsIds);

    assert.equal(result.logistics.total_logistics_cost, '0');
    assert.equal(result.logistics.cost_bearer_company_id, null);
  });

  await t.test('5a. missing carrierCompanyId returns ActionError 404', async () => {
    const formula = await createTestFormula(itemId, 1000);
    formulaIds.push(formula.id);

    const validated = validateCreateLogistics(
      buildValidCreateLogisticsPayload(formula.id, missingCompanyId, {
        totalLogisticsCost: 0,
      }),
    );

    await assert.rejects(
      () => createLogistics(formula.id, toCreateLogisticsRequest(validated)),
      (error: unknown) => assertActionError(error, 404),
    );
  });

  await t.test('5b. missing costBearerCompanyId returns ActionError 404', async () => {
    const carrierCompanyId = await createTestCompany(prisma, 'missing-bearer');
    companyIds.push(carrierCompanyId);

    const formula = await createTestFormula(itemId, 1000);
    formulaIds.push(formula.id);

    const validated = validateCreateLogistics(
      buildValidCreateLogisticsPayload(formula.id, carrierCompanyId, {
        totalLogisticsCost: 1000,
        costBearerCompanyId: missingCompanyId,
      }),
    );

    await assert.rejects(
      () => createLogistics(formula.id, toCreateLogisticsRequest(validated)),
      (error: unknown) => assertActionError(error, 404),
    );
  });

  await t.test('6. closed formula rejects createLogistics and updateLogisticsStatus with ActionError 409', async () => {
    const carrierCompanyId = await createTestCompany(prisma, 'closed-formula');
    const costBearerCompanyId = await createTestCompany(prisma, 'closed-bearer');
    companyIds.push(carrierCompanyId, costBearerCompanyId);

    const formula = await createTestFormula(itemId, 1000);
    formulaIds.push(formula.id);

    await setFormulaStatusesForClose(prisma, formula.id);
    await closeFormula(formula.id, { closed_by: 'logistics.integration.test' });

    const createValidated = validateCreateLogistics(
      buildValidCreateLogisticsPayload(formula.id, carrierCompanyId, {
        costBearerCompanyId,
        totalLogisticsCost: 0,
      }),
    );

    await assert.rejects(
      () => createLogistics(formula.id, toCreateLogisticsRequest(createValidated)),
      (error: unknown) => assertActionError(error, 409),
    );

    await assert.rejects(
      () =>
        updateLogisticsStatus(formula.id, {
          status: TradeStatus.IN_PROGRESS,
          changed_by: 'logistics.integration.test',
          change_reason: 'closed formula status update',
        }),
      (error: unknown) => assertActionError(error, 409),
    );
  });

  await t.test('7. updateLogisticsStatus updates formula status and creates status_log only', async () => {
    const carrierCompanyId = await createTestCompany(prisma, 'status-update');
    const costBearerCompanyId = await createTestCompany(prisma, 'status-bearer');
    companyIds.push(carrierCompanyId, costBearerCompanyId);

    const formula = await createTestFormula(itemId, 1000);
    formulaIds.push(formula.id);

    const createValidated = validateCreateLogistics(
      buildValidCreateLogisticsPayload(formula.id, carrierCompanyId, {
        costBearerCompanyId,
        totalLogisticsCost: 0,
      }),
    );
    const createResult = await createLogistics(formula.id, toCreateLogisticsRequest(createValidated));
    trackCreateLogisticsArtifacts(
      createResult,
      auditLogIds,
      snapshotIds,
      versionIds,
      logisticsIds,
    );

    const versionCountBefore = await prisma.formulaVersion.count({
      where: { formulaId: formula.id },
    });
    const snapshotCountBefore = await prisma.calculationSnapshot.count({
      where: { formulaId: formula.id },
    });

    const formulaBefore = await prisma.formula.findUniqueOrThrow({
      where: { id: formula.id },
    });
    assert.equal(formulaBefore.logisticsStatus, TradeStatus.DRAFT);

    const statusResult = await updateLogisticsStatus(formula.id, {
      status: TradeStatus.IN_PROGRESS,
      changed_by: 'logistics.integration.test',
      change_reason: 'status update integration test',
    });

    statusLogIds.push(statusResult.status_log.id);

    assert.equal(statusResult.formula.logistics_status, TradeStatus.IN_PROGRESS);
    assert.equal(statusResult.status_log.status, TradeStatus.IN_PROGRESS);
    assert.equal(statusResult.status_log.formula_id, formula.id);

    const formulaAfter = await prisma.formula.findUniqueOrThrow({
      where: { id: formula.id },
    });
    assert.equal(formulaAfter.logisticsStatus, TradeStatus.IN_PROGRESS);

    const statusLogRow = await prisma.statusLog.findUnique({
      where: { id: statusResult.status_log.id },
    });
    assert.ok(statusLogRow);
    assert.equal(statusLogRow.statusTarget, 'LOGISTICS_STATUS');
    assert.equal(statusLogRow.prevStatus, TradeStatus.DRAFT);
    assert.equal(statusLogRow.newStatus, TradeStatus.IN_PROGRESS);

    const versionCountAfter = await prisma.formulaVersion.count({
      where: { formulaId: formula.id },
    });
    const snapshotCountAfter = await prisma.calculationSnapshot.count({
      where: { formulaId: formula.id },
    });

    assert.equal(versionCountAfter, versionCountBefore);
    assert.equal(snapshotCountAfter, snapshotCountBefore);
  });

  const app = await createTestApp();
  t.after(async () => {
    await app.close();
  });

  let httpFormulaId: string | undefined;
  let httpLogisticsId: string | undefined;

  await t.test('8a. HTTP POST /api/v1/formulas/:formulaId/logistics returns 201', async () => {
    const carrierCompanyId = await createTestCompany(prisma, 'http');
    const costBearerCompanyId = await createTestCompany(prisma, 'http-bearer');
    companyIds.push(carrierCompanyId, costBearerCompanyId);

    const formula = await createTestFormula(itemId, 1000);
    httpFormulaId = formula.id;
    formulaIds.push(formula.id);

    const validated = validateCreateLogistics(
      buildValidCreateLogisticsPayload(formula.id, carrierCompanyId, {
        costBearerCompanyId,
        totalLogisticsCost: 0,
      }),
    );

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/formulas/${formula.id}/logistics`,
      headers: { 'content-type': 'application/json' },
      payload: toCreateLogisticsRequest(validated),
    });

    assert.equal(response.statusCode, 201);

    const body = readJsonBody(response.payload) as {
      logistics: { id: string; formula_id: string };
      version: {
        version: { id: string };
        snapshot: { id: string };
        audit_log: { id: string; action: string };
      };
    };

    assert.equal(typeof body.logistics.id, 'string');
    assert.equal(body.logistics.formula_id, formula.id);
    assert.equal(body.version.audit_log.action, 'VERSION_CREATE');

    httpLogisticsId = body.logistics.id;
    logisticsIds.push(body.logistics.id);
    versionIds.push(body.version.version.id);
    snapshotIds.push(body.version.snapshot.id);
    auditLogIds.push(body.version.audit_log.id);
  });

  await t.test('8b. HTTP GET /api/v1/formulas/:formulaId/logistics returns 200', async () => {
    assert.ok(httpFormulaId);
    assert.ok(httpLogisticsId);

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/formulas/${httpFormulaId}/logistics`,
    });

    assert.equal(response.statusCode, 200);

    const body = readJsonBody(response.payload) as { items: Array<{ id: string }> };
    assert.ok(Array.isArray(body.items));
    assert.ok(body.items.some((item) => item.id === httpLogisticsId));
  });

  await t.test('8c. HTTP GET /api/v1/logistics/:logisticsId returns 200', async () => {
    assert.ok(httpLogisticsId);

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/logistics/${httpLogisticsId}`,
    });

    assert.equal(response.statusCode, 200);

    const body = readJsonBody(response.payload) as { id: string };
    assert.equal(body.id, httpLogisticsId);

    const actionLogistics = await getLogisticsById(httpLogisticsId);
    assert.equal(actionLogistics.id, httpLogisticsId);
  });

  await t.test('8d. HTTP PATCH /api/v1/formulas/:formulaId/logistics-status returns 200', async () => {
    assert.ok(httpFormulaId);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/formulas/${httpFormulaId}/logistics-status`,
      headers: { 'content-type': 'application/json' },
      payload: {
        status: TradeStatus.IN_PROGRESS,
        changed_by: 'logistics.integration.test',
        change_reason: 'http smoke status update',
      },
    });

    assert.equal(response.statusCode, 200);

    const body = readJsonBody(response.payload) as {
      formula: { logistics_status: string };
      status_log: { id: string; status: string; formula_id: string };
    };

    assert.equal(body.formula.logistics_status, TradeStatus.IN_PROGRESS);
    assert.equal(body.status_log.status, TradeStatus.IN_PROGRESS);
    assert.equal(body.status_log.formula_id, httpFormulaId);

    statusLogIds.push(body.status_log.id);
  });

  await t.test('8e. HTTP POST with invalid body returns 400', async () => {
    assert.ok(httpFormulaId);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/formulas/${httpFormulaId}/logistics`,
      headers: { 'content-type': 'application/json' },
      payload: {},
    });

    assert.equal(response.statusCode, 400);

    const body = readJsonBody(response.payload);
    assert.equal(typeof body.message, 'string');
  });

  await t.test('Action listLogisticsByFormulaId returns created logistics', async () => {
    assert.ok(httpFormulaId);
    assert.ok(httpLogisticsId);

    const list = await listLogisticsByFormulaId(httpFormulaId);
    assert.ok(list.items.some((item) => item.id === httpLogisticsId));
  });
});
