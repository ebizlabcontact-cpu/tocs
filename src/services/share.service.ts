import { Prisma, type Share } from '@prisma/client';

import {
  ShareRepository,
  shareRepository,
} from '../repositories/share.repository.js';
import type { ShareCreateData, ShareUpdateData } from '../repositories/share.repository.js';
import type { CompanyScopeFilter } from '../types/company-scope.types.js';
import { assertFormulaCompanyScope } from './formula.service.js';
import { assertNotClosedForTradeMutation } from './guards/closed-formula.guard.js';
import {
  VersionService,
  versionService as defaultVersionService,
} from './version.service.js';
import type {
  CreateVersionCalculationInput,
  CreateVersionInput,
  CreateVersionResult,
} from './version.service.js';

export class ShareNotFoundError extends Error {
  constructor(id: string) {
    super(`Share not found: ${id}`);
    this.name = 'ShareNotFoundError';
  }
}

export class ShareVersionRequiredError extends Error {
  constructor(message = 'Version calculation and snapshot data are required for share mutation') {
    super(message);
    this.name = 'ShareVersionRequiredError';
  }
}

export interface ShareVersionPayload {
  changedBy?: string | null;
  changeReason?: string | null;
  snapshot: Prisma.InputJsonValue;
  calculation: CreateVersionCalculationInput;
}

export interface CreateShareInput {
  share: ShareCreateData;
  version: ShareVersionPayload;
}

export interface UpdateShareInput {
  data: ShareUpdateData;
  version: ShareVersionPayload;
}

export interface ShareMutationResult {
  share: Share;
  version: CreateVersionResult;
}

function assertShareVersionPayload(
  version: ShareVersionPayload | undefined,
): ShareVersionPayload {
  if (!version) {
    throw new ShareVersionRequiredError();
  }

  if (version.snapshot === undefined || version.snapshot === null) {
    throw new ShareVersionRequiredError('Version snapshot is required for share mutation');
  }

  if (!version.calculation) {
    throw new ShareVersionRequiredError('Version calculation is required for share mutation');
  }

  return version;
}

export class ShareService {
  constructor(
    private readonly repository: ShareRepository = shareRepository,
    private readonly versionService: VersionService = defaultVersionService,
  ) {}

  async createShare(input: CreateShareInput): Promise<ShareMutationResult> {
    await assertNotClosedForTradeMutation(input.share.formulaId);

    const versionPayload = assertShareVersionPayload(input.version);
    const share = await this.repository.createShare(input.share);
    const version = await this.versionService.createVersion(
      this.toCreateVersionInput(share.formulaId, versionPayload),
    );

    return { share, version };
  }

  async getShareById(id: string): Promise<Share> {
    const share = await this.repository.findShareById(id);

    if (!share) {
      throw new ShareNotFoundError(id);
    }

    return share;
  }

  async listSharesByFormulaId(formulaId: string, companyScope?: CompanyScopeFilter): Promise<Share[]> {
    await assertFormulaCompanyScope(formulaId, companyScope);
    return this.repository.listSharesByFormulaId(formulaId);
  }

  async listSharesByParticipantId(participantId: string): Promise<Share[]> {
    return this.repository.listSharesByParticipantId(participantId);
  }

  async updateShare(id: string, input: UpdateShareInput): Promise<ShareMutationResult> {
    const existing = await this.repository.findShareById(id);

    if (!existing) {
      throw new ShareNotFoundError(id);
    }

    await assertNotClosedForTradeMutation(existing.formulaId);

    const versionPayload = assertShareVersionPayload(input.version);
    const share = await this.repository.updateShare(id, input.data);
    const version = await this.versionService.createVersion(
      this.toCreateVersionInput(existing.formulaId, versionPayload),
    );

    return { share, version };
  }

  async deleteShare(id: string, version: ShareVersionPayload): Promise<ShareMutationResult> {
    const existing = await this.repository.findShareById(id);

    if (!existing) {
      throw new ShareNotFoundError(id);
    }

    await assertNotClosedForTradeMutation(existing.formulaId);

    const versionPayload = assertShareVersionPayload(version);
    const formulaId = existing.formulaId;
    const share = await this.repository.deleteShare(id);
    const versionResult = await this.versionService.createVersion(
      this.toCreateVersionInput(formulaId, versionPayload),
    );

    return { share, version: versionResult };
  }

  private toCreateVersionInput(
    formulaId: string,
    version: ShareVersionPayload,
  ): CreateVersionInput {
    const input: CreateVersionInput = {
      formulaId,
      snapshot: version.snapshot,
      calculation: version.calculation,
    };

    if (version.changedBy !== undefined) input.changedBy = version.changedBy;
    if (version.changeReason !== undefined) input.changeReason = version.changeReason;

    return input;
  }
}

export const shareService = new ShareService();
