import { Pool } from 'pg'
import { afterEach, describe, expect, it } from 'vitest'
import { executePostgresDeterministicAssignment } from '../src/database/postgres-deterministic-evaluator.js'
import {
  dispatchPostgresEvaluation,
  reconcilePostgresEvaluation
} from '../src/database/postgres-evaluation-coordinator.js'
import { insertPostgresDomainRecords } from '../src/database/postgres-domain-record-store.js'
import {
  acknowledgeOutboxMessage,
  claimOutboxMessages,
  releaseOutboxMessage
} from '../src/database/postgres-message-delivery.js'
import { migratePostgresSchema } from '../src/database/postgres-schema-migrator.js'
import { createPostgresTestDatabase, type PostgresTestDatabase } from './postgres-test-databases.js'
import {
  DETERMINISTIC_DISPATCH_REQUEST,
  DETERMINISTIC_EVALUATION_CONTRACT,
  DETERMINISTIC_EVALUATOR_DEFINITION,
  DETERMINISTIC_EVALUATOR_SUITE,
  DETERMINISTIC_INPUT_EVIDENCE,
  DETERMINISTIC_SUBJECT,
  DETERMINISTIC_SUITE_EVIDENCE
} from './deterministic-evaluator-fixture.js'
import { seedEvaluationMission } from './postgres-evaluation-mission.js'

const databases: PostgresTestDatabase[] = []
const pools: Pool[] = []

afterEach(async () => {
  await Promise.all(pools.splice(0).map(async (pool) => pool.end()))
  await Promise.all(databases.splice(0).map(async (database) => database.drop()))
})

async function seedDeterministicAuthority(pool: Pool): Promise<void> {
  await seedEvaluationMission(pool)
  const records = [
    {
      schemaName: 'evaluator-definition.v2',
      payload: DETERMINISTIC_EVALUATOR_DEFINITION,
      missionId: null,
      state: 'active'
    },
    {
      schemaName: 'evaluation-contract.v2',
      payload: DETERMINISTIC_EVALUATION_CONTRACT,
      missionId: null,
      state: 'active'
    },
    {
      schemaName: 'deterministic-evaluator-suite.v1',
      payload: DETERMINISTIC_EVALUATOR_SUITE,
      missionId: null,
      state: 'active'
    },
    {
      schemaName: 'migration-proposal.v1',
      payload: DETERMINISTIC_SUBJECT,
      missionId: null,
      state: DETERMINISTIC_SUBJECT.state
    },
    {
      schemaName: 'evidence-item.v1',
      payload: DETERMINISTIC_INPUT_EVIDENCE,
      missionId: DETERMINISTIC_INPUT_EVIDENCE.missionId,
      state: 'current'
    },
    {
      schemaName: 'evidence-item.v1',
      payload: DETERMINISTIC_SUITE_EVIDENCE,
      missionId: DETERMINISTIC_SUITE_EVIDENCE.missionId,
      state: 'current'
    }
  ] as const
  const client = await pool.connect()
  try {
    await insertPostgresDomainRecords(
      client,
      records.map((record) => ({
        tenantId: record.payload.tenantId,
        recordId: record.payload.id,
        missionId: record.missionId,
        schemaName: record.schemaName,
        recordKind: record.payload.kind,
        recordState: record.state,
        payload: record.payload,
        createdAt: record.payload.createdAt
      }))
    )
  } finally {
    client.release()
  }
}

describe('PostgreSQL deterministic evaluator', () => {
  it('consumes a claim, persists typed output, replays after redelivery, and reconciles', async () => {
    const database = await createPostgresTestDatabase()
    databases.push(database)
    await migratePostgresSchema({ connectionString: database.connectionString })
    const pool = new Pool({ connectionString: database.connectionString, max: 4 })
    pools.push(pool)
    await seedDeterministicAuthority(pool)
    const dispatch = await dispatchPostgresEvaluation(pool, DETERMINISTIC_DISPATCH_REQUEST)
    expect(dispatch.disposition).toBe('inserted')
    const firstClaims = await claimOutboxMessages(pool, {
      tenantId: 'tenant_s1',
      workerId: 'deterministic-evaluator',
      now: '2026-01-01T00:04:00.000Z',
      leaseMs: 120_000,
      limit: 10
    })
    expect(firstClaims).toHaveLength(1)
    const firstClaim = firstClaims[0]!
    const first = await executePostgresDeterministicAssignment(pool, {
      claim: firstClaim,
      suiteId: DETERMINISTIC_EVALUATOR_SUITE.id,
      dataClass: 'synthetic',
      observedAt: '2026-01-01T00:04:30.000Z'
    })
    expect(first).toMatchObject({
      disposition: 'inserted',
      report: { status: 'passed', acceptanceAuthority: 'none' },
      result: { status: 'passed', acceptanceAuthority: 'none' }
    })
    await releaseOutboxMessage(pool, {
      tenantId: firstClaim.tenantId,
      messageId: firstClaim.messageId,
      workerId: firstClaim.leaseOwner,
      fence: firstClaim.fence,
      now: '2026-01-01T00:04:31.000Z',
      availableAt: '2026-01-01T00:04:31.000Z'
    })
    const secondClaims = await claimOutboxMessages(pool, {
      tenantId: 'tenant_s1',
      workerId: 'deterministic-evaluator-retry',
      now: '2026-01-01T00:04:31.000Z',
      leaseMs: 120_000,
      limit: 10
    })
    expect(secondClaims).toHaveLength(1)
    const secondClaim = secondClaims[0]!
    const replay = await executePostgresDeterministicAssignment(pool, {
      claim: secondClaim,
      suiteId: DETERMINISTIC_EVALUATOR_SUITE.id,
      dataClass: 'synthetic',
      observedAt: '2026-01-01T00:04:31.000Z'
    })
    expect(replay).toEqual({ ...first, disposition: 'replayed' })
    await expect(
      acknowledgeOutboxMessage(pool, {
        tenantId: secondClaim.tenantId,
        messageId: secondClaim.messageId,
        workerId: secondClaim.leaseOwner,
        fence: secondClaim.fence,
        deliveredAt: '2026-01-01T00:04:31.000Z'
      })
    ).resolves.toEqual({ disposition: 'acknowledged' })
    const coordination = await reconcilePostgresEvaluation(pool, {
      tenantId: 'tenant_s1',
      missionId: 'mission_s1',
      coordinationKey: DETERMINISTIC_DISPATCH_REQUEST.coordinationKey,
      observedAt: '2026-01-01T00:04:31.000Z',
      observedBy: { kind: 'system', id: 'evaluation-coordinator', version: '1' }
    })
    expect(coordination.coordination).toMatchObject({
      outcome: 'ready-for-reconciliation',
      acceptanceDisposition: 'eligible-for-reconciliation',
      acceptanceAuthority: 'none'
    })
    const counts = await pool.query<{ reports: string; results: string; output_evidence: string }>(
      `SELECT
         count(*) FILTER (WHERE schema_name = 'evaluation-deterministic-report.v1')::text AS reports,
         count(*) FILTER (WHERE schema_name = 'evaluation-result.v2')::text AS results,
         count(*) FILTER (
           WHERE schema_name = 'evidence-item.v1' AND payload ->> 'sourceRole' = 'evaluator-result'
         )::text AS output_evidence
       FROM control_plane.domain_records
       WHERE tenant_id = 'tenant_s1'`
    )
    expect(counts.rows[0]).toEqual({ reports: '1', results: '1', output_evidence: '1' })
    await expect(
      pool.query(
        `UPDATE control_plane.domain_records
         SET record_state = 'changed'
         WHERE tenant_id = 'tenant_s1' AND record_id = $1`,
        [first.report.id]
      )
    ).rejects.toSatisfy(
      (error: unknown) =>
        typeof error === 'object' && error !== null && 'code' in error && error.code === '55000'
    )
  })
})
