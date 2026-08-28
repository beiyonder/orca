import type { Pool } from 'pg'
import { afterEach, describe, expect, it } from 'vitest'
import { advanceMissionFixture, createMissionFixture } from './postgres-mission-test-fixture.js'
import {
  createPostgresKernelTestContext,
  type PostgresKernelTestContext
} from './postgres-kernel-test-context.js'

const contexts: PostgresKernelTestContext[] = []

async function kernelPool(): Promise<Pool> {
  const context = await createPostgresKernelTestContext()
  contexts.push(context)
  return context.pool
}

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(async (context) => context.close()))
})

describe.sequential('PostgreSQL mission transition transaction', () => {
  it('creates aggregate, event, projection, outbox, and command outcome atomically', async () => {
    const pool = await kernelPool()
    await createMissionFixture(pool)

    const state = await pool.query<{
      revision: string
      event_count: string
      projection_revision: string
      outbox_count: string
    }>(
      `SELECT
         aggregate.revision::text AS revision,
         (SELECT count(*)::text FROM control_plane.mission_events) AS event_count,
         projection.event_revision::text AS projection_revision,
         (SELECT count(*)::text FROM control_plane.outbox_messages) AS outbox_count
       FROM control_plane.mission_aggregates AS aggregate
       JOIN control_plane.mission_projections AS projection
         ON projection.tenant_id = aggregate.tenant_id
         AND projection.mission_id = aggregate.mission_id
         AND projection.projection_name = 'mission'`
    )
    expect(state.rows[0]).toEqual({
      revision: '1',
      event_count: '1',
      projection_revision: '1',
      outbox_count: '1'
    })
  })

  it('allows one expected-version winner and durably rejects its concurrent rival', async () => {
    const pool = await kernelPool()
    await createMissionFixture(pool)
    const outcomes = await Promise.all([
      advanceMissionFixture(pool, { suffix: 'concurrent_a' }),
      advanceMissionFixture(pool, { suffix: 'concurrent_b' })
    ])

    expect(outcomes.map((result) => result.outcome.status).sort()).toEqual([
      'committed',
      'rejected'
    ])
    expect(outcomes.find((result) => result.outcome.status === 'rejected')?.outcome).toMatchObject({
      status: 'rejected',
      errorCode: 'version_conflict'
    })
    const state = await pool.query<{
      revision: string
      events: string
      outbox: string
      rejected: string
    }>(
      `SELECT
         aggregate.revision::text AS revision,
         (SELECT count(*)::text FROM control_plane.mission_events) AS events,
         (SELECT count(*)::text FROM control_plane.outbox_messages) AS outbox,
         (SELECT count(*)::text FROM control_plane.mission_commands WHERE status = 'rejected') AS rejected
       FROM control_plane.mission_aggregates AS aggregate`
    )
    expect(state.rows[0]).toEqual({ revision: '2', events: '2', outbox: '2', rejected: '1' })
  })

  it('rolls event and projections back when outbox insertion fails', async () => {
    const pool = await kernelPool()
    await createMissionFixture(pool)
    await expect(
      advanceMissionFixture(pool, {
        suffix: 'duplicate_outbox',
        outboxId: 'message_mission_created'
      })
    ).rejects.toMatchObject({ code: '23505' })

    const state = await pool.query<{
      revision: string
      events: string
      projection_revision: string
      outbox: string
      command_rows: string
    }>(
      `SELECT
         aggregate.revision::text AS revision,
         (SELECT count(*)::text FROM control_plane.mission_events) AS events,
         projection.event_revision::text AS projection_revision,
         (SELECT count(*)::text FROM control_plane.outbox_messages) AS outbox,
         (SELECT count(*)::text FROM control_plane.mission_commands
          WHERE command_id = 'command_duplicate_outbox') AS command_rows
       FROM control_plane.mission_aggregates AS aggregate
       JOIN control_plane.mission_projections AS projection
         ON projection.tenant_id = aggregate.tenant_id
         AND projection.mission_id = aggregate.mission_id
         AND projection.projection_name = 'mission'`
    )
    expect(state.rows[0]).toEqual({
      revision: '1',
      events: '1',
      projection_revision: '1',
      outbox: '1',
      command_rows: '0'
    })
  })

  it('persists projection conflict rejection without partial aggregate or event state', async () => {
    const pool = await kernelPool()
    await createMissionFixture(pool)
    await pool.query(
      "UPDATE control_plane.mission_projections SET event_revision = 0 WHERE projection_name = 'mission'"
    )
    const result = await advanceMissionFixture(pool, { suffix: 'projection_conflict' })
    expect(result.outcome).toMatchObject({ status: 'rejected', errorCode: 'projection_conflict' })

    const state = await pool.query<{
      revision: string
      events: string
      outbox: string
      projection_revision: string
    }>(
      `SELECT
         aggregate.revision::text AS revision,
         (SELECT count(*)::text FROM control_plane.mission_events) AS events,
         (SELECT count(*)::text FROM control_plane.outbox_messages) AS outbox,
         projection.event_revision::text AS projection_revision
       FROM control_plane.mission_aggregates AS aggregate
       JOIN control_plane.mission_projections AS projection
         ON projection.tenant_id = aggregate.tenant_id
         AND projection.mission_id = aggregate.mission_id
         AND projection.projection_name = 'mission'`
    )
    expect(state.rows[0]).toEqual({
      revision: '1',
      events: '1',
      outbox: '1',
      projection_revision: '0'
    })
  })
})
