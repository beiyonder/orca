import type {
  AssignmentAttemptV1,
  AssignmentRecordV1,
  AssignmentResultV1,
  TaskRecordV1
} from './domain/assignment-contracts.js'
import type { EvaluationAssignmentV2 } from './domain/evaluation-assignment-contracts-v2.js'
import type { EvaluationContractV2 } from './domain/evaluation-contracts-v2.js'
import type { EvaluatorDefinitionV2 } from './domain/evaluation-definition-contracts-v2.js'
import type { EvidenceItemV1 } from './domain/epistemic-contracts.js'
import type { EvaluationResultV2 } from './domain/evaluation-result-contracts-v2.js'
import type {
  MissionCommandEnvelopeV1,
  MissionEventEnvelopeV1,
  MissionRecordV1
} from './domain/mission-contracts.js'
import type { PlanRevisionV1 } from './domain/planning-contracts.js'

export type DurableTransitionFixture = {
  command: MissionCommandEnvelopeV1
  event: MissionEventEnvelopeV1
  mission: MissionRecordV1
  outbox: Record<string, unknown>
}

export type DurableMissionFixture = {
  suffix: string
  tenantId: string
  missionId: string
  planId: string
  createdAt: string
  changedAt: string
  completedAt: string
  leaseExpiresAt: string
  create: DurableTransitionFixture
  complete: DurableTransitionFixture
}

export type DurableTaskFixture = {
  taskId: string
  assignmentId: string
  plan: PlanRevisionV1
  task: TaskRecordV1
  assignment: AssignmentRecordV1
  assignmentResult: AssignmentResultV1
  attempt: AssignmentAttemptV1
  assignmentResultId: string
  evaluatorDefinition: EvaluatorDefinitionV2
  evaluationContract: EvaluationContractV2
  evaluationEvidence: EvidenceItemV1
  evaluationAssignment: EvaluationAssignmentV2
  evaluationResult: EvaluationResultV2
  staleObservedAt: string
  activeObservedAt: string
}

export type DurableConvergenceFixture = DurableMissionFixture & DurableTaskFixture
