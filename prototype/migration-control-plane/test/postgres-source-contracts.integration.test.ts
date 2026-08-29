import { Pool } from 'pg'
import { afterEach, describe, expect, it } from 'vitest'
import { insertPostgresDomainRecords } from '../src/database/postgres-domain-record-store.js'
import { migratePostgresSchema } from '../src/database/postgres-schema-migrator.js'
import { parseDomainRecord } from '../src/domain/domain-contract-registry.js'
import {
  SourceAccessEnvelopeV1Schema,
  SourceAdapterDefinitionV1Schema
} from '../src/domain/source-adapter-contracts.js'
import {
  SourceObservationV1Schema,
  SourceRequestV1Schema
} from '../src/domain/source-probe-contracts.js'
import { SourceAdapterRegistry } from '../src/source-adapter-registry.js'
import { createPostgresTestDatabase, type PostgresTestDatabase } from './postgres-test-databases.js'
import { DOMAIN_CONTRACT_SAMPLES } from './domain-contract-samples.js'
import { SOURCE_CONTRACT_SAMPLES } from './source-contract-samples.js'
import { SOURCE_DISCOVERY_CONTRACT_SAMPLES } from './source-discovery-contract-samples.js'

const databases: PostgresTestDatabase[] = []

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (database) => database.drop()))
})

describe('PostgreSQL source adapter contracts', () => {
  it('persists immutable authority and reconstructs request/observation lineage', async () => {
    const database = await createPostgresTestDatabase()
    databases.push(database)
    await migratePostgresSchema({ connectionString: database.connectionString })
    const definition = SourceAdapterDefinitionV1Schema.parse(
      SOURCE_CONTRACT_SAMPLES['source-adapter-definition.v1']
    )
    const access = SourceAccessEnvelopeV1Schema.parse(
      SOURCE_CONTRACT_SAMPLES['source-access-envelope.v1']
    )
    const request = SourceRequestV1Schema.parse(SOURCE_CONTRACT_SAMPLES['source-request.v1'])
    const observation = SourceObservationV1Schema.parse(
      SOURCE_CONTRACT_SAMPLES['source-observation.v1']
    )
    const records = [definition, access, request, observation]
    const pool = new Pool({ connectionString: database.connectionString, max: 1 })
    const client = await pool.connect()
    try {
      await insertPostgresDomainRecords(
        client,
        records.map((payload) => ({
          tenantId: payload.tenantId,
          recordId: payload.id,
          missionId: null,
          schemaName: `${payload.kind}.v1` as
            | 'source-access-envelope.v1'
            | 'source-adapter-definition.v1'
            | 'source-observation.v1'
            | 'source-request.v1',
          recordKind: payload.kind,
          recordState: payload.kind === 'source-observation' ? payload.outcome.status : 'immutable',
          payload,
          createdAt: payload.createdAt
        }))
      )
      const stored = await client.query<{ payload: unknown; schema_name: string }>(
        `SELECT schema_name, payload
         FROM control_plane.domain_records
         WHERE tenant_id = 'tenant_s1' AND schema_name LIKE 'source-%'
         ORDER BY schema_name`
      )
      expect(stored.rows).toHaveLength(4)
      const bySchema = (name: string) =>
        stored.rows.filter((row) => row.schema_name === name).map((row) => row.payload)
      expect(() =>
        SourceAdapterRegistry.reconstruct({
          definitions: bySchema('source-adapter-definition.v1'),
          accessEnvelopes: bySchema('source-access-envelope.v1'),
          requests: bySchema('source-request.v1'),
          observations: bySchema('source-observation.v1')
        })
      ).not.toThrow()
      await expect(
        client.query(
          `UPDATE control_plane.domain_records
           SET record_state = 'changed'
           WHERE tenant_id = 'tenant_s1' AND record_id = 'source_request_pagila_inventory'`
        )
      ).rejects.toSatisfy(
        (error: unknown) =>
          typeof error === 'object' && error !== null && 'code' in error && error.code === '55000'
      )
    } finally {
      client.release()
      await pool.end()
    }
  })

  it('persists immutable inventory, profile, code, and lineage projections', async () => {
    const database = await createPostgresTestDatabase()
    databases.push(database)
    await migratePostgresSchema({ connectionString: database.connectionString })
    const names = [
      'source-code-extract.v1',
      'source-data-profile.v1',
      'source-lineage-snapshot.v1',
      'source-schema-inventory.v1',
      'source-system-inventory.v1'
    ] as const
    const records = names.map((name) => ({
      name,
      payload: parseDomainRecord(name, SOURCE_DISCOVERY_CONTRACT_SAMPLES[name])
    }))
    const pool = new Pool({ connectionString: database.connectionString, max: 1 })
    const client = await pool.connect()
    try {
      await insertPostgresDomainRecords(
        client,
        records.map(({ name, payload }) => ({
          tenantId: payload.tenantId,
          recordId: payload.id,
          missionId: null,
          schemaName: name,
          recordKind: payload.kind,
          recordState: 'immutable',
          payload,
          createdAt: payload.createdAt
        }))
      )
      const stored = await client.query<{ schema_name: string }>(
        `SELECT schema_name
         FROM control_plane.domain_records
         WHERE tenant_id = 'tenant_s1' AND schema_name LIKE 'source-%'
         ORDER BY schema_name`
      )
      expect(stored.rows.map((row) => row.schema_name)).toEqual(names)
      await expect(
        client.query(
          `DELETE FROM control_plane.domain_records
           WHERE tenant_id = 'tenant_s1' AND record_id = 'source_schema_inventory_pagila'`
        )
      ).rejects.toSatisfy(
        (error: unknown) =>
          typeof error === 'object' && error !== null && 'code' in error && error.code === '55000'
      )
    } finally {
      client.release()
      await pool.end()
    }
  })

  it('persists immutable CDC, reasoning, target, and proposal records', async () => {
    const database = await createPostgresTestDatabase()
    databases.push(database)
    await migratePostgresSchema({ connectionString: database.connectionString })
    const names = [
      'discovery-gap-ranking.v1',
      'migration-proposal.v1',
      'safe-probe-plan.v1',
      'source-cdc-analysis.v1',
      'source-cdc-trace.v1',
      'source-claim-comparison.v1',
      'target-capability-snapshot.v1'
    ] as const
    const records = names.map((name) => ({
      name,
      payload: parseDomainRecord(name, DOMAIN_CONTRACT_SAMPLES[name])
    }))
    const pool = new Pool({ connectionString: database.connectionString, max: 1 })
    const client = await pool.connect()
    try {
      await insertPostgresDomainRecords(
        client,
        records.map(({ name, payload }) => ({
          tenantId: payload.tenantId,
          recordId: payload.id,
          missionId: null,
          schemaName: name,
          recordKind: payload.kind,
          recordState: 'immutable',
          payload,
          createdAt: payload.createdAt
        }))
      )
      const stored = await client.query<{ schema_name: string }>(
        `SELECT schema_name
         FROM control_plane.domain_records
         WHERE tenant_id = 'tenant_s1'
           AND schema_name = ANY($1::text[])
         ORDER BY schema_name`,
        [names]
      )
      expect(stored.rows.map((row) => row.schema_name)).toEqual(names)
      await expect(
        client.query(
          `UPDATE control_plane.domain_records
           SET record_state = 'changed'
           WHERE tenant_id = 'tenant_s1'
             AND record_id = 'target_capability_snapshot_fixture_v1'`
        )
      ).rejects.toSatisfy(
        (error: unknown) =>
          typeof error === 'object' && error !== null && 'code' in error && error.code === '55000'
      )
    } finally {
      client.release()
      await pool.end()
    }
  })
})
