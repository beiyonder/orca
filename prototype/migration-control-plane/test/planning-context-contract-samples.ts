const tenantId = 'tenant_s1'
const missionId = 'mission_s1'
const createdAt = '2026-01-01T00:00:00.000Z'
const digestA = 'a'.repeat(64)
const actor = { kind: 'system', id: 'system_s1' }
const scope = { environment: 'synthetic', system: 'legacy', entity: 'legacy_patient' }
const budget = {
  tokenLimit: 10_000,
  timeLimitMs: 60_000,
  toolCallLimit: 10,
  outputByteLimit: 1_000_000,
  costLimitUsd: 10
}
const modelRoute = {
  provider: 'test',
  model: 'deterministic',
  revision: 'v1',
  effort: 'lo',
  dataClasses: ['synthetic']
}

export const PLANNING_CONTEXT_CONTRACT_SAMPLES = {
  'decision-record.v1': {
    schemaVersion: 1,
    kind: 'decision-record',
    id: 'decision_s1',
    tenantId,
    missionId,
    createdAt,
    revision: 0,
    baseMissionRevision: 1,
    question: 'Select the source identity key.',
    options: [
      {
        id: 'single',
        label: 'Single key',
        description: 'patient_num only',
        tradeoffs: ['Not unique.']
      },
      {
        id: 'composite',
        label: 'Composite key',
        description: 'facility plus patient',
        tradeoffs: ['Wider key.']
      }
    ],
    selectedOptionId: 'composite',
    evidenceIds: ['evidence_s1'],
    assertionIds: ['assertion_s1'],
    findingIds: ['finding_s1'],
    probeResultIds: ['probe_result_s1'],
    assumptions: ['Fixture profile represents current scope.'],
    impactRecordIds: ['artifact_s1'],
    reversalConditions: ['Profile changes or a counterexample appears.'],
    rationale: 'Only the composite candidate is observed unique.',
    decidedBy: actor
  },
  'plan-revision.v1': {
    schemaVersion: 1,
    kind: 'plan-revision',
    id: 'plan_s1',
    tenantId,
    missionId,
    createdAt,
    revision: 1,
    basePlanRevisionId: null,
    baseMissionRevision: 1,
    operations: [
      {
        operation: 'add-task',
        taskId: 'task_s1',
        title: 'Build the identity mapping.',
        capability: 'identity-mapping',
        dependencyTaskIds: [],
        proofObligations: ['Pass the identity mapping evaluation contract.'],
        recoveryPolicy: {
          onWorkerLoss: 'reconstruct',
          onStaleResult: 'reject-authority-retain-evidence',
          maxAttempts: 2,
          requiresEvaluation: true
        }
      }
    ],
    decisionIds: ['decision_s1'],
    evidenceIds: ['evidence_s1'],
    findingIds: ['finding_s1'],
    rationale: 'Create one evaluated mapping task.',
    createdBy: actor,
    committedAt: createdAt
  },
  'task-record.v1': {
    schemaVersion: 1,
    kind: 'task',
    id: 'task_s1',
    tenantId,
    missionId,
    createdAt,
    revision: 0,
    planRevisionId: 'plan_s1',
    title: 'Build the identity mapping.',
    capability: 'identity-mapping',
    dependencyTaskIds: [],
    proofObligations: ['Pass all hard mapping measures.'],
    requiredEvaluationContractIds: ['evaluation_contract_s1'],
    ownedScope: [scope],
    readScope: [scope],
    budget,
    recoveryPolicy: {
      onWorkerLoss: 'reconstruct',
      onStaleResult: 'reject-authority-retain-evidence',
      maxAttempts: 2,
      requiresEvaluation: true
    },
    state: { status: 'runnable' }
  },
  'context-manifest.v1': {
    schemaVersion: 1,
    kind: 'context-manifest',
    id: 'context_s1',
    tenantId,
    missionId,
    createdAt,
    assignmentId: 'assignment_s1',
    attemptId: 'attempt_s1',
    baseMissionRevision: 1,
    role: 's1-profile-artifact-engineer',
    strategyVersion: 'exact-v1',
    modelRoute,
    budget,
    items: [
      {
        itemId: 'context_item_1',
        evidenceId: 'evidence_s1',
        evidenceVersion: 1,
        evidenceDigest: digestA,
        span: { kind: 'whole' },
        sourceRole: 'direct-observation',
        dataClass: 'synthetic',
        position: 0,
        trust: 'direct',
        freshness: 'current'
      }
    ],
    excludedEvidence: [],
    redactions: [],
    systemPromptDigest: digestA,
    toolSetDigest: digestA,
    outputSchemaDigest: digestA,
    renderedContextDigest: digestA,
    compiledBy: actor
  }
}
