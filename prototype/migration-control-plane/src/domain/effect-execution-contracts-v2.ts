import { z } from 'zod'
import {
  ActorSchema,
  AssignmentIdSchema,
  AttemptIdSchema,
  BudgetSchema,
  CapabilityEnvelopeIdSchema,
  CompensationIdSchema,
  DataClassSchema,
  EffectIdSchema,
  EvaluationContractIdSchema,
  EvidenceIdSchema,
  FenceSchema,
  IsoDateTimeSchema,
  JsonValueSchema,
  MissionIdSchema,
  PolicyDecisionIdSchema,
  SecretLeaseIdSchema,
  Sha256Schema,
  ShortTextSchema,
  TenantIdSchema,
  ToolReferenceSchema,
  UriSchema,
  uniqueIdArray
} from './common-contracts.js'
import { EffectTargetSchema, IdempotencyStrategySchema } from './effect-contracts.js'

const EffectAuthorityV2Schema = z.strictObject({
  planRevisionId: z.string().min(1).max(256),
  taskId: z.string().min(1).max(256),
  assignmentId: AssignmentIdSchema,
  attemptId: AttemptIdSchema,
  fence: FenceSchema,
  subjectVersion: z.string().min(1).max(512),
  workloadIdentity: z.strictObject({
    issuer: z.string().min(1).max(512),
    subject: z.string().min(1).max(512),
    audience: z.string().min(1).max(256)
  }),
  skill: z.strictObject({
    name: z.string().min(1).max(128),
    version: z.string().min(1).max(128),
    digest: Sha256Schema
  })
})

const EffectBlastRadiusV2Schema = z.strictObject({
  targetCount: z.number().int().positive().max(1_000),
  maxChangedRows: z.number().int().nonnegative().max(1_000_000),
  maxChangedBytes: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
})

const EffectRecoveryV2Schema = z.strictObject({
  strategy: z.enum(['read-reconcile', 'compensate', 'none']),
  inspectionMethod: z.string().min(1).max(128).nullable(),
  blindRetryAllowed: z.boolean()
})

export const EffectIntentV2Schema = z
  .strictObject({
    schemaVersion: z.literal(2),
    kind: z.literal('effect-intent'),
    id: EffectIdSchema,
    tenantId: TenantIdSchema,
    missionId: MissionIdSchema,
    createdAt: IsoDateTimeSchema,
    authority: EffectAuthorityV2Schema,
    operationClass: z.enum([
      'pure-read',
      'local-artifact',
      'declarative-ensure',
      'idempotent-create',
      'non-idempotent-mutation',
      'destructive-irreversible'
    ]),
    adapter: z.strictObject({
      name: z.string().min(1).max(128),
      version: z.string().min(1).max(128),
      method: z.string().min(1).max(128)
    }),
    target: EffectTargetSchema,
    parameters: JsonValueSchema,
    parameterDigest: Sha256Schema,
    expectedPreState: JsonValueSchema,
    desiredPostState: JsonValueSchema,
    expectedTargetVersion: z.string().min(1).max(512).nullable(),
    idempotency: IdempotencyStrategySchema,
    requiredTools: z.array(ToolReferenceSchema).max(128),
    allowedNetworkDestinations: z.array(UriSchema).max(128),
    requiredSecretScopes: z.array(z.string().min(1).max(256)).max(128),
    dataClasses: z.array(DataClassSchema).min(1).max(6),
    budget: BudgetSchema,
    blastRadius: EffectBlastRadiusV2Schema,
    recovery: EffectRecoveryV2Schema,
    expiresAt: IsoDateTimeSchema,
    reversible: z.boolean(),
    compensationId: CompensationIdSchema.nullable(),
    evaluatorContractIds: uniqueIdArray(EvaluationContractIdSchema, {
      min: 1,
      max: 128,
      label: 'evaluatorContractIds'
    }),
    evidenceRecordIds: uniqueIdArray(EvidenceIdSchema, {
      min: 1,
      max: 10_000,
      label: 'evidenceRecordIds'
    }),
    proposedBy: ActorSchema
  })
  .superRefine((intent, context) => {
    if (intent.idempotency.parameterDigest !== intent.parameterDigest) {
      context.addIssue({
        code: 'custom',
        message: 'Idempotency parameter digest must match intent parameter digest',
        path: ['idempotency', 'parameterDigest']
      })
    }
    if (intent.operationClass === 'destructive-irreversible' && intent.reversible) {
      context.addIssue({
        code: 'custom',
        message: 'Destructive irreversible effect cannot claim reversibility',
        path: ['reversible']
      })
    }
    if (Date.parse(intent.expiresAt) <= Date.parse(intent.createdAt)) {
      context.addIssue({
        code: 'custom',
        message: 'Effect intent must expire after creation',
        path: ['expiresAt']
      })
    }
    if (
      intent.recovery.strategy === 'read-reconcile' &&
      intent.recovery.inspectionMethod === null
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Read reconciliation requires an inspection method',
        path: ['recovery', 'inspectionMethod']
      })
    }
    if (intent.recovery.blindRetryAllowed) {
      context.addIssue({
        code: 'custom',
        message: 'External effects cannot authorize blind retry',
        path: ['recovery', 'blindRetryAllowed']
      })
    }
  })

const PolicyGrantV2Schema = z.strictObject({
  target: EffectTargetSchema,
  adapterName: z.string().min(1).max(128),
  adapterVersion: z.string().min(1).max(128),
  adapterMethod: z.string().min(1).max(128),
  parameterDigest: Sha256Schema,
  expectedPreStateDigest: Sha256Schema,
  subjectVersion: z.string().min(1).max(512),
  runnerDigest: Sha256Schema,
  toolNames: z.array(z.string().min(1).max(128)).max(128),
  networkDestinations: z.array(UriSchema).max(128),
  secretScopes: z.array(z.string().min(1).max(256)).max(128),
  budget: BudgetSchema,
  maxUses: z.number().int().positive().max(1_000),
  expiresAt: IsoDateTimeSchema
})

export const PolicyDecisionV2Schema = z
  .strictObject({
    schemaVersion: z.literal(2),
    kind: z.literal('policy-decision'),
    id: PolicyDecisionIdSchema,
    tenantId: TenantIdSchema,
    missionId: MissionIdSchema,
    createdAt: IsoDateTimeSchema,
    effectId: EffectIdSchema,
    intentDigest: Sha256Schema,
    policyBundleVersion: z.string().min(1).max(128),
    policyBundleDigest: Sha256Schema,
    structuredInputDigest: Sha256Schema,
    decision: z.enum(['allow', 'deny', 'exception-required']),
    grant: PolicyGrantV2Schema.nullable(),
    obligations: z.array(ShortTextSchema).max(128),
    ruleIds: z.array(z.string().min(1).max(256)).min(1).max(1_000),
    reasons: z.array(ShortTextSchema).min(1).max(128),
    decidedBy: ActorSchema,
    expiresAt: IsoDateTimeSchema
  })
  .superRefine((decision, context) => {
    if (decision.decision === 'allow' && decision.grant === null) {
      context.addIssue({
        code: 'custom',
        message: 'Allowed policy decision requires a grant',
        path: ['grant']
      })
    }
    if (decision.decision !== 'allow' && decision.grant !== null) {
      context.addIssue({
        code: 'custom',
        message: 'Denied/exception decision cannot carry a grant',
        path: ['grant']
      })
    }
  })

export const CapabilityEnvelopeV2Schema = z
  .strictObject({
    schemaVersion: z.literal(2),
    kind: z.literal('capability-envelope'),
    id: CapabilityEnvelopeIdSchema,
    tenantId: TenantIdSchema,
    missionId: MissionIdSchema,
    createdAt: IsoDateTimeSchema,
    effectId: EffectIdSchema,
    intentDigest: Sha256Schema,
    policyDecisionId: PolicyDecisionIdSchema,
    workload: z.strictObject({
      assignmentId: AssignmentIdSchema,
      attemptId: AttemptIdSchema,
      fence: FenceSchema,
      issuer: z.string().min(1).max(512),
      subject: z.string().min(1).max(512),
      audience: z.string().min(1).max(256)
    }),
    target: EffectTargetSchema,
    adapterName: z.string().min(1).max(128),
    adapterVersion: z.string().min(1).max(128),
    adapterMethod: z.string().min(1).max(128),
    parameterDigest: Sha256Schema,
    expectedPreStateDigest: Sha256Schema,
    subjectVersion: z.string().min(1).max(512),
    runnerDigest: Sha256Schema,
    allowedTools: z.array(ToolReferenceSchema).max(128),
    allowedNetworkDestinations: z.array(UriSchema).max(128),
    dataClasses: z.array(DataClassSchema).min(1).max(6),
    secretLeaseIds: uniqueIdArray(SecretLeaseIdSchema, {
      max: 128,
      label: 'secretLeaseIds'
    }),
    budget: BudgetSchema,
    maxUses: z.number().int().positive().max(1_000),
    issuedAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema,
    revokedAt: IsoDateTimeSchema.nullable()
  })
  .superRefine((envelope, context) => {
    if (Date.parse(envelope.expiresAt) <= Date.parse(envelope.issuedAt)) {
      context.addIssue({
        code: 'custom',
        message: 'Capability must expire after issue',
        path: ['expiresAt']
      })
    }
    if (
      envelope.revokedAt !== null &&
      Date.parse(envelope.revokedAt) < Date.parse(envelope.issuedAt)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Capability revocation precedes issue',
        path: ['revokedAt']
      })
    }
  })

export type EffectIntentV2 = z.infer<typeof EffectIntentV2Schema>
export type PolicyDecisionV2 = z.infer<typeof PolicyDecisionV2Schema>
export type CapabilityEnvelopeV2 = z.infer<typeof CapabilityEnvelopeV2Schema>
