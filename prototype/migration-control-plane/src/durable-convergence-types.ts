import type {
  AssignmentAttemptV1,
  AssignmentRecordV1,
  AssignmentResultV1,
  TaskRecordV1
} from './domain/assignment-contracts.js'
import type { EvaluationAssignmentV1, EvaluationResultV1 } from './domain/evaluation-contracts.js'
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
  evaluationAssignment: EvaluationAssignmentV1
  evaluationResult: EvaluationResultV1
  staleObservedAt: string
  activeObservedAt: string
}

export type DurableConvergenceFixture = DurableMissionFixture & DurableTaskFixture
