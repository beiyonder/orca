import { describe, expect, it } from 'vitest'
import {
  CorrectionCycleV1Schema,
  SubjectAcceptanceV1Schema
} from '../src/domain/acceptance-correction-contracts.js'
import {
  CorrectionCycleRegistry,
  markCorrectionEvaluating,
  recordCorrectedSubject,
  recordCorrectionResult,
  requestCorrection
} from '../src/correction-cycle-registry.js'
import { diagnoseEvaluationFailure } from '../src/evaluation-failure-diagnosis.js'
import {
  createFailureLearningCandidate,
  createSuccessLearningCandidate
} from '../src/learning-candidate-builder.js'
import {
  SubjectAcceptanceRegistry,
  advanceAcceptanceHypothesis,
  initializeSubjectAcceptance,
  reconcileSubjectAcceptance
} from '../src/subject-acceptance-registry.js'
import { CORRECTED_FLOW, FAILED_FLOW } from './correction-loop-fixture.js'

const candidateArtifact = {
  uri: 'artifact://learning/correction-lesson',
  sha256: 'a'.repeat(64),
  mediaType: 'application/json',
  bytes: 128,
  span: { kind: 'whole' as const }
}

function rejectedAcceptance() {
  const registry = new SubjectAcceptanceRegistry()
  const unknown = registry.record(
    initializeSubjectAcceptance({
      tenantId: 'tenant_s1',
      missionId: 'mission_s1',
      acceptanceKey: 'failed-migration-proposal',
      subject: FAILED_FLOW.subject,
      contract: FAILED_FLOW.dispatch.coordination.contract,
      createdAt: '2026-01-01T00:04:00.000Z'
    })
  )
  const hypothesis = registry.record(
    advanceAcceptanceHypothesis(unknown, '2026-01-01T00:04:10.000Z')
  )
  const rejected = registry.record(
    reconcileSubjectAcceptance({
      current: hypothesis,
      coordination: FAILED_FLOW.coordination,
      evidenceIds: FAILED_FLOW.output.result.evidence.map((evidence) => evidence.id),
      transitionedAt: '2026-01-01T00:05:10.000Z'
    })
  )
  return { registry, unknown, hypothesis, rejected }
}

function acceptedCorrection() {
  const registry = new SubjectAcceptanceRegistry()
  const unknown = registry.record(
    initializeSubjectAcceptance({
      tenantId: 'tenant_s1',
      missionId: 'mission_s1',
      acceptanceKey: 'corrected-migration-proposal',
      subject: CORRECTED_FLOW.subject,
      contract: CORRECTED_FLOW.dispatch.coordination.contract,
      createdAt: '2026-01-01T00:06:00.000Z'
    })
  )
  const hypothesis = registry.record(
    advanceAcceptanceHypothesis(unknown, '2026-01-01T00:06:10.000Z')
  )
  const supported = registry.record(
    reconcileSubjectAcceptance({
      current: hypothesis,
      coordination: CORRECTED_FLOW.coordination,
      evidenceIds: CORRECTED_FLOW.output.result.evidence.map((evidence) => evidence.id),
      transitionedAt: '2026-01-01T00:07:05.000Z'
    })
  )
  return registry.record(
    reconcileSubjectAcceptance({
      current: supported,
      coordination: CORRECTED_FLOW.coordination,
      evidenceIds: CORRECTED_FLOW.output.result.evidence.map((evidence) => evidence.id),
      transitionedAt: '2026-01-01T00:07:10.000Z'
    })
  )
}

describe('product acceptance and fixed-contract correction', () => {
  it('enforces product-owned unknown, hypothesis, rejected, and accepted transitions', () => {
    const { unknown, hypothesis, rejected } = rejectedAcceptance()
    expect([unknown.status, hypothesis.status, rejected.status]).toEqual([
      'unknown',
      'hypothesis',
      'rejected'
    ])
    expect(rejected.acceptanceAuthority).toBe('product-reconciler')
    expect(rejected.unsatisfiedPredicates).not.toEqual([])
    const accepted = acceptedCorrection()
    expect(accepted).toMatchObject({
      status: 'accepted',
      acceptanceAuthority: 'product-reconciler',
      unsatisfiedPredicates: []
    })
    expect(accepted.evaluationResultIds).toEqual([CORRECTED_FLOW.output.result.id])
  })

  it('cannot fabricate acceptance from producer or evaluator output', () => {
    const { hypothesis } = rejectedAcceptance()
    expect(
      SubjectAcceptanceV1Schema.safeParse({
        ...hypothesis,
        status: 'accepted',
        evaluationResultIds: [],
        satisfiedPredicates: [],
        acceptanceAuthority: 'none'
      }).success
    ).toBe(false)
  })

  it('converts exact failed measures into attributed gaps instead of generic retry', () => {
    const { rejected } = rejectedAcceptance()
    const { diagnosis, gaps } = diagnoseEvaluationFailure({
      acceptance: rejected,
      results: [FAILED_FLOW.output.result],
      diagnosedAt: '2026-01-01T00:05:20.000Z'
    })
    expect(diagnosis.genericRetryAllowed).toBe(false)
    expect(diagnosis.failedMeasures.map((measure) => measure.cause)).toContain('artifact-defect')
    expect(diagnosis.failedMeasures.map((measure) => measure.cause)).toContain(
      'authority-or-budget'
    )
    expect(gaps).toHaveLength(diagnosis.failedMeasures.length)
    expect(gaps.every((gap) => gap.state.status === 'open')).toBe(true)
  })

  it('produces a new subject version and passes the unchanged evaluator contract', () => {
    const { rejected } = rejectedAcceptance()
    const { diagnosis } = diagnoseEvaluationFailure({
      acceptance: rejected,
      results: [FAILED_FLOW.output.result],
      diagnosedAt: '2026-01-01T00:05:20.000Z'
    })
    const registry = new CorrectionCycleRegistry()
    const requested = registry.record(
      requestCorrection({
        acceptance: rejected,
        diagnosis,
        maxAttempts: 2,
        recordedAt: '2026-01-01T00:05:30.000Z'
      })
    )
    const produced = registry.record(
      recordCorrectedSubject({
        current: requested,
        correctedSubject: CORRECTED_FLOW.subject,
        changedPaths: ['/authority'],
        evidenceIds: [CORRECTED_FLOW.evidence.id],
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          toolCalls: 0,
          wallTimeMs: 50,
          costUsd: 0
        },
        recordedAt: '2026-01-01T00:06:10.000Z'
      })
    )
    const evaluating = registry.record(
      markCorrectionEvaluating(produced, '2026-01-01T00:06:20.000Z')
    )
    const passed = registry.record(
      recordCorrectionResult({
        current: evaluating,
        result: CORRECTED_FLOW.output.result,
        recordedAt: '2026-01-01T00:07:10.000Z'
      })
    )
    expect(passed.status).toBe('passed')
    expect(passed.fixedContract).toEqual(requested.fixedContract)
    expect(passed.originalSubject.version).toBe(1)
    expect(passed.correctedSubject?.version).toBe(2)
    expect(passed.thresholdChanged || passed.evaluatorChanged).toBe(false)
    expect(CorrectionCycleV1Schema.safeParse({ ...passed, thresholdChanged: true }).success).toBe(
      false
    )
  })

  it('creates only quarantined failure and success learning candidates', () => {
    const { rejected } = rejectedAcceptance()
    const { diagnosis } = diagnoseEvaluationFailure({
      acceptance: rejected,
      results: [FAILED_FLOW.output.result],
      diagnosedAt: '2026-01-01T00:05:20.000Z'
    })
    const failure = createFailureLearningCandidate({
      diagnosis,
      candidateType: 'memory',
      proposedArtifact: candidateArtifact,
      createdAt: '2026-01-01T00:05:30.000Z'
    })
    const success = createSuccessLearningCandidate({
      acceptance: acceptedCorrection(),
      candidateType: 'skill',
      proposedArtifact: candidateArtifact,
      createdAt: '2026-01-01T00:07:20.000Z'
    })
    for (const candidate of [failure, success]) {
      expect(candidate.state).toEqual({
        status: 'quarantined',
        usePolicy: 'none',
        validationStatus: 'not-run'
      })
      expect(candidate.authorityDelta).toBe('none')
    }
  })
})
