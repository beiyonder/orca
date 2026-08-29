import { canonicalJson, sha256Text } from './canonical-json.js'
import {
  EvaluationDiagnosisV1Schema,
  type EvaluationDiagnosisV1,
  type SubjectAcceptanceV1
} from './domain/acceptance-correction-contracts.js'
import { EvaluationResultV2Schema } from './domain/evaluation-result-contracts-v2.js'
import { GapV1Schema, type GapV1 } from './domain/epistemic-contracts.js'

function attribution(failureCode: string): {
  cause: EvaluationDiagnosisV1['failedMeasures'][number]['cause']
  componentPath: string
  action: EvaluationDiagnosisV1['recommendedAction']
} {
  if (/schema|type|compatibility|build|artifact/.test(failureCode)) {
    return { cause: 'artifact-defect', componentPath: '/', action: 'correct-subject' }
  }
  if (/lineage|evidence|input|stale/.test(failureCode)) {
    return { cause: 'wrong-or-stale-input', componentPath: '/evidence', action: 'acquire-evidence' }
  }
  if (/policy|authority|budget/.test(failureCode)) {
    return { cause: 'authority-or-budget', componentPath: '/authority', action: 'quarantine' }
  }
  if (/unavailable|infrastructure|error/.test(failureCode)) {
    return {
      cause: 'infrastructure-failure',
      componentPath: '/evaluator-runtime',
      action: 'investigate-evaluator'
    }
  }
  return { cause: 'evaluator-defect', componentPath: '/evaluator', action: 'investigate-evaluator' }
}

export function diagnoseEvaluationFailure(input: {
  acceptance: SubjectAcceptanceV1
  results: unknown[]
  diagnosedAt: string
}): { diagnosis: EvaluationDiagnosisV1; gaps: GapV1[] } {
  if (!['rejected', 'quarantined'].includes(input.acceptance.status)) {
    throw new TypeError('Only rejected or quarantined subjects may be diagnosed')
  }
  const results = input.results.map((result) => EvaluationResultV2Schema.parse(result))
  if (results.length === 0) {
    throw new TypeError('Diagnosis requires evaluation results')
  }
  const failedMeasures = results.flatMap((result) => {
    const failed = result.measures.filter((measure) => measure.status === 'fail')
    if (failed.length > 0) {
      return failed.map((measure) => {
        const failureCode = measure.failureCode!
        const assigned = attribution(failureCode)
        return {
          name: measure.name,
          failureCode,
          cause: assigned.cause,
          componentPath: assigned.componentPath,
          evidenceIds: measure.evidence.map((evidence) => evidence.id)
        }
      })
    }
    const failureCode = `evaluation_${result.status}`
    const assigned = attribution(failureCode)
    return [
      {
        name: 'evaluation_availability',
        failureCode,
        cause: assigned.cause,
        componentPath: assigned.componentPath,
        evidenceIds: result.evidence.map((evidence) => evidence.id)
      }
    ]
  })
  const uniqueFailures = [
    ...new Map(
      failedMeasures.map((measure) => [`${measure.name}\u0000${measure.failureCode}`, measure])
    ).values()
  ]
  const gaps = uniqueFailures.map((measure, index) =>
    GapV1Schema.parse({
      schemaVersion: 1,
      kind: 'gap',
      id: `gap_evaluation_${sha256Text(canonicalJson({ acceptance: input.acceptance.id, measure: measure.name, index })).slice(0, 24)}`,
      tenantId: input.acceptance.tenantId,
      missionId: input.acceptance.missionId,
      createdAt: input.diagnosedAt,
      revision: 0,
      question: `How should ${measure.componentPath} change to satisfy ${measure.name}?`,
      impact: input.acceptance.status === 'rejected' ? 'high' : 'critical',
      propositionIds: [],
      hypothesisIds: [],
      contradictionIds: [],
      probeCandidateIds: [],
      blockedDecisionIds: [],
      state: { status: 'open', reason: measure.failureCode }
    })
  )
  const actions = uniqueFailures.map((measure) => attribution(measure.failureCode).action)
  const recommendedAction = actions.includes('quarantine')
    ? 'quarantine'
    : actions.includes('correct-subject')
      ? 'correct-subject'
      : actions.includes('acquire-evidence')
        ? 'acquire-evidence'
        : 'investigate-evaluator'
  const diagnosis = EvaluationDiagnosisV1Schema.parse({
    schemaVersion: 1,
    kind: 'evaluation-diagnosis',
    id: `evaluation_diagnosis_${sha256Text(canonicalJson({ acceptance: input.acceptance.id, results: results.map((result) => result.id) })).slice(0, 32)}`,
    tenantId: input.acceptance.tenantId,
    missionId: input.acceptance.missionId,
    createdAt: input.diagnosedAt,
    acceptanceId: input.acceptance.id,
    subject: input.acceptance.subject,
    contract: input.acceptance.contract,
    evaluationResultIds: results.map((result) => result.id),
    failedMeasures: uniqueFailures,
    gapIds: gaps.map((gap) => gap.id),
    allowedMutationPaths: [...new Set(uniqueFailures.map((measure) => measure.componentPath))],
    recommendedAction,
    genericRetryAllowed: false,
    diagnosedAt: input.diagnosedAt,
    diagnosedBy: { kind: 'system', id: 'evaluation-diagnoser', version: '1' },
    acceptanceAuthority: 'none'
  })
  return { diagnosis, gaps }
}
