/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import 'dotenv/config';

import { MembershipRole, UserStatus } from '@prisma/client';

import { prisma } from '../lib/prisma.js';
import {
  BOOTSTRAP_AUDIT_ACTION,
  BOOTSTRAP_CHANGED_BY,
  BootstrapAdminError,
  readBootstrapEnv,
  runBootstrapAdmin,
  type BootstrapAdminEnv,
} from '../scripts/bootstrap-admin.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

function buildBootstrapEnv(suffix: number): BootstrapAdminEnv {
  return {
    email: `bootstrap-admin-${suffix}@example.com`,
    password: 'SecurePass!2026',
    name: 'Bootstrap Admin',
    companyName: `Bootstrap Co ${suffix}`,
    companyBusinessNo: `BRN-${suffix}`,
  };
}

test('Bootstrap admin CLI integration', { skip: !hasDatabase }, async (t) => {
  const suffix = Date.now();
  const input = buildBootstrapEnv(suffix);
  let userId: string | undefined;
  let companyId: string | undefined;
  let membershipId: string | undefined;
  let auditLogId: string | undefined;
  let createdCompany = false;

  t.after(async () => {
    if (auditLogId) {
      await prisma.auditLog.deleteMany({ where: { id: auditLogId } }).catch(() => undefined);
    }
    if (membershipId) {
      await prisma.companyMembership
        .deleteMany({ where: { id: membershipId } })
        .catch(() => undefined);
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
    }
    if (createdCompany && companyId) {
      await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  await t.test('readBootstrapEnv fails when required env is missing', () => {
    assert.throws(
      () => readBootstrapEnv({ NODE_ENV: 'test' }),
      (error: unknown) => error instanceof BootstrapAdminError,
    );

    assert.throws(
      () =>
        readBootstrapEnv({
          NODE_ENV: 'production',
          BOOTSTRAP_ADMIN_EMAIL: 'admin@example.com',
        }),
      (error: unknown) => {
        assert.ok(error instanceof BootstrapAdminError);
        assert.match(error.message, /production/i);
        return true;
      },
    );
  });

  await t.test('runBootstrapAdmin creates user, membership, and audit log', async () => {
    const result = await runBootstrapAdmin(input);

    userId = result.userId;
    companyId = result.companyId;
    membershipId = result.membershipId;
    auditLogId = result.auditLogId;
    createdCompany = result.createdCompany;

    assert.equal(result.email, input.email.toLowerCase());
    assert.equal(createdCompany, true);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    assert.equal(user.email, input.email.toLowerCase());
    assert.equal(user.status, UserStatus.ACTIVE);
    assert.equal(user.name, input.name);
    assert.ok(user.passwordHash.startsWith('$argon2id$'));
    assert.notEqual(user.passwordHash, input.password);

    const membership = await prisma.companyMembership.findUniqueOrThrow({
      where: { id: membershipId },
    });
    assert.equal(membership.role, MembershipRole.SUPER_ADMIN);
    assert.equal(membership.isActive, true);
    assert.equal(membership.companyId, companyId);
    assert.equal(membership.userId, userId);

    const auditLog = await prisma.auditLog.findUniqueOrThrow({
      where: { id: auditLogId },
    });
    assert.equal(auditLog.tableName, 'users');
    assert.equal(auditLog.recordId, userId);
    assert.equal(auditLog.action, BOOTSTRAP_AUDIT_ACTION);
    assert.equal(auditLog.changedBy, BOOTSTRAP_CHANGED_BY);
    assert.ok(auditLog.newData !== null);
    assert.equal(JSON.stringify(auditLog.newData), JSON.stringify(auditLog.newData));
    assert.doesNotMatch(JSON.stringify(auditLog.newData), new RegExp(input.password, 'i'));
    assert.doesNotMatch(JSON.stringify(auditLog.newData), /password_hash/i);
  });

  await t.test('runBootstrapAdmin rejects duplicate bootstrap', async () => {
    await assert.rejects(
      () => runBootstrapAdmin(input),
      (error: unknown) => {
        assert.ok(error instanceof BootstrapAdminError);
        assert.match(error.message, /already exists|SUPER_ADMIN/i);
        return true;
      },
    );
  });
});
