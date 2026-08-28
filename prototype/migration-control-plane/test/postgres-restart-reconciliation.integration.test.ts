import type { Pool } from 'pg'
import { afterEach, describe, expect, it } from 'vitest'
import { canonicalJson, sha256Text } from '../src/canonical-json.js'
import {
  prepareEffectExecution,
  transitionEffectExecution
} from '../src/database/postgres-effect-state-machine.js'
import { reconcileKernelRestart } from '../src/database/postgres-restart-reconciliation.js'
import { claimTaskAttempt } from '../src/database/postgres-task-attempt-claim.js'
import { DOMAIN_CONTRACT_SAMPLES } from './domain-contract-samples.js'
import {
  createPostgresKernelTestContext,
  type PostgresKernelTestContext
} from './postgres-kernel-test-context.js'
import { seedRunnableTaskFixture } from './postgres-task-test-fixture.js'

const contexts: PostgresKernelTestContext[] = []
const createdAt = '2026-01-01T00:00:00.000Z'
const leaseExpiresAt = '2026-01-01T00:01:00.000Z'

async function kernelPool(): Promise<Pool> {
  const context = await createPostgresKernelTestContext()
  contexts.push(context)
  return context.pool
}

async function seedExpiredAttempt(pool: Pool, task: Record<string, unknown>): Promise<void> {
  const attempt = structuredClone(DOMAIN_CONTRACT_SAMPLES['assignment-attempt.v1']) as Record<
    string,
    unknown
  >
  attempt.id = 'attempt_restart'
  attempt.state = { status: 'claimed', leaseExpiresAt }
  const leasedTask = structuredClone(task)
  leasedTask.revision = (task.revision as number) + 1
  leasedTask.state = {
    status: 'leased',
    attemptId: attempt.id,
    fence: 1,
    leaseExpiresAt
  }
  await claimTaskAttempt(pool, { taskId: 'task_s1', attempt, leasedTask })
}

async function seedUnknownEffect(pool: Pool): Promise<void> {
  const intent = structuredClone(DOMAIN_CONTRACT_SAMPLES['effect-intent.v1']) as Record<
    string,
    unknown
  >
  const attempt = structuredClone(DOMAIN_CONTRACT_SAMPLES['effect-attempt.v1']) as Record<
    string,
    unknown
  >
  const parameters = { entity: 'legacy_restart' }
  const parameterDigest = sha256Text(canonicalJson(parameters))
  intent.id = 'effect_restart'
  intent.parameters = parameters
  intent.parameterDigest = parameterDigest
  intent.idempotency = {
    kind: 'provider-key',
    key: 'effect-key-restart',
    retentionExpiresAt: leaseExpiresAt,
    parameterDigest
  }
  attempt.id = 'effect_attempt_restart'
  attempt.effectId = intent.id
  attempt.state = { status: 'prepared' }
  await prepareEffectExecution(pool, { taskId: 'task_s1', intent, attempt })

  const issued = structuredClone(attempt)
  issued.state = { status: 'issued', requestStartedAt: createdAt, providerRequestId: null }
  await transitionEffectExecution(pool, {
    effectId: 'effect_restart',
    effectAttemptId: 'effect_attempt_restart',
    fence: 1,
    nextAttempt: issued
  })
  const unknown = structuredClone(issued)
  unknown.state = {
    status: 'unknown',
    reason: 'Request outcome was lost during restart.',
    unknownAt: leaseExpiresAt
  }
  await transitionEffectExecution(pool, {
    effectId: 'effect_restart',
    effectAttemptId: 'effect_attempt_restart',
    fence: 1,
    nextAttempt: unknown
  })
}

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(async (context) => context.close()))
})

describe.sequential('PostgreSQL restart reconciliation', () => {
  it('assigns one deterministic disposition to every nonterminal durable subject', async () => {
    const pool = await kernelPool()
    const fixture = await seedRunnableTaskFixture(pool)
    await seedExpiredAttempt(pool, fixture.task)
    await seedUnknownEffect(pool)

    const first = await reconcileKernelRestart(pool, { now: '2026-01-01T00:02:00.000Z' })
    const second = await reconcileKernelRestart(pool, { now: '2026-01-01T00:02:00.000Z' })
    expect(second).toEqual(first)
    expect(
      first.map((item) => ({
        subject: `${item.subjectKind}:${item.subjectId}`,
        state: item.observedState,
        disposition: item.disposition
      }))
    ).toEqual([
      { subject: 'attempt:attempt_restart', state: 'claimed', disposition: 'retry' },
      { subject: 'effect:effect_restart', state: 'unknown', disposition: 'reconcile' },
      {
        subject: 'outbox:message_mission_created',
        state: 'undelivered',
        disposition: 'retry'
      },
      { subject: 'task:task_s1', state: 'leased', disposition: 'retry' }
    ])

    const work = await pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM control_plane.recovery_work'
    )
    expect(work.rows[0]?.count).toBe('4')
  })

  it('defers active leases instead of declaring worker loss', async () => {
    const pool = await kernelPool()
    const fixture = await seedRunnableTaskFixture(pool)
    const attempt = structuredClone(DOMAIN_CONTRACT_SAMPLES['assignment-attempt.v1']) as Record<
      string,
      unknown
    >
    attempt.id = 'attempt_active_restart'
    attempt.state = { status: 'claimed', leaseExpiresAt: '2026-01-01T00:10:00.000Z' }
    const leasedTask = structuredClone(fixture.task)
    leasedTask.revision = (fixture.task.revision as number) + 1
    leasedTask.state = {
      status: 'leased',
      attemptId: attempt.id,
      fence: 1,
      leaseExpiresAt: '2026-01-01T00:10:00.000Z'
    }
    await claimTaskAttempt(pool, { taskId: 'task_s1', attempt, leasedTask })

    const dispositions = await reconcileKernelRestart(pool, {
      now: '2026-01-01T00:02:00.000Z'
    })
    const attemptDisposition = dispositions.find((item) => item.subjectKind === 'attempt')
    const taskDisposition = dispositions.find((item) => item.subjectKind === 'task')
    expect(attemptDisposition).toMatchObject({
      disposition: 'no-action',
      dueAt: '2026-01-01T00:10:00.000Z'
    })
    expect(taskDisposition).toMatchObject({
      disposition: 'no-action',
      dueAt: '2026-01-01T00:10:00.000Z'
    })
  })
})
