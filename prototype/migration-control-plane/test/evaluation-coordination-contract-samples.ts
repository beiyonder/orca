import { coordinateEvaluationDispatch } from '../src/evaluation-dispatch-coordinator.js'
import { EVALUATION_V2_BUNDLE } from './evaluation-contract-v2-samples.js'

const bundle = EVALUATION_V2_BUNDLE

export const EVALUATION_COORDINATION_DISPATCH = coordinateEvaluationDispatch({
  tenantId: bundle.evaluationAssignment.tenantId,
  missionId: bundle.evaluationAssignment.missionId,
  coordinationKey: 'schema-evaluation',
  createdAt: bundle.evaluationAssignment.createdAt,
  resultDeadlineAt: bundle.evaluationAssignment.deadlineAt,
  contract: bundle.evaluationContract,
  evaluatorDefinitions: [bundle.evaluatorDefinition],
  subject: bundle.evaluationAssignment.subject,
  inputs: bundle.evaluationAssignment.inputs,
  producer: bundle.evaluationAssignment.producer,
  runners: [
    {
      evaluatorDefinition: bundle.evaluationAssignment.evaluatorDefinition,
      execution: bundle.evaluationAssignment.evaluatorExecution,
      contextManifest: bundle.evaluationAssignment.contextManifest,
      budget: bundle.evaluationAssignment.budget,
      sharedCorpus: bundle.evaluationAssignment.independence.sharedCorpus
    }
  ],
  createdBy: { kind: 'system', id: 'evaluation-coordinator', version: '1' },
  limitations: ['Synthetic coordination fixture only.']
})

export const EVALUATION_COORDINATION_CONTRACT_SAMPLES = {
  'evaluation-coordination.v1': EVALUATION_COORDINATION_DISPATCH.coordination
} as const
