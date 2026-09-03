import { Pool } from 'pg'
import {
  createEvaluationMeasure as measure,
  type EvaluationMeasure,
  type ExperimentResult
} from './experiment-contracts.js'
import { runProcessObligationBenignCampaign } from './process-obligation-benign-campaign.js'
import type {
  ProcessCompletenessCampaign,
  ProcessCompletenessCaseResult
} from './process-obligation-completeness-types.js'
import { runProcessObligationCriticalCampaign } from './process-obligation-critical-campaign.js'

function categoryMeasure(
  name: string,
  category: string,
  cases: ProcessCompletenessCaseResult[]
): EvaluationMeasure {
  const selected = cases.filter((testCase) => testCase.signals.includes(category))
  const passed = selected.filter((testCase) => testCase.passed).length
  return measure(
    name,
    selected.length > 0 && passed === selected.length ? 'pass' : 'fail',
    { passed, total: selected.length },
    'every seeded case for this authority passes',
    selected.map((testCase) => testCase.name)
  )
}

function campaignPassed(campaign: ProcessCompletenessCampaign): boolean {
  return (
    campaign.cases.every((testCase) => testCase.passed) &&
    campaign.crossTenantEffects === 0 &&
    campaign.unauthorizedWaivers === 0 &&
    campaign.duplicateBreaches === 0 &&
    campaign.exactRebuild &&
    campaign.boundedDetection &&
    campaign.genericRetries === 0
  )
}

export async function runProcessObligationCompletenessExperiment(
  connectionString: string,
  seed: number
): Promise<ExperimentResult> {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new TypeError('EXP-13 seed must be a nonnegative safe integer')
  }
  const pool = new Pool({ connectionString, max: 8 })
  try {
    const critical = await runProcessObligationCriticalCampaign(pool, seed)
    const benign = await runProcessObligationBenignCampaign(pool, seed)
    const allCases = [...critical.cases, ...benign.cases]
    const criticalDetected = critical.cases.filter((testCase) => testCase.passed).length
    const benignFalsePositives = benign.cases.filter((testCase) => !testCase.passed).length
    const safety = {
      crossTenantEffects: critical.crossTenantEffects + benign.crossTenantEffects,
      unauthorizedWaivers: critical.unauthorizedWaivers + benign.unauthorizedWaivers,
      duplicateBreaches: critical.duplicateBreaches + benign.duplicateBreaches,
      exactRebuild: critical.exactRebuild && benign.exactRebuild,
      boundedDetection: critical.boundedDetection && benign.boundedDetection,
      genericRetries: critical.genericRetries + benign.genericRetries
    }
    const measures = [
      measure(
        'critical_omissions_detected',
        criticalDetected === 16 ? 'pass' : 'fail',
        criticalDetected,
        '16/16',
        critical.cases.map((testCase) => testCase.name)
      ),
      measure(
        'benign_false_positives',
        benignFalsePositives === 0 ? 'pass' : 'fail',
        benignFalsePositives,
        '0/8',
        benign.cases.map((testCase) => testCase.name)
      ),
      categoryMeasure('definition_coverage', 'definition-coverage', allCases),
      categoryMeasure('obligation_instantiation', 'obligation-instantiation', allCases),
      categoryMeasure('proof_admission', 'proof-admission', allCases),
      categoryMeasure('breach_detection', 'breach-detection', allCases),
      categoryMeasure('response_selection', 'response-selection', allCases),
      categoryMeasure('monitor_recovery', 'monitor-recovery', allCases),
      measure(
        'safety_invariants',
        Object.values(safety).every((value) => value === 0 || value === true) ? 'pass' : 'fail',
        safety,
        'zero tenant effects, unauthorized waivers, duplicate breaches, and retries; exact bounded replay',
        []
      )
    ]
    const passed =
      critical.cases.length === 16 &&
      benign.cases.length === 8 &&
      campaignPassed(critical) &&
      campaignPassed(benign) &&
      measures.every((item) => item.status === 'pass')
    return {
      status: passed ? 'passed' : 'failed',
      summary: passed
        ? '16/16 critical process omissions detected; 0/8 benign controls falsely rejected.'
        : `EXP-13 failed: ${criticalDetected}/16 critical detected; ${benignFalsePositives}/8 benign false positives.`,
      measures,
      outputs: {
        seed,
        criticalCases: critical.cases,
        benignCases: benign.cases,
        safety,
        externalEffects: 0
      },
      limitations: [
        'Qualification uses isolated disposable PostgreSQL tenants and fixed-code fixtures; production scheduling and alert delivery remain deployment concerns.'
      ]
    }
  } finally {
    await pool.end()
  }
}
