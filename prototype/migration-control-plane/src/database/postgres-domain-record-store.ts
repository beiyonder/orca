import type { PoolClient } from 'pg'
import { canonicalJson, sha256Text } from '../canonical-json.js'

export type PostgresDomainRecordInput = {
  tenantId: string
  recordId: string
  missionId: string | null
  schemaName: string
  recordKind: string
  recordState: string | null
  payload: unknown
  createdAt: string
}

export async function insertPostgresDomainRecords(
  client: PoolClient,
  inputs: readonly PostgresDomainRecordInput[]
): Promise<void> {
  if (inputs.length === 0) {
    return
  }
  const rows = inputs.map((input) => {
    const payloadJson = canonicalJson(input.payload)
    return {
      tenant_id: input.tenantId,
      record_id: input.recordId,
      mission_id: input.missionId,
      schema_name: input.schemaName,
      record_kind: input.recordKind,
      record_state: input.recordState,
      payload: input.payload,
      payload_sha256: sha256Text(payloadJson),
      created_at: input.createdAt
    }
  })
  await client.query(
    `INSERT INTO control_plane.domain_records (
       tenant_id, record_id, mission_id, schema_name, schema_version, record_kind,
       aggregate_revision, record_state, payload, payload_sha256, created_at, updated_at
     )
     SELECT tenant_id, record_id, mission_id, schema_name, 1, record_kind,
            NULL, record_state, payload, payload_sha256, created_at,
            transaction_timestamp()
     FROM jsonb_to_recordset($1::jsonb) AS record(
       tenant_id text,
       record_id text,
       mission_id text,
       schema_name text,
       record_kind text,
       record_state text,
       payload jsonb,
       payload_sha256 text,
       created_at timestamptz
     )`,
    [canonicalJson(rows)]
  )
}
