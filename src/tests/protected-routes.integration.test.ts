/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import 'dotenv/config';

import {
  MembershipRole,
  RoleGroup,
  TradeType,
  UserStatus,
} from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import { RBAC_AUTHENTICATION_REQUIRED, RBAC_FORBIDDEN } from '../http/plugins/rbac.js';
import { prisma } from '../lib/prisma.js';
import { authRepository } from '../repositories/auth.repository.js';
import { AuthService } from '../services/auth.service.js';
import { GENERIC_LOGIN_ERROR, credentialService } from '../services/credential.service.js';
import { TokenService } from '../services/token.service.js';
import {
  bearerHeaders,
  createTestAuthFixture,
  deleteTestAuthFixture,
  TEST_AUTH_PASSWORD,
  withBearer,
} from './helpers/http-auth.helper.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const defaultCancelBody = {
  cancel_reason: 'protected routes integration test',
  changed_by: 'protected.routes.integration.test',
};

function readJsonBody(payload: string): Record<string, unknown> {
  return JSON.parse(payload) as Record<string, unknown>;
}

async function createTestApp(): Promise<FastifyInstance> {
  const { createServer } = await import('../http/server.js');
  return createServer();
}

async function issueTokenForEmail(email: string): Promise<string> {
  const authService = new AuthService(authRepository, credentialService);
  const tokenService = new TokenService();
  const principal = await authService.login({ email, password: TEST_AUTH_PASSWORD });
  return tokenService.issueAccessToken(principal);
}

test('Protected routes integration', { skip: !hasDatabase }, async (t) => {
  const suffix = Date.now();
  let itemId: string | undefined;
  let formulaId: string | undefined;
  let participantId: string | undefined;
  const fixtures: Array<Awaited<ReturnType<typeof createTestAuthFixture>>> = [];
  let suspendedUserId: string | undefined;
  let lockedUserId: string | undefined;

  const viewerFixture = await createTestAuthFixture(
    MembershipRole.VIEWER,
    `protected-viewer-${suffix}`,
  );
  const managerFixture = await createTestAuthFixture(
    MembershipRole.MANAGER,
    `protected-manager-${suffix}`,
  );
  const companyAdminFixture = await createTestAuthFixture(
    MembershipRole.COMPANY_ADMIN,
    `protected-admin-${suffix}`,
  );
  fixtures.push(viewerFixture, managerFixture, companyAdminFixture);

  const sharedCompanyId = viewerFixture.companyId;

  t.after(async () => {
    if (participantId) {
      await prisma.formulaParticipant
        .deleteMany({ where: { id: participantId } })
        .catch(() => undefined);
    }
    if (formulaId) {
      await prisma.formula.deleteMany({ where: { id: formulaId } }).catch(() => undefined);
    }
    if (itemId) {
      await prisma.item.deleteMany({ where: { id: itemId } }).catch(() => undefined);
    }
    for (const fixture of fixtures) {
      await deleteTestAuthFixture(fixture);
    }
    if (suspendedUserId) {
      await prisma.user.deleteMany({ where: { id: suspendedUserId } }).catch(() => undefined);
    }
    if (lockedUserId) {
      await prisma.user.deleteMany({ where: { id: lockedUserId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  const item = await prisma.item.create({
    data: {
      itemCode: `PROTECTED-ROUTE-${suffix}`,
      itemName: 'Protected Route Test Item',
      defaultUnit: 'kg',
      isActive: true,
    },
  });
  itemId = item.id;

  const formula = await prisma.formula.create({
    data: {
      tradeType: TradeType.DOMESTIC,
      itemId: item.id,
      quantity: 1000,
      unit: 'kg',
      content: 'protected route test formula',
      createdBy: 'protected.routes.integration.test',
    },
  });
  formulaId = formula.id;

  const participant = await prisma.formulaParticipant.create({
    data: {
      formulaId: formula.id,
      companyId: sharedCompanyId,
      sequenceOrder: 1,
      roleGroup: RoleGroup.SUPPLIER,
      quantity: 1000,
      buyUnitPrice: 0,
      sellUnitPrice: 100,
      isStartPoint: true,
      isEndPoint: true,
    },
  });
  participantId = participant.id;

  await authRepository.createCompanyMembership({
    companyId: sharedCompanyId,
    userId: managerFixture.userId,
    role: MembershipRole.MANAGER,
    isActive: true,
  });
  await authRepository.createCompanyMembership({
    companyId: sharedCompanyId,
    userId: companyAdminFixture.userId,
    role: MembershipRole.COMPANY_ADMIN,
    isActive: true,
  });

  const tokenService = new TokenService();
  const authService = new AuthService(authRepository, credentialService);

  const viewerToken = await issueTokenForEmail(viewerFixture.email);
  const managerToken = await issueTokenForEmail(managerFixture.email);
  const companyAdminToken = await issueTokenForEmail(companyAdminFixture.email);

  const lockoutEmail = `protected-locked-${suffix}@example.com`;
  const lockoutPasswordHash = await credentialService.hashPasswordForStorage(
    TEST_AUTH_PASSWORD,
    { email: lockoutEmail },
  );
  const lockoutUser = await authRepository.createUser({
    email: lockoutEmail,
    passwordHash: lockoutPasswordHash,
    name: 'Locked Protected Route User',
    status: UserStatus.ACTIVE,
  });
  lockedUserId = lockoutUser.id;
  await authRepository.createCompanyMembership({
    companyId: sharedCompanyId,
    userId: lockoutUser.id,
    role: MembershipRole.MANAGER,
    isActive: true,
  });

  const lockedToken = await issueTokenForEmail(lockoutEmail);

  let lockedDbUser = await authRepository.findUserById(lockoutUser.id);
  assert.ok(lockedDbUser);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    lockedDbUser = await credentialService.recordFailedLoginAttempt(lockedDbUser);
  }
  assert.equal(lockedDbUser.status, UserStatus.LOCKED);
  assert.equal(credentialService.isAccountLocked(lockoutUser.id), true);

  const suspendedEmail = `protected-suspended-${suffix}@example.com`;
  const suspendedPasswordHash = await credentialService.hashPasswordForStorage(
    TEST_AUTH_PASSWORD,
    { email: suspendedEmail },
  );
  const suspendedUser = await authRepository.createUser({
    email: suspendedEmail,
    passwordHash: suspendedPasswordHash,
    name: 'Suspended Protected Route User',
    status: UserStatus.SUSPENDED,
  });
  suspendedUserId = suspendedUser.id;
  await authRepository.createCompanyMembership({
    companyId: sharedCompanyId,
    userId: suspendedUser.id,
    role: MembershipRole.VIEWER,
    isActive: true,
  });
  const suspendedCurrent = await authService.getCurrentUser(suspendedUser.id);
  const suspendedToken = tokenService.issueAccessToken({
    user: suspendedCurrent.user,
    memberships: suspendedCurrent.memberships,
    roles: suspendedCurrent.roles,
  });

  const app = await createTestApp();
  t.after(async () => {
    await app.close();
  });

  await t.test('GET /api/v1/health remains public', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    assert.equal(response.statusCode, 200);
    assert.equal(readJsonBody(response.payload).ok, true);
  });

  await t.test('business route without token returns 401', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/formulas/${formulaId}`,
    });

    assert.equal(response.statusCode, 401);
    assert.equal(readJsonBody(response.payload).message, RBAC_AUTHENTICATION_REQUIRED);
  });

  await t.test('VIEWER can read formula route', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/formulas/${formulaId}`,
      headers: bearerHeaders(viewerToken),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(readJsonBody(response.payload).id, formulaId);
  });

  await t.test('VIEWER mutation is denied with 403', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/formulas/${formulaId}`,
      headers: withBearer(viewerToken, { 'content-type': 'application/json' }),
      payload: { note: 'viewer patch attempt' },
    });

    assert.equal(response.statusCode, 403);
    assert.equal(readJsonBody(response.payload).message, RBAC_FORBIDDEN);
  });

  await t.test('MANAGER operational mutation is allowed', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/formulas/${formulaId}`,
      headers: withBearer(managerToken, { 'content-type': 'application/json' }),
      payload: { note: 'manager patch ok' },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(readJsonBody(response.payload).note, 'manager patch ok');
  });

  await t.test('COMPANY_ADMIN sensitive cancel route is allowed', async () => {
    const cancelFormula = await prisma.formula.create({
      data: {
        tradeType: TradeType.DOMESTIC,
        itemId: item.id,
        quantity: 500,
        unit: 'kg',
        content: 'admin cancel formula',
        createdBy: 'protected.routes.integration.test',
      },
    });

    await prisma.formulaParticipant.create({
      data: {
        formulaId: cancelFormula.id,
        companyId: sharedCompanyId,
        sequenceOrder: 1,
        roleGroup: RoleGroup.SUPPLIER,
        quantity: 500,
        buyUnitPrice: 0,
        sellUnitPrice: 100,
        isStartPoint: true,
        isEndPoint: true,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/formulas/${cancelFormula.id}/cancel`,
      headers: withBearer(companyAdminToken, { 'content-type': 'application/json' }),
      payload: defaultCancelBody,
    });

    assert.equal(response.statusCode, 200);

    await prisma.formula.deleteMany({ where: { id: cancelFormula.id } }).catch(() => undefined);
  });

  await t.test('MANAGER sensitive cancel route is denied with 403', async () => {
    const cancelFormula = await prisma.formula.create({
      data: {
        tradeType: TradeType.DOMESTIC,
        itemId: item.id,
        quantity: 500,
        unit: 'kg',
        content: 'manager cancel denied formula',
        createdBy: 'protected.routes.integration.test',
      },
    });

    await prisma.formulaParticipant.create({
      data: {
        formulaId: cancelFormula.id,
        companyId: sharedCompanyId,
        sequenceOrder: 1,
        roleGroup: RoleGroup.SUPPLIER,
        quantity: 500,
        buyUnitPrice: 0,
        sellUnitPrice: 100,
        isStartPoint: true,
        isEndPoint: true,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/formulas/${cancelFormula.id}/cancel`,
      headers: withBearer(managerToken, { 'content-type': 'application/json' }),
      payload: defaultCancelBody,
    });

    assert.equal(response.statusCode, 403);
    assert.equal(readJsonBody(response.payload).message, RBAC_FORBIDDEN);

    await prisma.formula.deleteMany({ where: { id: cancelFormula.id } }).catch(() => undefined);
  });

  await t.test('invalid access token returns 401', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/formulas/${formulaId}`,
      headers: bearerHeaders('not-a-valid-token'),
    });

    assert.equal(response.statusCode, 401);
    assert.equal(readJsonBody(response.payload).message, 'Invalid access token');
  });

  await t.test('suspended user returns 403 on protected route', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/formulas/${formulaId}`,
      headers: bearerHeaders(suspendedToken),
    });

    assert.equal(response.statusCode, 403);
    assert.equal(readJsonBody(response.payload).message, GENERIC_LOGIN_ERROR);
  });

  await t.test('locked user returns 423 on protected route', async () => {
    const preCheckUser = await authRepository.findUserById(lockoutUser.id);
    assert.equal(preCheckUser?.status, UserStatus.LOCKED);
    assert.equal(credentialService.isAccountLocked(lockoutUser.id), true);

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/formulas/${formulaId}`,
      headers: bearerHeaders(lockedToken),
    });

    assert.equal(response.statusCode, 423);
    assert.equal(readJsonBody(response.payload).message, GENERIC_LOGIN_ERROR);
  });

  await t.test('GET /api/v1/auth/me without token returns 401', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
    });

    assert.equal(response.statusCode, 401);
    assert.equal(readJsonBody(response.payload).message, RBAC_AUTHENTICATION_REQUIRED);
  });

  await t.test('GET /api/v1/auth/me with token returns 200', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: bearerHeaders(viewerToken),
    });

    assert.equal(response.statusCode, 200);
    assert.equal((readJsonBody(response.payload).user as Record<string, unknown>).email, viewerFixture.email);
  });
});
