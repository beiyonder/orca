import { z } from 'zod'
import {
  ActorSchema,
  DataClassSchema,
  DomainScopeSchema,
  IsoDateTimeSchema,
  Sha256Schema,
  ShortTextSchema,
  SourceSpanSchema,
  tenantRecordFields,
  uniqueIdArray
} from './common-contracts.js'
import {
  CorpusChunkIdSchema,
  CorpusEntityIdSchema,
  CorpusManifestIdSchema,
  CorpusParseIdSchema,
  CorpusSourceClassSchema,
  CorpusSourceIdSchema
} from './knowledge-contracts.js'

const retrievalId = (prefix: string) =>
  z
    .string()
    .min(prefix.length + 2)
    .max(128)
    .regex(new RegExp(`^${prefix}_[a-z0-9][a-z0-9_-]{0,111}$`))

export const RetrievalQueryIdSchema = retrievalId('retrieval_query').brand<'RetrievalQueryId'>()
export const RetrievalTraceIdSchema = retrievalId('retrieval_trace').brand<'RetrievalTraceId'>()
export const RetrievalCandidateIdSchema =
  retrievalId('retrieval_candidate').brand<'RetrievalCandidateId'>()
export const KnowledgeContextIdSchema =
  retrievalId('knowledge_context').brand<'KnowledgeContextId'>()

export const RetrievalPurposeSchema = z.enum([
  'mission-planning',
  'specialist-assignment',
  'evaluation',
  'correction',
  'research',
  'comparison'
])

export const RetrievalQueryV1Schema = z
  .strictObject({
    ...tenantRecordFields('retrieval-query', RetrievalQueryIdSchema),
    purpose: RetrievalPurposeSchema,
    role: z.string().min(1).max(128),
    question: z.string().min(1).max(8_192),
    lexicalTerms: z.array(z.string().min(1).max(256)).min(1).max(128),
    semanticQuery: z.string().min(1).max(8_192).nullable(),
    scopes: z.array(DomainScopeSchema).min(1).max(128),
    allowedSourceClasses: z.array(CorpusSourceClassSchema).min(1).max(6),
    allowedDataClasses: z.array(DataClassSchema).min(1).max(6),
    requiredCoverage: z
      .array(
        z.strictObject({
          key: z.string().min(1).max(512),
          evidenceTerms: z.array(z.string().min(1).max(256)).min(1).max(32)
        })
      )
      .max(128),
    allowedSourceIds: uniqueIdArray(CorpusSourceIdSchema, {
      max: 10_000,
      label: 'allowedSourceIds'
    }),
    currentOnly: z.boolean(),
    asOf: IsoDateTimeSchema,
    maximumAgeDays: z.number().int().positive().max(36_500).nullable(),
    channels: z.strictObject({
      structured: z.boolean(),
      lexical: z.boolean(),
      semantic: z.boolean(),
      graph: z.boolean()
    }),
    graphSeedEntityIds: uniqueIdArray(CorpusEntityIdSchema, {
      max: 128,
      label: 'graphSeedEntityIds'
    }),
    maxGraphDepth: z.number().int().nonnegative().max(3),
    maxCandidates: z.number().int().positive().max(10_000),
    tokenBudget: z.number().int().positive().max(10_000_000),
    requestedBy: ActorSchema
  })
  .superRefine((query, context) => {
    if (!query.channels.lexical && query.lexicalTerms.length > 0) {
      context.addIssue({ code: 'custom', message: 'Lexical terms require lexical channel' })
    }
    if (query.channels.semantic !== (query.semanticQuery !== null)) {
      context.addIssue({
        code: 'custom',
        message: 'Semantic channel and query must be enabled together'
      })
    }
    if (query.channels.graph !== query.maxGraphDepth > 0) {
      context.addIssue({
        code: 'custom',
        message: 'Graph channel and depth must be enabled together'
      })
    }
    if (!query.channels.graph && query.graphSeedEntityIds.length > 0) {
      context.addIssue({ code: 'custom', message: 'Graph seeds require graph channel' })
    }
  })

export const RetrievalExclusionReasonSchema = z.enum([
  'tenant-mismatch',
  'source-class-denied',
  'data-class-denied',
  'scope-mismatch',
  'source-not-allowed',
  'render-forbidden',
  'stale',
  'superseded',
  'digest-invalid',
  'below-score',
  'duplicate',
  'token-budget'
])

export const RetrievalCandidateSchema = z
  .strictObject({
    id: RetrievalCandidateIdSchema,
    chunkId: CorpusChunkIdSchema,
    sourceManifestId: CorpusManifestIdSchema,
    sourceId: CorpusSourceIdSchema,
    sourceVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    sourceDigest: Sha256Schema,
    parseVersionId: CorpusParseIdSchema,
    sourceSpan: SourceSpanSchema,
    contentDigest: Sha256Schema,
    tokenEstimate: z.number().int().positive().max(1_000_000),
    dataClass: DataClassSchema,
    sourceClass: CorpusSourceClassSchema,
    channels: z.array(z.enum(['structured', 'lexical', 'semantic', 'graph'])).max(4),
    channelRanks: z.partialRecord(
      z.enum(['structured', 'lexical', 'semantic', 'graph']),
      z.number().int().positive().max(10_000)
    ),
    scores: z.strictObject({
      exact: z.number().nonnegative(),
      lexical: z.number().nonnegative(),
      semantic: z.number().nonnegative(),
      graph: z.number().nonnegative(),
      fused: z.number().nonnegative()
    }),
    eligible: z.boolean(),
    exclusionReason: RetrievalExclusionReasonSchema.nullable()
  })
  .superRefine((candidate, context) => {
    if (candidate.eligible === (candidate.exclusionReason !== null)) {
      context.addIssue({ code: 'custom', message: 'Eligibility and exclusion reason disagree' })
    }
  })

export const RetrievalTraceV1Schema = z.strictObject({
  ...tenantRecordFields('retrieval-trace', RetrievalTraceIdSchema),
  queryId: RetrievalQueryIdSchema,
  policyVersion: z.string().min(1).max(128),
  channelVersions: z.record(
    z.enum(['structured', 'lexical', 'semantic', 'graph', 'fusion']),
    z.string().min(1).max(128)
  ),
  candidates: z.array(RetrievalCandidateSchema).max(10_000),
  includedCandidateIds: uniqueIdArray(RetrievalCandidateIdSchema, {
    max: 10_000,
    label: 'includedCandidateIds'
  }),
  excluded: z
    .array(
      z.strictObject({
        candidateId: RetrievalCandidateIdSchema,
        reason: RetrievalExclusionReasonSchema
      })
    )
    .max(10_000),
  coverage: z.strictObject({
    required: z.array(z.string().min(1).max(512)).max(128),
    covered: z.array(z.string().min(1).max(512)).max(128),
    missing: z.array(z.string().min(1).max(512)).max(128)
  }),
  warnings: z.array(ShortTextSchema).max(128),
  completedAt: IsoDateTimeSchema
})

const KnowledgeContextItemSchema = z.strictObject({
  candidateId: RetrievalCandidateIdSchema,
  chunkId: CorpusChunkIdSchema,
  sourceManifestId: CorpusManifestIdSchema,
  sourceVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  sourceDigest: Sha256Schema,
  sourceSpan: SourceSpanSchema,
  renderedContent: z.string().min(1).max(131_072),
  renderedDigest: Sha256Schema,
  tokenEstimate: z.number().int().positive().max(1_000_000),
  position: z.number().int().nonnegative().max(10_000),
  channels: z
    .array(z.enum(['structured', 'lexical', 'semantic', 'graph']))
    .min(1)
    .max(4),
  fusedScore: z.number().nonnegative(),
  redactions: z.array(ShortTextSchema).max(64),
  inclusionReason: ShortTextSchema
})

export const KnowledgeContextManifestV1Schema = z
  .strictObject({
    ...tenantRecordFields('knowledge-context-manifest', KnowledgeContextIdSchema),
    queryId: RetrievalQueryIdSchema,
    traceId: RetrievalTraceIdSchema,
    compilerVersion: z.string().min(1).max(128),
    policyVersion: z.string().min(1).max(128),
    tokenBudget: z.number().int().positive().max(10_000_000),
    tokenAllocation: z.number().int().nonnegative().max(10_000_000),
    items: z.array(KnowledgeContextItemSchema).max(10_000),
    excluded: z
      .array(
        z.strictObject({
          candidateId: RetrievalCandidateIdSchema,
          reason: RetrievalExclusionReasonSchema
        })
      )
      .max(10_000),
    renderedContextDigest: Sha256Schema,
    compiledBy: ActorSchema
  })
  .superRefine((manifest, context) => {
    if (manifest.tokenAllocation > manifest.tokenBudget) {
      context.addIssue({ code: 'custom', message: 'Context allocation exceeds token budget' })
    }
    if (manifest.items.some((item, index) => item.position !== index)) {
      context.addIssue({
        code: 'custom',
        message: 'Knowledge context positions must be contiguous'
      })
    }
    const candidateIds = manifest.items.map((item) => item.candidateId)
    if (new Set(candidateIds).size !== candidateIds.length) {
      context.addIssue({ code: 'custom', message: 'Knowledge context candidates must be unique' })
    }
  })

export type RetrievalQueryV1 = z.infer<typeof RetrievalQueryV1Schema>
export type RetrievalCandidate = z.infer<typeof RetrievalCandidateSchema>
export type RetrievalTraceV1 = z.infer<typeof RetrievalTraceV1Schema>
export type KnowledgeContextManifestV1 = z.infer<typeof KnowledgeContextManifestV1Schema>
export type RetrievalExclusionReason = z.infer<typeof RetrievalExclusionReasonSchema>
