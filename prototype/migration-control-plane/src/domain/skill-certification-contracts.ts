import { z } from 'zod'
import {
  ActorSchema,
  CertificationIdSchema,
  ContentReferenceSchema,
  EvaluationResultIdSchema,
  IsoDateTimeSchema,
  Sha256Schema,
  ShortTextSchema,
  tenantRecordFields,
  uniqueIdArray
} from './common-contracts.js'
import { EvaluationContractReferenceV2Schema } from './evaluation-definition-contracts-v2.js'
import { SkillIdSchema, SkillVersionIdSchema } from './skill-contracts.js'

const localId = (prefix: string) =>
  z
    .string()
    .min(prefix.length + 2)
    .max(128)
    .regex(new RegExp(`^${prefix}_[a-z0-9][a-z0-9_-]{0,111}$`))

export const SkillActivePointerIdSchema = localId('skill_pointer').brand<'SkillActivePointerId'>()
export const SkillRegressionIdSchema = localId('skill_regression').brand<'SkillRegressionId'>()

const CertificationMetricSchema = z.strictObject({
  name: z.string().min(1).max(128),
  baseline: z.number(),
  candidate: z.number(),
  minimumDelta: z.number().nonnegative(),
  hard: z.boolean(),
  status: z.enum(['pass', 'fail'])
})

export const SkillCertificationV1Schema = z
  .strictObject({
    ...tenantRecordFields('skill-certification', CertificationIdSchema),
    skillId: SkillIdSchema,
    skillVersionId: SkillVersionIdSchema,
    baselineSkillVersionId: SkillVersionIdSchema,
    candidateArtifactDigest: Sha256Schema,
    baselineArtifactDigest: Sha256Schema,
    corpora: z.strictObject({
      selection: ContentReferenceSchema,
      heldOut: ContentReferenceSchema,
      adversarial: ContentReferenceSchema
    }),
    evaluatorContracts: z.array(EvaluationContractReferenceV2Schema).min(1).max(128),
    evaluationResultIds: uniqueIdArray(EvaluationResultIdSchema, {
      min: 1,
      max: 10_000,
      label: 'evaluationResultIds'
    }),
    metrics: z.array(CertificationMetricSchema).min(1).max(256),
    protectedSlices: z.record(z.string().min(1).max(128), z.enum(['pass', 'fail', 'unknown'])),
    safetyGates: z
      .array(z.strictObject({ name: z.string().min(1).max(128), passed: z.boolean() }))
      .min(1)
      .max(256),
    envelope: z.strictObject({
      taskClasses: z.array(z.string().min(1).max(128)).min(1).max(128),
      dataClasses: z.array(z.string().min(1).max(128)).min(1).max(16),
      runtime: z.string().min(1).max(128),
      modelFamily: z.string().min(1).max(128)
    }),
    performance: z.strictObject({
      baselineCostUsd: z.number().nonnegative(),
      candidateCostUsd: z.number().nonnegative(),
      maximumCostUsd: z.number().nonnegative(),
      baselineLatencyMs: z.number().nonnegative(),
      candidateLatencyMs: z.number().nonnegative(),
      maximumLatencyMs: z.number().nonnegative()
    }),
    repetitions: z.number().int().positive().max(10_000),
    seeds: z.array(z.number().int().nonnegative()).min(1).max(10_000),
    rollbackSkillVersionId: SkillVersionIdSchema,
    status: z.enum(['passed', 'failed']),
    certifiedAt: IsoDateTimeSchema,
    certifiedBy: ActorSchema,
    limitations: z.array(ShortTextSchema).max(64),
    acceptanceAuthority: z.literal('skill-registry-only')
  })
  .superRefine((certification, context) => {
    const corpusDigests = Object.values(certification.corpora).map((corpus) => corpus.sha256)
    if (new Set(corpusDigests).size !== corpusDigests.length) {
      context.addIssue({ code: 'custom', message: 'Certification corpora must be distinct' })
    }
    const metricNames = certification.metrics.map((metric) => metric.name)
    if (new Set(metricNames).size !== metricNames.length) {
      context.addIssue({ code: 'custom', message: 'Certification metrics must be unique' })
    }
    const safetyGateNames = certification.safetyGates.map((gate) => gate.name)
    if (new Set(safetyGateNames).size !== safetyGateNames.length) {
      context.addIssue({ code: 'custom', message: 'Certification safety gates must be unique' })
    }
    if (
      certification.seeds.length !== certification.repetitions ||
      new Set(certification.seeds).size !== certification.seeds.length
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Certification seeds must be unique and match repetitions'
      })
    }
    if (Object.keys(certification.protectedSlices).length === 0) {
      context.addIssue({ code: 'custom', message: 'Certification requires protected slices' })
    }
    const metricsPass = certification.metrics.every(
      (metric) =>
        metric.status === 'pass' && metric.candidate - metric.baseline >= metric.minimumDelta
    )
    const protectedPass = Object.values(certification.protectedSlices).every(
      (status) => status === 'pass'
    )
    const safetyPass = certification.safetyGates.every((gate) => gate.passed)
    const performancePass =
      certification.performance.candidateCostUsd <= certification.performance.maximumCostUsd &&
      certification.performance.candidateLatencyMs <= certification.performance.maximumLatencyMs
    const passed = metricsPass && protectedPass && safetyPass && performancePass
    if ((certification.status === 'passed') !== passed) {
      context.addIssue({ code: 'custom', message: 'Certification status disagrees with gates' })
    }
    if (
      certification.skillVersionId === certification.baselineSkillVersionId ||
      certification.rollbackSkillVersionId !== certification.baselineSkillVersionId
    ) {
      context.addIssue({ code: 'custom', message: 'Certification rollback baseline is invalid' })
    }
  })

export const SkillActivePointerV1Schema = z.strictObject({
  ...tenantRecordFields('skill-active-pointer', SkillActivePointerIdSchema),
  skillId: SkillIdSchema,
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  activeSkillVersionId: SkillVersionIdSchema.nullable(),
  predecessorPointerId: SkillActivePointerIdSchema.nullable(),
  certificationId: CertificationIdSchema.nullable(),
  status: z.enum(['active', 'paused', 'revoked']),
  changedAt: IsoDateTimeSchema,
  reason: ShortTextSchema,
  changedBy: ActorSchema
})

export const SkillRegressionV1Schema = z.strictObject({
  ...tenantRecordFields('skill-regression', SkillRegressionIdSchema),
  skillId: SkillIdSchema,
  regressedSkillVersionId: SkillVersionIdSchema,
  priorStableSkillVersionId: SkillVersionIdSchema,
  certificationId: CertificationIdSchema,
  failedMetrics: z.array(z.string().min(1).max(128)).min(1).max(256),
  affectedUseIds: z.array(z.string().min(1).max(128)).max(100_000),
  affectedOutputIds: z.array(z.string().min(1).max(128)).max(100_000),
  action: z.enum(['demote', 'revoke']),
  inFlightDisposition: z.enum(['finish-current', 'cancel-safe', 'quarantine-output']),
  restoredSkillVersionId: SkillVersionIdSchema,
  reEvaluationResultIds: uniqueIdArray(EvaluationResultIdSchema, {
    max: 10_000,
    label: 'reEvaluationResultIds'
  }),
  detectedAt: IsoDateTimeSchema,
  detectedBy: ActorSchema,
  applied: z.literal(true)
})

export type SkillCertificationV1 = z.infer<typeof SkillCertificationV1Schema>
export type SkillActivePointerV1 = z.infer<typeof SkillActivePointerV1Schema>
export type SkillRegressionV1 = z.infer<typeof SkillRegressionV1Schema>
