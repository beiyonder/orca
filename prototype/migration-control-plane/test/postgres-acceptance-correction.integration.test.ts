import { Pool } from 'pg'
import { afterEach, describe, expect, it } from 'vitest'
import { insertPostgresDomainRecords } from '../src/database/postgres-domain-record-store.js'
import { migratePostgresSchema } from '../src/database/postgres-schema-migrator.js'
import { ACCEPTANCE_CORRECTION_CONTRACT_SAMPLES } from './acceptance-correction-contract-samples.js'
import { createPostgresTestDatabase, type PostgresTestDatabase } from './postgres-test-databases.js'

const databases: PostgresTestDatabase[] = []
const pools: Pool[] = []

afterEach(async () => {
  await Promise.all(pools.splice(0).map(async (pool) => pool.end()))
  await Promise.all(databases.splice(0).map(async (database) => database.drop()))
})

describe('PostgreSQL acceptance and correction records', () => {
  it('persists immutable product authority, diagnosis, and fixed-contract cycle', async () => {
    const database = await createPostgresTestDatabase()
    databases.push(database)
    await migratePostgresSchema({ connectionString: database.connectionString })
    const pool = new Pool({ connectionString: database.connectionString, max: 1 })
    pools.push(pool)
    const records = Object.entries(ACCEPTANCE_CORRECTION_CONTRACT_SAMPLES).map(
      ([schemaName, payload]) => ({
        tenantId: payload.tenantId,
        recordId: payload.id,
        missionId: payload.missionId,
        schemaName,
        recordKind: payload.kind,
        recordState: 'status' in payload ? payload.status : 'immutable',
        payload,
        createdAt: payload.createdAt
      })
    )
    const client = await pool.connect()
    try {
      await insertPostgresDomainRecords(client, records)
    } finally {
      client.release()
    }
    const stored = await pool.query<{ schema_name: string }>(
      `SELECT schema_name
       FROM control_plane.domain_records
       WHERE tenant_id = 'tenant_s1'
         AND schema_name = ANY($1::text[])
       ORDER BY schema_name`,
      [records.map((record) => record.schemaName)]
    )
    expect(stored.rows.map((row) => row.schema_name)).toEqual(
      records.map((record) => record.schemaName).toSorted()
    )
    for (const record of records) {
      await expect(
        pool.query(
          `DELETE FROM control_plane.domain_records
           WHERE tenant_id = $1 AND record_id = $2`,
          [record.tenantId, record.recordId]
        )
      ).rejects.toSatisfy(
        (error: unknown) =>
          typeof error === 'object' && error !== null && 'code' in error && error.code === '55000'
      )
    }
  })
})
