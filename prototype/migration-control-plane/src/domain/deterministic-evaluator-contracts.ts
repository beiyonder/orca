import { z } from 'zod'
import {
  ActorSchema,
  DeterministicEvaluatorSuiteIdSchema,
  EvaluationAssignmentIdSchema,
  EvaluationReportIdSchema,
  IsoDateTimeSchema,
  JsonValueSchema,
  MissionIdSchema,
  PositiveVersionSchema,
  Sha256Schema,
  ShortTextSchema,
  TenantIdSchema
} from './common-contracts.js'
import { EvaluationSubjectReferenceV2Schema } from './evaluation-assignment-contracts-v2.js'
import { EvaluationSubjectContractV2Schema } from './evaluation-contracts-v2.js'
import { EvaluatorDefinitionReferenceV2Schema } from './evaluation-definition-contracts-v2.js'

export const DeterministicEvaluatorCheckSchema = z.enum([
  'structural-schema',
  'runtime-types',
  'contract-lineage',
  'version-compatibility',
  'authority-policy'
])

const DeterministicEvaluatorPredecessorSchema = z.strictObject({
  id: DeterministicEvaluatorSuiteIdSchema,
  version: PositiveVersionSchema,
  digest: Sha256Schema
})

export const DeterministicEvaluatorSuiteReferenceSchema = z.strictObject({
  id: DeterministicEvaluatorSuiteIdSchema,
  version: PositiveVersionSchema,
  digest: Sha256Schema
})

export const DeterministicEvaluatorOperationSchema = z.strictObject({
  measureName: z.string().min(1).max(128),
  check: DeterministicEvaluatorCheckSchema,
  evidenceRequired: z.literal(true),
  description: ShortTextSchema
})

export const DeterministicEvaluatorSuiteV1Schema = z
  .strictObject({
    schemaVersion: z.literal(1),
    kind: z.literal('deterministic-evaluator-suite'),
    id: DeterministicEvaluatorSuiteIdSchema,
    tenantId: TenantIdSchema,
    createdAt: IsoDateTimeSchema,
    suiteKey: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[a-z0-9][a-z0-9_-]*$/),
    version: PositiveVersionSchema,
    predecessor: DeterministicEvaluatorPredecessorSchema.nullable(),
    evaluatorDefinition: EvaluatorDefinitionReferenceV2Schema,
    subject: EvaluationSubjectContractV2Schema,
    operations: z.array(DeterministicEvaluatorOperationSchema).length(5),
    executionPolicy: z.strictObject({
      network: z.literal('none'),
      filesystem: z.literal('none'),
      mutationAuthority: z.literal('none'),
      modelUse: z.literal('none'),
      maximumSubjectBytes: z
        .number()
        .int()
        .positive()
        .max(64 * 1024 * 1024),
      maximumEvidenceItems: z.number().int().positive().max(10_000),
      maximumWallTimeMs: z.number().int().positive().max(86_400_000)
    }),
    createdBy: ActorSchema,
    limitations: z.array(ShortTextSchema).max(64),
    revokedAt: IsoDateTimeSchema.nullable()
  })
  .superRefine((suite, context) => {
    if ((suite.version === 1) !== (suite.predecessor === null)) {
      context.addIssue({
        code: 'custom',
        message: 'Only the first deterministic evaluator suite may omit a predecessor'
      })
    }
    if (suite.predecessor !== null && suite.predecessor.version !== suite.version - 1) {
      context.addIssue({
        code: 'custom',
        message: 'Deterministic evaluator predecessor must be immediately prior'
      })
    }
    const measureNames = suite.operations.map((operation) => operation.measureName)
    const checks = suite.operations.map((operation) => operation.check)
    if (new Set(measureNames).size !== measureNames.length) {
      context.addIssue({ code: 'custom', message: 'Deterministic measure names must be unique' })
    }
    const checkSet = new Set(checks)
    if (
      checkSet.size !== DeterministicEvaluatorCheckSchema.options.length ||
      DeterministicEvaluatorCheckSchema.options.some((check) => !checkSet.has(check))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Deterministic suite must define every required check exactly once'
      })
    }
    if (suite.revokedAt !== null && Date.parse(suite.revokedAt) < Date.parse(suite.createdAt)) {
      context.addIssue({ code: 'custom', message: 'Suite revocation cannot predate creation' })
    }
  })

export const DeterministicEvaluationCheckResultSchema = z.strictObject({
  measureName: z.string().min(1).max(128),
  check: DeterministicEvaluatorCheckSchema,
  status: z.enum(['pass', 'fail']),
  value: z.boolean(),
  failureCode: z.string().min(1).max(128).nullable(),
  details: JsonValueSchema
})

export const DeterministicEvaluationReportV1Schema = z
  .strictObject({
    schemaVersion: z.literal(1),
    kind: z.literal('evaluation-deterministic-report'),
    id: EvaluationReportIdSchema,
    tenantId: TenantIdSchema,
    missionId: MissionIdSchema,
    createdAt: IsoDateTimeSchema,
    assignmentId: EvaluationAssignmentIdSchema,
    assignmentDigest: Sha256Schema,
    evaluatorDefinition: EvaluatorDefinitionReferenceV2Schema,
    suite: DeterministicEvaluatorSuiteReferenceSchema,
    subject: EvaluationSubjectReferenceV2Schema,
    checks: z.array(DeterministicEvaluationCheckResultSchema).length(5),
    status: z.enum(['passed', 'failed', 'stale']),
    observedAt: IsoDateTimeSchema,
    limitations: z.array(ShortTextSchema).max(64),
    acceptanceAuthority: z.literal('none')
  })
  .superRefine((report, context) => {
    const checks = report.checks.map((check) => check.check)
    const measures = report.checks.map((check) => check.measureName)
    if (
      new Set(checks).size !== DeterministicEvaluatorCheckSchema.options.length ||
      new Set(measures).size !== measures.length
    ) {
      context.addIssue({ code: 'custom', message: 'Report checks and measures must be unique' })
    }
    for (const [index, check] of report.checks.entries()) {
      if (
        (check.status === 'fail') !== (check.failureCode !== null) ||
        check.value !== (check.status === 'pass')
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Check status, value, and failure code must agree',
          path: ['checks', index]
        })
      }
    }
    if (report.status === 'passed' && report.checks.some((check) => check.status !== 'pass')) {
      context.addIssue({ code: 'custom', message: 'Passing report requires every check to pass' })
    }
    if (report.status === 'failed' && !report.checks.some((check) => check.status === 'fail')) {
      context.addIssue({ code: 'custom', message: 'Failed report requires a failed check' })
    }
  })

export type DeterministicEvaluatorSuiteV1 = z.infer<typeof DeterministicEvaluatorSuiteV1Schema>
export type DeterministicEvaluationReportV1 = z.infer<typeof DeterministicEvaluationReportV1Schema>
