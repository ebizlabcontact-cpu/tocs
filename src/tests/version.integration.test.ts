/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import 'dotenv/config';
import { TradeType } from '@prisma/client';

import { ActionError } from '../actions/formula.actions.js';
import { createFormula } from '../actions/formula.actions.js';
import type { CreateFormulaRequest } from '../actions/formula.actions.js';
import {
  createVersion,
  getLatestVersionByFormulaId,
  getVersionById,
  listVersionsByFormulaId,
} from '../actions/version.actions.js';
import type { CreateVersionRequest } from '../actions/version.actions.js';
import { VersionActions } from '../actions/version.actions.js';
import { FormulaVersionRepository } from '../repositories/version.repository.js';
import {
  VersionConflictError,
  VersionService,
} from '../services/version.service.js';
import type { CreateVersionInput } from '../services/version.service.js';
import type { CreateFormulaInput } from '../types/formula.types.js';
import type { ValidatedCreateVersionInput } from '../types/version.types.js';
import { validateCreateFormula } from '../utils/formula.validation.js';
import { prisma } from '../lib/prisma.js';
import { validateCreateVersion, ValidationError } from '../utils/version.validation.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const sampleFormulaId = '55555555-5555-5555-5555-555555555501';

class StaleMaxVersionRepository extends FormulaVersionRepository {
  private callCount = 0;

  constructor(private readonly scheduledMaxValues: Array<number | null | undefined>) {
    super();
  }

  override async findMaxVersionNoByFormulaId(formulaId: string): Promise<number | null> {
    const scheduled = this.scheduledMaxValues[this.callCount];
    this.callCount++;

    if (scheduled !== undefined) {
      return scheduled;
    }

    return super.findMaxVersionNoByFormulaId(formulaId);
  }
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

function buildValidVersionPayload(formulaId: string) {
  return {
    formulaId,
    changedBy: 'version.integration.test',
    changeReason: 'integration test',
    snapshot: { label: 'version-snapshot' },
    calculation: {
      quantity: 1000,
      totalBuyAmount: 100_000,
      totalSellAmount: 120_000,
      totalCost: 5000,
      totalShare: 1000,
      netProfit: 14_000,
      snapshotData: { source: 'version.integration.test' },
    },
  };
}

function toCreateVersionRequest(
  validated: ValidatedCreateVersionInput,
  label: string,
  netProfit: number | string,
): CreateVersionRequest {
  return {
    formula_id: validated.formulaId,
    changed_by: validated.changedBy,
    change_reason: validated.changeReason,
    snapshot: { label },
    calculation: {
      quantity: toAmount(validated.calculation.quantity),
      total_buy_amount: toAmount(validated.calculation.totalBuyAmount),
      total_sell_amount: toAmount(validated.calculation.totalSellAmount),
      total_cost: toAmount(validated.calculation.totalCost),
      total_share: toAmount(validated.calculation.totalShare),
      net_profit: toAmount(netProfit),
      snapshot_data: validated.calculation.snapshotData,
    },
  };
}

function toServiceCreateVersionInput(
  validated: ValidatedCreateVersionInput,
  label: string,
  netProfit: number | string,
): CreateVersionInput {
  return {
    formulaId: validated.formulaId,
    changedBy: validated.changedBy,
    changeReason: validated.changeReason,
    snapshot: { label },
    calculation: {
      quantity: validated.calculation.quantity,
      totalBuyAmount: validated.calculation.totalBuyAmount,
      totalSellAmount: validated.calculation.totalSellAmount,
      totalCost: validated.calculation.totalCost,
      totalShare: validated.calculation.totalShare,
      netProfit,
      snapshotData: validated.calculation.snapshotData,
    },
  };
}

async function resolveTestItemId(): Promise<{ itemId: string; created: boolean }> {
  const existing = await prisma.item.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) {
    return { itemId: existing.id, created: false };
  }

  const created = await prisma.item.create({
    data: {
      itemCode: `TEST-VER-INT-${Date.now()}`,
      itemName: 'Version Integration Test Item',
      defaultUnit: 'kg',
      isActive: true,
    },
  });

  return { itemId: created.id, created: true };
}

async function cleanupVersionTestArtifacts(params: {
  formulaId?: string;
  versionIds: string[];
  snapshotIds: string[];
  auditLogIds: string[];
  itemId?: string;
  itemWasNew?: boolean;
}): Promise<void> {
  for (const id of params.auditLogIds) {
    await prisma.auditLog.delete({ where: { id } });
  }

  for (const id of params.snapshotIds) {
    await prisma.calculationSnapshot.delete({ where: { id } });
  }

  for (const id of params.versionIds) {
    await prisma.formulaVersion.delete({ where: { id } });
  }

  if (params.formulaId) {
    await prisma.formula.delete({ where: { id: params.formulaId } });
  }

  if (params.itemWasNew && params.itemId) {
    await prisma.item.delete({ where: { id: params.itemId } });
  }
}

test('1. validateCreateVersion accepts valid payload', () => {
  const validated = validateCreateVersion(buildValidVersionPayload(sampleFormulaId));

  assert.equal(validated.formulaId, sampleFormulaId);
  assert.equal(validated.changedBy, 'version.integration.test');
  assert.equal(validated.changeReason, 'integration test');
  assert.equal(validated.calculation.quantity, 1000);
  assert.equal(validated.calculation.netProfit, 14_000);
});

test('1b. validateCreateVersion accepts negative netProfit', () => {
  const validated = validateCreateVersion({
    ...buildValidVersionPayload(sampleFormulaId),
    calculation: {
      ...buildValidVersionPayload(sampleFormulaId).calculation,
      netProfit: -500,
    },
  });

  assert.equal(validated.calculation.netProfit, -500);
});

test('2. validateCreateVersion rejects missing formulaId', () => {
  const payload = buildValidVersionPayload(sampleFormulaId);
  const { formulaId: _formulaId, ...withoutFormulaId } = payload;

  assert.throws(
    () => validateCreateVersion(withoutFormulaId),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'formulaId');
      return true;
    },
  );
});

test('2b. validateCreateVersion rejects missing changedBy', () => {
  const payload = buildValidVersionPayload(sampleFormulaId);
  const { changedBy: _changedBy, ...withoutChangedBy } = payload;

  assert.throws(
    () => validateCreateVersion(withoutChangedBy),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'changedBy');
      return true;
    },
  );
});

test('2c. validateCreateVersion rejects missing changeReason', () => {
  const payload = buildValidVersionPayload(sampleFormulaId);
  const { changeReason: _changeReason, ...withoutChangeReason } = payload;

  assert.throws(
    () => validateCreateVersion(withoutChangeReason),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'changeReason');
      return true;
    },
  );
});

test('2d. validateCreateVersion rejects missing calculation', () => {
  const payload = buildValidVersionPayload(sampleFormulaId);
  const { calculation: _calculation, ...withoutCalculation } = payload;

  assert.throws(
    () => validateCreateVersion(withoutCalculation),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'calculation');
      return true;
    },
  );
});

test('2e. validateCreateVersion rejects missing netProfit', () => {
  const payload = buildValidVersionPayload(sampleFormulaId);
  const { netProfit: _netProfit, ...calculationWithoutNetProfit } = payload.calculation;

  assert.throws(
    () =>
      validateCreateVersion({
        ...payload,
        calculation: calculationWithoutNetProfit,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'calculation.netProfit');
      return true;
    },
  );
});

test('Version create and read integration flow', { skip: !hasDatabase }, async (t) => {
  let createdFormulaId: string | undefined;
  let createdItemId: string | undefined;
  let createdItemWasNew = false;
  const versionIds: string[] = [];
  const snapshotIds: string[] = [];
  const auditLogIds: string[] = [];

  t.after(async () => {
    await cleanupVersionTestArtifacts({
      ...(createdFormulaId ? { formulaId: createdFormulaId } : {}),
      versionIds,
      snapshotIds,
      auditLogIds,
      ...(createdItemId ? { itemId: createdItemId } : {}),
      ...(createdItemWasNew ? { itemWasNew: createdItemWasNew } : {}),
    });
    await prisma.$disconnect();
  });

  const { itemId, created: itemCreated } = await resolveTestItemId();
  createdItemId = itemId;
  createdItemWasNew = itemCreated;

  const validatedFormula = validateCreateFormula({
    tradeType: TradeType.DOMESTIC,
    itemId,
    quantity: 1000,
    unit: 'kg',
    content: 'version integration test',
    createdBy: 'version.integration.test',
  });

  const formula = await createFormula(toCreateFormulaRequest(validatedFormula));
  createdFormulaId = formula.id;

  const versionPayload = buildValidVersionPayload(formula.id);
  const validatedVersion = validateCreateVersion(versionPayload);

  const version1Result = await createVersion(
    toCreateVersionRequest(validatedVersion, 'version-1', 14_000),
  );
  versionIds.push(version1Result.version.id);
  snapshotIds.push(version1Result.snapshot.id);
  auditLogIds.push(version1Result.audit_log.id);

  assert.equal(version1Result.version.formula_id, formula.id);
  assert.equal(version1Result.version.version_no, 1);
  assert.equal(version1Result.audit_log.action, 'VERSION_CREATE');

  const version1Row = await prisma.formulaVersion.findUnique({
    where: { id: version1Result.version.id },
  });
  const snapshot1Row = await prisma.calculationSnapshot.findUnique({
    where: { id: version1Result.snapshot.id },
  });
  const audit1Row = await prisma.auditLog.findUnique({
    where: { id: version1Result.audit_log.id },
  });

  assert.ok(version1Row);
  assert.ok(snapshot1Row);
  assert.ok(audit1Row);
  assert.equal(snapshot1Row.formulaVersionId, version1Result.version.id);
  assert.equal(audit1Row.tableName, 'formula_versions');
  assert.equal(audit1Row.recordId, version1Result.version.id);

  const version2Result = await createVersion(
    toCreateVersionRequest(validatedVersion, 'version-2', 15_000),
  );
  versionIds.push(version2Result.version.id);
  snapshotIds.push(version2Result.snapshot.id);
  auditLogIds.push(version2Result.audit_log.id);

  assert.equal(version2Result.version.version_no, 2);
  assert.equal(version2Result.audit_log.action, 'VERSION_CREATE');

  const version3Result = await createVersion(
    toCreateVersionRequest(validatedVersion, 'version-3', 16_000),
  );
  versionIds.push(version3Result.version.id);
  snapshotIds.push(version3Result.snapshot.id);
  auditLogIds.push(version3Result.audit_log.id);

  assert.equal(version3Result.version.version_no, 3);

  const versionById = await getVersionById(version2Result.version.id);
  assert.equal(versionById.id, version2Result.version.id);
  assert.equal(versionById.version_no, 2);
  assert.equal(versionById.formula_id, formula.id);

  const versionList = await listVersionsByFormulaId(formula.id);
  assert.equal(versionList.items.length, 3);
  assert.deepEqual(
    versionList.items.map((item) => item.version_no).sort((a, b) => a - b),
    [1, 2, 3],
  );

  const latestVersion = await getLatestVersionByFormulaId(formula.id);
  assert.equal(latestVersion.id, version3Result.version.id);
  assert.equal(latestVersion.version_no, 3);

  const snapshot1AfterVersion2 = await prisma.calculationSnapshot.findUnique({
    where: { id: version1Result.snapshot.id },
  });

  assert.ok(snapshot1AfterVersion2);
  assert.notEqual(version1Result.snapshot.id, version2Result.snapshot.id);
  assert.equal(snapshot1AfterVersion2.id, version1Result.snapshot.id);
  assert.equal(snapshot1AfterVersion2.netProfit.toString(), '14000');
  assert.equal(version2Result.snapshot.net_profit, '15000');
});

test('9. createVersion retries once after P2002 and writes VERSION_RETRY audit log', {
  skip: !hasDatabase,
}, async (t) => {
  let createdFormulaId: string | undefined;
  let createdItemId: string | undefined;
  let createdItemWasNew = false;
  const versionIds: string[] = [];
  const snapshotIds: string[] = [];
  const auditLogIds: string[] = [];

  t.after(async () => {
    await cleanupVersionTestArtifacts({
      ...(createdFormulaId ? { formulaId: createdFormulaId } : {}),
      versionIds,
      snapshotIds,
      auditLogIds,
      ...(createdItemId ? { itemId: createdItemId } : {}),
      ...(createdItemWasNew ? { itemWasNew: createdItemWasNew } : {}),
    });
    await prisma.$disconnect();
  });

  const { itemId, created: itemCreated } = await resolveTestItemId();
  createdItemId = itemId;
  createdItemWasNew = itemCreated;

  const validatedFormula = validateCreateFormula({
    tradeType: TradeType.DOMESTIC,
    itemId,
    quantity: 1000,
    unit: 'kg',
    content: 'version retry integration test',
    createdBy: 'version.integration.test',
  });

  const formula = await createFormula(toCreateFormulaRequest(validatedFormula));
  createdFormulaId = formula.id;

  const validatedVersion = validateCreateVersion(buildValidVersionPayload(formula.id));
  const initialResult = await createVersion(
    toCreateVersionRequest(validatedVersion, 'retry-seed', 10_000),
  );

  versionIds.push(initialResult.version.id);
  snapshotIds.push(initialResult.snapshot.id);
  auditLogIds.push(initialResult.audit_log.id);
  assert.equal(initialResult.version.version_no, 1);

  const retryService = new VersionService(new StaleMaxVersionRepository([0, undefined]));
  const retryResult = await retryService.createVersion(
    toServiceCreateVersionInput(validatedVersion, 'retry-success', 11_000),
  );

  versionIds.push(retryResult.version.id);
  snapshotIds.push(retryResult.snapshot.id);
  auditLogIds.push(retryResult.auditLog.id);

  assert.equal(retryResult.version.versionNo, 2);

  const retryAuditRow = await prisma.auditLog.findUnique({
    where: { id: retryResult.auditLog.id },
  });

  assert.ok(retryAuditRow);
  assert.equal(retryAuditRow.action, 'VERSION_RETRY');
});

test('10. createVersion throws VersionConflictError after retry exhaustion', {
  skip: !hasDatabase,
}, async (t) => {
  let createdFormulaId: string | undefined;
  let createdItemId: string | undefined;
  let createdItemWasNew = false;
  const versionIds: string[] = [];
  const snapshotIds: string[] = [];
  const auditLogIds: string[] = [];

  t.after(async () => {
    await cleanupVersionTestArtifacts({
      ...(createdFormulaId ? { formulaId: createdFormulaId } : {}),
      versionIds,
      snapshotIds,
      auditLogIds,
      ...(createdItemId ? { itemId: createdItemId } : {}),
      ...(createdItemWasNew ? { itemWasNew: createdItemWasNew } : {}),
    });
    await prisma.$disconnect();
  });

  const { itemId, created: itemCreated } = await resolveTestItemId();
  createdItemId = itemId;
  createdItemWasNew = itemCreated;

  const validatedFormula = validateCreateFormula({
    tradeType: TradeType.DOMESTIC,
    itemId,
    quantity: 1000,
    unit: 'kg',
    content: 'version conflict integration test',
    createdBy: 'version.integration.test',
  });

  const formula = await createFormula(toCreateFormulaRequest(validatedFormula));
  createdFormulaId = formula.id;

  const validatedVersion = validateCreateVersion(buildValidVersionPayload(formula.id));
  const initialResult = await createVersion(
    toCreateVersionRequest(validatedVersion, 'conflict-seed', 10_000),
  );

  versionIds.push(initialResult.version.id);
  snapshotIds.push(initialResult.snapshot.id);
  auditLogIds.push(initialResult.audit_log.id);

  const conflictService = new VersionService(new StaleMaxVersionRepository([0, 0]));

  await assert.rejects(
    () =>
      conflictService.createVersion(
        toServiceCreateVersionInput(validatedVersion, 'conflict-attempt', 11_000),
      ),
    (error: unknown) => {
      assert.ok(error instanceof VersionConflictError);
      assert.equal(error.status, 409);
      return true;
    },
  );

  const conflictActions = new VersionActions(conflictService);

  await assert.rejects(
    () =>
      conflictActions.createVersion(
        toCreateVersionRequest(validatedVersion, 'conflict-action', 12_000),
      ),
    (error: unknown) => {
      assert.ok(error instanceof ActionError);
      assert.equal(error.status, 409);
      return true;
    },
  );
});
