import { ACCEPTANCE_CORRECTION_CONTRACT_SAMPLES } from './acceptance-correction-contract-samples.js'
import { DETERMINISTIC_EVALUATOR_CONTRACT_SAMPLES } from './deterministic-evaluator-contract-samples.js'
import { EVALUATION_CONTRACT_V2_SAMPLES } from './evaluation-contract-v2-samples.js'
import { EVALUATION_COORDINATION_CONTRACT_SAMPLES } from './evaluation-coordination-contract-samples.js'
import { SPECIALIZED_EVALUATOR_CONTRACT_SAMPLES } from './specialized-evaluator-contract-samples.js'

export const EVALUATION_CONTRACT_SAMPLES = {
  ...ACCEPTANCE_CORRECTION_CONTRACT_SAMPLES,
  ...DETERMINISTIC_EVALUATOR_CONTRACT_SAMPLES,
  ...EVALUATION_CONTRACT_V2_SAMPLES,
  ...EVALUATION_COORDINATION_CONTRACT_SAMPLES,
  ...SPECIALIZED_EVALUATOR_CONTRACT_SAMPLES
} as const
