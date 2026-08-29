import { z } from 'zod'
import { canonicalJson, sha256Text } from '../canonical-json.js'
import {
  ActorSchema,
  AssignmentIdSchema,
  AttemptIdSchema,
  ContextManifestIdSchema,
  DataClassSchema,
  DomainScopeSchema,
  EvaluationResultIdSchema,
  EvidenceIdSchema,
  ImpactReviewIdSchema,
  IsoDateTimeSchema,
  MissionIdSchema,
  Sha256Schema,
  ShortTextSchema,
  tenantRecordFields,
  uniqueIdArray
} from './common-contracts.js'
import { RetrievalQueryIdSchema, RetrievalTraceIdSchema } from './retrieval-contracts.js'

const memoryId = (prefix: string) =>
  z
    .string()
    .min(prefix.length + 2)
    .max(128)
    .regex(new RegExp(`^${prefix}_[a-z0-9][a-z0-9_-]{0,111}$`))

export const MemoryCandidateIdSchema = memoryId('memory_candidate').brand<'MemoryCandidateId'>()
export const MemoryIdSchema = memoryId('memory').brand<'MemoryId'>()
export const MemoryVersionIdSchema = memoryId('memory_version').brand<'MemoryVersionId'>()
export const MemoryUseIdSchema = memoryId('memory_use').brand<'MemoryUseId'>()
export const MemoryInvalidationIdSchema =
  memoryId('memory_invalidation').brand<'MemoryInvalidationId'>()

export const MemoryTypeSchema = z.enum([
  'mission',
  'episodic',
  'procedural',
  'failure',
  'evaluator'
])
const MemoryApplicabilitySchema = z.strictObject({
  environment: z.string().min(1).max(128),
  product: z.string().min(1).max(256).nullable(),
  versionConstraint: z.string().min(1).max(256).nullable(),
  validFrom: IsoDateTimeSchema.nullable(),
  validUntil: IsoDateTimeSchema.nullable()
})
const MemoryRetentionSchema = z.strictObject({
  expiresAt: IsoDateTimeSchema.nullable(),
  deletionMode: z.enum(['retain', 'delete-content', 'delete-all', 'legal-hold']),
  policyId: z.string().min(1).max(256)
})

export const MemoryCandidateV1Schema = z
  .strictObject({
    ...tenantRecordFields('memory-candidate', MemoryCandidateIdSchema),
    memoryType: MemoryTypeSchema,
    missionId: MissionIdSchema.nullable(),
    sourceRecordIds: z.array(z.string().min(1).max(128)).max(10_000),
    sourceEvidenceIds: uniqueIdArray(EvidenceIdSchema, {
      max: 10_000,
      label: 'sourceEvidenceIds'
    }),
    proposedContent: z.json(),
    contentDigest: Sha256Schema,
    proposedScope: DomainScopeSchema,
    applicability: MemoryApplicabilitySchema,
    creationMethod: z.enum([
      'explicit',
      'accepted-outcome',
      'diagnosed-failure',
      'transcript-extraction',
      'import'
    ]),
    proposedBy: ActorSchema,
    creatorVersions: z.record(z.string().min(1).max(128), z.string().min(1).max(256)),
    reasonForRetention: ShortTextSchema,
    validationContractIds: z.array(z.string().min(1).max(128)).min(1).max(128),
    dataClass: DataClassSchema,
    retention: MemoryRetentionSchema,
    authorityDelta: z.literal('none'),
    state: z.strictObject({
      status: z.literal('quarantined'),
      usePolicy: z.literal('none'),
      validationStatus: z.literal('not-run')
    })
  })
  .superRefine((candidate, context) => {
    if (candidate.sourceRecordIds.length === 0 && candidate.sourceEvidenceIds.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'Memory candidate requires canonical provenance'
      })
    }
    if (sha256Text(canonicalJson(candidate.proposedContent)) !== candidate.contentDigest) {
      context.addIssue({ code: 'custom', message: 'Memory candidate content digest differs' })
    }
    const { validFrom, validUntil } = candidate.applicability
    if (
      validFrom !== null &&
      validUntil !== null &&
      Date.parse(validUntil) < Date.parse(validFrom)
    ) {
      context.addIssue({ code: 'custom', message: 'Memory applicability end precedes start' })
    }
  })

export const MemoryVersionStatusSchema = z.enum([
  'active',
  'aging',
  'stale',
  'deprecated',
  'revoked',
  'forgotten'
])

export const MemoryVersionV1Schema = z
  .strictObject({
    ...tenantRecordFields('memory-version', MemoryVersionIdSchema),
    memoryId: MemoryIdSchema,
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    candidateId: MemoryCandidateIdSchema,
    memoryType: MemoryTypeSchema,
    canonicalSourceRecordIds: z.array(z.string().min(1).max(128)).min(1).max(10_000),
    canonicalSourceEvidenceIds: uniqueIdArray(EvidenceIdSchema, {
      max: 10_000,
      label: 'canonicalSourceEvidenceIds'
    }),
    content: z.json().nullable(),
    contentDigest: Sha256Schema,
    scope: DomainScopeSchema,
    applicability: MemoryApplicabilitySchema,
    status: MemoryVersionStatusSchema,
    validationResultIds: uniqueIdArray(EvaluationResultIdSchema, {
      max: 1_000,
      label: 'validationResultIds'
    }),
    usePolicy: z.strictObject({
      allowRecall: z.boolean(),
      roles: z.array(z.string().min(1).max(128)).max(128),
      taskClasses: z.array(z.string().min(1).max(128)).max(128),
      dataClasses: z.array(DataClassSchema).min(1).max(6)
    }),
    supersedesVersionId: MemoryVersionIdSchema.nullable(),
    validFrom: IsoDateTimeSchema,
    validUntil: IsoDateTimeSchema.nullable(),
    createdBy: ActorSchema
  })
  .superRefine((memory, context) => {
    if (memory.version === 1 && memory.supersedesVersionId !== null) {
      context.addIssue({
        code: 'custom',
        message: 'First memory version cannot have a predecessor'
      })
    }
    if (memory.version > 1 && memory.supersedesVersionId === null) {
      context.addIssue({ code: 'custom', message: 'Later memory version requires a predecessor' })
    }
    if (memory.status === 'forgotten' ? memory.content !== null : memory.content === null) {
      context.addIssue({ code: 'custom', message: 'Only forgotten memory may omit content' })
    }
    if (
      memory.content !== null &&
      sha256Text(canonicalJson(memory.content)) !== memory.contentDigest
    ) {
      context.addIssue({ code: 'custom', message: 'Memory version content digest differs' })
    }
    const usable = memory.status === 'active' || memory.status === 'aging'
    if (usable !== memory.usePolicy.allowRecall) {
      context.addIssue({ code: 'custom', message: 'Memory status and recall policy disagree' })
    }
    if (usable && memory.validationResultIds.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'Recallable memory requires validation evidence'
      })
    }
  })

export const MemoryUseV1Schema = z.strictObject({
  ...tenantRecordFields('memory-use', MemoryUseIdSchema),
  memoryVersionId: MemoryVersionIdSchema,
  contextManifestId: ContextManifestIdSchema,
  assignmentId: AssignmentIdSchema,
  attemptId: AttemptIdSchema,
  retrievalQueryId: RetrievalQueryIdSchema,
  retrievalTraceId: RetrievalTraceIdSchema,
  channel: z.enum(['structured', 'lexical', 'semantic', 'graph']),
  rank: z.number().int().positive().max(10_000),
  score: z.number().nonnegative(),
  renderedDigest: Sha256Schema,
  downstreamRecordIds: z.array(z.string().min(1).max(128)).max(10_000),
  attribution: z.enum(['helped', 'neutral', 'harmed', 'unknown'])
})

export const MemoryInvalidationV1Schema = z
  .strictObject({
    ...tenantRecordFields('memory-invalidation', MemoryInvalidationIdSchema),
    memoryVersionId: MemoryVersionIdSchema,
    reason: z.enum([
      'source-invalidated',
      'stale',
      'conflict',
      'poison',
      'scope-error',
      'legal-delete',
      'evaluator-regression',
      'replaced'
    ]),
    evidenceIds: uniqueIdArray(EvidenceIdSchema, { min: 1, max: 1_000, label: 'evidenceIds' }),
    replacementVersionId: MemoryVersionIdSchema,
    impactedUseIds: uniqueIdArray(MemoryUseIdSchema, { max: 10_000, label: 'impactedUseIds' }),
    impactReviewIds: uniqueIdArray(ImpactReviewIdSchema, {
      max: 10_000,
      label: 'impactReviewIds'
    }),
    disposition: z.enum(['stale', 'deprecated', 'revoked', 'forgotten']),
    reasonDetail: ShortTextSchema,
    invalidatedBy: ActorSchema
  })
  .refine((invalidation) => invalidation.replacementVersionId !== invalidation.memoryVersionId, {
    message: 'Memory invalidation replacement must be a new version',
    path: ['replacementVersionId']
  })

export type MemoryCandidateV1 = z.infer<typeof MemoryCandidateV1Schema>
export type MemoryVersionV1 = z.infer<typeof MemoryVersionV1Schema>
export type MemoryUseV1 = z.infer<typeof MemoryUseV1Schema>
export type MemoryInvalidationV1 = z.infer<typeof MemoryInvalidationV1Schema>
