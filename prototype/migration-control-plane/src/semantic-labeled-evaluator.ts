import { canonicalJson, sha256Text } from './canonical-json.js'
import {
  SemanticEvaluationReportV1Schema,
  SemanticLabeledCorpusV1Schema,
  type SemanticEvaluationReportV1
} from './domain/semantic-evaluator-contracts.js'
import { evaluationRecordDigest } from './evaluation-contract-registry.js'

export type SemanticPrediction = {
  caseId: string
  primary: 'accept' | 'reject' | null
  secondary: 'accept' | 'reject' | null
}

export function evaluateSemanticLabels(input: {
  corpus: unknown
  predictions: SemanticPrediction[]
  evaluatorVersion: string
  evaluatedAt: string
}): SemanticEvaluationReportV1 {
  const corpus = SemanticLabeledCorpusV1Schema.parse(input.corpus)
  const predictions = new Map(
    input.predictions.map((prediction) => [prediction.caseId, prediction])
  )
  if (predictions.size !== input.predictions.length || predictions.size !== corpus.cases.length) {
    throw new TypeError('Semantic predictions must contain each held-out case exactly once')
  }
  const cases = corpus.cases.map((item) => {
    const prediction = predictions.get(item.id)
    if (!prediction) {
      throw new TypeError(`Missing semantic prediction: ${item.id}`)
    }
    const disposition =
      prediction.primary === null
        ? 'abstained'
        : prediction.secondary !== null && prediction.secondary !== prediction.primary
          ? 'disagreement'
          : prediction.primary === item.label
            ? 'correct'
            : 'incorrect'
    return {
      id: item.id,
      expected: item.label,
      primary: prediction.primary,
      secondary: prediction.secondary,
      disposition
    } as const
  })
  const totals = {
    cases: cases.length,
    correct: cases.filter((item) => item.disposition === 'correct').length,
    incorrect: cases.filter((item) => item.disposition === 'incorrect').length,
    abstained: cases.filter((item) => item.disposition === 'abstained').length,
    disagreements: cases.filter((item) => item.disposition === 'disagreement').length,
    falseAccepts: cases.filter((item) => item.expected === 'reject' && item.primary === 'accept')
      .length,
    accuracy:
      cases.length === 0
        ? 0
        : cases.filter((item) => item.disposition === 'correct').length / cases.length
  }
  const decisive = totals.abstained === 0 && totals.disagreements === 0
  const passed =
    decisive &&
    totals.accuracy >= corpus.minimumAccuracy &&
    totals.falseAccepts <= corpus.maximumFalseAccepts &&
    totals.disagreements <= corpus.maximumDisagreements
  const status = passed ? 'passed' : decisive ? 'failed' : 'inconclusive'
  return SemanticEvaluationReportV1Schema.parse({
    schemaVersion: 1,
    kind: 'semantic-evaluation-report',
    id: `semantic_report_${sha256Text(canonicalJson({ corpus: corpus.id, predictions: input.predictions, evaluator: input.evaluatorVersion })).slice(0, 32)}`,
    tenantId: corpus.tenantId,
    createdAt: input.evaluatedAt,
    corpusId: corpus.id,
    corpusDigest: evaluationRecordDigest(corpus),
    evaluatorVersion: input.evaluatorVersion,
    cases,
    totals,
    thresholds: {
      minimumAccuracy: corpus.minimumAccuracy,
      maximumFalseAccepts: corpus.maximumFalseAccepts,
      maximumDisagreements: corpus.maximumDisagreements
    },
    status,
    evaluatedAt: input.evaluatedAt,
    evaluatedBy: { kind: 'evaluator', id: 'semantic-labeled', version: input.evaluatorVersion },
    limitations: corpus.limitations,
    acceptanceAuthority: 'none'
  })
}
