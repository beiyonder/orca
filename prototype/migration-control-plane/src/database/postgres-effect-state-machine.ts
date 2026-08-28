import type { Pool } from 'pg'
import { canonicalJson, sha256Text } from '../canonical-json.js'
import { EffectAttemptV1Schema, EffectIntentV1Schema } from '../domain/effect-contracts.js'
import {
  EffectStateTransitionError,
  StaleEffectFenceError,
  effectAttemptCompletedAt,
  validateEffectAttemptTransition,
  type EffectStatus
} from '../effect-state-transition.js'
import { insertPostgresDomainRecords } from './postgres-domain-record-store.js'
import { withPostgresTransaction } from './postgres-transaction.js'

type EffectAuthorityRow = {
  effect_state: EffectStatus | 'quarantined'
  current_attempt_id: string
  current_fence: string
  latest_receipt: unknown
  last_observation: unknown
  attempt: unknown
}

export type PrepareEffectInput = {
  taskId: string
  intent: unknown
  attempt: unknown
}

export type EffectTransitionInput = {
  effectId: string
  effectAttemptId: string
  fence: number
  nextAttempt: unknown
  receipt?: unknown
  observation?: unknown
}

function fail(code: string, message: string): never {
  throw new EffectStateTransitionError(code, message)
}

export async function prepareEffectExecution(
  pool: Pool,
  input: PrepareEffectInput
): Promise<{ effectId: string; effectAttemptId: string; fence: number }> {
  const intent = EffectIntentV1Schema.parse(input.intent)
  const attempt = EffectAttemptV1Schema.parse(input.attempt)
  const parameterSha256 = sha256Text(canonicalJson(intent.parameters))
  if (parameterSha256 !== intent.parameterDigest) {
    fail('parameter_digest_mismatch', 'Effect parameters do not match parameterDigest')
  }
  if (
    attempt.state.status !== 'prepared' ||
    attempt.effectId !== intent.id ||
    attempt.adapterName !== intent.adapter.name ||
    attempt.adapterVersion !== intent.adapter.version ||
    attempt.attemptNumber !== 1 ||
    attempt.fence !== 1
  ) {
    fail('effect_attempt_mismatch', 'Prepared effect attempt does not match its intent')
  }

  return withPostgresTransaction(pool, async (client) => {
    const task = await client.query<{ mission_id: string }>(
      `SELECT mission_id FROM control_plane.task_executions
       WHERE tenant_id = $1 AND task_id = $2`,
      [intent.tenantId, input.taskId]
    )
    if (task.rows[0]?.mission_id !== intent.missionId) {
      fail('effect_task_mismatch', 'Effect task does not exist in the same mission')
    }

    await insertPostgresDomainRecords(client, [
      {
        tenantId: intent.tenantId,
        recordId: intent.id,
        missionId: intent.missionId,
        schemaName: 'effect-intent.v1',
        recordKind: 'effect-intent',
        recordState: 'prepared',
        payload: intent,
        createdAt: intent.createdAt
      },
      {
        tenantId: attempt.tenantId,
        recordId: attempt.id,
        missionId: attempt.missionId,
        schemaName: 'effect-attempt.v1',
        recordKind: 'effect-attempt',
        recordState: 'prepared',
        payload: attempt,
        createdAt: attempt.createdAt
      }
    ])

    const intentJson = canonicalJson(intent)
    const attemptJson = canonicalJson(attempt)
    await client.query(
      `WITH execution_insert AS (
         INSERT INTO control_plane.effect_executions (
           tenant_id, mission_id, effect_id, task_id, effect_state, adapter_name,
           target_identity, idempotency_key, intent_sha256, current_attempt_id,
           current_fence, intent, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, 'prepared', $5, $6, $7, $8, $9, $10,
                   $11::jsonb, $12, transaction_timestamp())
         RETURNING tenant_id, mission_id, effect_id
       )
       INSERT INTO control_plane.effect_attempts (
         tenant_id, mission_id, effect_attempt_id, effect_id, attempt_number,
         fence, effect_state, capability_envelope_id, adapter_name, adapter_version,
         request_digest, attempt, attempt_sha256, created_at, updated_at
       )
       SELECT tenant_id, mission_id, $9, effect_id, $13, $10, 'prepared', $14,
              $5, $15, $16, $17::jsonb, $18, $19, transaction_timestamp()
       FROM execution_insert`,
      [
        intent.tenantId,
        intent.missionId,
        intent.id,
        input.taskId,
        intent.adapter.name,
        canonicalJson(intent.target).trim(),
        intent.idempotency.key ?? intent.id,
        sha256Text(intentJson),
        attempt.id,
        attempt.fence,
        intentJson,
        intent.createdAt,
        attempt.attemptNumber,
        attempt.capabilityEnvelopeId,
        attempt.adapterVersion,
        attempt.requestDigest,
        attemptJson,
        sha256Text(attemptJson),
        attempt.createdAt
      ]
    )
    return { effectId: intent.id, effectAttemptId: attempt.id, fence: attempt.fence }
  })
}

export async function transitionEffectExecution(
  pool: Pool,
  input: EffectTransitionInput
): Promise<void> {
  const candidate = EffectAttemptV1Schema.parse(input.nextAttempt)
  if (
    candidate.effectId !== input.effectId ||
    candidate.id !== input.effectAttemptId ||
    candidate.fence !== input.fence
  ) {
    throw new StaleEffectFenceError(input.effectId, input.effectAttemptId, input.fence)
  }

  await withPostgresTransaction(pool, async (client) => {
    const authority = await client.query<EffectAuthorityRow>(
      `SELECT execution.effect_state,
              execution.current_attempt_id,
              execution.current_fence::text AS current_fence,
              execution.latest_receipt,
              execution.last_observation,
              attempt.attempt
       FROM control_plane.effect_executions AS execution
       JOIN control_plane.effect_attempts AS attempt
         ON attempt.tenant_id = execution.tenant_id
         AND attempt.effect_attempt_id = execution.current_attempt_id
       WHERE execution.tenant_id = $1 AND execution.effect_id = $2
       FOR UPDATE OF execution, attempt`,
      [candidate.tenantId, input.effectId]
    )
    const row = authority.rows[0]
    if (
      !row ||
      row.current_attempt_id !== input.effectAttemptId ||
      Number(row.current_fence) !== input.fence ||
      row.effect_state === 'quarantined'
    ) {
      throw new StaleEffectFenceError(input.effectId, input.effectAttemptId, input.fence)
    }

    const validated = validateEffectAttemptTransition({
      current: row.attempt,
      next: candidate,
      receipt: input.receipt,
      observation: input.observation,
      latestReceipt: row.latest_receipt
    })
    const { next, evidence } = validated
    const records = []
    if (evidence.receipt) {
      records.push({
        tenantId: evidence.receipt.tenantId,
        recordId: evidence.receipt.id,
        missionId: evidence.receipt.missionId,
        schemaName: 'effect-receipt.v1',
        recordKind: 'effect-receipt',
        recordState: evidence.receipt.status,
        payload: evidence.receipt,
        createdAt: evidence.receipt.createdAt
      })
    }
    if (evidence.observation) {
      records.push({
        tenantId: evidence.observation.tenantId,
        recordId: evidence.observation.id,
        missionId: evidence.observation.missionId,
        schemaName: 'target-observation.v1',
        recordKind: 'target-observation',
        recordState: evidence.observation.classification,
        payload: evidence.observation,
        createdAt: evidence.observation.createdAt
      })
    }
    await insertPostgresDomainRecords(client, records)

    const attemptJson = canonicalJson(next)
    const attemptSha256 = sha256Text(attemptJson)
    const updates = await client.query<{
      attempt_count: number
      domain_count: number
      execution_count: number
    }>(
      `WITH attempt_update AS (
         UPDATE control_plane.effect_attempts
         SET effect_state = $3, attempt = $4::jsonb, attempt_sha256 = $5,
             completed_at = $6, updated_at = transaction_timestamp()
         WHERE tenant_id = $1 AND effect_attempt_id = $2 AND fence = $7
         RETURNING 1
       ), domain_update AS (
         UPDATE control_plane.domain_records
         SET record_state = $3, payload = $4::jsonb, payload_sha256 = $5,
             updated_at = transaction_timestamp()
         WHERE tenant_id = $1 AND record_id = $2 AND schema_name = 'effect-attempt.v1'
         RETURNING 1
       ), execution_update AS (
         UPDATE control_plane.effect_executions
         SET effect_state = $3,
             latest_receipt = COALESCE($8::jsonb, latest_receipt),
             last_observation = COALESCE($9::jsonb, last_observation),
             terminal_at = $10,
             updated_at = transaction_timestamp()
         WHERE tenant_id = $1 AND effect_id = $11
           AND current_attempt_id = $2 AND current_fence = $7
         RETURNING 1
       )
       SELECT (SELECT count(*)::int FROM attempt_update) AS attempt_count,
              (SELECT count(*)::int FROM domain_update) AS domain_count,
              (SELECT count(*)::int FROM execution_update) AS execution_count`,
      [
        next.tenantId,
        next.id,
        next.state.status,
        attemptJson,
        attemptSha256,
        effectAttemptCompletedAt(next),
        next.fence,
        evidence.receipt ? canonicalJson(evidence.receipt) : null,
        evidence.observation ? canonicalJson(evidence.observation) : null,
        next.state.status === 'accepted' || next.state.status === 'rejected'
          ? next.state.completedAt
          : null,
        next.effectId
      ]
    )
    const counts = updates.rows[0]
    if (
      !counts ||
      counts.attempt_count !== 1 ||
      counts.domain_count !== 1 ||
      counts.execution_count !== 1
    ) {
      throw new StaleEffectFenceError(input.effectId, input.effectAttemptId, input.fence)
    }
  })
}
