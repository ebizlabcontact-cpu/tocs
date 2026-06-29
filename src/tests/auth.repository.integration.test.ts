/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import 'dotenv/config';

import { MembershipRole, Prisma, UserStatus } from '@prisma/client';

import { prisma } from '../lib/prisma.js';
import { authRepository } from '../repositories/auth.repository.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const fakePasswordHash = '$argon2id$v=19$m=65536,t=3,p=4$test$testhash';

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

test('Auth repository integration', { skip: !hasDatabase }, async (t) => {
  const suffix = Date.now();
  let companyId: string | undefined;
  let userId: string | undefined;
  let secondUserId: string | undefined;
  let membershipId: string | undefined;
  let sessionId: string | undefined;
  let revokedSessionId: string | undefined;

  t.after(async () => {
    if (sessionId) {
      await prisma.session.deleteMany({ where: { id: sessionId } }).catch(() => undefined);
    }
    if (revokedSessionId) {
      await prisma.session
        .deleteMany({ where: { id: revokedSessionId } })
        .catch(() => undefined);
    }
    if (membershipId) {
      await prisma.companyMembership
        .deleteMany({ where: { id: membershipId } })
        .catch(() => undefined);
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
    }
    if (secondUserId) {
      await prisma.user.deleteMany({ where: { id: secondUserId } }).catch(() => undefined);
    }
    if (companyId) {
      await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  const company = await prisma.company.create({
    data: {
      companyName: `Auth Repo Test Co ${suffix}`,
      isActive: true,
    },
  });
  companyId = company.id;

  const email = `auth-repo-${suffix}@example.com`;

  const user = await authRepository.createUser({
    email,
    passwordHash: fakePasswordHash,
    name: 'Auth Repo User',
    status: UserStatus.ACTIVE,
  });
  userId = user.id;

  assert.equal(user.email, email);

  const byId = await authRepository.findUserById(user.id);
  assert.ok(byId);
  assert.equal(byId.id, user.id);

  const byEmail = await authRepository.findUserByEmail(email);
  assert.ok(byEmail);
  assert.equal(byEmail.id, user.id);

  assert.equal(await authRepository.findUserById('00000000-0000-0000-0000-000000000099'), null);
  assert.equal(await authRepository.findUserByEmail('missing@example.com'), null);

  await assert.rejects(
    () =>
      authRepository.createUser({
        email,
        passwordHash: fakePasswordHash,
      }),
    (error: unknown) => isUniqueViolation(error),
  );

  const loginAt = new Date('2026-06-23T12:00:00.000Z');
  const afterLogin = await authRepository.updateUserLastLoginAt(user.id, loginAt);
  assert.equal(afterLogin.lastLoginAt?.toISOString(), loginAt.toISOString());

  const afterStatus = await authRepository.updateUserStatus(user.id, UserStatus.LOCKED);
  assert.equal(afterStatus.status, UserStatus.LOCKED);

  await authRepository.updateUserStatus(user.id, UserStatus.ACTIVE);

  const listResult = await authRepository.listUsers({
    status: UserStatus.ACTIVE,
    page: 1,
    pageSize: 50,
  });
  assert.ok(listResult.items.some((row) => row.id === user.id));
  assert.ok(listResult.total >= 1);

  const membership = await authRepository.createCompanyMembership({
    companyId: company.id,
    userId: user.id,
    role: MembershipRole.MANAGER,
    isActive: true,
  });
  membershipId = membership.id;

  const membershipById = await authRepository.findMembershipById(membership.id);
  assert.ok(membershipById);
  assert.equal(membershipById.role, MembershipRole.MANAGER);

  const activeMembership = await authRepository.findActiveMembership(user.id, company.id);
  assert.ok(activeMembership);
  assert.equal(activeMembership.id, membership.id);

  const userMemberships = await authRepository.listMembershipsByUserId(user.id);
  assert.equal(userMemberships.length, 1);
  assert.equal(userMemberships[0]?.id, membership.id);

  const companyMemberships = await authRepository.listMembershipsByCompanyId(company.id);
  assert.ok(companyMemberships.some((row) => row.id === membership.id));

  await assert.rejects(
    () =>
      authRepository.createCompanyMembership({
        companyId: company.id,
        userId: user.id,
        role: MembershipRole.VIEWER,
      }),
    (error: unknown) => isUniqueViolation(error),
  );

  const inactiveMembership = await authRepository.updateMembershipActive(membership.id, false);
  assert.equal(inactiveMembership.isActive, false);
  assert.equal(await authRepository.findActiveMembership(user.id, company.id), null);

  await authRepository.updateMembershipActive(membership.id, true);

  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const expiredAt = new Date(Date.now() - 60_000);

  const session = await authRepository.createSession({
    userId: user.id,
    refreshTokenHash: `repo-refresh-${suffix}-active`,
    expiresAt,
  });
  sessionId = session.id;

  const revokedSession = await authRepository.createSession({
    userId: user.id,
    refreshTokenHash: `repo-refresh-${suffix}-revoked`,
    expiresAt,
  });
  revokedSessionId = revokedSession.id;

  await authRepository.createSession({
    userId: user.id,
    refreshTokenHash: `repo-refresh-${suffix}-expired`,
    expiresAt: expiredAt,
  });

  const sessionById = await authRepository.findSessionById(session.id);
  assert.ok(sessionById);

  const sessionByHash = await authRepository.findSessionByRefreshTokenHash(
    `repo-refresh-${suffix}-active`,
  );
  assert.ok(sessionByHash);
  assert.equal(sessionByHash.id, session.id);

  const activeSessions = await authRepository.listActiveSessionsByUserId(user.id);
  assert.equal(activeSessions.length, 2);
  assert.ok(activeSessions.every((row) => row.revokedAt === null));

  const revokedAt = new Date('2026-06-23T13:00:00.000Z');
  const afterRevoke = await authRepository.revokeSession(revokedSession.id, revokedAt);
  assert.equal(afterRevoke.revokedAt?.toISOString(), revokedAt.toISOString());

  const activeAfterSingleRevoke = await authRepository.listActiveSessionsByUserId(user.id);
  assert.equal(activeAfterSingleRevoke.length, 1);
  assert.equal(activeAfterSingleRevoke[0]?.id, session.id);

  const revokeAllCount = await authRepository.revokeAllSessionsByUserId(user.id, revokedAt);
  assert.equal(revokeAllCount, 2);

  const activeAfterRevokeAll = await authRepository.listActiveSessionsByUserId(user.id);
  assert.equal(activeAfterRevokeAll.length, 0);

  const secondUser = await authRepository.createUser({
    email: `auth-repo-second-${suffix}@example.com`,
    passwordHash: fakePasswordHash,
  });
  secondUserId = secondUser.id;

  await authRepository.createSession({
    userId: secondUser.id,
    refreshTokenHash: `repo-refresh-${suffix}-second-user`,
    expiresAt,
  });

  await prisma.user.delete({ where: { id: user.id } });
  userId = undefined;
  membershipId = undefined;
  sessionId = undefined;
  revokedSessionId = undefined;

  assert.equal(await authRepository.findUserById(user.id), null);
  assert.equal(await authRepository.findMembershipById(membership.id), null);
  assert.equal(await authRepository.findSessionById(session.id), null);

  const secondUserSessions = await authRepository.listActiveSessionsByUserId(secondUser.id);
  assert.equal(secondUserSessions.length, 1);
});
