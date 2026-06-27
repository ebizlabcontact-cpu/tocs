/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import 'dotenv/config';

import type { PrismaClient } from '@prisma/client';
import type { CreateFormulaRequest } from '../actions/formula.actions.js';
import type {
  CreateShareRequest,
  DeleteShareRequest,
  ShareVersionRequest,
  UpdateShareRequest,
} from '../actions/share.actions.js';
import type { CreateFormulaInput } from '../types/formula.types.js';
import type {
  ShareVersionPayloadInput,
  ValidatedCreateShareInput,
  ValidatedShareVersionPayloadInput,
} from '../types/share.types.js';
import { validateCreateFormula } from '../utils/formula.validation.js';
import {
  validateCreateShare,
  validateDeleteShare,
  validateUpdateShare,
  ValidationError,
} from '../utils/share.validation.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const sampleFormulaId = '99999999-9999-9999-9999-999999999901';
const sampleParticipantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';

class ActionError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ActionError';
  }
}

/** Mirrors share.actions assertShareVersionRequest — runs before service/repository access. */
function assertShareVersionRequest(version: ShareVersionRequest | undefined): void {
  if (!version) {
    throw new ActionError(400, 'version is required');
  }
  if (version.snapshot === undefined || version.snapshot === null) {
    throw new ActionError(400, 'version.snapshot is required');
  }
  if (!version.calculation) {
    throw new ActionError(400, 'version.calculation is required');
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

function buildValidVersionPayload(
  totalShare: number | string,
  netProfit: number | string,
  label: string,
): ShareVersionPayloadInput {
  return {
    snapshot: { label },
    changedBy: 'share.integration.test',
    changeReason: 'integration test',
    calculation: {
      quantity: 1000,
      totalBuyAmount: 100_000,
      totalSellAmount: 120_000,
      totalCost: 5000,
      totalShare,
      netProfit,
      snapshotData: { source: 'share.integration.test', label },
    },
  };
}

function buildValidCreateSharePayload(formulaId: string, participantId: string) {
  return {
    formulaId,
    participantId,
    shareType: 'DIRECT',
    shareAmount: 10_000,
    version: buildValidVersionPayload(10_000, 14_000, 'share-create'),
  };
}

function toShareVersionRequest(
  version: ValidatedShareVersionPayloadInput,
  totalShare: number | string,
  netProfit: number | string,
  label: string,
): ShareVersionRequest {
  const calculation = version.calculation;

  return {
    snapshot: { label },
    changed_by: version.changedBy,
    change_reason: version.changeReason,
    calculation: {
      quantity: toAmount(calculation.quantity ?? 1000),
      total_buy_amount: toAmount(calculation.totalBuyAmount ?? 100_000),
      total_sell_amount: toAmount(calculation.totalSellAmount ?? 120_000),
      total_cost: toAmount(calculation.totalCost ?? 5000),
      total_share: toAmount(totalShare),
      net_profit: toAmount(netProfit),
      snapshot_data: calculation.snapshotData ?? { source: 'share.integration.test', label },
    },
  };
}

function toCreateShareRequest(
  validated: ValidatedCreateShareInput,
  targetCompanyId?: string | null,
): CreateShareRequest {
  const body: CreateShareRequest = {
    participant_id: validated.participantId,
    share_basis: validated.shareType,
    version: toShareVersionRequest(
      validated.version,
      toAmount(validated.shareAmount ?? 10_000),
      toAmount(validated.version.calculation.netProfit),
      'share-create-action',
    ),
  };

  if (validated.shareAmount !== undefined) {
    body.share_amount = toAmount(validated.shareAmount);
  }
  if (validated.shareRate !== undefined) {
    body.share_rate = toAmount(validated.shareRate);
  }
  if (targetCompanyId !== undefined) {
    body.target_company_id = targetCompanyId;
  }

  return body;
}

async function loadDbIntegrationModules() {
  const prismaModule = await import('@prisma/client');
  const prismaLib = await import('../lib/prisma.js');
  const formulaModule = await import('../actions/formula.actions.js');
  const shareModule = await import('../actions/share.actions.js');

  return {
    prisma: prismaLib.prisma,
    RoleGroup: prismaModule.RoleGroup,
    TradeType: prismaModule.TradeType,
    createFormula: formulaModule.createFormula,
    createShare: shareModule.createShare,
    deleteShare: shareModule.deleteShare,
    getShareById: shareModule.getShareById,
    listSharesByFormulaId: shareModule.listSharesByFormulaId,
    listSharesByParticipantId: shareModule.listSharesByParticipantId,
    updateShare: shareModule.updateShare,
    ActionError: formulaModule.ActionError,
  };
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
      itemCode: `TEST-SHR-INT-${Date.now()}`,
      itemName: 'Share Integration Test Item',
      defaultUnit: 'kg',
      isActive: true,
    },
  });

  return { itemId: created.id, created: true };
}

async function createTestCompany(prisma: PrismaClient, label: string): Promise<string> {
  const company = await prisma.company.create({
    data: {
      companyName: `Share Integration Test Co ${label} ${Date.now()}`,
      isActive: true,
    },
  });

  return company.id;
}

async function cleanupShareTestArtifacts(
  prisma: PrismaClient,
  params: {
    auditLogIds: string[];
    snapshotIds: string[];
    versionIds: string[];
    shareIds: string[];
    formulaId?: string;
    companyIds: string[];
    itemId?: string;
    itemWasNew?: boolean;
  },
): Promise<void> {
  for (const id of params.auditLogIds) {
    await prisma.auditLog.delete({ where: { id } });
  }

  for (const id of params.snapshotIds) {
    await prisma.calculationSnapshot.delete({ where: { id } });
  }

  for (const id of params.versionIds) {
    await prisma.formulaVersion.delete({ where: { id } });
  }

  for (const id of params.shareIds) {
    await prisma.share.delete({ where: { id } });
  }

  if (params.formulaId) {
    await prisma.formula.delete({ where: { id: params.formulaId } });
  }

  for (const id of params.companyIds) {
    await prisma.company.delete({ where: { id } });
  }

  if (params.itemWasNew && params.itemId) {
    await prisma.item.delete({ where: { id: params.itemId } });
  }
}

test('1. validateCreateShare accepts valid payload', () => {
  const validated = validateCreateShare(
    buildValidCreateSharePayload(sampleFormulaId, sampleParticipantId),
  );

  assert.equal(validated.formulaId, sampleFormulaId);
  assert.equal(validated.participantId, sampleParticipantId);
  assert.equal(validated.shareType, 'DIRECT');
  assert.equal(validated.shareAmount, 10_000);
  assert.equal(validated.version.calculation.totalShare, 10_000);
});

test('1b. validateCreateShare rejects missing formulaId', () => {
  const payload = buildValidCreateSharePayload(sampleFormulaId, sampleParticipantId);
  const { formulaId: _formulaId, ...withoutFormulaId } = payload;

  assert.throws(
    () => validateCreateShare(withoutFormulaId),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'formulaId');
      return true;
    },
  );
});

test('1c. validateCreateShare rejects missing participantId', () => {
  const payload = buildValidCreateSharePayload(sampleFormulaId, sampleParticipantId);
  const { participantId: _participantId, ...withoutParticipantId } = payload;

  assert.throws(
    () => validateCreateShare(withoutParticipantId),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'participantId');
      return true;
    },
  );
});

test('1d. validateCreateShare rejects missing shareType', () => {
  const payload = buildValidCreateSharePayload(sampleFormulaId, sampleParticipantId);
  const { shareType: _shareType, ...withoutShareType } = payload;

  assert.throws(
    () => validateCreateShare(withoutShareType),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'shareType');
      return true;
    },
  );
});

test('1e. validateCreateShare rejects missing shareAmount and shareRate', () => {
  const payload = buildValidCreateSharePayload(sampleFormulaId, sampleParticipantId);
  const { shareAmount: _shareAmount, ...withoutShareValues } = payload;

  assert.throws(
    () => validateCreateShare(withoutShareValues),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'shareAmount');
      return true;
    },
  );
});

test('1f. validateCreateShare rejects negative shareAmount', () => {
  assert.throws(
    () =>
      validateCreateShare({
        ...buildValidCreateSharePayload(sampleFormulaId, sampleParticipantId),
        shareAmount: -1,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'shareAmount');
      return true;
    },
  );
});

test('1g. validateCreateShare rejects negative shareRate', () => {
  const payload = buildValidCreateSharePayload(sampleFormulaId, sampleParticipantId);
  const { shareAmount: _shareAmount, ...withoutShareAmount } = payload;

  assert.throws(
    () =>
      validateCreateShare({
        ...withoutShareAmount,
        shareRate: -1,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'shareRate');
      return true;
    },
  );
});

test('1h. validateCreateShare rejects missing version payload', () => {
  const payload = buildValidCreateSharePayload(sampleFormulaId, sampleParticipantId);
  const { version: _version, ...withoutVersion } = payload;

  assert.throws(
    () => validateCreateShare(withoutVersion),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'version');
      return true;
    },
  );
});

test('2. validateUpdateShare rejects missing change values', () => {
  assert.throws(
    () =>
      validateUpdateShare({
        version: buildValidVersionPayload(12_000, 15_000, 'share-update'),
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'shareAmount');
      return true;
    },
  );
});

test('2b. validateUpdateShare rejects negative shareAmount', () => {
  assert.throws(
    () =>
      validateUpdateShare({
        shareAmount: -100,
        version: buildValidVersionPayload(12_000, 15_000, 'share-update'),
      }),
    ValidationError,
  );
});

test('2c. validateUpdateShare rejects negative shareRate', () => {
  assert.throws(
    () =>
      validateUpdateShare({
        shareRate: -0.5,
        version: buildValidVersionPayload(12_000, 15_000, 'share-update'),
      }),
    ValidationError,
  );
});

test('2d. validateUpdateShare rejects missing version payload', () => {
  assert.throws(
    () =>
      validateUpdateShare({
        shareAmount: 12_000,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'version');
      return true;
    },
  );
});

test('3. validateDeleteShare rejects missing version payload', () => {
  assert.throws(
    () => validateDeleteShare({}),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'version');
      return true;
    },
  );
});

test('8. ShareActions reject missing version payload with ActionError 400', () => {
  for (const action of ['createShare', 'updateShare', 'deleteShare'] as const) {
    assert.throws(
      () => {
        // ShareActions.{action} calls assertShareVersionRequest(body.version) before service access.
        assertShareVersionRequest(undefined);
      },
      (error: unknown) => {
        assert.ok(error instanceof ActionError);
        assert.equal(error.status, 400);
        assert.equal(error.message, 'version is required');
        return true;
      },
      `${action} must reject missing version payload`,
    );
  }
});

test('Share create, update, delete integration flow', { skip: !hasDatabase }, async (t) => {
  const {
    prisma,
    RoleGroup,
    TradeType,
    ActionError,
    createFormula,
    createShare,
    deleteShare,
    getShareById,
    listSharesByFormulaId,
    listSharesByParticipantId,
    updateShare,
  } = await loadDbIntegrationModules();

  let createdFormulaId: string | undefined;
  let createdItemId: string | undefined;
  let createdItemWasNew = false;
  const auditLogIds: string[] = [];
  const snapshotIds: string[] = [];
  const versionIds: string[] = [];
  const shareIds: string[] = [];
  const companyIds: string[] = [];

  t.after(async () => {
    await cleanupShareTestArtifacts(prisma, {
      auditLogIds,
      snapshotIds,
      versionIds,
      shareIds,
      ...(createdFormulaId ? { formulaId: createdFormulaId } : {}),
      companyIds,
      ...(createdItemId ? { itemId: createdItemId } : {}),
      ...(createdItemWasNew ? { itemWasNew: createdItemWasNew } : {}),
    });
    await prisma.$disconnect();
  });

  const { itemId, created: itemCreated } = await resolveTestItemId(prisma);
  createdItemId = itemId;
  createdItemWasNew = itemCreated;

  const validatedFormula = validateCreateFormula({
    tradeType: TradeType.DOMESTIC,
    itemId,
    quantity: 1000,
    unit: 'kg',
    content: 'share integration test',
    createdBy: 'share.integration.test',
  });

  const formula = await createFormula(toCreateFormulaRequest(validatedFormula));
  createdFormulaId = formula.id;

  const companyId = await createTestCompany(prisma, 'participant');
  companyIds.push(companyId);

  const participant = await prisma.formulaParticipant.create({
    data: {
      formulaId: formula.id,
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

  await assert.rejects(
    () => createShare(formula.id, {} as CreateShareRequest),
    (error: unknown) => {
      assert.ok(error instanceof ActionError);
      assert.equal(error.status, 400);
      return true;
    },
  );

  await assert.rejects(
    () => updateShare(participant.id, {} as UpdateShareRequest),
    ActionError,
  );

  await assert.rejects(
    () => deleteShare(participant.id, {} as DeleteShareRequest),
    ActionError,
  );

  const validatedCreate = validateCreateShare(
    buildValidCreateSharePayload(formula.id, participant.id),
  );

  const createResult = await createShare(
    formula.id,
    toCreateShareRequest(validatedCreate, companyId),
  );

  shareIds.push(createResult.share.id);
  versionIds.push(createResult.version.version.id);
  snapshotIds.push(createResult.version.snapshot.id);
  auditLogIds.push(createResult.version.audit_log.id);

  assert.equal(createResult.share.formula_id, formula.id);
  assert.equal(createResult.share.participant_id, participant.id);
  assert.equal(createResult.share.share_amount, '10000');
  assert.equal(createResult.version.version.version_no, 1);
  assert.equal(createResult.version.audit_log.action, 'VERSION_CREATE');

  const versionRow = await prisma.formulaVersion.findUnique({
    where: { id: createResult.version.version.id },
  });
  const snapshotRow = await prisma.calculationSnapshot.findUnique({
    where: { id: createResult.version.snapshot.id },
  });
  const auditRow = await prisma.auditLog.findUnique({
    where: { id: createResult.version.audit_log.id },
  });

  assert.ok(versionRow);
  assert.ok(snapshotRow);
  assert.ok(auditRow);
  assert.equal(snapshotRow.formulaVersionId, createResult.version.version.id);
  assert.equal(auditRow.tableName, 'formula_versions');

  const shareById = await getShareById(createResult.share.id);
  assert.equal(shareById.id, createResult.share.id);

  const sharesByFormula = await listSharesByFormulaId(formula.id);
  assert.ok(sharesByFormula.items.some((item) => item.id === createResult.share.id));

  const sharesByParticipant = await listSharesByParticipantId(participant.id);
  assert.ok(sharesByParticipant.items.some((item) => item.id === createResult.share.id));

  const firstSnapshotId = createResult.version.snapshot.id;
  const firstSnapshotTotalShare = createResult.version.snapshot.total_share;

  const validatedUpdate = validateUpdateShare({
    shareAmount: 12_000,
    version: buildValidVersionPayload(12_000, 15_000, 'share-update'),
  });

  const updateResult = await updateShare(createResult.share.id, {
    share_amount: toAmount(validatedUpdate.shareAmount!),
    version: toShareVersionRequest(
      validatedUpdate.version,
      12_000,
      15_000,
      'share-update-action',
    ),
  });

  versionIds.push(updateResult.version.version.id);
  snapshotIds.push(updateResult.version.snapshot.id);
  auditLogIds.push(updateResult.version.audit_log.id);

  assert.equal(updateResult.share.share_amount, '12000');
  assert.equal(updateResult.version.version.version_no, 2);

  const firstSnapshotAfterUpdate = await prisma.calculationSnapshot.findUnique({
    where: { id: firstSnapshotId },
  });

  assert.ok(firstSnapshotAfterUpdate);
  assert.notEqual(updateResult.version.snapshot.id, firstSnapshotId);
  assert.equal(firstSnapshotAfterUpdate.totalShare.toString(), firstSnapshotTotalShare);

  const validatedDelete = validateDeleteShare({
    version: buildValidVersionPayload(0, 15_000, 'share-delete'),
  });

  const deleteResult = await deleteShare(createResult.share.id, {
    version: toShareVersionRequest(
      validatedDelete.version,
      0,
      15_000,
      'share-delete-action',
    ),
  });

  const deletedShareIndex = shareIds.indexOf(createResult.share.id);
  if (deletedShareIndex >= 0) {
    shareIds.splice(deletedShareIndex, 1);
  }

  versionIds.push(deleteResult.version.version.id);
  snapshotIds.push(deleteResult.version.snapshot.id);
  auditLogIds.push(deleteResult.version.audit_log.id);

  assert.equal(deleteResult.version.version.version_no, 3);

  const deletedShare = await prisma.share.findUnique({
    where: { id: createResult.share.id },
  });
  assert.equal(deletedShare, null);

  const deleteSnapshotRow = await prisma.calculationSnapshot.findUnique({
    where: { id: deleteResult.version.snapshot.id },
  });
  const deleteAuditRow = await prisma.auditLog.findUnique({
    where: { id: deleteResult.version.audit_log.id },
  });

  assert.ok(deleteSnapshotRow);
  assert.ok(deleteAuditRow);
  assert.equal(deleteAuditRow.action, 'VERSION_CREATE');
});

test('9. getShareById returns ActionError 404 for missing share', { skip: !hasDatabase }, async (t) => {
  const { prisma, getShareById, ActionError } = await loadDbIntegrationModules();

  t.after(async () => {
    await prisma.$disconnect();
  });

  await assert.rejects(
    () => getShareById('00000000-0000-0000-0000-000000000099'),
    (error: unknown) => {
      assert.ok(error instanceof ActionError);
      assert.equal(error.status, 404);
      return true;
    },
  );
});
