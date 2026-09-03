import type { Pool } from 'pg'
import { canonicalJson, sha256Text } from '../canonical-json.js'
import { ActorSchema } from '../domain/common-contracts.js'
import { ProcessObligationBreachV1Schema } from '../domain/process-obligation-contracts.js'
import { ProcessObligationTransitionV1Schema } from '../domain/process-obligation-transition-contracts.js'
import { attachProcessObligationBreach } from '../process-obligation-transition.js'
import { insertPostgresDomainRecords } from './postgres-domain-record-store.js'
import {
  loadCommittedProcessObligationBreach,
  loadProcessObligationBreachAuthority,
  loadProcessObligationBreachDefinition,
  processObligationBreachIdentities,
  type ProcessObligationBreachCommit
} from './postgres-process-obligation-breach-authority.js'
import { failProcessObligation } from './postgres-process-obligation-errors.js'
import {
  claimDueProcessObligations,
  markProcessObligationSweepSucceeded,
  type ClaimDueProcessObligationsInput,
  type ProcessObligationMonitorClaim
} from './postgres-process-obligation-monitor.js'
import { withPostgresTransaction } from './postgres-transaction.js'

export async function recordProcessObligationBreach(
  pool: Pool,
  claim: ProcessObligationMonitorClaim,
  selectedBy: unknown
): Promise<ProcessObligationBreachCommit> {
  const ids = processObligationBreachIdentities(claim)
  return withPostgresTransaction(pool, async (client) => {
    const { row, obligation } = await loadProcessObligationBreachAuthority(client, claim)
    if (row.breach_id !== null) {
      if (row.breach_id !== ids.breachId) {
        failProcessObligation(
          'breach_identity_mismatch',
          'Process obligation breach identity changed'
        )
      }
      return loadCommittedProcessObligationBreach(client, claim, ids.breachId, ids.messageId)
    }
    const clock = await client.query<{ now: Date }>('SELECT transaction_timestamp() AS now')
    const now = clock.rows[0]!.now
    if (
      obligation.state.status !== 'pending' ||
      row.monitor_claimed_by !== claim.ownerId ||
      row.monitor_claim_id !== claim.claimId ||
      Number(row.monitor_claim_fence) !== claim.monitorFence ||
      row.monitor_claim_expires_at === null ||
      row.monitor_claim_expires_at <= now
    ) {
      failProcessObligation('monitor_claim_stale', 'Process obligation monitor claim is stale')
    }
    const definition = await loadProcessObligationBreachDefinition(client, obligation)
    const actor = ActorSchema.parse(selectedBy)
    const observedAt = now.toISOString()
    const breach = ProcessObligationBreachV1Schema.parse({
      schemaVersion: 1,
      kind: 'process-obligation-breach',
      id: ids.breachId,
      tenantId: obligation.tenantId,
      missionId: obligation.missionId,
      createdAt: observedAt,
      obligationId: obligation.id,
      definition: obligation.definition,
      scope: obligation.scope,
      dueAt: obligation.dueAt,
      graceUntil: obligation.graceUntil,
      observedAt,
      reasonCodes: ['grace-expired', 'required-proof-missing'],
      missingProofKinds: definition.proof.recordKinds,
      invalidProofRecordIds: [],
      monitor: { ownerId: claim.ownerId, claimId: claim.claimId, fence: claim.monitorFence },
      severity: definition.severity,
      response: definition.breachAction,
      selectedBy: actor,
      resolutionRecordId: null,
      detectedAt: observedAt
    })
    const next = attachProcessObligationBreach(obligation, breach.id)
    const transition = ProcessObligationTransitionV1Schema.parse({
      schemaVersion: 1,
      kind: 'process-obligation-transition',
      id: ids.transitionId,
      tenantId: obligation.tenantId,
      missionId: obligation.missionId,
      createdAt: observedAt,
      obligationId: obligation.id,
      definition: obligation.definition,
      scope: obligation.scope,
      transition: 'breach',
      fromState: 'pending',
      toState: 'pending',
      proofRecordIds: [],
      evidenceIds: [],
      failureCode: null,
      waiverId: null,
      breachId: breach.id,
      supersedingEventId: null,
      rationale: 'Process obligation grace expired without admitted proof.',
      fence: obligation.currentFence,
      transitionedAt: observedAt,
      transitionedBy: actor
    })
    await insertPostgresDomainRecords(client, [
      {
        tenantId: breach.tenantId,
        recordId: breach.id,
        missionId: breach.missionId,
        schemaName: 'process-obligation-breach.v1',
        recordKind: 'process-obligation-breach',
        recordState: breach.response,
        payload: breach,
        createdAt: breach.createdAt
      },
      {
        tenantId: transition.tenantId,
        recordId: transition.id,
        missionId: transition.missionId,
        schemaName: 'process-obligation-transition.v1',
        recordKind: 'process-obligation-transition',
        recordState: 'breach',
        payload: transition,
        createdAt: transition.createdAt
      }
    ])
    const nextJson = canonicalJson(next)
    const update = await client.query(
      `UPDATE control_plane.process_obligations
       SET breach_id = $3, obligation = $4::jsonb, obligation_sha256 = $5,
           monitor_claimed_by = NULL, monitor_claim_id = NULL,
           monitor_claimed_at = NULL, monitor_claim_expires_at = NULL,
           updated_at = transaction_timestamp()
       WHERE tenant_id = $1 AND obligation_id = $2
         AND obligation_state = 'pending' AND breach_id IS NULL
         AND monitor_claimed_by = $6 AND monitor_claim_id = $7
         AND monitor_claim_fence = $8 AND monitor_claim_expires_at > $9`,
      [
        obligation.tenantId,
        obligation.id,
        breach.id,
        nextJson,
        sha256Text(nextJson),
        claim.ownerId,
        claim.claimId,
        claim.monitorFence,
        now
      ]
    )
    if (update.rowCount !== 1) {
      failProcessObligation(
        'monitor_claim_stale',
        'Process obligation changed before breach commit'
      )
    }
    await client.query(
      `UPDATE control_plane.domain_records
       SET payload = $4::jsonb, payload_sha256 = $5,
           updated_at = transaction_timestamp()
       WHERE tenant_id = $1 AND mission_id = $2 AND record_id = $3
         AND schema_name = 'process-obligation.v1'`,
      [obligation.tenantId, obligation.missionId, obligation.id, nextJson, sha256Text(nextJson)]
    )
    const responseTopic = `process-obligation.response.${definition.breachAction}`
    const responsePayload = {
      schemaVersion: 1,
      kind: 'process-obligation-response',
      tenantId: obligation.tenantId,
      missionId: obligation.missionId,
      obligationId: obligation.id,
      breachId: breach.id,
      response: definition.breachAction,
      requestedAt: observedAt
    }
    const responseJson = canonicalJson(responsePayload)
    await client.query(
      `INSERT INTO control_plane.outbox_messages (
         tenant_id, message_id, mission_id, event_id, topic, message_key,
         payload, payload_sha256, available_at, created_at
       ) VALUES ($1, $2, $3, NULL, $4, $5, $6::jsonb, $7, $8, $8)`,
      [
        obligation.tenantId,
        ids.messageId,
        obligation.missionId,
        responseTopic,
        obligation.id,
        responseJson,
        sha256Text(responseJson),
        now
      ]
    )
    return { breach, responseMessageId: ids.messageId, responseTopic, committed: true }
  })
}

export type { ProcessObligationBreachCommit }

export async function runProcessObligationMonitorSweep(
  pool: Pool,
  input: ClaimDueProcessObligationsInput & { selectedBy: unknown }
): Promise<{ claims: number; breaches: ProcessObligationBreachCommit[] }> {
  const { selectedBy, ...claimInput } = input
  const claimed = await claimDueProcessObligations(pool, claimInput)
  const breaches: ProcessObligationBreachCommit[] = []
  for (const claim of claimed.claims) {
    breaches.push(await recordProcessObligationBreach(pool, claim, selectedBy))
  }
  await markProcessObligationSweepSucceeded(
    pool,
    claimInput.tenantId,
    claimed.startedAt,
    breaches.length
  )
  return { claims: claimed.claims.length, breaches }
}
