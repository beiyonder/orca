import type { Pool } from 'pg'
import { canonicalJson, sha256Text } from '../canonical-json.js'
import { MissionRecordV1Schema, type MissionRecordV1 } from '../domain/mission-contracts.js'
import {
  ProcessObligationV1Schema,
  type ProcessObligationV1
} from '../domain/process-obligation-contracts.js'

export class PublicMissionProjectionIntegrityError extends Error {
  constructor(recordId: string) {
    super(`Stored public mission projection failed integrity validation: ${recordId}`)
    this.name = 'PublicMissionProjectionIntegrityError'
  }
}

type MissionRow = {
  mission_id: string
  record: unknown
  record_sha256: string
}

type ObligationRow = {
  obligation_id: string
  obligation: unknown
  obligation_sha256: string
}

export type PublicMissionPage<T> = {
  items: T[]
  nextLastId: string | null
}

function parseMission(row: MissionRow, tenantId: string): MissionRecordV1 {
  const parsed = MissionRecordV1Schema.safeParse(row.record)
  if (
    !parsed.success ||
    parsed.data.tenantId !== tenantId ||
    parsed.data.id !== row.mission_id ||
    parsed.data.missionId !== row.mission_id ||
    sha256Text(canonicalJson(parsed.data)) !== row.record_sha256
  ) {
    throw new PublicMissionProjectionIntegrityError(row.mission_id)
  }
  return parsed.data
}

function parseObligation(
  row: ObligationRow,
  tenantId: string,
  missionId: string
): ProcessObligationV1 {
  const parsed = ProcessObligationV1Schema.safeParse(row.obligation)
  if (
    !parsed.success ||
    parsed.data.tenantId !== tenantId ||
    parsed.data.missionId !== missionId ||
    parsed.data.id !== row.obligation_id ||
    sha256Text(canonicalJson(parsed.data)) !== row.obligation_sha256
  ) {
    throw new PublicMissionProjectionIntegrityError(row.obligation_id)
  }
  return parsed.data
}

export async function readPublicMission(
  pool: Pool,
  tenantId: string,
  missionId: string
): Promise<MissionRecordV1 | null> {
  const result = await pool.query<MissionRow>(
    `SELECT mission_id, record, trim(record_sha256) AS record_sha256
     FROM control_plane.mission_aggregates
     WHERE tenant_id = $1 AND mission_id = $2`,
    [tenantId, missionId]
  )
  return result.rows[0] ? parseMission(result.rows[0], tenantId) : null
}

export async function listPublicMissions(
  pool: Pool,
  tenantId: string,
  limit: number,
  lastId: string | null
): Promise<PublicMissionPage<MissionRecordV1>> {
  const result = await pool.query<MissionRow>(
    `SELECT mission_id, record, trim(record_sha256) AS record_sha256
     FROM control_plane.mission_aggregates
     WHERE tenant_id = $1 AND ($2::text IS NULL OR mission_id > $2)
     ORDER BY mission_id
     LIMIT $3`,
    [tenantId, lastId, limit + 1]
  )
  const hasMore = result.rows.length > limit
  const rows = hasMore ? result.rows.slice(0, limit) : result.rows
  return {
    items: rows.map((row) => parseMission(row, tenantId)),
    nextLastId: hasMore ? rows.at(-1)!.mission_id : null
  }
}

export async function listPublicMissionObligations(
  pool: Pool,
  tenantId: string,
  missionId: string,
  limit: number,
  lastId: string | null
): Promise<PublicMissionPage<ProcessObligationV1>> {
  const result = await pool.query<ObligationRow>(
    `SELECT obligation_id, obligation, trim(obligation_sha256) AS obligation_sha256
     FROM control_plane.process_obligations
     WHERE tenant_id = $1 AND mission_id = $2
       AND ($3::text IS NULL OR obligation_id > $3)
     ORDER BY obligation_id
     LIMIT $4`,
    [tenantId, missionId, lastId, limit + 1]
  )
  const hasMore = result.rows.length > limit
  const rows = hasMore ? result.rows.slice(0, limit) : result.rows
  return {
    items: rows.map((row) => parseObligation(row, tenantId, missionId)),
    nextLastId: hasMore ? rows.at(-1)!.obligation_id : null
  }
}
