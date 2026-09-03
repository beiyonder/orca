import { describe, expect, it } from 'vitest'
import {
  ProcessObligationTransitionError,
  attachProcessObligationBreach,
  settleProcessObligationState
} from '../src/process-obligation-transition.js'
import { PROCESS_OBLIGATION_CONTRACT_SAMPLES } from './process-obligation-contract-samples.js'

const obligation = PROCESS_OBLIGATION_CONTRACT_SAMPLES['process-obligation.v1']
const settledAt = '2026-01-01T00:03:00.000Z'

describe('process obligation transitions', () => {
  it('satisfies pending work with authoritative proof while preserving breach history', () => {
    const breached = attachProcessObligationBreach(
      obligation,
      'obligation_breach_context_delivery_s1'
    )
    const settled = settleProcessObligationState(
      breached,
      { kind: 'satisfy', proofRecordIds: ['context_s1'] },
      settledAt
    )
    expect(settled.state).toEqual({
      status: 'satisfied',
      proofRecordIds: ['context_s1'],
      satisfiedAt: settledAt
    })
    expect(settled.breachId).toBe('obligation_breach_context_delivery_s1')
  })

  it('supports explicit failure, waiver, and cancellation terminals', () => {
    expect(
      settleProcessObligationState(
        obligation,
        { kind: 'fail', failureCode: 'proof-unavailable', evidenceIds: ['evidence_s1'] },
        settledAt
      ).state.status
    ).toBe('failed')
    expect(
      settleProcessObligationState(
        obligation,
        { kind: 'waive', waiverId: 'obligation_waiver_context_delivery_s1' },
        settledAt
      ).state.status
    ).toBe('waived')
    expect(
      settleProcessObligationState(
        obligation,
        {
          kind: 'cancel',
          supersedingEventId: 'event_obligation_superseded_s1',
          reason: 'Plan revision removed the requirement.'
        },
        settledAt
      ).state.status
    ).toBe('cancelled')
  })

  it('rejects terminal replay and conflicting breach identity', () => {
    const settled = settleProcessObligationState(
      obligation,
      { kind: 'satisfy', proofRecordIds: ['context_s1'] },
      settledAt
    )
    expect(() =>
      settleProcessObligationState(
        settled,
        { kind: 'satisfy', proofRecordIds: ['context_s1'] },
        settledAt
      )
    ).toThrow(ProcessObligationTransitionError)
    const breached = attachProcessObligationBreach(
      obligation,
      'obligation_breach_context_delivery_s1'
    )
    expect(() => attachProcessObligationBreach(breached, 'obligation_breach_other_s1')).toThrow(
      'another breach'
    )
  })
})
