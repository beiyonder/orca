import type { Pool } from 'pg'
import { canonicalJson, sha256Text } from '../canonical-json.js'
import {
  MissionEventEnvelopeV1Schema,
  MissionRecordV1Schema,
  type MissionRecordV1
} from '../domain/mission-contracts.js'
import { TenantIdSchema, MissionIdSchema } from '../domain/common-contracts.js'
import { withPostgresTransaction } from './postgres-transaction.js'

type EventRow = {
  aggregate_revision: string
  event: unknown
  event_sha256: string
  payload_sha256: string
}

export type ProjectionRebuildInput = {
  tenantId: string
  missionId: string
}

export type ProjectionRebuildResult = {
  tenantId: string
  missionId: string
  eventRevision: number
  eventCount: number
  projectionSha256: string
}

export class EventLedgerIntegrityError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'EventLedgerIntegrityError'
    this.code = code
  }
}

function fail(code: string, message: string): never {
  throw new EventLedgerIntegrityError(code, message)
}

function missionFromEventPayload(payload: unknown): MissionRecordV1 {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    fail('projection_payload_missing', 'Mission event payload is not an object')
  }
  const mission = MissionRecordV1Schema.safeParse((payload as Record<string, unknown>).mission)
  if (!mission.success) {
    fail('projection_payload_missing', 'Mission event payload has no valid mission projection')
  }
  return mission.data
}

export async function rebuildMissionProjection(
  pool: Pool,
  input: ProjectionRebuildInput
): Promise<ProjectionRebuildResult> {
  const tenantId = TenantIdSchema.parse(input.tenantId)
  const missionId = MissionIdSchema.parse(input.missionId)
  return withPostgresTransaction(pool, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `${tenantId}:${missionId}`
    ])
    const aggregate = await client.query<{ revision: string }>(
      `SELECT revision::text AS revision
       FROM control_plane.mission_aggregates
       WHERE tenant_id = $1 AND mission_id = $2
       FOR UPDATE`,
      [tenantId, missionId]
    )
    const aggregateRevision = Number(aggregate.rows[0]?.revision)
    if (!Number.isSafeInteger(aggregateRevision) || aggregateRevision < 1) {
      fail('aggregate_missing', `Mission aggregate does not exist: ${missionId}`)
    }
    const eventResult = await client.query<EventRow>(
      `SELECT aggregate_revision::text AS aggregate_revision,
              event,
              trim(event_sha256) AS event_sha256,
              trim(payload_sha256) AS payload_sha256
       FROM control_plane.mission_events
       WHERE tenant_id = $1 AND mission_id = $2
       ORDER BY aggregate_revision`,
      [tenantId, missionId]
    )
    if (eventResult.rows.length !== aggregateRevision) {
      fail(
        'event_position_gap',
        `Event count ${eventResult.rows.length} does not match aggregate revision ${aggregateRevision}`
      )
    }

    let projection: MissionRecordV1 | null = null
    for (const [index, row] of eventResult.rows.entries()) {
      const expectedRevision = index + 1
      if (Number(row.aggregate_revision) !== expectedRevision) {
        fail('event_position_gap', `Expected event revision ${expectedRevision}`)
      }
      const event = MissionEventEnvelopeV1Schema.parse(row.event)
      if (
        event.tenantId !== tenantId ||
        event.missionId !== missionId ||
        event.aggregateRevision !== expectedRevision
      ) {
        fail('event_identity_mismatch', `Event at revision ${expectedRevision} has wrong identity`)
      }
      if (sha256Text(canonicalJson(event)) !== row.event_sha256.trim()) {
        fail('event_digest_mismatch', `Event digest mismatch at revision ${expectedRevision}`)
      }
      if (sha256Text(canonicalJson(event.payload)) !== row.payload_sha256.trim()) {
        fail(
          'event_payload_digest_mismatch',
          `Event payload mismatch at revision ${expectedRevision}`
        )
      }
      const nextProjection = missionFromEventPayload(event.payload)
      if (
        nextProjection.tenantId !== tenantId ||
        nextProjection.missionId !== missionId ||
        nextProjection.revision !== expectedRevision
      ) {
        fail('projection_identity_mismatch', `Projection mismatch at revision ${expectedRevision}`)
      }
      projection = nextProjection
    }
    if (!projection) {
      fail('projection_payload_missing', 'Event ledger produced no mission projection')
    }

    const projectionJson = canonicalJson(projection)
    const projectionSha256 = sha256Text(projectionJson)
    const updates = await client.query<{
      aggregate_count: number
      domain_count: number
      projection_count: number
    }>(
      `WITH aggregate_update AS (
         UPDATE control_plane.mission_aggregates
         SET mission_state = $3, current_plan_revision_id = $4,
             record = $5::jsonb, record_sha256 = $6, updated_at = $7
         WHERE tenant_id = $1 AND mission_id = $2 AND revision = $8
         RETURNING 1
       ), domain_update AS (
         UPDATE control_plane.domain_records
         SET aggregate_revision = $8, record_state = $3,
             payload = $5::jsonb, payload_sha256 = $6, updated_at = $7
         WHERE tenant_id = $1 AND record_id = $2 AND schema_name = 'mission-record.v1'
         RETURNING 1
       ), projection_upsert AS (
         INSERT INTO control_plane.mission_projections (
           tenant_id, mission_id, projection_name, event_revision,
           projection, projection_sha256, rebuilt_at, updated_at
         ) VALUES ($1, $2, 'mission', $8, $5::jsonb, $6, transaction_timestamp(), $7)
         ON CONFLICT (tenant_id, mission_id, projection_name) DO UPDATE
         SET event_revision = EXCLUDED.event_revision,
             projection = EXCLUDED.projection,
             projection_sha256 = EXCLUDED.projection_sha256,
             rebuilt_at = EXCLUDED.rebuilt_at,
             updated_at = EXCLUDED.updated_at
         RETURNING 1
       )
       SELECT (SELECT count(*)::int FROM aggregate_update) AS aggregate_count,
              (SELECT count(*)::int FROM domain_update) AS domain_count,
              (SELECT count(*)::int FROM projection_upsert) AS projection_count`,
      [
        tenantId,
        missionId,
        projection.state.status,
        projection.currentPlanRevisionId,
        projectionJson,
        projectionSha256,
        projection.updatedAt,
        projection.revision
      ]
    )
    const counts = updates.rows[0]
    if (
      !counts ||
      counts.aggregate_count !== 1 ||
      counts.domain_count !== 1 ||
      counts.projection_count !== 1
    ) {
      fail('projection_write_conflict', 'Projection rebuild did not update every current view')
    }
    return {
      tenantId,
      missionId,
      eventRevision: projection.revision,
      eventCount: eventResult.rows.length,
      projectionSha256
    }
  })
}
