import type { Pool, PoolClient } from 'pg'
import { canonicalJson, sha256Text } from '../canonical-json.js'
import {
  ProcessObligationV1Schema,
  type ProcessObligationV1
} from '../domain/process-obligation-contracts.js'
import {
  ProcessObligationTransitionV1Schema,
  type ProcessObligationTransitionV1
} from '../domain/process-obligation-transition-contracts.js'
import {
  attachProcessObligationBreach,
  settleProcessObligationState,
  type ProcessObligationSettlement
} from '../process-obligation-transition.js'
import { failProcessObligation } from './postgres-process-obligation-errors.js'
import { withPostgresTransaction } from './postgres-transaction.js'

export type ProcessObligationReplayResult = {
  obligationCount: number
  projectionDigest: string
}

export type ProcessObligationRestartResult = {
  expiredClaimsCleared: number
  overduePending: number
  activePending: number
  terminal: number
}

type PayloadRow = {
  payload: unknown
}

function settlementFromTransition(
  transition: ProcessObligationTransitionV1
): ProcessObligationSettlement {
  switch (transition.transition) {
    case 'satisfy':
      return { kind: 'satisfy', proofRecordIds: transition.proofRecordIds }
    case 'fail':
      return {
        kind: 'fail',
        failureCode: transition.failureCode!,
        evidenceIds: transition.evidenceIds
      }
    case 'waive':
      return { kind: 'waive', waiverId: transition.waiverId! }
    case 'cancel':
      return {
        kind: 'cancel',
        supersedingEventId: transition.supersedingEventId!,
        reason: transition.rationale
      }
    case 'breach':
      throw new TypeError('Breach transition is not a terminal settlement')
  }
}

function replayOne(
  current: ProcessObligationV1,
  transitions: ProcessObligationTransitionV1[]
): ProcessObligationV1 {
  let rebuilt = ProcessObligationV1Schema.parse({
    ...current,
    state: { status: 'pending' },
    breachId: null
  })
  for (const transition of transitions) {
    if (
      transition.obligationId !== current.id ||
      canonicalJson(transition.definition) !== canonicalJson(current.definition) ||
      canonicalJson(transition.scope) !== canonicalJson(current.scope) ||
      transition.fence !== current.currentFence
    ) {
      failProcessObligation(
        'transition_binding_mismatch',
        `Obligation transition does not bind ${current.id}`
      )
    }
    rebuilt =
      transition.transition === 'breach'
        ? attachProcessObligationBreach(rebuilt, transition.breachId!)
        : settleProcessObligationState(
            rebuilt,
            settlementFromTransition(transition),
            transition.transitionedAt
          )
  }
  if (canonicalJson(rebuilt) !== canonicalJson(current)) {
    failProcessObligation(
      'obligation_replay_mismatch',
      `Obligation history does not reconstruct ${current.id}`
    )
  }
  return rebuilt
}

async function insertProjection(
  client: PoolClient,
  obligation: ProcessObligationV1
): Promise<void> {
  const obligationJson = canonicalJson(obligation)
  const terminalAt =
    obligation.state.status === 'satisfied'
      ? obligation.state.satisfiedAt
      : obligation.state.status === 'failed'
        ? obligation.state.failedAt
        : obligation.state.status === 'waived'
          ? obligation.state.waivedAt
          : obligation.state.status === 'cancelled'
            ? obligation.state.cancelledAt
            : null
  await client.query(
    `INSERT INTO control_plane.process_obligations (
       tenant_id, mission_id, obligation_id, definition_id, definition_version,
       definition_digest, scope_kind, scope_id, subject_version, trigger_event_id,
       trigger_event_position, obligation_state, opened_at, due_at, grace_until,
       proof_record_ids, breach_id, current_fence, obligation, obligation_sha256,
       terminal_at, created_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
       $16::jsonb, $17, $18, $19::jsonb, $20, $21, $22
     )`,
    [
      obligation.tenantId,
      obligation.missionId,
      obligation.id,
      obligation.definition.id,
      obligation.definition.version,
      obligation.definition.digest,
      obligation.scope.kind,
      obligation.scope.id,
      obligation.scope.subjectVersion,
      obligation.trigger.eventId,
      obligation.trigger.eventPosition,
      obligation.state.status,
      obligation.openedAt,
      obligation.dueAt,
      obligation.graceUntil,
      obligation.state.status === 'satisfied'
        ? canonicalJson(obligation.state.proofRecordIds)
        : '[]',
      obligation.breachId,
      obligation.currentFence,
      obligationJson,
      sha256Text(obligationJson),
      terminalAt,
      obligation.createdAt
    ]
  )
}

export async function rebuildProcessObligationProjection(
  pool: Pool,
  tenantId: string,
  missionId: string
): Promise<ProcessObligationReplayResult> {
  return withPostgresTransaction(pool, async (client) => {
    const obligationRows = await client.query<PayloadRow>(
      `SELECT payload FROM control_plane.domain_records
       WHERE tenant_id = $1 AND mission_id = $2
         AND schema_name = 'process-obligation.v1'
       ORDER BY record_id`,
      [tenantId, missionId]
    )
    const transitionRows = await client.query<PayloadRow>(
      `SELECT payload FROM control_plane.domain_records
       WHERE tenant_id = $1 AND mission_id = $2
         AND schema_name = 'process-obligation-transition.v1'
       ORDER BY created_at, record_id`,
      [tenantId, missionId]
    )
    const transitions = transitionRows.rows.map((row) =>
      ProcessObligationTransitionV1Schema.parse(row.payload)
    )
    const obligations = obligationRows.rows.map((row) => {
      const current = ProcessObligationV1Schema.parse(row.payload)
      return replayOne(
        current,
        transitions.filter((transition) => transition.obligationId === current.id)
      )
    })
    await client.query(
      `DELETE FROM control_plane.process_obligations
       WHERE tenant_id = $1 AND mission_id = $2`,
      [tenantId, missionId]
    )
    for (const obligation of obligations) {
      await insertProjection(client, obligation)
    }
    return {
      obligationCount: obligations.length,
      projectionDigest: sha256Text(canonicalJson(obligations))
    }
  })
}

export async function reconcileProcessObligationsOnRestart(
  pool: Pool,
  tenantId: string,
  missionId: string
): Promise<ProcessObligationRestartResult> {
  return withPostgresTransaction(pool, async (client) => {
    const cleared = await client.query(
      `UPDATE control_plane.process_obligations
       SET monitor_claimed_by = NULL,
           monitor_claim_id = NULL,
           monitor_claimed_at = NULL,
           monitor_claim_expires_at = NULL,
           updated_at = transaction_timestamp()
       WHERE tenant_id = $1 AND mission_id = $2
         AND obligation_state = 'pending'
         AND monitor_claim_expires_at <= transaction_timestamp()`,
      [tenantId, missionId]
    )
    const counts = await client.query<{
      overdue_pending: number
      active_pending: number
      terminal: number
    }>(
      `SELECT
         count(*) FILTER (
           WHERE obligation_state = 'pending'
             AND grace_until <= transaction_timestamp()
         )::int AS overdue_pending,
         count(*) FILTER (
           WHERE obligation_state = 'pending'
             AND grace_until > transaction_timestamp()
         )::int AS active_pending,
         count(*) FILTER (WHERE obligation_state <> 'pending')::int AS terminal
       FROM control_plane.process_obligations
       WHERE tenant_id = $1 AND mission_id = $2`,
      [tenantId, missionId]
    )
    return {
      expiredClaimsCleared: cleared.rowCount ?? 0,
      overduePending: counts.rows[0]?.overdue_pending ?? 0,
      activePending: counts.rows[0]?.active_pending ?? 0,
      terminal: counts.rows[0]?.terminal ?? 0
    }
  })
}
