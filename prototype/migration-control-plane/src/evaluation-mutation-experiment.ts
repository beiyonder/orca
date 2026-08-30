import { resolve } from 'node:path'
import { canonicalizeJson } from './canonical-json.js'
import { analyzeCdcBehavior } from './cdc-behavior-analyzer.js'
import { evaluateDataMovement, type DataMovementOracle } from './data-movement-evaluator.js'
import { loadDiscoveryQualificationFixture } from './discovery-qualification-fixture.js'
import {
  EVALUATION_MUTATION_AT as EVALUATED_AT,
  EVALUATION_MUTATION_VERSIONS as EVALUATOR_VERSIONS,
  dataOutcome,
  failedIdentityMeasures,
  mutationOutcomeMeasure as outcomeMeasure,
  semanticMutationFixture as semanticFixture,
  type MutationOutcome
} from './evaluation-mutation-outcomes.js'
import {
  createEvaluationMeasure as measure,
  type ExperimentResult
} from './experiment-contracts.js'
import {
  applyIdentityMappingMutation,
  buildIdentityMappingBaseline,
  evaluateIdentityMapping
} from './identity-mapping-evaluator.js'
import { loadS1IdentityFixture } from './s1-fixture-loader.js'
import { evaluateSemanticLabels } from './semantic-labeled-evaluator.js'

export async function runEvaluationMutationExperiment(
  labRoot: string,
  seed: number
): Promise<ExperimentResult> {
  const identityFixture = await loadS1IdentityFixture(
    resolve(labRoot, 'fixtures', 's1-identity-key')
  )
  const mapping = buildIdentityMappingBaseline(identityFixture)
  const baselineIdentity = evaluateIdentityMapping(identityFixture, mapping)
  const criticalIdentityMutation = identityFixture.mutations.find(
    (item) => item.class === 'critical'
  )
  if (!criticalIdentityMutation) {
    throw new Error('S1 fixture is missing its critical mapping mutation')
  }

  const schemaResult = evaluateIdentityMapping(identityFixture, { ...mapping, schemaVersion: 2 })
  const mappingResult = evaluateIdentityMapping(
    identityFixture,
    applyIdentityMappingMutation(mapping, criticalIdentityMutation)
  )
  const identityResult = evaluateIdentityMapping(identityFixture, {
    ...mapping,
    decisionRef: 'decision_wrong_identity'
  })
  const securityResult = evaluateIdentityMapping(identityFixture, {
    ...mapping,
    evidenceRefs: [...mapping.evidenceRefs, 'private/tenant-other/secret.json']
  })

  const discoveryFixture = await loadDiscoveryQualificationFixture(
    resolve(labRoot, 'fixtures', 'p6-discovery-cases-v1')
  )
  const analysis = analyzeCdcBehavior(discoveryFixture.cdcTrace, {
    analysisId: 'source_cdc_analysis_mutation_qualification',
    analyzedAt: EVALUATED_AT,
    analyzedBy: { kind: 'evaluator', id: 'data-movement', version: EVALUATOR_VERSIONS.dataMovement }
  })
  const oracle: DataMovementOracle = {
    expectedFinalRecordCount: 2,
    expectedFinalKeyDigests: [
      'fa93c5826950365c98075d96130f13d0319cdd3833a19bfe8074f5967c9a336a',
      'dbfdb00caa87e5b94a24d3eebd662d5e5455305dfc334a2f1e53ad886983e9d3'
    ],
    expectedDeleteSequences: [6],
    expectedFinalPosition: '009',
    expectedFinalResumeToken: 'checkpoint-008'
  }
  const evaluateMovement = (selectedOracle: DataMovementOracle) =>
    evaluateDataMovement({
      trace: discoveryFixture.cdcTrace,
      analysis,
      oracle: selectedOracle,
      evidenceIds: ['evidence_cdc_mutation_qualification'],
      evaluatedAt: EVALUATED_AT
    })
  const baselineMovement = evaluateMovement(oracle)
  const deleteReport = evaluateMovement({ ...oracle, expectedDeleteSequences: [] })
  const recoveryReport = evaluateMovement({
    ...oracle,
    expectedFinalResumeToken: 'checkpoint-corrupted'
  })

  const { corpus, predictions } = semanticFixture()
  const baselineSemantic = evaluateSemanticLabels({
    corpus,
    predictions,
    evaluatorVersion: EVALUATOR_VERSIONS.semanticLabeled,
    evaluatedAt: EVALUATED_AT
  })
  const precisionPredictions = structuredClone(predictions)
  const rejectedCase = corpus.cases.find((item) => item.label === 'reject')!
  const falseAccept = precisionPredictions.find((item) => item.caseId === rejectedCase.id)!
  falseAccept.primary = 'accept'
  falseAccept.secondary = 'accept'
  const precisionReport = evaluateSemanticLabels({
    corpus,
    predictions: precisionPredictions,
    evaluatorVersion: EVALUATOR_VERSIONS.semanticLabeled,
    evaluatedAt: EVALUATED_AT
  })

  const schemaFailure = failedIdentityMeasures(schemaResult)
  const mappingFailure = failedIdentityMeasures(mappingResult)
  const identityFailure = failedIdentityMeasures(identityResult)
  const securityFailure = failedIdentityMeasures(securityResult)
  const critical: MutationOutcome[] = [
    {
      id: 'EVAL-MUT-SCHEMA-001',
      class: 'schema',
      critical: true,
      rejected: schemaResult.status !== 'passed',
      ...schemaFailure
    },
    {
      id: 'EVAL-MUT-MAPPING-001',
      class: 'mapping',
      critical: true,
      rejected: mappingResult.status !== 'passed',
      ...mappingFailure
    },
    dataOutcome({
      id: 'EVAL-MUT-DELETE-001',
      class: 'delete',
      report: deleteReport,
      critical: true
    }),
    {
      id: 'EVAL-MUT-PRECISION-001',
      class: 'precision',
      critical: true,
      rejected: precisionReport.status !== 'passed',
      failedMeasures: precisionReport.totals.falseAccepts > 0 ? ['falseAccepts'] : [],
      evidence: precisionReport.totals.falseAccepts > 0 ? [corpus.id] : []
    },
    {
      id: 'EVAL-MUT-IDENTITY-001',
      class: 'identity',
      critical: true,
      rejected: identityResult.status !== 'passed',
      ...identityFailure
    },
    {
      id: 'EVAL-MUT-SECURITY-001',
      class: 'security',
      critical: true,
      rejected: securityResult.status !== 'passed',
      ...securityFailure
    },
    dataOutcome({
      id: 'EVAL-MUT-RECOVERY-001',
      class: 'recovery',
      report: recoveryReport,
      critical: true
    })
  ]

  const reorderedMapping = {
    description: mapping.description,
    decisionRef: mapping.decisionRef,
    evidenceRefs: mapping.evidenceRefs,
    sourceKey: mapping.sourceKey,
    targetEntity: mapping.targetEntity,
    sourceEntity: mapping.sourceEntity,
    schemaVersion: mapping.schemaVersion
  }
  const benignDescription = identityFixture.mutations.find((item) => item.class === 'benign')
  if (!benignDescription) {
    throw new Error('S1 fixture is missing its benign mapping mutation')
  }
  const benignIdentity = [
    ['EVAL-MUT-BENIGN-ORDER-001', evaluateIdentityMapping(identityFixture, reorderedMapping)],
    [
      'EVAL-MUT-BENIGN-DESCRIPTION-001',
      evaluateIdentityMapping(
        identityFixture,
        applyIdentityMappingMutation(mapping, benignDescription)
      )
    ]
  ] as const
  const benign: MutationOutcome[] = benignIdentity.map(([id, result]) => ({
    id,
    class: 'benign',
    critical: false,
    rejected: result.status !== 'passed',
    ...failedIdentityMeasures(result)
  }))
  benign.push(
    dataOutcome({
      id: 'EVAL-MUT-BENIGN-KEY-ORDER-001',
      class: 'benign',
      report: evaluateMovement({
        ...oracle,
        expectedFinalKeyDigests: oracle.expectedFinalKeyDigests.toReversed()
      }),
      critical: false
    }),
    {
      id: 'EVAL-MUT-BENIGN-PREDICTION-ORDER-001',
      class: 'benign',
      critical: false,
      rejected:
        evaluateSemanticLabels({
          corpus,
          predictions: predictions.toReversed(),
          evaluatorVersion: EVALUATOR_VERSIONS.semanticLabeled,
          evaluatedAt: EVALUATED_AT
        }).status !== 'passed',
      failedMeasures: [],
      evidence: []
    }
  )

  const criticalKilled = critical.filter((outcome) => outcome.rejected).length
  const falseRejections = benign.filter((outcome) => outcome.rejected).length
  const attributed = critical.filter(
    (outcome) => outcome.failedMeasures.length > 0 && outcome.evidence.length > 0
  ).length
  const baselinesPassed =
    baselineIdentity.status === 'passed' &&
    baselineMovement.status === 'passed' &&
    baselineSemantic.status === 'passed'
  const measures = [
    outcomeMeasure(
      'critical_mutation_kill_rate',
      criticalKilled === critical.length,
      { killed: criticalKilled, seeded: critical.length },
      'killed == seeded == 7',
      critical
    ),
    outcomeMeasure(
      'benign_false_rejections',
      falseRejections === 0,
      { rejected: falseRejections, seeded: benign.length },
      'rejected == 0',
      benign
    ),
    outcomeMeasure(
      'failure_attribution',
      attributed === critical.length,
      { attributed, seeded: critical.length },
      'every killed critical mutation names a failed measure and evidence',
      critical
    ),
    measure(
      'baseline_acceptance',
      baselinesPassed ? 'pass' : 'fail',
      {
        identity: baselineIdentity.status,
        dataMovement: baselineMovement.status,
        semantic: baselineSemantic.status
      },
      'all unmutated baselines pass',
      ['fixture-manifest.json', 'evidence_cdc_mutation_qualification', corpus.id]
    )
  ]
  const passed = measures.every((entry) => entry.status === 'pass')
  return {
    status: passed ? 'passed' : 'failed',
    summary: `${criticalKilled}/${critical.length} critical mutations killed; ${falseRejections}/${benign.length} benign mutations falsely rejected.`,
    measures,
    outputs: {
      fixtureSeed: seed,
      evaluatorVersions: canonicalizeJson(EVALUATOR_VERSIONS),
      critical: canonicalizeJson(critical),
      benign: canonicalizeJson(benign)
    },
    limitations: [
      'Synthetic S1 identity, CDC, and semantic fixtures; no clinical or production data semantics.'
    ]
  }
}
