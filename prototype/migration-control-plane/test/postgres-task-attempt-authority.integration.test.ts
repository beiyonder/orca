import type { Pool } from 'pg'
import { afterEach, describe, expect, it } from 'vitest'
import { StaleAttemptAuthorityError, TaskClaimConflictError } from '../src/attempt-authority.js'
import { advanceAuthoritativeAttempt } from '../src/database/postgres-attempt-advancement.js'
import { claimTaskAttempt } from '../src/database/postgres-task-attempt-claim.js'
import { DOMAIN_CONTRACT_SAMPLES } from './domain-contract-samples.js'
import {
  createPostgresKernelTestContext,
  type PostgresKernelTestContext
} from './postgres-kernel-test-context.js'
import { seedRunnableTaskFixture } from './postgres-task-test-fixture.js'

const contexts: PostgresKernelTestContext[] = []
const leaseExpiresAt = '2026-01-01T00:01:00.000Z'

type ClaimRecordPair = {
  attempt: Record<string, unknown>
  leasedTask: Record<string, unknown>
}

async function kernelPool(): Promise<Pool> {
  const context = await createPostgresKernelTestContext()
  contexts.push(context)
  return context.pool
}

function claimRecords(task: Record<string, unknown>, suffix: string): ClaimRecordPair {
  const attempt = structuredClone(DOMAIN_CONTRACT_SAMPLES['assignment-attempt.v1']) as Record<
    string,
    unknown
  >
  attempt.id = `attempt_${suffix}`
  attempt.state = { status: 'claimed', leaseExpiresAt }
  const leasedTask = structuredClone(task)
  leasedTask.revision = (task.revision as number) + 1
  leasedTask.state = {
    status: 'leased',
    attemptId: attempt.id,
    fence: 1,
    leaseExpiresAt
  }
  return { attempt, leasedTask }
}

function runningRecords(records: ClaimRecordPair) {
  const attempt = structuredClone(records.attempt)
  attempt.state = { status: 'running', leaseExpiresAt }
  const task = structuredClone(records.leasedTask)
  task.revision = (records.leasedTask.revision as number) + 1
  task.state = {
    status: 'running',
    attemptId: records.attempt.id,
    fence: 1,
    leaseExpiresAt
  }
  return { attempt, task }
}

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(async (context) => context.close()))
})

describe.sequential('PostgreSQL task attempt authority', () => {
  it('admits one concurrent claim and rejects stale output from its rival', async () => {
    const pool = await kernelPool()
    const fixture = await seedRunnableTaskFixture(pool)
    const candidates = [
      claimRecords(fixture.task, 'claim_a'),
      claimRecords(fixture.task, 'claim_b')
    ]
    const results = await Promise.allSettled(
      candidates.map(async (candidate) =>
        claimTaskAttempt(pool, {
          taskId: 'task_s1',
          attempt: candidate.attempt,
          leasedTask: candidate.leasedTask
        })
      )
    )
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: expect.any(TaskClaimConflictError)
    })

    const winner = results.find((result) => result.status === 'fulfilled')!
    const winnerId = winner.value.attemptId
    const winnerRecords = candidates.find((candidate) => candidate.attempt.id === winnerId)!
    const loserRecords = candidates.find((candidate) => candidate.attempt.id !== winnerId)!
    const stale = runningRecords(loserRecords)
    await expect(
      advanceAuthoritativeAttempt(pool, {
        taskId: 'task_s1',
        attemptId: loserRecords.attempt.id as string,
        fence: 1,
        observedAt: '2026-01-01T00:00:30.000Z',
        nextAttempt: stale.attempt,
        nextTask: stale.task
      })
    ).rejects.toBeInstanceOf(StaleAttemptAuthorityError)

    const running = runningRecords(winnerRecords)
    await expect(
      advanceAuthoritativeAttempt(pool, {
        taskId: 'task_s1',
        attemptId: winnerId,
        fence: 1,
        observedAt: '2026-01-01T00:00:30.000Z',
        nextAttempt: running.attempt,
        nextTask: running.task
      })
    ).resolves.toBeUndefined()

    const state = await pool.query<{
      task_state: string
      current_attempt_id: string
      current_fence: string
      attempts: string
    }>(
      `SELECT task_state, current_attempt_id, current_fence::text AS current_fence,
              (SELECT count(*)::text FROM control_plane.assignment_attempts) AS attempts
       FROM control_plane.task_executions
       WHERE task_id = 'task_s1'`
    )
    expect(state.rows[0]).toEqual({
      task_state: 'running',
      current_attempt_id: winnerId,
      current_fence: '1',
      attempts: '1'
    })
  })

  it('rejects output observed after the authoritative lease expires', async () => {
    const pool = await kernelPool()
    const fixture = await seedRunnableTaskFixture(pool)
    const records = claimRecords(fixture.task, 'expired')
    await claimTaskAttempt(pool, {
      taskId: 'task_s1',
      attempt: records.attempt,
      leasedTask: records.leasedTask
    })
    const running = runningRecords(records)
    await expect(
      advanceAuthoritativeAttempt(pool, {
        taskId: 'task_s1',
        attemptId: 'attempt_expired',
        fence: 1,
        observedAt: '2026-01-01T00:01:00.000Z',
        nextAttempt: running.attempt,
        nextTask: running.task
      })
    ).rejects.toBeInstanceOf(StaleAttemptAuthorityError)

    const state = await pool.query<{ task_state: string }>(
      "SELECT task_state FROM control_plane.task_executions WHERE task_id = 'task_s1'"
    )
    expect(state.rows[0]?.task_state).toBe('leased')
  })
})
