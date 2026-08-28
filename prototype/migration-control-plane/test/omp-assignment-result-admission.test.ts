import { describe, expect, it } from 'vitest'
import { canonicalJson, sha256Text } from '../src/canonical-json.js'
import {
  AssignmentResultAdmissionError,
  admitOmpAssignmentResult,
  encodeOmpAssignmentResultSubmission,
  type AssignmentResultAuthority
} from '../src/omp-assignment-result-admission.js'

const submittedAt = '2026-01-01T00:01:00.000Z'
const budget = {
  tokenLimit: 1_000,
  timeLimitMs: 10_000,
  toolCallLimit: 3,
  outputByteLimit: 10_000,
  costLimitUsd: 1
}
const usage = {
  inputTokens: 300,
  outputTokens: 200,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  toolCalls: 2,
  wallTimeMs: 2_000,
  costUsd: 0.1
}

function authority(overrides: Partial<AssignmentResultAuthority> = {}): AssignmentResultAuthority {
  return {
    tenantId: 'tenant_s1',
    missionId: 'mission_s1',
    resultId: 'assignment_result_s1',
    assignmentId: 'assignment_s1',
    attemptId: 'attempt_s1',
    fence: 4,
    attemptStatus: 'running',
    readableEvidenceIds: ['evidence_document', 'evidence_profile'],
    ownedArtifactVersionIds: ['artifact_version_s1'],
    knownGapIds: ['gap_identity_key'],
    knownPlanRevisionIds: ['plan_s1'],
    budget,
    ...overrides
  }
}

function success(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    type: 'assignment_result',
    assignmentId: 'assignment_s1',
    attemptId: 'attempt_s1',
    fence: 4,
    outcome: {
      status: 'succeeded',
      summary: 'The observed profile refutes the declared global key.',
      artifactVersionIds: ['artifact_version_s1'],
      evidenceIds: ['evidence_document', 'evidence_profile'],
      gapIds: ['gap_identity_key'],
      planRevisionIds: ['plan_s1']
    },
    limitations: ['Synthetic fixture only.'],
    ...overrides
  }
}

function admit(payload: string, authorityInput = authority(), usageInput = usage) {
  return admitOmpAssignmentResult({
    payload,
    reportedOutputDigest: sha256Text(payload),
    authority: authorityInput,
    usage: usageInput,
    submittedAt,
    submittedBy: { kind: 'specialist', id: 'mapping-specialist', version: '1' }
  })
}

function expectAdmissionError(operation: () => unknown, code: string): void {
  try {
    operation()
    throw new Error('Expected assignment result admission error')
  } catch (error) {
    if (!(error instanceof AssignmentResultAdmissionError)) {
      throw error
    }
    expect(error.code).toBe(code)
  }
}

describe('OMP assignment result admission', () => {
  it('turns a current strict submission into a host-owned proposal record', () => {
    const payload = encodeOmpAssignmentResultSubmission(success())
    const result = admit(payload)
    expect(result).toMatchObject({
      kind: 'assignment-result',
      id: 'assignment_result_s1',
      tenantId: 'tenant_s1',
      missionId: 'mission_s1',
      assignmentId: 'assignment_s1',
      attemptId: 'attempt_s1',
      fence: 4,
      outputDigest: sha256Text(payload),
      outcome: {
        status: 'succeeded',
        evidenceIds: ['evidence_document', 'evidence_profile'],
        gapIds: ['gap_identity_key']
      }
    })
    expect(result).not.toHaveProperty('outcome.summary')
  })

  it('rejects prose-only, omitted gap/evidence fields, empty evidence, and authority-bearing fields', () => {
    const successfulOutcome = success().outcome as Record<string, unknown>
    const withoutGapIds = { ...successfulOutcome }
    delete withoutGapIds.gapIds
    const withoutEvidenceIds = { ...successfulOutcome }
    delete withoutEvidenceIds.evidenceIds
    for (const invalid of [
      '"completed"',
      canonicalJson({ ...success(), outcome: withoutGapIds }),
      canonicalJson({ ...success(), outcome: withoutEvidenceIds }),
      canonicalJson({ ...success(), outcome: { ...successfulOutcome, evidenceIds: [] } }),
      canonicalJson({ ...success(), tenantId: 'tenant_attacker' })
    ]) {
      expectAdmissionError(() => admit(invalid), 'invalid_result')
    }
  })

  it('rejects stale, inactive, and mismatched assignment authority', () => {
    for (const [payload, changedAuthority] of [
      [canonicalJson(success({ attemptId: 'attempt_stale' })), authority()],
      [canonicalJson(success({ fence: 3 })), authority()],
      [canonicalJson(success()), authority({ attemptStatus: 'terminal' })]
    ] as const) {
      expectAdmissionError(
        () => admit(payload, changedAuthority),
        changedAuthority.attemptStatus === 'terminal' ? 'attempt_not_active' : 'stale_attempt'
      )
    }
  })

  it('rejects evidence, artifact, gap, and plan references outside owned/read scope', () => {
    const baseOutcome = success().outcome as Record<string, unknown>
    for (const changedOutcome of [
      { ...baseOutcome, evidenceIds: ['evidence_other'] },
      { ...baseOutcome, artifactVersionIds: ['artifact_version_other'] },
      { ...baseOutcome, gapIds: ['gap_other'] },
      { ...baseOutcome, planRevisionIds: ['plan_other'] }
    ]) {
      const payload = canonicalJson(success({ outcome: changedOutcome }))
      expectAdmissionError(() => admit(payload), 'reference_out_of_scope')
    }
  })

  it('rejects output digest, byte, token, time, tool, and cost budget violations', () => {
    const payload = canonicalJson(success())
    expectAdmissionError(
      () =>
        admitOmpAssignmentResult({
          payload,
          reportedOutputDigest: 'f'.repeat(64),
          authority: authority(),
          usage,
          submittedAt,
          submittedBy: { kind: 'specialist', id: 'mapping-specialist' }
        }),
      'output_digest_mismatch'
    )
    expectAdmissionError(
      () => admit(payload, authority({ budget: { ...budget, outputByteLimit: 1 } })),
      'output_too_large'
    )
    for (const changedUsage of [
      { ...usage, inputTokens: 900 },
      { ...usage, wallTimeMs: 10_001 },
      { ...usage, toolCalls: 4 },
      { ...usage, costUsd: 1.01 }
    ]) {
      expectAdmissionError(() => admit(payload, authority(), changedUsage), 'budget_exceeded')
    }
  })
})
