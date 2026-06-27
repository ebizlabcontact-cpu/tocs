/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import 'dotenv/config';
import {
  PaymentDirection,
  PaymentStatus,
  RoleGroup,
  TradeType,
} from '@prisma/client';

import { ActionError } from '../actions/formula.actions.js';
import { createFormula } from '../actions/formula.actions.js';
import type { CreateFormulaRequest } from '../actions/formula.actions.js';
import {
  cancelPaymentRecord,
  createPaymentRecord,
  createPaymentSchedule,
  getPaymentRecordById,
  getPaymentScheduleById,
  listPaymentRecordsByFormulaId,
  listPaymentSchedulesByFormulaId,
} from '../actions/payment.actions.js';
import type {
  CreatePaymentRecordRequest,
  CreatePaymentScheduleRequest,
} from '../actions/payment.actions.js';
import type { CreateFormulaInput } from '../types/formula.types.js';
import type {
  ValidatedCancelPaymentRecordInput,
  ValidatedPaymentRecordInput,
  ValidatedPaymentScheduleInput,
} from '../types/payment.types.js';
import { validateCreateFormula } from '../utils/formula.validation.js';
import {
  validateCancelPaymentRecord,
  validateCreatePaymentRecord,
  validateCreatePaymentSchedule,
  ValidationError,
} from '../utils/payment.validation.js';
import { prisma } from '../lib/prisma.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const sampleFormulaId = '33333333-3333-3333-3333-333333333301';
const sampleParticipantId = '44444444-4444-4444-4444-444444444401';

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

function toCreatePaymentScheduleRequest(
  validated: ValidatedPaymentScheduleInput,
): CreatePaymentScheduleRequest {
  if (validated.direction === undefined) {
    throw new Error('direction is required for payment schedule action');
  }

  return {
    direction: validated.direction,
    scheduled_amount: toAmount(validated.scheduledAmount),
    participant_id: validated.participantId,
  };
}

function toIsoDateTime(value: Date | string): string {
  if (typeof value === 'string') {
    return value.includes('T') ? value : `${value}T00:00:00.000Z`;
  }

  return value.toISOString();
}

function toCreatePaymentRecordRequest(
  validated: ValidatedPaymentRecordInput,
): CreatePaymentRecordRequest {
  if (validated.direction === undefined) {
    throw new Error('direction is required for payment record action');
  }
  if (validated.actualDate === undefined) {
    throw new Error('actualDate is required for payment record action');
  }

  const body: CreatePaymentRecordRequest = {
    direction: validated.direction,
    actual_amount: toAmount(validated.actualAmount),
    actual_date: toIsoDateTime(validated.actualDate),
    participant_id: validated.participantId,
  };

  if (validated.paymentScheduleId !== undefined) {
    body.payment_schedule_id = validated.paymentScheduleId;
  }
  if (validated.status !== undefined) body.status = validated.status;

  return body;
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
      itemCode: `TEST-PAY-INT-${Date.now()}`,
      itemName: 'Payment Integration Test Item',
      defaultUnit: 'kg',
      isActive: true,
    },
  });

  return { itemId: created.id, created: true };
}

async function createTestCompany(): Promise<string> {
  const company = await prisma.company.create({
    data: {
      companyName: `Payment Integration Test Co ${Date.now()}`,
      isActive: true,
    },
  });

  return company.id;
}

test('1. validateCreatePaymentSchedule returns scheduledAmount for valid payload', () => {
  const validated = validateCreatePaymentSchedule({
    formulaId: sampleFormulaId,
    participantId: sampleParticipantId,
    amount: 1_000_000,
    direction: PaymentDirection.IN,
  });

  assert.equal(validated.formulaId, sampleFormulaId);
  assert.equal(validated.participantId, sampleParticipantId);
  assert.equal(validated.scheduledAmount, 1_000_000);
  assert.equal('actualAmount' in validated, false);
});

test('1b. validateCreatePaymentSchedule rejects amount <= 0', () => {
  assert.throws(
    () =>
      validateCreatePaymentSchedule({
        formulaId: sampleFormulaId,
        participantId: sampleParticipantId,
        amount: 0,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'amount');
      return true;
    },
  );
});

test('1c. validateCreatePaymentSchedule rejects missing formulaId', () => {
  assert.throws(
    () =>
      validateCreatePaymentSchedule({
        participantId: sampleParticipantId,
        amount: 100,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'formulaId');
      return true;
    },
  );
});

test('1d. validateCreatePaymentSchedule rejects missing participantId', () => {
  assert.throws(
    () =>
      validateCreatePaymentSchedule({
        formulaId: sampleFormulaId,
        amount: 100,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'participantId');
      return true;
    },
  );
});

test('2. validateCreatePaymentRecord returns actualAmount for valid payload', () => {
  const validated = validateCreatePaymentRecord({
    formulaId: sampleFormulaId,
    participantId: sampleParticipantId,
    amount: 500_000,
    direction: PaymentDirection.IN,
    actualDate: '2026-12-01',
  });

  assert.equal(validated.formulaId, sampleFormulaId);
  assert.equal(validated.participantId, sampleParticipantId);
  assert.equal(validated.actualAmount, 500_000);
  assert.equal('scheduledAmount' in validated, false);
});

test('2b. validateCreatePaymentRecord rejects amount <= 0', () => {
  assert.throws(
    () =>
      validateCreatePaymentRecord({
        formulaId: sampleFormulaId,
        participantId: sampleParticipantId,
        amount: -1,
      }),
    ValidationError,
  );
});

test('2c. validateCreatePaymentRecord rejects missing formulaId', () => {
  assert.throws(
    () =>
      validateCreatePaymentRecord({
        participantId: sampleParticipantId,
        amount: 100,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'formulaId');
      return true;
    },
  );
});

test('2d. validateCreatePaymentRecord rejects missing participantId', () => {
  assert.throws(
    () =>
      validateCreatePaymentRecord({
        formulaId: sampleFormulaId,
        amount: 100,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'participantId');
      return true;
    },
  );
});

test('3. validateCancelPaymentRecord accepts valid cancelReason', () => {
  const validated = validateCancelPaymentRecord({
    cancelReason: 'duplicate entry',
  });

  assert.equal(validated.cancelReason, 'duplicate entry');
});

test('3b. validateCancelPaymentRecord rejects empty and whitespace cancelReason', () => {
  assert.throws(
    () => validateCancelPaymentRecord({ cancelReason: '' }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'cancelReason');
      return true;
    },
  );

  assert.throws(
    () => validateCancelPaymentRecord({ cancelReason: '   ' }),
    ValidationError,
  );

  assert.throws(
    () => validateCancelPaymentRecord({}),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'cancelReason');
      return true;
    },
  );
});

test('Payment schedule/record/cancel integration flow', { skip: !hasDatabase }, async (t) => {
  let createdFormulaId: string | undefined;
  let createdCompanyId: string | undefined;
  let createdItemId: string | undefined;
  let createdItemWasNew = false;

  t.after(async () => {
    if (createdFormulaId) {
      await prisma.formula.delete({ where: { id: createdFormulaId } });
    }
    if (createdCompanyId) {
      await prisma.company.delete({ where: { id: createdCompanyId } });
    }
    if (createdItemWasNew && createdItemId) {
      await prisma.item.delete({ where: { id: createdItemId } });
    }
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
    content: 'payment integration test',
    createdBy: 'payment.integration.test',
  });

  const formula = await createFormula(toCreateFormulaRequest(validatedFormula));
  createdFormulaId = formula.id;

  createdCompanyId = await createTestCompany();

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

  const validatedSchedule = validateCreatePaymentSchedule({
    formulaId: formula.id,
    participantId: participant.id,
    amount: 1_000_000,
    direction: PaymentDirection.IN,
  });

  assert.equal(validatedSchedule.scheduledAmount, 1_000_000);
  assert.equal('actualAmount' in validatedSchedule, false);

  const schedule = await createPaymentSchedule(
    formula.id,
    toCreatePaymentScheduleRequest(validatedSchedule),
  );

  assert.equal(schedule.formula_id, formula.id);
  assert.equal(schedule.scheduled_amount, '1000000');
  assert.equal('actual_amount' in schedule, false);

  const scheduleById = await getPaymentScheduleById(schedule.id);
  assert.equal(scheduleById.id, schedule.id);
  assert.equal(scheduleById.scheduled_amount, '1000000');

  const scheduleList = await listPaymentSchedulesByFormulaId(formula.id);
  assert.ok(scheduleList.items.some((item) => item.id === schedule.id));

  const validatedRecord = validateCreatePaymentRecord({
    formulaId: formula.id,
    participantId: participant.id,
    amount: 500_000,
    direction: PaymentDirection.IN,
    actualDate: '2026-12-01',
    paymentScheduleId: schedule.id,
    status: PaymentStatus.PENDING,
  });

  assert.equal(validatedRecord.actualAmount, 500_000);
  assert.equal('scheduledAmount' in validatedRecord, false);

  const record = await createPaymentRecord(
    formula.id,
    toCreatePaymentRecordRequest(validatedRecord),
  );

  assert.equal(record.formula_id, formula.id);
  assert.equal(record.actual_amount, '500000');
  assert.equal(record.payment_schedule_id, schedule.id);
  assert.equal(record.direction, PaymentDirection.IN);
  assert.equal(schedule.direction, PaymentDirection.IN);
  assert.equal('scheduled_amount' in record, false);

  const recordById = await getPaymentRecordById(record.id);
  assert.equal(recordById.id, record.id);
  assert.equal(recordById.actual_amount, '500000');

  const recordList = await listPaymentRecordsByFormulaId(formula.id);
  assert.ok(recordList.items.some((item) => item.id === record.id));

  const validatedCancel: ValidatedCancelPaymentRecordInput = validateCancelPaymentRecord({
    cancelReason: 'integration test cancel',
  });

  const canceled = await cancelPaymentRecord(record.id, {
    cancel_reason: validatedCancel.cancelReason,
  });

  assert.equal(canceled.is_canceled, true);
  assert.ok(canceled.canceled_at);
  assert.equal(canceled.cancel_reason, 'integration test cancel');

  await assert.rejects(
    () =>
      cancelPaymentRecord(record.id, {
        cancel_reason: 'duplicate cancel attempt',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ActionError);
      assert.equal(error.status, 409);
      return true;
    },
  );
});
