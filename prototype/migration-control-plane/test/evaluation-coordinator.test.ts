import { describe, expect, it } from 'vitest'
import { coordinateEvaluationDispatch } from '../src/evaluation-dispatch-coordinator.js'
import { reconcileEvaluationCoordination } from '../src/evaluation-result-coordinator.js'
import {
  COORDINATOR_CONTRACT,
  COORDINATOR_DEFINITIONS,
  buildEvaluationDispatch,
  buildEvaluationDispatchInput,
  buildEvaluationResult
} from './evaluation-coordinator-fixture.js'

const observedBy = { kind: 'system', id: 'evaluation-coordinator', version: '1' }

function reconcile(
  plan: ReturnType<typeof buildEvaluationDispatch>,
  results: readonly unknown[],
  observedAt: string,
  snapshots: readonly unknown[] = [plan.coordination]
) {
  return reconcileEvaluationCoordination({
    snapshots,
    definitions: COORDINATOR_DEFINITIONS,
    contract: COORDINATOR_CONTRACT,
    assignments: plan.assignments,
    results,
    observedAt,
    observedBy
  })
}

describe('independent evaluation coordinator', () => {
  it('creates one exact non-authoritative assignment and dispatch per required evaluator', () => {
    const plan = buildEvaluationDispatch()
    expect(plan.assignments).toHaveLength(2)
    expect(new Set(plan.assignments.map((assignment) => assignment.id)).size).toBe(2)
    expect(new Set(plan.messages.map((message) => message.messageId)).size).toBe(2)
    expect(plan.coordination).toMatchObject({
      version: 1,
      outcome: 'pending',
      unresolvedReasons: [],
      acceptanceDisposition: 'unaccepted',
      unrelatedWorkDisposition: 'continue',
      acceptanceAuthority: 'none'
    })
    expect(plan.assignments.every((assignment) => assignment.acceptanceAuthority === 'none')).toBe(
      true
    )
    expect(
      plan.assignments.every(
        (assignment) =>
          assignment.producer.processIdentity !== assignment.evaluatorExecution.processIdentity &&
          assignment.producer.contextDigest !== assignment.evaluatorExecution.contextDigest
      )
    ).toBe(true)
  })

  it('rejects duplicate definitions, incomplete runner coverage, and shared producer process', () => {
    const missing = buildEvaluationDispatchInput()
    missing.runners.splice(1, 1)
    expect(() => coordinateEvaluationDispatch(missing)).toThrow(
      expect.objectContaining({ code: 'runner_coverage_mismatch' })
    )

    const duplicateBase = buildEvaluationDispatchInput()
    const duplicate = {
      ...duplicateBase,
      evaluatorDefinitions: [
        ...duplicateBase.evaluatorDefinitions,
        duplicateBase.evaluatorDefinitions[0]!
      ]
    }
    expect(() => coordinateEvaluationDispatch(duplicate)).toThrow(
      expect.objectContaining({ code: 'invalid_dispatch' })
    )

    const sharedProcess = buildEvaluationDispatchInput()
    sharedProcess.runners[0]!.execution.processIdentity = sharedProcess.producer.processIdentity
    expect(() => coordinateEvaluationDispatch(sharedProcess)).toThrow(
      expect.objectContaining({ code: 'assignment_policy_mismatch' })
    )
  })

  it('records missing results only after deadline and leaves unrelated work runnable', () => {
    const plan = buildEvaluationDispatch()
    expect(reconcile(plan, [], '2026-01-01T00:01:30.000Z')).toEqual(plan.coordination)
    const missing = reconcile(plan, [], '2026-01-01T00:02:00.000Z')
    expect(missing).toMatchObject({
      version: 2,
      outcome: 'unresolved',
      unresolvedReasons: ['missing-result'],
      acceptanceDisposition: 'unaccepted',
      unrelatedWorkDisposition: 'continue'
    })
    expect(missing.entries.every((entry) => entry.disposition === 'missing')).toBe(true)
  })

  it('keeps contradictory and stale evaluator results explicitly unresolved', () => {
    const contradictoryPlan = buildEvaluationDispatch('contradictory-evaluation')
    const contradictory = reconcile(
      contradictoryPlan,
      [
        buildEvaluationResult(contradictoryPlan, 0, 'passed'),
        buildEvaluationResult(contradictoryPlan, 1, 'contradictory')
      ],
      '2026-01-01T00:01:30.000Z'
    )
    expect(contradictory).toMatchObject({
      outcome: 'unresolved',
      unresolvedReasons: ['evaluator-contradiction'],
      acceptanceDisposition: 'unaccepted'
    })

    const stalePlan = buildEvaluationDispatch('stale-evaluation')
    const stale = reconcile(
      stalePlan,
      [buildEvaluationResult(stalePlan, 0, 'passed'), buildEvaluationResult(stalePlan, 1, 'stale')],
      '2026-01-01T00:03:00.000Z'
    )
    expect(stale).toMatchObject({
      outcome: 'unresolved',
      unresolvedReasons: ['stale-result'],
      acceptanceDisposition: 'unaccepted'
    })
  })

  it('does not majority-vote mixed passing and failed required evaluators', () => {
    const plan = buildEvaluationDispatch('disagreement-evaluation')
    const result = reconcile(
      plan,
      [buildEvaluationResult(plan, 0, 'passed'), buildEvaluationResult(plan, 1, 'failed')],
      '2026-01-01T00:01:30.000Z'
    )
    expect(result).toMatchObject({
      outcome: 'unresolved',
      unresolvedReasons: ['evaluator-disagreement'],
      acceptanceDisposition: 'unaccepted'
    })
  })

  it('makes complete passing evaluation eligible only for product reconciliation', () => {
    const plan = buildEvaluationDispatch('passing-evaluation')
    const result = reconcile(
      plan,
      [buildEvaluationResult(plan, 0, 'passed'), buildEvaluationResult(plan, 1, 'passed')],
      '2026-01-01T00:01:30.000Z'
    )
    expect(result).toMatchObject({
      outcome: 'ready-for-reconciliation',
      unresolvedReasons: [],
      acceptanceDisposition: 'eligible-for-reconciliation',
      acceptanceAuthority: 'none'
    })
  })
})
