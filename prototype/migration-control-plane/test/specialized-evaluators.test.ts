import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { sha256Text } from '../src/canonical-json.js'
import { analyzeCdcBehavior } from '../src/cdc-behavior-analyzer.js'
import { evaluateDataMovement } from '../src/data-movement-evaluator.js'
import { loadDiscoveryQualificationFixture } from '../src/discovery-qualification-fixture.js'
import { evaluateArtifactBuild } from '../src/artifact-build-evaluator.js'
import {
  evaluateSemanticLabels,
  type SemanticPrediction
} from '../src/semantic-labeled-evaluator.js'
import {
  ARTIFACT_BUILD_BUNDLE,
  SEMANTIC_LABELED_CORPUS,
  SEMANTIC_PREDICTIONS
} from './specialized-evaluator-contract-samples.js'

const discoveryRoot = fileURLToPath(new URL('../fixtures/p6-discovery-cases-v1/', import.meta.url))
const evaluatedAt = '2026-01-01T00:21:00.000Z'

async function dataFixture() {
  const fixture = await loadDiscoveryQualificationFixture(discoveryRoot)
  const analysis = analyzeCdcBehavior(fixture.cdcTrace, {
    analysisId: 'source_cdc_analysis_data_evaluation',
    analyzedAt: evaluatedAt,
    analyzedBy: { kind: 'evaluator', id: 'data-movement', version: '1' }
  })
  const oracle = {
    expectedFinalRecordCount: 2,
    expectedFinalKeyDigests: [
      'fa93c5826950365c98075d96130f13d0319cdd3833a19bfe8074f5967c9a336a',
      'dbfdb00caa87e5b94a24d3eebd662d5e5455305dfc334a2f1e53ad886983e9d3'
    ],
    expectedDeleteSequences: [6],
    expectedFinalPosition: '009',
    expectedFinalResumeToken: 'checkpoint-008'
  }
  return { fixture, analysis, oracle }
}

describe('specialized evaluation breadth', () => {
  it('passes exact counts, keys, delete, order, watermark, replay, and dispositions', async () => {
    const { fixture, analysis, oracle } = await dataFixture()
    const report = evaluateDataMovement({
      trace: fixture.cdcTrace,
      analysis,
      oracle,
      evidenceIds: ['evidence_cdc_report'],
      evaluatedAt
    })
    expect(report.status).toBe('passed')
    expect(Object.values(report.checks).every(Boolean)).toBe(true)
    expect(report.observed).toMatchObject({
      finalRecordCount: 2,
      appliedDeleteSequences: [6],
      finalPosition: '009',
      finalResumeToken: 'checkpoint-008',
      dispositionCount: 10,
      invalidDispositionCount: 0
    })
  })

  it('localizes data count, key, delete, ordering, watermark, and disposition defects', async () => {
    const { fixture, analysis, oracle } = await dataFixture()
    const wrongOracle = {
      ...oracle,
      expectedFinalRecordCount: 3,
      expectedFinalKeyDigests: oracle.expectedFinalKeyDigests.slice(0, 1),
      expectedDeleteSequences: [],
      expectedFinalPosition: '010'
    }
    const report = evaluateDataMovement({
      trace: fixture.cdcTrace,
      analysis: {
        ...analysis,
        semantics: { ...analysis.semantics, ordering: 'unordered' },
        eventDispositions: analysis.eventDispositions.slice(0, -1)
      },
      oracle: wrongOracle,
      evidenceIds: ['evidence_cdc_report'],
      evaluatedAt
    })
    expect(report.status).toBe('failed')
    expect(report.checks).toMatchObject({
      countsExact: false,
      keysExact: false,
      deletesComplete: false,
      orderingValid: false,
      watermarkExact: false,
      replayExact: false,
      dispositionsComplete: false
    })
  })

  it('builds a generated TypeScript bundle twice with exact provenance and digest', async () => {
    const report = await evaluateArtifactBuild({ bundle: ARTIFACT_BUILD_BUNDLE, evaluatedAt })
    expect(report.status).toBe('passed')
    expect(report.checks).toEqual({
      manifestValid: true,
      digestsExact: true,
      provenanceComplete: true,
      cleanBuildPassed: true,
      rebuildDigestExact: true
    })
    expect(report.emittedDigest).toMatch(/^[a-f0-9]{64}$/)
  })

  it('detects compilation, compiler-envelope, provenance, and path defects', async () => {
    const compileFailure = structuredClone(ARTIFACT_BUILD_BUNDLE)
    compileFailure.files[0]!.content = 'export const broken: string = 42\n'
    compileFailure.files[0]!.sha256 = sha256Text(compileFailure.files[0]!.content)
    expect(await evaluateArtifactBuild({ bundle: compileFailure, evaluatedAt })).toMatchObject({
      status: 'failed',
      checks: { cleanBuildPassed: false, rebuildDigestExact: false }
    })

    const compilerDrift = structuredClone(ARTIFACT_BUILD_BUNDLE)
    compilerDrift.compiler.version = '0.0.0'
    expect(await evaluateArtifactBuild({ bundle: compilerDrift, evaluatedAt })).toMatchObject({
      status: 'failed',
      checks: { manifestValid: false }
    })

    const missingProvenance = structuredClone(ARTIFACT_BUILD_BUNDLE)
    missingProvenance.provenanceEvidenceIds = []
    await expect(
      evaluateArtifactBuild({ bundle: missingProvenance, evaluatedAt })
    ).rejects.toThrow()

    const escapingPath = structuredClone(ARTIFACT_BUILD_BUNDLE)
    escapingPath.files[0]!.path = '../index.ts'
    await expect(evaluateArtifactBuild({ bundle: escapingPath, evaluatedAt })).rejects.toThrow()
  })

  it('scores a complete held-out semantic corpus without exposing labels to producers', () => {
    const report = evaluateSemanticLabels({
      corpus: SEMANTIC_LABELED_CORPUS,
      predictions: SEMANTIC_PREDICTIONS,
      evaluatorVersion: '1',
      evaluatedAt
    })
    expect(SEMANTIC_LABELED_CORPUS.labelsVisibleToProducer).toBe(false)
    expect(report).toMatchObject({
      status: 'passed',
      totals: {
        cases: 10,
        correct: 10,
        incorrect: 0,
        abstained: 0,
        disagreements: 0,
        falseAccepts: 0,
        accuracy: 1
      }
    })
  })

  it('keeps semantic false accepts, abstention, and disagreement explicit', () => {
    const falseAccept: SemanticPrediction[] = structuredClone(SEMANTIC_PREDICTIONS)
    const rejectCase = SEMANTIC_LABELED_CORPUS.cases.find((item) => item.label === 'reject')!
    const wrong = falseAccept.find((item) => item.caseId === rejectCase.id)!
    wrong.primary = 'accept'
    wrong.secondary = 'accept'
    expect(
      evaluateSemanticLabels({
        corpus: SEMANTIC_LABELED_CORPUS,
        predictions: falseAccept,
        evaluatorVersion: '1',
        evaluatedAt
      })
    ).toMatchObject({ status: 'failed', totals: { falseAccepts: 1 } })

    const abstained: SemanticPrediction[] = structuredClone(SEMANTIC_PREDICTIONS)
    abstained[0]!.primary = null
    expect(
      evaluateSemanticLabels({
        corpus: SEMANTIC_LABELED_CORPUS,
        predictions: abstained,
        evaluatorVersion: '1',
        evaluatedAt
      })
    ).toMatchObject({ status: 'inconclusive', totals: { abstained: 1 } })

    const disagreement: SemanticPrediction[] = structuredClone(SEMANTIC_PREDICTIONS)
    disagreement[0]!.secondary = disagreement[0]!.primary === 'accept' ? 'reject' : 'accept'
    expect(
      evaluateSemanticLabels({
        corpus: SEMANTIC_LABELED_CORPUS,
        predictions: disagreement,
        evaluatorVersion: '1',
        evaluatedAt
      })
    ).toMatchObject({ status: 'inconclusive', totals: { disagreements: 1 } })
  })
})
