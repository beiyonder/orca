import type { Pool, PoolClient } from 'pg'
import { canonicalJson, sha256Text } from '../canonical-json.js'
import { ActorSchema } from '../domain/common-contracts.js'
import {
  ProcessObligationDefinitionV1Schema,
  ProcessObligationV1Schema,
  ProcessObligationWaiverV1Schema,
  type ProcessObligationDefinitionV1,
  type ProcessObligationV1,
  type ProcessObligationWaiverV1
} from '../domain/process-obligation-contracts.js'
import { ProcessObligationTransitionV1Schema } from '../domain/process-obligation-transition-contracts.js'
import {
  settleProcessObligationState,
  type ProcessObligationSettlement
} from '../process-obligation-transition.js'
import { failProcessObligation } from './postgres-process-obligation-errors.js'
import {
  assertProcessObligationSupersedingEvent,
  validateProcessObligationEvidence,
  validateProcessObligationSatisfactionProof,
  validateProcessObligationWaiver
} from './postgres-process-obligation-proof.js'
import { insertPostgresDomainRecords } from './postgres-domain-record-store.js'
import { withPostgresTransaction } from './postgres-transaction.js'

export type PostgresProcessObligationSettlement =
  | { kind: 'satisfy'; proofRecordIds: string[] }
  | { kind: 'fail'; failureCode: string; evidenceIds: string[] }
  | { kind: 'waive'; waiver: unknown }
  | { kind: 'cancel'; supersedingEventId: string; reason: string }

export type SettlePostgresProcessObligationInput = {
  tenantId: string
  missionId: string
  obligationId: string
  expectedFence: number
  transitionId: string
  rationale: string
  transitionedBy: unknown
  settlement: PostgresProcessObligationSettlement
}

type ObligationRow = {
  obligation: unknown
  current_fence: string
}

type DefinitionRow = {
  definition: unknown
  definition_sha256: string
}

async function loadAuthority(
  client: PoolClient,
  input: SettlePostgresProcessObligationInput
): Promise<{ obligation: ProcessObligationV1; definition: ProcessObligationDefinitionV1 }> {
  const obligationResult = await client.query<ObligationRow>(
    `SELECT obligation, current_fence::text
     FROM control_plane.process_obligations
     WHERE tenant_id = $1 AND mission_id = $2 AND obligation_id = $3
     FOR UPDATE`,
    [input.tenantId, input.missionId, input.obligationId]
  )
  const row = obligationResult.rows[0]
  if (!row || Number(row.current_fence) !== input.expectedFence) {
    failProcessObligation('stale_obligation_fence', 'Process obligation is missing or stale')
  }
  const obligation = ProcessObligationV1Schema.parse(row.obligation)
  const definitionResult = await client.query<DefinitionRow>(
    `SELECT definition, definition_sha256
     FROM control_plane.process_obligation_definitions
     WHERE tenant_id = $1 AND definition_id = $2`,
    [input.tenantId, obligation.definition.id]
  )
  const definitionRow = definitionResult.rows[0]
  if (!definitionRow) {
    failProcessObligation('definition_missing', 'Process obligation definition is missing')
  }
  const definition = ProcessObligationDefinitionV1Schema.parse(definitionRow.definition)
  if (
    definition.version !== obligation.definition.version ||
    definitionRow.definition_sha256 !== obligation.definition.digest ||
    sha256Text(canonicalJson(definition)) !== obligation.definition.digest
  ) {
    failProcessObligation('definition_mismatch', 'Process obligation definition identity changed')
  }
  return { obligation, definition }
}

function stateSettlement(
  settlement: PostgresProcessObligationSettlement,
  waiver: ProcessObligationWaiverV1 | null
): ProcessObligationSettlement {
  if (settlement.kind === 'waive') {
    return { kind: 'waive', waiverId: waiver!.id }
  }
  return settlement
}

export async function settlePostgresProcessObligation(
  pool: Pool,
  input: SettlePostgresProcessObligationInput
): Promise<ProcessObligationV1> {
  return withPostgresTransaction(pool, async (client) => {
    const { obligation, definition } = await loadAuthority(client, input)
    const clock = await client.query<{ now: Date }>('SELECT transaction_timestamp() AS now')
    const now = clock.rows[0]!.now
    const transitionedBy = ActorSchema.parse(input.transitionedBy)
    let waiver: ProcessObligationWaiverV1 | null = null
    if (input.settlement.kind === 'satisfy') {
      await validateProcessObligationSatisfactionProof(
        client,
        obligation,
        definition,
        input.settlement.proofRecordIds,
        now
      )
    } else if (input.settlement.kind === 'fail') {
      await validateProcessObligationEvidence(client, obligation, input.settlement.evidenceIds)
    } else if (input.settlement.kind === 'waive') {
      waiver = ProcessObligationWaiverV1Schema.parse(input.settlement.waiver)
      validateProcessObligationWaiver(waiver, obligation, definition, now)
      await validateProcessObligationEvidence(client, obligation, waiver.evidenceIds)
      await insertPostgresDomainRecords(client, [
        {
          tenantId: waiver.tenantId,
          recordId: waiver.id,
          missionId: waiver.missionId,
          schemaName: 'process-obligation-waiver.v1',
          recordKind: 'process-obligation-waiver',
          recordState: 'active',
          payload: waiver,
          createdAt: waiver.createdAt
        }
      ])
    } else {
      await assertProcessObligationSupersedingEvent(
        client,
        obligation,
        input.settlement.supersedingEventId
      )
    }
    const next = settleProcessObligationState(
      obligation,
      stateSettlement(input.settlement, waiver),
      now.toISOString()
    )
    const transition = ProcessObligationTransitionV1Schema.parse({
      schemaVersion: 1,
      kind: 'process-obligation-transition',
      id: input.transitionId,
      tenantId: obligation.tenantId,
      missionId: obligation.missionId,
      createdAt: now.toISOString(),
      obligationId: obligation.id,
      definition: obligation.definition,
      scope: obligation.scope,
      transition: input.settlement.kind,
      fromState: 'pending',
      toState: next.state.status,
      proofRecordIds: input.settlement.kind === 'satisfy' ? input.settlement.proofRecordIds : [],
      evidenceIds:
        input.settlement.kind === 'fail'
          ? input.settlement.evidenceIds
          : (waiver?.evidenceIds ?? []),
      failureCode: input.settlement.kind === 'fail' ? input.settlement.failureCode : null,
      waiverId: waiver?.id ?? null,
      breachId: null,
      supersedingEventId:
        input.settlement.kind === 'cancel' ? input.settlement.supersedingEventId : null,
      rationale: input.rationale,
      fence: input.expectedFence,
      transitionedAt: now.toISOString(),
      transitionedBy
    })
    await insertPostgresDomainRecords(client, [
      {
        tenantId: transition.tenantId,
        recordId: transition.id,
        missionId: transition.missionId,
        schemaName: 'process-obligation-transition.v1',
        recordKind: 'process-obligation-transition',
        recordState: transition.transition,
        payload: transition,
        createdAt: transition.createdAt
      }
    ])
    const nextJson = canonicalJson(next)
    const update = await client.query(
      `UPDATE control_plane.process_obligations
       SET obligation_state = $4,
           proof_record_ids = $5::jsonb,
           obligation = $6::jsonb,
           obligation_sha256 = $7,
           terminal_at = $8,
           monitor_claimed_by = NULL,
           monitor_claim_id = NULL,
           monitor_claim_expires_at = NULL,
           updated_at = transaction_timestamp()
       WHERE tenant_id = $1 AND mission_id = $2 AND obligation_id = $3
         AND current_fence = $9 AND obligation_state = 'pending'`,
      [
        next.tenantId,
        next.missionId,
        next.id,
        next.state.status,
        next.state.status === 'satisfied' ? canonicalJson(next.state.proofRecordIds) : '[]',
        nextJson,
        sha256Text(nextJson),
        now,
        input.expectedFence
      ]
    )
    if (update.rowCount !== 1) {
      failProcessObligation(
        'stale_obligation_fence',
        'Process obligation changed before settlement'
      )
    }
    await client.query(
      `UPDATE control_plane.domain_records
       SET record_state = $4, payload = $5::jsonb, payload_sha256 = $6,
           updated_at = transaction_timestamp()
       WHERE tenant_id = $1 AND mission_id = $2 AND record_id = $3
         AND schema_name = 'process-obligation.v1'`,
      [next.tenantId, next.missionId, next.id, next.state.status, nextJson, sha256Text(nextJson)]
    )
    return next
  })
}
