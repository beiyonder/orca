import { z } from 'zod'
import {
  ActorSchema,
  ContractSchemaReferenceSchema,
  EventIdSchema,
  EvidenceIdSchema,
  FenceSchema,
  IsoDateTimeSchema,
  PositiveVersionSchema,
  ProcessObligationBreachIdSchema,
  ProcessObligationDefinitionIdSchema,
  ProcessObligationIdSchema,
  ProcessObligationWaiverIdSchema,
  Sha256Schema,
  ShortTextSchema,
  missionRecordFields,
  tenantRecordFields,
  uniqueIdArray
} from './common-contracts.js'

export const ProcessObligationScopeKindSchema = z.enum([
  'mission',
  'plan',
  'task',
  'assignment',
  'effect',
  'artifact',
  'evidence',
  'evaluation',
  'memory',
  'skill',
  'exception',
  'maintenance'
])

export const ProcessObligationScopeSchema = z.strictObject({
  kind: ProcessObligationScopeKindSchema,
  id: z.string().min(1).max(256),
  subjectVersion: z.string().min(1).max(512).nullable()
})

export const ProcessObligationDefinitionReferenceSchema = z.strictObject({
  id: ProcessObligationDefinitionIdSchema,
  version: PositiveVersionSchema,
  digest: Sha256Schema
})

const ProcessObligationProofPolicySchema = z.strictObject({
  recordKinds: z.array(z.string().min(1).max(128)).min(1).max(64),
  schemas: z.array(ContractSchemaReferenceSchema).min(1).max(64),
  minimumCount: z.number().int().positive().max(1_000),
  authority: z.enum(['product', 'evaluator', 'adapter', 'operator']),
  maxAgeMs: z
    .number()
    .int()
    .positive()
    .max(365 * 24 * 60 * 60 * 1_000)
    .nullable()
})

export const ProcessObligationDefinitionV1Schema = z
  .strictObject({
    ...tenantRecordFields('process-obligation-definition', ProcessObligationDefinitionIdSchema),
    definitionKey: z.string().min(1).max(128),
    version: PositiveVersionSchema,
    predecessorDefinitionId: ProcessObligationDefinitionIdSchema.nullable(),
    scopeKinds: z.array(ProcessObligationScopeKindSchema).min(1).max(12),
    trigger: z.strictObject({
      eventKind: z.string().min(1).max(128),
      applicabilityPolicyVersion: z.string().min(1).max(128),
      applicabilityPolicyDigest: Sha256Schema
    }),
    timing: z.strictObject({
      deadlineOffsetMs: z
        .number()
        .int()
        .positive()
        .max(365 * 24 * 60 * 60 * 1_000),
      graceMs: z
        .number()
        .int()
        .nonnegative()
        .max(30 * 24 * 60 * 60 * 1_000),
      clock: z.literal('database')
    }),
    proof: ProcessObligationProofPolicySchema,
    severity: z.enum(['info', 'warning', 'blocking', 'critical']),
    breachAction: z.enum(['alert', 'block', 'quarantine', 'reconcile', 'escalate', 'stop-new-use']),
    waiver: z.strictObject({
      allowed: z.boolean(),
      authorizedActorKinds: z.array(z.enum(['system', 'operator'])).max(2),
      evidenceRequired: z.boolean(),
      maximumDurationMs: z
        .number()
        .int()
        .positive()
        .max(365 * 24 * 60 * 60 * 1_000)
        .nullable()
    }),
    supersession: z.enum(['cancel', 'rebind', 'retain']),
    activatedAt: IsoDateTimeSchema,
    revokedAt: IsoDateTimeSchema.nullable()
  })
  .superRefine((definition, context) => {
    if (new Set(definition.scopeKinds).size !== definition.scopeKinds.length) {
      context.addIssue({
        code: 'custom',
        message: 'Obligation scope kinds must be unique',
        path: ['scopeKinds']
      })
    }
    if (definition.version === 1 && definition.predecessorDefinitionId !== null) {
      context.addIssue({
        code: 'custom',
        message: 'Initial obligation definition cannot have a predecessor',
        path: ['predecessorDefinitionId']
      })
    }
    if (definition.version > 1 && definition.predecessorDefinitionId === null) {
      context.addIssue({
        code: 'custom',
        message: 'Later obligation definition requires a predecessor',
        path: ['predecessorDefinitionId']
      })
    }
    if (!definition.waiver.allowed && definition.waiver.authorizedActorKinds.length > 0) {
      context.addIssue({
        code: 'custom',
        message: 'Non-waivable obligation cannot name waiver authorities',
        path: ['waiver', 'authorizedActorKinds']
      })
    }
    if (
      definition.revokedAt !== null &&
      Date.parse(definition.revokedAt) < Date.parse(definition.activatedAt)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Definition revocation precedes activation',
        path: ['revokedAt']
      })
    }
  })

const ProofRecordIdSchema = z.string().min(1).max(256)

export const ProcessObligationStateV1Schema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('pending') }),
  z.strictObject({
    status: z.literal('satisfied'),
    proofRecordIds: z.array(ProofRecordIdSchema).min(1).max(1_000),
    satisfiedAt: IsoDateTimeSchema
  }),
  z.strictObject({
    status: z.literal('failed'),
    failureCode: z.string().min(1).max(128),
    evidenceIds: uniqueIdArray(EvidenceIdSchema, {
      min: 1,
      max: 1_000,
      label: 'evidenceIds'
    }),
    failedAt: IsoDateTimeSchema
  }),
  z.strictObject({
    status: z.literal('waived'),
    waiverId: ProcessObligationWaiverIdSchema,
    waivedAt: IsoDateTimeSchema
  }),
  z.strictObject({
    status: z.literal('cancelled'),
    supersedingEventId: EventIdSchema,
    reason: ShortTextSchema,
    cancelledAt: IsoDateTimeSchema
  })
])

export const ProcessObligationV1Schema = z
  .strictObject({
    ...missionRecordFields('process-obligation', ProcessObligationIdSchema),
    definition: ProcessObligationDefinitionReferenceSchema,
    scope: ProcessObligationScopeSchema,
    trigger: z.strictObject({
      eventId: EventIdSchema,
      eventPosition: PositiveVersionSchema,
      occurredAt: IsoDateTimeSchema
    }),
    openedAt: IsoDateTimeSchema,
    dueAt: IsoDateTimeSchema,
    graceUntil: IsoDateTimeSchema,
    state: ProcessObligationStateV1Schema,
    breachId: ProcessObligationBreachIdSchema.nullable(),
    currentFence: FenceSchema
  })
  .superRefine((obligation, context) => {
    const openedAt = Date.parse(obligation.openedAt)
    const dueAt = Date.parse(obligation.dueAt)
    const graceUntil = Date.parse(obligation.graceUntil)
    if (dueAt <= openedAt) {
      context.addIssue({
        code: 'custom',
        message: 'Obligation deadline must follow opening time',
        path: ['dueAt']
      })
    }
    if (graceUntil < dueAt) {
      context.addIssue({
        code: 'custom',
        message: 'Obligation grace cannot end before its deadline',
        path: ['graceUntil']
      })
    }
  })

export const ProcessObligationBreachV1Schema = z
  .strictObject({
    ...missionRecordFields('process-obligation-breach', ProcessObligationBreachIdSchema),
    obligationId: ProcessObligationIdSchema,
    definition: ProcessObligationDefinitionReferenceSchema,
    scope: ProcessObligationScopeSchema,
    dueAt: IsoDateTimeSchema,
    graceUntil: IsoDateTimeSchema,
    observedAt: IsoDateTimeSchema,
    reasonCodes: z.array(z.string().min(1).max(128)).min(1).max(64),
    missingProofKinds: z.array(z.string().min(1).max(128)).max(64),
    invalidProofRecordIds: z.array(ProofRecordIdSchema).max(1_000),
    monitor: z.strictObject({
      ownerId: z.string().min(1).max(128),
      claimId: z.string().min(1).max(128),
      fence: FenceSchema
    }),
    severity: z.enum(['info', 'warning', 'blocking', 'critical']),
    response: z.enum(['alert', 'block', 'quarantine', 'reconcile', 'escalate', 'stop-new-use']),
    selectedBy: ActorSchema,
    resolutionRecordId: ProofRecordIdSchema.nullable(),
    detectedAt: IsoDateTimeSchema
  })
  .superRefine((breach, context) => {
    if (Date.parse(breach.observedAt) < Date.parse(breach.graceUntil)) {
      context.addIssue({
        code: 'custom',
        message: 'Breach observation precedes grace expiry',
        path: ['observedAt']
      })
    }
    if (Date.parse(breach.detectedAt) < Date.parse(breach.observedAt)) {
      context.addIssue({
        code: 'custom',
        message: 'Breach detection precedes observation',
        path: ['detectedAt']
      })
    }
  })

export const ProcessObligationWaiverV1Schema = z
  .strictObject({
    ...missionRecordFields('process-obligation-waiver', ProcessObligationWaiverIdSchema),
    obligationId: ProcessObligationIdSchema,
    definition: ProcessObligationDefinitionReferenceSchema,
    scope: ProcessObligationScopeSchema,
    reason: ShortTextSchema,
    evidenceIds: uniqueIdArray(EvidenceIdSchema, {
      min: 1,
      max: 1_000,
      label: 'evidenceIds'
    }),
    authorizationPolicyDigest: Sha256Schema,
    authorizedBy: ActorSchema,
    issuedAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema.nullable(),
    residualRisk: z.array(ShortTextSchema).max(64)
  })
  .superRefine((waiver, context) => {
    if (waiver.expiresAt !== null && Date.parse(waiver.expiresAt) <= Date.parse(waiver.issuedAt)) {
      context.addIssue({
        code: 'custom',
        message: 'Waiver expiry must follow issuance',
        path: ['expiresAt']
      })
    }
    if (!['system', 'operator'].includes(waiver.authorizedBy.kind)) {
      context.addIssue({
        code: 'custom',
        message: 'Waiver requires system or operator authority',
        path: ['authorizedBy', 'kind']
      })
    }
  })

export type ProcessObligationDefinitionV1 = z.infer<typeof ProcessObligationDefinitionV1Schema>
export type ProcessObligationV1 = z.infer<typeof ProcessObligationV1Schema>
export type ProcessObligationBreachV1 = z.infer<typeof ProcessObligationBreachV1Schema>
export type ProcessObligationWaiverV1 = z.infer<typeof ProcessObligationWaiverV1Schema>
