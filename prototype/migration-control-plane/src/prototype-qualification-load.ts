import { performance } from 'node:perf_hooks'
import type { Pool } from 'pg'
import { executeIdempotentMissionCommand } from './database/postgres-command-idempotency.js'
import { insertPostgresDomainRecords } from './database/postgres-domain-record-store.js'
import { commitMissionTransition } from './database/postgres-mission-transition.js'
import { withPostgresTransaction } from './database/postgres-transaction.js'
import { seedDurablePlanAndTask } from './durable-convergence-attempt.js'
import { buildDurableConvergenceFixture } from './durable-convergence-fixture.js'
import { AssignmentRecordV1Schema } from './domain/assignment-contracts.js'
import type { PrototypeQualificationProfileV1 } from './prototype-qualification-profile.js'

export type QualificationLoadResult = {
  missions: number
  assignmentRecords: number
  controlEvents: number
  elapsedMs: number
  missionEventBytes: number
  bottlenecks: string[]
}

export async function runPrototypeQualificationLoad(
  pool: Pool,
  profile: PrototypeQualificationProfileV1
): Promise<QualificationLoadResult> {
  const startedAt = performance.now()
  const seedBase = 20_000
  for (let index = 0; index < profile.load.missions; index += 1) {
    const fixture = buildDurableConvergenceFixture(seedBase + index)
    await executeIdempotentMissionCommand(pool, fixture.create.command, async (client, command) =>
      commitMissionTransition(client, command, fixture.create)
    )
    const secondAssignment = AssignmentRecordV1Schema.parse({
      ...fixture.assignment,
      id: `assignment_load_secondary_${index}`,
      role: 'reviewer'
    })
    await withPostgresTransaction(pool, async (client) => {
      await seedDurablePlanAndTask(client, fixture)
      await insertPostgresDomainRecords(client, [
        {
          tenantId: fixture.tenantId,
          recordId: secondAssignment.id,
          missionId: fixture.missionId,
          schemaName: 'assignment-record.v1',
          recordKind: 'assignment',
          recordState: 'created',
          payload: secondAssignment,
          createdAt: secondAssignment.createdAt
        }
      ])
    })
  }
  const seedPattern = 'tenant_dur_s2%'
  const counts = await pool.query<{
    missions: number
    assignments: number
    events: number
    event_bytes: string
  }>(
    `SELECT
       (SELECT count(*)::int FROM control_plane.mission_aggregates
        WHERE tenant_id LIKE $1) AS missions,
       (SELECT count(*)::int FROM control_plane.domain_records
        WHERE tenant_id LIKE $1 AND schema_name = 'assignment-record.v1') AS assignments,
       (SELECT count(*)::int FROM control_plane.mission_events
        WHERE tenant_id LIKE $1) AS events,
       (SELECT coalesce(sum(pg_column_size(event)), 0)::bigint::text
        FROM control_plane.mission_events WHERE tenant_id LIKE $1) AS event_bytes`,
    [seedPattern]
  )
  const row = counts.rows[0]!
  return {
    missions: row.missions,
    assignmentRecords: row.assignments,
    controlEvents: row.events,
    elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100,
    missionEventBytes: Number(row.event_bytes),
    bottlenecks: [
      'Sequential qualification fixture creation dominates elapsed time.',
      'Agent slots are durable assignment records; no model workers are launched in the load envelope.',
      'Single-node PostgreSQL results do not establish production capacity or high availability.'
    ]
  }
}
