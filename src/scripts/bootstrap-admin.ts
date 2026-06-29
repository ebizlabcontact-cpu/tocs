import path from 'node:path';
import { fileURLToPath } from 'node:url';

import 'dotenv/config';

import { MembershipRole, UserStatus, type Company, type PrismaClient } from '@prisma/client';

import { prisma } from '../lib/prisma.js';
import {
  AuthRepository,
  authRepository,
} from '../repositories/auth.repository.js';
import {
  CompanyRepository,
  companyRepository,
} from '../repositories/company.repository.js';
import {
  CredentialService,
  credentialService,
} from '../services/credential.service.js';

/** audit_logs.action is VARCHAR(20); BOOTSTRAP_SUPER_ADMIN (22) does not fit. */
export const BOOTSTRAP_AUDIT_ACTION = 'BOOTSTRAP_SUPERADM';
export const BOOTSTRAP_CHANGED_BY = 'system/bootstrap';

const REQUIRED_ENV_KEYS = [
  'BOOTSTRAP_ADMIN_EMAIL',
  'BOOTSTRAP_ADMIN_PASSWORD',
  'BOOTSTRAP_ADMIN_NAME',
  'BOOTSTRAP_COMPANY_NAME',
] as const;

export interface BootstrapAdminEnv {
  email: string;
  password: string;
  name: string;
  companyName: string;
  companyBusinessNo?: string;
}

export interface BootstrapAdminResult {
  userId: string;
  email: string;
  companyId: string;
  membershipId: string;
  auditLogId: string;
  createdCompany: boolean;
}

export class BootstrapAdminError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = 'BootstrapAdminError';
    this.exitCode = exitCode;
  }
}

export interface BootstrapAdminDeps {
  authRepository: AuthRepository;
  companyRepository: CompanyRepository;
  credentialService: CredentialService;
  prismaClient: PrismaClient;
}

const defaultDeps: BootstrapAdminDeps = {
  authRepository,
  companyRepository,
  credentialService,
  prismaClient: prisma,
};

function isNonEmpty(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== '';
}

export function readBootstrapEnv(
  env: NodeJS.ProcessEnv = process.env,
): BootstrapAdminEnv {
  const isProduction = env.NODE_ENV === 'production';
  const missing: string[] = [];

  for (const key of REQUIRED_ENV_KEYS) {
    if (!isNonEmpty(env[key])) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const prefix = isProduction
      ? 'Bootstrap refused in production: missing required environment variables'
      : 'Missing required environment variables';
    throw new BootstrapAdminError(`${prefix}: ${missing.join(', ')}`);
  }

  const companyBusinessNo = env.BOOTSTRAP_COMPANY_BUSINESS_NO?.trim();

  const config: BootstrapAdminEnv = {
    email: env.BOOTSTRAP_ADMIN_EMAIL!.trim(),
    password: env.BOOTSTRAP_ADMIN_PASSWORD!,
    name: env.BOOTSTRAP_ADMIN_NAME!.trim(),
    companyName: env.BOOTSTRAP_COMPANY_NAME!.trim(),
  };

  if (companyBusinessNo !== undefined && companyBusinessNo !== '') {
    config.companyBusinessNo = companyBusinessNo;
  }

  return config;
}

async function findExistingCompany(
  deps: BootstrapAdminDeps,
  input: BootstrapAdminEnv,
): Promise<Company | null> {
  if (input.companyBusinessNo !== undefined) {
    return deps.companyRepository.findCompanyByBusinessRegNo(input.companyBusinessNo);
  }

  return deps.prismaClient.company.findFirst({
    where: { companyName: input.companyName },
    orderBy: { createdAt: 'asc' },
  });
}

async function assertBootstrapAllowed(
  deps: BootstrapAdminDeps,
  normalizedEmail: string,
): Promise<void> {
  const existingUser = await deps.authRepository.findUserByEmail(normalizedEmail);

  if (existingUser) {
    throw new BootstrapAdminError(
      `Bootstrap aborted: user already exists for email ${normalizedEmail}`,
    );
  }

  const existingSuperAdmin = await deps.prismaClient.companyMembership.findFirst({
    where: {
      role: MembershipRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  if (existingSuperAdmin) {
    throw new BootstrapAdminError(
      'Bootstrap aborted: an active SUPER_ADMIN membership already exists',
    );
  }
}

export async function runBootstrapAdmin(
  input: BootstrapAdminEnv,
  deps: BootstrapAdminDeps = defaultDeps,
): Promise<BootstrapAdminResult> {
  const normalizedEmail = deps.credentialService.normalizeLoginEmail(input.email);
  await assertBootstrapAllowed(deps, normalizedEmail);

  const passwordHash = await deps.credentialService.hashPasswordForStorage(input.password, {
    email: normalizedEmail,
    companyName: input.companyName,
  });

  let company = await findExistingCompany(deps, input);
  let createdCompany = false;

  if (!company) {
    company = await deps.companyRepository.createCompany({
      companyName: input.companyName,
      isActive: true,
      ...(input.companyBusinessNo !== undefined
        ? { businessRegNo: input.companyBusinessNo }
        : {}),
    });
    createdCompany = true;
  }

  const result = await deps.prismaClient.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: input.name,
        status: UserStatus.ACTIVE,
      },
    });

    const membership = await tx.companyMembership.create({
      data: {
        companyId: company!.id,
        userId: user.id,
        role: MembershipRole.SUPER_ADMIN,
        isActive: true,
      },
    });

    const auditLog = await tx.auditLog.create({
      data: {
        tableName: 'users',
        recordId: user.id,
        action: BOOTSTRAP_AUDIT_ACTION,
        changedBy: BOOTSTRAP_CHANGED_BY,
        newData: {
          email: normalizedEmail,
          company_id: company!.id,
          membership_role: MembershipRole.SUPER_ADMIN,
        },
      },
    });

    return {
      userId: user.id,
      email: normalizedEmail,
      companyId: company!.id,
      membershipId: membership.id,
      auditLogId: auditLog.id,
      createdCompany,
    };
  });

  return result;
}

async function main(): Promise<void> {
  const input = readBootstrapEnv();
  const result = await runBootstrapAdmin(input);

  console.info(`Bootstrap completed for ${result.email}`);
}

const modulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (modulePath === invokedPath) {
  main()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (error: unknown) => {
      const message =
        error instanceof BootstrapAdminError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Bootstrap failed';

      console.error(message);
      await prisma.$disconnect();
      process.exit(error instanceof BootstrapAdminError ? error.exitCode : 1);
    });
}
