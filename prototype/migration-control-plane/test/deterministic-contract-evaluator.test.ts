import { describe, expect, it } from 'vitest'
import { evaluateDeterministicAssignment } from '../src/deterministic-contract-evaluator.js'
import { DeterministicEvaluatorSuiteV1Schema } from '../src/domain/deterministic-evaluator-contracts.js'
import {
  DETERMINISTIC_ASSIGNMENT,
  DETERMINISTIC_EVALUATION_CONTRACT,
  DETERMINISTIC_EVALUATOR_DEFINITION,
  DETERMINISTIC_EVALUATOR_SUITE,
  DETERMINISTIC_INPUT_EVIDENCE,
  DETERMINISTIC_SUBJECT,
  DETERMINISTIC_SUITE_EVIDENCE,
  runDeterministicFixture
} from './deterministic-evaluator-fixture.js'

function measureStatus(output: ReturnType<typeof runDeterministicFixture>, name: string) {
  return output.result.measures.find((measure) => measure.name === name)?.status
}

describe('deterministic contract evaluator', () => {
  it('passes all five hard checks and emits reproducible report, evidence, and result bytes', () => {
    const first = runDeterministicFixture()
    const second = runDeterministicFixture()
    expect(second).toEqual(first)
    expect(first.report).toMatchObject({
      status: 'passed',
      acceptanceAuthority: 'none'
    })
    expect(first.report.checks.every((check) => check.status === 'pass')).toBe(true)
    expect(first.result).toMatchObject({
      status: 'passed',
      coverage: { complete: true, missingMeasureNames: [] },
      acceptanceAuthority: 'none'
    })
    expect(first.result.measures).toHaveLength(5)
    expect(first.result.evidence).toEqual([
      {
        id: first.evidence.id,
        version: first.evidence.version,
        digest: expect.stringMatching(/^[a-f0-9]{64}$/)
      }
    ])
  })

  it('kills structural and runtime type mutations with exact measures', () => {
    const structural = runDeterministicFixture(null)
    expect(measureStatus(structural, 'structural_valid')).toBe('fail')
    expect(measureStatus(structural, 'types_valid')).toBe('fail')

    const wrongType = structuredClone(DETERMINISTIC_SUBJECT) as Record<string, unknown>
    wrongType.mappings = 'not-an-array'
    const typed = runDeterministicFixture(wrongType)
    expect(measureStatus(typed, 'structural_valid')).toBe('pass')
    expect(measureStatus(typed, 'types_valid')).toBe('fail')
    expect(typed.result.status).toBe('failed')
  })

  it('kills missing or excess provenance evidence without hiding other passing checks', () => {
    const output = runDeterministicFixture(DETERMINISTIC_SUBJECT, undefined, [])
    expect(measureStatus(output, 'contract_valid')).toBe('fail')
    expect(measureStatus(output, 'types_valid')).toBe('pass')
    expect(measureStatus(output, 'compatibility_valid')).toBe('pass')
    expect(
      output.report.checks.find((check) => check.measureName === 'contract_valid')
    ).toMatchObject({
      failureCode: 'deterministic_contract_lineage_failed'
    })
    const excess = runDeterministicFixture(DETERMINISTIC_SUBJECT, undefined, [
      DETERMINISTIC_INPUT_EVIDENCE,
      DETERMINISTIC_SUITE_EVIDENCE,
      { ...DETERMINISTIC_INPUT_EVIDENCE, id: 'evidence_unassigned' }
    ])
    expect(measureStatus(excess, 'contract_valid')).toBe('fail')
  })

  it('kills version compatibility, tenant, and authority policy mutations', () => {
    const wrongVersion = { ...structuredClone(DETERMINISTIC_SUBJECT), schemaVersion: 2 }
    const compatibility = runDeterministicFixture(wrongVersion)
    expect(measureStatus(compatibility, 'compatibility_valid')).toBe('fail')

    const wrongTenant = { ...structuredClone(DETERMINISTIC_SUBJECT), tenantId: 'tenant_other' }
    const policy = runDeterministicFixture(wrongTenant)
    expect(measureStatus(policy, 'policy_valid')).toBe('fail')
    expect(measureStatus(policy, 'types_valid')).toBe('pass')
    const effectful = { ...structuredClone(DETERMINISTIC_SUBJECT), authority: 'effectful' }
    expect(measureStatus(runDeterministicFixture(effectful), 'policy_valid')).toBe('fail')
  })

  it('accepts benign property-order changes byte-identically', () => {
    const reordered = Object.fromEntries(Object.entries(DETERMINISTIC_SUBJECT).toReversed())
    expect(runDeterministicFixture(reordered)).toEqual(runDeterministicFixture())
  })

  it('records a late otherwise-passing result as stale and unaccepted', () => {
    const output = runDeterministicFixture(DETERMINISTIC_SUBJECT, '2026-01-01T00:06:00.000Z')
    expect(output.report.checks.every((check) => check.status === 'pass')).toBe(true)
    expect(output.report.status).toBe('stale')
    expect(output.result.status).toBe('stale')
  })

  it('rejects assignment authority drift and incomplete suites before evaluation', () => {
    const assignment = structuredClone(DETERMINISTIC_ASSIGNMENT)
    assignment.evaluatorDefinition.digest = 'f'.repeat(64)
    expect(() =>
      evaluateDeterministicAssignment({
        assignment,
        contract: DETERMINISTIC_EVALUATION_CONTRACT,
        evaluatorDefinition: DETERMINISTIC_EVALUATOR_DEFINITION,
        suite: DETERMINISTIC_EVALUATOR_SUITE,
        subject: DETERMINISTIC_SUBJECT,
        inputEvidence: [DETERMINISTIC_INPUT_EVIDENCE],
        dataClass: 'synthetic',
        observedAt: '2026-01-01T00:04:30.000Z'
      })
    ).toThrow()

    const suiteAssignment = structuredClone(DETERMINISTIC_ASSIGNMENT)
    suiteAssignment.inputs.find((input) => input.name === 'deterministic-suite')!.digest =
      'f'.repeat(64)
    expect(() =>
      evaluateDeterministicAssignment({
        assignment: suiteAssignment,
        contract: DETERMINISTIC_EVALUATION_CONTRACT,
        evaluatorDefinition: DETERMINISTIC_EVALUATOR_DEFINITION,
        suite: DETERMINISTIC_EVALUATOR_SUITE,
        subject: DETERMINISTIC_SUBJECT,
        inputEvidence: [DETERMINISTIC_INPUT_EVIDENCE, DETERMINISTIC_SUITE_EVIDENCE],
        dataClass: 'synthetic',
        observedAt: '2026-01-01T00:04:30.000Z'
      })
    ).toThrow(expect.objectContaining({ code: 'deterministic_suite_input_mismatch' }))

    const suite = structuredClone(DETERMINISTIC_EVALUATOR_SUITE)
    suite.operations.pop()
    expect(DeterministicEvaluatorSuiteV1Schema.safeParse(suite).success).toBe(false)
  })
})
