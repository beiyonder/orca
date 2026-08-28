import { z } from 'zod'
import {
  ActorSchema,
  ContentReferenceSchema,
  DataClassSchema,
  DomainScopeSchema,
  IsoDateTimeSchema,
  JsonValueSchema,
  MediaTypeSchema,
  Sha256Schema,
  ShortTextSchema,
  SourceSpanSchema,
  tenantRecordFields,
  uniqueIdArray
} from './common-contracts.js'

const corpusId = (prefix: string) =>
  z
    .string()
    .min(prefix.length + 2)
    .max(128)
    .regex(new RegExp(`^${prefix}_[a-z0-9][a-z0-9_-]{0,111}$`))

export const CorpusManifestIdSchema = corpusId('corpus_manifest').brand<'CorpusManifestId'>()
export const CorpusSourceIdSchema = corpusId('corpus_source').brand<'CorpusSourceId'>()
export const CorpusParseIdSchema = corpusId('corpus_parse').brand<'CorpusParseId'>()
export const CorpusChunkIdSchema = corpusId('corpus_chunk').brand<'CorpusChunkId'>()
export const CorpusEntityIdSchema = corpusId('corpus_entity').brand<'CorpusEntityId'>()
export const CorpusRelationIdSchema = corpusId('corpus_relation').brand<'CorpusRelationId'>()

export const CorpusSourceClassSchema = z.enum([
  'product-instruction',
  'product-state',
  'environment-evidence',
  'reference',
  'customer-artifact',
  'live-research'
])

const SourceOwnerSchema = z.strictObject({
  kind: z.enum(['operator', 'customer', 'vendor', 'standards-body', 'system']),
  id: z.string().min(1).max(256),
  name: z.string().min(1).max(512)
})
const SourcePermissionSchema = z.strictObject({
  basis: z.enum(['public', 'licensed', 'customer-provided', 'internal']),
  licenseId: z.string().min(1).max(256).nullable(),
  termsUri: z.url().max(4_096).nullable(),
  ingestAllowed: z.boolean(),
  renderAllowed: z.boolean(),
  derivativeAllowed: z.boolean()
})
const ApplicabilitySchema = z.strictObject({
  scope: DomainScopeSchema,
  product: z.string().min(1).max(256).nullable(),
  versionConstraint: z.string().min(1).max(256).nullable(),
  effectiveFrom: IsoDateTimeSchema.nullable(),
  effectiveUntil: IsoDateTimeSchema.nullable()
})
const FreshnessPolicySchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('immutable'), staleDisposition: z.literal('never-stale') }),
  z.strictObject({
    kind: z.literal('refresh-after'),
    maxAgeDays: z.number().int().positive().max(36_500),
    staleDisposition: z.enum(['exclude', 'comparison-only', 'warn'])
  }),
  z.strictObject({
    kind: z.literal('expires-at'),
    expiresAt: IsoDateTimeSchema,
    staleDisposition: z.enum(['exclude', 'comparison-only', 'warn'])
  })
])
const RetentionPolicySchema = z.strictObject({
  retainUntil: IsoDateTimeSchema.nullable(),
  deletionMode: z.enum(['retain', 'delete-content', 'delete-all', 'legal-hold']),
  policyId: z.string().min(1).max(256)
})

export const CorpusSourceManifestV1Schema = z
  .strictObject({
    ...tenantRecordFields('corpus-source-manifest', CorpusManifestIdSchema),
    sourceId: CorpusSourceIdSchema,
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    sourceVersion: z.string().min(1).max(512),
    sourceClass: CorpusSourceClassSchema,
    visibility: z.enum(['tenant', 'global-public']),
    owner: SourceOwnerSchema,
    permission: SourcePermissionSchema,
    canonicalUri: z
      .string()
      .min(3)
      .max(4_096)
      .regex(/^[a-z][a-z0-9+.-]*:/i),
    title: z.string().min(1).max(1_024),
    publisher: z.string().min(1).max(512),
    content: ContentReferenceSchema,
    dataClass: DataClassSchema,
    applicability: ApplicabilitySchema,
    observedAt: IsoDateTimeSchema,
    sourcePublishedAt: IsoDateTimeSchema.nullable(),
    freshness: FreshnessPolicySchema,
    retention: RetentionPolicySchema,
    supersedesManifestId: CorpusManifestIdSchema.nullable(),
    limitations: z.array(ShortTextSchema).max(64),
    registeredBy: ActorSchema
  })
  .superRefine((manifest, context) => {
    if (manifest.version === 1 && manifest.supersedesManifestId !== null) {
      context.addIssue({
        code: 'custom',
        message: 'First source version cannot supersede a manifest'
      })
    }
    if (manifest.version > 1 && manifest.supersedesManifestId === null) {
      context.addIssue({ code: 'custom', message: 'Later source version requires a predecessor' })
    }
    if (manifest.visibility === 'global-public' && manifest.dataClass !== 'public') {
      context.addIssue({
        code: 'custom',
        message: 'Global corpus sources must be public',
        path: ['dataClass']
      })
    }
    if (!manifest.permission.ingestAllowed) {
      context.addIssue({
        code: 'custom',
        message: 'Source permission forbids ingestion',
        path: ['permission']
      })
    }
    if (manifest.content.uri !== `corpus-object://sha256/${manifest.content.sha256}`) {
      context.addIssue({
        code: 'custom',
        message: 'Corpus content URI must address its SHA-256 object',
        path: ['content', 'uri']
      })
    }
    const { effectiveFrom, effectiveUntil } = manifest.applicability
    if (
      effectiveFrom !== null &&
      effectiveUntil !== null &&
      Date.parse(effectiveUntil) < Date.parse(effectiveFrom)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Applicability end precedes start',
        path: ['applicability', 'effectiveUntil']
      })
    }
  })

export const CorpusParseVersionV1Schema = z.strictObject({
  ...tenantRecordFields('corpus-parse-version', CorpusParseIdSchema),
  sourceManifestId: CorpusManifestIdSchema,
  sourceId: CorpusSourceIdSchema,
  sourceVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  sourceDigest: Sha256Schema,
  parser: z.strictObject({
    name: z.string().min(1).max(128),
    version: z.string().min(1).max(128),
    implementationDigest: Sha256Schema
  }),
  output: ContentReferenceSchema,
  warnings: z.array(ShortTextSchema).max(128),
  parsedBy: ActorSchema
})

export const CorpusChunkV1Schema = z.strictObject({
  ...tenantRecordFields('corpus-chunk', CorpusChunkIdSchema),
  sourceManifestId: CorpusManifestIdSchema,
  parseVersionId: CorpusParseIdSchema,
  ordinal: z.number().int().nonnegative().max(1_000_000),
  chunkType: z.enum(['document', 'schema', 'code', 'data-profile', 'log', 'runbook']),
  content: z.string().min(1).max(131_072),
  contentDigest: Sha256Schema,
  sourceSpan: SourceSpanSchema,
  mediaType: MediaTypeSchema,
  tokenEstimate: z.number().int().positive().max(1_000_000),
  sourceRole: z.string().min(1).max(128),
  dataClass: DataClassSchema,
  applicability: ApplicabilitySchema,
  entityKeys: z.array(z.string().min(1).max(512)).max(1_000)
})

export const CorpusEntityV1Schema = z.strictObject({
  ...tenantRecordFields('corpus-entity', CorpusEntityIdSchema),
  entityType: z.string().min(1).max(128),
  canonicalKey: z.string().min(1).max(512),
  displayName: z.string().min(1).max(1_024),
  attributes: z.record(z.string().min(1).max(128), JsonValueSchema),
  provenanceChunkIds: uniqueIdArray(CorpusChunkIdSchema, {
    min: 1,
    max: 10_000,
    label: 'provenanceChunkIds'
  })
})

export const CorpusRelationV1Schema = z
  .strictObject({
    ...tenantRecordFields('corpus-relation', CorpusRelationIdSchema),
    fromEntityId: CorpusEntityIdSchema,
    toEntityId: CorpusEntityIdSchema,
    relationType: z.string().min(1).max(128),
    directed: z.boolean(),
    attributes: z.record(z.string().min(1).max(128), JsonValueSchema),
    provenanceChunkIds: uniqueIdArray(CorpusChunkIdSchema, {
      min: 1,
      max: 10_000,
      label: 'provenanceChunkIds'
    })
  })
  .refine((relation) => relation.fromEntityId !== relation.toEntityId, {
    message: 'Corpus relation cannot self-reference',
    path: ['toEntityId']
  })

export type CorpusSourceManifestV1 = z.infer<typeof CorpusSourceManifestV1Schema>
export type CorpusParseVersionV1 = z.infer<typeof CorpusParseVersionV1Schema>
export type CorpusChunkV1 = z.infer<typeof CorpusChunkV1Schema>
export type CorpusEntityV1 = z.infer<typeof CorpusEntityV1Schema>
export type CorpusRelationV1 = z.infer<typeof CorpusRelationV1Schema>
