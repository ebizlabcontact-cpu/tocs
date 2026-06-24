/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import 'dotenv/config';
import { PrismaClient, TradeType } from '@prisma/client';

import {
  createFormula,
  getFormulaByFormulaNo,
  getFormulaById,
  listFormulas,
} from '../actions/formula.actions.js';
import type { CreateFormulaRequest } from '../actions/formula.actions.js';
import type { CreateFormulaInput } from '../types/formula.types.js';
import { DEFAULT_BASE_CURRENCY } from '../types/formula.types.js';
import { validateCreateFormula, ValidationError } from '../utils/formula.validation.js';

const prisma = new PrismaClient();
const hasDatabase = Boolean(process.env.DATABASE_URL);

const sampleItemId = '22222222-2222-2222-2222-222222222201';

function toRequestQuantity(value: CreateFormulaInput['quantity']): number | string {
  return typeof value === 'object' && value !== null && 'toString' in value
    ? value.toString()
    : value;
}

function toRequestRate(
  value: CreateFormulaInput['contractExchangeRate'],
): number | string | null {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  return typeof value === 'object' && 'toString' in value ? value.toString() : value;
}

function toCreateFormulaRequest(input: CreateFormulaInput): CreateFormulaRequest {
  const body: CreateFormulaRequest = {
    trade_type: input.tradeType,
    item_id: input.itemId,
    quantity: toRequestQuantity(input.quantity),
    base_currency: input.baseCurrency,
  };

  if (input.unit !== undefined) body.unit = input.unit;
  if (input.foreignCurrency !== undefined) body.foreign_currency = input.foreignCurrency;
  if (input.departureCountry !== undefined) body.departure_country = input.departureCountry;
  if (input.arrivalCountry !== undefined) body.arrival_country = input.arrivalCountry;
  if (input.contractExchangeRate !== undefined) {
    body.contract_exchange_rate = toRequestRate(input.contractExchangeRate);
  }
  if (input.adjustedExchangeRate !== undefined) {
    body.adjusted_exchange_rate = toRequestRate(input.adjustedExchangeRate);
  }
  if (input.content !== undefined) body.content = input.content;
  if (input.note !== undefined) body.note = input.note;
  if (input.createdBy !== undefined) body.created_by = input.createdBy;

  return body;
}

async function resolveTestItemId(): Promise<string> {
  const existing = await prisma.item.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.item.create({
    data: {
      itemCode: `TEST-INT-${Date.now()}`,
      itemName: 'Formula Integration Test Item',
      defaultUnit: 'kg',
      isActive: true,
    },
  });

  return created.id;
}

test('1. validateCreateFormula converts valid payload to CreateFormulaInput', () => {
  const validated = validateCreateFormula({
    tradeType: TradeType.DOMESTIC,
    itemId: sampleItemId,
    quantity: 1000,
    unit: 'kg',
  });

  assert.equal(validated.tradeType, TradeType.DOMESTIC);
  assert.equal(validated.itemId, sampleItemId);
  assert.equal(validated.quantity, 1000);
  assert.equal(validated.unit, 'kg');
  assert.equal(validated.baseCurrency, DEFAULT_BASE_CURRENCY);
});

test('5. DOMESTIC trade rejects foreignCurrency with ValidationError', () => {
  assert.throws(
    () =>
      validateCreateFormula({
        tradeType: TradeType.DOMESTIC,
        itemId: sampleItemId,
        quantity: 100,
        foreignCurrency: 'USD',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'foreignCurrency');
      return true;
    },
  );
});

test('6. DOMESTIC trade rejects exchange rates with ValidationError', () => {
  assert.throws(
    () =>
      validateCreateFormula({
        tradeType: TradeType.DOMESTIC,
        itemId: sampleItemId,
        quantity: 100,
        contractExchangeRate: 1300,
      }),
    ValidationError,
  );

  assert.throws(
    () =>
      validateCreateFormula({
        tradeType: TradeType.DOMESTIC,
        itemId: sampleItemId,
        quantity: 100,
        adjustedExchangeRate: 1310,
      }),
    ValidationError,
  );
});

test('7. quantity <= 0 throws ValidationError', () => {
  assert.throws(
    () =>
      validateCreateFormula({
        tradeType: TradeType.DOMESTIC,
        itemId: sampleItemId,
        quantity: 0,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'quantity');
      return true;
    },
  );

  assert.throws(
    () =>
      validateCreateFormula({
        tradeType: TradeType.DOMESTIC,
        itemId: sampleItemId,
        quantity: -10,
      }),
    ValidationError,
  );
});

test('Formula create and read integration flow', { skip: !hasDatabase }, async (t) => {
  const itemId = await resolveTestItemId();
  let createdFormulaId: string | undefined;

  t.after(async () => {
    if (createdFormulaId) {
      await prisma.formula.delete({ where: { id: createdFormulaId } });
    }
    await prisma.$disconnect();
  });

  const validated = validateCreateFormula({
    tradeType: TradeType.DOMESTIC,
    itemId,
    quantity: 1000,
    unit: 'kg',
    content: 'integration test',
    createdBy: 'formula.integration.test',
  });

  const request = toCreateFormulaRequest(validated);
  assert.equal('formula_no' in request, false);

  const created = await createFormula(request);
  createdFormulaId = created.id;

  assert.ok(created.formula_no);
  assert.match(created.formula_no, /^FM-/);
  assert.equal(created.trade_type, TradeType.DOMESTIC);
  assert.equal(created.is_closed, false);

  const byId = await getFormulaById(created.id);
  assert.equal(byId.id, created.id);
  assert.equal(byId.formula_no, created.formula_no);
  assert.equal(byId.item_id, itemId);
  assert.equal(byId.quantity, '1000');

  const byFormulaNo = await getFormulaByFormulaNo(created.formula_no);
  assert.equal(byFormulaNo.id, created.id);
  assert.equal(byFormulaNo.formula_no, created.formula_no);

  const list = await listFormulas({ page: 1, page_size: 20 });
  assert.ok(list.total >= 1);
  assert.ok(list.items.some((formula) => formula.id === created.id));
  assert.equal(list.page, 1);
  assert.equal(list.page_size, 20);
});
