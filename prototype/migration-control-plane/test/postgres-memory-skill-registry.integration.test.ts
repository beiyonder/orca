import { Pool } from 'pg'
import { afterEach, describe, expect, it } from 'vitest'
import {
  MemoryCandidateV1Schema,
  MemoryInvalidationV1Schema,
  MemoryUseV1Schema,
  MemoryVersionV1Schema
} from '../src/domain/memory-contracts.js'
import { SkillLifecycleEventV1Schema, SkillVersionV1Schema } from '../src/domain/skill-contracts.js'
import { insertPostgresDomainRecords } from '../src/database/postgres-domain-record-store.js'
import { migratePostgresSchema } from '../src/database/postgres-schema-migrator.js'
import { GovernedMemoryRegistry } from '../src/governed-memory-registry.js'
import { SkillCapabilityRegistry } from '../src/skill-capability-registry.js'
import {
  memoryCandidate,
  memoryInvalidation,
  memoryUse,
  memoryVersion,
  revokedMemoryVersion,
  skillEvent,
  skillVersion
} from './memory-skill-fixture.js'
import { createPostgresTestDatabase, type PostgresTestDatabase } from './postgres-test-databases.js'

const databases: PostgresTestDatabase[] = []

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (database) => database.drop()))
})

describe('PostgreSQL memory and skill registry persistence', () => {
  it('reconstructs revoked memory history and an active skill from immutable records', async () => {
    const database = await createPostgresTestDatabase()
    databases.push(database)
    await migratePostgresSchema({ connectionString: database.connectionString })
    const pool = new Pool({ connectionString: database.connectionString, max: 1 })
    const client = await pool.connect()
    try {
      const records = [
        {
          schemaName: 'memory-candidate.v1',
          payload: MemoryCandidateV1Schema.parse(memoryCandidate())
        },
        {
          schemaName: 'memory-version.v1',
          payload: MemoryVersionV1Schema.parse(memoryVersion())
        },
        {
          schemaName: 'memory-use.v1',
          payload: MemoryUseV1Schema.parse(memoryUse())
        },
        {
          schemaName: 'memory-invalidation.v1',
          payload: MemoryInvalidationV1Schema.parse(memoryInvalidation())
        },
        {
          schemaName: 'memory-version.v1',
          payload: MemoryVersionV1Schema.parse(revokedMemoryVersion())
        },
        { schemaName: 'skill-version.v1', payload: SkillVersionV1Schema.parse(skillVersion()) },
        {
          schemaName: 'skill-lifecycle-event.v1',
          payload: SkillLifecycleEventV1Schema.parse(skillEvent(1, null, 'quarantined'))
        },
        {
          schemaName: 'skill-lifecycle-event.v1',
          payload: SkillLifecycleEventV1Schema.parse(skillEvent(2, 'quarantined', 'certified'))
        },
        {
          schemaName: 'skill-lifecycle-event.v1',
          payload: SkillLifecycleEventV1Schema.parse(skillEvent(3, 'certified', 'active'))
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
          recordState:
            'status' in payload
              ? String(payload.status)
              : 'state' in payload
                ? String(payload.state.status)
                : 'toStatus' in payload
                  ? String(payload.toStatus)
                  : null,
          payload,
          createdAt: payload.createdAt
        }))
      )
      const stored = await client.query<{ schema_name: string; payload: unknown }>(
        `SELECT schema_name, payload
         FROM control_plane.domain_records
         WHERE tenant_id = 'tenant_s1'
           AND (schema_name LIKE 'memory-%' OR schema_name LIKE 'skill-%')
         ORDER BY created_at, record_id`
      )
      expect(stored.rows).toHaveLength(9)
      const bySchema = (schemaName: string) =>
        stored.rows.filter((row) => row.schema_name === schemaName).map((row) => row.payload)
      const memory = GovernedMemoryRegistry.reconstruct({
        candidates: bySchema('memory-candidate.v1'),
        versions: bySchema('memory-version.v1'),
        uses: bySchema('memory-use.v1'),
        invalidations: bySchema('memory-invalidation.v1')
      })
      expect(
        memory.recall({
          tenantId: 'tenant_s1',
          role: 'mapping',
          taskClass: 'identity-mapping',
          dataClass: 'synthetic',
          scope: { environment: 'synthetic', system: 'legacy-ehr', entity: 'legacy_patient' },
          product: 'legacy-ehr',
          productVersion: 'fixture-v1',
          asOf: '2026-01-01T00:03:00.000Z'
        })
      ).toEqual([])
      expect(memory.usesForVersion('memory_version_helpful_v1')).toHaveLength(1)

      const skills = SkillCapabilityRegistry.reconstruct({
        versions: bySchema('skill-version.v1'),
        events: bySchema('skill-lifecycle-event.v1')
      })
      expect(skills.status('tenant_s1', 'skill_version_identity_v1')).toBe('active')
      await expect(
        client.query(
          `DELETE FROM control_plane.domain_records
           WHERE tenant_id = 'tenant_s1' AND record_id = 'skill_version_identity_v1'`
        )
      ).rejects.toMatchObject({ code: '55000' })
    } finally {
      client.release()
      await pool.end()
    }
  })
})
