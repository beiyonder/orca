import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import { afterEach, describe, expect, it } from 'vitest'
import { loadPostgresMigrationCatalog } from '../src/database/postgres-migration-catalog.js'
import {
  fingerprintPostgresSchema,
  readPostgresSchemaSnapshot
} from '../src/database/postgres-schema-fingerprint.js'
import {
  migratePostgresSchema,
  PostgresMigrationIntegrityError
} from '../src/database/postgres-schema-migrator.js'
import { createPostgresTestDatabase, type PostgresTestDatabase } from './postgres-test-databases.js'

const databases: PostgresTestDatabase[] = []
const contractManifestPath = fileURLToPath(new URL('../schemas/v1/manifest.json', import.meta.url))

async function expectedContractRows(): Promise<
  {
    schema_name: string
    schema_version: number
    json_schema_id: string
    schema_sha256: string
    active: boolean
  }[]
> {
  const manifest = JSON.parse(await readFile(contractManifestPath, 'utf8')) as {
    schemas: { name: string; sha256: string }[]
  }
  return manifest.schemas.map((schema) => ({
    schema_name: schema.name,
    schema_version: 1,
    json_schema_id: `urn:orca:migration-control-plane:${schema.name}`,
    schema_sha256: schema.sha256,
    active: true
  }))
}

async function database(): Promise<PostgresTestDatabase> {
  const created = await createPostgresTestDatabase()
  databases.push(created)
  return created
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (created) => created.drop()))
})

describe.sequential('PostgreSQL schema migrations', () => {
  it('keeps a contiguous immutable migration catalog', async () => {
    const catalog = await loadPostgresMigrationCatalog()
    expect(catalog.map((migration) => migration.version)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
    ])
    expect(catalog.every((migration) => /^[a-f0-9]{64}$/.test(migration.sha256))).toBe(true)
  })

  it('converges empty and upgraded databases to one checksummed schema', async () => {
    const emptyPath = await database()
    const upgradePath = await database()

    await expect(
      migratePostgresSchema({ connectionString: emptyPath.connectionString })
    ).resolves.toMatchObject({
      previousVersion: 0,
      currentVersion: 11,
      appliedVersions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    })

    await expect(
      migratePostgresSchema({ connectionString: upgradePath.connectionString, targetVersion: 1 })
    ).resolves.toMatchObject({ previousVersion: 0, currentVersion: 1, appliedVersions: [1] })
    await expect(
      migratePostgresSchema({ connectionString: upgradePath.connectionString })
    ).resolves.toMatchObject({
      previousVersion: 1,
      currentVersion: 11,
      appliedVersions: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    })

    const [emptySnapshot, upgradeSnapshot, emptyFingerprint, upgradeFingerprint] =
      await Promise.all([
        readPostgresSchemaSnapshot(emptyPath.connectionString),
        readPostgresSchemaSnapshot(upgradePath.connectionString),
        fingerprintPostgresSchema(emptyPath.connectionString),
        fingerprintPostgresSchema(upgradePath.connectionString)
      ])
    expect(upgradeSnapshot).toEqual(emptySnapshot)
    expect(upgradeFingerprint).toBe(emptyFingerprint)
    expect(emptyFingerprint).toBe(
      '7acfcb432455ff318fb297c1fd28d8a3bd219fd7b6da60df06587aa258769156'
    )
    expect(emptySnapshot.contracts).toEqual(await expectedContractRows())
    expect(
      emptySnapshot.objects
        .filter((object) => object.object_kind === 'table')
        .map((object) => object.object_name)
    ).toEqual([
      'assignment_attempts',
      'contract_schemas',
      'domain_records',
      'effect_attempts',
      'effect_executions',
      'inbox_messages',
      'kernel_metadata',
      'mission_aggregates',
      'mission_commands',
      'mission_events',
      'mission_projections',
      'outbox_messages',
      'plan_revisions',
      'plan_task_edges',
      'recovery_work',
      'schema_migrations',
      'task_executions'
    ])
    expect(emptySnapshot.metadata).toContainEqual({
      key: 'contract_registry_digest',
      value: 'e73d6ad464fc3fbe89d7ec9e4cc9b80eadac2669177fe780491a13805591bf23'
    })
    expect(emptySnapshot.objects.some((object) => object.object_name === 'mission_events')).toBe(
      true
    )
    expect(emptySnapshot.objects.some((object) => object.object_name === 'effect_executions')).toBe(
      true
    )
  })

  it('is idempotent and rejects changed or gapped applied history', async () => {
    const created = await database()
    await migratePostgresSchema({ connectionString: created.connectionString })
    await expect(
      migratePostgresSchema({ connectionString: created.connectionString })
    ).resolves.toMatchObject({ previousVersion: 11, currentVersion: 11, appliedVersions: [] })

    const secondMigration = (await loadPostgresMigrationCatalog())[1]!
    const client = new Client({ connectionString: created.connectionString })
    await client.connect()
    try {
      await client.query(
        "UPDATE control_plane.schema_migrations SET sha256 = repeat('0', 64) WHERE version = 2"
      )
      await expect(
        migratePostgresSchema({ connectionString: created.connectionString })
      ).rejects.toBeInstanceOf(PostgresMigrationIntegrityError)

      await client.query(
        'UPDATE control_plane.schema_migrations SET sha256 = $1 WHERE version = 2',
        [secondMigration.sha256]
      )
      await client.query('DELETE FROM control_plane.schema_migrations WHERE version = 2')
      await expect(
        migratePostgresSchema({ connectionString: created.connectionString })
      ).rejects.toThrow('Applied migration history is not contiguous')
    } finally {
      await client.end()
    }
  })

  it('serializes concurrent migration attempts with one logical application', async () => {
    const created = await database()
    const results = await Promise.all([
      migratePostgresSchema({ connectionString: created.connectionString }),
      migratePostgresSchema({ connectionString: created.connectionString })
    ])
    expect(results.map((result) => result.appliedVersions.length).sort((a, b) => a - b)).toEqual([
      0, 11
    ])
    expect(await fingerprintPostgresSchema(created.connectionString)).toMatch(/^[a-f0-9]{64}$/)
  })
})
