import { canonicalizeJson, sha256Text } from './canonical-json.js'
import {
  createEvaluationMeasure as measure,
  type ExperimentResult
} from './experiment-contracts.js'
import {
  resolveSpecialistDisagreement,
  type SpecialistDisagreementResolution
} from './specialist-disagreement-resolution.js'
import { SpecialistResultSchema, type SpecialistRole } from './specialist-agent-contracts.js'

export type SpecialistDisagreementCaseResult = {
  caseId: string
  resolvable: boolean
  expectedProbeId: string | null
  resolution: SpecialistDisagreementResolution
  choiceCorrect: boolean
  citationsComplete: boolean
  tieExplicit: boolean
}

function result(
  caseId: string,
  role: SpecialistRole,
  stance: 'supports' | 'refutes',
  evidenceId: string
) {
  const roleOutput =
    role === 'source-forensics'
      ? { kind: 'source-forensics' as const, inventoryFindings: [`${caseId} source claim`] }
      : { kind: 'mapping' as const, mappingProposals: [`${caseId} mapping claim`] }
  return SpecialistResultSchema.parse({
    schemaVersion: 1,
    type: 'specialist_result',
    tenantId: 'tenant_exp05',
    missionId: 'mission_exp05',
    missionRevision: 1,
    planRevisionId: 'plan_exp05',
    assignmentId: `assignment_${caseId}_${role}`,
    attemptId: `attempt_${caseId}_${role}`,
    fence: 1,
    role,
    contractVersion: 1,
    contextManifestId: `context_${caseId}_${role}`,
    outcome: {
      status: 'yielded',
      roleOutput,
      claims: [
        {
          propositionKey: `proposition.${caseId}`,
          stance,
          statement:
            stance === 'supports'
              ? `${caseId}: declared key is globally unique.`
              : `${caseId}: observed key repeats across facilities.`,
          citations: [
            {
              itemId: `${caseId}_${role}_item`,
              evidenceId,
              evidenceVersion: 1,
              evidenceDigest: sha256Text(`${caseId}:${role}:${stance}`),
              span: { kind: 'whole' }
            }
          ],
          limitations: ['Synthetic disagreement benchmark.']
        }
      ],
      evidenceIds: [evidenceId],
      artifactRefs: [],
      gapProposals: [],
      proposedFollowups: []
    },
    submittedAt: '2026-01-01T00:00:00.000Z'
  })
}

function runCase(index: number, seed: number): SpecialistDisagreementCaseResult {
  const caseId = `case_${String(index).padStart(2, '0')}`
  const resolvable = index <= 15
  const evidenceIds = [`evidence_${caseId}_claim`, `evidence_${caseId}_observation`]
  const results = [
    result(caseId, 'source-forensics', 'supports', evidenceIds[0]!),
    result(caseId, 'mapping', 'refutes', evidenceIds[1]!)
  ]
  if ((seed + index) % 2 === 1) {
    results.reverse()
  }
  const expectedProbeId = resolvable ? `probe_${caseId}_discriminator` : null
  const candidates = resolvable
    ? [
        {
          probeId: expectedProbeId,
          probeKey: 'candidate-key-uniqueness',
          question: 'Does the candidate key have duplicates across the observed scope?',
          predictedOutcomes: {
            supports: 'zero duplicates',
            refutes: 'one or more duplicates'
          },
          basisEvidenceIds: evidenceIds,
          authority: 'read-only',
          sideEffect: 'none',
          deterministic: true,
          costUsd: 0,
          timeLimitMs: 1_000,
          rowLimit: 10_000
        },
        {
          probeId: `probe_${caseId}_nondiscriminating`,
          probeKey: 'row-count',
          question: 'How many rows exist?',
          predictedOutcomes: { supports: 'six rows', refutes: 'six rows' },
          basisEvidenceIds: evidenceIds,
          authority: 'read-only',
          sideEffect: 'none',
          deterministic: true,
          costUsd: 0,
          timeLimitMs: 100,
          rowLimit: 10_000
        }
      ]
    : []
  if ((seed + index) % 3 === 0) {
    candidates.reverse()
  }
  const resolution = resolveSpecialistDisagreement(
    {
      schemaVersion: 1,
      tenantId: 'tenant_exp05',
      missionId: 'mission_exp05',
      missionRevision: 1,
      propositionKey: `proposition.${caseId}`,
      results,
      probeCandidates: candidates,
      remainingProbeBudget: { costUsd: 1, timeLimitMs: 5_000, rowLimit: 20_000 }
    },
    new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString()
  )
  const choiceCorrect =
    resolvable &&
    resolution.resolution.status === 'probe-requested' &&
    resolution.resolution.probe.probeId === expectedProbeId
  const citationsComplete =
    resolution.evidenceIds.length === 2 &&
    results.every(
      (specialistResult) =>
        specialistResult.outcome.status === 'yielded' &&
        specialistResult.outcome.claims.every((claim) => claim.citations.length > 0)
    )
  const tieExplicit = !resolvable && resolution.resolution.status === 'unresolved-tie'
  return {
    caseId,
    resolvable,
    expectedProbeId,
    resolution,
    choiceCorrect,
    citationsComplete,
    tieExplicit
  }
}

export function runSpecialistDisagreementExperiment(seed: number): ExperimentResult {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new TypeError('Specialist disagreement seed must be a non-negative safe integer')
  }
  const cases = Array.from({ length: 20 }, (_, index) => runCase(index + 1, seed))
  const resolvableCases = cases.filter((testCase) => testCase.resolvable)
  const trueTies = cases.filter((testCase) => !testCase.resolvable)
  const correctChoices = resolvableCases.filter((testCase) => testCase.choiceCorrect).length
  const citedCases = cases.filter((testCase) => testCase.citationsComplete).length
  const explicitTies = trueTies.filter((testCase) => testCase.tieExplicit).length
  const status =
    correctChoices >= 14 && citedCases === 20 && explicitTies === 5 ? 'passed' : 'failed'
  return {
    status,
    summary: `${correctChoices}/15 resolvable choices correct; ${citedCases}/20 cited; ${explicitTies}/5 true ties explicit.`,
    measures: [
      measure(
        'supported_choice_accuracy',
        correctChoices >= 14 ? 'pass' : 'fail',
        { correct: correctChoices, total: 15 },
        'at least 14 of 15 resolvable choices correct',
        cases.filter((testCase) => testCase.choiceCorrect).map((testCase) => testCase.caseId)
      ),
      measure(
        'choice_citation_coverage',
        citedCases === 20 ? 'pass' : 'fail',
        { cited: citedCases, total: 20 },
        'every resolution preserves claim-level citations',
        cases.filter((testCase) => testCase.citationsComplete).map((testCase) => testCase.caseId)
      ),
      measure(
        'true_tie_abstention',
        explicitTies === 5 ? 'pass' : 'fail',
        { explicit: explicitTies, total: 5 },
        'all five genuinely unresolved cases remain explicit ties',
        trueTies.filter((testCase) => testCase.tieExplicit).map((testCase) => testCase.caseId)
      )
    ],
    outputs: { cases: canonicalizeJson(cases) },
    limitations: [
      'Synthetic deterministic disagreements; semantic specialist quality remains model-dependent.'
    ]
  }
}
