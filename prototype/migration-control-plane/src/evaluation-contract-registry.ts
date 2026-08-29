import { canonicalJson } from './canonical-json.js'
import {
  EvaluationAssignmentV2Schema,
  type EvaluationAssignmentV2
} from './domain/evaluation-assignment-contracts-v2.js'
import {
  EvaluationContractV2Schema,
  type EvaluationContractV2
} from './domain/evaluation-contracts-v2.js'
import {
  EvaluatorDefinitionV2Schema,
  type EvaluatorDefinitionV2
} from './domain/evaluation-definition-contracts-v2.js'
import {
  EvaluationResultV2Schema,
  type EvaluationResultV2
} from './domain/evaluation-result-contracts-v2.js'
import {
  evaluationRegistryFailure as failure,
  putImmutableEvaluationRecord as putImmutable
} from './evaluation-contract-registry-errors.js'
import {
  evaluationBudgetWithinDefinition as withinBudget,
  evaluationIndependenceMeets as observedIndependenceMeets,
  evaluationRecordActiveAt as isActiveAt,
  evaluationRecordDigest,
  evaluationResultDigest,
  exactEvaluationInput as exactInput,
  exactEvaluationMeasure as exactMeasure,
  exactEvaluationRecordReference as exactReference,
  exactEvaluationSchemaReference as exactSchema
} from './evaluation-contract-validation.js'
export { evaluationRecordDigest, evaluationResultDigest } from './evaluation-contract-validation.js'
export { EvaluationContractRegistryError } from './evaluation-contract-registry-errors.js'

export class EvaluationContractRegistry {
  readonly #definitions = new Map<string, EvaluatorDefinitionV2>()
  readonly #contracts = new Map<string, EvaluationContractV2>()
  readonly #assignments = new Map<string, EvaluationAssignmentV2>()
  readonly #results = new Map<string, EvaluationResultV2>()
  readonly #resultByAssignment = new Map<string, string>()

  registerDefinition(input: unknown): EvaluatorDefinitionV2 {
    let definition: EvaluatorDefinitionV2
    try {
      definition = EvaluatorDefinitionV2Schema.parse(input)
    } catch (error) {
      throw failure('invalid_definition', 'Evaluator definition is invalid', error)
    }
    const existing = this.#definitions.get(definition.id)
    if (existing) {
      return putImmutable(this.#definitions, definition.id, definition)
    }
    const prior = [...this.#definitions.values()]
      .filter(
        (candidate) =>
          candidate.tenantId === definition.tenantId &&
          candidate.evaluatorKey === definition.evaluatorKey
      )
      .toSorted((left, right) => right.version - left.version)[0]
    if (
      (definition.version === 1 && prior !== undefined) ||
      (definition.version > 1 &&
        (!prior ||
          definition.version !== prior.version + 1 ||
          definition.predecessor === null ||
          !exactReference(prior, definition.predecessor)))
    ) {
      throw failure('definition_lineage_mismatch', 'Evaluator definition lineage is invalid')
    }
    return putImmutable(this.#definitions, definition.id, definition)
  }

  registerContract(input: unknown): EvaluationContractV2 {
    let contract: EvaluationContractV2
    try {
      contract = EvaluationContractV2Schema.parse(input)
    } catch (error) {
      throw failure('invalid_contract', 'Evaluation contract is invalid', error)
    }
    const existing = this.#contracts.get(contract.id)
    if (existing) {
      return putImmutable(this.#contracts, contract.id, contract)
    }
    const prior = [...this.#contracts.values()]
      .filter(
        (candidate) =>
          candidate.tenantId === contract.tenantId && candidate.contractKey === contract.contractKey
      )
      .toSorted((left, right) => right.version - left.version)[0]
    if (
      (contract.version === 1 && prior !== undefined) ||
      (contract.version > 1 &&
        (!prior ||
          contract.version !== prior.version + 1 ||
          contract.predecessor === null ||
          !exactReference(prior, contract.predecessor)))
    ) {
      throw failure('contract_lineage_mismatch', 'Evaluation contract lineage is invalid')
    }
    const contractMeasuresByEvaluator = new Map<
      string,
      Map<string, EvaluationContractV2['measures'][number]>
    >()
    for (const measure of contract.measures) {
      const evaluatorKey = `${measure.evaluator.id}\u0000${measure.evaluator.version}\u0000${measure.evaluator.digest}`
      const measures = contractMeasuresByEvaluator.get(evaluatorKey) ?? new Map()
      measures.set(measure.name, measure)
      contractMeasuresByEvaluator.set(evaluatorKey, measures)
    }
    for (const required of contract.requiredEvaluators) {
      const definition = this.#definitions.get(required.id)
      if (
        !definition ||
        definition.tenantId !== contract.tenantId ||
        !exactReference(definition, required) ||
        !isActiveAt(definition, contract.createdAt)
      ) {
        throw failure('definition_not_available', 'Contract references an unavailable evaluator')
      }
      const supportedSubjects = new Set(
        definition.supportedSubjects.map(
          (subject) =>
            `${subject.kind}\u0000${subject.schemaName}\u0000${subject.schemaVersion}\u0000${subject.schemaDigest}`
        )
      )
      const subjectKey = `${contract.subject.kind}\u0000${contract.subject.schema.name}\u0000${contract.subject.schema.version}\u0000${contract.subject.schema.digest}`
      if (!supportedSubjects.has(subjectKey)) {
        throw failure('subject_not_supported', 'Evaluator does not support the contract subject')
      }
      const evaluatorMeasures = new Map(
        definition.measures.map((measure) => [measure.name, measure])
      )
      const evaluatorKey = `${required.id}\u0000${required.version}\u0000${required.digest}`
      const contractMeasures = contractMeasuresByEvaluator.get(evaluatorKey) ?? new Map()
      for (const measureName of required.measureNames) {
        const evaluatorMeasure = evaluatorMeasures.get(measureName)
        const contractMeasure = contractMeasures.get(measureName)
        if (
          !evaluatorMeasure ||
          !contractMeasure ||
          canonicalJson(evaluatorMeasure) !==
            canonicalJson({
              name: contractMeasure.name,
              valueType: contractMeasure.valueType,
              unit: contractMeasure.unit,
              hard: contractMeasure.hard,
              required: contractMeasure.required,
              operator: contractMeasure.operator,
              threshold: contractMeasure.threshold,
              evidenceRequired: contractMeasure.evidenceRequired,
              description: contractMeasure.description
            })
        ) {
          throw failure(
            'measure_definition_mismatch',
            'Contract measure differs from evaluator definition'
          )
        }
      }
    }
    return putImmutable(this.#contracts, contract.id, contract)
  }

  admitAssignment(input: unknown): EvaluationAssignmentV2 {
    let assignment: EvaluationAssignmentV2
    try {
      assignment = EvaluationAssignmentV2Schema.parse(input)
    } catch (error) {
      throw failure('invalid_assignment', 'Evaluation assignment is invalid', error)
    }
    const existing = this.#assignments.get(assignment.id)
    if (existing) {
      return putImmutable(this.#assignments, assignment.id, assignment)
    }
    const contract = this.#contracts.get(assignment.contract.id)
    const definition = this.#definitions.get(assignment.evaluatorDefinition.id)
    if (
      !contract ||
      !definition ||
      assignment.tenantId !== contract.tenantId ||
      assignment.tenantId !== definition.tenantId ||
      !exactReference(contract, assignment.contract) ||
      !exactReference(definition, assignment.evaluatorDefinition) ||
      !isActiveAt(contract, assignment.createdAt) ||
      !isActiveAt(definition, assignment.createdAt)
    ) {
      throw failure(
        'assignment_authority_mismatch',
        'Evaluation assignment authority is unavailable'
      )
    }
    if (
      !contract.requiredEvaluators.some(
        (required) =>
          required.id === assignment.evaluatorDefinition.id &&
          required.version === assignment.evaluatorDefinition.version &&
          required.digest === assignment.evaluatorDefinition.digest
      )
    ) {
      throw failure(
        'evaluator_not_required',
        'Assignment evaluator is not required by the contract'
      )
    }
    if (
      assignment.subject.kind !== contract.subject.kind ||
      !exactSchema(assignment.subject.schema, contract.subject.schema)
    ) {
      throw failure('subject_mismatch', 'Assignment subject differs from the contract')
    }
    const requirements = new Set(contract.inputRequirements.map((requirement) => requirement.name))
    if (
      assignment.inputs.some((inputReference) => !requirements.has(inputReference.name)) ||
      contract.inputRequirements.some((requirement) => !exactInput(assignment, requirement))
    ) {
      throw failure('input_mismatch', 'Assignment inputs do not satisfy the contract')
    }
    if (
      !withinBudget(assignment.budget, definition.budget) ||
      Date.parse(assignment.deadlineAt) - Date.parse(assignment.createdAt) >
        assignment.budget.timeLimitMs ||
      !observedIndependenceMeets(assignment, contract.independence) ||
      !observedIndependenceMeets(assignment, definition.independence)
    ) {
      throw failure('assignment_policy_mismatch', 'Evaluation assignment exceeds evaluator policy')
    }
    return putImmutable(this.#assignments, assignment.id, assignment)
  }

  recordResult(input: unknown): EvaluationResultV2 {
    let result: EvaluationResultV2
    try {
      result = EvaluationResultV2Schema.parse(input)
    } catch (error) {
      throw failure('invalid_result', 'Evaluation result is invalid', error)
    }
    const existing = this.#results.get(result.id)
    if (existing) {
      return putImmutable(this.#results, result.id, result)
    }
    if (this.#resultByAssignment.has(result.assignment.id)) {
      throw failure('result_exists', 'Evaluation assignment already has an immutable result')
    }
    const assignment = this.#assignments.get(result.assignment.id)
    const contract = this.#contracts.get(result.contract.id)
    if (
      !assignment ||
      !contract ||
      result.tenantId !== assignment.tenantId ||
      result.missionId !== assignment.missionId ||
      result.assignment.evaluatorAttemptId !== assignment.evaluatorExecution.attemptId ||
      result.assignment.evaluatorFence !== assignment.evaluatorExecution.fence ||
      result.assignment.digest !== evaluationRecordDigest(assignment) ||
      canonicalJson(result.contract) !== canonicalJson(assignment.contract) ||
      canonicalJson(result.evaluatorDefinition) !== canonicalJson(assignment.evaluatorDefinition) ||
      canonicalJson(result.subject) !== canonicalJson(assignment.subject) ||
      result.resultDigest !== evaluationResultDigest(result)
    ) {
      throw failure('result_lineage_mismatch', 'Evaluation result lineage or digest is invalid')
    }
    const assignedMeasures = contract.measures.filter(
      (measure) =>
        measure.evaluator.id === assignment.evaluatorDefinition.id &&
        measure.evaluator.version === assignment.evaluatorDefinition.version &&
        measure.evaluator.digest === assignment.evaluatorDefinition.digest
    )
    const definitions = new Map(assignedMeasures.map((measure) => [measure.name, measure]))
    const requiredNames = assignedMeasures
      .filter((measure) => measure.required)
      .map((measure) => measure.name)
    if (
      result.measures.some((measure) => {
        const definition = definitions.get(measure.name)
        return !definition || !exactMeasure(measure, definition)
      }) ||
      canonicalJson(result.coverage.requiredMeasureNames.toSorted()) !==
        canonicalJson(requiredNames.toSorted()) ||
      (result.status !== 'stale' &&
        Date.parse(result.completedAt) > Date.parse(assignment.deadlineAt))
    ) {
      throw failure('result_measure_mismatch', 'Evaluation result differs from assigned measures')
    }
    this.#resultByAssignment.set(result.assignment.id, result.id)
    return putImmutable(this.#results, result.id, result)
  }
}
