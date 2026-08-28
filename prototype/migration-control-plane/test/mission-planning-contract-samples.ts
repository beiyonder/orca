const tenantId = 'tenant_s1'
const missionId = 'mission_s1'
const createdAt = '2026-01-01T00:00:00.000Z'
const laterAt = '2026-01-01T00:01:00.000Z'
const digestA = 'a'.repeat(64)
const actor = { kind: 'system', id: 'system_s1' }
const scope = { environment: 'synthetic', system: 'legacy', entity: 'legacy_patient' }
const content = {
  uri: 'artifact://s1/source',
  sha256: digestA,
  mediaType: 'application/json',
  bytes: 128,
  span: { kind: 'whole' }
}
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

export const MISSION_PLANNING_CONTRACT_SAMPLES = {
  'mission-record.v1': {
    schemaVersion: 1,
    kind: 'mission',
    id: missionId,
    tenantId,
    missionId,
    revision: 0,
    objective: 'Produce an evidence-correct identity mapping.',
    priorities: ['correctness'],
    dataClass: 'synthetic',
    state: { status: 'investigating', enteredAt: createdAt },
    currentPlanRevisionId: null,
    labels: { slice: 's1' },
    createdAt,
    updatedAt: createdAt
  },
  'mission-command.v1': {
    schemaVersion: 1,
    kind: 'mission-command',
    id: 'command_s1',
    tenantId,
    missionId,
    expectedRevision: null,
    commandType: 'create-mission',
    payload: { objective: 'Produce an evidence-correct identity mapping.' },
    payloadSchema: { name: 'mission-create.v1', version: 1, digest: digestA },
    payloadDigest: digestA,
    actor,
    correlationId: 'correlation_s1',
    issuedAt: createdAt
  },
  'mission-event.v1': {
    schemaVersion: 1,
    kind: 'mission-event',
    id: 'event_s1',
    tenantId,
    missionId,
    aggregateRevision: 1,
    eventType: 'mission-created',
    payload: { objective: 'Produce an evidence-correct identity mapping.' },
    payloadSchema: { name: 'mission-created.v1', version: 1, digest: digestA },
    payloadDigest: digestA,
    actor,
    causationCommandId: 'command_s1',
    correlationId: 'correlation_s1',
    recordedAt: createdAt
  },
  'evidence-item.v1': {
    schemaVersion: 1,
    kind: 'evidence-item',
    id: 'evidence_s1',
    tenantId,
    missionId,
    createdAt,
    version: 1,
    sourceRole: 'direct-observation',
    sourceName: 'Synthetic key profile',
    sourceVersion: '1',
    content,
    scope,
    dataClass: 'synthetic',
    observedAt: createdAt,
    effectiveFrom: createdAt,
    effectiveUntil: null,
    supersedesEvidenceId: null,
    limitations: ['Six synthetic rows.']
  },
  'proposition.v1': {
    schemaVersion: 1,
    kind: 'proposition',
    id: 'proposition_s1',
    tenantId,
    missionId,
    createdAt,
    revision: 0,
    subject: 'legacy_patient',
    predicate: 'has-unique-key',
    object: ['facility_id', 'patient_num'],
    normalizedStatement: 'facility_id plus patient_num is unique.',
    scope,
    effectiveFrom: createdAt,
    effectiveUntil: null,
    supersedesPropositionId: null
  },
  'assertion.v1': {
    schemaVersion: 1,
    kind: 'assertion',
    id: 'assertion_s1',
    tenantId,
    missionId,
    createdAt,
    propositionId: 'proposition_s1',
    evidenceId: 'evidence_s1',
    polarity: 'supports',
    directness: 'direct',
    applicability: 'in-scope',
    derivationAssertionIds: [],
    rationale: 'Observed 6 distinct composite values over 6 rows.',
    assertedBy: actor
  },
  'contradiction-set.v1': {
    schemaVersion: 1,
    kind: 'contradiction-set',
    id: 'contradiction_s1',
    tenantId,
    missionId,
    createdAt,
    propositionIds: ['proposition_s1'],
    assertionIds: ['assertion_s1', 'assertion_s2'],
    blockingGapIds: ['gap_s1'],
    state: { status: 'open' }
  },
  'gap.v1': {
    schemaVersion: 1,
    kind: 'gap',
    id: 'gap_s1',
    tenantId,
    missionId,
    createdAt,
    revision: 0,
    question: 'Which source columns form a stable unique patient key?',
    impact: 'critical',
    propositionIds: ['proposition_s1'],
    hypothesisIds: [],
    contradictionIds: ['contradiction_s1'],
    probeCandidateIds: ['probe_s1'],
    blockedDecisionIds: ['decision_s1'],
    state: { status: 'investigating', reason: 'Conflicting design and profile evidence.' }
  },
  'probe-request.v1': {
    schemaVersion: 1,
    kind: 'probe-request',
    id: 'probe_s1',
    tenantId,
    missionId,
    createdAt,
    gapId: 'gap_s1',
    method: 'check_candidate_key',
    question: 'Is the composite key unique?',
    parameters: { columns: ['facility_id', 'patient_num'] },
    expectedEvidenceDigest: digestA,
    predictedOutcomes: [true, false],
    budget: { timeLimitMs: 10_000, rowLimit: 100, byteLimit: 1_000_000 },
    requestedBy: actor
  },
  'probe-result.v1': {
    schemaVersion: 1,
    kind: 'probe-result',
    id: 'probe_result_s1',
    tenantId,
    missionId,
    createdAt,
    requestId: 'probe_s1',
    inputDigest: digestA,
    outcome: {
      status: 'succeeded',
      observations: [{ distinct: 6, rows: 6 }],
      evidenceId: 'evidence_s1'
    },
    startedAt: createdAt,
    completedAt: laterAt,
    executedBy: actor
  },
  'accepted-finding.v1': {
    schemaVersion: 1,
    kind: 'accepted-finding',
    id: 'finding_s1',
    tenantId,
    missionId,
    createdAt,
    revision: 0,
    propositionId: 'proposition_s1',
    assertionIds: ['assertion_s1'],
    evidenceIds: ['evidence_s1'],
    probeResultIds: ['probe_result_s1'],
    scope,
    conclusion: 'The composite key is unique for the current fixture.',
    limitations: ['Synthetic fixture only.'],
    reversalConditions: ['A counterexample or changed profile appears.'],
    validFrom: createdAt,
    supersedesFindingId: null,
    acceptedBy: actor
  },
  'impact-review.v1': {
    schemaVersion: 1,
    kind: 'impact-review',
    id: 'impact_s1',
    tenantId,
    missionId,
    createdAt,
    triggerEvidenceIds: ['evidence_s1'],
    triggerFindingIds: ['finding_s1'],
    affectedRecordIds: ['decision_s1', 'artifact_version_s1'],
    disposition: 'reevaluate',
    rationale: 'The identity mapping depends on the key finding.',
    reviewedBy: actor
  },
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
