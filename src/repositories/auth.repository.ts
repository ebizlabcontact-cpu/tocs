import {
  type CompanyMembership,
  type Prisma,
  type Session,
  type User,
  type UserStatus,
} from '@prisma/client';

import { prisma } from '../lib/prisma.js';

/** Pre-hashed password only — raw passwords must never be passed to the repository. */
export type UserCreateData = Omit<
  Prisma.UserUncheckedCreateInput,
  'id' | 'memberships' | 'sessions' | 'lastLoginAt' | 'createdAt' | 'updatedAt'
>;

export type CompanyMembershipCreateData = Omit<
  Prisma.CompanyMembershipUncheckedCreateInput,
  'id' | 'joinedAt' | 'createdAt' | 'updatedAt'
>;

export type SessionCreateData = Omit<
  Prisma.SessionUncheckedCreateInput,
  'id' | 'revokedAt' | 'createdAt'
>;

export interface UserListParams {
  status?: UserStatus;
  page?: number;
  pageSize?: number;
}

export interface UserListResult {
  items: User[];
  total: number;
  page: number;
  pageSize: number;
}

export class AuthRepository {
  async createUser(data: UserCreateData): Promise<User> {
    return prisma.user.create({ data });
  }

  async findUserById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  async listUsers(params: UserListParams = {}): Promise<UserListResult> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const where = this.buildUserListWhere(params);

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async updateUserLastLoginAt(userId: string, date: Date): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: date },
    });
  }

  async updateUserStatus(userId: string, status: UserStatus): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { status },
    });
  }

  async createCompanyMembership(data: CompanyMembershipCreateData): Promise<CompanyMembership> {
    return prisma.companyMembership.create({ data });
  }

  async findMembershipById(id: string): Promise<CompanyMembership | null> {
    return prisma.companyMembership.findUnique({ where: { id } });
  }

  async listMembershipsByUserId(userId: string): Promise<CompanyMembership[]> {
    return prisma.companyMembership.findMany({
      where: { userId },
      orderBy: [{ joinedAt: 'desc' }, { id: 'asc' }],
    });
  }

  async listMembershipsByCompanyId(companyId: string): Promise<CompanyMembership[]> {
    return prisma.companyMembership.findMany({
      where: { companyId },
      orderBy: [{ joinedAt: 'desc' }, { id: 'asc' }],
    });
  }

  async findActiveMembership(
    userId: string,
    companyId: string,
  ): Promise<CompanyMembership | null> {
    return prisma.companyMembership.findFirst({
      where: { userId, companyId, isActive: true },
    });
  }

  async updateMembershipActive(id: string, isActive: boolean): Promise<CompanyMembership> {
    return prisma.companyMembership.update({
      where: { id },
      data: { isActive },
    });
  }

  async createSession(data: SessionCreateData): Promise<Session> {
    return prisma.session.create({ data });
  }

  async findSessionById(id: string): Promise<Session | null> {
    return prisma.session.findUnique({ where: { id } });
  }

  async findSessionByRefreshTokenHash(refreshTokenHash: string): Promise<Session | null> {
    return prisma.session.findUnique({ where: { refreshTokenHash } });
  }

  async listActiveSessionsByUserId(userId: string): Promise<Session[]> {
    return prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  }

  async revokeSession(id: string, revokedAt: Date): Promise<Session> {
    return prisma.session.update({
      where: { id },
      data: { revokedAt },
    });
  }

  async revokeAllSessionsByUserId(userId: string, revokedAt: Date): Promise<number> {
    const result = await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt },
    });

    return result.count;
  }

  private buildUserListWhere(params: UserListParams): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};

    if (params.status !== undefined) {
      where.status = params.status;
    }

    return where;
  }
}

export const authRepository = new AuthRepository();
