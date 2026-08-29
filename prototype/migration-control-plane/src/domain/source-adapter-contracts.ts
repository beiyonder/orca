import { z } from 'zod'
import {
  ActorSchema,
  AssignmentIdSchema,
  AttemptIdSchema,
  ContentReferenceSchema,
  DataClassSchema,
  EvidenceIdSchema,
  IsoDateTimeSchema,
  Sha256Schema,
  ShortTextSchema,
  tenantRecordFields,
  uniqueIdArray
} from './common-contracts.js'

const sourceId = (prefix: string) =>
  z
    .string()
    .min(prefix.length + 2)
    .max(128)
    .regex(new RegExp(`^${prefix}_[a-z0-9][a-z0-9_-]{0,111}$`))

export const SourceAdapterIdSchema = sourceId('source_adapter').brand<'SourceAdapterId'>()
export const SourceAdapterDefinitionIdSchema = sourceId(
  'source_adapter_definition'
).brand<'SourceAdapterDefinitionId'>()
export const SourceAccessEnvelopeIdSchema =
  sourceId('source_access').brand<'SourceAccessEnvelopeId'>()
export const SourceSystemIdSchema = sourceId('source_system').brand<'SourceSystemId'>()

export const SourceOperationSchema = z.enum([
  'inventory-system',
  'inventory-schema',
  'profile-data',
  'extract-code',
  'infer-lineage',
  'inspect-cdc',
  'run-safe-probe',
  'inspect-capabilities'
])

export const SourceAdapterErrorCodeSchema = z.enum([
  'access-denied',
  'unsupported-operation',
  'unsupported-version',
  'source-unavailable',
  'mutation-blocked',
  'network-denied',
  'filesystem-denied',
  'concurrency-limit-exceeded',
  'source-changed',
  'deadline-exceeded',
  'query-limit-exceeded',
  'row-limit-exceeded',
  'byte-limit-exceeded',
  'malformed-source-result',
  'cancelled',
  'adapter-failed'
])

export const SourceReadLimitsSchema = z.strictObject({
  timeLimitMs: z.number().int().positive().max(3_600_000),
  statementTimeoutMs: z.number().int().positive().max(600_000),
  queryLimit: z.number().int().positive().max(10_000),
  rowLimit: z.number().int().nonnegative().max(10_000_000),
  byteLimit: z.number().int().positive().max(1_073_741_824),
  concurrencyLimit: z.number().int().positive().max(128)
})

export const SourceBindingSchema = z.strictObject({
  sourceSystemId: SourceSystemIdSchema,
  engine: z.string().min(1).max(128),
  engineVersion: z.string().min(1).max(128),
  databaseName: z.string().min(1).max(256),
  endpointDigest: Sha256Schema,
  fixtureDigest: Sha256Schema.nullable()
})

const SupportedSourceSchema = z.strictObject({
  engine: z.string().min(1).max(128),
  versionConstraint: z.string().min(1).max(256),
  requiredFeatures: z.array(z.string().min(1).max(128)).max(128),
  unsupportedFeatures: z.array(z.string().min(1).max(128)).max(128)
})

export const SourceAdapterDefinitionV1Schema = z
  .strictObject({
    ...tenantRecordFields('source-adapter-definition', SourceAdapterDefinitionIdSchema),
    adapterId: SourceAdapterIdSchema,
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    artifact: ContentReferenceSchema,
    artifactDigest: Sha256Schema,
    description: z.string().min(1).max(8_192),
    supportedSources: z.array(SupportedSourceSchema).min(1).max(64),
    operations: z.array(SourceOperationSchema).min(1).max(8),
    dataClasses: z.array(DataClassSchema).min(1).max(6),
    defaultLimits: SourceReadLimitsSchema,
    errorRecovery: z
      .array(
        z.strictObject({
          code: SourceAdapterErrorCodeSchema,
          retry: z.enum(['never', 'same-snapshot', 'after-reconnect', 'after-permission-change']),
          preservesPartialEvidence: z.boolean(),
          operatorAction: ShortTextSchema.nullable()
        })
      )
      .min(1)
      .max(32),
    authority: z.strictObject({
      mode: z.literal('read-only'),
      transactionMode: z.literal('read-only'),
      mutationVocabulary: z.tuple([]),
      filesystemScopes: z.tuple([]),
      allowsArbitrarySql: z.literal(false)
    }),
    predecessorDefinitionId: SourceAdapterDefinitionIdSchema.nullable(),
    license: z.string().min(1).max(256),
    signer: z.string().min(1).max(512).nullable(),
    createdBy: ActorSchema
  })
  .superRefine((definition, context) => {
    if (definition.artifact.sha256 !== definition.artifactDigest) {
      context.addIssue({ code: 'custom', message: 'Source adapter artifact digest differs' })
    }
    if (new Set(definition.operations).size !== definition.operations.length) {
      context.addIssue({ code: 'custom', message: 'Source adapter operations must be unique' })
    }
    if (definition.version === 1 && definition.predecessorDefinitionId !== null) {
      context.addIssue({
        code: 'custom',
        message: 'First adapter version cannot have a predecessor'
      })
    }
    if (definition.version > 1 && definition.predecessorDefinitionId === null) {
      context.addIssue({ code: 'custom', message: 'Later adapter version requires a predecessor' })
    }
  })

export const SourceAccessEnvelopeV1Schema = z
  .strictObject({
    ...tenantRecordFields('source-access-envelope', SourceAccessEnvelopeIdSchema),
    adapterDefinitionId: SourceAdapterDefinitionIdSchema,
    assignmentId: AssignmentIdSchema,
    attemptId: AttemptIdSchema,
    fence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    source: SourceBindingSchema,
    allowedOperations: z.array(SourceOperationSchema).min(1).max(8),
    permissionEvidenceIds: uniqueIdArray(EvidenceIdSchema, {
      min: 1,
      max: 1_000,
      label: 'permissionEvidenceIds'
    }),
    credentialReference: z.string().min(1).max(1_024).nullable(),
    networkEndpointDigests: z.array(Sha256Schema).min(1).max(16),
    dataClasses: z.array(DataClassSchema).min(1).max(6),
    limits: SourceReadLimitsSchema,
    maxUses: z.number().int().positive().max(10_000),
    issuedAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema,
    revokedAt: IsoDateTimeSchema.nullable(),
    authority: z.strictObject({
      mode: z.literal('read-only'),
      transactionMode: z.literal('read-only'),
      mutationVocabulary: z.tuple([]),
      filesystemScopes: z.tuple([])
    }),
    issuedBy: ActorSchema
  })
  .superRefine((envelope, context) => {
    if (Date.parse(envelope.expiresAt) <= Date.parse(envelope.issuedAt)) {
      context.addIssue({ code: 'custom', message: 'Source access must expire after issue' })
    }
    if (
      envelope.revokedAt !== null &&
      Date.parse(envelope.revokedAt) < Date.parse(envelope.issuedAt)
    ) {
      context.addIssue({ code: 'custom', message: 'Source access revocation predates issue' })
    }
  })

export type SourceAdapterDefinitionV1 = z.infer<typeof SourceAdapterDefinitionV1Schema>
export type SourceAccessEnvelopeV1 = z.infer<typeof SourceAccessEnvelopeV1Schema>
export type SourceOperation = z.infer<typeof SourceOperationSchema>
export type SourceReadLimits = z.infer<typeof SourceReadLimitsSchema>
