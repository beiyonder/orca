import { EvaluationContractV2Schema } from './domain/evaluation-contracts-v2.js'
import { EvaluatorDefinitionV2Schema } from './domain/evaluation-definition-contracts-v2.js'
import { EvaluationContractRegistry } from './evaluation-contract-registry.js'

export function reconstructEvaluationContractRegistry(input: {
  definitions: readonly unknown[]
  contracts: readonly unknown[]
  assignments: readonly unknown[]
  results: readonly unknown[]
}): EvaluationContractRegistry {
  const registry = new EvaluationContractRegistry()
  const definitions = [...input.definitions].toSorted((left, right) => {
    const leftRecord = EvaluatorDefinitionV2Schema.parse(left)
    const rightRecord = EvaluatorDefinitionV2Schema.parse(right)
    return (
      leftRecord.createdAt.localeCompare(rightRecord.createdAt) ||
      leftRecord.version - rightRecord.version
    )
  })
  for (const definition of definitions) {
    registry.registerDefinition(definition)
  }
  const contracts = [...input.contracts].toSorted((left, right) => {
    const leftRecord = EvaluationContractV2Schema.parse(left)
    const rightRecord = EvaluationContractV2Schema.parse(right)
    return (
      leftRecord.createdAt.localeCompare(rightRecord.createdAt) ||
      leftRecord.version - rightRecord.version
    )
  })
  for (const contract of contracts) {
    registry.registerContract(contract)
  }
  for (const assignment of input.assignments) {
    registry.admitAssignment(assignment)
  }
  for (const result of input.results) {
    registry.recordResult(result)
  }
  return registry
}
