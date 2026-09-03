import { describe, expect, it } from 'vitest'
import {
  ProcessObligationBreachV1Schema,
  ProcessObligationDefinitionV1Schema,
  ProcessObligationV1Schema,
  ProcessObligationWaiverV1Schema
} from '../src/domain/process-obligation-contracts.js'
import { ProcessObligationTransitionV1Schema } from '../src/domain/process-obligation-transition-contracts.js'
import { PROCESS_OBLIGATION_CONTRACT_SAMPLES } from './process-obligation-contract-samples.js'

describe('process obligation contracts', () => {
  it('admits the definition, obligation, breach, and waiver samples', () => {
    expect(
      ProcessObligationDefinitionV1Schema.parse(
        PROCESS_OBLIGATION_CONTRACT_SAMPLES['process-obligation-definition.v1']
      ).definitionKey
    ).toBe('context-delivery-before-worker-start')
    expect(
      ProcessObligationV1Schema.parse(PROCESS_OBLIGATION_CONTRACT_SAMPLES['process-obligation.v1'])
        .state.status
    ).toBe('pending')
    expect(
      ProcessObligationBreachV1Schema.parse(
        PROCESS_OBLIGATION_CONTRACT_SAMPLES['process-obligation-breach.v1']
      ).response
    ).toBe('block')
    expect(
      ProcessObligationTransitionV1Schema.parse(
        PROCESS_OBLIGATION_CONTRACT_SAMPLES['process-obligation-transition.v1']
      ).transition
    ).toBe('satisfy')
    expect(
      ProcessObligationWaiverV1Schema.parse(
        PROCESS_OBLIGATION_CONTRACT_SAMPLES['process-obligation-waiver.v1']
      ).authorizedBy.kind
    ).toBe('system')
  })

  it('requires immutable definition lineage and coherent waiver policy', () => {
    const sample = PROCESS_OBLIGATION_CONTRACT_SAMPLES['process-obligation-definition.v1']
    expect(() =>
      ProcessObligationDefinitionV1Schema.parse({
        ...sample,
        version: 2,
        predecessorDefinitionId: null
      })
    ).toThrow('requires a predecessor')
    expect(() =>
      ProcessObligationDefinitionV1Schema.parse({
        ...sample,
        waiver: {
          allowed: false,
          authorizedActorKinds: ['operator'],
          evidenceRequired: true,
          maximumDurationMs: null
        }
      })
    ).toThrow('cannot name waiver authorities')
  })

  it('requires deadline and grace ordering', () => {
    const sample = PROCESS_OBLIGATION_CONTRACT_SAMPLES['process-obligation.v1']
    expect(() => ProcessObligationV1Schema.parse({ ...sample, dueAt: sample.openedAt })).toThrow(
      'deadline must follow'
    )
    expect(() =>
      ProcessObligationV1Schema.parse({ ...sample, graceUntil: sample.openedAt })
    ).toThrow('grace cannot end before')
  })

  it('admits late satisfaction without erasing breach identity', () => {
    const sample = PROCESS_OBLIGATION_CONTRACT_SAMPLES['process-obligation.v1']
    const obligation = ProcessObligationV1Schema.parse({
      ...sample,
      state: {
        status: 'satisfied',
        proofRecordIds: ['context_s1'],
        satisfiedAt: '2026-01-01T00:03:00.000Z'
      },
      breachId: 'obligation_breach_context_delivery_s1'
    })
    expect(obligation.state.status).toBe('satisfied')
    expect(obligation.breachId).toBe('obligation_breach_context_delivery_s1')
  })

  it('rejects breach observation before grace expires', () => {
    const sample = PROCESS_OBLIGATION_CONTRACT_SAMPLES['process-obligation-breach.v1']
    expect(() =>
      ProcessObligationBreachV1Schema.parse({
        ...sample,
        observedAt: '2026-01-01T00:01:59.999Z'
      })
    ).toThrow('precedes grace expiry')
  })

  it('requires product or operator waiver authority', () => {
    const sample = PROCESS_OBLIGATION_CONTRACT_SAMPLES['process-obligation-waiver.v1']
    expect(() =>
      ProcessObligationWaiverV1Schema.parse({
        ...sample,
        authorizedBy: { kind: 'specialist', id: 'agent_s1', version: '1' }
      })
    ).toThrow('requires system or operator authority')
  })
})
