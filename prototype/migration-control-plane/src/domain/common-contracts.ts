import { z } from 'zod'

export const DOMAIN_SCHEMA_VERSION = 1 as const
export const MAX_SAFE_REVISION = Number.MAX_SAFE_INTEGER

const ID_BODY = '[a-z0-9][a-z0-9_-]{0,111}'
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const URI_PATTERN = /^[a-z][a-z0-9+.-]*:/i
const MEDIA_TYPE_PATTERN = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i

function opaqueId(prefix: string): z.ZodString {
  return z
    .string()
    .min(prefix.length + 2)
    .max(128)
    .regex(new RegExp(`^${prefix}_${ID_BODY}$`))
}

export const TenantIdSchema = opaqueId('tenant').brand<'TenantId'>()
export const MissionIdSchema = opaqueId('mission').brand<'MissionId'>()
export const CommandIdSchema = opaqueId('command').brand<'CommandId'>()
export const EventIdSchema = opaqueId('event').brand<'EventId'>()
export const EvidenceIdSchema = opaqueId('evidence').brand<'EvidenceId'>()
export const PropositionIdSchema = opaqueId('proposition').brand<'PropositionId'>()
export const AssertionIdSchema = opaqueId('assertion').brand<'AssertionId'>()
export const ContradictionIdSchema = opaqueId('contradiction').brand<'ContradictionId'>()
export const GapIdSchema = opaqueId('gap').brand<'GapId'>()
export const ProbeIdSchema = opaqueId('probe').brand<'ProbeId'>()
export const FindingIdSchema = opaqueId('finding').brand<'FindingId'>()
export const ProbeResultIdSchema = opaqueId('probe_result').brand<'ProbeResultId'>()
export const ImpactReviewIdSchema = opaqueId('impact').brand<'ImpactReviewId'>()
export const DecisionIdSchema = opaqueId('decision').brand<'DecisionId'>()
export const PlanRevisionIdSchema = opaqueId('plan').brand<'PlanRevisionId'>()
export const TaskIdSchema = opaqueId('task').brand<'TaskId'>()
export const AssignmentIdSchema = opaqueId('assignment').brand<'AssignmentId'>()
export const AttemptIdSchema = opaqueId('attempt').brand<'AttemptId'>()
export const ContextManifestIdSchema = opaqueId('context').brand<'ContextManifestId'>()
export const AssignmentResultIdSchema = opaqueId('assignment_result').brand<'AssignmentResultId'>()
export const ArtifactIdSchema = opaqueId('artifact').brand<'ArtifactId'>()
export const ArtifactVersionIdSchema = opaqueId('artifact_version').brand<'ArtifactVersionId'>()
export const ArtifactBuildBundleIdSchema =
  opaqueId('artifact_build_bundle').brand<'ArtifactBuildBundleId'>()
export const ArtifactBuildReportIdSchema =
  opaqueId('artifact_build_report').brand<'ArtifactBuildReportId'>()
export const DataMovementReportIdSchema =
  opaqueId('data_movement_report').brand<'DataMovementReportId'>()
export const DeterministicEvaluatorSuiteIdSchema =
  opaqueId('deterministic_evaluator').brand<'DeterministicEvaluatorSuiteId'>()
export const EvaluatorIdSchema = opaqueId('evaluator').brand<'EvaluatorId'>()
export const EvaluationContractIdSchema =
  opaqueId('evaluation_contract').brand<'EvaluationContractId'>()
export const EvaluationAssignmentIdSchema =
  opaqueId('evaluation_assignment').brand<'EvaluationAssignmentId'>()
export const EvaluationCoordinationIdSchema =
  opaqueId('evaluation_coordination').brand<'EvaluationCoordinationId'>()
export const EvaluationReportIdSchema = opaqueId('evaluation_report').brand<'EvaluationReportId'>()
export const SemanticCorpusIdSchema = opaqueId('semantic_corpus').brand<'SemanticCorpusId'>()
export const SemanticReportIdSchema = opaqueId('semantic_report').brand<'SemanticReportId'>()
export const EvaluationResultIdSchema = opaqueId('evaluation_result').brand<'EvaluationResultId'>()
export const SubjectAcceptanceIdSchema =
  opaqueId('subject_acceptance').brand<'SubjectAcceptanceId'>()
export const EvaluationDiagnosisIdSchema =
  opaqueId('evaluation_diagnosis').brand<'EvaluationDiagnosisId'>()
export const CorrectionCycleIdSchema = opaqueId('correction_cycle').brand<'CorrectionCycleId'>()
export const CorrectionRequestIdSchema =
  opaqueId('correction_request').brand<'CorrectionRequestId'>()
export const CorrectionResultIdSchema = opaqueId('correction_result').brand<'CorrectionResultId'>()
export const LearningCandidateIdSchema = opaqueId('learning').brand<'LearningCandidateId'>()
export const CapabilityIdSchema = opaqueId('capability').brand<'CapabilityId'>()
export const CertificationIdSchema = opaqueId('certification').brand<'CertificationId'>()
export const PromotionIdSchema = opaqueId('promotion').brand<'PromotionId'>()
export const CapabilityUseIdSchema = opaqueId('capability_use').brand<'CapabilityUseId'>()
export const DriftSignalIdSchema = opaqueId('drift').brand<'DriftSignalId'>()
export const EffectIdSchema = opaqueId('effect').brand<'EffectId'>()
export const PolicyDecisionIdSchema = opaqueId('policy').brand<'PolicyDecisionId'>()
export const CapabilityEnvelopeIdSchema = opaqueId('envelope').brand<'CapabilityEnvelopeId'>()
export const SecretLeaseIdSchema = opaqueId('secret_lease').brand<'SecretLeaseId'>()
export const EffectAttemptIdSchema = opaqueId('effect_attempt').brand<'EffectAttemptId'>()
export const EffectReceiptIdSchema = opaqueId('receipt').brand<'EffectReceiptId'>()
export const TargetObservationIdSchema =
  opaqueId('target_observation').brand<'TargetObservationId'>()
export const RecoveryDispositionIdSchema = opaqueId('recovery').brand<'RecoveryDispositionId'>()
export const CompensationIdSchema = opaqueId('compensation').brand<'CompensationId'>()

export const RevisionSchema = z.number().int().nonnegative().max(MAX_SAFE_REVISION)
export const PositiveVersionSchema = z.number().int().positive().max(MAX_SAFE_REVISION)
export const FenceSchema = z.number().int().positive().max(MAX_SAFE_REVISION)
export const IsoDateTimeSchema = z.iso.datetime({ offset: true })
export const Sha256Schema = z.string().regex(SHA256_PATTERN)
export const UriSchema = z.string().min(3).max(4_096).regex(URI_PATTERN)
export const MediaTypeSchema = z.string().min(3).max(255).regex(MEDIA_TYPE_PATTERN)
export const NonEmptyTextSchema = z.string().min(1).max(32_768)
export const ShortTextSchema = z.string().min(1).max(512)
export const JsonValueSchema = z.json()

export const DataClassSchema = z.enum([
  'synthetic',
  'public',
  'internal',
  'confidential',
  'restricted',
  'phi'
])

export const ActorSchema = z
  .object({
    kind: z.enum(['system', 'operator', 'apex', 'specialist', 'evaluator', 'adapter']),
    id: z.string().min(1).max(128),
    version: z.string().min(1).max(128).optional()
  })
  .strict()

export const SourceSpanSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('whole') }).strict(),
  z
    .object({
      kind: z.literal('text-lines'),
      startLine: z.number().int().positive().max(MAX_SAFE_REVISION),
      endLine: z.number().int().positive().max(MAX_SAFE_REVISION)
    })
    .strict()
    .refine((span) => span.endLine >= span.startLine, {
      message: 'endLine must be greater than or equal to startLine',
      path: ['endLine']
    }),
  z
    .object({
      kind: z.literal('json-pointer'),
      pointer: z
        .string()
        .max(4_096)
        .regex(/^(?:\/[^/]*)*$/)
    })
    .strict()
])

export const ContractSchemaReferenceSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(256)
      .regex(/^[a-z][a-z0-9-]*\.v[1-9][0-9]*$/),
    version: PositiveVersionSchema,
    digest: Sha256Schema
  })
  .strict()

export const ContentReferenceSchema = z
  .object({
    uri: UriSchema,
    sha256: Sha256Schema,
    mediaType: MediaTypeSchema,
    bytes: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    span: SourceSpanSchema.default({ kind: 'whole' })
  })
  .strict()

export const DomainScopeSchema = z
  .object({
    environment: z.string().min(1).max(128),
    system: z.string().min(1).max(256),
    entity: z.string().min(1).max(256).optional(),
    attributes: z.record(z.string().min(1).max(128), z.string().max(512)).optional()
  })
  .strict()

export const BudgetSchema = z
  .object({
    tokenLimit: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    timeLimitMs: z.number().int().positive().max(86_400_000),
    toolCallLimit: z.number().int().nonnegative().max(100_000),
    outputByteLimit: z
      .number()
      .int()
      .positive()
      .max(64 * 1024 * 1024),
    costLimitUsd: z.number().nonnegative().max(1_000_000)
  })
  .strict()

export const UsageSchema = z
  .object({
    inputTokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    outputTokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    cacheReadTokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    cacheWriteTokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    toolCalls: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    wallTimeMs: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    costUsd: z.number().nonnegative().max(1_000_000)
  })
  .strict()

export const ModelRouteSchema = z
  .object({
    provider: z.string().min(1).max(128),
    model: z.string().min(1).max(256),
    revision: z.string().min(1).max(256),
    effort: z.enum(['lo', 'med', 'hi']),
    dataClasses: z.array(DataClassSchema).min(1).max(6)
  })
  .strict()

export const ToolReferenceSchema = z
  .object({
    name: z.string().min(1).max(128),
    version: z.string().min(1).max(128),
    schemaDigest: Sha256Schema,
    approval: z.enum(['read', 'write', 'exec'])
  })
  .strict()

export const RecordLabelsSchema = z
  .record(z.string().min(1).max(64), z.string().max(256))
  .superRefine((labels, context) => {
    if (Object.keys(labels).length > 32) {
      context.addIssue({ code: 'custom', message: 'At most 32 labels are allowed' })
    }
  })

export function tenantRecordFields<TKind extends string, TId extends z.ZodType>(
  kind: TKind,
  id: TId
): {
  schemaVersion: z.ZodLiteral<typeof DOMAIN_SCHEMA_VERSION>
  kind: z.ZodLiteral<TKind>
  id: TId
  tenantId: typeof TenantIdSchema
  createdAt: typeof IsoDateTimeSchema
} {
  return {
    schemaVersion: z.literal(DOMAIN_SCHEMA_VERSION),
    kind: z.literal(kind),
    id,
    tenantId: TenantIdSchema,
    createdAt: IsoDateTimeSchema
  }
}

export function missionRecordFields<TKind extends string, TId extends z.ZodType>(
  kind: TKind,
  id: TId
): {
  schemaVersion: z.ZodLiteral<typeof DOMAIN_SCHEMA_VERSION>
  kind: z.ZodLiteral<TKind>
  id: TId
  tenantId: typeof TenantIdSchema
  missionId: typeof MissionIdSchema
  createdAt: typeof IsoDateTimeSchema
} {
  return {
    schemaVersion: z.literal(DOMAIN_SCHEMA_VERSION),
    kind: z.literal(kind),
    id,
    tenantId: TenantIdSchema,
    missionId: MissionIdSchema,
    createdAt: IsoDateTimeSchema
  }
}

export function uniqueIdArray<T extends z.ZodType>(
  item: T,
  options: { min?: number; max?: number; label: string }
): z.ZodArray<T> {
  return z
    .array(item)
    .min(options.min ?? 0)
    .max(options.max ?? 1_000)
    .superRefine((values, context) => {
      if (new Set(values).size !== values.length) {
        context.addIssue({ code: 'custom', message: `${options.label} must be unique` })
      }
    })
}

export type Actor = z.infer<typeof ActorSchema>
export type ContentReference = z.infer<typeof ContentReferenceSchema>
export type DomainScope = z.infer<typeof DomainScopeSchema>
export type Budget = z.infer<typeof BudgetSchema>
export type Usage = z.infer<typeof UsageSchema>
