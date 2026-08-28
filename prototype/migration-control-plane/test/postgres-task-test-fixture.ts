import type { Pool } from 'pg'
import { canonicalJson, sha256Text } from '../src/canonical-json.js'
import { withPostgresTransaction } from '../src/database/postgres-transaction.js'
import { DOMAIN_CONTRACT_SAMPLES } from './domain-contract-samples.js'
import { createMissionFixture } from './postgres-mission-test-fixture.js'

export type RunnableTaskFixture = {
  task: Record<string, unknown>
  assignment: Record<string, unknown>
}

export async function seedRunnableTaskFixture(pool: Pool): Promise<RunnableTaskFixture> {
  await createMissionFixture(pool)
  const plan = structuredClone(DOMAIN_CONTRACT_SAMPLES['plan-revision.v1']) as Record<
    string,
    unknown
  >
  const task = structuredClone(DOMAIN_CONTRACT_SAMPLES['task-record.v1']) as Record<string, unknown>
  const assignment = structuredClone(DOMAIN_CONTRACT_SAMPLES['assignment-record.v1']) as Record<
    string,
    unknown
  >
  const planJson = canonicalJson(plan)
  const taskJson = canonicalJson(task)
  const assignmentJson = canonicalJson(assignment)

  await withPostgresTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO control_plane.domain_records (
         tenant_id, record_id, mission_id, schema_name, schema_version, record_kind,
         aggregate_revision, record_state, payload, payload_sha256, created_at, updated_at
       ) VALUES
         ($1, $2, $3, 'plan-revision.v1', 1, 'plan-revision', $4, NULL,
          $5::jsonb, $6, $7, $7),
         ($1, $8, $3, 'task-record.v1', 1, 'task', $9, 'runnable',
          $10::jsonb, $11, $12, $12),
         ($1, $13, $3, 'assignment-record.v1', 1, 'assignment', $14, 'created',
          $15::jsonb, $16, $17, $17)`,
      [
        plan.tenantId,
        plan.id,
        plan.missionId,
        plan.revision,
        planJson,
        sha256Text(planJson),
        plan.createdAt,
        task.id,
        task.revision,
        taskJson,
        sha256Text(taskJson),
        task.createdAt,
        assignment.id,
        assignment.revision,
        assignmentJson,
        sha256Text(assignmentJson),
        assignment.createdAt
      ]
    )
    await client.query(
      `INSERT INTO control_plane.plan_revisions (
         tenant_id, mission_id, plan_revision_id, revision, base_plan_revision_id,
         base_mission_revision, plan, plan_sha256, committed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)`,
      [
        plan.tenantId,
        plan.missionId,
        plan.id,
        plan.revision,
        plan.basePlanRevisionId,
        plan.baseMissionRevision,
        planJson,
        sha256Text(planJson),
        plan.committedAt
      ]
    )
    await client.query(
      `INSERT INTO control_plane.task_executions (
         tenant_id, mission_id, task_id, plan_revision_id, task_state,
         current_attempt_id, current_fence, task, task_sha256, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, 'runnable', NULL, 0, $5::jsonb, $6, $7, $7)`,
      [
        task.tenantId,
        task.missionId,
        task.id,
        task.planRevisionId,
        taskJson,
        sha256Text(taskJson),
        task.createdAt
      ]
    )
    await client.query(
      `UPDATE control_plane.mission_aggregates
       SET current_plan_revision_id = $3
       WHERE tenant_id = $1 AND mission_id = $2`,
      [plan.tenantId, plan.missionId, plan.id]
    )
  })
  return { task, assignment }
}
