import type { PoolClient } from 'pg'
import { canonicalJson, sha256Text } from '../canonical-json.js'
import {
  ProcessObligationBreachV1Schema,
  ProcessObligationDefinitionV1Schema,
  ProcessObligationV1Schema,
  type ProcessObligationBreachV1,
  type ProcessObligationDefinitionV1,
  type ProcessObligationV1
} from '../domain/process-obligation-contracts.js'
import { failProcessObligation } from './postgres-process-obligation-errors.js'
import type { ProcessObligationMonitorClaim } from './postgres-process-obligation-monitor.js'

export type ProcessObligationBreachCommit = {
  breach: ProcessObligationBreachV1
  responseMessageId: string
  responseTopic: string
  committed: boolean
}

export type ProcessObligationBreachAuthority = {
  row: {
    breach_id: string | null
    monitor_claimed_by: string | null
    monitor_claim_id: string | null
    monitor_claim_expires_at: Date | null
    monitor_claim_fence: string
  }
  obligation: ProcessObligationV1
}

type ObligationRow = ProcessObligationBreachAuthority['row'] & {
  mission_id: string
  obligation: unknown
  obligation_sha256: string
  current_fence: string
}

type DefinitionRow = {
  definition: unknown
  definition_sha256: string
}

type StoredRecordRow = {
  payload: unknown
  payload_sha256: string
}

type StoredOutboxRow = {
  topic: string
  message_key: string
}

function stableIdentity(prefix: string, input: unknown): string {
  return `${prefix}_${sha256Text(canonicalJson(input)).slice(0, 32)}`
}

export function processObligationBreachIdentities(claim: ProcessObligationMonitorClaim) {
  const breachId = stableIdentity('obligation_breach', {
    tenantId: claim.tenantId,
    obligationId: claim.obligationId,
    generation: 1
  })
  return {
    breachId,
    transitionId: stableIdentity('obligation_transition', { breachId }),
    messageId: stableIdentity('message_obligation_response', { breachId })
  }
}

export async function loadProcessObligationBreachAuthority(
  client: PoolClient,
  claim: ProcessObligationMonitorClaim
): Promise<ProcessObligationBreachAuthority> {
  const result = await client.query<ObligationRow>(
    `SELECT mission_id, obligation, trim(obligation_sha256) AS obligation_sha256,
            current_fence::text, breach_id, monitor_claimed_by, monitor_claim_id,
            monitor_claim_expires_at, monitor_claim_fence::text
     FROM control_plane.process_obligations
     WHERE tenant_id = $1 AND obligation_id = $2
     FOR UPDATE`,
    [claim.tenantId, claim.obligationId]
  )
  const row = result.rows[0]
  if (!row) {
    failProcessObligation('obligation_missing', 'Process obligation is missing')
  }
  const obligation = ProcessObligationV1Schema.parse(row.obligation)
  if (
    obligation.tenantId !== claim.tenantId ||
    obligation.missionId !== claim.missionId ||
    obligation.id !== claim.obligationId ||
    obligation.currentFence !== Number(row.current_fence) ||
    row.mission_id !== claim.missionId ||
    row.obligation_sha256 !== sha256Text(canonicalJson(obligation))
  ) {
    failProcessObligation(
      'obligation_projection_mismatch',
      `Process obligation projection differs for ${claim.obligationId}`
    )
  }
  return { row, obligation }
}

export async function loadProcessObligationBreachDefinition(
  client: PoolClient,
  obligation: ProcessObligationV1
): Promise<ProcessObligationDefinitionV1> {
  const result = await client.query<DefinitionRow>(
    `SELECT definition, trim(definition_sha256) AS definition_sha256
     FROM control_plane.process_obligation_definitions
     WHERE tenant_id = $1 AND definition_id = $2`,
    [obligation.tenantId, obligation.definition.id]
  )
  const row = result.rows[0]
  if (!row) {
    failProcessObligation('definition_missing', 'Process obligation definition is missing')
  }
  const definition = ProcessObligationDefinitionV1Schema.parse(row.definition)
  if (
    obligation.definition.version !== definition.version ||
    obligation.definition.digest !== row.definition_sha256 ||
    obligation.definition.digest !== sha256Text(canonicalJson(definition))
  ) {
    failProcessObligation('definition_mismatch', 'Process obligation definition identity changed')
  }
  return definition
}

export async function loadCommittedProcessObligationBreach(
  client: PoolClient,
  claim: ProcessObligationMonitorClaim,
  breachId: string,
  messageId: string
): Promise<ProcessObligationBreachCommit> {
  const record = await client.query<StoredRecordRow>(
    `SELECT payload, trim(payload_sha256) AS payload_sha256
     FROM control_plane.domain_records
     WHERE tenant_id = $1 AND mission_id = $2 AND record_id = $3
       AND schema_name = 'process-obligation-breach.v1'`,
    [claim.tenantId, claim.missionId, breachId]
  )
  const row = record.rows[0]
  if (!row) {
    failProcessObligation('breach_record_missing', 'Committed process obligation breach is missing')
  }
  const breach = ProcessObligationBreachV1Schema.parse(row.payload)
  if (
    breach.obligationId !== claim.obligationId ||
    breach.id !== breachId ||
    sha256Text(canonicalJson(breach)) !== row.payload_sha256
  ) {
    failProcessObligation('breach_identity_mismatch', 'Committed breach identity changed')
  }
  const outbox = await client.query<StoredOutboxRow>(
    `SELECT topic, message_key
     FROM control_plane.outbox_messages
     WHERE tenant_id = $1 AND message_id = $2`,
    [claim.tenantId, messageId]
  )
  const message = outbox.rows[0]
  const topic = `process-obligation.response.${breach.response}`
  if (!message || message.topic !== topic || message.message_key !== claim.obligationId) {
    failProcessObligation('breach_response_missing', 'Committed breach response is missing')
  }
  return { breach, responseMessageId: messageId, responseTopic: topic, committed: false }
}
