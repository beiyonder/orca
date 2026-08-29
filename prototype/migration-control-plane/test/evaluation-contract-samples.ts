import { EVALUATION_CONTRACT_V2_SAMPLES } from './evaluation-contract-v2-samples.js'
import { EVALUATION_COORDINATION_CONTRACT_SAMPLES } from './evaluation-coordination-contract-samples.js'

export const EVALUATION_CONTRACT_SAMPLES = {
  ...EVALUATION_CONTRACT_V2_SAMPLES,
  ...EVALUATION_COORDINATION_CONTRACT_SAMPLES
} as const
