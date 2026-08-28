import { Pool } from 'pg'
import { buildDurableConvergenceFixture } from './durable-convergence-fixture.js'
import {
  completeDurableFencedAttempt,
  seedDurablePlanAndTask
} from './durable-convergence-attempt.js'
import type { DurableTransitionFixture } from './durable-convergence-types.js'
import {
  createEvaluationMeasure as measure,
  type ExperimentResult
} from './experiment-contracts.js'
import { executeIdempotentMissionCommand } from './database/postgres-command-idempotency.js'
import { commitMissionTransition } from './database/postgres-mission-transition.js'
import { migratePostgresSchema } from './database/postgres-schema-migrator.js'
import { rebuildMissionProjection } from './database/postgres-projection-rebuild.js'
import { reconcileKernelRestart } from './database/postgres-restart-reconciliation.js'
import { withPostgresTransaction } from './database/postgres-transaction.js'

async function executeTransition(
  pool: Pool,
  transition: DurableTransitionFixture,
  afterTransition?: () => never
) {
  return executeIdempotentMissionCommand(pool, transition.command, async (client, command) => {
    const result = await commitMissionTransition(client, command, transition)
    afterTransition?.()
    return result
  })
}

export async function runDurableConvergenceExperiment(
  connectionString: string,
  seed: number
): Promise<ExperimentResult> {
  await migratePostgresSchema({ connectionString })
  const pool = new Pool({ connectionString, max: 8 })
  try {
    const fixture = buildDurableConvergenceFixture(seed)
    let createExecutions = 0
    const created = await executeIdempotentMissionCommand(
      pool,
      fixture.create.command,
      async (client, command) => {
        createExecutions += 1
        return commitMissionTransition(client, command, fixture.create)
      }
    )
    const createReplay = await executeTransition(pool, fixture.create)
    await withPostgresTransaction(pool, async (client) => seedDurablePlanAndTask(client, fixture))
    const staleRejected = await completeDurableFencedAttempt(pool, fixture)

    let crashRolledBack = false
    try {
      await executeTransition(pool, fixture.complete, () => {
        throw new Error('injected crash after transition before commit')
      })
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('injected crash')) {
        throw error
      }
      crashRolledBack = true
    }
    const completed = await executeTransition(pool, fixture.complete)
    const completedReplay = await executeTransition(pool, fixture.complete)
    const originalProjection = await pool.query<{ projection_sha256: string }>(
      `SELECT trim(projection_sha256) AS projection_sha256
       FROM control_plane.mission_projections
       WHERE tenant_id = $1 AND mission_id = $2 AND projection_name = 'mission'`,
      [fixture.tenantId, fixture.missionId]
    )
    await pool.query(
      `DELETE FROM control_plane.mission_projections
       WHERE tenant_id = $1 AND mission_id = $2 AND projection_name = 'mission'`,
      [fixture.tenantId, fixture.missionId]
    )
    const rebuilt = await rebuildMissionProjection(pool, {
      tenantId: fixture.tenantId,
      missionId: fixture.missionId
    })
    const recoveries = (
      await reconcileKernelRestart(pool, { now: '2026-01-01T00:20:00.000Z' })
    ).filter((item) => item.tenantId === fixture.tenantId)

    const state = await pool.query<{
      mission_state: string
      revision: string
      task_state: string
      attempt_state: string
      commands: string
      events: string
      outbox: string
      recovery: string
    }>(
      `SELECT aggregate.mission_state,
              aggregate.revision::text AS revision,
              task.task_state,
              attempt.attempt_state,
              (SELECT count(*)::text FROM control_plane.mission_commands WHERE tenant_id = $1) AS commands,
              (SELECT count(*)::text FROM control_plane.mission_events WHERE tenant_id = $1) AS events,
              (SELECT count(*)::text FROM control_plane.outbox_messages WHERE tenant_id = $1) AS outbox,
              (SELECT count(*)::text FROM control_plane.recovery_work WHERE tenant_id = $1) AS recovery
       FROM control_plane.mission_aggregates AS aggregate
       JOIN control_plane.task_executions AS task ON task.tenant_id = aggregate.tenant_id
       JOIN control_plane.assignment_attempts AS attempt ON attempt.tenant_id = task.tenant_id
         AND attempt.attempt_id = task.current_attempt_id
       WHERE aggregate.tenant_id = $1 AND aggregate.mission_id = $2`,
      [fixture.tenantId, fixture.missionId]
    )
    const row = state.rows[0]!
    const predicates = {
      duplicateSafe:
        createExecutions === 1 &&
        created.disposition === 'executed' &&
        createReplay.disposition === 'replayed' &&
        completedReplay.disposition === 'replayed',
      crashRecovered: crashRolledBack && completed.disposition === 'executed',
      staleRejected,
      projectionExact: rebuilt.projectionSha256 === originalProjection.rows[0]?.projection_sha256,
      atomicCounts: row.commands === '2' && row.events === '2' && row.outbox === '2',
      terminalState:
        row.mission_state === 'completed' &&
        row.revision === '2' &&
        row.task_state === 'completed' &&
        row.attempt_state === 'succeeded',
      restartCovered: recoveries.length === 2 && row.recovery === '2'
    }
    const passed = Object.values(predicates).every(Boolean)
    return {
      status: passed ? 'passed' : 'failed',
      summary: passed
        ? 'Durable kernel converged across duplicate, crash, stale, replay, and restart paths.'
        : 'One or more durable convergence predicates failed.',
      measures: Object.entries(predicates).map(([name, value]) =>
        measure(name, value ? 'pass' : 'fail', value, 'true', [
          'control_plane.mission_commands',
          'control_plane.mission_events',
          'control_plane.recovery_work'
        ])
      ),
      outputs: {
        tenantId: fixture.tenantId,
        missionId: fixture.missionId,
        projectionSha256: rebuilt.projectionSha256,
        state: row,
        recoveryDispositions: recoveries
      },
      limitations: [
        'Synthetic control-plane fixture; no model or external target effect is invoked.'
      ]
    }
  } finally {
    await pool.end()
  }
}
