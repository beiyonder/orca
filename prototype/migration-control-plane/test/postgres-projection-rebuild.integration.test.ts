import type { Pool } from 'pg'
import { afterEach, describe, expect, it } from 'vitest'
import { canonicalJson } from '../src/canonical-json.js'
import { rebuildMissionProjection } from '../src/database/postgres-projection-rebuild.js'
import {
  createPostgresKernelTestContext,
  type PostgresKernelTestContext
} from './postgres-kernel-test-context.js'
import { advanceMissionFixture, createMissionFixture } from './postgres-mission-test-fixture.js'

const contexts: PostgresKernelTestContext[] = []

async function kernelPool(): Promise<Pool> {
  const context = await createPostgresKernelTestContext()
  contexts.push(context)
  return context.pool
}

async function twoEventMission(pool: Pool): Promise<void> {
  await createMissionFixture(pool)
  await advanceMissionFixture(pool, { suffix: 'replay' })
}

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(async (context) => context.close()))
})

describe.sequential('PostgreSQL projection rebuild', () => {
  it('enforces append-only event rows at the database boundary', async () => {
    const pool = await kernelPool()
    await twoEventMission(pool)

    await expect(
      pool.query(
        `UPDATE control_plane.mission_events
         SET event = jsonb_set(event, '{correlationId}', '"tampered"'::jsonb)
         WHERE aggregate_revision = 1`
      )
    ).rejects.toMatchObject({ code: '55000' })
    await expect(
      pool.query('DELETE FROM control_plane.mission_events WHERE aggregate_revision = 2')
    ).rejects.toMatchObject({ code: '55000' })
  })

  it('rebuilds dropped and corrupted current views to the exact event bytes', async () => {
    const pool = await kernelPool()
    await twoEventMission(pool)
    const original = await pool.query<{ projection: unknown; projection_sha256: string }>(
      `SELECT projection, trim(projection_sha256) AS projection_sha256
       FROM control_plane.mission_projections
       WHERE mission_id = 'mission_s1' AND projection_name = 'mission'`
    )
    await pool.query(
      "DELETE FROM control_plane.mission_projections WHERE mission_id = 'mission_s1'"
    )
    await pool.query(
      `UPDATE control_plane.mission_aggregates
       SET record = jsonb_set(record, '{objective}', '"CORRUPTED"'::jsonb),
           record_sha256 = repeat('0', 64)
       WHERE mission_id = 'mission_s1'`
    )
    await pool.query(
      `UPDATE control_plane.domain_records
       SET payload = jsonb_set(payload, '{objective}', '"CORRUPTED"'::jsonb),
           payload_sha256 = repeat('0', 64)
       WHERE record_id = 'mission_s1'`
    )

    const rebuilt = await rebuildMissionProjection(pool, {
      tenantId: 'tenant_s1',
      missionId: 'mission_s1'
    })
    expect(rebuilt).toMatchObject({ eventRevision: 2, eventCount: 2 })
    expect(rebuilt.projectionSha256).toBe(original.rows[0]?.projection_sha256)

    const current = await pool.query<{
      projection: unknown
      projection_sha256: string
      aggregate_record: unknown
      aggregate_sha256: string
      domain_payload: unknown
      domain_sha256: string
      rebuilt: boolean
    }>(
      `SELECT projection.projection,
              trim(projection.projection_sha256) AS projection_sha256,
              aggregate.record AS aggregate_record,
              trim(aggregate.record_sha256) AS aggregate_sha256,
              domain.payload AS domain_payload,
              trim(domain.payload_sha256) AS domain_sha256,
              projection.rebuilt_at IS NOT NULL AS rebuilt
       FROM control_plane.mission_projections AS projection
       JOIN control_plane.mission_aggregates AS aggregate
         ON aggregate.tenant_id = projection.tenant_id
         AND aggregate.mission_id = projection.mission_id
       JOIN control_plane.domain_records AS domain
         ON domain.tenant_id = projection.tenant_id
         AND domain.record_id = projection.mission_id
       WHERE projection.mission_id = 'mission_s1' AND projection.projection_name = 'mission'`
    )
    expect(canonicalJson(current.rows[0]?.projection)).toBe(
      canonicalJson(original.rows[0]?.projection)
    )
    expect(canonicalJson(current.rows[0]?.aggregate_record)).toBe(
      canonicalJson(original.rows[0]?.projection)
    )
    expect(canonicalJson(current.rows[0]?.domain_payload)).toBe(
      canonicalJson(original.rows[0]?.projection)
    )
    expect(current.rows[0]).toMatchObject({
      projection_sha256: rebuilt.projectionSha256,
      aggregate_sha256: rebuilt.projectionSha256,
      domain_sha256: rebuilt.projectionSha256,
      rebuilt: true
    })
  })

  it('rejects a tampered event digest instead of rebuilding false state', async () => {
    const pool = await kernelPool()
    await twoEventMission(pool)
    await pool.query(
      'ALTER TABLE control_plane.mission_events DISABLE TRIGGER mission_events_append_only'
    )
    await pool.query(
      `UPDATE control_plane.mission_events
       SET event = jsonb_set(event, '{correlationId}', '"tampered"'::jsonb)
       WHERE aggregate_revision = 2`
    )
    await pool.query(
      'ALTER TABLE control_plane.mission_events ENABLE TRIGGER mission_events_append_only'
    )

    await expect(
      rebuildMissionProjection(pool, { tenantId: 'tenant_s1', missionId: 'mission_s1' })
    ).rejects.toMatchObject({
      code: 'event_digest_mismatch'
    })
  })

  it('rejects a ledger position gap', async () => {
    const pool = await kernelPool()
    await twoEventMission(pool)
    await pool.query(
      'ALTER TABLE control_plane.mission_events DISABLE TRIGGER mission_events_append_only'
    )
    await pool.query("DELETE FROM control_plane.outbox_messages WHERE event_id = 'event_replay'")
    await pool.query("DELETE FROM control_plane.mission_events WHERE event_id = 'event_replay'")
    await pool.query(
      'ALTER TABLE control_plane.mission_events ENABLE TRIGGER mission_events_append_only'
    )

    await expect(
      rebuildMissionProjection(pool, { tenantId: 'tenant_s1', missionId: 'mission_s1' })
    ).rejects.toMatchObject({ code: 'event_position_gap' })
  })
})
