import { describe, expect, it } from 'vitest'
import { EvaluatorDefinitionV2Schema } from '../src/domain/evaluation-definition-contracts-v2.js'
import {
  EvaluationContractRegistry,
  evaluationRecordDigest,
  evaluationResultDigest
} from '../src/evaluation-contract-registry.js'
import { reconstructEvaluationContractRegistry } from '../src/evaluation-contract-reconstruction.js'
import { EVALUATION_V2_BUNDLE } from './evaluation-contract-v2-samples.js'

const bundle = EVALUATION_V2_BUNDLE

function registryThroughContract(): EvaluationContractRegistry {
  const registry = new EvaluationContractRegistry()
  registry.registerDefinition(bundle.evaluatorDefinition)
  registry.registerContract(bundle.evaluationContract)
  return registry
}

function registryThroughAssignment(): EvaluationContractRegistry {
  const registry = registryThroughContract()
  registry.admitAssignment(bundle.evaluationAssignment)
  return registry
}

describe('versioned evaluation contract registry', () => {
  it('reconstructs exact immutable definition, contract, assignment, and result lineage', () => {
    const registry = reconstructEvaluationContractRegistry({
      definitions: [bundle.evaluatorDefinition],
      contracts: [bundle.evaluationContract],
      assignments: [bundle.evaluationAssignment],
      results: [bundle.evaluationResult]
    })
    expect(registry.registerDefinition(bundle.evaluatorDefinition)).toEqual(
      bundle.evaluatorDefinition
    )
    expect(registry.registerContract(bundle.evaluationContract)).toEqual(bundle.evaluationContract)
    expect(registry.admitAssignment(bundle.evaluationAssignment)).toEqual(
      bundle.evaluationAssignment
    )
    expect(registry.recordResult(bundle.evaluationResult)).toEqual(bundle.evaluationResult)
  })

  it('requires contiguous evaluator version lineage with an exact predecessor digest', () => {
    const registry = new EvaluationContractRegistry()
    registry.registerDefinition(bundle.evaluatorDefinition)
    const next = EvaluatorDefinitionV2Schema.parse({
      ...structuredClone(bundle.evaluatorDefinition),
      id: 'evaluator_schema_contract_v2',
      createdAt: '2026-01-01T00:02:00.000Z',
      version: 2,
      predecessor: {
        id: bundle.evaluatorDefinition.id,
        version: 1,
        digest: evaluationRecordDigest(bundle.evaluatorDefinition)
      }
    })
    expect(registry.registerDefinition(next)).toEqual(next)

    const wrong = {
      ...next,
      id: 'evaluator_schema_contract_v3',
      createdAt: '2026-01-01T00:03:00.000Z',
      version: 3,
      predecessor: { id: next.id, version: 2, digest: 'f'.repeat(64) }
    }
    expect(() => registry.registerDefinition(wrong)).toThrow(
      expect.objectContaining({ code: 'definition_lineage_mismatch' })
    )
  })

  it('rejects a contract threshold that differs from its pinned evaluator definition', () => {
    const registry = new EvaluationContractRegistry()
    registry.registerDefinition(bundle.evaluatorDefinition)
    const contract = structuredClone(bundle.evaluationContract)
    contract.measures[0]!.threshold = false
    expect(() => registry.registerContract(contract)).toThrow(
      expect.objectContaining({ code: 'measure_definition_mismatch' })
    )
  })

  it('rejects producer self-evaluation before assignment admission', () => {
    const registry = registryThroughContract()
    const assignment = structuredClone(bundle.evaluationAssignment)
    assignment.evaluatorExecution.actor = assignment.producer.actor
    expect(() => registry.admitAssignment(assignment)).toThrow(
      expect.objectContaining({ code: 'invalid_assignment' })
    )
  })

  it('rejects stale, under-evidenced, or wrong-subject inputs', () => {
    const registry = registryThroughContract()
    const stale = structuredClone(bundle.evaluationAssignment)
    stale.inputs[0]!.observedAt = '2025-12-31T23:58:00.000Z'
    expect(() => registry.admitAssignment(stale)).toThrow(
      expect.objectContaining({ code: 'input_mismatch' })
    )

    const underEvidenced = structuredClone(bundle.evaluationAssignment)
    underEvidenced.inputs[0]!.evidence = []
    expect(() => registry.admitAssignment(underEvidenced)).toThrow(
      expect.objectContaining({ code: 'input_mismatch' })
    )

    const wrongSubject = structuredClone(bundle.evaluationAssignment)
    wrongSubject.inputs[0]!.recordId = 'assignment_result_other'
    expect(() => registry.admitAssignment(wrongSubject)).toThrow(
      expect.objectContaining({ code: 'input_mismatch' })
    )
  })

  it('rejects result threshold drift even when the result digest is self-consistent', () => {
    const registry = registryThroughAssignment()
    const result = structuredClone(bundle.evaluationResult)
    result.measures[0]!.threshold = false
    result.resultDigest = evaluationResultDigest(result)
    expect(() => registry.recordResult(result)).toThrow(
      expect.objectContaining({ code: 'result_measure_mismatch' })
    )
  })

  it('rejects stale assignment lineage and grants no result acceptance authority', () => {
    const registry = registryThroughAssignment()
    const wrongAssignment = structuredClone(bundle.evaluationResult)
    wrongAssignment.assignment.digest = 'f'.repeat(64)
    wrongAssignment.resultDigest = evaluationResultDigest(wrongAssignment)
    expect(() => registry.recordResult(wrongAssignment)).toThrow(
      expect.objectContaining({ code: 'result_lineage_mismatch' })
    )

    expect(
      bundle.evaluationResult.acceptanceAuthority === 'none' &&
        bundle.evaluationAssignment.acceptanceAuthority === 'none' &&
        bundle.evaluationContract.acceptanceAuthority === 'product-reconciler-only'
    ).toBe(true)
  })
})
