import { z } from 'zod'
import {
  ActorSchema,
  AssignmentIdSchema,
  AttemptIdSchema,
  BudgetSchema,
  CapabilityEnvelopeIdSchema,
  CompensationIdSchema,
  ContentReferenceSchema,
  DataClassSchema,
  EffectAttemptIdSchema,
  EffectIdSchema,
  EffectReceiptIdSchema,
  EvaluationAssignmentIdSchema,
  EvaluationContractIdSchema,
  EvaluationResultIdSchema,
  EvidenceIdSchema,
  FenceSchema,
  IsoDateTimeSchema,
  JsonValueSchema,
  PolicyDecisionIdSchema,
  RecoveryDispositionIdSchema,
  SecretLeaseIdSchema,
  Sha256Schema,
  ShortTextSchema,
  TargetObservationIdSchema,
  ToolReferenceSchema,
  UriSchema,
  missionRecordFields,
  uniqueIdArray
} from './common-contracts.js'

export const EffectTargetSchema = z
  .object({
    provider: z.string().min(1).max(128),
    account: z.string().min(1).max(256),
    project: z.string().min(1).max(256).nullable(),
    region: z.string().min(1).max(128).nullable(),
    resourceType: z.string().min(1).max(256),
    resourceId: z.string().min(1).max(1_024).nullable()
  })
  .strict()

export const IdempotencyStrategySchema = z
  .object({
    kind: z.enum(['none', 'provider-key', 'natural-key', 'compare-and-set']),
    key: z.string().min(1).max(512).nullable(),
    retentionExpiresAt: IsoDateTimeSchema.nullable(),
    parameterDigest: Sha256Schema
  })
  .strict()
  .superRefine((strategy, context) => {
    if (strategy.kind === 'none' && strategy.key !== null) {
      context.addIssue({
        code: 'custom',
        message: 'No-idempotency strategy cannot have a key',
        path: ['key']
      })
    }
    if (strategy.kind !== 'none' && strategy.key === null) {
      context.addIssue({
        code: 'custom',
        message: 'Idempotent strategy requires a key',
        path: ['key']
      })
    }
  })

export const EffectIntentV1Schema = z
  .object({
    ...missionRecordFields('effect-intent', EffectIdSchema),
    operationClass: z.enum([
      'pure-read',
      'local-artifact',
      'declarative-ensure',
      'idempotent-create',
      'non-idempotent-mutation',
      'destructive-irreversible'
    ]),
    adapter: z
      .object({
        name: z.string().min(1).max(128),
        version: z.string().min(1).max(128),
        method: z.string().min(1).max(128)
      })
      .strict(),
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
  .strict()
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
  })

const PolicyGrantSchema = z
  .object({
    target: EffectTargetSchema,
    adapterName: z.string().min(1).max(128),
    adapterMethod: z.string().min(1).max(128),
    parameterDigest: Sha256Schema,
    toolNames: z.array(z.string().min(1).max(128)).max(128),
    networkDestinations: z.array(UriSchema).max(128),
    secretScopes: z.array(z.string().min(1).max(256)).max(128),
    maxUses: z.number().int().positive().max(1_000),
    expiresAt: IsoDateTimeSchema
  })
  .strict()

export const PolicyDecisionV1Schema = z
  .object({
    ...missionRecordFields('policy-decision', PolicyDecisionIdSchema),
    effectId: EffectIdSchema,
    intentDigest: Sha256Schema,
    policyBundleVersion: z.string().min(1).max(128),
    policyBundleDigest: Sha256Schema,
    structuredInputDigest: Sha256Schema,
    decision: z.enum(['allow', 'deny', 'exception-required']),
    grant: PolicyGrantSchema.nullable(),
    obligations: z.array(ShortTextSchema).max(128),
    ruleIds: z.array(z.string().min(1).max(256)).min(1).max(1_000),
    reasons: z.array(ShortTextSchema).min(1).max(128),
    decidedBy: ActorSchema,
    expiresAt: IsoDateTimeSchema
  })
  .strict()
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

export const SecretLeaseV1Schema = z
  .object({
    ...missionRecordFields('secret-lease', SecretLeaseIdSchema),
    effectId: EffectIdSchema,
    secretReference: UriSchema,
    recipient: z
      .object({
        assignmentId: AssignmentIdSchema,
        attemptId: AttemptIdSchema,
        fence: FenceSchema,
        audience: z.string().min(1).max(256)
      })
      .strict(),
    target: EffectTargetSchema,
    scopes: z.array(z.string().min(1).max(256)).min(1).max(128),
    issuedAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema,
    maxUses: z.number().int().positive().max(1_000),
    revokedAt: IsoDateTimeSchema.nullable()
  })
  .strict()
  .superRefine((lease, context) => {
    if (Date.parse(lease.expiresAt) <= Date.parse(lease.issuedAt)) {
      context.addIssue({
        code: 'custom',
        message: 'Secret lease must expire after issue',
        path: ['expiresAt']
      })
    }
    if (lease.revokedAt !== null && Date.parse(lease.revokedAt) < Date.parse(lease.issuedAt)) {
      context.addIssue({
        code: 'custom',
        message: 'Secret lease revocation precedes issue',
        path: ['revokedAt']
      })
    }
  })

export const CapabilityEnvelopeV1Schema = z
  .object({
    ...missionRecordFields('capability-envelope', CapabilityEnvelopeIdSchema),
    effectId: EffectIdSchema,
    intentDigest: Sha256Schema,
    policyDecisionId: PolicyDecisionIdSchema,
    workload: z
      .object({
        assignmentId: AssignmentIdSchema,
        attemptId: AttemptIdSchema,
        fence: FenceSchema,
        audience: z.string().min(1).max(256)
      })
      .strict(),
    target: EffectTargetSchema,
    adapterName: z.string().min(1).max(128),
    adapterMethod: z.string().min(1).max(128),
    parameterDigest: Sha256Schema,
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
  .strict()
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

const EffectAttemptStateSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('prepared') }).strict(),
  z
    .object({
      status: z.literal('issued'),
      requestStartedAt: IsoDateTimeSchema,
      providerRequestId: z.string().min(1).max(1_024).nullable()
    })
    .strict(),
  z
    .object({
      status: z.literal('unknown'),
      reason: ShortTextSchema,
      unknownAt: IsoDateTimeSchema
    })
    .strict(),
  z
    .object({
      status: z.enum(['applied', 'absent', 'failed']),
      receiptId: EffectReceiptIdSchema,
      settledAt: IsoDateTimeSchema
    })
    .strict(),
  z
    .object({
      status: z.literal('reconciling'),
      observationIds: uniqueIdArray(TargetObservationIdSchema, {
        max: 1_000,
        label: 'observationIds'
      })
    })
    .strict(),
  z
    .object({
      status: z.literal('evaluating'),
      receiptId: EffectReceiptIdSchema,
      evaluationAssignmentIds: uniqueIdArray(EvaluationAssignmentIdSchema, {
        min: 1,
        max: 128,
        label: 'evaluationAssignmentIds'
      })
    })
    .strict(),
  z
    .object({
      status: z.enum(['accepted', 'rejected']),
      receiptId: EffectReceiptIdSchema,
      evaluationResultIds: uniqueIdArray(EvaluationResultIdSchema, {
        min: 1,
        max: 128,
        label: 'evaluationResultIds'
      }),
      completedAt: IsoDateTimeSchema
    })
    .strict()
])

export const EffectAttemptV1Schema = z
  .object({
    ...missionRecordFields('effect-attempt', EffectAttemptIdSchema),
    effectId: EffectIdSchema,
    attemptNumber: z.number().int().positive().max(100),
    fence: FenceSchema,
    capabilityEnvelopeId: CapabilityEnvelopeIdSchema,
    adapterName: z.string().min(1).max(128),
    adapterVersion: z.string().min(1).max(128),
    runnerDigest: Sha256Schema,
    requestDigest: Sha256Schema,
    idempotencyKeyHash: Sha256Schema.nullable(),
    preRequestJournal: ContentReferenceSchema,
    state: EffectAttemptStateSchema
  })
  .strict()

export const EffectReceiptV1Schema = z
  .object({
    ...missionRecordFields('effect-receipt', EffectReceiptIdSchema),
    effectId: EffectIdSchema,
    attemptId: EffectAttemptIdSchema,
    fence: FenceSchema,
    adapterName: z.string().min(1).max(128),
    adapterVersion: z.string().min(1).max(128),
    runnerDigest: Sha256Schema,
    requestDigest: Sha256Schema,
    idempotencyKeyHash: Sha256Schema.nullable(),
    providerRequestId: z.string().min(1).max(1_024).nullable(),
    providerResourceIds: z.array(z.string().min(1).max(1_024)).max(1_000),
    status: z.enum(['applied', 'absent', 'failed', 'unknown']),
    responseCategory: z.string().min(1).max(128),
    beforeEvidence: ContentReferenceSchema.nullable(),
    afterEvidence: ContentReferenceSchema.nullable(),
    residualResources: z.array(JsonValueSchema).max(10_000),
    rawResponse: ContentReferenceSchema.nullable(),
    signer: z.string().min(1).max(512),
    observedAt: IsoDateTimeSchema
  })
  .strict()
  .superRefine((receipt, context) => {
    if (receipt.status === 'applied' && receipt.afterEvidence === null) {
      context.addIssue({
        code: 'custom',
        message: 'Applied receipt requires after evidence',
        path: ['afterEvidence']
      })
    }
  })

export const TargetObservationV1Schema = z
  .object({
    ...missionRecordFields('target-observation', TargetObservationIdSchema),
    effectId: EffectIdSchema,
    target: EffectTargetSchema,
    method: z.string().min(1).max(128),
    identity: z.string().min(1).max(512),
    observedState: JsonValueSchema,
    observedVersion: z.string().min(1).max(512).nullable(),
    classification: z.enum(['applied', 'absent', 'ambiguous', 'inaccessible', 'changed-by-other']),
    evidence: ContentReferenceSchema,
    observedAt: IsoDateTimeSchema,
    observedBy: ActorSchema
  })
  .strict()

export const RecoveryDispositionV1Schema = z
  .object({
    ...missionRecordFields('recovery-disposition', RecoveryDispositionIdSchema),
    effectId: EffectIdSchema,
    triggeringAttemptId: EffectAttemptIdSchema,
    receiptIds: uniqueIdArray(EffectReceiptIdSchema, {
      max: 1_000,
      label: 'receiptIds'
    }),
    observationIds: uniqueIdArray(TargetObservationIdSchema, {
      max: 1_000,
      label: 'observationIds'
    }),
    action: z.enum(['wait', 'same-key-retry', 'repair', 'compensate', 'quarantine', 'escalate']),
    providerKeyStillValid: z.boolean(),
    rationale: ShortTextSchema,
    residualRisk: z.array(ShortTextSchema).max(64),
    selectedBy: ActorSchema
  })
  .strict()
  .superRefine((disposition, context) => {
    if (disposition.action === 'same-key-retry' && !disposition.providerKeyStillValid) {
      context.addIssue({
        code: 'custom',
        message: 'Same-key retry requires a still-valid provider key',
        path: ['providerKeyStillValid']
      })
    }
    if (
      ['repair', 'compensate', 'same-key-retry'].includes(disposition.action) &&
      disposition.observationIds.length === 0
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Mutating recovery action requires target observation',
        path: ['observationIds']
      })
    }
  })

export const CompensationV1Schema = z
  .object({
    ...missionRecordFields('compensation', CompensationIdSchema),
    forwardEffectId: EffectIdSchema,
    compensationEffectId: EffectIdSchema,
    restorationClaim: z.enum(['full', 'partial', 'none']),
    preconditions: z.array(ShortTextSchema).min(1).max(128),
    knownResidualEffects: z.array(ShortTextSchema).max(128),
    authorizedByPolicyDecisionId: PolicyDecisionIdSchema,
    evaluatedReceiptId: EffectReceiptIdSchema.nullable()
  })
  .strict()
  .refine((compensation) => compensation.forwardEffectId !== compensation.compensationEffectId, {
    message: 'Compensation effect must differ from forward effect',
    path: ['compensationEffectId']
  })

export type EffectIntentV1 = z.infer<typeof EffectIntentV1Schema>
export type PolicyDecisionV1 = z.infer<typeof PolicyDecisionV1Schema>
export type SecretLeaseV1 = z.infer<typeof SecretLeaseV1Schema>
export type CapabilityEnvelopeV1 = z.infer<typeof CapabilityEnvelopeV1Schema>
export type EffectAttemptV1 = z.infer<typeof EffectAttemptV1Schema>
export type EffectReceiptV1 = z.infer<typeof EffectReceiptV1Schema>
export type TargetObservationV1 = z.infer<typeof TargetObservationV1Schema>
export type RecoveryDispositionV1 = z.infer<typeof RecoveryDispositionV1Schema>
export type CompensationV1 = z.infer<typeof CompensationV1Schema>
