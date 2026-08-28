import type { Pool } from 'pg'
import { canonicalJson, sha256Text } from '../canonical-json.js'
import {
  AssignmentAttemptV1Schema,
  TaskRecordV1Schema,
  type TaskRecordV1
} from '../domain/assignment-contracts.js'
import { MAX_SAFE_REVISION } from '../domain/common-contracts.js'
import {
  StaleAttemptAuthorityError,
  TaskClaimConflictError,
  type ClaimedTaskAttempt,
  type TaskAttemptClaimInput
} from '../attempt-authority.js'
import { validateTaskTransition } from '../task-attempt-lifecycle.js'
import { withPostgresTransaction } from './postgres-transaction.js'

type TaskClaimRow = {
  task: unknown
  task_state: TaskRecordV1['state']['status']
  current_attempt_id: string | null
  current_fence: string
}

export async function claimTaskAttempt(
  pool: Pool,
  input: TaskAttemptClaimInput
): Promise<ClaimedTaskAttempt> {
  const attempt = AssignmentAttemptV1Schema.parse(input.attempt)
  const leasedTask = TaskRecordV1Schema.parse(input.leasedTask)
  const attemptState = attempt.state
  const leasedTaskState = leasedTask.state
  if (attemptState.status !== 'claimed' || leasedTaskState.status !== 'leased') {
    throw new TypeError('Task claim requires claimed attempt and leased task records')
  }
  if (
    leasedTask.id !== input.taskId ||
    attempt.tenantId !== leasedTask.tenantId ||
    attempt.missionId !== leasedTask.missionId ||
    leasedTaskState.attemptId !== attempt.id ||
    leasedTaskState.fence !== attempt.fence ||
    leasedTaskState.leaseExpiresAt !== attemptState.leaseExpiresAt
  ) {
    throw new TypeError('Claimed attempt and leased task authority do not match')
  }

  return withPostgresTransaction(pool, async (client) => {
    const taskResult = await client.query<TaskClaimRow>(
      `SELECT task, task_state, current_attempt_id, current_fence::text AS current_fence
       FROM control_plane.task_executions
       WHERE tenant_id = $1 AND task_id = $2
       FOR UPDATE`,
      [leasedTask.tenantId, leasedTask.id]
    )
    const row = taskResult.rows[0]
    if (!row || row.task_state !== 'runnable' || row.current_attempt_id !== null) {
      throw new TaskClaimConflictError(leasedTask.id)
    }
    const currentTask = TaskRecordV1Schema.parse(row.task)
    const currentFence = Number(row.current_fence)
    if (currentFence === MAX_SAFE_REVISION || attempt.fence !== currentFence + 1) {
      throw new StaleAttemptAuthorityError(leasedTask.id, attempt.id, attempt.fence)
    }
    validateTaskTransition({ current: currentTask, next: leasedTask })

    const assignment = await client.query<{ task_id: string }>(
      `SELECT payload ->> 'taskId' AS task_id
       FROM control_plane.domain_records
       WHERE tenant_id = $1 AND record_id = $2 AND schema_name = 'assignment-record.v1'`,
      [attempt.tenantId, attempt.assignmentId]
    )
    if (assignment.rows[0]?.task_id !== leasedTask.id) {
      throw new TypeError('Attempt assignment does not belong to the claimed task')
    }
    const previous = await client.query<{ attempt_number: number | null }>(
      `SELECT max(attempt_number) AS attempt_number
       FROM control_plane.assignment_attempts
       WHERE tenant_id = $1 AND task_id = $2`,
      [attempt.tenantId, leasedTask.id]
    )
    const expectedAttemptNumber = (previous.rows[0]?.attempt_number ?? 0) + 1
    if (attempt.attemptNumber !== expectedAttemptNumber) {
      throw new TypeError(`Attempt number must be ${expectedAttemptNumber}`)
    }

    const attemptJson = canonicalJson(attempt)
    const attemptSha256 = sha256Text(attemptJson)
    const taskJson = canonicalJson(leasedTask)
    const taskSha256 = sha256Text(taskJson)
    await client.query(
      `INSERT INTO control_plane.domain_records (
         tenant_id, record_id, mission_id, schema_name, schema_version, record_kind,
         aggregate_revision, record_state, payload, payload_sha256, created_at, updated_at
       ) VALUES ($1, $2, $3, 'assignment-attempt.v1', 1, 'assignment-attempt',
                 $4, 'claimed', $5::jsonb, $6, $7, transaction_timestamp())`,
      [
        attempt.tenantId,
        attempt.id,
        attempt.missionId,
        attempt.attemptNumber,
        attemptJson,
        attemptSha256,
        attempt.createdAt
      ]
    )
    await client.query(
      `INSERT INTO control_plane.assignment_attempts (
         tenant_id, mission_id, attempt_id, assignment_id, task_id, attempt_number,
         fence, attempt_state, lease_owner, lease_expires_at, worker_incarnation,
         context_manifest_id, attempt, attempt_sha256, started_at, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'claimed', $8, $9, $8,
                 $10, $11::jsonb, $12, $13, $14, transaction_timestamp())`,
      [
        attempt.tenantId,
        attempt.missionId,
        attempt.id,
        attempt.assignmentId,
        leasedTask.id,
        attempt.attemptNumber,
        attempt.fence,
        attempt.worker.processIncarnation,
        attemptState.leaseExpiresAt,
        attempt.contextManifestId,
        attemptJson,
        attemptSha256,
        attempt.startedAt,
        attempt.createdAt
      ]
    )
    const updates = await client.query<{ task_count: number; domain_count: number }>(
      `WITH task_update AS (
         UPDATE control_plane.task_executions
         SET task_state = 'leased', current_attempt_id = $3, current_fence = $4,
             task = $5::jsonb, task_sha256 = $6, updated_at = transaction_timestamp()
         WHERE tenant_id = $1 AND task_id = $2 AND task_state = 'runnable'
         RETURNING 1
       ), domain_update AS (
         UPDATE control_plane.domain_records
         SET aggregate_revision = $7, record_state = 'leased', payload = $5::jsonb,
             payload_sha256 = $6, updated_at = transaction_timestamp()
         WHERE tenant_id = $1 AND record_id = $2 AND schema_name = 'task-record.v1'
         RETURNING 1
       )
       SELECT (SELECT count(*)::int FROM task_update) AS task_count,
              (SELECT count(*)::int FROM domain_update) AS domain_count`,
      [
        leasedTask.tenantId,
        leasedTask.id,
        attempt.id,
        attempt.fence,
        taskJson,
        taskSha256,
        leasedTask.revision
      ]
    )
    const counts = updates.rows[0]
    if (!counts || counts.task_count !== 1 || counts.domain_count !== 1) {
      throw new TaskClaimConflictError(leasedTask.id)
    }
    return {
      taskId: leasedTask.id,
      attemptId: attempt.id,
      fence: attempt.fence,
      leaseExpiresAt: attemptState.leaseExpiresAt
    }
  })
}
