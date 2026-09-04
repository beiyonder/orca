import type { Pool } from 'pg'
import { canonicalJson, sha256Text } from '../canonical-json.js'
import {
  MissionEventEnvelopeV1Schema,
  type MissionEventEnvelopeV1
} from '../domain/mission-contracts.js'
import { PublicMissionProjectionIntegrityError } from './postgres-public-mission-query.js'

type ActivityRow = {
  current_revision: string
  aggregate_revision: string | null
  event_id: string | null
  event: unknown
  event_sha256: string | null
  payload_sha256: string | null
}

export type PublicMissionActivityBatch = {
  events: MissionEventEnvelopeV1[]
  currentRevision: number
}

export async function readPublicMissionActivityBatch(
  pool: Pool,
  tenantId: string,
  missionId: string,
  afterRevision: number,
  limit: number
): Promise<PublicMissionActivityBatch | null> {
  const result = await pool.query<ActivityRow>(
    `WITH authority AS (
       SELECT revision AS current_revision
       FROM control_plane.mission_aggregates
       WHERE tenant_id = $1 AND mission_id = $2
     ), selected AS (
       SELECT aggregate_revision, event_id, event,
              trim(event_sha256) AS event_sha256,
              trim(payload_sha256) AS payload_sha256
       FROM control_plane.mission_events
       WHERE tenant_id = $1 AND mission_id = $2 AND aggregate_revision > $3
       ORDER BY aggregate_revision
       LIMIT $4
     )
     SELECT authority.current_revision::text, selected.aggregate_revision::text,
            selected.event_id, selected.event, selected.event_sha256,
            selected.payload_sha256
     FROM authority
     LEFT JOIN selected ON true
     ORDER BY selected.aggregate_revision`,
    [tenantId, missionId, afterRevision, limit]
  )
  if (result.rows.length === 0) {
    return null
  }
  const currentRevision = Number(result.rows[0]!.current_revision)
  if (!Number.isSafeInteger(currentRevision) || currentRevision < 1) {
    throw new PublicMissionProjectionIntegrityError(missionId)
  }
  if (afterRevision > currentRevision) {
    throw new PublicMissionProjectionIntegrityError(missionId)
  }
  const eventRows = result.rows.filter(
    (row): row is ActivityRow & { aggregate_revision: string; event_id: string; event: unknown } =>
      row.aggregate_revision !== null && row.event_id !== null && row.event !== null
  )
  const events = eventRows.map((row, index) => {
    const parsed = MissionEventEnvelopeV1Schema.safeParse(row.event)
    const expectedRevision = afterRevision + index + 1
    if (
      !parsed.success ||
      parsed.data.tenantId !== tenantId ||
      parsed.data.missionId !== missionId ||
      parsed.data.id !== row.event_id ||
      parsed.data.aggregateRevision !== Number(row.aggregate_revision) ||
      parsed.data.aggregateRevision !== expectedRevision ||
      parsed.data.payloadDigest !== row.payload_sha256 ||
      sha256Text(canonicalJson(parsed.data)) !== row.event_sha256 ||
      sha256Text(canonicalJson(parsed.data.payload)) !== row.payload_sha256
    ) {
      throw new PublicMissionProjectionIntegrityError(row.event_id)
    }
    return parsed.data
  })
  if (events.length === 0 && currentRevision > afterRevision) {
    throw new PublicMissionProjectionIntegrityError(missionId)
  }
  return { events, currentRevision }
}
