import {
  AssignmentAttemptV1Schema,
  AssignmentRecordV1Schema,
  AssignmentResultV1Schema,
  TaskRecordV1Schema
} from './domain/assignment-contracts.js'
import {
  EvaluationAssignmentV1Schema,
  EvaluationResultV1Schema
} from './domain/evaluation-contracts.js'
import { PlanRevisionV1Schema } from './domain/planning-contracts.js'
import {
  DURABLE_FIXTURE_ACTOR,
  DURABLE_FIXTURE_BUDGET,
  DURABLE_FIXTURE_DIGEST
} from './durable-convergence-mission-fixture.js'
import type { DurableMissionFixture, DurableTaskFixture } from './durable-convergence-types.js'

export function buildDurableTaskFixture(mission: DurableMissionFixture): DurableTaskFixture {
  const { suffix, tenantId, missionId, planId, createdAt, changedAt, leaseExpiresAt } = mission
  const taskId = `task_dur_${suffix}`
  const assignmentId = `assignment_dur_${suffix}`
  const attemptId = `attempt_dur_${suffix}`
  const assignmentResultId = `assignment_result_dur_${suffix}`
  const evaluationContractId = `evaluation_contract_dur_${suffix}`
  const evaluationAssignmentId = `evaluation_assignment_dur_${suffix}`
  const evaluationResultId = `evaluation_result_dur_${suffix}`
  const recoveryPolicy = {
    onWorkerLoss: 'reconstruct' as const,
    onStaleResult: 'reject-authority-retain-evidence' as const,
    maxAttempts: 2,
    requiresEvaluation: true
  }
  const task = TaskRecordV1Schema.parse({
    schemaVersion: 1,
    kind: 'task',
    id: taskId,
    tenantId,
    missionId,
    createdAt,
    revision: 0,
    planRevisionId: planId,
    title: 'Run one fenced durable assignment.',
    capability: 'durable-convergence',
    dependencyTaskIds: [],
    proofObligations: ['Reject stale output and preserve accepted state.'],
    requiredEvaluationContractIds: [evaluationContractId],
    ownedScope: [{ environment: 'synthetic', system: 'durable-kernel' }],
    readScope: [],
    budget: DURABLE_FIXTURE_BUDGET,
    recoveryPolicy,
    state: { status: 'runnable' }
  })
  const plan = PlanRevisionV1Schema.parse({
    schemaVersion: 1,
    kind: 'plan-revision',
    id: planId,
    tenantId,
    missionId,
    createdAt,
    revision: 1,
    basePlanRevisionId: null,
    baseMissionRevision: 1,
    operations: [
      {
        operation: 'add-task',
        taskId,
        title: task.title,
        capability: task.capability,
        dependencyTaskIds: [],
        proofObligations: task.proofObligations,
        recoveryPolicy
      }
    ],
    decisionIds: [],
    evidenceIds: [],
    findingIds: [],
    rationale: 'One task is sufficient to falsify stale attempt authority.',
    createdBy: DURABLE_FIXTURE_ACTOR,
    committedAt: createdAt
  })
  const assignment = AssignmentRecordV1Schema.parse({
    schemaVersion: 1,
    kind: 'assignment',
    id: assignmentId,
    tenantId,
    missionId,
    createdAt,
    revision: 0,
    taskId,
    role: 'durable-kernel-worker',
    contractVersion: 1,
    contextManifestId: `context_dur_${suffix}`,
    tools: [],
    outputSchema: {
      name: 'durable-result.v1',
      version: 1,
      digest: DURABLE_FIXTURE_DIGEST,
      mode: 'strict'
    },
    modelRoute: {
      provider: 'deterministic',
      model: 'none',
      revision: '1',
      effort: 'lo',
      dataClasses: ['synthetic']
    },
    budget: DURABLE_FIXTURE_BUDGET,
    spawnPolicy: { enabled: false, maxDepth: 0, allowedRoles: [] },
    requiredEvaluationContractIds: [evaluationContractId],
    state: { status: 'created' },
    assignedBy: DURABLE_FIXTURE_ACTOR
  })
  const attempt = AssignmentAttemptV1Schema.parse({
    schemaVersion: 1,
    kind: 'assignment-attempt',
    id: attemptId,
    tenantId,
    missionId,
    createdAt,
    assignmentId,
    attemptNumber: 1,
    fence: 1,
    worker: {
      runtime: 'deterministic-runner',
      runtimeVersion: '1',
      protocolVersion: '1',
      processIncarnation: `process_dur_${suffix}`,
      sessionRef: null
    },
    contextManifestId: assignment.contextManifestId,
    state: { status: 'claimed', leaseExpiresAt },
    startedAt: createdAt
  })
  const assignmentResult = AssignmentResultV1Schema.parse({
    schemaVersion: 1,
    kind: 'assignment-result',
    id: assignmentResultId,
    tenantId,
    missionId,
    createdAt,
    assignmentId,
    attemptId,
    fence: 1,
    outputDigest: DURABLE_FIXTURE_DIGEST,
    outcome: {
      status: 'succeeded',
      artifactVersionIds: [],
      evidenceIds: [],
      gapIds: [],
      planRevisionIds: [planId]
    },
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      toolCalls: 0,
      wallTimeMs: 1,
      costUsd: 0
    },
    limitations: [],
    submittedAt: changedAt,
    submittedBy: DURABLE_FIXTURE_ACTOR
  })
  const evaluationSubject = {
    kind: 'assignment-result',
    id: assignmentResultId,
    version: 1,
    schemaVersion: 1,
    digest: assignmentResult.outputDigest
  }
  const evaluationAssignment = EvaluationAssignmentV1Schema.parse({
    schemaVersion: 1,
    kind: 'evaluation-assignment',
    id: evaluationAssignmentId,
    tenantId,
    missionId,
    createdAt,
    contractId: evaluationContractId,
    contractVersion: 1,
    evaluatorId: `evaluator_dur_${suffix}`,
    evaluatorVersion: 1,
    subject: evaluationSubject,
    contextManifestId: assignment.contextManifestId,
    inputEvidenceIds: [],
    producer: { actor: DURABLE_FIXTURE_ACTOR, assignmentId, attemptId, fence: 1 },
    evaluatorAttemptId: `attempt_evaluator_dur_${suffix}`,
    evaluatorFence: 1,
    deadlineAt: leaseExpiresAt,
    budget: DURABLE_FIXTURE_BUDGET
  })
  const evaluationResult = EvaluationResultV1Schema.parse({
    schemaVersion: 1,
    kind: 'evaluation-result',
    id: evaluationResultId,
    tenantId,
    missionId,
    createdAt,
    assignmentId: evaluationAssignmentId,
    contractId: evaluationContractId,
    contractVersion: 1,
    evaluatorId: evaluationAssignment.evaluatorId,
    evaluatorVersion: 1,
    subject: evaluationSubject,
    status: 'passed',
    measures: [
      {
        name: 'durable-state',
        status: 'pass',
        value: true,
        threshold: true,
        evidenceIds: [],
        failureCode: null
      }
    ],
    coverage: 'complete',
    evidenceIds: [],
    limitations: [],
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      toolCalls: 0,
      wallTimeMs: 1,
      costUsd: 0
    },
    completedAt: mission.completedAt,
    resultDigest: DURABLE_FIXTURE_DIGEST
  })
  return {
    taskId,
    assignmentId,
    plan,
    task,
    assignment,
    assignmentResult,
    attempt,
    assignmentResultId,
    evaluationAssignment,
    evaluationResult,
    staleObservedAt: changedAt,
    activeObservedAt: changedAt
  }
}
