import { z } from 'zod'
import {
  ActorSchema,
  AssignmentIdSchema,
  AttemptIdSchema,
  BudgetSchema,
  ContentReferenceSchema,
  ContextManifestIdSchema,
  CorrectionRequestIdSchema,
  CorrectionResultIdSchema,
  EvaluationAssignmentIdSchema,
  EvaluationContractIdSchema,
  EvaluationResultIdSchema,
  EvaluatorIdSchema,
  EvidenceIdSchema,
  FenceSchema,
  GapIdSchema,
  IsoDateTimeSchema,
  JsonValueSchema,
  Sha256Schema,
  ShortTextSchema,
  ToolReferenceSchema,
  UsageSchema,
  missionRecordFields,
  tenantRecordFields,
  uniqueIdArray
} from './common-contracts.js'

export const EvaluatorIndependencePolicySchema = z
  .object({
    producerMayEvaluate: z.literal(false),
    process: z.enum(['different-required', 'recorded']),
    model: z.enum(['different-required', 'different-preferred', 'not-applicable']),
    provider: z.enum(['different-required', 'different-preferred', 'not-applicable']),
    context: z.enum(['independent-required', 'recorded']),
    credentials: z.enum(['separate-required', 'not-applicable']),
    producerReasoningVisible: z.literal(false)
  })
  .strict()

export const EvaluatorMeasureDefinitionSchema = z
  .object({
    name: z.string().min(1).max(128),
    valueType: z.enum(['boolean', 'integer', 'number', 'string', 'json']),
    unit: z.string().max(64),
    hard: z.boolean(),
    required: z.boolean(),
    operator: z.enum(['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'contains', 'custom']),
    threshold: JsonValueSchema,
    description: ShortTextSchema
  })
  .strict()

export const EvaluatorDefinitionV1Schema = z
  .object({
    ...tenantRecordFields('evaluator-definition', EvaluatorIdSchema),
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    evaluatorType: z.enum(['deterministic', 'model', 'human', 'composite']),
    implementation: ContentReferenceSchema,
    supportedSubjectKinds: z.array(z.string().min(1).max(128)).min(1).max(128),
    supportedSubjectSchemaVersions: z.array(z.number().int().positive()).min(1).max(128),
    requiredTools: z.array(ToolReferenceSchema).max(128),
    independence: EvaluatorIndependencePolicySchema,
    measures: z.array(EvaluatorMeasureDefinitionSchema).min(1).max(256),
    calibrationCorpus: ContentReferenceSchema.nullable(),
    knownLimitations: z.array(ShortTextSchema).max(64),
    budget: BudgetSchema,
    revokedAt: IsoDateTimeSchema.nullable()
  })
  .strict()
  .superRefine((definition, context) => {
    const names = definition.measures.map((measure) => measure.name)
    if (new Set(names).size !== names.length) {
      context.addIssue({
        code: 'custom',
        message: 'Evaluator measure names must be unique',
        path: ['measures']
      })
    }
    if (definition.evaluatorType === 'model' && definition.calibrationCorpus === null) {
      context.addIssue({
        code: 'custom',
        message: 'Model evaluator requires a calibration corpus',
        path: ['calibrationCorpus']
      })
    }
  })

export const EvaluationContractMeasureSchema = EvaluatorMeasureDefinitionSchema.extend({
  evaluatorId: EvaluatorIdSchema,
  evaluatorVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
}).strict()

export const EvaluationContractV1Schema = z
  .object({
    ...tenantRecordFields('evaluation-contract', EvaluationContractIdSchema),
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    subjectKind: z.string().min(1).max(128),
    subjectSchemaVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    measures: z.array(EvaluationContractMeasureSchema).min(1).max(256),
    composition: z.enum(['all', 'any', 'ordered-gates']),
    independence: EvaluatorIndependencePolicySchema,
    maxAgeMs: z
      .number()
      .int()
      .positive()
      .max(365 * 24 * 60 * 60 * 1_000),
    correctionBudget: z.number().int().nonnegative().max(100),
    unavailableDisposition: z.literal('unaccepted'),
    contradictoryDisposition: z.enum(['unaccepted', 'quarantined']),
    revokedAt: IsoDateTimeSchema.nullable()
  })
  .strict()
  .superRefine((contract, context) => {
    const names = contract.measures.map((measure) => measure.name)
    if (new Set(names).size !== names.length) {
      context.addIssue({
        code: 'custom',
        message: 'Contract measure names must be unique',
        path: ['measures']
      })
    }
    if (!contract.measures.some((measure) => measure.hard && measure.required)) {
      context.addIssue({
        code: 'custom',
        message: 'Evaluation contract requires at least one hard required measure',
        path: ['measures']
      })
    }
  })

export const EvaluationSubjectReferenceSchema = z
  .object({
    kind: z.string().min(1).max(128),
    id: z.string().min(1).max(128),
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    schemaVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    digest: Sha256Schema
  })
  .strict()

export const EvaluationAssignmentV1Schema = z
  .object({
    ...missionRecordFields('evaluation-assignment', EvaluationAssignmentIdSchema),
    contractId: EvaluationContractIdSchema,
    contractVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    evaluatorId: EvaluatorIdSchema,
    evaluatorVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    subject: EvaluationSubjectReferenceSchema,
    contextManifestId: ContextManifestIdSchema,
    inputEvidenceIds: uniqueIdArray(EvidenceIdSchema, {
      max: 10_000,
      label: 'inputEvidenceIds'
    }),
    producer: z
      .object({
        actor: ActorSchema,
        assignmentId: AssignmentIdSchema,
        attemptId: AttemptIdSchema,
        fence: FenceSchema
      })
      .strict(),
    evaluatorAttemptId: AttemptIdSchema,
    evaluatorFence: FenceSchema,
    deadlineAt: IsoDateTimeSchema,
    budget: BudgetSchema
  })
  .strict()

export const EvaluationMeasureV1Schema = z
  .object({
    name: z.string().min(1).max(128),
    status: z.enum(['pass', 'fail', 'unknown']),
    value: JsonValueSchema,
    threshold: JsonValueSchema,
    evidenceIds: uniqueIdArray(EvidenceIdSchema, {
      max: 10_000,
      label: 'evidenceIds'
    }),
    failureCode: z.string().min(1).max(128).nullable()
  })
  .strict()
  .superRefine((measure, context) => {
    if (measure.status === 'fail' && measure.failureCode === null) {
      context.addIssue({
        code: 'custom',
        message: 'Failed measure requires failureCode',
        path: ['failureCode']
      })
    }
    if (measure.status !== 'fail' && measure.failureCode !== null) {
      context.addIssue({
        code: 'custom',
        message: 'Only failed measure may have failureCode',
        path: ['failureCode']
      })
    }
  })

export const EvaluationResultV1Schema = z
  .object({
    ...missionRecordFields('evaluation-result', EvaluationResultIdSchema),
    assignmentId: EvaluationAssignmentIdSchema,
    contractId: EvaluationContractIdSchema,
    contractVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    evaluatorId: EvaluatorIdSchema,
    evaluatorVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    subject: EvaluationSubjectReferenceSchema,
    status: z.enum([
      'passed',
      'failed',
      'partial',
      'unavailable',
      'contradictory',
      'error',
      'stale'
    ]),
    measures: z.array(EvaluationMeasureV1Schema).max(256),
    coverage: z.enum(['complete', 'partial', 'unknown']),
    evidenceIds: uniqueIdArray(EvidenceIdSchema, {
      max: 10_000,
      label: 'evidenceIds'
    }),
    limitations: z.array(ShortTextSchema).max(64),
    usage: UsageSchema,
    completedAt: IsoDateTimeSchema,
    resultDigest: Sha256Schema
  })
  .strict()
  .superRefine((result, context) => {
    const names = result.measures.map((measure) => measure.name)
    if (new Set(names).size !== names.length) {
      context.addIssue({
        code: 'custom',
        message: 'Result measure names must be unique',
        path: ['measures']
      })
    }
    if (
      result.status === 'passed' &&
      (result.coverage !== 'complete' ||
        result.measures.length === 0 ||
        result.measures.some((measure) => measure.status !== 'pass'))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Passed result requires complete coverage and only passing measures',
        path: ['status']
      })
    }
    if (
      result.status === 'failed' &&
      !result.measures.some((measure) => measure.status === 'fail')
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Failed result requires at least one failed measure',
        path: ['measures']
      })
    }
  })

export const CorrectionRequestV1Schema = z
  .object({
    ...missionRecordFields('correction-request', CorrectionRequestIdSchema),
    failedSubject: EvaluationSubjectReferenceSchema,
    evaluationResultIds: uniqueIdArray(EvaluationResultIdSchema, {
      min: 1,
      max: 128,
      label: 'evaluationResultIds'
    }),
    failedMeasureNames: z.array(z.string().min(1).max(128)).min(1).max(256),
    gapIds: uniqueIdArray(GapIdSchema, { min: 1, max: 1_000, label: 'gapIds' }),
    allowedMutationPaths: z.array(z.string().min(1).max(1_024)).min(1).max(256),
    acceptanceContractId: EvaluationContractIdSchema,
    acceptanceContractVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    attempt: z.number().int().positive().max(100),
    maxAttempts: z.number().int().positive().max(100),
    requestedBy: ActorSchema
  })
  .strict()
  .refine((request) => request.attempt <= request.maxAttempts, {
    message: 'Correction attempt exceeds maxAttempts',
    path: ['attempt']
  })

export const CorrectionResultV1Schema = z
  .object({
    ...missionRecordFields('correction-result', CorrectionResultIdSchema),
    requestId: CorrectionRequestIdSchema,
    priorSubject: EvaluationSubjectReferenceSchema,
    newSubject: EvaluationSubjectReferenceSchema,
    changedPaths: z.array(z.string().min(1).max(1_024)).min(1).max(256),
    evidenceIds: uniqueIdArray(EvidenceIdSchema, { max: 10_000, label: 'evidenceIds' }),
    unresolvedGapIds: uniqueIdArray(GapIdSchema, {
      max: 1_000,
      label: 'unresolvedGapIds'
    }),
    acceptanceContractId: EvaluationContractIdSchema,
    acceptanceContractVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    usage: UsageSchema,
    completedAt: IsoDateTimeSchema,
    producedBy: ActorSchema
  })
  .strict()
  .superRefine((result, context) => {
    if (
      result.newSubject.kind !== result.priorSubject.kind ||
      result.newSubject.id !== result.priorSubject.id ||
      result.newSubject.schemaVersion !== result.priorSubject.schemaVersion
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Correction must preserve logical subject identity and schema version',
        path: ['newSubject']
      })
    }
    if (result.newSubject.version <= result.priorSubject.version) {
      context.addIssue({
        code: 'custom',
        message: 'Corrected subject must advance its version',
        path: ['newSubject', 'version']
      })
    }
    if (result.newSubject.digest === result.priorSubject.digest) {
      context.addIssue({
        code: 'custom',
        message: 'Corrected subject digest must change',
        path: ['newSubject', 'digest']
      })
    }
  })

export type EvaluatorDefinitionV1 = z.infer<typeof EvaluatorDefinitionV1Schema>
export type EvaluationContractV1 = z.infer<typeof EvaluationContractV1Schema>
export type EvaluationAssignmentV1 = z.infer<typeof EvaluationAssignmentV1Schema>
export type EvaluationResultV1 = z.infer<typeof EvaluationResultV1Schema>
export type CorrectionRequestV1 = z.infer<typeof CorrectionRequestV1Schema>
export type CorrectionResultV1 = z.infer<typeof CorrectionResultV1Schema>
