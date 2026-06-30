import {
  NatureGroup,
  PaymentGroup,
  Prisma,
  RoleGroup,
  type FormulaParticipant,
} from '@prisma/client';

import {
  ParticipantRepository,
  participantRepository,
} from '../repositories/participant.repository.js';
import type { ParticipantCreateData } from '../repositories/participant.repository.js';
import type { CompanyScopeFilter } from '../types/company-scope.types.js';
import { resolveScopeCompanyId } from '../utils/company-scope.js';
import {
  FormulaRepository,
  formulaRepository,
} from '../repositories/formula.repository.js';
import { CompanyService, companyService } from './company.service.js';
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

export class ParticipantNotFoundError extends Error {
  readonly status = 404 as const;

  constructor(id: string) {
    super(`Participant not found: ${id}`);
    this.name = 'ParticipantNotFoundError';
  }
}

export class ParticipantSequenceConflictError extends Error {
  readonly status = 409 as const;

  constructor(formulaId: string, sequenceOrder: number) {
    super(
      `Participant sequence_order already exists for formula: ${formulaId}, sequence_order: ${sequenceOrder}`,
    );
    this.name = 'ParticipantSequenceConflictError';
  }
}

export class ParticipantStartPointConflictError extends Error {
  readonly status = 409 as const;

  constructor(formulaId: string) {
    super(`Participant start point already exists for formula: ${formulaId}`);
    this.name = 'ParticipantStartPointConflictError';
  }
}

export class ParticipantEndPointConflictError extends Error {
  readonly status = 409 as const;

  constructor(formulaId: string) {
    super(`Participant end point already exists for formula: ${formulaId}`);
    this.name = 'ParticipantEndPointConflictError';
  }
}

export interface ParticipantVersionPayload {
  changedBy: string;
  changeReason: string;
  snapshot: Prisma.InputJsonValue;
  calculation: CreateVersionCalculationInput;
}

export interface CreateParticipantInput {
  formulaId: string;
  companyId: string;
  sequenceOrder: number;
  roleGroup: RoleGroup;
  version: ParticipantVersionPayload;
  natureGroup?: NatureGroup;
  paymentGroup?: PaymentGroup;
  buyUnitPrice?: Prisma.Decimal | number | string;
  sellUnitPrice?: Prisma.Decimal | number | string;
  quantity?: Prisma.Decimal | number | string;
  directCostAmount?: Prisma.Decimal | number | string;
  isStartPoint?: boolean;
  isEndPoint?: boolean;
  memo?: string | null;
}

export interface CreateParticipantResult {
  participant: FormulaParticipant;
  version: CreateVersionResult;
}

export class ParticipantService {
  constructor(
    private readonly repository: ParticipantRepository,
    private readonly versionService: VersionService,
    private readonly formulaRepository: FormulaRepository,
    private readonly companyService: CompanyService,
  ) {}

  async createParticipant(input: CreateParticipantInput): Promise<CreateParticipantResult> {
    await assertNotClosedForTradeMutation(input.formulaId);

    const formula = await this.formulaRepository.findById(input.formulaId);

    if (!formula) {
      const { FormulaNotFoundError } = await import('./formula.service.js');
      throw new FormulaNotFoundError(`Formula not found: ${input.formulaId}`);
    }

    await this.companyService.getCompanyById(input.companyId);

    const existingSequence = await this.repository.findParticipantByFormulaAndSequence(
      input.formulaId,
      input.sequenceOrder,
    );

    if (existingSequence) {
      throw new ParticipantSequenceConflictError(input.formulaId, input.sequenceOrder);
    }

    if (input.isStartPoint === true) {
      const existingStartPoint = await this.repository.findStartPointByFormulaId(input.formulaId);

      if (existingStartPoint) {
        throw new ParticipantStartPointConflictError(input.formulaId);
      }
    }

    if (input.isEndPoint === true) {
      const existingEndPoint = await this.repository.findEndPointByFormulaId(input.formulaId);

      if (existingEndPoint) {
        throw new ParticipantEndPointConflictError(input.formulaId);
      }
    }

    const quantity = input.quantity !== undefined ? input.quantity : formula.quantity;

    const data: ParticipantCreateData = {
      formulaId: input.formulaId,
      companyId: input.companyId,
      sequenceOrder: input.sequenceOrder,
      roleGroup: input.roleGroup,
      quantity,
    };

    if (input.natureGroup !== undefined) data.natureGroup = input.natureGroup;
    if (input.paymentGroup !== undefined) data.paymentGroup = input.paymentGroup;
    if (input.buyUnitPrice !== undefined) data.buyUnitPrice = input.buyUnitPrice;
    if (input.sellUnitPrice !== undefined) data.sellUnitPrice = input.sellUnitPrice;
    if (input.directCostAmount !== undefined) data.directCostAmount = input.directCostAmount;
    if (input.isStartPoint !== undefined) data.isStartPoint = input.isStartPoint;
    if (input.isEndPoint !== undefined) data.isEndPoint = input.isEndPoint;
    if (input.memo !== undefined) data.memo = input.memo;

    const participant = await this.repository.createParticipant(data);
    const version = await this.versionService.createVersion(
      this.toCreateVersionInput(participant.formulaId, input.version),
    );

    return { participant, version };
  }

  async getParticipantById(id: string): Promise<FormulaParticipant> {
    const participant = await this.repository.findParticipantById(id);

    if (!participant) {
      throw new ParticipantNotFoundError(id);
    }

    return participant;
  }

  async listParticipantsByFormulaId(
    formulaId: string,
    companyScope?: CompanyScopeFilter,
  ): Promise<FormulaParticipant[]> {
    return this.repository.listParticipantsByFormulaId(
      formulaId,
      resolveScopeCompanyId(companyScope),
    );
  }

  private toCreateVersionInput(
    formulaId: string,
    version: ParticipantVersionPayload,
  ): CreateVersionInput {
    return {
      formulaId,
      changedBy: version.changedBy,
      changeReason: version.changeReason,
      snapshot: version.snapshot,
      calculation: version.calculation,
    };
  }
}

export const participantService = new ParticipantService(
  participantRepository,
  defaultVersionService,
  formulaRepository,
  companyService,
);
