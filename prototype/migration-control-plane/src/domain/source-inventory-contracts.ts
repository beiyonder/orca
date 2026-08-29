import { z } from 'zod'
import {
  ActorSchema,
  IsoDateTimeSchema,
  Sha256Schema,
  ShortTextSchema,
  tenantRecordFields
} from './common-contracts.js'
import { SourceBindingSchema } from './source-adapter-contracts.js'
import { SourceObservationIdSchema, SourceRequestIdSchema } from './source-probe-contracts.js'

const sourceId = (prefix: string) =>
  z
    .string()
    .min(prefix.length + 2)
    .max(128)
    .regex(new RegExp(`^${prefix}_[a-z0-9][a-z0-9_-]{0,111}$`))

export const SourceSystemInventoryIdSchema =
  sourceId('source_system_inventory').brand<'SourceSystemInventoryId'>()
export const SourceSchemaInventoryIdSchema =
  sourceId('source_schema_inventory').brand<'SourceSchemaInventoryId'>()

export const SourceDiscoveryLineageSchema = z.strictObject({
  source: SourceBindingSchema,
  requestId: SourceRequestIdSchema,
  observationId: SourceObservationIdSchema,
  snapshotToken: z.string().min(1).max(512),
  capturedAt: IsoDateTimeSchema,
  capturedBy: ActorSchema
})

export const SourceSystemInventoryV1Schema = z.strictObject({
  ...tenantRecordFields('source-system-inventory', SourceSystemInventoryIdSchema),
  lineage: SourceDiscoveryLineageSchema,
  database: z.strictObject({
    name: z.string().min(1).max(256),
    owner: z.string().min(1).max(256),
    encoding: z.string().min(1).max(64),
    collation: z.string().min(1).max(256),
    characterType: z.string().min(1).max(256),
    defaultTablespace: z.string().min(1).max(256)
  }),
  server: z.strictObject({
    version: z.string().min(1).max(256),
    versionNumber: z.number().int().positive(),
    currentUser: z.string().min(1).max(256),
    readOnly: z.literal(true),
    settings: z.record(z.string().min(1).max(128), z.string().max(4_096))
  }),
  schemas: z.array(
    z.strictObject({
      name: z.string().min(1).max(256),
      owner: z.string().min(1).max(256),
      canUse: z.boolean(),
      canCreate: z.boolean()
    })
  ),
  extensions: z.array(
    z.strictObject({
      name: z.string().min(1).max(128),
      version: z.string().min(1).max(128),
      schema: z.string().min(1).max(256)
    })
  ),
  coverage: z.strictObject({
    requestedSchemas: z.array(z.string().min(1).max(256)),
    observedSchemas: z.array(z.string().min(1).max(256)),
    deniedSchemas: z.array(z.string().min(1).max(256)),
    unavailableSchemas: z.array(z.string().min(1).max(256)),
    complete: z.boolean()
  })
})

const RelationKeySchema = z.strictObject({
  schema: z.string().min(1).max(256),
  name: z.string().min(1).max(256)
})

export const SourceSchemaInventoryV1Schema = z
  .strictObject({
    ...tenantRecordFields('source-schema-inventory', SourceSchemaInventoryIdSchema),
    lineage: SourceDiscoveryLineageSchema,
    schemas: z.array(z.string().min(1).max(256)).min(1),
    relations: z.array(
      z.strictObject({
        ...RelationKeySchema.shape,
        kind: z.enum(['table', 'partitioned-table', 'view', 'materialized-view', 'foreign-table']),
        owner: z.string().min(1).max(256),
        parent: RelationKeySchema.nullable(),
        partitionKey: z.string().max(4_096).nullable(),
        rowSecurity: z.boolean(),
        estimatedRows: z.number().nonnegative()
      })
    ),
    columns: z.array(
      z.strictObject({
        ...RelationKeySchema.shape,
        ordinal: z.number().int().positive(),
        column: z.string().min(1).max(256),
        dataType: z.string().min(1).max(1_024),
        nullable: z.boolean(),
        generated: z.boolean(),
        defaultDigest: Sha256Schema.nullable()
      })
    ),
    constraints: z.array(
      z.strictObject({
        ...RelationKeySchema.shape,
        constraint: z.string().min(1).max(256),
        kind: z.enum(['primary-key', 'foreign-key', 'unique', 'check', 'exclusion']),
        columns: z.array(z.string().min(1).max(256)),
        referencedRelation: RelationKeySchema.nullable(),
        referencedColumns: z.array(z.string().min(1).max(256)),
        definitionDigest: Sha256Schema
      })
    ),
    indexes: z.array(
      z.strictObject({
        ...RelationKeySchema.shape,
        index: z.string().min(1).max(256),
        unique: z.boolean(),
        primary: z.boolean(),
        valid: z.boolean(),
        definitionDigest: Sha256Schema
      })
    ),
    routines: z.array(
      z.strictObject({
        schema: z.string().min(1).max(256),
        name: z.string().min(1).max(256),
        identityArguments: z.string().max(4_096),
        kind: z.enum(['function', 'procedure', 'aggregate', 'window']),
        language: z.string().min(1).max(128),
        resultType: z.string().min(1).max(1_024),
        definitionDigest: Sha256Schema.nullable()
      })
    ),
    triggers: z.array(
      z.strictObject({
        ...RelationKeySchema.shape,
        trigger: z.string().min(1).max(256),
        enabled: z.string().min(1).max(32),
        definitionDigest: Sha256Schema
      })
    ),
    customTypes: z.array(
      z.strictObject({
        schema: z.string().min(1).max(256),
        name: z.string().min(1).max(256),
        kind: z.enum(['domain', 'enum', 'composite', 'range']),
        definitionDigest: Sha256Schema
      })
    ),
    sequences: z.array(
      z.strictObject({
        ...RelationKeySchema.shape,
        dataType: z.string().min(1).max(128),
        start: z.string().min(1).max(128),
        increment: z.string().min(1).max(128),
        cycle: z.boolean()
      })
    ),
    grants: z.array(
      z.strictObject({
        object: z.string().min(1).max(512),
        grantee: z.string().min(1).max(256),
        privilege: z.string().min(1).max(128),
        grantable: z.boolean()
      })
    ),
    denials: z.array(z.strictObject({ scope: z.string().min(1).max(512), reason: ShortTextSchema }))
  })
  .superRefine((inventory, context) => {
    const keys = inventory.relations.map((relation) => `${relation.schema}.${relation.name}`)
    if (new Set(keys).size !== keys.length) {
      context.addIssue({ code: 'custom', message: 'Inventory relation identities must be unique' })
    }
  })

export type SourceSystemInventoryV1 = z.infer<typeof SourceSystemInventoryV1Schema>
export type SourceSchemaInventoryV1 = z.infer<typeof SourceSchemaInventoryV1Schema>
