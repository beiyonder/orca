import type { Pool } from 'pg'
import { canonicalJson } from '../canonical-json.js'
import {
  AssignmentAttemptV1Schema,
  TaskRecordV1Schema,
  type TaskRecordV1
} from '../domain/assignment-contracts.js'
import { IsoDateTimeSchema } from '../domain/common-contracts.js'
import { withPostgresTransaction } from './postgres-transaction.js'

type TaskRecoveryPolicy = TaskRecordV1['recoveryPolicy']

type RecoveryDisposition = 'resume' | 'retry' | 'reconcile' | 'fail' | 'quarantine' | 'no-action'
type RecoverySubjectKind = 'task' | 'attempt' | 'effect' | 'outbox'

type RecoverySourceRow = {
  tenant_id: string
  mission_id: string
  subject_kind: RecoverySubjectKind
  subject_id: string
  observed_state: string
  payload: unknown
  lease_expires_at: Date | null
  available_at: Date | null
}

export type RestartReconciliationInput = {
  now: string
}

export type RestartRecoveryDisposition = {
  tenantId: string
  missionId: string
  subjectKind: RecoverySubjectKind
  subjectId: string
  observedState: string
  disposition: RecoveryDisposition
  reason: string
  dueAt: string
}

function workerLossDisposition(policy: TaskRecoveryPolicy): RecoveryDisposition {
  switch (policy.onWorkerLoss) {
    case 'retry':
    case 'reconstruct':
      return 'retry'
    case 'quarantine':
      return 'quarantine'
    case 'fail':
      return 'fail'
  }
}

function dueAt(nowMs: number, source: RecoverySourceRow): string {
  const candidates = [
    nowMs,
    source.lease_expires_at?.getTime() ?? nowMs,
    source.available_at?.getTime() ?? nowMs
  ]
  return new Date(Math.max(...candidates)).toISOString()
}

function taskDisposition(source: RecoverySourceRow, nowMs: number): RestartRecoveryDisposition {
  const task = TaskRecordV1Schema.parse(source.payload)
  let disposition: RecoveryDisposition
  let reason: string
  if (task.state.status === 'pending' || task.state.status === 'runnable') {
    disposition = 'resume'
    reason = 'Re-evaluate task dependencies and runnable status.'
  } else if (task.state.status === 'blocked') {
    disposition = 'no-action'
    reason = 'Task remains blocked until its recorded gaps resolve.'
  } else if (source.lease_expires_at && source.lease_expires_at.getTime() > nowMs) {
    disposition = 'no-action'
    reason = 'Current attempt lease remains active.'
  } else {
    disposition = workerLossDisposition(task.recoveryPolicy)
    reason = `Active task lost its lease; apply ${task.recoveryPolicy.onWorkerLoss}.`
  }
  return {
    tenantId: source.tenant_id,
    missionId: source.mission_id,
    subjectKind: 'task',
    subjectId: source.subject_id,
    observedState: source.observed_state,
    disposition,
    reason,
    dueAt: dueAt(nowMs, source)
  }
}

function attemptDisposition(source: RecoverySourceRow, nowMs: number): RestartRecoveryDisposition {
  if (
    typeof source.payload !== 'object' ||
    source.payload === null ||
    Array.isArray(source.payload)
  ) {
    throw new TypeError(`Attempt recovery payload is invalid: ${source.subject_id}`)
  }
  const payload = source.payload as Record<string, unknown>
  const attempt = AssignmentAttemptV1Schema.parse(payload.attempt)
  const task = TaskRecordV1Schema.parse(payload.task)
  let disposition: RecoveryDisposition
  let reason: string
  if (attempt.state.status === 'result-submitted' || attempt.state.status === 'evaluating') {
    disposition = 'resume'
    reason = 'Resume evaluation from the recorded assignment result.'
  } else if (source.lease_expires_at && source.lease_expires_at.getTime() > nowMs) {
    disposition = 'no-action'
    reason = 'Attempt lease remains active.'
  } else {
    disposition = workerLossDisposition(task.recoveryPolicy)
    reason = `Attempt lease expired; apply ${task.recoveryPolicy.onWorkerLoss}.`
  }
  return {
    tenantId: source.tenant_id,
    missionId: source.mission_id,
    subjectKind: 'attempt',
    subjectId: source.subject_id,
    observedState: source.observed_state,
    disposition,
    reason,
    dueAt: dueAt(nowMs, source)
  }
}

function directDisposition(
  source: RecoverySourceRow,
  nowMs: number,
  disposition: RecoveryDisposition,
  reason: string
): RestartRecoveryDisposition {
  return {
    tenantId: source.tenant_id,
    missionId: source.mission_id,
    subjectKind: source.subject_kind,
    subjectId: source.subject_id,
    observedState: source.observed_state,
    disposition,
    reason,
    dueAt: dueAt(nowMs, source)
  }
}

function reconcileSource(source: RecoverySourceRow, nowMs: number): RestartRecoveryDisposition {
  if (source.subject_kind === 'task') {
    return taskDisposition(source, nowMs)
  }
  if (source.subject_kind === 'attempt') {
    return attemptDisposition(source, nowMs)
  }
  if (source.subject_kind === 'outbox') {
    return directDisposition(
      source,
      nowMs,
      'retry',
      'Retry undelivered outbox message at due time.'
    )
  }
  if (
    source.observed_state === 'issued' ||
    source.observed_state === 'unknown' ||
    source.observed_state === 'reconciling'
  ) {
    return directDisposition(
      source,
      nowMs,
      'reconcile',
      'Read target state before deciding whether any effect retry is safe.'
    )
  }
  return directDisposition(source, nowMs, 'resume', 'Resume the recorded nonterminal effect state.')
}

const RECOVERY_SOURCES_SQL = `
SELECT task.tenant_id,
       task.mission_id,
       'task'::text AS subject_kind,
       task.task_id AS subject_id,
       task.task_state AS observed_state,
       task.task AS payload,
       attempt.lease_expires_at,
       NULL::timestamptz AS available_at
FROM control_plane.task_executions AS task
LEFT JOIN control_plane.assignment_attempts AS attempt
  ON attempt.tenant_id = task.tenant_id
  AND attempt.attempt_id = task.current_attempt_id
WHERE task.task_state IN ('pending', 'runnable', 'leased', 'running', 'evaluating', 'blocked')

UNION ALL

SELECT attempt.tenant_id,
       attempt.mission_id,
       'attempt'::text,
       attempt.attempt_id,
       attempt.attempt_state,
       jsonb_build_object('attempt', attempt.attempt, 'task', task.task),
       attempt.lease_expires_at,
       NULL::timestamptz
FROM control_plane.assignment_attempts AS attempt
JOIN control_plane.task_executions AS task
  ON task.tenant_id = attempt.tenant_id AND task.task_id = attempt.task_id
WHERE attempt.attempt_state IN ('claimed', 'running', 'result-submitted', 'evaluating')

UNION ALL

SELECT effect.tenant_id,
       effect.mission_id,
       'effect'::text,
       effect.effect_id,
       effect.effect_state,
       effect.intent,
       NULL::timestamptz,
       NULL::timestamptz
FROM control_plane.effect_executions AS effect
WHERE effect.effect_state IN ('prepared', 'issued', 'applied', 'unknown', 'reconciling', 'evaluating')

UNION ALL

SELECT message.tenant_id,
       message.mission_id,
       'outbox'::text,
       message.message_id,
       'undelivered'::text,
       message.payload,
       message.lease_expires_at,
       message.available_at
FROM control_plane.outbox_messages AS message
WHERE message.delivered_at IS NULL
ORDER BY subject_kind, subject_id
`

export async function reconcileKernelRestart(
  pool: Pool,
  input: RestartReconciliationInput
): Promise<RestartRecoveryDisposition[]> {
  const now = IsoDateTimeSchema.parse(input.now)
  const nowMs = Date.parse(now)
  return withPostgresTransaction(pool, async (client) => {
    const sources = await client.query<RecoverySourceRow>(RECOVERY_SOURCES_SQL)
    const dispositions = sources.rows.map((source) => reconcileSource(source, nowMs))
    if (dispositions.length === 0) {
      return []
    }
    const rows = dispositions.map((disposition) => ({
      tenant_id: disposition.tenantId,
      mission_id: disposition.missionId,
      subject_kind: disposition.subjectKind,
      subject_id: disposition.subjectId,
      observed_state: disposition.observedState,
      disposition: disposition.disposition,
      disposition_reason: disposition.reason,
      due_at: disposition.dueAt,
      now
    }))
    await client.query(
      `INSERT INTO control_plane.recovery_work (
         tenant_id, mission_id, subject_kind, subject_id, observed_state,
         disposition, disposition_reason, due_at, created_at, updated_at
       )
       SELECT tenant_id, mission_id, subject_kind, subject_id, observed_state,
              disposition, disposition_reason, due_at, now, now
       FROM jsonb_to_recordset($1::jsonb) AS recovery(
         tenant_id text,
         mission_id text,
         subject_kind text,
         subject_id text,
         observed_state text,
         disposition text,
         disposition_reason text,
         due_at timestamptz,
         now timestamptz
       )
       ON CONFLICT (tenant_id, subject_kind, subject_id) DO UPDATE
       SET mission_id = EXCLUDED.mission_id,
           observed_state = EXCLUDED.observed_state,
           disposition = EXCLUDED.disposition,
           disposition_reason = EXCLUDED.disposition_reason,
           due_at = EXCLUDED.due_at,
           claimed_by = NULL,
           claim_expires_at = NULL,
           completed_at = NULL,
           updated_at = EXCLUDED.updated_at`,
      [canonicalJson(rows)]
    )
    return dispositions
  })
}
