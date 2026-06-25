/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import 'dotenv/config';

import { PaymentDirection, RoleGroup } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

import type { CreateFormulaRequest } from '../actions/formula.actions.js';
import type { CreateFormulaInput } from '../types/formula.types.js';
import { validateCreateFormula } from '../utils/formula.validation.js';
import {
  validateCreateSettlementNote,
  validateCreateSettlementPaymentSchedule,
  ValidationError,
} from '../utils/settlement.validation.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const sampleFormulaId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeee9001';
const sampleParticipantId = 'ffffffff-ffff-ffff-ffff-ffffffff9001';
const missingFormulaId = '00000000-0000-0000-0000-000000000099';

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

async function loadDbIntegrationModules() {
  const prismaModule = await import('@prisma/client');
  const prismaLib = await import('../lib/prisma.js');
  const formulaModule = await import('../actions/formula.actions.js');
  const closeModule = await import('../actions/close.actions.js');
  const settlementModule = await import('../actions/settlement.actions.js');

  return {
    prisma: prismaLib.prisma,
    TradeType: prismaModule.TradeType,
    TradeStatus: prismaModule.TradeStatus,
    InvoiceStatus: prismaModule.InvoiceStatus,
    PaymentStatus: prismaModule.PaymentStatus,
    createFormula: formulaModule.createFormula,
    closeFormula: closeModule.closeFormula,
    ActionError: formulaModule.ActionError,
    createSettlementPaymentSchedule: settlementModule.createSettlementPaymentSchedule,
    createSettlementNote: settlementModule.createSettlementNote,
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
      itemCode: `TEST-SET-INT-${Date.now()}`,
      itemName: 'Settlement Integration Test Item',
      defaultUnit: 'kg',
      isActive: true,
    },
  });

  return { itemId: created.id, created: true };
}

async function createTestCompany(prisma: PrismaClient): Promise<string> {
  const company = await prisma.company.create({
    data: {
      companyName: `Settlement Integration Test Co ${Date.now()}`,
      isActive: true,
    },
  });

  return company.id;
}

async function setFormulaStatusesForClose(
  prisma: PrismaClient,
  formulaId: string,
  enums: {
    TradeStatus: typeof import('@prisma/client').TradeStatus;
    PaymentStatus: typeof import('@prisma/client').PaymentStatus;
    InvoiceStatus: typeof import('@prisma/client').InvoiceStatus;
  },
): Promise<void> {
  await prisma.formula.update({
    where: { id: formulaId },
    data: {
      tradeStatus: enums.TradeStatus.COMPLETED,
      deliveryStatus: enums.TradeStatus.COMPLETED,
      cashInStatus: enums.PaymentStatus.COMPLETED,
      cashOutStatus: enums.PaymentStatus.COMPLETED,
      invoiceStatus: enums.InvoiceStatus.AMOUNT_MATCHED,
      logisticsStatus: enums.TradeStatus.COMPLETED,
    },
  });
}

async function cleanupSettlementTestArtifacts(params: {
  prisma: PrismaClient;
  auditLogIds?: string[];
  scheduleIds?: string[];
  formulaId?: string;
  companyId?: string;
  itemId?: string;
  itemWasNew?: boolean;
}): Promise<void> {
  if (params.auditLogIds) {
    for (const auditLogId of params.auditLogIds) {
      await params.prisma.auditLog.delete({ where: { id: auditLogId } });
    }
  }

  if (params.scheduleIds) {
    for (const scheduleId of params.scheduleIds) {
      await params.prisma.paymentSchedule.delete({ where: { id: scheduleId } });
    }
  }

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

test('1. validateCreateSettlementPaymentSchedule accepts valid payload', () => {
  const validated = validateCreateSettlementPaymentSchedule({
    formulaId: sampleFormulaId,
    participantId: sampleParticipantId,
    direction: PaymentDirection.IN,
    scheduledAmount: 1_000_000,
    dueDate: '2026-12-01',
  });

  assert.equal(validated.formulaId, sampleFormulaId);
  assert.equal(validated.participantId, sampleParticipantId);
  assert.equal(validated.direction, PaymentDirection.IN);
  assert.equal(validated.scheduledAmount, 1_000_000);
  assert.ok(validated.dueDate instanceof Date);
});

test('1b. validateCreateSettlementPaymentSchedule rejects missing formulaId', () => {
  assert.throws(
    () =>
      validateCreateSettlementPaymentSchedule({
        participantId: sampleParticipantId,
        direction: PaymentDirection.IN,
        scheduledAmount: 100,
        dueDate: '2026-12-01',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'formulaId');
      return true;
    },
  );
});

test('1c. validateCreateSettlementPaymentSchedule rejects missing participantId', () => {
  assert.throws(
    () =>
      validateCreateSettlementPaymentSchedule({
        formulaId: sampleFormulaId,
        direction: PaymentDirection.IN,
        scheduledAmount: 100,
        dueDate: '2026-12-01',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'participantId');
      return true;
    },
  );
});

test('1d. validateCreateSettlementPaymentSchedule rejects missing direction', () => {
  assert.throws(
    () =>
      validateCreateSettlementPaymentSchedule({
        formulaId: sampleFormulaId,
        participantId: sampleParticipantId,
        scheduledAmount: 100,
        dueDate: '2026-12-01',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'direction');
      return true;
    },
  );
});

test('1e. validateCreateSettlementPaymentSchedule rejects invalid direction', () => {
  assert.throws(
    () =>
      validateCreateSettlementPaymentSchedule({
        formulaId: sampleFormulaId,
        participantId: sampleParticipantId,
        direction: 'INVALID' as PaymentDirection,
        scheduledAmount: 100,
        dueDate: '2026-12-01',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'direction');
      return true;
    },
  );
});

test('1f. validateCreateSettlementPaymentSchedule rejects scheduledAmount <= 0', () => {
  assert.throws(
    () =>
      validateCreateSettlementPaymentSchedule({
        formulaId: sampleFormulaId,
        participantId: sampleParticipantId,
        direction: PaymentDirection.IN,
        scheduledAmount: 0,
        dueDate: '2026-12-01',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'scheduledAmount');
      return true;
    },
  );
});

test('1g. validateCreateSettlementPaymentSchedule rejects invalid dueDate', () => {
  assert.throws(
    () =>
      validateCreateSettlementPaymentSchedule({
        formulaId: sampleFormulaId,
        participantId: sampleParticipantId,
        direction: PaymentDirection.IN,
        scheduledAmount: 100,
        dueDate: 'not-a-date',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'dueDate');
      return true;
    },
  );
});

test('2. validateCreateSettlementNote accepts valid payload', () => {
  const validated = validateCreateSettlementNote({
    formulaId: sampleFormulaId,
    note: 'settlement adjustment memo',
    issueType: 'AMOUNT_GAP',
    changedBy: 'settlement.integration.test',
  });

  assert.equal(validated.formulaId, sampleFormulaId);
  assert.equal(validated.note, 'settlement adjustment memo');
  assert.equal(validated.issueType, 'AMOUNT_GAP');
  assert.equal(validated.changedBy, 'settlement.integration.test');
});

test('2b. validateCreateSettlementNote rejects missing formulaId', () => {
  assert.throws(
    () =>
      validateCreateSettlementNote({
        note: 'memo',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'formulaId');
      return true;
    },
  );
});

test('2c. validateCreateSettlementNote rejects missing note', () => {
  assert.throws(
    () =>
      validateCreateSettlementNote({
        formulaId: sampleFormulaId,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'note');
      return true;
    },
  );
});

test('2d. validateCreateSettlementNote rejects empty note', () => {
  assert.throws(
    () =>
      validateCreateSettlementNote({
        formulaId: sampleFormulaId,
        note: '   ',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'note');
      return true;
    },
  );
});

test('2e. validateCreateSettlementNote rejects empty issueType', () => {
  assert.throws(
    () =>
      validateCreateSettlementNote({
        formulaId: sampleFormulaId,
        note: 'memo',
        issueType: '   ',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'issueType');
      return true;
    },
  );
});

test('2f. validateCreateSettlementNote rejects empty changedBy', () => {
  assert.throws(
    () =>
      validateCreateSettlementNote({
        formulaId: sampleFormulaId,
        note: 'memo',
        changedBy: '   ',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'changedBy');
      return true;
    },
  );
});

test('Settlement integration flow', { skip: !hasDatabase }, async (t) => {
  const {
    prisma,
    TradeType,
    TradeStatus,
    InvoiceStatus,
    PaymentStatus,
    createFormula,
    closeFormula,
    ActionError,
    createSettlementPaymentSchedule,
    createSettlementNote,
  } = await loadDbIntegrationModules();

  let createdFormulaId: string | undefined;
  let createdCompanyId: string | undefined;
  let createdItemId: string | undefined;
  let createdItemWasNew = false;
  let createdParticipantId: string | undefined;
  const createdScheduleIds: string[] = [];
  const createdAuditLogIds: string[] = [];

  t.after(async () => {
    await cleanupSettlementTestArtifacts({
      prisma,
      auditLogIds: createdAuditLogIds,
      scheduleIds: createdScheduleIds,
      ...(createdFormulaId ? { formulaId: createdFormulaId } : {}),
      ...(createdCompanyId ? { companyId: createdCompanyId } : {}),
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
    content: 'settlement integration test',
    createdBy: 'settlement.integration.test',
  });

  const formula = await createFormula(toCreateFormulaRequest(validatedFormula));
  createdFormulaId = formula.id;

  createdCompanyId = await createTestCompany(prisma);

  const participant = await prisma.formulaParticipant.create({
    data: {
      formulaId: formula.id,
      companyId: createdCompanyId,
      sequenceOrder: 1,
      roleGroup: RoleGroup.SUPPLIER,
      quantity: 1000,
      buyUnitPrice: 0,
      sellUnitPrice: 100,
      isStartPoint: true,
      isEndPoint: true,
    },
  });
  createdParticipantId = participant.id;

  const openScheduleBody = {
    participant_id: participant.id,
    direction: PaymentDirection.IN,
    scheduled_amount: 500_000,
    due_date: '2026-12-15',
  };

  await assert.rejects(
    () => createSettlementPaymentSchedule(formula.id, openScheduleBody),
    (error: unknown) => {
      assert.ok(error instanceof ActionError);
      assert.equal(error.status, 409);
      return true;
    },
  );

  await assert.rejects(
    () =>
      createSettlementNote(formula.id, {
        note: 'should fail on open formula',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ActionError);
      assert.equal(error.status, 409);
      return true;
    },
  );

  await setFormulaStatusesForClose(prisma, formula.id, {
    TradeStatus,
    PaymentStatus,
    InvoiceStatus,
  });

  await closeFormula(formula.id, {
    closed_by: 'settlement.integration.test',
  });

  const closedFormula = await prisma.formula.findUniqueOrThrow({
    where: { id: formula.id },
  });
  assert.equal(closedFormula.isClosed, true);

  const scheduleResponse = await createSettlementPaymentSchedule(formula.id, openScheduleBody);

  assert.equal(scheduleResponse.formula_id, formula.id);
  assert.equal(scheduleResponse.participant_id, participant.id);
  assert.equal(scheduleResponse.direction, PaymentDirection.IN);
  assert.equal(scheduleResponse.scheduled_amount, '500000');
  assert.equal(scheduleResponse.due_date, '2026-12-15');
  createdScheduleIds.push(scheduleResponse.id);

  const scheduleRow = await prisma.paymentSchedule.findUniqueOrThrow({
    where: { id: scheduleResponse.id },
  });
  assert.equal(scheduleRow.formulaId, formula.id);
  assert.equal(scheduleRow.participantId, participant.id);

  const noteResponse = await createSettlementNote(formula.id, {
    note: 'closed formula settlement note',
    issue_type: 'AMOUNT_GAP',
    changed_by: 'settlement.integration.test',
  });

  assert.equal(noteResponse.formula_id, formula.id);
  assert.equal(noteResponse.action, 'SETTLEMENT_NOTE');
  assert.equal(noteResponse.table_name, 'formulas');
  assert.equal(noteResponse.record_id, formula.id);
  assert.equal(noteResponse.note, 'closed formula settlement note');
  assert.equal(noteResponse.issue_type, 'AMOUNT_GAP');
  createdAuditLogIds.push(noteResponse.id);

  const auditLogRow = await prisma.auditLog.findUniqueOrThrow({
    where: { id: noteResponse.id },
  });
  assert.equal(auditLogRow.tableName, 'formulas');
  assert.equal(auditLogRow.recordId, formula.id);
  assert.equal(auditLogRow.action, 'SETTLEMENT_NOTE');

  await assert.rejects(
    () =>
      createSettlementPaymentSchedule(missingFormulaId, {
        participant_id: createdParticipantId,
        direction: PaymentDirection.IN,
        scheduled_amount: 100,
        due_date: '2026-12-01',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ActionError);
      assert.equal(error.status, 404);
      return true;
    },
  );

  await assert.rejects(
    () =>
      createSettlementNote(missingFormulaId, {
        note: 'missing formula note',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ActionError);
      assert.equal(error.status, 404);
      return true;
    },
  );
});
