/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import 'dotenv/config';

import type { PrismaClient } from '@prisma/client';
import type { CreateFormulaRequest } from '../actions/formula.actions.js';
import type { CreateFormulaInput } from '../types/formula.types.js';
import { validateCreateFormula } from '../utils/formula.validation.js';
import {
  validateCloseFormula,
  validateGetFormulaCloseStatus,
  ValidationError,
} from '../utils/close.validation.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const sampleFormulaId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb901';
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

  return {
    prisma: prismaLib.prisma,
    TradeType: prismaModule.TradeType,
    TradeStatus: prismaModule.TradeStatus,
    InvoiceStatus: prismaModule.InvoiceStatus,
    PaymentStatus: prismaModule.PaymentStatus,
    createFormula: formulaModule.createFormula,
    getFormulaCloseStatus: closeModule.getFormulaCloseStatus,
    closeFormula: closeModule.closeFormula,
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
      itemCode: `TEST-CLS-INT-${Date.now()}`,
      itemName: 'Close Integration Test Item',
      defaultUnit: 'kg',
      isActive: true,
    },
  });

  return { itemId: created.id, created: true };
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

async function cleanupCloseTestArtifacts(params: {
  prisma: PrismaClient;
  formulaId?: string;
  itemId?: string;
  itemWasNew?: boolean;
}): Promise<void> {
  if (params.formulaId) {
    await params.prisma.formula.delete({ where: { id: params.formulaId } });
  }

  if (params.itemWasNew && params.itemId) {
    await params.prisma.item.delete({ where: { id: params.itemId } });
  }
}

test('1. validateGetFormulaCloseStatus accepts valid formulaId', () => {
  const validated = validateGetFormulaCloseStatus({ formulaId: sampleFormulaId });
  assert.equal(validated.formulaId, sampleFormulaId);
});

test('1b. validateGetFormulaCloseStatus rejects missing formulaId', () => {
  assert.throws(
    () => validateGetFormulaCloseStatus({}),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'formulaId');
      return true;
    },
  );
});

test('1c. validateGetFormulaCloseStatus rejects empty formulaId', () => {
  assert.throws(
    () => validateGetFormulaCloseStatus({ formulaId: '   ' }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'formulaId');
      return true;
    },
  );
});

test('2. validateCloseFormula accepts valid formulaId', () => {
  const validated = validateCloseFormula({ formulaId: sampleFormulaId });
  assert.equal(validated.formulaId, sampleFormulaId);
  assert.equal(validated.closedBy, undefined);
});

test('2b. validateCloseFormula allows closedBy null', () => {
  const validated = validateCloseFormula({
    formulaId: sampleFormulaId,
    closedBy: null,
  });

  assert.equal(validated.formulaId, sampleFormulaId);
  assert.equal(validated.closedBy, null);
});

test('2c. validateCloseFormula rejects empty closedBy', () => {
  assert.throws(
    () =>
      validateCloseFormula({
        formulaId: sampleFormulaId,
        closedBy: '   ',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'closedBy');
      return true;
    },
  );
});

test('Close integration flow', { skip: !hasDatabase }, async (t) => {
  const {
    prisma,
    TradeType,
    TradeStatus,
    InvoiceStatus,
    PaymentStatus,
    createFormula,
    getFormulaCloseStatus,
    closeFormula,
    ActionError,
  } = await loadDbIntegrationModules();

  let createdFormulaId: string | undefined;
  let createdItemId: string | undefined;
  let createdItemWasNew = false;

  t.after(async () => {
    await cleanupCloseTestArtifacts({
      prisma,
      ...(createdFormulaId ? { formulaId: createdFormulaId } : {}),
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
    content: 'close integration test',
    createdBy: 'close.integration.test',
  });

  const formula = await createFormula(toCreateFormulaRequest(validatedFormula));
  createdFormulaId = formula.id;

  const initialStatus = await getFormulaCloseStatus(formula.id);

  assert.equal(initialStatus.formula_id, formula.id);
  assert.equal(initialStatus.can_close, false);
  assert.equal(initialStatus.is_closed, false);
  assert.ok(initialStatus.pending_statuses.length > 0);
  assert.ok(initialStatus.pending_statuses.includes('trade_status'));

  await assert.rejects(
    () => closeFormula(formula.id, {}),
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

  const readyStatus = await getFormulaCloseStatus(formula.id);

  assert.equal(readyStatus.can_close, true);
  assert.equal(readyStatus.pending_statuses.length, 0);

  const closeResult = await closeFormula(formula.id, {
    closed_by: 'close.integration.test',
  });

  assert.equal(closeResult.formula.is_closed, true);
  assert.ok(closeResult.formula.closed_at);
  assert.equal(closeResult.status.is_closed, true);
  assert.equal(closeResult.status.can_close, true);

  const afterCloseStatus = await getFormulaCloseStatus(formula.id);

  assert.equal(afterCloseStatus.formula_id, formula.id);
  assert.equal(afterCloseStatus.is_closed, true);
});

test('6. getFormulaCloseStatus returns ActionError 404 for missing formula', {
  skip: !hasDatabase,
}, async (t) => {
  const { prisma, getFormulaCloseStatus, ActionError } = await loadDbIntegrationModules();

  t.after(async () => {
    await prisma.$disconnect();
  });

  await assert.rejects(
    () => getFormulaCloseStatus(missingFormulaId),
    (error: unknown) => {
      assert.ok(error instanceof ActionError);
      assert.equal(error.status, 404);
      return true;
    },
  );
});
