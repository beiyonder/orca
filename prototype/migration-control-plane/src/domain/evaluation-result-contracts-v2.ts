import { z } from 'zod'
import {
  AttemptIdSchema,
  EvaluationAssignmentIdSchema,
  EvaluationResultIdSchema,
  FenceSchema,
  IsoDateTimeSchema,
  JsonValueSchema,
  MissionIdSchema,
  Sha256Schema,
  ShortTextSchema,
  TenantIdSchema,
  UsageSchema
} from './common-contracts.js'
import {
  EvaluationEvidenceReferenceV2Schema,
  EvaluationSubjectReferenceV2Schema
} from './evaluation-assignment-contracts-v2.js'
import {
  EvaluationContractReferenceV2Schema,
  EvaluatorDefinitionReferenceV2Schema
} from './evaluation-definition-contracts-v2.js'

export const EvaluationMeasureV2Schema = z
  .strictObject({
    name: z.string().min(1).max(128),
    status: z.enum(['pass', 'fail', 'unknown']),
    valueType: z.enum(['boolean', 'integer', 'number', 'string', 'json']),
    unit: z.string().max(64),
    value: JsonValueSchema,
    operator: z.enum(['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'contains', 'custom']),
    threshold: JsonValueSchema,
    evidence: z.array(EvaluationEvidenceReferenceV2Schema).max(10_000),
    failureCode: z.string().min(1).max(128).nullable()
  })
  .superRefine((measure, context) => {
    if ((measure.status === 'fail') !== (measure.failureCode !== null)) {
      context.addIssue({ code: 'custom', message: 'Only a failed measure requires a failure code' })
    }
  })

const EvaluationCoverageV2Schema = z.strictObject({
  requiredMeasureNames: z.array(z.string().min(1).max(128)).max(256),
  observedMeasureNames: z.array(z.string().min(1).max(128)).max(256),
  missingMeasureNames: z.array(z.string().min(1).max(128)).max(256),
  complete: z.boolean()
})

const EvaluationAssignmentReferenceV2Schema = z.strictObject({
  id: EvaluationAssignmentIdSchema,
  evaluatorAttemptId: AttemptIdSchema,
  evaluatorFence: FenceSchema,
  digest: Sha256Schema
})

export const EvaluationResultV2Schema = z
  .strictObject({
    schemaVersion: z.literal(2),
    kind: z.literal('evaluation-result'),
    id: EvaluationResultIdSchema,
    tenantId: TenantIdSchema,
    missionId: MissionIdSchema,
    createdAt: IsoDateTimeSchema,
    assignment: EvaluationAssignmentReferenceV2Schema,
    contract: EvaluationContractReferenceV2Schema,
    evaluatorDefinition: EvaluatorDefinitionReferenceV2Schema,
    subject: EvaluationSubjectReferenceV2Schema,
    status: z.enum([
      'passed',
      'failed',
      'partial',
      'unavailable',
      'contradictory',
      'error',
      'stale'
    ]),
    measures: z.array(EvaluationMeasureV2Schema).max(256),
    coverage: EvaluationCoverageV2Schema,
    evidence: z.array(EvaluationEvidenceReferenceV2Schema).max(10_000),
    limitations: z.array(ShortTextSchema).max(64),
    usage: UsageSchema,
    completedAt: IsoDateTimeSchema,
    resultDigest: Sha256Schema,
    acceptanceAuthority: z.literal('none')
  })
  .superRefine((result, context) => {
    if (Date.parse(result.completedAt) < Date.parse(result.createdAt)) {
      context.addIssue({ code: 'custom', message: 'Evaluation completion cannot predate creation' })
    }
    const measureNames = result.measures.map((measure) => measure.name)
    const measureNameSet = new Set(measureNames)
    if (measureNameSet.size !== measureNames.length) {
      context.addIssue({ code: 'custom', message: 'Evaluation result measures must be unique' })
    }
    const required = new Set(result.coverage.requiredMeasureNames)
    const observed = new Set(result.coverage.observedMeasureNames)
    const missing = new Set(result.coverage.missingMeasureNames)
    if (
      required.size !== result.coverage.requiredMeasureNames.length ||
      observed.size !== result.coverage.observedMeasureNames.length ||
      missing.size !== result.coverage.missingMeasureNames.length ||
      measureNames.some((name) => !observed.has(name)) ||
      [...observed].some((name) => !measureNameSet.has(name)) ||
      [...missing].some((name) => !required.has(name) || observed.has(name)) ||
      [...required].some((name) => !observed.has(name) && !missing.has(name)) ||
      result.coverage.complete !== (missing.size === 0)
    ) {
      context.addIssue({ code: 'custom', message: 'Evaluation result coverage disagrees' })
    }
    if (
      result.status === 'passed' &&
      (!result.coverage.complete ||
        result.measures.length === 0 ||
        result.measures.some((measure) => measure.status !== 'pass'))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Passed result requires complete passing coverage'
      })
    }
    if (
      result.status === 'failed' &&
      !result.measures.some((measure) => measure.status === 'fail')
    ) {
      context.addIssue({ code: 'custom', message: 'Failed result requires a failed measure' })
    }
    const evidence = new Set(
      result.evidence.map((item) => `${item.id}\u0000${item.version}\u0000${item.digest}`)
    )
    if (evidence.size !== result.evidence.length) {
      context.addIssue({ code: 'custom', message: 'Evaluation result evidence must be unique' })
    }
    if (
      result.measures.some((measure) =>
        measure.evidence.some(
          (item) => !evidence.has(`${item.id}\u0000${item.version}\u0000${item.digest}`)
        )
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Measure evidence must be included by the result'
      })
    }
  })

export type EvaluationResultV2 = z.infer<typeof EvaluationResultV2Schema>
