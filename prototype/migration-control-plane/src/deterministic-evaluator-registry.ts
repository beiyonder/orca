import { canonicalJson } from './canonical-json.js'
import {
  DeterministicEvaluatorSuiteV1Schema,
  type DeterministicEvaluatorSuiteV1
} from './domain/deterministic-evaluator-contracts.js'
import type { EvaluatorDefinitionV2 } from './domain/evaluation-definition-contracts-v2.js'
import {
  EvaluationContractRegistry,
  evaluationRecordDigest
} from './evaluation-contract-registry.js'
import { evaluationRegistryFailure } from './evaluation-contract-registry-errors.js'

export class DeterministicEvaluatorSuiteRegistry {
  readonly #evaluationRegistry = new EvaluationContractRegistry()
  readonly #definitions = new Map<string, EvaluatorDefinitionV2>()
  readonly #suites = new Map<string, DeterministicEvaluatorSuiteV1>()

  static reconstruct(input: {
    definitions: readonly unknown[]
    suites: readonly unknown[]
  }): DeterministicEvaluatorSuiteRegistry {
    const registry = new DeterministicEvaluatorSuiteRegistry()
    for (const definition of input.definitions) {
      registry.registerDefinition(definition)
    }
    const suites = input.suites
      .map((suite) => DeterministicEvaluatorSuiteV1Schema.parse(suite))
      .toSorted(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) ||
          left.suiteKey.localeCompare(right.suiteKey) ||
          left.version - right.version
      )
    for (const suite of suites) {
      registry.registerSuite(suite)
    }
    return registry
  }

  registerDefinition(input: unknown): EvaluatorDefinitionV2 {
    const definition = this.#evaluationRegistry.registerDefinition(input)
    this.#definitions.set(definition.id, structuredClone(definition))
    return structuredClone(definition)
  }

  registerSuite(input: unknown): DeterministicEvaluatorSuiteV1 {
    let suite: DeterministicEvaluatorSuiteV1
    try {
      suite = DeterministicEvaluatorSuiteV1Schema.parse(input)
    } catch (error) {
      throw evaluationRegistryFailure(
        'invalid_deterministic_suite',
        'Deterministic evaluator suite is invalid',
        error
      )
    }
    const existing = this.#suites.get(suite.id)
    if (existing) {
      if (canonicalJson(existing) !== canonicalJson(suite)) {
        throw evaluationRegistryFailure(
          'immutable_conflict',
          `Deterministic evaluator suite differs for reused ID: ${suite.id}`
        )
      }
      return structuredClone(existing)
    }
    const definition = this.#definitions.get(suite.evaluatorDefinition.id)
    if (
      !definition ||
      definition.tenantId !== suite.tenantId ||
      definition.version !== suite.evaluatorDefinition.version ||
      evaluationRecordDigest(definition) !== suite.evaluatorDefinition.digest ||
      definition.evaluatorType !== 'deterministic' ||
      definition.implementation.modelRoute !== null ||
      definition.requiredTools.length !== 0 ||
      canonicalJson(definition.requiredAccess) !== canonicalJson(['none']) ||
      (definition.revokedAt !== null &&
        Date.parse(definition.revokedAt) <= Date.parse(suite.createdAt))
    ) {
      throw evaluationRegistryFailure(
        'deterministic_definition_mismatch',
        'Suite evaluator definition is unavailable or not side-effect-free deterministic code'
      )
    }
    if (
      !definition.supportedSubjects.some(
        (subject) =>
          subject.kind === suite.subject.kind &&
          subject.schemaName === suite.subject.schema.name &&
          subject.schemaVersion === suite.subject.schema.version &&
          subject.schemaDigest === suite.subject.schema.digest
      )
    ) {
      throw evaluationRegistryFailure(
        'deterministic_subject_mismatch',
        'Suite subject is unsupported by its evaluator definition'
      )
    }
    const measures = new Map(definition.measures.map((measure) => [measure.name, measure]))
    if (
      measures.size !== suite.operations.length ||
      suite.operations.some((operation) => {
        const measure = measures.get(operation.measureName)
        return (
          !measure ||
          measure.valueType !== 'boolean' ||
          measure.operator !== 'eq' ||
          measure.threshold !== true ||
          !measure.hard ||
          !measure.required ||
          !measure.evidenceRequired
        )
      })
    ) {
      throw evaluationRegistryFailure(
        'deterministic_measure_mismatch',
        'Suite operation must map to one hard required boolean evaluator measure'
      )
    }
    const prior = [...this.#suites.values()]
      .filter(
        (candidate) =>
          candidate.tenantId === suite.tenantId && candidate.suiteKey === suite.suiteKey
      )
      .toSorted((left, right) => right.version - left.version)[0]
    if (
      (suite.version === 1 && prior !== undefined) ||
      (suite.version > 1 &&
        (!prior ||
          suite.version !== prior.version + 1 ||
          suite.predecessor === null ||
          suite.predecessor.id !== prior.id ||
          suite.predecessor.version !== prior.version ||
          suite.predecessor.digest !== evaluationRecordDigest(prior)))
    ) {
      throw evaluationRegistryFailure(
        'deterministic_suite_lineage_mismatch',
        'Deterministic evaluator suite lineage is invalid'
      )
    }
    const stored = structuredClone(suite)
    this.#suites.set(stored.id, stored)
    return structuredClone(stored)
  }
}
