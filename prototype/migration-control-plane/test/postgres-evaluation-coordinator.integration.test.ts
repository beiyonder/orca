import { Pool } from 'pg'
import { afterEach, describe, expect, it } from 'vitest'
import { canonicalJson, sha256Text } from '../src/canonical-json.js'
import {
  dispatchPostgresEvaluation,
  reconcilePostgresEvaluation
} from '../src/database/postgres-evaluation-coordinator.js'
import { insertPostgresDomainRecords } from '../src/database/postgres-domain-record-store.js'
import { claimOutboxMessages } from '../src/database/postgres-message-delivery.js'
import { migratePostgresSchema } from '../src/database/postgres-schema-migrator.js'
import { MissionRecordV1Schema } from '../src/domain/mission-contracts.js'
import { createPostgresTestDatabase, type PostgresTestDatabase } from './postgres-test-databases.js'
import { DOMAIN_CONTRACT_SAMPLES } from './domain-contract-samples.js'
import {
  buildEvaluationDispatchInput,
  buildEvaluationResult
} from './evaluation-coordinator-fixture.js'

const databases: PostgresTestDatabase[] = []
const pools: Pool[] = []

function trackedPool(connectionString: string): Pool {
  const pool = new Pool({ connectionString, max: 4 })
  pools.push(pool)
  return pool
}

async function closeTrackedPool(pool: Pool): Promise<void> {
  const index = pools.indexOf(pool)
  if (index !== -1) {
    pools.splice(index, 1)
  }
  await pool.end()
}

afterEach(async () => {
  await Promise.all(pools.splice(0).map(async (pool) => pool.end()))
  await Promise.all(databases.splice(0).map(async (database) => database.drop()))
})

async function seedMissionAndAuthority(pool: Pool): Promise<void> {
  const mission = MissionRecordV1Schema.parse(DOMAIN_CONTRACT_SAMPLES['mission-record.v1'])
  const dispatch = buildEvaluationDispatchInput()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await insertPostgresDomainRecords(client, [
      {
        tenantId: mission.tenantId,
        recordId: mission.id,
        missionId: mission.id,
        schemaName: 'mission-record.v1',
        recordKind: mission.kind,
        recordState: mission.state.status,
        payload: mission,
        createdAt: mission.createdAt
      },
      ...dispatch.evaluatorDefinitions.map((definition) => ({
        tenantId: definition.tenantId,
        recordId: definition.id,
        missionId: null,
        schemaName: 'evaluator-definition.v2',
        recordKind: definition.kind,
        recordState: 'active',
        payload: definition,
        createdAt: definition.createdAt
      })),
      {
        tenantId: dispatch.contract.tenantId,
        recordId: dispatch.contract.id,
        missionId: null,
        schemaName: 'evaluation-contract.v2',
        recordKind: dispatch.contract.kind,
        recordState: 'active',
        payload: dispatch.contract,
        createdAt: dispatch.contract.createdAt
      }
    ])
    const missionJson = canonicalJson(mission)
    await client.query(
      `INSERT INTO control_plane.mission_aggregates (
         tenant_id, mission_id, revision, mission_state, current_plan_revision_id,
         record, record_sha256, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)`,
      [
        mission.tenantId,
        mission.id,
        mission.revision,
        mission.state.status,
        mission.currentPlanRevisionId,
        missionJson,
        sha256Text(missionJson),
        mission.createdAt,
        mission.updatedAt
      ]
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function persistResults(
  pool: Pool,
  results: readonly ReturnType<typeof buildEvaluationResult>[]
): Promise<void> {
  const client = await pool.connect()
  try {
    await insertPostgresDomainRecords(
      client,
      results.map((result) => ({
        tenantId: result.tenantId,
        recordId: result.id,
        missionId: result.missionId,
        schemaName: 'evaluation-result.v2',
        recordKind: result.kind,
        recordState: result.status,
        payload: result,
        createdAt: result.createdAt
      }))
    )
  } finally {
    client.release()
  }
}

describe('PostgreSQL evaluation coordinator', () => {
  it('dispatches idempotently, reconstructs after restart, and isolates unresolved work', async () => {
    const database = await createPostgresTestDatabase()
    databases.push(database)
    await migratePostgresSchema({ connectionString: database.connectionString })
    let pool = trackedPool(database.connectionString)
    await seedMissionAndAuthority(pool)
    const request = buildEvaluationDispatchInput('missing-evaluation')
    const concurrent = await Promise.all([
      dispatchPostgresEvaluation(pool, request),
      dispatchPostgresEvaluation(pool, request)
    ])
    expect(concurrent.map((result) => result.disposition).sort()).toEqual(['inserted', 'replayed'])
    const counts = await pool.query<{ assignments: string; coordinations: string; outbox: string }>(
      `SELECT
         count(*) FILTER (WHERE schema_name = 'evaluation-assignment.v2')::text AS assignments,
         count(*) FILTER (WHERE schema_name = 'evaluation-coordination.v1')::text AS coordinations,
         (SELECT count(*)::text FROM control_plane.outbox_messages WHERE topic = 'evaluation.assignment.v2') AS outbox
       FROM control_plane.domain_records
       WHERE tenant_id = 'tenant_s1'`
    )
    expect(counts.rows[0]).toEqual({ assignments: '2', coordinations: '1', outbox: '2' })
    const claims = await claimOutboxMessages(pool, {
      tenantId: 'tenant_s1',
      workerId: 'independent-evaluator-broker',
      now: request.createdAt,
      leaseMs: 60_000,
      limit: 10
    })
    expect(claims).toHaveLength(2)
    expect(claims.every((claim) => claim.topic === 'evaluation.assignment.v2')).toBe(true)

    await closeTrackedPool(pool)
    pool = trackedPool(database.connectionString)
    const missing = await reconcilePostgresEvaluation(pool, {
      tenantId: 'tenant_s1',
      missionId: 'mission_s1',
      coordinationKey: request.coordinationKey,
      observedAt: request.resultDeadlineAt,
      observedBy: { kind: 'system', id: 'evaluation-coordinator', version: '1' }
    })
    expect(missing.coordination).toMatchObject({
      outcome: 'unresolved',
      unresolvedReasons: ['missing-result'],
      unrelatedWorkDisposition: 'continue'
    })
    expect(
      await reconcilePostgresEvaluation(pool, {
        tenantId: 'tenant_s1',
        missionId: 'mission_s1',
        coordinationKey: request.coordinationKey,
        observedAt: request.resultDeadlineAt,
        observedBy: { kind: 'system', id: 'evaluation-coordinator', version: '1' }
      })
    ).toMatchObject({ disposition: 'replayed', coordination: { id: missing.coordination.id } })

    const passingRequest = buildEvaluationDispatchInput('unrelated-passing-evaluation')
    const passing = await dispatchPostgresEvaluation(pool, passingRequest)
    await persistResults(pool, [
      buildEvaluationResult(passing, 0, 'passed'),
      buildEvaluationResult(passing, 1, 'passed')
    ])
    const ready = await reconcilePostgresEvaluation(pool, {
      tenantId: 'tenant_s1',
      missionId: 'mission_s1',
      coordinationKey: passingRequest.coordinationKey,
      observedAt: '2026-01-01T00:01:30.000Z',
      observedBy: { kind: 'system', id: 'evaluation-coordinator', version: '1' }
    })
    expect(ready.coordination).toMatchObject({
      outcome: 'ready-for-reconciliation',
      acceptanceDisposition: 'eligible-for-reconciliation',
      acceptanceAuthority: 'none'
    })
    const latest = await pool.query<{ key: string; outcome: string }>(
      `SELECT DISTINCT ON (payload ->> 'coordinationKey')
         payload ->> 'coordinationKey' AS key,
         payload ->> 'outcome' AS outcome
       FROM control_plane.domain_records
       WHERE schema_name = 'evaluation-coordination.v1'
       ORDER BY payload ->> 'coordinationKey', (payload ->> 'version')::integer DESC`
    )
    expect(latest.rows).toEqual([
      { key: 'missing-evaluation', outcome: 'unresolved' },
      { key: 'unrelated-passing-evaluation', outcome: 'ready-for-reconciliation' }
    ])
    await expect(
      pool.query(
        `UPDATE control_plane.domain_records
         SET record_state = 'changed'
         WHERE tenant_id = 'tenant_s1' AND record_id = $1`,
        [missing.coordination.id]
      )
    ).rejects.toSatisfy(
      (error: unknown) =>
        typeof error === 'object' && error !== null && 'code' in error && error.code === '55000'
    )
  })
})
