import type { Pool } from 'pg'
import { canonicalJson, sha256Text } from '../canonical-json.js'
import { StaleAttemptAuthorityError, type AttemptAdvanceInput } from '../attempt-authority.js'
import { AssignmentAttemptV1Schema, TaskRecordV1Schema } from '../domain/assignment-contracts.js'
import { IsoDateTimeSchema } from '../domain/common-contracts.js'
import {
  assertAttemptTaskStatePair,
  attemptCompletedAt,
  taskCompletedAt,
  validateAttemptTransition,
  validateTaskTransition
} from '../task-attempt-lifecycle.js'
import { withPostgresTransaction } from './postgres-transaction.js'

type AttemptAuthorityRow = {
  task: unknown
  current_attempt_id: string
  current_fence: string
  attempt: unknown
  fence: string
  lease_expires_at: Date
}

export async function advanceAuthoritativeAttempt(
  pool: Pool,
  input: AttemptAdvanceInput
): Promise<void> {
  const nextAttempt = AssignmentAttemptV1Schema.parse(input.nextAttempt)
  const nextTask = TaskRecordV1Schema.parse(input.nextTask)
  const observedAt = IsoDateTimeSchema.parse(input.observedAt)
  if (
    nextAttempt.id !== input.attemptId ||
    nextAttempt.fence !== input.fence ||
    nextTask.id !== input.taskId
  ) {
    throw new StaleAttemptAuthorityError(input.taskId, input.attemptId, input.fence)
  }
  assertAttemptTaskStatePair(nextAttempt, nextTask)

  await withPostgresTransaction(pool, async (client) => {
    const authority = await client.query<AttemptAuthorityRow>(
      `SELECT task.task,
              task.current_attempt_id,
              task.current_fence::text AS current_fence,
              attempt.attempt,
              attempt.fence::text AS fence,
              attempt.lease_expires_at
       FROM control_plane.task_executions AS task
       JOIN control_plane.assignment_attempts AS attempt
         ON attempt.tenant_id = task.tenant_id
         AND attempt.attempt_id = task.current_attempt_id
       WHERE task.tenant_id = $1 AND task.task_id = $2
       FOR UPDATE OF task, attempt`,
      [nextTask.tenantId, input.taskId]
    )
    const row = authority.rows[0]
    if (
      !row ||
      row.current_attempt_id !== input.attemptId ||
      Number(row.current_fence) !== input.fence ||
      Number(row.fence) !== input.fence ||
      row.lease_expires_at.getTime() <= Date.parse(observedAt)
    ) {
      throw new StaleAttemptAuthorityError(input.taskId, input.attemptId, input.fence)
    }

    const currentTask = TaskRecordV1Schema.parse(row.task)
    const currentAttempt = AssignmentAttemptV1Schema.parse(row.attempt)
    validateAttemptTransition({ current: currentAttempt, next: nextAttempt, fence: input.fence })
    validateTaskTransition({
      current: currentTask,
      next: nextTask,
      authority: { attemptId: input.attemptId, fence: input.fence }
    })

    const attemptJson = canonicalJson(nextAttempt)
    const attemptSha256 = sha256Text(attemptJson)
    const taskJson = canonicalJson(nextTask)
    const taskSha256 = sha256Text(taskJson)
    const nextLeaseExpiresAt =
      nextAttempt.state.status === 'claimed' || nextAttempt.state.status === 'running'
        ? nextAttempt.state.leaseExpiresAt
        : row.lease_expires_at.toISOString()
    const updates = await client.query<{
      attempt_count: number
      attempt_domain_count: number
      task_count: number
      task_domain_count: number
    }>(
      `WITH attempt_update AS (
         UPDATE control_plane.assignment_attempts
         SET attempt_state = $4, lease_expires_at = $5, attempt = $6::jsonb,
             attempt_sha256 = $7, completed_at = $8, updated_at = transaction_timestamp()
         WHERE tenant_id = $1 AND task_id = $2 AND attempt_id = $3 AND fence = $9
         RETURNING 1
       ), attempt_domain_update AS (
         UPDATE control_plane.domain_records
         SET record_state = $4, payload = $6::jsonb, payload_sha256 = $7,
             updated_at = transaction_timestamp()
         WHERE tenant_id = $1 AND record_id = $3 AND schema_name = 'assignment-attempt.v1'
         RETURNING 1
       ), task_update AS (
         UPDATE control_plane.task_executions
         SET task_state = $10, task = $11::jsonb, task_sha256 = $12,
             completed_at = $13, updated_at = transaction_timestamp()
         WHERE tenant_id = $1 AND task_id = $2
           AND current_attempt_id = $3 AND current_fence = $9
         RETURNING 1
       ), task_domain_update AS (
         UPDATE control_plane.domain_records
         SET aggregate_revision = $14, record_state = $10, payload = $11::jsonb,
             payload_sha256 = $12, updated_at = transaction_timestamp()
         WHERE tenant_id = $1 AND record_id = $2 AND schema_name = 'task-record.v1'
         RETURNING 1
       )
       SELECT (SELECT count(*)::int FROM attempt_update) AS attempt_count,
              (SELECT count(*)::int FROM attempt_domain_update) AS attempt_domain_count,
              (SELECT count(*)::int FROM task_update) AS task_count,
              (SELECT count(*)::int FROM task_domain_update) AS task_domain_count`,
      [
        nextAttempt.tenantId,
        nextTask.id,
        nextAttempt.id,
        nextAttempt.state.status,
        nextLeaseExpiresAt,
        attemptJson,
        attemptSha256,
        attemptCompletedAt(nextAttempt),
        nextAttempt.fence,
        nextTask.state.status,
        taskJson,
        taskSha256,
        taskCompletedAt(nextTask),
        nextTask.revision
      ]
    )
    const counts = updates.rows[0]
    if (
      !counts ||
      counts.attempt_count !== 1 ||
      counts.attempt_domain_count !== 1 ||
      counts.task_count !== 1 ||
      counts.task_domain_count !== 1
    ) {
      throw new StaleAttemptAuthorityError(input.taskId, input.attemptId, input.fence)
    }
  })
}
