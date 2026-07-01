/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import 'dotenv/config';

import { MembershipRole, RoleGroup, TradeType } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import { COMPANY_CONTEXT_REQUIRED } from '../http/plugins/company-context.js';
import { prisma } from '../lib/prisma.js';
import {
  createTestAuthFixture,
  deleteTestAuthFixture,
  withBearer,
  withCompanyId,
  withCompanyScopeAll,
} from './helpers/http-auth.helper.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

function readJsonBody(payload: string): Record<string, unknown> {
  return JSON.parse(payload) as Record<string, unknown>;
}

async function createTestApp(): Promise<FastifyInstance> {
  const { createServer } = await import('../http/server.js');
  return createServer();
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
      itemCode: `SCOPE-TEST-ITEM-${Date.now()}`,
      itemName: 'Company Scope Test Item',
      defaultUnit: 'kg',
      isActive: true,
    },
  });

  return created.id;
}

async function createFormulaWithParticipant(companyId: string, itemId: string): Promise<string> {
  const formula = await prisma.formula.create({
    data: {
      tradeType: TradeType.DOMESTIC,
      itemId,
      quantity: 1000,
      unit: 'kg',
      content: 'company scope test formula',
      createdBy: 'company-context.scope.integration.test',
    },
  });

  await prisma.formulaParticipant.create({
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

  return formula.id;
}

test('Company context scope integration', { skip: !hasDatabase }, async (t) => {
  const suffix = Date.now();
  const formulaIds: string[] = [];
  const companyIds: string[] = [];
  let itemId: string | undefined;

  const companyA = await prisma.company.create({
    data: { companyName: `Scope Co A ${suffix}`, isActive: true },
  });
  const companyB = await prisma.company.create({
    data: { companyName: `Scope Co B ${suffix}`, isActive: true },
  });
  companyIds.push(companyA.id, companyB.id);

  const viewerFixture = await createTestAuthFixture(
    MembershipRole.VIEWER,
    `scope-viewer-a-${suffix}`,
  );
  await prisma.companyMembership.update({
    where: { id: viewerFixture.membershipId },
    data: { companyId: companyA.id },
  });

  const superAdminFixture = await createTestAuthFixture(
    MembershipRole.SUPER_ADMIN,
    `scope-super-${suffix}`,
  );

  t.after(async () => {
    if (formulaIds.length > 0) {
      await prisma.formula.deleteMany({ where: { id: { in: formulaIds } } }).catch(() => undefined);
    }
    if (companyIds.length > 0) {
      await prisma.company.deleteMany({ where: { id: { in: companyIds } } }).catch(() => undefined);
    }
    await deleteTestAuthFixture(viewerFixture);
    await deleteTestAuthFixture(superAdminFixture);
    await prisma.$disconnect();
  });

  itemId = await resolveTestItemId();
  const formulaAId = await createFormulaWithParticipant(companyA.id, itemId);
  const formulaBId = await createFormulaWithParticipant(companyB.id, itemId);
  formulaIds.push(formulaAId, formulaBId);

  const app = await createTestApp();
  t.after(async () => {
    await app.close();
  });

  await t.test('GET /formulas without X-Company-Id as non-admin returns 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/formulas?page=1&page_size=100',
      headers: withBearer(viewerFixture.accessToken),
    });

    assert.equal(response.statusCode, 400);
    assert.equal(readJsonBody(response.payload).message, COMPANY_CONTEXT_REQUIRED);
  });

  await t.test('VIEWER company A sees only company A formulas', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/formulas?page=1&page_size=100',
      headers: withCompanyId(viewerFixture.accessToken, companyA.id),
    });

    assert.equal(response.statusCode, 200);

    const body = readJsonBody(response.payload) as { items: Array<{ id: string }> };
    const ids = body.items.map((item) => item.id);
    assert.ok(ids.includes(formulaAId));
    assert.equal(ids.includes(formulaBId), false);
  });

  await t.test('SUPER_ADMIN all scope sees formulas across companies', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/formulas?page=1&page_size=100',
      headers: withCompanyScopeAll(superAdminFixture.accessToken),
    });

    assert.equal(response.statusCode, 200);

    const body = readJsonBody(response.payload) as { items: Array<{ id: string }> };
    const ids = body.items.map((item) => item.id);
    assert.ok(ids.includes(formulaAId));
    assert.ok(ids.includes(formulaBId));
  });

  await t.test('SUPER_ADMIN company A scope sees company A only', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/formulas?page=1&page_size=100',
      headers: withCompanyId(superAdminFixture.accessToken, companyA.id),
    });

    assert.equal(response.statusCode, 200);

    const body = readJsonBody(response.payload) as { items: Array<{ id: string }> };
    const ids = body.items.map((item) => item.id);
    assert.ok(ids.includes(formulaAId));
    assert.equal(ids.includes(formulaBId), false);
  });

  await t.test('GET /companies scoped to active company', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/companies?page=1&page_size=20',
      headers: withCompanyId(viewerFixture.accessToken, companyA.id),
    });

    assert.equal(response.statusCode, 200);

    const body = readJsonBody(response.payload) as { items: Array<{ id: string }> };
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0]?.id, companyA.id);
  });

  await t.test('GET /payments/unmatched respects company scope', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/payments/unmatched?limit=100',
      headers: withCompanyId(viewerFixture.accessToken, companyA.id),
    });

    assert.equal(response.statusCode, 200);

    const body = readJsonBody(response.payload) as { items: Array<{ formula_id: string }> };
    for (const item of body.items) {
      assert.notEqual(item.formula_id, formulaBId);
    }
  });

  const formulaChildListCases = [
    { name: 'participants', path: (id: string) => `/api/v1/formulas/${id}/participants` },
    { name: 'payment-schedules', path: (id: string) => `/api/v1/formulas/${id}/payment-schedules` },
    { name: 'payment-records', path: (id: string) => `/api/v1/formulas/${id}/payment-records` },
    { name: 'invoices', path: (id: string) => `/api/v1/formulas/${id}/invoices` },
    { name: 'logistics', path: (id: string) => `/api/v1/formulas/${id}/logistics` },
    { name: 'shares', path: (id: string) => `/api/v1/formulas/${id}/shares` },
    { name: 'versions', path: (id: string) => `/api/v1/formulas/${id}/versions` },
  ] as const;

  for (const childCase of formulaChildListCases) {
    await t.test(`GET ${childCase.name} allows company A formula in company A scope`, async () => {
      const response = await app.inject({
        method: 'GET',
        url: childCase.path(formulaAId),
        headers: withCompanyId(viewerFixture.accessToken, companyA.id),
      });

      assert.equal(response.statusCode, 200);

      const body = readJsonBody(response.payload) as { items: unknown[] };
      assert.ok(Array.isArray(body.items));
    });

    await t.test(`GET ${childCase.name} hides company B formula in company A scope`, async () => {
      const response = await app.inject({
        method: 'GET',
        url: childCase.path(formulaBId),
        headers: withCompanyId(viewerFixture.accessToken, companyA.id),
      });

      assert.equal(response.statusCode, 404);
    });
  }

  await t.test('GET dashboard kpi/participants scoped to company A formula', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/formulas/${formulaAId}/kpi/participants?limit=100`,
      headers: withCompanyId(viewerFixture.accessToken, companyA.id),
    });

    assert.equal(response.statusCode, 200);

    const body = readJsonBody(response.payload) as { items: Array<{ formula_id: string }> };
    for (const item of body.items) {
      assert.equal(item.formula_id, formulaAId);
    }
  });

  await t.test('GET dashboard kpi/participants hides company B formula', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/formulas/${formulaBId}/kpi/participants?limit=100`,
      headers: withCompanyId(viewerFixture.accessToken, companyA.id),
    });

    assert.equal(response.statusCode, 404);
  });
});
