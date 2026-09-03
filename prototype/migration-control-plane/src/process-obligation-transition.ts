import {
  ProcessObligationV1Schema,
  type ProcessObligationV1
} from './domain/process-obligation-contracts.js'

export type ProcessObligationSettlement =
  | { kind: 'satisfy'; proofRecordIds: string[] }
  | { kind: 'fail'; failureCode: string; evidenceIds: string[] }
  | { kind: 'waive'; waiverId: string }
  | { kind: 'cancel'; supersedingEventId: string; reason: string }

export class ProcessObligationTransitionError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ProcessObligationTransitionError'
    this.code = code
  }
}

function assertPending(obligation: ProcessObligationV1): void {
  if (obligation.state.status !== 'pending') {
    throw new ProcessObligationTransitionError(
      'obligation_not_pending',
      `Process obligation is already ${obligation.state.status}`
    )
  }
}

export function settleProcessObligationState(
  currentInput: unknown,
  settlement: ProcessObligationSettlement,
  settledAt: string
): ProcessObligationV1 {
  const current = ProcessObligationV1Schema.parse(currentInput)
  assertPending(current)
  if (
    !Number.isFinite(Date.parse(settledAt)) ||
    Date.parse(settledAt) < Date.parse(current.openedAt)
  ) {
    throw new ProcessObligationTransitionError(
      'invalid_settlement_time',
      'Obligation settlement time precedes opening or is invalid'
    )
  }
  let state: unknown
  switch (settlement.kind) {
    case 'satisfy':
      state = {
        status: 'satisfied',
        proofRecordIds: settlement.proofRecordIds,
        satisfiedAt: settledAt
      }
      break
    case 'fail':
      state = {
        status: 'failed',
        failureCode: settlement.failureCode,
        evidenceIds: settlement.evidenceIds,
        failedAt: settledAt
      }
      break
    case 'waive':
      state = { status: 'waived', waiverId: settlement.waiverId, waivedAt: settledAt }
      break
    case 'cancel':
      state = {
        status: 'cancelled',
        supersedingEventId: settlement.supersedingEventId,
        reason: settlement.reason,
        cancelledAt: settledAt
      }
      break
  }
  return ProcessObligationV1Schema.parse({ ...current, state })
}

export function attachProcessObligationBreach(
  currentInput: unknown,
  breachId: string
): ProcessObligationV1 {
  const current = ProcessObligationV1Schema.parse(currentInput)
  assertPending(current)
  if (current.breachId !== null && current.breachId !== breachId) {
    throw new ProcessObligationTransitionError(
      'breach_identity_conflict',
      'Process obligation already references another breach'
    )
  }
  return ProcessObligationV1Schema.parse({ ...current, breachId })
}
