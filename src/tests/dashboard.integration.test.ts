/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import 'dotenv/config';

import type { PrismaClient } from '@prisma/client';
import type { CreateFormulaRequest } from '../actions/formula.actions.js';
import type {
  FormulaConfirmedKpiResponse,
  FormulaProfitEngineResponse,
  ParticipantConfirmedKpiResponse,
  PaymentUnmatchedResponse,
} from '../actions/dashboard.actions.js';
import type { CreateFormulaInput } from '../types/formula.types.js';
import {
  DEFAULT_DASHBOARD_LIST_LIMIT,
  DEFAULT_DASHBOARD_LIST_OFFSET,
} from '../types/dashboard.types.js';
import { validateCreateFormula } from '../utils/formula.validation.js';
import {
  validateDashboardListInput,
  validateFormulaIdInput,
  ValidationError,
} from '../utils/dashboard.validation.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const sampleFormulaId = 'dddddddd-dddd-dddd-dddd-dddddddd9001';
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
  const dashboardModule = await import('../actions/dashboard.actions.js');

  return {
    prisma: prismaLib.prisma,
    TradeType: prismaModule.TradeType,
    createFormula: formulaModule.createFormula,
    ActionError: formulaModule.ActionError,
    getFormulaConfirmedKpi: dashboardModule.getFormulaConfirmedKpi,
    getFormulaProfitEngine: dashboardModule.getFormulaProfitEngine,
    listFormulaConfirmedKpi: dashboardModule.listFormulaConfirmedKpi,
    listFormulaProfitEngine: dashboardModule.listFormulaProfitEngine,
    listParticipantConfirmedKpi: dashboardModule.listParticipantConfirmedKpi,
    listUnmatchedPayments: dashboardModule.listUnmatchedPayments,
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
      itemCode: `TEST-DSH-INT-${Date.now()}`,
      itemName: 'Dashboard Integration Test Item',
      defaultUnit: 'kg',
      isActive: true,
    },
  });

  return { itemId: created.id, created: true };
}

async function cleanupDashboardTestArtifacts(params: {
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

function assertFormulaConfirmedKpiResponse(item: FormulaConfirmedKpiResponse): void {
  assert.equal(typeof item.formula_id, 'string');
  assert.equal(typeof item.formula_no, 'string');
  assert.equal(typeof item.cash_in_status, 'string');
  assert.equal(typeof item.cash_out_status, 'string');
  assert.equal(typeof item.confirmed_revenue, 'string');
  assert.equal(typeof item.confirmed_payment, 'string');
  assert.equal(typeof item.scheduled_revenue, 'string');
  assert.equal(typeof item.scheduled_payment, 'string');
  assert.equal(typeof item.receivable, 'string');
  assert.equal(typeof item.payable, 'string');
  assert.ok(item.receive_rate === null || typeof item.receive_rate === 'string');
  assert.ok(item.payment_rate === null || typeof item.payment_rate === 'string');
}

function assertFormulaProfitEngineResponse(item: FormulaProfitEngineResponse): void {
  assert.equal(typeof item.formula_id, 'string');
  assert.equal(typeof item.formula_no, 'string');
  assert.equal(typeof item.confirmed_revenue, 'string');
  assert.equal(typeof item.confirmed_cost_total, 'string');
  assert.equal(typeof item.confirmed_net_profit, 'string');
  assert.equal(typeof item.expected_revenue, 'string');
  assert.equal(typeof item.expected_buy, 'string');
  assert.equal(typeof item.expected_cost, 'string');
  assert.equal(typeof item.expected_share, 'string');
  assert.equal(typeof item.expected_net_profit, 'string');
  assert.equal(typeof item.expected_profit_rate, 'string');
}

function assertParticipantConfirmedKpiResponse(item: ParticipantConfirmedKpiResponse): void {
  assert.equal(typeof item.formula_id, 'string');
  assert.equal(typeof item.formula_no, 'string');
  assert.equal(typeof item.participant_id, 'string');
  assert.equal(typeof item.company_id, 'string');
  assert.equal(typeof item.company_name, 'string');
  assert.equal(typeof item.role_group, 'string');
  assert.equal(typeof item.sequence_order, 'number');
  assert.equal(typeof item.total_buy_amount, 'string');
  assert.equal(typeof item.total_sell_amount, 'string');
  assert.equal(typeof item.confirmed_in, 'string');
  assert.equal(typeof item.confirmed_out, 'string');
  assert.equal(typeof item.scheduled_in, 'string');
  assert.equal(typeof item.scheduled_out, 'string');
  assert.equal(typeof item.receivable, 'string');
  assert.equal(typeof item.payable, 'string');
  assert.equal(typeof item.confirmed_net_profit, 'string');
}

function assertPaymentUnmatchedResponse(item: PaymentUnmatchedResponse): void {
  assert.equal(typeof item.id, 'string');
  assert.equal(typeof item.formula_id, 'string');
  assert.equal(typeof item.formula_no, 'string');
  assert.equal(typeof item.direction, 'string');
  assert.equal(typeof item.actual_amount, 'string');
  assert.equal(typeof item.actual_date, 'string');
  assert.ok(item.bank_name === null || typeof item.bank_name === 'string');
  assert.ok(item.account_no === null || typeof item.account_no === 'string');
  assert.equal(typeof item.status, 'string');
  assert.ok(item.memo === null || typeof item.memo === 'string');
  assert.equal(typeof item.created_at, 'string');
}

test('1. validateFormulaIdInput accepts valid formulaId', () => {
  const validated = validateFormulaIdInput({ formulaId: sampleFormulaId });
  assert.equal(validated.formulaId, sampleFormulaId);
});

test('1b. validateFormulaIdInput rejects missing formulaId', () => {
  assert.throws(
    () => validateFormulaIdInput({}),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'formulaId');
      return true;
    },
  );
});

test('1c. validateFormulaIdInput rejects empty formulaId', () => {
  assert.throws(
    () => validateFormulaIdInput({ formulaId: '   ' }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'formulaId');
      return true;
    },
  );
});

test('2. validateDashboardListInput accepts valid filters and defaults', () => {
  const validated = validateDashboardListInput({
    formulaId: sampleFormulaId,
    dateFrom: '2024-01-01',
    dateTo: '2024-12-31',
    limit: 25,
    offset: 5,
  });

  assert.equal(validated.formulaId, sampleFormulaId);
  assert.ok(validated.dateFrom instanceof Date);
  assert.ok(validated.dateTo instanceof Date);
  assert.equal(validated.limit, 25);
  assert.equal(validated.offset, 5);
});

test('2b. validateDashboardListInput applies default limit and offset', () => {
  const validated = validateDashboardListInput({});

  assert.equal(validated.limit, DEFAULT_DASHBOARD_LIST_LIMIT);
  assert.equal(validated.offset, DEFAULT_DASHBOARD_LIST_OFFSET);
  assert.equal(validated.formulaId, undefined);
});

test('2c. validateDashboardListInput rejects invalid dateFrom', () => {
  assert.throws(
    () => validateDashboardListInput({ dateFrom: 'not-a-date' }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'dateFrom');
      return true;
    },
  );
});

test('2d. validateDashboardListInput rejects invalid dateTo', () => {
  assert.throws(
    () => validateDashboardListInput({ dateTo: '2024-13-40' }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'dateTo');
      return true;
    },
  );
});

test('2e. validateDashboardListInput rejects dateFrom after dateTo', () => {
  assert.throws(
    () =>
      validateDashboardListInput({
        dateFrom: '2024-12-31',
        dateTo: '2024-01-01',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'dateFrom');
      return true;
    },
  );
});

test('2f. validateDashboardListInput rejects limit below 1', () => {
  assert.throws(
    () => validateDashboardListInput({ limit: 0 }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'limit');
      return true;
    },
  );
});

test('2g. validateDashboardListInput rejects limit above 100', () => {
  assert.throws(
    () => validateDashboardListInput({ limit: 101 }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'limit');
      return true;
    },
  );
});

test('2h. validateDashboardListInput rejects negative offset', () => {
  assert.throws(
    () => validateDashboardListInput({ offset: -1 }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'offset');
      return true;
    },
  );
});

test('Dashboard integration flow', { skip: !hasDatabase }, async (t) => {
  const {
    prisma,
    TradeType,
    createFormula,
    ActionError,
    getFormulaConfirmedKpi,
    getFormulaProfitEngine,
    listFormulaConfirmedKpi,
    listFormulaProfitEngine,
    listParticipantConfirmedKpi,
    listUnmatchedPayments,
  } = await loadDbIntegrationModules();

  let createdFormulaId: string | undefined;
  let createdItemId: string | undefined;
  let createdItemWasNew = false;

  t.after(async () => {
    await cleanupDashboardTestArtifacts({
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
    content: 'dashboard integration test',
    createdBy: 'dashboard.integration.test',
  });

  const formula = await createFormula(toCreateFormulaRequest(validatedFormula));
  createdFormulaId = formula.id;

  const confirmedList = await listFormulaConfirmedKpi({ limit: 10 });
  assert.ok(Array.isArray(confirmedList.items));

  const confirmedFiltered = await listFormulaConfirmedKpi({
    formula_id: formula.id,
    limit: 10,
  });
  assert.ok(Array.isArray(confirmedFiltered.items));
  const confirmedMatch = confirmedFiltered.items.find((item) => item.formula_id === formula.id);
  assert.ok(confirmedMatch, 'created formula should appear in confirmed KPI list');
  assertFormulaConfirmedKpiResponse(confirmedMatch);

  const profitList = await listFormulaProfitEngine({ limit: 10 });
  assert.ok(Array.isArray(profitList.items));

  const profitFiltered = await listFormulaProfitEngine({
    formula_id: formula.id,
    limit: 10,
  });
  assert.ok(Array.isArray(profitFiltered.items));
  const profitMatch = profitFiltered.items.find((item) => item.formula_id === formula.id);
  assert.ok(profitMatch, 'created formula should appear in profit engine list');
  assertFormulaProfitEngineResponse(profitMatch);

  const participantList = await listParticipantConfirmedKpi({
    formula_id: formula.id,
    limit: 10,
  });
  assert.ok(Array.isArray(participantList.items));
  for (const item of participantList.items) {
    assertParticipantConfirmedKpiResponse(item);
  }

  const unmatchedList = await listUnmatchedPayments({ limit: 10 });
  assert.ok(Array.isArray(unmatchedList.items));
  for (const item of unmatchedList.items) {
    assertPaymentUnmatchedResponse(item);
  }

  const confirmedKpi = await getFormulaConfirmedKpi(formula.id);
  assert.equal(confirmedKpi.formula_id, formula.id);
  assert.equal(confirmedKpi.formula_no, formula.formula_no);
  assertFormulaConfirmedKpiResponse(confirmedKpi);

  const profitEngine = await getFormulaProfitEngine(formula.id);
  assert.equal(profitEngine.formula_id, formula.id);
  assert.equal(profitEngine.formula_no, formula.formula_no);
  assertFormulaProfitEngineResponse(profitEngine);

  await assert.rejects(
    () => getFormulaConfirmedKpi(missingFormulaId),
    (error: unknown) => {
      assert.ok(error instanceof ActionError);
      assert.equal(error.status, 404);
      return true;
    },
  );

  await assert.rejects(
    () => getFormulaProfitEngine(missingFormulaId),
    (error: unknown) => {
      assert.ok(error instanceof ActionError);
      assert.equal(error.status, 404);
      return true;
    },
  );
});
