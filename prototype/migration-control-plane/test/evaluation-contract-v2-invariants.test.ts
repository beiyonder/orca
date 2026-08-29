import { describe, expect, it } from 'vitest'
import { EvaluationAssignmentV2Schema } from '../src/domain/evaluation-assignment-contracts-v2.js'
import { EvaluationContractV2Schema } from '../src/domain/evaluation-contracts-v2.js'
import { EvaluatorDefinitionV2Schema } from '../src/domain/evaluation-definition-contracts-v2.js'
import { EvaluationResultV2Schema } from '../src/domain/evaluation-result-contracts-v2.js'
import { EVALUATION_V2_BUNDLE } from './evaluation-contract-v2-samples.js'

function messages(result: {
  success: boolean
  error?: { issues: { message: string }[] }
}): string[] {
  return result.success ? [] : (result.error?.issues.map((issue) => issue.message) ?? [])
}

describe('evaluation V2 contract invariants', () => {
  it('requires calibrated exact model identity for a model evaluator', () => {
    const definition = structuredClone(EVALUATION_V2_BUNDLE.evaluatorDefinition)
    definition.evaluatorType = 'model'
    expect(messages(EvaluatorDefinitionV2Schema.safeParse(definition))).toContain(
      'Model evaluator requires an exact model route and calibration corpus'
    )
  })

  it('requires schema-name and version pins to agree', () => {
    const contract = structuredClone(EVALUATION_V2_BUNDLE.evaluationContract)
    contract.subject.schema.version = 2
    expect(messages(EvaluationContractV2Schema.safeParse(contract))).toContain(
      'Schema name suffix and version must agree'
    )
  })

  it('requires evidence for every hard required measure', () => {
    const contract = structuredClone(EVALUATION_V2_BUNDLE.evaluationContract)
    contract.measures[0]!.evidenceRequired = false
    expect(messages(EvaluationContractV2Schema.safeParse(contract))).toContain(
      'Hard required measure requires evidence'
    )
  })

  it('rejects producer self-evaluation in the assignment bytes', () => {
    const assignment = structuredClone(EVALUATION_V2_BUNDLE.evaluationAssignment)
    assignment.evaluatorExecution.actor = assignment.producer.actor
    expect(messages(EvaluationAssignmentV2Schema.safeParse(assignment))).toContain(
      'Producer cannot evaluate its own subject'
    )
  })

  it('cannot encode a passing result with incomplete or failed measures', () => {
    const result = structuredClone(EVALUATION_V2_BUNDLE.evaluationResult)
    result.measures[0]!.status = 'unknown'
    expect(messages(EvaluationResultV2Schema.safeParse(result))).toContain(
      'Passed result requires complete passing coverage'
    )
  })
})
