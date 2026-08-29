import { z } from 'zod'
import {
  ActorSchema,
  BudgetSchema,
  ContentReferenceSchema,
  DataClassSchema,
  EvaluationContractIdSchema,
  EvaluatorIdSchema,
  IsoDateTimeSchema,
  JsonValueSchema,
  ModelRouteSchema,
  PositiveVersionSchema,
  Sha256Schema,
  ShortTextSchema,
  TenantIdSchema,
  ToolReferenceSchema
} from './common-contracts.js'

export const EvaluatorDefinitionReferenceV2Schema = z.strictObject({
  id: EvaluatorIdSchema,
  version: PositiveVersionSchema,
  digest: Sha256Schema
})

export const EvaluationContractReferenceV2Schema = z.strictObject({
  id: EvaluationContractIdSchema,
  version: PositiveVersionSchema,
  digest: Sha256Schema
})

export const EvaluatorIndependenceRequirementV2Schema = z.strictObject({
  producerMayEvaluate: z.literal(false),
  process: z.enum(['different-required', 'not-applicable']),
  model: z.enum(['different-required', 'different-preferred', 'not-applicable']),
  provider: z.enum(['different-required', 'different-preferred', 'not-applicable']),
  context: z.literal('independent-required'),
  credentials: z.enum(['separate-required', 'not-applicable']),
  producerReasoningVisible: z.literal(false),
  sharedCorpus: z.enum(['separate-required', 'recorded', 'not-applicable'])
})

export const EvaluationMeasureDefinitionV2Schema = z
  .strictObject({
    name: z.string().min(1).max(128),
    valueType: z.enum(['boolean', 'integer', 'number', 'string', 'json']),
    unit: z.string().max(64),
    hard: z.boolean(),
    required: z.boolean(),
    operator: z.enum(['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'contains', 'custom']),
    threshold: JsonValueSchema,
    evidenceRequired: z.boolean(),
    description: ShortTextSchema
  })
  .superRefine((measure, context) => {
    if (measure.hard && measure.required && !measure.evidenceRequired) {
      context.addIssue({
        code: 'custom',
        message: 'Hard required measure requires evidence',
        path: ['evidenceRequired']
      })
    }
    if (
      ['lt', 'lte', 'gt', 'gte'].includes(measure.operator) &&
      !['integer', 'number'].includes(measure.valueType)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Ordered comparison requires a numeric measure',
        path: ['operator']
      })
    }
  })

const EvaluatorImplementationV2Schema = z.strictObject({
  version: z.string().min(1).max(256),
  artifact: ContentReferenceSchema,
  modelRoute: ModelRouteSchema.nullable()
})

const SupportedEvaluationSubjectV2Schema = z.strictObject({
  kind: z.string().min(1).max(128),
  schemaName: z
    .string()
    .min(1)
    .max(256)
    .regex(/^[a-z][a-z0-9-]*\.v[1-9][0-9]*$/),
  schemaVersion: PositiveVersionSchema,
  schemaDigest: Sha256Schema
})

const EvaluatorRetryPolicyV2Schema = z
  .strictObject({
    maxAttempts: z.number().int().positive().max(10),
    retryableFailureCodes: z.array(z.string().min(1).max(128)).max(64),
    backoffMs: z.number().int().nonnegative().max(3_600_000)
  })
  .superRefine((policy, context) => {
    if (new Set(policy.retryableFailureCodes).size !== policy.retryableFailureCodes.length) {
      context.addIssue({
        code: 'custom',
        message: 'Retryable evaluator failure codes must be unique',
        path: ['retryableFailureCodes']
      })
    }
  })

export const EvaluatorDefinitionV2Schema = z
  .strictObject({
    schemaVersion: z.literal(2),
    kind: z.literal('evaluator-definition'),
    id: EvaluatorIdSchema,
    tenantId: TenantIdSchema,
    createdAt: IsoDateTimeSchema,
    evaluatorKey: z.string().min(1).max(128),
    version: PositiveVersionSchema,
    predecessor: EvaluatorDefinitionReferenceV2Schema.nullable(),
    evaluatorType: z.enum(['deterministic', 'environment', 'model', 'human', 'composite']),
    implementation: EvaluatorImplementationV2Schema,
    supportedSubjects: z.array(SupportedEvaluationSubjectV2Schema).min(1).max(128),
    requiredTools: z.array(ToolReferenceSchema).max(128),
    requiredDataClasses: z.array(DataClassSchema).min(1).max(6),
    requiredAccess: z
      .array(z.enum(['none', 'read-source', 'read-target', 'sandbox-exec']))
      .min(1)
      .max(4),
    independence: EvaluatorIndependenceRequirementV2Schema,
    measures: z.array(EvaluationMeasureDefinitionV2Schema).min(1).max(256),
    calibrationCorpus: ContentReferenceSchema.nullable(),
    knownLimitations: z.array(ShortTextSchema).max(64),
    budget: BudgetSchema,
    retryPolicy: EvaluatorRetryPolicyV2Schema,
    createdBy: ActorSchema,
    revokedAt: IsoDateTimeSchema.nullable()
  })
  .superRefine((definition, context) => {
    if ((definition.version === 1) !== (definition.predecessor === null)) {
      context.addIssue({
        code: 'custom',
        message: 'Only the first evaluator version may omit a predecessor',
        path: ['predecessor']
      })
    }
    if (
      definition.predecessor !== null &&
      definition.predecessor.version !== definition.version - 1
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Evaluator predecessor must be the immediately prior version',
        path: ['predecessor', 'version']
      })
    }
    if (
      new Set(definition.measures.map((measure) => measure.name)).size !==
      definition.measures.length
    ) {
      context.addIssue({ code: 'custom', message: 'Evaluator measure names must be unique' })
    }
    const supported = definition.supportedSubjects.map(
      (subject) => `${subject.kind}\u0000${subject.schemaName}`
    )
    if (new Set(supported).size !== supported.length) {
      context.addIssue({ code: 'custom', message: 'Supported evaluator subjects must be unique' })
    }
    if (new Set(definition.requiredAccess).size !== definition.requiredAccess.length) {
      context.addIssue({ code: 'custom', message: 'Evaluator access requirements must be unique' })
    }
    if (definition.requiredAccess.includes('none') && definition.requiredAccess.length !== 1) {
      context.addIssue({
        code: 'custom',
        message: 'No-access evaluator cannot request other access'
      })
    }
    if (
      definition.evaluatorType === 'model' &&
      (definition.implementation.modelRoute === null || definition.calibrationCorpus === null)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Model evaluator requires an exact model route and calibration corpus'
      })
    }
    if (
      ['deterministic', 'environment', 'human'].includes(definition.evaluatorType) &&
      definition.implementation.modelRoute !== null
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Non-model evaluator cannot declare a model route',
        path: ['implementation', 'modelRoute']
      })
    }
    if (
      definition.revokedAt !== null &&
      Date.parse(definition.revokedAt) < Date.parse(definition.createdAt)
    ) {
      context.addIssue({ code: 'custom', message: 'Evaluator revocation cannot predate creation' })
    }
  })

export type EvaluatorDefinitionV2 = z.infer<typeof EvaluatorDefinitionV2Schema>
export type EvaluationMeasureDefinitionV2 = z.infer<typeof EvaluationMeasureDefinitionV2Schema>
export type EvaluatorIndependenceRequirementV2 = z.infer<
  typeof EvaluatorIndependenceRequirementV2Schema
>
