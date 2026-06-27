/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import 'dotenv/config';
import { InvoiceStatus, RoleGroup, TradeType } from '@prisma/client';

import { ActionError } from '../actions/formula.actions.js';
import { createFormula } from '../actions/formula.actions.js';
import type { CreateFormulaRequest } from '../actions/formula.actions.js';
import {
  createInvoice,
  getInvoiceById,
  listInvoicesByFormulaId,
  listInvoicesByParticipantId,
  syncFormulaInvoiceStatus,
  updateInvoiceStatus,
} from '../actions/invoice.actions.js';
import type { CreateInvoiceRequest } from '../actions/invoice.actions.js';
import type { CreateFormulaInput } from '../types/formula.types.js';
import type { ValidatedCreateInvoiceInput } from '../types/invoice.types.js';
import { validateCreateFormula } from '../utils/formula.validation.js';
import {
  validateCreateInvoice,
  validateUpdateInvoiceStatus,
  ValidationError,
} from '../utils/invoice.validation.js';
import { prisma } from '../lib/prisma.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const sampleFormulaId = '66666666-6666-6666-6666-666666666601';
const sampleIssuerParticipantId = '77777777-7777-7777-7777-777777777701';
const sampleReceiverParticipantId = '88888888-8888-8888-8888-888888888801';

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

function buildValidCreateInvoicePayload(
  formulaId: string,
  issuerParticipantId: string,
  receiverParticipantId: string,
) {
  return {
    formulaId,
    issuerParticipantId,
    receiverParticipantId,
    sequenceOrder: 1,
    invoiceType: 'TAX_INVOICE',
    issueAmount: 1_100_000,
  };
}

function toCreateInvoiceRequest(
  validated: ValidatedCreateInvoiceInput,
  issuerCompanyId: string,
  receiverCompanyId: string,
): CreateInvoiceRequest {
  const amount = toAmount(validated.issueAmount);

  return {
    issuer_company_id: issuerCompanyId,
    receiver_company_id: receiverCompanyId,
    issuer_participant_id: validated.issuerParticipantId,
    receiver_participant_id: validated.receiverParticipantId,
    sequence_order: validated.sequenceOrder,
    external_invoice_amount: amount,
    supply_amount: amount,
    tax_amount: 0,
    status: InvoiceStatus.ISSUED,
    memo: validated.invoiceType,
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
      itemCode: `TEST-INV-INT-${Date.now()}`,
      itemName: 'Invoice Integration Test Item',
      defaultUnit: 'kg',
      isActive: true,
    },
  });

  return { itemId: created.id, created: true };
}

async function createTestCompany(label: string): Promise<string> {
  const company = await prisma.company.create({
    data: {
      companyName: `Invoice Integration Test Co ${label} ${Date.now()}`,
      isActive: true,
    },
  });

  return company.id;
}

async function cleanupInvoiceTestArtifacts(params: {
  invoiceIds: string[];
  formulaId?: string;
  companyIds: string[];
  itemId?: string;
  itemWasNew?: boolean;
}): Promise<void> {
  for (const id of params.invoiceIds) {
    await prisma.invoice.delete({ where: { id } });
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

test('1. validateCreateInvoice accepts valid payload', () => {
  const validated = validateCreateInvoice(
    buildValidCreateInvoicePayload(
      sampleFormulaId,
      sampleIssuerParticipantId,
      sampleReceiverParticipantId,
    ),
  );

  assert.equal(validated.formulaId, sampleFormulaId);
  assert.equal(validated.issuerParticipantId, sampleIssuerParticipantId);
  assert.equal(validated.receiverParticipantId, sampleReceiverParticipantId);
  assert.equal(validated.sequenceOrder, 1);
  assert.equal(validated.invoiceType, 'TAX_INVOICE');
  assert.equal(validated.issueAmount, 1_100_000);
});

test('1b. validateCreateInvoice rejects missing formulaId', () => {
  const payload = buildValidCreateInvoicePayload(
    sampleFormulaId,
    sampleIssuerParticipantId,
    sampleReceiverParticipantId,
  );
  const { formulaId: _formulaId, ...withoutFormulaId } = payload;

  assert.throws(
    () => validateCreateInvoice(withoutFormulaId),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'formulaId');
      return true;
    },
  );
});

test('1c. validateCreateInvoice rejects missing issuerParticipantId', () => {
  const payload = buildValidCreateInvoicePayload(
    sampleFormulaId,
    sampleIssuerParticipantId,
    sampleReceiverParticipantId,
  );
  const { issuerParticipantId: _issuerParticipantId, ...withoutIssuerParticipantId } = payload;

  assert.throws(
    () => validateCreateInvoice(withoutIssuerParticipantId),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'issuerParticipantId');
      return true;
    },
  );
});

test('1d. validateCreateInvoice rejects missing receiverParticipantId', () => {
  const payload = buildValidCreateInvoicePayload(
    sampleFormulaId,
    sampleIssuerParticipantId,
    sampleReceiverParticipantId,
  );
  const { receiverParticipantId: _receiverParticipantId, ...withoutReceiverParticipantId } =
    payload;

  assert.throws(
    () => validateCreateInvoice(withoutReceiverParticipantId),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'receiverParticipantId');
      return true;
    },
  );
});

test('1e. validateCreateInvoice rejects sequenceOrder < 1', () => {
  assert.throws(
    () =>
      validateCreateInvoice({
        ...buildValidCreateInvoicePayload(
          sampleFormulaId,
          sampleIssuerParticipantId,
          sampleReceiverParticipantId,
        ),
        sequenceOrder: 0,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'sequenceOrder');
      return true;
    },
  );
});

test('1f. validateCreateInvoice rejects issueAmount <= 0', () => {
  assert.throws(
    () =>
      validateCreateInvoice({
        ...buildValidCreateInvoicePayload(
          sampleFormulaId,
          sampleIssuerParticipantId,
          sampleReceiverParticipantId,
        ),
        issueAmount: 0,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'issueAmount');
      return true;
    },
  );
});

test('2. validateUpdateInvoiceStatus accepts valid status', () => {
  const validated = validateUpdateInvoiceStatus({ status: InvoiceStatus.ISSUED });

  assert.equal(validated.status, InvoiceStatus.ISSUED);
});

test('2b. validateUpdateInvoiceStatus rejects empty string', () => {
  assert.throws(
    () => validateUpdateInvoiceStatus({ status: '' }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'status');
      return true;
    },
  );
});

test('2c. validateUpdateInvoiceStatus rejects invalid InvoiceStatus', () => {
  assert.throws(
    () => validateUpdateInvoiceStatus({ status: 'INVALID_STATUS' }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'status');
      return true;
    },
  );
});

test('Invoice create, sync, and read integration flow', { skip: !hasDatabase }, async (t) => {
  let createdFormulaId: string | undefined;
  let createdItemId: string | undefined;
  let createdItemWasNew = false;
  const invoiceIds: string[] = [];
  const companyIds: string[] = [];

  t.after(async () => {
    await cleanupInvoiceTestArtifacts({
      invoiceIds,
      ...(createdFormulaId ? { formulaId: createdFormulaId } : {}),
      companyIds,
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
    content: 'invoice integration test',
    createdBy: 'invoice.integration.test',
  });

  const formula = await createFormula(toCreateFormulaRequest(validatedFormula));
  createdFormulaId = formula.id;

  const issuerCompanyId = await createTestCompany('issuer');
  const receiverCompanyId = await createTestCompany('receiver');
  companyIds.push(issuerCompanyId, receiverCompanyId);

  const issuerParticipant = await prisma.formulaParticipant.create({
    data: {
      formulaId: formula.id,
      companyId: issuerCompanyId,
      sequenceOrder: 1,
      roleGroup: RoleGroup.SUPPLIER,
      quantity: 1000,
      buyUnitPrice: 0,
      sellUnitPrice: 100,
      isStartPoint: true,
      isEndPoint: false,
    },
  });

  const receiverParticipant = await prisma.formulaParticipant.create({
    data: {
      formulaId: formula.id,
      companyId: receiverCompanyId,
      sequenceOrder: 2,
      roleGroup: RoleGroup.BUYER,
      quantity: 1000,
      buyUnitPrice: 100,
      sellUnitPrice: 0,
      isStartPoint: false,
      isEndPoint: true,
    },
  });

  const validatedInvoice = validateCreateInvoice(
    buildValidCreateInvoicePayload(formula.id, issuerParticipant.id, receiverParticipant.id),
  );

  const createdInvoice = await createInvoice(
    formula.id,
    toCreateInvoiceRequest(validatedInvoice, issuerCompanyId, receiverCompanyId),
  );
  invoiceIds.push(createdInvoice.id);

  assert.equal(createdInvoice.formula_id, formula.id);
  assert.equal(createdInvoice.issuer_participant_id, issuerParticipant.id);
  assert.equal(createdInvoice.receiver_participant_id, receiverParticipant.id);
  assert.equal(createdInvoice.status, InvoiceStatus.ISSUED);
  assert.equal(createdInvoice.external_invoice_amount, '1100000');

  const invoiceRow = await prisma.invoice.findUnique({ where: { id: createdInvoice.id } });
  assert.ok(invoiceRow);

  const formulaAfterCreate = await prisma.formula.findUnique({ where: { id: formula.id } });
  assert.ok(formulaAfterCreate);
  assert.equal(formulaAfterCreate.invoiceStatus, InvoiceStatus.ISSUED);

  const syncAfterCreate = await syncFormulaInvoiceStatus(formula.id);
  assert.equal(syncAfterCreate.formula_id, formula.id);
  assert.equal(syncAfterCreate.invoice_status, InvoiceStatus.ISSUED);
  assert.equal(syncAfterCreate.formula_no, formula.formula_no);

  const invoiceById = await getInvoiceById(createdInvoice.id);
  assert.equal(invoiceById.id, createdInvoice.id);
  assert.equal(invoiceById.formula_id, formula.id);

  const invoicesByFormula = await listInvoicesByFormulaId(formula.id);
  assert.ok(invoicesByFormula.items.some((item) => item.id === createdInvoice.id));

  const invoicesByIssuer = await listInvoicesByParticipantId(issuerParticipant.id);
  assert.ok(invoicesByIssuer.items.some((item) => item.id === createdInvoice.id));

  const invoicesByReceiver = await listInvoicesByParticipantId(receiverParticipant.id);
  assert.ok(invoicesByReceiver.items.some((item) => item.id === createdInvoice.id));

  const validatedStatusUpdate = validateUpdateInvoiceStatus({
    status: InvoiceStatus.AMOUNT_MATCHED,
  });

  const updatedInvoice = await updateInvoiceStatus(createdInvoice.id, {
    status: validatedStatusUpdate.status,
  });

  assert.equal(updatedInvoice.status, InvoiceStatus.AMOUNT_MATCHED);

  const formulaAfterUpdate = await prisma.formula.findUnique({ where: { id: formula.id } });
  assert.ok(formulaAfterUpdate);
  assert.equal(formulaAfterUpdate.invoiceStatus, InvoiceStatus.AMOUNT_MATCHED);

  const syncAfterUpdate = await syncFormulaInvoiceStatus(formula.id);
  assert.equal(syncAfterUpdate.invoice_status, InvoiceStatus.AMOUNT_MATCHED);
});

test('5. getInvoiceById returns ActionError 404 for missing invoice', { skip: !hasDatabase }, async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await assert.rejects(
    () => getInvoiceById('00000000-0000-0000-0000-000000000099'),
    (error: unknown) => {
      assert.ok(error instanceof ActionError);
      assert.equal(error.status, 404);
      return true;
    },
  );
});
