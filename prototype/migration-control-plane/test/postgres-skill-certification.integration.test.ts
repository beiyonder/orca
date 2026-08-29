import { Pool } from 'pg'
import { afterEach, describe, expect, it } from 'vitest'
import { insertPostgresDomainRecords } from '../src/database/postgres-domain-record-store.js'
import { migratePostgresSchema } from '../src/database/postgres-schema-migrator.js'
import { SkillCertificationRegistry } from '../src/skill-certification-registry.js'
import { createPostgresTestDatabase, type PostgresTestDatabase } from './postgres-test-databases.js'
import {
  BASELINE_POINTER,
  BASELINE_SKILL,
  CANDIDATE_POINTER,
  CANDIDATE_SKILL,
  REGRESSION,
  SKILL_CERTIFICATION
} from './skill-certification-fixture.js'

const databases: PostgresTestDatabase[] = []
const pools: Pool[] = []

afterEach(async () => {
  await Promise.all(pools.splice(0).map(async (pool) => pool.end()))
  await Promise.all(databases.splice(0).map(async (database) => database.drop()))
})

describe('PostgreSQL skill certification lifecycle', () => {
  it('reconstructs certification, activation, regression, revocation, and rollback', async () => {
    const database = await createPostgresTestDatabase()
    databases.push(database)
    await migratePostgresSchema({ connectionString: database.connectionString })
    const pool = new Pool({ connectionString: database.connectionString, max: 1 })
    pools.push(pool)
    const records = [
      ['skill-version.v1', BASELINE_SKILL, 'version'],
      ['skill-version.v1', CANDIDATE_SKILL, 'version'],
      ['skill-certification.v1', SKILL_CERTIFICATION, SKILL_CERTIFICATION.status],
      ['skill-active-pointer.v1', BASELINE_POINTER, BASELINE_POINTER.status],
      ['skill-active-pointer.v1', CANDIDATE_POINTER, CANDIDATE_POINTER.status],
      ['skill-regression.v1', REGRESSION.regression, REGRESSION.regression.action],
      ['skill-active-pointer.v1', REGRESSION.pointer, REGRESSION.pointer.status],
      ['skill-lifecycle-event.v1', REGRESSION.lifecycleEvent, REGRESSION.lifecycleEvent.toStatus]
    ] as const
    const client = await pool.connect()
    try {
      await insertPostgresDomainRecords(
        client,
        records.map(([schemaName, payload, state]) => ({
          tenantId: payload.tenantId,
          recordId: payload.id,
          missionId: null,
          schemaName,
          recordKind: payload.kind,
          recordState: state,
          payload,
          createdAt: payload.createdAt
        }))
      )
    } finally {
      client.release()
    }
    const stored = await pool.query<{ record_id: string; schema_name: string; payload: unknown }>(
      `SELECT record_id, schema_name, payload
       FROM control_plane.domain_records
       WHERE tenant_id = 'tenant_s1'
         AND schema_name = ANY($1::text[])
       ORDER BY created_at, record_id`,
      [[...new Set(records.map(([schemaName]) => schemaName))]]
    )
    const storedPayloads = new Map(stored.rows.map((row) => [row.record_id, row.payload]))
    const registry = new SkillCertificationRegistry()
    registry.registerVersion(storedPayloads.get(BASELINE_SKILL.id))
    registry.registerVersion(storedPayloads.get(CANDIDATE_SKILL.id))
    registry.registerCertification(storedPayloads.get(SKILL_CERTIFICATION.id))
    registry.recordPointer(storedPayloads.get(BASELINE_POINTER.id))
    registry.recordPointer(storedPayloads.get(CANDIDATE_POINTER.id))
    registry.recordRegression({
      regression: storedPayloads.get(REGRESSION.regression.id),
      pointer: storedPayloads.get(REGRESSION.pointer.id),
      lifecycleEvent: storedPayloads.get(REGRESSION.lifecycleEvent.id)
    })
    expect(registry.resolveActive(BASELINE_SKILL.skillId)).toEqual(BASELINE_SKILL)
    await expect(
      pool.query(
        `UPDATE control_plane.domain_records
         SET record_state = 'changed'
         WHERE tenant_id = 'tenant_s1' AND record_id = $1`,
        [SKILL_CERTIFICATION.id]
      )
    ).rejects.toSatisfy(
      (error: unknown) =>
        typeof error === 'object' && error !== null && 'code' in error && error.code === '55000'
    )
  })
})
