import { z } from 'zod'
import { canonicalJson, canonicalizeJson, sha256Text } from './canonical-json.js'
import {
  createEvaluationMeasure as measure,
  type ExperimentResult
} from './experiment-contracts.js'
import {
  applyIdentityMappingMutation,
  buildIdentityMappingBaseline,
  evaluateIdentityMapping
} from './identity-mapping-evaluator.js'
import { checkCandidateKey } from './identity-key-probe.js'
import { validateOmpWorkerContract } from './omp-worker-contract-validation.js'
import { evaluateNegativeCase } from './s1-negative-case-policy.js'
import type { S1IdentityFixture } from './s1-fixture-contracts.js'
const ContainmentEvidenceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  experimentId: z.literal('EXP-10'),
  runId: z.string().min(1),
  status: z.literal('passed'),
  ompVersion: z.string().min(1),
  executableDigest: z.string().regex(/^[a-f0-9]{64}$/),
  protocolVersion: z.literal(2),
  maxPhysicalFrameBytes: z.number().int().positive(),
  maxReassembledFrameBytes: z.number().int().positive(),
  contextDeliveryDigest: z.string().regex(/^[a-f0-9]{64}$/),
  measures: z.array(
    z.strictObject({ name: z.string().min(1), passed: z.boolean(), evidence: z.string() })
  ),
  protocolFrameCategories: z.array(z.string().min(1)),
  startedAt: z.string().min(1),
  completedAt: z.string().min(1),
  reportDigest: z.string().regex(/^[a-f0-9]{64}$/)
})
const REQUIRED_CONTAINMENT_MEASURES = [
  'pinned-binary',
  'v2-negotiation',
  'subagent-containment',
  'host-tool-schema',
  'context-host-tool-artifact',
  'context-and-cancellation',
  'post-cancel-tool-effect',
  'flood-and-context-overflow',
  'malformed-frame',
  'crash-replacement',
  'bounded-observation'
] as const

export function calibrateS1Fixture(fixture: S1IdentityFixture): ExperimentResult {
  const probeComparisons = fixture.expected.probeResults.map((expected) => {
    const actual = checkCandidateKey(fixture, expected.columns)
    const comparable = {
      columns: actual.columns,
      rowCount: actual.rowCount,
      distinctCount: actual.distinctCount,
      nullCount: actual.nullCount,
      unique: actual.unique,
      duplicates: actual.duplicates
    }
    return {
      columns: expected.columns,
      matches: canonicalJson(comparable) === canonicalJson(expected)
    }
  })

  const baseline = buildIdentityMappingBaseline(fixture)
  const baselineEvaluation = evaluateIdentityMapping(fixture, baseline)
  const baselineMatches =
    canonicalJson(baseline) === canonicalJson(fixture.expected.acceptedMapping)

  const mutationResults = fixture.mutations.map((mutation) => {
    const subject = applyIdentityMappingMutation(baseline, mutation)
    const evaluation = evaluateIdentityMapping(fixture, subject)
    const failedMeasures = evaluation.measures
      .filter((entry) => entry.status === 'fail')
      .map((entry) => entry.name)
      .sort()
    return {
      id: mutation.id,
      expectedVerdict: mutation.expectedVerdict,
      actualVerdict: evaluation.status,
      expectedFailedMeasures: [...mutation.expectedFailedMeasures].sort(),
      actualFailedMeasures: failedMeasures,
      matches:
        evaluation.status === mutation.expectedVerdict &&
        canonicalJson(failedMeasures) === canonicalJson([...mutation.expectedFailedMeasures].sort())
    }
  })

  const negativeResults = fixture.negativeCases.map((testCase) => {
    const actual = evaluateNegativeCase(testCase)
    return {
      id: testCase.id,
      expected: testCase.expected,
      actual,
      matches: canonicalJson(actual) === canonicalJson(testCase.expected)
    }
  })
  const workerFailures = validateOmpWorkerContract(fixture.workerContract)

  const measures = [
    measure(
      'fixture_manifest_valid',
      'pass',
      { files: fixture.manifest.files.length, digest: fixture.manifestDigest },
      'all eight fixture files match pinned bytes and SHA-256',
      ['fixture-manifest.json']
    ),
    measure(
      'probe_oracle_matches',
      probeComparisons.every((entry) => entry.matches) ? 'pass' : 'fail',
      probeComparisons,
      'every computed probe equals expected result',
      ['observed-key-profile.json', 'expected-results.json']
    ),
    measure(
      'baseline_mapping_matches',
      baselineMatches && baselineEvaluation.status === 'passed' ? 'pass' : 'fail',
      { baselineMatches, evaluationStatus: baselineEvaluation.status },
      'baseline equals accepted mapping and passes all six measures',
      ['expected-results.json']
    ),
    measure(
      'mutations_calibrated',
      mutationResults.every((entry) => entry.matches) ? 'pass' : 'fail',
      mutationResults,
      'critical mutation fails named measures and benign mutation passes',
      ['mutations.json']
    ),
    measure(
      'negative_cases_calibrated',
      negativeResults.every((entry) => entry.matches) ? 'pass' : 'fail',
      negativeResults,
      'every isolation/injection case yields its expected disposition',
      ['negative-cases.json']
    ),
    measure(
      'worker_contract_complete',
      workerFailures.length === 0 ? 'pass' : 'fail',
      workerFailures,
      'pinned OMP contract has no validation failures',
      ['omp-worker-contract.json']
    )
  ]
  const failed = measures.filter((entry) => entry.status !== 'pass')
  return {
    status: failed.length === 0 ? 'passed' : 'failed',
    summary:
      failed.length === 0
        ? 'S1 fixture, oracle, mutations, negatives, and worker contract are calibrated.'
        : `S1 fixture calibration failed: ${failed.map((entry) => entry.name).join(', ')}.`,
    measures,
    outputs: {
      baseline: canonicalizeJson(baseline),
      baselineEvaluation: canonicalizeJson(baselineEvaluation),
      probeComparisons: canonicalizeJson(probeComparisons),
      mutationResults: canonicalizeJson(mutationResults),
      negativeResults: canonicalizeJson(negativeResults)
    },
    limitations: ['OMP executable behavior is specified but not exercised by fixture calibration.']
  }
}

export function inspectOmpWorkerFixture(
  fixture: S1IdentityFixture,
  containmentEvidence?: unknown
): ExperimentResult {
  const contractFailures = validateOmpWorkerContract(fixture.workerContract)
  const parsedEvidence =
    containmentEvidence === undefined
      ? null
      : ContainmentEvidenceSchema.safeParse(containmentEvidence)
  const evidenceFailures: string[] = []
  if (parsedEvidence !== null) {
    if (!parsedEvidence.success) {
      evidenceFailures.push('invalid_containment_report')
    } else {
      const report = parsedEvidence.data
      const { reportDigest, ...body } = report
      if (sha256Text(canonicalJson(body)) !== reportDigest) {
        evidenceFailures.push('containment_report_digest')
      }
      if (report.ompVersion !== `omp/${fixture.workerContract.requiredOmp.version}`) {
        evidenceFailures.push('omp_version')
      }
      if (
        report.maxPhysicalFrameBytes !== fixture.workerContract.requiredOmp.maxPhysicalFrameBytes ||
        report.maxReassembledFrameBytes !==
          fixture.workerContract.requiredOmp.maxReassembledFrameBytes
      ) {
        evidenceFailures.push('frame_limits')
      }
      const passedMeasures = new Set(
        report.measures.filter((entry) => entry.passed).map((entry) => entry.name)
      )
      if (REQUIRED_CONTAINMENT_MEASURES.some((name) => !passedMeasures.has(name))) {
        evidenceFailures.push('containment_measures')
      }
    }
  }
  const fixtureValid = contractFailures.length === 0
  const binaryExercised = parsedEvidence?.success === true && evidenceFailures.length === 0
  const status =
    !fixtureValid || evidenceFailures.length > 0
      ? 'failed'
      : binaryExercised
        ? 'passed'
        : 'inconclusive'
  return {
    status,
    summary:
      status === 'passed'
        ? 'Pinned OMP worker contract and real RPC/schema/cancel/artifact containment pass.'
        : status === 'inconclusive'
          ? 'OMP worker contract fixture is valid; real executable exercise remains required.'
          : `OMP worker contract failed: ${[...contractFailures, ...evidenceFailures].join(', ')}.`,
    measures: [
      measure(
        'worker_contract_valid',
        fixtureValid ? 'pass' : 'fail',
        contractFailures,
        'fixture validator reports no contract failures',
        ['omp-worker-contract.json']
      ),
      measure(
        'omp_binary_exercised',
        binaryExercised ? 'pass' : parsedEvidence === null ? 'unknown' : 'fail',
        binaryExercised,
        'pinned OMP binary completes RPC/schema/cancel/artifact probe',
        binaryExercised ? ['EXP-10 containment report'] : []
      )
    ],
    outputs: {
      workerContract: canonicalizeJson(fixture.workerContract),
      containmentReportDigest:
        parsedEvidence?.success === true ? parsedEvidence.data.reportDigest : null
    },
    limitations:
      status === 'inconclusive'
        ? ['P2-LAB-10 specifies the contract fixture only; provide a passing sealed EXP-10 report.']
        : []
  }
}
