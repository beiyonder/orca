import {
  DETERMINISTIC_EVALUATOR_SUITE,
  runDeterministicFixture
} from './deterministic-evaluator-fixture.js'

export const DETERMINISTIC_EVALUATOR_CONTRACT_SAMPLES = {
  'deterministic-evaluator-suite.v1': DETERMINISTIC_EVALUATOR_SUITE,
  'evaluation-deterministic-report.v1': runDeterministicFixture().report
} as const
