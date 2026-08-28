import type { Pool } from 'pg'
import { afterEach, describe, expect, it } from 'vitest'
import { canonicalJson, sha256Text } from '../src/canonical-json.js'
import {
  prepareEffectExecution,
  transitionEffectExecution
} from '../src/database/postgres-effect-state-machine.js'
import { StaleEffectFenceError } from '../src/effect-state-transition.js'
import { DOMAIN_CONTRACT_SAMPLES } from './domain-contract-samples.js'
import {
  createPostgresKernelTestContext,
  type PostgresKernelTestContext
} from './postgres-kernel-test-context.js'
import { seedRunnableTaskFixture } from './postgres-task-test-fixture.js'

const contexts: PostgresKernelTestContext[] = []
const createdAt = '2026-01-01T00:00:00.000Z'
const laterAt = '2026-01-01T00:01:00.000Z'

type PreparedEffect = {
  intent: Record<string, unknown>
  attempt: Record<string, unknown>
}

async function kernelPool(): Promise<Pool> {
  const context = await createPostgresKernelTestContext()
  contexts.push(context)
  return context.pool
}

function preparedEffect(suffix: string): PreparedEffect {
  const intent = structuredClone(DOMAIN_CONTRACT_SAMPLES['effect-intent.v1']) as Record<
    string,
    unknown
  >
  const attempt = structuredClone(DOMAIN_CONTRACT_SAMPLES['effect-attempt.v1']) as Record<
    string,
    unknown
  >
  const parameters = { entity: `legacy_${suffix}` }
  const parameterDigest = sha256Text(canonicalJson(parameters))
  intent.id = `effect_${suffix}`
  intent.parameters = parameters
  intent.parameterDigest = parameterDigest
  intent.idempotency = {
    kind: 'provider-key',
    key: `effect-key-${suffix}`,
    retentionExpiresAt: laterAt,
    parameterDigest
  }
  attempt.id = `effect_attempt_${suffix}`
  attempt.effectId = intent.id
  attempt.state = { status: 'prepared' }
  return { intent, attempt }
}

function nextAttempt(
  current: Record<string, unknown>,
  state: Record<string, unknown>
): Record<string, unknown> {
  const next = structuredClone(current)
  next.state = state
  return next
}

function receipt(
  effect: PreparedEffect,
  status: 'applied' | 'absent' | 'failed' | 'unknown',
  suffix: string
): Record<string, unknown> {
  const value = structuredClone(DOMAIN_CONTRACT_SAMPLES['effect-receipt.v1']) as Record<
    string,
    unknown
  >
  value.id = `receipt_${suffix}`
  value.effectId = effect.intent.id
  value.attemptId = effect.attempt.id
  value.status = status
  if (status !== 'applied') {
    value.afterEvidence = null
  }
  return value
}

function observation(effect: PreparedEffect, suffix: string): Record<string, unknown> {
  const value = structuredClone(DOMAIN_CONTRACT_SAMPLES['target-observation.v1']) as Record<
    string,
    unknown
  >
  value.id = `target_observation_${suffix}`
  value.effectId = effect.intent.id
  value.classification = 'ambiguous'
  return value
}

async function prepare(pool: Pool, effect: PreparedEffect): Promise<void> {
  await prepareEffectExecution(pool, {
    taskId: 'task_s1',
    intent: effect.intent,
    attempt: effect.attempt
  })
}

async function transition(
  pool: Pool,
  effect: PreparedEffect,
  current: Record<string, unknown>,
  state: Record<string, unknown>,
  extras: { receipt?: unknown; observation?: unknown } = {}
): Promise<Record<string, unknown>> {
  const next = nextAttempt(current, state)
  await transitionEffectExecution(pool, {
    effectId: effect.intent.id as string,
    effectAttemptId: effect.attempt.id as string,
    fence: 1,
    nextAttempt: next,
    ...extras
  })
  return next
}

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(async (context) => context.close()))
})

describe.sequential('PostgreSQL effect state machine', () => {
  it('guards prepared through independently accepted effect state', async () => {
    const pool = await kernelPool()
    await seedRunnableTaskFixture(pool)
    const effect = preparedEffect('accepted')
    await prepare(pool, effect)
    const issued = await transition(pool, effect, effect.attempt, {
      status: 'issued',
      requestStartedAt: createdAt,
      providerRequestId: 'provider-request-1'
    })
    const appliedReceipt = receipt(effect, 'applied', 'accepted')
    const applied = await transition(
      pool,
      effect,
      issued,
      { status: 'applied', receiptId: appliedReceipt.id, settledAt: laterAt },
      { receipt: appliedReceipt }
    )
    const evaluating = await transition(pool, effect, applied, {
      status: 'evaluating',
      receiptId: appliedReceipt.id,
      evaluationAssignmentIds: ['evaluation_assignment_s1']
    })
    await transition(pool, effect, evaluating, {
      status: 'accepted',
      receiptId: appliedReceipt.id,
      evaluationResultIds: ['evaluation_result_s1'],
      completedAt: laterAt
    })

    const state = await pool.query<{ effect_state: string; receipts: string }>(
      `SELECT effect_state,
              (SELECT count(*)::text FROM control_plane.domain_records
               WHERE schema_name = 'effect-receipt.v1') AS receipts
       FROM control_plane.effect_executions
       WHERE effect_id = 'effect_accepted'`
    )
    expect(state.rows[0]).toEqual({ effect_state: 'accepted', receipts: '1' })
  })

  it('keeps unknown and reconciling explicit before proving absence', async () => {
    const pool = await kernelPool()
    await seedRunnableTaskFixture(pool)
    const effect = preparedEffect('unknown')
    await prepare(pool, effect)
    const issued = await transition(pool, effect, effect.attempt, {
      status: 'issued',
      requestStartedAt: createdAt,
      providerRequestId: null
    })
    const unknown = await transition(pool, effect, issued, {
      status: 'unknown',
      reason: 'Response was lost after request issue.',
      unknownAt: laterAt
    })
    const targetObservation = observation(effect, 'unknown')
    const reconciling = await transition(
      pool,
      effect,
      unknown,
      { status: 'reconciling', observationIds: [targetObservation.id] },
      { observation: targetObservation }
    )
    const absentReceipt = receipt(effect, 'absent', 'unknown')
    await transition(
      pool,
      effect,
      reconciling,
      { status: 'absent', receiptId: absentReceipt.id, settledAt: laterAt },
      { receipt: absentReceipt }
    )

    const state = await pool.query<{ effect_state: string; observations: string }>(
      `SELECT effect_state,
              (SELECT count(*)::text FROM control_plane.domain_records
               WHERE schema_name = 'target-observation.v1') AS observations
       FROM control_plane.effect_executions
       WHERE effect_id = 'effect_unknown'`
    )
    expect(state.rows[0]).toEqual({ effect_state: 'absent', observations: '1' })
  })

  it('rejects skipped acceptance and stale effect fence without changing state', async () => {
    const pool = await kernelPool()
    await seedRunnableTaskFixture(pool)
    const effect = preparedEffect('guarded')
    await prepare(pool, effect)
    const issued = await transition(pool, effect, effect.attempt, {
      status: 'issued',
      requestStartedAt: createdAt,
      providerRequestId: null
    })
    await expect(
      transition(pool, effect, issued, {
        status: 'accepted',
        receiptId: 'receipt_guarded',
        evaluationResultIds: ['evaluation_result_s1'],
        completedAt: laterAt
      })
    ).rejects.toMatchObject({
      code: 'invalid_effect_transition'
    })

    const stale = nextAttempt(issued, {
      status: 'unknown',
      reason: 'Stale worker result.',
      unknownAt: laterAt
    })
    stale.fence = 2
    await expect(
      transitionEffectExecution(pool, {
        effectId: 'effect_guarded',
        effectAttemptId: 'effect_attempt_guarded',
        fence: 2,
        nextAttempt: stale
      })
    ).rejects.toBeInstanceOf(StaleEffectFenceError)

    const state = await pool.query<{ effect_state: string }>(
      "SELECT effect_state FROM control_plane.effect_executions WHERE effect_id = 'effect_guarded'"
    )
    expect(state.rows[0]?.effect_state).toBe('issued')
  })

  it('rejects intent whose parameters do not match its declared digest', async () => {
    const pool = await kernelPool()
    await seedRunnableTaskFixture(pool)
    const effect = preparedEffect('digest')
    effect.intent.parameterDigest = '0'.repeat(64)
    ;(effect.intent.idempotency as Record<string, unknown>).parameterDigest = '0'.repeat(64)
    await expect(prepare(pool, effect)).rejects.toMatchObject({
      code: 'parameter_digest_mismatch'
    })
  })
})
