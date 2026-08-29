import { z } from 'zod'
import { sha256Text } from './canonical-json.js'
import {
  SourceSchemaInventoryV1Schema,
  SourceSystemInventoryV1Schema,
  type SourceSchemaInventoryV1,
  type SourceSystemInventoryV1
} from './domain/source-inventory-contracts.js'
import type { SourceRequestV1 } from './domain/source-probe-contracts.js'
import {
  COLUMNS_QUERY,
  CONSTRAINTS_QUERY,
  DATABASE_QUERY,
  EXTENSIONS_QUERY,
  GRANTS_QUERY,
  INDEXES_QUERY,
  RELATIONS_QUERY,
  ROUTINES_QUERY,
  SCHEMAS_QUERY,
  SEQUENCES_QUERY,
  TRIGGERS_QUERY,
  TYPES_QUERY
} from './postgres-inventory-queries.js'
import {
  postgresConstraintKind,
  postgresCustomTypeKind,
  postgresRelationKind,
  postgresRoutineKind
} from './postgres-inventory-kind-mapping.js'
import type { PostgresSourceSandboxResult, SourceReadSession } from './postgres-source-sandbox.js'

const InventoryParametersSchema = z.strictObject({
  schemas: z.array(z.string().min(1).max(256)).min(1).max(128),
  includeSystemSchemas: z.literal(false)
})

type Row = Record<string, unknown>
export type PostgresInventoryPayload = {
  database: Row
  schemas: Row[]
  extensions: Row[]
  relations: Row[]
  columns: Row[]
  constraints: Row[]
  indexes: Row[]
  routines: Row[]
  triggers: Row[]
  customTypes: Row[]
  sequences: Row[]
  grants: Row[]
  requestedSchemas: string[]
  observedSchemas: string[]
  deniedSchemas: string[]
  unavailableSchemas: string[]
}

export async function collectPostgresEstateInventory(
  session: SourceReadSession,
  request: SourceRequestV1
): Promise<PostgresInventoryPayload> {
  const parameters = InventoryParametersSchema.parse(request.parameters)
  const requestedSchemas = [...new Set(parameters.schemas)].toSorted()
  const [databaseRows, schemas, extensions] = await Promise.all([
    session.query<Row>(DATABASE_QUERY),
    session.query<Row>(SCHEMAS_QUERY, [requestedSchemas]),
    session.query<Row>(EXTENSIONS_QUERY)
  ])
  const observedSchemas = schemas
    .filter((schema) => schema.can_use === true)
    .map((schema) => String(schema.name))
    .toSorted()
  const deniedSchemas = schemas
    .filter((schema) => schema.can_use !== true)
    .map((schema) => String(schema.name))
    .toSorted()
  const returnedSchemas = new Set(schemas.map((schema) => String(schema.name)))
  const unavailableSchemas = requestedSchemas.filter((schema) => !returnedSchemas.has(schema))
  const values = [observedSchemas]
  const [
    relations,
    columns,
    constraints,
    indexes,
    routines,
    triggers,
    customTypes,
    sequences,
    grants
  ] = await Promise.all([
    session.query<Row>(RELATIONS_QUERY, values),
    session.query<Row>(COLUMNS_QUERY, values),
    session.query<Row>(CONSTRAINTS_QUERY, values),
    session.query<Row>(INDEXES_QUERY, values),
    session.query<Row>(ROUTINES_QUERY, values),
    session.query<Row>(TRIGGERS_QUERY, values),
    session.query<Row>(TYPES_QUERY, values),
    session.query<Row>(SEQUENCES_QUERY, values),
    session.query<Row>(GRANTS_QUERY, values)
  ])
  return {
    database: databaseRows[0] ?? {},
    schemas,
    extensions,
    relations,
    columns,
    constraints,
    indexes,
    routines,
    triggers,
    customTypes,
    sequences,
    grants,
    requestedSchemas,
    observedSchemas,
    deniedSchemas,
    unavailableSchemas
  }
}

type InventoryMetadata = {
  systemInventoryId: string
  schemaInventoryId: string
  observationId: string
  capturedBy: SourceSystemInventoryV1['lineage']['capturedBy']
}

export function buildPostgresEstateInventories(
  request: SourceRequestV1,
  run: PostgresSourceSandboxResult<PostgresInventoryPayload>,
  metadata: InventoryMetadata
): { system: SourceSystemInventoryV1; schema: SourceSchemaInventoryV1 } {
  const payload = run.value
  const lineage = {
    source: request.source,
    requestId: request.id,
    observationId: metadata.observationId,
    snapshotToken: run.snapshotToken,
    capturedAt: run.completedAt,
    capturedBy: metadata.capturedBy
  }
  const database = payload.database
  const system = SourceSystemInventoryV1Schema.parse({
    schemaVersion: 1,
    kind: 'source-system-inventory',
    id: metadata.systemInventoryId,
    tenantId: request.tenantId,
    createdAt: run.completedAt,
    lineage,
    database: {
      name: String(database.name),
      owner: String(database.owner),
      encoding: String(database.encoding),
      collation: String(database.collation),
      characterType: String(database.character_type),
      defaultTablespace: String(database.default_tablespace)
    },
    server: {
      version: String(database.server_version),
      versionNumber: Number(database.server_version_number),
      currentUser: String(database.current_user_name),
      readOnly: database.read_only,
      settings: {
        server_version_num: String(database.server_version_number),
        transaction_read_only: String(database.read_only),
        database_encoding: String(database.encoding)
      }
    },
    schemas: payload.schemas.map((schema) => ({
      name: String(schema.name),
      owner: String(schema.owner),
      canUse: Boolean(schema.can_use),
      canCreate: Boolean(schema.can_create)
    })),
    extensions: payload.extensions.map((extension) => ({
      name: String(extension.name),
      version: String(extension.version),
      schema: String(extension.schema)
    })),
    coverage: {
      requestedSchemas: payload.requestedSchemas,
      observedSchemas: payload.observedSchemas,
      deniedSchemas: payload.deniedSchemas,
      unavailableSchemas: payload.unavailableSchemas,
      complete: payload.deniedSchemas.length === 0 && payload.unavailableSchemas.length === 0
    }
  })
  const schema = SourceSchemaInventoryV1Schema.parse({
    schemaVersion: 1,
    kind: 'source-schema-inventory',
    id: metadata.schemaInventoryId,
    tenantId: request.tenantId,
    createdAt: run.completedAt,
    lineage,
    schemas: payload.observedSchemas,
    relations: payload.relations.map((row) => ({
      schema: String(row.schema),
      name: String(row.name),
      kind: postgresRelationKind(row.kind),
      owner: String(row.owner),
      parent:
        row.parent_name === null
          ? null
          : { schema: String(row.parent_schema), name: String(row.parent_name) },
      partitionKey: row.partition_key === null ? null : String(row.partition_key),
      rowSecurity: Boolean(row.row_security),
      estimatedRows: Number(row.estimated_rows)
    })),
    columns: payload.columns.map((row) => ({
      schema: String(row.schema),
      name: String(row.name),
      ordinal: Number(row.ordinal),
      column: String(row.column),
      dataType: String(row.data_type),
      nullable: Boolean(row.nullable),
      generated: Boolean(row.generated),
      defaultDigest:
        row.default_expression === null ? null : sha256Text(String(row.default_expression))
    })),
    constraints: payload.constraints.map((row) => ({
      schema: String(row.schema),
      name: String(row.name),
      constraint: String(row.constraint),
      kind: postgresConstraintKind(row.kind),
      columns: row.columns,
      referencedRelation:
        row.referenced_name === null
          ? null
          : { schema: String(row.referenced_schema), name: String(row.referenced_name) },
      referencedColumns: row.referenced_columns,
      definitionDigest: sha256Text(String(row.definition))
    })),
    indexes: payload.indexes.map((row) => ({
      schema: String(row.schema),
      name: String(row.name),
      index: String(row.index),
      unique: Boolean(row.unique),
      primary: Boolean(row.primary),
      valid: Boolean(row.valid),
      definitionDigest: sha256Text(String(row.definition))
    })),
    routines: payload.routines.map((row) => ({
      schema: String(row.schema),
      name: String(row.name),
      identityArguments: String(row.identity_arguments),
      kind: postgresRoutineKind(row.kind),
      language: String(row.language),
      resultType: String(row.result_type),
      definitionDigest: row.definition === null ? null : sha256Text(String(row.definition))
    })),
    triggers: payload.triggers.map((row) => ({
      schema: String(row.schema),
      name: String(row.name),
      trigger: String(row.trigger),
      enabled: String(row.enabled),
      definitionDigest: sha256Text(String(row.definition))
    })),
    customTypes: payload.customTypes.map((row) => ({
      schema: String(row.schema),
      name: String(row.name),
      kind: postgresCustomTypeKind(row.kind),
      definitionDigest: sha256Text(String(row.definition))
    })),
    sequences: payload.sequences.map((row) => ({
      schema: String(row.schema),
      name: String(row.name),
      dataType: String(row.data_type),
      start: String(row.start),
      increment: String(row.increment),
      cycle: Boolean(row.cycle)
    })),
    grants: payload.grants.map((row) => ({
      object: String(row.object),
      grantee: String(row.grantee),
      privilege: String(row.privilege),
      grantable: Boolean(row.grantable)
    })),
    denials: payload.deniedSchemas.map((scope) => ({
      scope,
      reason: 'Current source identity lacks schema USAGE permission.'
    }))
  })
  return { system, schema }
}
