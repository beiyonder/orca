import { runDurableConvergenceExperiment } from './durable-convergence-experiment.js'
import {
  runCdcInferenceExperiment,
  runContradictionExperiment,
  runHiddenEstateExperiment
} from './discovery-phase-experiments.js'
import type { ExperimentResult } from './experiment-contracts.js'
import { runEvaluationMutationExperiment } from './evaluation-mutation-experiment.js'
import { runMemoryHelpHarmExperiment } from './memory-help-harm-experiment.js'
import { runProcessObligationCompletenessExperiment } from './process-obligation-completeness-experiment.js'
import { runRetrievalBenchmarkExperiment } from './retrieval-benchmark-experiment.js'
import {
  runSafeEffectIsolationExperiment,
  runSafeEffectKillPointExperiment
} from './safe-effect-experiment.js'
import { runSpecialistDisagreementExperiment } from './specialist-disagreement-experiment.js'
import { runSkillLifecycleExperiment } from './skill-lifecycle-experiment.js'

export async function executePhaseExperiment(
  experimentId: string,
  seed: number,
  labRoot: string
): Promise<ExperimentResult | null> {
  switch (experimentId) {
    case 'EXP-02': {
      const connectionString = process.env.PAGILA_DISCOVERY_DATABASE_URL
      if (!connectionString) {
        throw new Error('PAGILA_DISCOVERY_DATABASE_URL is required for EXP-02')
      }
      return runContradictionExperiment(connectionString, labRoot)
    }
    case 'EXP-03': {
      const connectionString = process.env.PAGILA_DISCOVERY_DATABASE_URL
      if (!connectionString) {
        throw new Error('PAGILA_DISCOVERY_DATABASE_URL is required for EXP-03')
      }
      return runHiddenEstateExperiment(connectionString, labRoot)
    }
    case 'EXP-04':
      return runCdcInferenceExperiment(labRoot)
    case 'EXP-05':
      return runSpecialistDisagreementExperiment(seed)
    case 'EXP-06':
      return runRetrievalBenchmarkExperiment(seed)
    case 'EXP-07':
      return runMemoryHelpHarmExperiment(seed)
    case 'EXP-08':
      return runEvaluationMutationExperiment(labRoot, seed)
    case 'EXP-09':
      return runSkillLifecycleExperiment(seed)
    case 'EXP-11':
    case 'EXP-12': {
      const connectionString = process.env.MIGRATION_CONTROL_TARGET_DATABASE_URL
      if (!connectionString) {
        throw new Error(`MIGRATION_CONTROL_TARGET_DATABASE_URL is required for ${experimentId}`)
      }
      return experimentId === 'EXP-11'
        ? runSafeEffectKillPointExperiment(connectionString, seed)
        : runSafeEffectIsolationExperiment(connectionString, seed)
    }
    case 'EXP-13': {
      const connectionString = process.env.MIGRATION_CONTROL_TARGET_DATABASE_URL
      if (!connectionString) {
        throw new Error('MIGRATION_CONTROL_TARGET_DATABASE_URL is required for EXP-13')
      }
      return runProcessObligationCompletenessExperiment(connectionString, seed)
    }
    case 'DUR-EXP-01': {
      const connectionString = process.env.MIGRATION_CONTROL_DATABASE_URL
      if (!connectionString) {
        throw new Error('MIGRATION_CONTROL_DATABASE_URL is required for DUR-EXP-01')
      }
      return runDurableConvergenceExperiment(connectionString, seed)
    }
    default:
      return null
  }
}
