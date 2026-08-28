import { Pool } from 'pg'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CorpusChunkV1Schema,
  CorpusEntityV1Schema,
  CorpusParseVersionV1Schema,
  CorpusRelationV1Schema,
  CorpusSourceManifestV1Schema
} from '../src/domain/knowledge-contracts.js'
import { insertPostgresDomainRecords } from '../src/database/postgres-domain-record-store.js'
import { migratePostgresSchema } from '../src/database/postgres-schema-migrator.js'
import { canonicalJson, sha256Text } from '../src/canonical-json.js'
import { corpusManifest, corpusParseBundle } from './corpus-foundation-fixture.js'
import { createPostgresTestDatabase, type PostgresTestDatabase } from './postgres-test-databases.js'

const databases: PostgresTestDatabase[] = []

function postgresErrorCode(error: unknown): string | undefined {
  return error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (database) => database.drop()))
})

describe('PostgreSQL corpus contract persistence', () => {
  it('binds all corpus schemas and keeps persisted knowledge records immutable', async () => {
    const database = await createPostgresTestDatabase()
    databases.push(database)
    await migratePostgresSchema({ connectionString: database.connectionString })
    const pool = new Pool({ connectionString: database.connectionString, max: 1 })
    const client = await pool.connect()
    try {
      const source = CorpusSourceManifestV1Schema.parse(corpusManifest())
      const rawBundle = corpusParseBundle()
      const parse = CorpusParseVersionV1Schema.parse(rawBundle.parse)
      const chunks = rawBundle.chunks.map((chunk) => CorpusChunkV1Schema.parse(chunk))
      const entities = rawBundle.entities.map((entity) => CorpusEntityV1Schema.parse(entity))
      const relations = rawBundle.relations.map((relation) =>
        CorpusRelationV1Schema.parse(relation)
      )
      const records = [
        { schemaName: 'corpus-source-manifest.v1', payload: source },
        { schemaName: 'corpus-parse-version.v1', payload: parse },
        ...chunks.map((payload) => ({ schemaName: 'corpus-chunk.v1', payload })),
        ...entities.map((payload) => ({ schemaName: 'corpus-entity.v1', payload })),
        ...relations.map((payload) => ({ schemaName: 'corpus-relation.v1', payload }))
      ]
      await client.query('BEGIN')
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
      await client.query('COMMIT')

      const stored = await client.query<{
        record_id: string
        schema_name: string
        payload: unknown
        payload_sha256: string
      }>(
        `SELECT record_id, schema_name, payload, trim(payload_sha256) AS payload_sha256
         FROM control_plane.domain_records
         WHERE tenant_id = 'tenant_s1' AND schema_name LIKE 'corpus-%'
         ORDER BY record_id`
      )
      expect(stored.rows).toHaveLength(7)
      for (const row of stored.rows) {
        expect(row.payload_sha256).toBe(sha256Text(canonicalJson(row.payload)))
      }
      expect(
        (
          await client.query<{ schema_name: string }>(
            `SELECT schema_name FROM control_plane.contract_schemas
             WHERE schema_name LIKE 'corpus-%' ORDER BY schema_name`
          )
        ).rows.map((row) => row.schema_name)
      ).toEqual([
        'corpus-chunk.v1',
        'corpus-entity.v1',
        'corpus-parse-version.v1',
        'corpus-relation.v1',
        'corpus-source-manifest.v1'
      ])

      await expect(
        client.query(
          `UPDATE control_plane.domain_records SET record_state = 'changed'
           WHERE tenant_id = 'tenant_s1' AND record_id = 'corpus_chunk_patient_num'`
        )
      ).rejects.toSatisfy((error: unknown) => postgresErrorCode(error) === '55000')
      await expect(
        client.query(
          `DELETE FROM control_plane.domain_records
           WHERE tenant_id = 'tenant_s1' AND record_id = 'corpus_chunk_patient_num'`
        )
      ).rejects.toSatisfy((error: unknown) => postgresErrorCode(error) === '55000')
    } finally {
      client.release()
      await pool.end()
    }
  })
})
