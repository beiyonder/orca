import { EvaluationContractV2Schema } from '../src/domain/evaluation-contracts-v2.js'
import { EvaluatorDefinitionV2Schema } from '../src/domain/evaluation-definition-contracts-v2.js'
import { EvaluationResultV2Schema } from '../src/domain/evaluation-result-contracts-v2.js'
import {
  coordinateEvaluationDispatch,
  type EvaluationDispatchPlan
} from '../src/evaluation-dispatch-coordinator.js'
import {
  evaluationRecordDigest,
  evaluationResultDigest
} from '../src/evaluation-contract-registry.js'
import { EVALUATION_V2_BUNDLE } from './evaluation-contract-v2-samples.js'

const bundle = EVALUATION_V2_BUNDLE
const digestC = 'c'.repeat(64)
const securityMeasure = {
  ...bundle.evaluatorDefinition.measures[0]!,
  name: 'security_valid',
  description: 'Subject satisfies the exact security invariant.'
}
const securityDefinition = EvaluatorDefinitionV2Schema.parse({
  ...structuredClone(bundle.evaluatorDefinition),
  id: 'evaluator_security_contract_v1',
  evaluatorKey: 'security-contract',
  measures: [securityMeasure]
})
const schemaReference = {
  id: bundle.evaluatorDefinition.id,
  version: bundle.evaluatorDefinition.version,
  digest: evaluationRecordDigest(bundle.evaluatorDefinition)
}
const securityReference = {
  id: securityDefinition.id,
  version: securityDefinition.version,
  digest: evaluationRecordDigest(securityDefinition)
}
const coordinatorContract = EvaluationContractV2Schema.parse({
  ...structuredClone(bundle.evaluationContract),
  id: 'evaluation_contract_coordinator_v1',
  contractKey: 'coordinator-evaluation',
  requiredEvaluators: [
    { ...schemaReference, measureNames: [bundle.evaluatorDefinition.measures[0]!.name] },
    { ...securityReference, measureNames: [securityMeasure.name] }
  ],
  measures: [
    { ...bundle.evaluatorDefinition.measures[0]!, evaluator: schemaReference },
    { ...securityMeasure, evaluator: securityReference }
  ]
})

export const COORDINATOR_DEFINITIONS = [bundle.evaluatorDefinition, securityDefinition] as const
export const COORDINATOR_CONTRACT = coordinatorContract

export function buildEvaluationDispatchInput(coordinationKey = 'coordinator-evaluation') {
  return structuredClone({
    tenantId: bundle.evaluationAssignment.tenantId,
    missionId: bundle.evaluationAssignment.missionId,
    coordinationKey,
    createdAt: bundle.evaluationAssignment.createdAt,
    resultDeadlineAt: bundle.evaluationAssignment.deadlineAt,
    contract: coordinatorContract,
    evaluatorDefinitions: COORDINATOR_DEFINITIONS,
    subject: bundle.evaluationAssignment.subject,
    inputs: bundle.evaluationAssignment.inputs,
    producer: bundle.evaluationAssignment.producer,
    runners: [
      {
        evaluatorDefinition: schemaReference,
        execution: bundle.evaluationAssignment.evaluatorExecution,
        contextManifest: bundle.evaluationAssignment.contextManifest,
        budget: bundle.evaluationAssignment.budget,
        sharedCorpus: 'not-applicable' as const
      },
      {
        evaluatorDefinition: securityReference,
        execution: {
          ...bundle.evaluationAssignment.evaluatorExecution,
          actor: { kind: 'evaluator' as const, id: 'security-contract', version: '1' },
          attemptId: 'attempt_eval_security',
          processIdentity: 'process-evaluator-security',
          contextDigest: digestC,
          toolSetDigest: digestC
        },
        contextManifest: {
          ...bundle.evaluationAssignment.contextManifest,
          id: 'context_eval_security',
          digest: digestC
        },
        budget: bundle.evaluationAssignment.budget,
        sharedCorpus: 'not-applicable' as const
      }
    ],
    createdBy: { kind: 'system' as const, id: 'evaluation-coordinator', version: '1' },
    limitations: ['Synthetic coordinator fixture only.']
  })
}

export function buildEvaluationDispatch(
  coordinationKey = 'coordinator-evaluation'
): EvaluationDispatchPlan {
  return coordinateEvaluationDispatch(buildEvaluationDispatchInput(coordinationKey))
}

export function buildEvaluationResult(
  plan: EvaluationDispatchPlan,
  assignmentIndex: number,
  status: 'passed' | 'failed' | 'partial' | 'unavailable' | 'contradictory' | 'error' | 'stale',
  completedAt = status === 'stale' ? '2026-01-01T00:03:00.000Z' : '2026-01-01T00:01:30.000Z'
) {
  const assignment = plan.assignments[assignmentIndex]!
  const definition = coordinatorContract.measures.find(
    (measure) =>
      measure.evaluator.id === assignment.evaluatorDefinition.id &&
      measure.evaluator.version === assignment.evaluatorDefinition.version
  )!
  const evidence = assignment.inputs[0]!.evidence
  const unavailable = ['partial', 'unavailable', 'error'].includes(status)
  const measures = unavailable
    ? []
    : [
        {
          name: definition.name,
          status:
            status === 'failed'
              ? ('fail' as const)
              : status === 'contradictory'
                ? ('unknown' as const)
                : ('pass' as const),
          valueType: definition.valueType,
          unit: definition.unit,
          value: status !== 'failed',
          operator: definition.operator,
          threshold: definition.threshold,
          evidence,
          failureCode: status === 'failed' ? 'seeded_failure' : null
        }
      ]
  const draft = EvaluationResultV2Schema.parse({
    schemaVersion: 2,
    kind: 'evaluation-result',
    id: `evaluation_result_${status}_${evaluationRecordDigest(assignment).slice(0, 12)}`,
    tenantId: assignment.tenantId,
    missionId: assignment.missionId,
    createdAt: completedAt,
    assignment: {
      id: assignment.id,
      evaluatorAttemptId: assignment.evaluatorExecution.attemptId,
      evaluatorFence: assignment.evaluatorExecution.fence,
      digest: evaluationRecordDigest(assignment)
    },
    contract: assignment.contract,
    evaluatorDefinition: assignment.evaluatorDefinition,
    subject: assignment.subject,
    status,
    measures,
    coverage: {
      requiredMeasureNames: [definition.name],
      observedMeasureNames: measures.map((measure) => measure.name),
      missingMeasureNames: unavailable ? [definition.name] : [],
      complete: !unavailable
    },
    evidence,
    limitations: unavailable ? [`Evaluator result is ${status}.`] : [],
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      toolCalls: 1,
      wallTimeMs: 10,
      costUsd: 0
    },
    completedAt,
    resultDigest: 'd'.repeat(64),
    acceptanceAuthority: 'none'
  })
  return EvaluationResultV2Schema.parse({
    ...draft,
    resultDigest: evaluationResultDigest(draft)
  })
}
