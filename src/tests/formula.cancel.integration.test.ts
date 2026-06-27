/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import 'dotenv/config';

import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import {
  InvoiceStatus,
  PaymentDirection,
  PaymentStatus,
  RoleGroup,
  StatusTarget,
  TradeStatus,
  TradeType,
} from '@prisma/client';

import { closeFormula } from '../actions/close.actions.js';
import {
  ActionError,
  cancelFormula,
  createFormula,
  type CancelFormulaRequest,
  type CreateFormulaRequest,
} from '../actions/formula.actions.js';
import { prisma } from '../lib/prisma.js';
import type { CancelFormulaInputPayload, CreateFormulaInput } from '../types/formula.types.js';
import { validateCancelFormula, validateCreateFormula, ValidationError } from '../utils/formula.validation.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const sampleFormulaId = '22222222-2222-2222-2222-222222222201';
const missingFormulaId = '00000000-0000-0000-0000-000000000099';

const defaultCancelBody: CancelFormulaRequest = {
  cancel_reason: 'integration test cancel',
  changed_by: 'formula.cancel.integration.test',
};

const EXPECTED_STATUS_TARGETS = [
  StatusTarget.TRADE_STATUS,
  StatusTarget.DELIVERY_STATUS,
  StatusTarget.CASH_IN_STATUS,
  StatusTarget.CASH_OUT_STATUS,
  StatusTarget.INVOICE_STATUS,
  StatusTarget.LOGISTICS_STATUS,
] as const;

const EXPECTED_PREV_STATUSES: Record<StatusTarget, string> = {
  [StatusTarget.TRADE_STATUS]: TradeStatus.DRAFT,
  [StatusTarget.DELIVERY_STATUS]: TradeStatus.DRAFT,
  [StatusTarget.CASH_IN_STATUS]: PaymentStatus.PENDING,
  [StatusTarget.CASH_OUT_STATUS]: PaymentStatus.PENDING,
  [StatusTarget.INVOICE_STATUS]: InvoiceStatus.NOT_ISSUED,
  [StatusTarget.LOGISTICS_STATUS]: TradeStatus.DRAFT,
};

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

function cancelPayloadWithExtraKey(
  base: CancelFormulaInputPayload,
  extraKey: string,
  extraValue: unknown,
): CancelFormulaInputPayload {
  return {
    ...base,
    [extraKey]: extraValue,
  } as CancelFormulaInputPayload;
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
      itemCode: `TEST-FC-INT-${Date.now()}`,
      itemName: 'Formula Cancel Integration Test Item',
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
    content: 'cancel integration test',
    note: 'cancel integration note',
    createdBy: 'formula.cancel.integration.test',
  });

  const formula = await createFormula(toCreateFormulaRequest(validated));

  return { id: formula.id };
}

async function createTestCompany(prismaClient: PrismaClient): Promise<string> {
  const company = await prismaClient.company.create({
    data: {
      companyName: `Formula Cancel Integration Test Co ${Date.now()}`,
      isActive: true,
    },
  });

  return company.id;
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

async function cleanupFormulaCancelTestArtifacts(params: {
  prisma: PrismaClient;
  auditLogIds: string[];
  statusLogIds: string[];
  snapshotIds: string[];
  versionIds: string[];
  paymentRecordIds: string[];
  paymentScheduleIds: string[];
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

  for (const id of params.statusLogIds) {
    await params.prisma.statusLog.delete({ where: { id } });
  }

  for (const id of params.snapshotIds) {
    await params.prisma.calculationSnapshot.delete({ where: { id } });
  }

  for (const id of params.versionIds) {
    await params.prisma.formulaVersion.delete({ where: { id } });
  }

  for (const id of params.paymentRecordIds) {
    await params.prisma.paymentRecord.delete({ where: { id } });
  }

  for (const id of params.paymentScheduleIds) {
    await params.prisma.paymentSchedule.delete({ where: { id } });
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

async function countFormulaVersionArtifacts(prismaClient: PrismaClient, formulaId: string) {
  const versions = await prismaClient.formulaVersion.findMany({
    where: { formulaId },
    select: { id: true },
  });
  const versionIdList = versions.map((version) => version.id);

  const [versionCount, snapshotCount, versionAuditCount] = await Promise.all([
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

  return { versionCount, snapshotCount, versionAuditCount };
}

function assertAllStatusesCanceled(formula: {
  trade_status: string;
  delivery_status: string;
  cash_in_status: string;
  cash_out_status: string;
  invoice_status: string;
  logistics_status: string;
}): void {
  assert.equal(formula.trade_status, TradeStatus.CANCELED);
  assert.equal(formula.delivery_status, TradeStatus.CANCELED);
  assert.equal(formula.cash_in_status, PaymentStatus.CANCELED);
  assert.equal(formula.cash_out_status, PaymentStatus.CANCELED);
  assert.equal(formula.invoice_status, InvoiceStatus.CANCELED);
  assert.equal(formula.logistics_status, TradeStatus.CANCELED);
}

function assertStatusLogsForCancel(
  statusLogs: Array<{
    status_target: StatusTarget;
    prev_status: string | null;
    new_status: string;
    changed_by: string | null;
    change_reason: string | null;
  }>,
): void {
  assert.equal(statusLogs.length, 6);

  const targets = statusLogs.map((log) => log.status_target).sort();
  const expectedTargets = [...EXPECTED_STATUS_TARGETS].sort();
  assert.deepEqual(targets, expectedTargets);

  for (const log of statusLogs) {
    assert.equal(log.prev_status, EXPECTED_PREV_STATUSES[log.status_target]);
    assert.equal(log.new_status, 'CANCELED');
    assert.equal(log.changed_by, defaultCancelBody.changed_by);
    assert.equal(log.change_reason, defaultCancelBody.cancel_reason);
  }
}

// ---------------------------------------------------------------------------
// 1. validateCancelFormula
// ---------------------------------------------------------------------------

test('1a. validateCancelFormula passes with valid payload', () => {
  const validated = validateCancelFormula({
    formulaId: sampleFormulaId,
    cancelReason: 'valid cancel reason',
    changedBy: 'tester',
  });

  assert.equal(validated.formulaId, sampleFormulaId);
  assert.equal(validated.cancelReason, 'valid cancel reason');
  assert.equal(validated.changedBy, 'tester');
});

test('1b. validateCancelFormula rejects missing formulaId', () => {
  assert.throws(
    () =>
      validateCancelFormula({
        cancelReason: 'reason',
        changedBy: 'tester',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'formulaId');
      return true;
    },
  );
});

test('1c. validateCancelFormula rejects missing cancelReason', () => {
  assert.throws(
    () =>
      validateCancelFormula({
        formulaId: sampleFormulaId,
        changedBy: 'tester',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'cancelReason');
      return true;
    },
  );
});

test('1d. validateCancelFormula rejects empty cancelReason', () => {
  assert.throws(
    () =>
      validateCancelFormula({
        formulaId: sampleFormulaId,
        cancelReason: '   ',
        changedBy: 'tester',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'cancelReason');
      return true;
    },
  );
});

test('1e. validateCancelFormula rejects missing changedBy', () => {
  assert.throws(
    () =>
      validateCancelFormula({
        formulaId: sampleFormulaId,
        cancelReason: 'reason',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'changedBy');
      return true;
    },
  );
});

test('1f. validateCancelFormula rejects empty changedBy', () => {
  assert.throws(
    () =>
      validateCancelFormula({
        formulaId: sampleFormulaId,
        cancelReason: 'reason',
        changedBy: '',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'changedBy');
      return true;
    },
  );
});

test('1g. validateCancelFormula rejects forbidden field quantity', () => {
  assert.throws(
    () =>
      validateCancelFormula(
        cancelPayloadWithExtraKey(
          {
            formulaId: sampleFormulaId,
            cancelReason: 'reason',
            changedBy: 'tester',
          },
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

test('1h. validateCancelFormula rejects forbidden field version', () => {
  assert.throws(
    () =>
      validateCancelFormula(
        cancelPayloadWithExtraKey(
          {
            formulaId: sampleFormulaId,
            cancelReason: 'reason',
            changedBy: 'tester',
          },
          'version',
          { snapshot: {} },
        ),
      ),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'version');
      return true;
    },
  );
});

test('1i. validateCancelFormula rejects forbidden partial status field tradeStatus', () => {
  assert.throws(
    () =>
      validateCancelFormula(
        cancelPayloadWithExtraKey(
          {
            formulaId: sampleFormulaId,
            cancelReason: 'reason',
            changedBy: 'tester',
          },
          'tradeStatus',
          TradeStatus.CANCELED,
        ),
      ),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'tradeStatus');
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// DB integration
// ---------------------------------------------------------------------------

test('Formula Cancel integration flow', { skip: !hasDatabase }, async (t) => {
  let createdItemId: string | undefined;
  let createdItemWasNew = false;
  const auditLogIds: string[] = [];
  const statusLogIds: string[] = [];
  const snapshotIds: string[] = [];
  const versionIds: string[] = [];
  const paymentRecordIds: string[] = [];
  const paymentScheduleIds: string[] = [];
  const participantIds: string[] = [];
  const logisticsIds: string[] = [];
  const formulaIds: string[] = [];
  const companyIds: string[] = [];

  t.after(async () => {
    await cleanupFormulaCancelTestArtifacts({
      prisma,
      auditLogIds,
      statusLogIds,
      snapshotIds,
      versionIds,
      paymentRecordIds,
      paymentScheduleIds,
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

  await t.test('2-5. cancelFormula sets 6 statuses, writes 6 status_logs and 1 audit_log, no version artifacts', async () => {
    const formula = await createTestFormula(itemId);
    formulaIds.push(formula.id);

    const beforeRow = await prisma.formula.findUniqueOrThrow({ where: { id: formula.id } });
    const countsBefore = await countFormulaVersionArtifacts(prisma, formula.id);

    const result = await cancelFormula(formula.id, defaultCancelBody);

    auditLogIds.push(result.audit_log.id);
    statusLogIds.push(...result.status_logs.map((log) => log.id));

    assertAllStatusesCanceled(result.formula);
    assert.equal(result.formula.is_closed, false);
    assert.equal(result.formula.closed_at, null);
    assertStatusLogsForCancel(result.status_logs);

    const afterRow = await prisma.formula.findUniqueOrThrow({ where: { id: formula.id } });
    assert.equal(afterRow.tradeStatus, TradeStatus.CANCELED);
    assert.equal(afterRow.deliveryStatus, TradeStatus.CANCELED);
    assert.equal(afterRow.cashInStatus, PaymentStatus.CANCELED);
    assert.equal(afterRow.cashOutStatus, PaymentStatus.CANCELED);
    assert.equal(afterRow.invoiceStatus, InvoiceStatus.CANCELED);
    assert.equal(afterRow.logisticsStatus, TradeStatus.CANCELED);
    assert.equal(afterRow.isClosed, false);
    assert.equal(afterRow.closedAt, null);
    assert.ok(afterRow.updatedAt.getTime() >= beforeRow.updatedAt.getTime());

    const statusLogRows = await prisma.statusLog.findMany({
      where: { formulaId: formula.id },
      orderBy: { createdAt: 'asc' },
    });
    assert.equal(statusLogRows.length, 6);

    const auditRow = await prisma.auditLog.findUniqueOrThrow({
      where: { id: result.audit_log.id },
    });
    assert.equal(auditRow.tableName, 'formulas');
    assert.equal(auditRow.recordId, formula.id);
    assert.equal(auditRow.action, 'FORMULA_CANCEL');
    assert.equal(auditRow.changedBy, defaultCancelBody.changed_by);
    assert.ok(auditRow.oldData);
    assert.ok(auditRow.newData);

    const newData = auditRow.newData as Record<string, unknown>;
    assert.equal(newData.cancel_reason, defaultCancelBody.cancel_reason);
    assert.equal(newData.changed_by, defaultCancelBody.changed_by);
    assert.equal(newData.trade_status, TradeStatus.CANCELED);
    assert.equal(newData.logistics_status, TradeStatus.CANCELED);

    const countsAfter = await countFormulaVersionArtifacts(prisma, formula.id);
    assert.equal(countsAfter.versionCount, countsBefore.versionCount);
    assert.equal(countsAfter.snapshotCount, countsBefore.snapshotCount);
    assert.equal(countsAfter.versionAuditCount, countsBefore.versionAuditCount);
  });

  await t.test('6. already canceled formula rejects second cancel with ActionError 409', async () => {
    const formula = await createTestFormula(itemId);
    formulaIds.push(formula.id);

    const firstResult = await cancelFormula(formula.id, defaultCancelBody);
    auditLogIds.push(firstResult.audit_log.id);
    statusLogIds.push(...firstResult.status_logs.map((log) => log.id));

    const statusLogCountBefore = await prisma.statusLog.count({ where: { formulaId: formula.id } });
    const auditLogCountBefore = await prisma.auditLog.count({
      where: {
        tableName: 'formulas',
        recordId: formula.id,
        action: 'FORMULA_CANCEL',
      },
    });

    await assert.rejects(
      () => cancelFormula(formula.id, defaultCancelBody),
      (error: unknown) => assertActionError(error, 409),
    );

    const statusLogCountAfter = await prisma.statusLog.count({ where: { formulaId: formula.id } });
    const auditLogCountAfter = await prisma.auditLog.count({
      where: {
        tableName: 'formulas',
        recordId: formula.id,
        action: 'FORMULA_CANCEL',
      },
    });

    assert.equal(statusLogCountAfter, statusLogCountBefore);
    assert.equal(auditLogCountAfter, auditLogCountBefore);
  });

  await t.test('7. closed formula rejects cancelFormula with ActionError 409', async () => {
    const formula = await createTestFormula(itemId);
    formulaIds.push(formula.id);

    await setFormulaStatusesForClose(prisma, formula.id);
    await closeFormula(formula.id, { closed_by: 'formula.cancel.integration.test' });

    await assert.rejects(
      () => cancelFormula(formula.id, defaultCancelBody),
      (error: unknown) => assertActionError(error, 409),
    );
  });

  await t.test('8. missing formula returns ActionError 404', async () => {
    await assert.rejects(
      () => cancelFormula(missingFormulaId, defaultCancelBody),
      (error: unknown) => assertActionError(error, 404),
    );
  });

  await t.test('9. cancelFormula preserves payment_record is_canceled', async () => {
    const formula = await createTestFormula(itemId);
    formulaIds.push(formula.id);

    const companyId = await createTestCompany(prisma);
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
    participantIds.push(participant.id);

    const paymentRecord = await prisma.paymentRecord.create({
      data: {
        formulaId: formula.id,
        participantId: participant.id,
        direction: PaymentDirection.IN,
        actualAmount: 500_000,
        actualDate: new Date('2026-12-01'),
        isCanceled: false,
      },
    });
    paymentRecordIds.push(paymentRecord.id);

    const cancelResult = await cancelFormula(formula.id, {
      cancel_reason: 'payment preservation check',
      changed_by: 'formula.cancel.integration.test',
    });
    auditLogIds.push(cancelResult.audit_log.id);
    statusLogIds.push(...cancelResult.status_logs.map((log) => log.id));

    const recordAfter = await prisma.paymentRecord.findUniqueOrThrow({
      where: { id: paymentRecord.id },
    });
    assert.equal(recordAfter.isCanceled, false);
    assert.equal(recordAfter.canceledAt, null);
    assert.equal(recordAfter.cancelReason, null);
  });

  const app = await createTestApp();
  t.after(async () => {
    await app.close();
  });

  await t.test('10a. HTTP POST /api/v1/formulas/:formulaId/cancel returns 200', async () => {
    const formula = await createTestFormula(itemId);
    formulaIds.push(formula.id);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/formulas/${formula.id}/cancel`,
      headers: { 'content-type': 'application/json' },
      payload: defaultCancelBody,
    });

    assert.equal(response.statusCode, 200);

    const body = readJsonBody(response.payload);
    assert.equal(body.formula && typeof body.formula === 'object', true);
    assert.equal(Array.isArray(body.status_logs), true);
    assert.equal(body.audit_log && typeof body.audit_log === 'object', true);

    const formulaBody = body.formula as Record<string, unknown>;
    assert.equal(formulaBody.trade_status, TradeStatus.CANCELED);
    assert.equal(formulaBody.is_closed, false);

    const statusLogs = body.status_logs as Array<Record<string, unknown>>;
    assert.equal(statusLogs.length, 6);

    const auditLog = body.audit_log as Record<string, unknown>;
    auditLogIds.push(String(auditLog.id));
    statusLogIds.push(...statusLogs.map((log) => String(log.id)));
    assert.equal(auditLog.action, 'FORMULA_CANCEL');
  });

  await t.test('10b. HTTP POST cancel with invalid body returns 400', async () => {
    const formula = await createTestFormula(itemId);
    formulaIds.push(formula.id);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/formulas/${formula.id}/cancel`,
      headers: { 'content-type': 'application/json' },
      payload: {
        changed_by: 'formula.cancel.integration.test',
      },
    });

    assert.equal(response.statusCode, 400);
  });

  await t.test('10c. HTTP POST cancel on missing formula returns 404', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/formulas/${missingFormulaId}/cancel`,
      headers: { 'content-type': 'application/json' },
      payload: defaultCancelBody,
    });

    assert.equal(response.statusCode, 404);
  });

  await t.test('10d. HTTP POST cancel on already canceled formula returns 409', async () => {
    const formula = await createTestFormula(itemId);
    formulaIds.push(formula.id);

    const firstResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/formulas/${formula.id}/cancel`,
      headers: { 'content-type': 'application/json' },
      payload: defaultCancelBody,
    });
    assert.equal(firstResponse.statusCode, 200);

    const firstBody = readJsonBody(firstResponse.payload);
    const firstAudit = firstBody.audit_log as Record<string, unknown>;
    const firstStatusLogs = firstBody.status_logs as Array<Record<string, unknown>>;
    auditLogIds.push(String(firstAudit.id));
    statusLogIds.push(...firstStatusLogs.map((log) => String(log.id)));

    const secondResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/formulas/${formula.id}/cancel`,
      headers: { 'content-type': 'application/json' },
      payload: defaultCancelBody,
    });

    assert.equal(secondResponse.statusCode, 409);
  });
});
