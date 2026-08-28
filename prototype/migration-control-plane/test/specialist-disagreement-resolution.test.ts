import { describe, expect, it } from 'vitest'
import { canonicalJson, sha256Text } from '../src/canonical-json.js'
import {
  SpecialistDisagreementError,
  resolveSpecialistDisagreement
} from '../src/specialist-disagreement-resolution.js'
import type { SpecialistRole } from '../src/specialist-agent-contracts.js'
import { specialistFixtureDigest, specialistResult } from './specialist-agent-fixture.js'

const createdAt = '2026-01-01T00:03:00.000Z'

function claimedResult(
  role: SpecialistRole,
  stance: 'supports' | 'refutes',
  evidenceId: string,
  identitySuffix: string = role
): Record<string, unknown> {
  const base = specialistResult(role)
  const outcome = base.outcome as Record<string, unknown>
  const claims = outcome.claims as Record<string, unknown>[]
  const claim = claims[0]!
  const citations = claim.citations as Record<string, unknown>[]
  return {
    ...base,
    assignmentId: `assignment_${identitySuffix}`,
    attemptId: `attempt_${identitySuffix}`,
    outcome: {
      ...outcome,
      claims: [
        {
          ...claim,
          stance,
          statement:
            stance === 'supports'
              ? 'patient_num is globally unique.'
              : 'patient_num repeats across facilities.',
          citations: [
            {
              ...citations[0],
              evidenceId,
              evidenceDigest: specialistFixtureDigest
            }
          ]
        }
      ],
      evidenceIds: [evidenceId]
    }
  }
}

function probe(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    probeId: 'probe_candidate_key',
    probeKey: 'candidate-key-uniqueness',
    question: 'Does patient_num have duplicates across facilities?',
    predictedOutcomes: { supports: 'zero duplicates', refutes: 'one or more duplicates' },
    basisEvidenceIds: ['evidence_document', 'evidence_profile'],
    authority: 'read-only',
    sideEffect: 'none',
    deterministic: true,
    costUsd: 0,
    timeLimitMs: 1_000,
    rowLimit: 1_000,
    ...overrides
  }
}

function input(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    tenantId: 'tenant_s1',
    missionId: 'mission_s1',
    missionRevision: 7,
    propositionKey: 'source.identity-key',
    results: [
      claimedResult('source-forensics', 'supports', 'evidence_document'),
      claimedResult('mapping', 'refutes', 'evidence_profile')
    ],
    probeCandidates: [probe()],
    remainingProbeBudget: { costUsd: 1, timeLimitMs: 5_000, rowLimit: 10_000 },
    ...overrides
  }
}

function expectDisagreementError(operation: () => unknown, code: string): void {
  try {
    operation()
    throw new Error('Expected specialist disagreement error')
  } catch (error) {
    if (!(error instanceof SpecialistDisagreementError)) {
      throw error
    }
    expect(error.code).toBe(code)
  }
}

describe('specialist disagreement resolution', () => {
  it('preserves both cited results and requests the cheapest discriminating probe', () => {
    const expensive = probe({
      probeId: 'probe_expensive',
      costUsd: 0.5,
      timeLimitMs: 2_000
    })
    const resolution = resolveSpecialistDisagreement(
      input({ probeCandidates: [expensive, probe()] }),
      createdAt
    )
    expect(resolution).toMatchObject({
      propositionKey: 'source.identity-key',
      contradiction: {
        preservedStances: ['refutes', 'supports'],
        resultRefs: [
          { assignmentId: 'assignment_mapping', stance: 'refutes' },
          { assignmentId: 'assignment_source-forensics', stance: 'supports' }
        ]
      },
      gap: { severity: 'blocker' },
      evidenceIds: ['evidence_document', 'evidence_profile'],
      resolution: {
        status: 'probe-requested',
        probe: { probeId: 'probe_candidate_key', authority: 'read-only', sideEffect: 'none' }
      },
      authority: 'proposal-only'
    })
    const { resolutionDigest, ...body } = resolution
    expect(resolutionDigest).toBe(sha256Text(canonicalJson(body)))
  })

  it('does not let a specialist majority silently resolve a conflict', () => {
    const base = input()
    const results = base.results as Record<string, unknown>[]
    const majority = [
      ...results,
      claimedResult('research', 'supports', 'evidence_document', 'research_second')
    ]
    const resolution = resolveSpecialistDisagreement(
      input({ results: majority, probeCandidates: [] }),
      createdAt
    )
    expect(resolution.contradiction.resultRefs).toHaveLength(3)
    expect(resolution.resolution).toMatchObject({ status: 'unresolved-tie' })
    expect(resolution).not.toHaveProperty('selectedStance')
  })

  it('leaves nondiscriminating, over-budget, or unsupported probes as explicit ties', () => {
    for (const candidate of [
      probe({ predictedOutcomes: { supports: 'same', refutes: 'same' } }),
      probe({ costUsd: 2 }),
      probe({ basisEvidenceIds: ['evidence_other'] }),
      probe({ deterministic: false })
    ]) {
      const resolution = resolveSpecialistDisagreement(
        input({ probeCandidates: [candidate] }),
        createdAt
      )
      expect(resolution.resolution).toMatchObject({
        status: 'unresolved-tie',
        missingDiscriminator: expect.any(String)
      })
    }
  })

  it('rejects cross-state, duplicate, non-yielded, and non-conflicting inputs', () => {
    const base = input()
    const results = base.results as Record<string, unknown>[]
    expectDisagreementError(
      () =>
        resolveSpecialistDisagreement(
          input({ results: [{ ...results[0], missionRevision: 6 }, results[1]] }),
          createdAt
        ),
      'result_binding_mismatch'
    )
    expectDisagreementError(
      () => resolveSpecialistDisagreement(input({ results: [results[0], results[0]] }), createdAt),
      'duplicate_result'
    )
    expectDisagreementError(
      () =>
        resolveSpecialistDisagreement(
          input({
            results: [
              results[0],
              {
                ...results[1],
                outcome: { status: 'failed', errorCode: 'x', message: 'x', retryable: false }
              }
            ]
          }),
          createdAt
        ),
      'non_yielded_result'
    )
    expectDisagreementError(
      () =>
        resolveSpecialistDisagreement(
          input({
            results: [results[0], claimedResult('mapping', 'supports', 'evidence_profile')]
          }),
          createdAt
        ),
      'no_material_disagreement'
    )
  })

  it('rejects missing or duplicated proposition claims', () => {
    const base = input()
    const results = base.results as Record<string, unknown>[]
    const first = results[0]!
    const firstOutcome = first.outcome as Record<string, unknown>
    expectDisagreementError(
      () =>
        resolveSpecialistDisagreement(
          input({ results: [{ ...first, outcome: { ...firstOutcome, claims: [] } }, results[1]] }),
          createdAt
        ),
      'claim_cardinality'
    )
    const claims = firstOutcome.claims as unknown[]
    expectDisagreementError(
      () =>
        resolveSpecialistDisagreement(
          input({
            results: [
              { ...first, outcome: { ...firstOutcome, claims: [claims[0], claims[0]] } },
              results[1]
            ]
          }),
          createdAt
        ),
      'claim_cardinality'
    )
  })

  it('produces the same resolution regardless of specialist or probe arrival order', () => {
    const original = input({
      probeCandidates: [probe({ probeId: 'probe_b' }), probe({ probeId: 'probe_a' })]
    })
    const results = original.results as unknown[]
    const probes = original.probeCandidates as unknown[]
    const reversed = {
      ...original,
      results: results.toReversed(),
      probeCandidates: probes.toReversed()
    }
    expect(resolveSpecialistDisagreement(original, createdAt)).toEqual(
      resolveSpecialistDisagreement(reversed, createdAt)
    )
  })
})
