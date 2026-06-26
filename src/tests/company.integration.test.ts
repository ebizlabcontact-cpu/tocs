/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import 'dotenv/config';

import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import {
  createCompany,
  getCompanyById,
  listCompanies,
} from '../actions/company.actions.js';
import { ActionError } from '../actions/formula.actions.js';
import {
  validateCompanyId,
  validateCreateCompany,
  validateListCompanies,
  ValidationError,
} from '../utils/company.validation.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const missingCompanyId = '00000000-0000-0000-0000-000000000099';

function readJsonBody(payload: string): Record<string, unknown> {
  return JSON.parse(payload) as Record<string, unknown>;
}

function repeatChar(char: string, count: number): string {
  return char.repeat(count);
}

async function createTestApp(): Promise<FastifyInstance> {
  const { createServer } = await import('../http/server.js');
  return createServer();
}

async function cleanupCompanies(prisma: PrismaClient, companyIds: string[]): Promise<void> {
  for (const companyId of companyIds) {
    await prisma.company.delete({ where: { id: companyId } });
  }
}

function assertActionError(error: unknown, status: number): boolean {
  assert.ok(error instanceof ActionError);
  assert.equal(error.status, status);
  return true;
}

// ---------------------------------------------------------------------------
// 1. validateCreateCompany
// ---------------------------------------------------------------------------

test('1a. validateCreateCompany passes valid payload', () => {
  const validated = validateCreateCompany({
    companyName: '  Test Company  ',
    businessRegNo: '123-45-67890',
    representativeName: 'Rep',
    mainPhone: '02-1234-5678',
    hqAddress: 'Seoul',
    memo: 'note',
  });

  assert.equal(validated.companyName, 'Test Company');
  assert.equal(validated.businessRegNo, '123-45-67890');
  assert.equal(validated.representativeName, 'Rep');
  assert.equal(validated.mainPhone, '02-1234-5678');
  assert.equal(validated.hqAddress, 'Seoul');
  assert.equal(validated.memo, 'note');
});

test('1b. validateCreateCompany rejects missing companyName', () => {
  assert.throws(
    () => validateCreateCompany({}),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'companyName');
      return true;
    },
  );
});

test('1c. validateCreateCompany rejects empty companyName', () => {
  assert.throws(
    () => validateCreateCompany({ companyName: '   ' }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'companyName');
      return true;
    },
  );
});

test('1d. validateCreateCompany rejects companyName longer than 200', () => {
  assert.throws(
    () => validateCreateCompany({ companyName: repeatChar('a', 201) }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'companyName');
      return true;
    },
  );
});

test('1e. validateCreateCompany rejects businessRegNo longer than 20', () => {
  assert.throws(
    () =>
      validateCreateCompany({
        companyName: 'Valid Co',
        businessRegNo: repeatChar('1', 21),
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'businessRegNo');
      return true;
    },
  );
});

test('1f. validateCreateCompany rejects representativeName longer than 100', () => {
  assert.throws(
    () =>
      validateCreateCompany({
        companyName: 'Valid Co',
        representativeName: repeatChar('r', 101),
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'representativeName');
      return true;
    },
  );
});

test('1g. validateCreateCompany rejects mainPhone longer than 30', () => {
  assert.throws(
    () =>
      validateCreateCompany({
        companyName: 'Valid Co',
        mainPhone: repeatChar('0', 31),
      }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'mainPhone');
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// 2. validateListCompanies
// ---------------------------------------------------------------------------

test('2a. validateListCompanies passes empty input (defaults applied downstream)', () => {
  const validated = validateListCompanies({});

  assert.equal(validated.page, undefined);
  assert.equal(validated.pageSize, undefined);
  assert.equal(validated.isActive, undefined);
});

test('2b. validateListCompanies rejects page less than 1', () => {
  assert.throws(
    () => validateListCompanies({ page: 0 }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'page');
      return true;
    },
  );
});

test('2c. validateListCompanies rejects pageSize below 1', () => {
  assert.throws(
    () => validateListCompanies({ pageSize: 0 }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'pageSize');
      return true;
    },
  );
});

test('2d. validateListCompanies rejects pageSize above 100', () => {
  assert.throws(
    () => validateListCompanies({ pageSize: 101 }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'pageSize');
      return true;
    },
  );
});

test('2e. validateListCompanies parses isActive string true/false', () => {
  assert.equal(validateListCompanies({ isActive: 'true' }).isActive, true);
  assert.equal(validateListCompanies({ isActive: 'false' }).isActive, false);
  assert.equal(validateListCompanies({ isActive: true }).isActive, true);
  assert.equal(validateListCompanies({ isActive: false }).isActive, false);
});

// ---------------------------------------------------------------------------
// 3. validateCompanyId
// ---------------------------------------------------------------------------

test('3a. validateCompanyId passes valid id', () => {
  const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001';
  const validated = validateCompanyId({ companyId: `  ${id}  ` });

  assert.equal(validated.companyId, id);
});

test('3b. validateCompanyId rejects missing companyId', () => {
  assert.throws(
    () => validateCompanyId({}),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'companyId');
      return true;
    },
  );
});

test('3c. validateCompanyId rejects empty companyId', () => {
  assert.throws(
    () => validateCompanyId({ companyId: '   ' }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.field, 'companyId');
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// 4–8. DB integration + HTTP smoke
// ---------------------------------------------------------------------------

test('Company DB integration and HTTP smoke', { skip: !hasDatabase }, async (t) => {
  const prismaLib = await import('../lib/prisma.js');
  const prisma = prismaLib.prisma;

  const createdCompanyIds: string[] = [];

  t.after(async () => {
    await cleanupCompanies(prisma, createdCompanyIds);
    await prisma.$disconnect();
  });

  const uniqueRegNo = `BR-${Date.now()}`;

  await t.test('4. createCompany returns snake_case response with timestamps', async () => {
    const created = await createCompany({
      company_name: `Company Integration Co ${Date.now()}`,
      business_reg_no: uniqueRegNo,
      representative_name: 'CEO',
      main_phone: '02-0000-0000',
      hq_address: 'Seoul',
      memo: 'integration test',
    });

    createdCompanyIds.push(created.id);

    assert.equal(typeof created.id, 'string');
    assert.equal(typeof created.company_name, 'string');
    assert.equal(created.business_reg_no, uniqueRegNo);
    assert.equal(created.representative_name, 'CEO');
    assert.equal(created.main_phone, '02-0000-0000');
    assert.equal(created.hq_address, 'Seoul');
    assert.equal(created.memo, 'integration test');
    assert.equal(created.is_active, true);
    assert.equal(typeof created.created_at, 'string');
    assert.equal(typeof created.updated_at, 'string');
    assert.ok(!Number.isNaN(Date.parse(created.created_at)));
    assert.ok(!Number.isNaN(Date.parse(created.updated_at)));
    assert.equal('companyName' in created, false);
  });

  await t.test('5. duplicate business_reg_no returns ActionError 409', async () => {
    await assert.rejects(
      () =>
        createCompany({
          company_name: 'Duplicate Reg Co',
          business_reg_no: uniqueRegNo,
        }),
      (error: unknown) => assertActionError(error, 409),
    );
  });

  await t.test('6a. getCompanyById returns existing company', async () => {
    const existingId = createdCompanyIds[0];
    assert.ok(existingId);

    const company = await getCompanyById(existingId);

    assert.equal(company.id, existingId);
    assert.equal(company.business_reg_no, uniqueRegNo);
  });

  await t.test('6b. getCompanyById missing company returns ActionError 404', async () => {
    await assert.rejects(
      () => getCompanyById(missingCompanyId),
      (error: unknown) => assertActionError(error, 404),
    );
  });

  await t.test('7a. listCompanies returns items/total/page/page_size with defaults', async () => {
    const list = await listCompanies({});

    assert.ok(Array.isArray(list.items));
    assert.equal(typeof list.total, 'number');
    assert.equal(list.page, 1);
    assert.equal(list.page_size, 20);
    assert.ok(list.total >= 1);
    assert.ok(list.items.some((item) => item.id === createdCompanyIds[0]));
  });

  await t.test('7b. listCompanies is_active filter', async () => {
    const inactive = await prisma.company.create({
      data: {
        companyName: `Inactive Co ${Date.now()}`,
        isActive: false,
      },
    });
    createdCompanyIds.push(inactive.id);

    const activeList = await listCompanies({ is_active: true });
    assert.ok(activeList.items.every((item) => item.is_active === true));
    assert.equal(
      activeList.items.some((item) => item.id === inactive.id),
      false,
    );

    const inactiveList = await listCompanies({ is_active: false });
    assert.ok(inactiveList.items.every((item) => item.is_active === false));
    assert.ok(inactiveList.items.some((item) => item.id === inactive.id));
  });

  const app = await createTestApp();
  t.after(async () => {
    await app.close();
  });

  const httpRegNo = `H${Date.now()}`.slice(0, 20);
  let httpCreatedCompanyId: string | undefined;

  await t.test('8a. HTTP POST /api/v1/companies returns 201', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/companies',
      headers: { 'content-type': 'application/json' },
      payload: {
        company_name: `HTTP Company ${Date.now()}`,
        business_reg_no: httpRegNo,
      },
    });

    assert.equal(response.statusCode, 201);

    const body = readJsonBody(response.payload);
    assert.equal(typeof body.id, 'string');
    assert.equal(typeof body.company_name, 'string');
    assert.equal(body.business_reg_no, httpRegNo);
    assert.equal(body.is_active, true);

    httpCreatedCompanyId = String(body.id);
    createdCompanyIds.push(httpCreatedCompanyId);
  });

  await t.test('8b. HTTP GET /api/v1/companies/:companyId returns 200', async () => {
    assert.ok(httpCreatedCompanyId);

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/companies/${httpCreatedCompanyId}`,
    });

    assert.equal(response.statusCode, 200);

    const body = readJsonBody(response.payload);
    assert.equal(body.id, httpCreatedCompanyId);
    assert.equal(body.business_reg_no, httpRegNo);
  });

  await t.test('8c. HTTP GET /api/v1/companies returns 200', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/companies?page=1&page_size=20',
    });

    assert.equal(response.statusCode, 200);

    const body = readJsonBody(response.payload) as {
      items: unknown[];
      total: number;
      page: number;
      page_size: number;
    };

    assert.ok(Array.isArray(body.items));
    assert.equal(typeof body.total, 'number');
    assert.equal(body.page, 1);
    assert.equal(body.page_size, 20);
  });

  await t.test('8d. HTTP duplicate business_reg_no returns 409', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/companies',
      headers: { 'content-type': 'application/json' },
      payload: {
        company_name: 'HTTP Duplicate Co',
        business_reg_no: httpRegNo,
      },
    });

    assert.equal(response.statusCode, 409);

    const body = readJsonBody(response.payload);
    assert.equal(typeof body.message, 'string');
  });
});
