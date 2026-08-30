import { canonicalJson, sha256Text, type JsonValue } from './canonical-json.js'
import type { DataMovementEvaluationReportV1 } from './domain/data-movement-evaluator-contracts.js'
import { SemanticLabeledCorpusV1Schema } from './domain/semantic-evaluator-contracts.js'
import {
  createEvaluationMeasure as measure,
  type EvaluationMeasure,
  type ExperimentResult
} from './experiment-contracts.js'
import type { SemanticPrediction } from './semantic-labeled-evaluator.js'

export const EVALUATION_MUTATION_AT = '2026-01-01T00:50:00.000Z'
export const EVALUATION_MUTATION_VERSIONS = {
  identityMapping: '1',
  dataMovement: '1',
  semanticLabeled: '1'
} as const

export type MutationClass =
  | 'schema'
  | 'mapping'
  | 'delete'
  | 'precision'
  | 'identity'
  | 'security'
  | 'recovery'
  | 'benign'

export type MutationOutcome = {
  id: string
  class: MutationClass
  critical: boolean
  rejected: boolean
  failedMeasures: string[]
  evidence: string[]
}

export function failedIdentityMeasures(
  result: ExperimentResult
): Pick<MutationOutcome, 'failedMeasures' | 'evidence'> {
  const failed = result.measures.filter((entry) => entry.status !== 'pass')
  return {
    failedMeasures: failed.map((entry) => entry.name),
    evidence: [...new Set(failed.flatMap((entry) => entry.evidence))].toSorted()
  }
}

export function dataOutcome(input: {
  id: string
  class: 'delete' | 'recovery' | 'benign'
  report: DataMovementEvaluationReportV1
  critical: boolean
}): MutationOutcome {
  const failedMeasures = Object.entries(input.report.checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name)
  return {
    id: input.id,
    class: input.class,
    critical: input.critical,
    rejected: input.report.status !== 'passed',
    failedMeasures,
    evidence: failedMeasures.length === 0 ? [] : input.report.evidenceIds
  }
}

export function semanticMutationFixture() {
  const corpus = SemanticLabeledCorpusV1Schema.parse({
    schemaVersion: 1,
    kind: 'semantic-labeled-corpus',
    id: 'semantic_corpus_mutation_qualification_v1',
    tenantId: 'tenant_s1',
    createdAt: EVALUATION_MUTATION_AT,
    version: 1,
    predecessorCorpusId: null,
    split: 'held-out',
    labelsVisibleToProducer: false,
    cases: Array.from({ length: 10 }, (_, index) => ({
      id: `mutation-semantic-case-${index + 1}`,
      groupId: `mutation-semantic-group-${index + 1}`,
      claimClass: 'mapping-safety',
      inputDigest: sha256Text(canonicalJson({ seedCase: index + 1 })),
      label: index % 2 === 0 ? 'accept' : 'reject',
      rationale:
        index % 2 === 0 ? 'Mapping preserves the declared key.' : 'Mapping drops a required key.'
    })),
    minimumAccuracy: 0.8,
    maximumFalseAccepts: 0,
    maximumDisagreements: 0,
    labeledBy: { kind: 'operator', id: 'held-out-labeler', version: '1' },
    limitations: ['Synthetic qualification corpus.']
  })
  const predictions: SemanticPrediction[] = corpus.cases.map((item) => ({
    caseId: item.id,
    primary: item.label,
    secondary: item.label
  }))
  return { corpus, predictions }
}

export function mutationOutcomeMeasure(
  name: string,
  passed: boolean,
  value: JsonValue,
  threshold: string,
  outcomes: MutationOutcome[]
): EvaluationMeasure {
  return measure(
    name,
    passed ? 'pass' : 'fail',
    value,
    threshold,
    outcomes
      .flatMap((outcome) => outcome.evidence)
      .filter((item, index, all) => all.indexOf(item) === index)
  )
}
