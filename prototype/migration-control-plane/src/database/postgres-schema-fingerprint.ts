import { Client } from 'pg'
import { canonicalJson, sha256Text } from '../canonical-json.js'

type SchemaObjectRow = {
  object_kind: string
  object_name: string
  definition: string
}

type MigrationRow = {
  version: number
  name: string
  sha256: string
}

type MetadataRow = {
  key: string
  value: string
}

type ContractRow = {
  schema_name: string
  schema_version: number
  json_schema_id: string
  schema_sha256: string
  active: boolean
}

export type PostgresSchemaSnapshot = {
  objects: SchemaObjectRow[]
  migrations: MigrationRow[]
  metadata: MetadataRow[]
  contracts: ContractRow[]
}

const SCHEMA_OBJECTS_SQL = `
WITH schema_objects AS (
  SELECT
    'table'::text AS object_kind,
    table_class.relname::text AS object_name,
    concat('relkind=', table_class.relkind, ';rls=', table_class.relrowsecurity)::text AS definition
  FROM pg_class AS table_class
  JOIN pg_namespace AS table_namespace ON table_namespace.oid = table_class.relnamespace
  WHERE table_namespace.nspname = 'control_plane' AND table_class.relkind IN ('r', 'p')

  UNION ALL

  SELECT
    'column'::text,
    concat(table_class.relname, '.', lpad(column_attribute.attnum::text, 4, '0'), '.', column_attribute.attname),
    concat(
      format_type(column_attribute.atttypid, column_attribute.atttypmod),
      ';not_null=', column_attribute.attnotnull,
      ';default=', coalesce(pg_get_expr(column_default.adbin, column_default.adrelid), '')
    )::text
  FROM pg_attribute AS column_attribute
  JOIN pg_class AS table_class ON table_class.oid = column_attribute.attrelid
  JOIN pg_namespace AS table_namespace ON table_namespace.oid = table_class.relnamespace
  LEFT JOIN pg_attrdef AS column_default
    ON column_default.adrelid = column_attribute.attrelid
    AND column_default.adnum = column_attribute.attnum
  WHERE
    table_namespace.nspname = 'control_plane'
    AND table_class.relkind IN ('r', 'p')
    AND column_attribute.attnum > 0
    AND NOT column_attribute.attisdropped

  UNION ALL

  SELECT
    'constraint'::text,
    concat(table_class.relname, '.', table_constraint.conname),
    pg_get_constraintdef(table_constraint.oid, true)::text
  FROM pg_constraint AS table_constraint
  JOIN pg_class AS table_class ON table_class.oid = table_constraint.conrelid
  JOIN pg_namespace AS table_namespace ON table_namespace.oid = table_class.relnamespace
  WHERE table_namespace.nspname = 'control_plane'

  UNION ALL

  SELECT
    'index'::text,
    index_class.relname::text,
    pg_get_indexdef(index_class.oid)::text
  FROM pg_index AS table_index
  JOIN pg_class AS table_class ON table_class.oid = table_index.indrelid
  JOIN pg_class AS index_class ON index_class.oid = table_index.indexrelid
  JOIN pg_namespace AS table_namespace ON table_namespace.oid = table_class.relnamespace
  WHERE table_namespace.nspname = 'control_plane'

  UNION ALL

  SELECT
    'trigger'::text,
    concat(table_class.relname, '.', table_trigger.tgname),
    pg_get_triggerdef(table_trigger.oid, true)::text
  FROM pg_trigger AS table_trigger
  JOIN pg_class AS table_class ON table_class.oid = table_trigger.tgrelid
  JOIN pg_namespace AS table_namespace ON table_namespace.oid = table_class.relnamespace
  WHERE table_namespace.nspname = 'control_plane' AND NOT table_trigger.tgisinternal

  UNION ALL

  SELECT
    'function'::text,
    concat(schema_function.proname, '(', pg_get_function_identity_arguments(schema_function.oid), ')'),
    pg_get_functiondef(schema_function.oid)::text
  FROM pg_proc AS schema_function
  JOIN pg_namespace AS function_namespace ON function_namespace.oid = schema_function.pronamespace
  WHERE function_namespace.nspname = 'control_plane'
)
SELECT object_kind, object_name, definition
FROM schema_objects
ORDER BY object_kind, object_name, definition
`

export async function readPostgresSchemaSnapshot(
  connectionString: string
): Promise<PostgresSchemaSnapshot> {
  const client = new Client({ connectionString })
  await client.connect()
  try {
    const objects = await client.query<SchemaObjectRow>(SCHEMA_OBJECTS_SQL)
    const migrations = await client.query<MigrationRow>(
      'SELECT version, name, trim(sha256) AS sha256 FROM control_plane.schema_migrations ORDER BY version'
    )
    const metadata = await client.query<MetadataRow>(
      'SELECT key, value FROM control_plane.kernel_metadata ORDER BY key'
    )
    const contracts = await client.query<ContractRow>(
      `SELECT schema_name, schema_version, json_schema_id, trim(schema_sha256) AS schema_sha256, active
       FROM control_plane.contract_schemas
       ORDER BY schema_name, schema_version`
    )
    return {
      objects: objects.rows,
      migrations: migrations.rows,
      metadata: metadata.rows,
      contracts: contracts.rows
    }
  } finally {
    await client.end()
  }
}

export async function fingerprintPostgresSchema(connectionString: string): Promise<string> {
  return sha256Text(canonicalJson(await readPostgresSchemaSnapshot(connectionString)))
}
