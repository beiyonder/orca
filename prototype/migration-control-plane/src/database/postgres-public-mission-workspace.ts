import type { Pool } from 'pg'
import { canonicalJson, sha256Text } from '../canonical-json.js'
import {
  DOMAIN_SCHEMA_REGISTRY,
  type DomainSchemaName
} from '../domain/domain-contract-registry.js'
import { GapV1Schema } from '../domain/epistemic-contracts.js'
import { MissionCommandEnvelopeV1Schema } from '../domain/mission-contracts.js'
import { CreateMissionRequestV1Schema } from '../public-mission-api-contracts.js'
import {
  MISSION_WORKSPACE_SECTION_SCHEMAS,
  type MissionWorkspaceSection
} from '../public-mission-workspace-contracts.js'
import {
  PublicMissionProjectionIntegrityError,
  type PublicMissionPage
} from './postgres-public-mission-query.js'

type DomainRecordRow = {
  record_id: string
  schema_name: string
  record_kind: string
  record_state: string | null
  payload: unknown
  payload_sha256: string
  created_at: Date
  updated_at: Date
}

type CommandRow = {
  command_id: string
  command: unknown
  command_sha256: string
}

export type PublicMissionWorkspaceRecord = {
  id: string
  schemaName: DomainSchemaName
  kind: string
  state: string | null
  payload: unknown
  createdAt: string
  updatedAt: string
}

function parseDomainRecord(
  row: DomainRecordRow,
  tenantId: string,
  missionId: string
): PublicMissionWorkspaceRecord {
  const schemaName = row.schema_name as DomainSchemaName
  const schema = DOMAIN_SCHEMA_REGISTRY[schemaName]
  const parsed = schema?.safeParse(row.payload)
  const bound =
    parsed?.success &&
    typeof parsed.data === 'object' &&
    parsed.data !== null &&
    'tenantId' in parsed.data &&
    parsed.data.tenantId === tenantId &&
    (!('missionId' in parsed.data) || parsed.data.missionId === missionId)
  if (!parsed?.success || !bound || sha256Text(canonicalJson(parsed.data)) !== row.payload_sha256) {
    throw new PublicMissionProjectionIntegrityError(row.record_id)
  }
  return {
    id: row.record_id,
    schemaName,
    kind: row.record_kind,
    state: row.record_state,
    payload: parsed.data,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  }
}

export async function readPublicMissionIntake(pool: Pool, tenantId: string, missionId: string) {
  const result = await pool.query<CommandRow>(
    `SELECT command_id, command, trim(command_sha256) AS command_sha256
     FROM control_plane.mission_commands
     WHERE tenant_id = $1 AND mission_id = $2 AND command_type = 'create-mission'
     ORDER BY created_at, command_id
     LIMIT 1`,
    [tenantId, missionId]
  )
  const row = result.rows[0]
  if (!row) {
    throw new PublicMissionProjectionIntegrityError(missionId)
  }
  const command = MissionCommandEnvelopeV1Schema.safeParse(row.command)
  if (
    !command.success ||
    command.data.tenantId !== tenantId ||
    command.data.missionId !== missionId ||
    command.data.id !== row.command_id ||
    sha256Text(canonicalJson(command.data)) !== row.command_sha256 ||
    sha256Text(canonicalJson(command.data.payload)) !== command.data.payloadDigest
  ) {
    throw new PublicMissionProjectionIntegrityError(row.command_id)
  }
  return CreateMissionRequestV1Schema.parse({
    ...(command.data.payload as Record<string, unknown>),
    issuedAt: command.data.issuedAt
  })
}

export async function listPublicMissionWorkspaceRecords(
  pool: Pool,
  tenantId: string,
  missionId: string,
  section: Exclude<MissionWorkspaceSection, 'intake' | 'exceptions'>,
  limit: number,
  lastId: string | null
): Promise<PublicMissionPage<PublicMissionWorkspaceRecord>> {
  const schemas = MISSION_WORKSPACE_SECTION_SCHEMAS[section]
  const result = await pool.query<DomainRecordRow>(
    `SELECT record_id, schema_name, record_kind, record_state, payload,
            trim(payload_sha256) AS payload_sha256, created_at, updated_at
     FROM control_plane.domain_records
     WHERE tenant_id = $1 AND mission_id = $2
       AND schema_name = ANY($3::text[])
       AND ($4::text IS NULL OR record_id > $4)
     ORDER BY record_id
     LIMIT $5`,
    [tenantId, missionId, schemas, lastId, limit + 1]
  )
  const hasMore = result.rows.length > limit
  const rows = hasMore ? result.rows.slice(0, limit) : result.rows
  return {
    items: rows.map((row) => parseDomainRecord(row, tenantId, missionId)),
    nextLastId: hasMore ? rows.at(-1)!.record_id : null
  }
}

export async function listPublicMissionExceptions(
  pool: Pool,
  tenantId: string,
  missionId: string,
  limit: number,
  lastId: string | null
): Promise<PublicMissionPage<unknown>> {
  const result = await pool.query<DomainRecordRow>(
    `SELECT record_id, schema_name, record_kind, record_state, payload,
            trim(payload_sha256) AS payload_sha256, created_at, updated_at
     FROM control_plane.domain_records
     WHERE tenant_id = $1 AND mission_id = $2 AND schema_name = 'gap.v1'
       AND payload #>> '{state,status}' <> 'resolved'
       AND ($3::text IS NULL OR record_id > $3)
     ORDER BY record_id
     LIMIT $4`,
    [tenantId, missionId, lastId, limit + 1]
  )
  const hasMore = result.rows.length > limit
  const rows = hasMore ? result.rows.slice(0, limit) : result.rows
  const items = rows.map((row) => {
    const record = parseDomainRecord(row, tenantId, missionId)
    const gap = GapV1Schema.parse(record.payload)
    return {
      id: gap.id,
      question: gap.question,
      impact: gap.impact,
      state: gap.state,
      blockedDecisionIds: gap.blockedDecisionIds,
      blockedTaskIds:
        gap.state.status === 'blocked'
          ? gap.state.blockerIds.filter((id) => id.startsWith('task_'))
          : []
    }
  })
  return { items, nextLastId: hasMore ? rows.at(-1)!.record_id : null }
}
