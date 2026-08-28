import type { Pool, PoolClient } from 'pg'
import { canonicalJson, sha256Text } from './canonical-json.js'
import { StaleAttemptAuthorityError } from './attempt-authority.js'
import {
  AssignmentAttemptV1Schema,
  TaskRecordV1Schema,
  type AssignmentAttemptV1,
  type TaskRecordV1
} from './domain/assignment-contracts.js'
import type { DurableConvergenceFixture } from './durable-convergence-types.js'
import { advanceAuthoritativeAttempt } from './database/postgres-attempt-advancement.js'
import { insertPostgresDomainRecords } from './database/postgres-domain-record-store.js'
import { claimTaskAttempt } from './database/postgres-task-attempt-claim.js'
import { withPostgresTransaction } from './database/postgres-transaction.js'

export async function seedDurablePlanAndTask(
  client: PoolClient,
  fixture: DurableConvergenceFixture
): Promise<void> {
  const planJson = canonicalJson(fixture.plan)
  const taskJson = canonicalJson(fixture.task)
  await insertPostgresDomainRecords(client, [
    {
      tenantId: fixture.tenantId,
      recordId: fixture.plan.id,
      missionId: fixture.missionId,
      schemaName: 'plan-revision.v1',
      recordKind: 'plan-revision',
      recordState: null,
      payload: fixture.plan,
      createdAt: fixture.plan.createdAt
    },
    {
      tenantId: fixture.tenantId,
      recordId: fixture.task.id,
      missionId: fixture.missionId,
      schemaName: 'task-record.v1',
      recordKind: 'task',
      recordState: 'runnable',
      payload: fixture.task,
      createdAt: fixture.task.createdAt
    },
    {
      tenantId: fixture.tenantId,
      recordId: fixture.assignment.id,
      missionId: fixture.missionId,
      schemaName: 'assignment-record.v1',
      recordKind: 'assignment',
      recordState: 'created',
      payload: fixture.assignment,
      createdAt: fixture.assignment.createdAt
    }
  ])
  await client.query(
    `INSERT INTO control_plane.plan_revisions (
       tenant_id, mission_id, plan_revision_id, revision, base_plan_revision_id,
       base_mission_revision, plan, plan_sha256, committed_at
     ) VALUES ($1, $2, $3, $4, NULL, $5, $6::jsonb, $7, $8)`,
    [
      fixture.tenantId,
      fixture.missionId,
      fixture.plan.id,
      fixture.plan.revision,
      fixture.plan.baseMissionRevision,
      planJson,
      sha256Text(planJson),
      fixture.plan.committedAt
    ]
  )
  await client.query(
    `INSERT INTO control_plane.task_executions (
       tenant_id, mission_id, task_id, plan_revision_id, task_state,
       current_attempt_id, current_fence, task, task_sha256, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, 'runnable', NULL, 0, $5::jsonb, $6, $7, $7)`,
    [
      fixture.tenantId,
      fixture.missionId,
      fixture.task.id,
      fixture.plan.id,
      taskJson,
      sha256Text(taskJson),
      fixture.task.createdAt
    ]
  )
}

function taskWithState(current: TaskRecordV1, state: unknown): TaskRecordV1 {
  return TaskRecordV1Schema.parse({ ...current, revision: current.revision + 1, state })
}

function attemptWithState(current: AssignmentAttemptV1, state: unknown): AssignmentAttemptV1 {
  return AssignmentAttemptV1Schema.parse({ ...current, state })
}

export async function completeDurableFencedAttempt(
  pool: Pool,
  fixture: DurableConvergenceFixture
): Promise<boolean> {
  const leaseExpiresAt =
    fixture.attempt.state.status === 'claimed'
      ? fixture.attempt.state.leaseExpiresAt
      : fixture.staleObservedAt
  const leasedTask = taskWithState(fixture.task, {
    status: 'leased',
    attemptId: fixture.attempt.id,
    fence: 1,
    leaseExpiresAt
  })
  await claimTaskAttempt(pool, {
    taskId: fixture.taskId,
    attempt: fixture.attempt,
    leasedTask
  })

  const staleAttempt = AssignmentAttemptV1Schema.parse({
    ...fixture.attempt,
    id: `attempt_stale_s${fixture.attempt.attemptNumber}`,
    state: { status: 'running', leaseExpiresAt }
  })
  const staleTask = taskWithState(leasedTask, {
    status: 'running',
    attemptId: staleAttempt.id,
    fence: 1,
    leaseExpiresAt
  })
  let staleRejected = false
  try {
    await advanceAuthoritativeAttempt(pool, {
      taskId: fixture.taskId,
      attemptId: staleAttempt.id,
      fence: 1,
      observedAt: fixture.staleObservedAt,
      nextAttempt: staleAttempt,
      nextTask: staleTask
    })
  } catch (error) {
    if (!(error instanceof StaleAttemptAuthorityError)) {
      throw error
    }
    staleRejected = true
  }

  const runningAttempt = attemptWithState(fixture.attempt, {
    status: 'running',
    leaseExpiresAt
  })
  const runningTask = taskWithState(leasedTask, {
    status: 'running',
    attemptId: fixture.attempt.id,
    fence: 1,
    leaseExpiresAt
  })
  await advanceAuthoritativeAttempt(pool, {
    taskId: fixture.taskId,
    attemptId: fixture.attempt.id,
    fence: 1,
    observedAt: fixture.activeObservedAt,
    nextAttempt: runningAttempt,
    nextTask: runningTask
  })

  const resultId = fixture.assignmentResultId
  const submittedAttempt = attemptWithState(runningAttempt, {
    status: 'result-submitted',
    resultId,
    submittedAt: fixture.activeObservedAt
  })
  const submittedTask = taskWithState(runningTask, runningTask.state)
  await advanceAuthoritativeAttempt(pool, {
    taskId: fixture.taskId,
    attemptId: fixture.attempt.id,
    fence: 1,
    observedAt: fixture.activeObservedAt,
    nextAttempt: submittedAttempt,
    nextTask: submittedTask
  })

  const evaluatingAttempt = attemptWithState(submittedAttempt, {
    status: 'evaluating',
    resultId,
    evaluationAssignmentIds: [fixture.evaluationAssignment.id]
  })
  const evaluatingTask = taskWithState(submittedTask, {
    status: 'evaluating',
    attemptId: fixture.attempt.id,
    fence: 1,
    evaluationAssignmentIds: [fixture.evaluationAssignment.id]
  })
  await advanceAuthoritativeAttempt(pool, {
    taskId: fixture.taskId,
    attemptId: fixture.attempt.id,
    fence: 1,
    observedAt: fixture.activeObservedAt,
    nextAttempt: evaluatingAttempt,
    nextTask: evaluatingTask
  })
  await withPostgresTransaction(pool, async (client) =>
    insertPostgresDomainRecords(client, [
      {
        tenantId: fixture.tenantId,
        recordId: fixture.assignmentResult.id,
        missionId: fixture.missionId,
        schemaName: 'assignment-result.v1',
        recordKind: 'assignment-result',
        recordState: 'succeeded',
        payload: fixture.assignmentResult,
        createdAt: fixture.assignmentResult.createdAt
      },
      {
        tenantId: fixture.tenantId,
        recordId: fixture.evaluationAssignment.id,
        missionId: fixture.missionId,
        schemaName: 'evaluation-assignment.v1',
        recordKind: 'evaluation-assignment',
        recordState: 'completed',
        payload: fixture.evaluationAssignment,
        createdAt: fixture.evaluationAssignment.createdAt
      },
      {
        tenantId: fixture.tenantId,
        recordId: fixture.evaluationResult.id,
        missionId: fixture.missionId,
        schemaName: 'evaluation-result.v1',
        recordKind: 'evaluation-result',
        recordState: 'passed',
        payload: fixture.evaluationResult,
        createdAt: fixture.evaluationResult.createdAt
      }
    ])
  )

  const succeededAttempt = attemptWithState(evaluatingAttempt, {
    status: 'succeeded',
    reason: 'Durable convergence evaluation passed.',
    completedAt: fixture.activeObservedAt
  })
  const completedTask = taskWithState(evaluatingTask, {
    status: 'completed',
    reason: 'Durable convergence evaluation passed.',
    completedAt: fixture.activeObservedAt,
    acceptedAssignmentResultIds: [resultId],
    acceptedArtifactVersionIds: []
  })
  await advanceAuthoritativeAttempt(pool, {
    taskId: fixture.taskId,
    attemptId: fixture.attempt.id,
    fence: 1,
    observedAt: fixture.activeObservedAt,
    acceptedEvaluationResultIds: [fixture.evaluationResult.id],
    nextAttempt: succeededAttempt,
    nextTask: completedTask
  })
  return staleRejected
}
