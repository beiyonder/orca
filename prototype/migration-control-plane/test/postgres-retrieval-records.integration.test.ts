import { Pool } from 'pg'
import { afterEach, describe, expect, it } from 'vitest'
import {
  KnowledgeContextManifestV1Schema,
  RetrievalQueryV1Schema,
  RetrievalTraceV1Schema
} from '../src/domain/retrieval-contracts.js'
import { insertPostgresDomainRecords } from '../src/database/postgres-domain-record-store.js'
import { migratePostgresSchema } from '../src/database/postgres-schema-migrator.js'
import { DOMAIN_CONTRACT_SAMPLES } from './domain-contract-samples.js'
import { createPostgresTestDatabase, type PostgresTestDatabase } from './postgres-test-databases.js'

const databases: PostgresTestDatabase[] = []

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (database) => database.drop()))
})

describe('PostgreSQL retrieval record persistence', () => {
  it('persists immutable query, trace, and assembled context contracts', async () => {
    const database = await createPostgresTestDatabase()
    databases.push(database)
    await migratePostgresSchema({ connectionString: database.connectionString })
    const pool = new Pool({ connectionString: database.connectionString, max: 1 })
    const client = await pool.connect()
    try {
      const records = [
        {
          schemaName: 'retrieval-query.v1',
          payload: RetrievalQueryV1Schema.parse(DOMAIN_CONTRACT_SAMPLES['retrieval-query.v1'])
        },
        {
          schemaName: 'retrieval-trace.v1',
          payload: RetrievalTraceV1Schema.parse(DOMAIN_CONTRACT_SAMPLES['retrieval-trace.v1'])
        },
        {
          schemaName: 'knowledge-context-manifest.v1',
          payload: KnowledgeContextManifestV1Schema.parse(
            DOMAIN_CONTRACT_SAMPLES['knowledge-context-manifest.v1']
          )
        }
      ]
      await insertPostgresDomainRecords(
        client,
        records.map(({ schemaName, payload }) => ({
          tenantId: payload.tenantId,
          recordId: payload.id,
          missionId: null,
          schemaName,
          recordKind: payload.kind,
          recordState: null,
          payload,
          createdAt: payload.createdAt
        }))
      )
      expect(
        (
          await client.query<{ schema_name: string }>(
            `SELECT schema_name FROM control_plane.domain_records
             WHERE tenant_id = 'tenant_s1'
               AND schema_name IN ('retrieval-query.v1', 'retrieval-trace.v1', 'knowledge-context-manifest.v1')
             ORDER BY schema_name`
          )
        ).rows.map((row) => row.schema_name)
      ).toEqual(['knowledge-context-manifest.v1', 'retrieval-query.v1', 'retrieval-trace.v1'])
      await expect(
        client.query(
          `UPDATE control_plane.domain_records SET record_state = 'changed'
           WHERE tenant_id = 'tenant_s1' AND record_id = 'retrieval_trace_s1'`
        )
      ).rejects.toMatchObject({ code: '55000' })
    } finally {
      client.release()
      await pool.end()
    }
  })
})
