import { z } from 'zod'
import {
  ActorSchema,
  AssignmentIdSchema,
  AttemptIdSchema,
  CapabilityIdSchema,
  CapabilityUseIdSchema,
  CertificationIdSchema,
  ContentReferenceSchema,
  DataClassSchema,
  DriftSignalIdSchema,
  EvaluationContractIdSchema,
  EvaluationResultIdSchema,
  EvidenceIdSchema,
  IsoDateTimeSchema,
  LearningCandidateIdSchema,
  ModelRouteSchema,
  PromotionIdSchema,
  Sha256Schema,
  ShortTextSchema,
  ToolReferenceSchema,
  UsageSchema,
  missionRecordFields,
  tenantRecordFields,
  uniqueIdArray
} from './common-contracts.js'
import { EvaluationMeasureV1Schema } from './evaluation-contracts.js'

export const LearningCandidateTypeSchema = z.enum([
  'memory',
  'context-policy',
  'prompt-program',
  'skill',
  'tool',
  'model-route',
  'evaluator',
  'corpus',
  'model-weights'
])

const QuarantinedCandidateStateSchema = z
  .object({
    status: z.literal('quarantined'),
    usePolicy: z.literal('none'),
    validationStatus: z.literal('not-run')
  })
  .strict()
const ActiveCandidateStateSchema = z
  .object({
    status: z.enum(['eligible', 'experimenting']),
    usePolicy: z.literal('offline-only'),
    validationStatus: z.enum(['planned', 'running'])
  })
  .strict()
const SettledCandidateStateSchema = z
  .object({
    status: z.enum(['certified', 'rejected', 'revoked']),
    certificationId: CertificationIdSchema,
    reason: ShortTextSchema,
    settledAt: IsoDateTimeSchema
  })
  .strict()

export const LearningCandidateV1Schema = z
  .object({
    ...missionRecordFields('learning-candidate', LearningCandidateIdSchema),
    candidateType: LearningCandidateTypeSchema,
    sourceEvaluationResultIds: uniqueIdArray(EvaluationResultIdSchema, {
      max: 1_000,
      label: 'sourceEvaluationResultIds'
    }),
    sourceEvidenceIds: uniqueIdArray(EvidenceIdSchema, {
      min: 1,
      max: 10_000,
      label: 'sourceEvidenceIds'
    }),
    sourceRecordIds: z.array(z.string().min(1).max(128)).min(1).max(10_000),
    causalHypothesis: z.string().min(1).max(8_192),
    proposedArtifact: ContentReferenceSchema,
    targetEnvelope: z
      .object({
        taskClasses: z.array(z.string().min(1).max(128)).min(1).max(128),
        modelRoutes: z.array(ModelRouteSchema).max(64),
        dataClasses: z.array(DataClassSchema).min(1).max(6),
        environment: z.string().min(1).max(128)
      })
      .strict(),
    allowedMutationPaths: z.array(z.string().min(1).max(1_024)).min(1).max(256),
    authorityDelta: z.enum(['none', 'separate-approval-required']),
    retentionExpiresAt: IsoDateTimeSchema.nullable(),
    state: z.discriminatedUnion('status', [
      QuarantinedCandidateStateSchema,
      ActiveCandidateStateSchema,
      SettledCandidateStateSchema
    ]),
    proposedBy: ActorSchema
  })
  .strict()
  .superRefine((candidate, context) => {
    if (candidate.state.status === 'certified' && candidate.authorityDelta !== 'none') {
      context.addIssue({
        code: 'custom',
        message: 'Certified candidate cannot expand authority',
        path: ['authorityDelta']
      })
    }
  })

const CapabilityStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('quarantined') }).strict(),
  z
    .object({
      status: z.literal('certified'),
      certificationId: CertificationIdSchema
    })
    .strict(),
  z
    .object({
      status: z.literal('active'),
      certificationId: CertificationIdSchema,
      promotionId: PromotionIdSchema,
      activatedAt: IsoDateTimeSchema
    })
    .strict(),
  z
    .object({
      status: z.enum(['demoted', 'revoked']),
      certificationId: CertificationIdSchema.nullable(),
      reason: ShortTextSchema,
      settledAt: IsoDateTimeSchema
    })
    .strict()
])

export const CapabilityManifestV1Schema = z
  .object({
    ...tenantRecordFields('capability-manifest', CapabilityIdSchema),
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    capabilityType: LearningCandidateTypeSchema.exclude(['memory', 'corpus', 'model-weights']),
    artifact: ContentReferenceSchema,
    contract: z
      .object({
        inputSchemaId: z.string().min(1).max(256),
        outputSchemaId: z.string().min(1).max(256),
        schemaDigest: Sha256Schema
      })
      .strict(),
    compatibleModelRoutes: z.array(ModelRouteSchema).max(64),
    requiredTools: z.array(ToolReferenceSchema).max(128),
    dataClasses: z.array(DataClassSchema).min(1).max(6),
    authorityEnvelope: z.json(),
    evaluationContractIds: uniqueIdArray(EvaluationContractIdSchema, {
      min: 1,
      max: 128,
      label: 'evaluationContractIds'
    }),
    predecessorCapabilityId: CapabilityIdSchema.nullable(),
    license: z.string().min(1).max(256),
    signer: z.string().min(1).max(512).nullable(),
    status: CapabilityStatusSchema
  })
  .strict()
  .superRefine((capability, context) => {
    if (capability.version === 1 && capability.predecessorCapabilityId !== null) {
      context.addIssue({
        code: 'custom',
        message: 'First capability version cannot have a predecessor',
        path: ['predecessorCapabilityId']
      })
    }
    if (capability.version > 1 && capability.predecessorCapabilityId === null) {
      context.addIssue({
        code: 'custom',
        message: 'Later capability version requires a predecessor',
        path: ['predecessorCapabilityId']
      })
    }
  })

export const CertificationResultV1Schema = z
  .object({
    ...tenantRecordFields('certification-result', CertificationIdSchema),
    capabilityId: CapabilityIdSchema,
    capabilityVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    baselineCapabilityId: CapabilityIdSchema.nullable(),
    evaluationResultIds: uniqueIdArray(EvaluationResultIdSchema, {
      min: 1,
      max: 1_000,
      label: 'evaluationResultIds'
    }),
    measures: z.array(EvaluationMeasureV1Schema).min(1).max(256),
    protectedSliceResults: z.record(
      z.string().min(1).max(128),
      z.enum(['pass', 'fail', 'unknown'])
    ),
    repetitions: z.number().int().positive().max(10_000),
    status: z.enum(['passed', 'failed', 'inconclusive', 'stale', 'revoked']),
    limitations: z.array(ShortTextSchema).max(64),
    completedAt: IsoDateTimeSchema
  })
  .strict()
  .superRefine((certification, context) => {
    if (
      certification.status === 'passed' &&
      (certification.measures.some((measure) => measure.status !== 'pass') ||
        Object.values(certification.protectedSliceResults).some((status) => status !== 'pass'))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Passed certification cannot contain failed or unknown measures/slices',
        path: ['status']
      })
    }
  })

export const PromotionDecisionV1Schema = z
  .object({
    ...tenantRecordFields('promotion-decision', PromotionIdSchema),
    capabilityId: CapabilityIdSchema,
    capabilityVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    certificationId: CertificationIdSchema,
    stableCapabilityId: CapabilityIdSchema.nullable(),
    stage: z.enum(['shadow', 'canary', 'active', 'aborted']),
    trafficLimitPercent: z.number().min(0).max(100),
    taskLimit: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    timeLimitMs: z
      .number()
      .int()
      .positive()
      .max(365 * 24 * 60 * 60 * 1_000),
    abortConditions: z.array(ShortTextSchema).min(1).max(128),
    decidedBy: ActorSchema
  })
  .strict()

export const CapabilityUseV1Schema = z
  .object({
    ...missionRecordFields('capability-use', CapabilityUseIdSchema),
    capabilityId: CapabilityIdSchema,
    capabilityVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    assignmentId: AssignmentIdSchema,
    attemptId: AttemptIdSchema,
    modelRoute: ModelRouteSchema,
    inputDigest: Sha256Schema,
    outputDigest: Sha256Schema,
    evaluationResultIds: uniqueIdArray(EvaluationResultIdSchema, {
      max: 1_000,
      label: 'evaluationResultIds'
    }),
    outcome: z.enum(['helped', 'neutral', 'harmed', 'unknown']),
    usage: UsageSchema
  })
  .strict()

export const DriftSignalV1Schema = z
  .object({
    ...tenantRecordFields('drift-signal', DriftSignalIdSchema),
    capabilityId: CapabilityIdSchema,
    capabilityVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    windowStartedAt: IsoDateTimeSchema,
    windowEndedAt: IsoDateTimeSchema,
    baselineDigest: Sha256Schema,
    measures: z.array(EvaluationMeasureV1Schema).min(1).max(256),
    affectedUseIds: uniqueIdArray(CapabilityUseIdSchema, {
      max: 100_000,
      label: 'affectedUseIds'
    }),
    severity: z.enum(['info', 'warning', 'critical']),
    action: z.enum(['observe', 'pause', 'demote', 'revoke', 'recertify']),
    detectedBy: ActorSchema
  })
  .strict()
  .refine((signal) => Date.parse(signal.windowEndedAt) >= Date.parse(signal.windowStartedAt), {
    message: 'windowEndedAt must not precede windowStartedAt',
    path: ['windowEndedAt']
  })

export type LearningCandidateV1 = z.infer<typeof LearningCandidateV1Schema>
export type CapabilityManifestV1 = z.infer<typeof CapabilityManifestV1Schema>
export type CertificationResultV1 = z.infer<typeof CertificationResultV1Schema>
export type PromotionDecisionV1 = z.infer<typeof PromotionDecisionV1Schema>
export type CapabilityUseV1 = z.infer<typeof CapabilityUseV1Schema>
export type DriftSignalV1 = z.infer<typeof DriftSignalV1Schema>
