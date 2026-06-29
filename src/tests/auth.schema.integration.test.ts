/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import 'dotenv/config';

import { MembershipRole, Prisma, UserStatus } from '@prisma/client';

import { prisma } from '../lib/prisma.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const fakePasswordHash = '$argon2id$v=19$m=65536,t=3,p=4$test$testhash';

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';
}

test('Auth schema constraints and cascades', { skip: !hasDatabase }, async (t) => {
  const suffix = Date.now();
  let companyId: string | undefined;
  let userId: string | undefined;
  let membershipId: string | undefined;
  let sessionId: string | undefined;

  t.after(async () => {
    if (sessionId) {
      await prisma.session.deleteMany({ where: { id: sessionId } }).catch(() => undefined);
    }
    if (membershipId) {
      await prisma.companyMembership
        .deleteMany({ where: { id: membershipId } })
        .catch(() => undefined);
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
    }
    if (companyId) {
      await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  const company = await prisma.company.create({
    data: {
      companyName: `Auth Schema Test Co ${suffix}`,
      isActive: true,
    },
  });
  companyId = company.id;

  const user = await prisma.user.create({
    data: {
      email: `auth-schema-${suffix}@example.com`,
      passwordHash: fakePasswordHash,
      name: 'Auth Schema User',
      status: UserStatus.ACTIVE,
    },
  });
  userId = user.id;

  assert.equal(user.email, `auth-schema-${suffix}@example.com`);
  assert.equal(user.status, UserStatus.ACTIVE);
  assert.ok(user.passwordHash.length > 0);

  await assert.rejects(
    () =>
      prisma.user.create({
        data: {
          email: `auth-schema-${suffix}@example.com`,
          passwordHash: fakePasswordHash,
        },
      }),
    (error: unknown) => isUniqueViolation(error),
  );

  const membership = await prisma.companyMembership.create({
    data: {
      companyId: company.id,
      userId: user.id,
      role: MembershipRole.MANAGER,
      isActive: true,
    },
  });
  membershipId = membership.id;

  assert.equal(membership.role, MembershipRole.MANAGER);

  await assert.rejects(
    () =>
      prisma.companyMembership.create({
        data: {
          companyId: company.id,
          userId: user.id,
          role: MembershipRole.VIEWER,
        },
      }),
    (error: unknown) => isUniqueViolation(error),
  );

  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: `refresh-hash-${suffix}-a`,
      expiresAt,
    },
  });
  sessionId = session.id;

  await assert.rejects(
    () =>
      prisma.session.create({
        data: {
          userId: user.id,
          refreshTokenHash: `refresh-hash-${suffix}-a`,
          expiresAt,
        },
      }),
    (error: unknown) => isUniqueViolation(error),
  );

  await assert.rejects(
    () => prisma.company.delete({ where: { id: company.id } }),
    (error: unknown) => isForeignKeyViolation(error),
  );

  await prisma.user.delete({ where: { id: user.id } });
  userId = undefined;
  membershipId = undefined;
  sessionId = undefined;

  const sessionsAfterUserDelete = await prisma.session.count({
    where: { userId: user.id },
  });
  assert.equal(sessionsAfterUserDelete, 0);

  const membershipsAfterUserDelete = await prisma.companyMembership.count({
    where: { userId: user.id },
  });
  assert.equal(membershipsAfterUserDelete, 0);
});
