import type { PoolClient } from 'pg'
import { canonicalJson } from '../canonical-json.js'
import type {
  ProcessObligationDefinitionV1,
  ProcessObligationV1,
  ProcessObligationWaiverV1
} from '../domain/process-obligation-contracts.js'
import { failProcessObligation } from './postgres-process-obligation-errors.js'

type ProofRow = {
  record_id: string
  record_kind: string
  schema_name: string
  schema_version: number
  schema_sha256: string
  created_at: Date
}

async function proofRows(
  client: PoolClient,
  tenantId: string,
  missionId: string,
  recordIds: string[]
): Promise<ProofRow[]> {
  if (new Set(recordIds).size !== recordIds.length) {
    failProcessObligation('duplicate_proof', 'Proof record identities must be unique')
  }
  const result = await client.query<ProofRow>(
    `SELECT record.record_id, record.record_kind, record.schema_name,
            record.schema_version, schema.schema_sha256, record.created_at
     FROM control_plane.domain_records AS record
     JOIN control_plane.contract_schemas AS schema
       ON schema.schema_name = record.schema_name
      AND schema.schema_version = record.schema_version
     WHERE record.tenant_id = $1 AND record.mission_id = $2
       AND record.record_id = ANY($3::text[])
     ORDER BY record.record_id`,
    [tenantId, missionId, recordIds]
  )
  if (result.rows.length !== recordIds.length) {
    failProcessObligation('proof_missing', 'One or more proof records are missing from the mission')
  }
  return result.rows
}

export async function validateProcessObligationSatisfactionProof(
  client: PoolClient,
  obligation: ProcessObligationV1,
  definition: ProcessObligationDefinitionV1,
  recordIds: string[],
  now: Date
): Promise<void> {
  if (recordIds.length < definition.proof.minimumCount) {
    failProcessObligation('proof_incomplete', 'Process obligation has too few proof records')
  }
  const records = await proofRows(client, obligation.tenantId, obligation.missionId, recordIds)
  for (const record of records) {
    if (!definition.proof.recordKinds.includes(record.record_kind)) {
      failProcessObligation(
        'proof_kind_mismatch',
        `Proof kind is not allowed: ${record.record_kind}`
      )
    }
    const schema = definition.proof.schemas.find(
      (candidate) =>
        candidate.name === record.schema_name &&
        candidate.version === record.schema_version &&
        candidate.digest === record.schema_sha256
    )
    if (!schema) {
      failProcessObligation(
        'proof_schema_mismatch',
        `Proof schema is not allowed: ${record.schema_name}`
      )
    }
    if (
      definition.proof.maxAgeMs !== null &&
      now.getTime() - record.created_at.getTime() > definition.proof.maxAgeMs
    ) {
      failProcessObligation('proof_stale', `Proof record is stale: ${record.record_id}`)
    }
  }
}

export async function validateProcessObligationEvidence(
  client: PoolClient,
  obligation: ProcessObligationV1,
  evidenceIds: string[]
): Promise<void> {
  const records = await proofRows(client, obligation.tenantId, obligation.missionId, evidenceIds)
  if (records.some((record) => record.record_kind !== 'evidence-item')) {
    failProcessObligation(
      'evidence_kind_mismatch',
      'Failure or waiver evidence must be evidence-item records'
    )
  }
}

export function validateProcessObligationWaiver(
  waiver: ProcessObligationWaiverV1,
  obligation: ProcessObligationV1,
  definition: ProcessObligationDefinitionV1,
  now: Date
): void {
  if (
    !definition.waiver.allowed ||
    waiver.obligationId !== obligation.id ||
    canonicalJson(waiver.definition) !== canonicalJson(obligation.definition) ||
    canonicalJson(waiver.scope) !== canonicalJson(obligation.scope) ||
    !definition.waiver.authorizedActorKinds.includes(
      waiver.authorizedBy.kind as 'system' | 'operator'
    ) ||
    (waiver.expiresAt !== null && Date.parse(waiver.expiresAt) <= now.getTime())
  ) {
    failProcessObligation(
      'waiver_not_authorized',
      'Process obligation waiver is not currently authorized'
    )
  }
  if (
    definition.waiver.maximumDurationMs !== null &&
    waiver.expiresAt !== null &&
    Date.parse(waiver.expiresAt) - Date.parse(waiver.issuedAt) > definition.waiver.maximumDurationMs
  ) {
    failProcessObligation(
      'waiver_duration_exceeded',
      'Process obligation waiver exceeds its maximum duration'
    )
  }
}

export async function assertProcessObligationSupersedingEvent(
  client: PoolClient,
  obligation: ProcessObligationV1,
  eventId: string
): Promise<void> {
  const result = await client.query(
    `SELECT 1 FROM control_plane.mission_events
     WHERE tenant_id = $1 AND mission_id = $2 AND event_id = $3`,
    [obligation.tenantId, obligation.missionId, eventId]
  )
  if (result.rowCount !== 1) {
    failProcessObligation(
      'superseding_event_missing',
      'Cancellation requires a current mission event'
    )
  }
}
