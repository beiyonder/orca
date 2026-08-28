import { Client } from 'pg'
import { loadPostgresMigrationCatalog } from './postgres-migration-catalog.js'

const SCHEMA_LOCK_NAME = 'orca:migration-control-plane:schema-migrations'
const MINIMUM_POSTGRES_VERSION_NUMBER = 160_000
const BOOTSTRAP_SQL = `
CREATE SCHEMA IF NOT EXISTS control_plane;
CREATE TABLE IF NOT EXISTS control_plane.schema_migrations (
  version integer PRIMARY KEY CHECK (version > 0),
  name text NOT NULL UNIQUE CHECK (name ~ '^[a-z][a-z0-9-]*$'),
  sha256 char(64) NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
`

type AppliedMigrationRow = {
  version: number
  name: string
  sha256: string
}

export type PostgresMigrationResult = {
  previousVersion: number
  currentVersion: number
  latestVersion: number
  appliedVersions: number[]
}

export class PostgresMigrationIntegrityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PostgresMigrationIntegrityError'
  }
}

async function assertSupportedPostgres(client: Client): Promise<void> {
  const result = await client.query<{ server_version_num: string }>(
    "SELECT current_setting('server_version_num') AS server_version_num"
  )
  const versionNumber = Number(result.rows[0]?.server_version_num)
  if (!Number.isInteger(versionNumber) || versionNumber < MINIMUM_POSTGRES_VERSION_NUMBER) {
    throw new Error(
      `PostgreSQL 16 or newer is required; server_version_num=${String(versionNumber)}`
    )
  }
}

async function readAppliedMigrations(client: Client): Promise<AppliedMigrationRow[]> {
  const result = await client.query<AppliedMigrationRow>(
    'SELECT version, name, sha256 FROM control_plane.schema_migrations ORDER BY version'
  )
  return result.rows
}

export async function migratePostgresSchema(options: {
  connectionString: string
  targetVersion?: number
}): Promise<PostgresMigrationResult> {
  const catalog = await loadPostgresMigrationCatalog()
  const latestVersion = catalog.at(-1)!.version
  const migrationByVersion = new Map(catalog.map((migration) => [migration.version, migration]))
  const targetVersion = options.targetVersion ?? latestVersion
  if (!Number.isInteger(targetVersion) || targetVersion < 0 || targetVersion > latestVersion) {
    throw new RangeError(`targetVersion must be between 0 and ${latestVersion}`)
  }

  const client = new Client({ connectionString: options.connectionString })
  await client.connect()
  let locked = false
  try {
    await assertSupportedPostgres(client)
    await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [SCHEMA_LOCK_NAME])
    locked = true
    await client.query(BOOTSTRAP_SQL)

    const applied = await readAppliedMigrations(client)
    for (const [index, row] of applied.entries()) {
      const expectedVersion = index + 1
      if (row.version !== expectedVersion) {
        throw new PostgresMigrationIntegrityError(
          `Applied migration history is not contiguous: expected ${expectedVersion}, found ${row.version}`
        )
      }
      const migration = migrationByVersion.get(row.version)
      if (!migration) {
        throw new PostgresMigrationIntegrityError(
          `Database contains unknown migration version ${row.version}`
        )
      }
      if (migration.name !== row.name || migration.sha256 !== row.sha256.trim()) {
        throw new PostgresMigrationIntegrityError(
          `Migration ${row.version} does not match its recorded name and checksum`
        )
      }
    }

    const previousVersion = applied.at(-1)?.version ?? 0
    if (previousVersion > targetVersion) {
      throw new PostgresMigrationIntegrityError(
        `Database version ${previousVersion} is newer than requested target ${targetVersion}`
      )
    }

    const appliedVersions: number[] = []
    for (const migration of catalog) {
      if (migration.version <= previousVersion || migration.version > targetVersion) {
        continue
      }
      await client.query('BEGIN')
      try {
        await client.query("SET LOCAL lock_timeout = '5s'")
        await client.query("SET LOCAL statement_timeout = '30s'")
        await client.query(migration.sql)
        await client.query(
          `INSERT INTO control_plane.schema_migrations (version, name, sha256)
           VALUES ($1, $2, $3)`,
          [migration.version, migration.name, migration.sha256]
        )
        await client.query('COMMIT')
        appliedVersions.push(migration.version)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }

    return {
      previousVersion,
      currentVersion: appliedVersions.at(-1) ?? previousVersion,
      latestVersion,
      appliedVersions
    }
  } finally {
    try {
      if (locked) {
        await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [SCHEMA_LOCK_NAME])
      }
    } finally {
      await client.end()
    }
  }
}
