import type { DomainSchemaName } from '../src/domain/domain-contract-registry.js'
import { EFFECT_CONTRACT_SAMPLES } from './effect-contract-samples.js'
import { KNOWLEDGE_RETRIEVAL_CONTRACT_SAMPLES } from './knowledge-retrieval-contract-samples.js'
import { LEARNING_CONTRACT_SAMPLES } from './learning-contract-samples.js'
import { MISSION_PLANNING_CONTRACT_SAMPLES } from './mission-planning-contract-samples.js'
import { MEMORY_SKILL_CONTRACT_SAMPLES } from './memory-skill-contract-samples.js'
import { SOURCE_CONTRACT_SAMPLES } from './source-contract-samples.js'
import { SOURCE_DISCOVERY_CONTRACT_SAMPLES } from './source-discovery-contract-samples.js'

const tenantId = 'tenant_s1'
const missionId = 'mission_s1'
const createdAt = '2026-01-01T00:00:00.000Z'
const laterAt = '2026-01-01T00:01:00.000Z'
const digestA = 'a'.repeat(64)
const digestB = 'b'.repeat(64)
const actor = { kind: 'system', id: 'system_s1' }
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
const usage = {
  inputTokens: 10,
  outputTokens: 5,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  toolCalls: 1,
  wallTimeMs: 100,
  costUsd: 0.01
}
const modelRoute = {
  provider: 'test',
  model: 'deterministic',
  revision: 'v1',
  effort: 'lo',
  dataClasses: ['synthetic']
}
const tool = {
  name: 'evidence_read',
  version: '1',
  schemaDigest: digestA,
  approval: 'read'
}
const independence = {
  producerMayEvaluate: false,
  process: 'different-required',
  model: 'not-applicable',
  provider: 'not-applicable',
  context: 'independent-required',
  credentials: 'not-applicable',
  producerReasoningVisible: false
}
const measureDefinition = {
  name: 'schema_valid',
  valueType: 'boolean',
  unit: '',
  hard: true,
  required: true,
  operator: 'eq',
  threshold: true,
  description: 'Subject matches the required schema.'
}
const evaluationSubjectV1 = {
  kind: 'mapping',
  id: 'artifact_s1',
  version: 1,
  schemaVersion: 1,
  digest: digestA
}

export const DOMAIN_CONTRACT_SAMPLES: Record<DomainSchemaName, unknown> = {
  ...MISSION_PLANNING_CONTRACT_SAMPLES,
  ...KNOWLEDGE_RETRIEVAL_CONTRACT_SAMPLES,
  ...MEMORY_SKILL_CONTRACT_SAMPLES,
  ...SOURCE_CONTRACT_SAMPLES,
  ...SOURCE_DISCOVERY_CONTRACT_SAMPLES,
  'assignment-record.v1': {
    schemaVersion: 1,
    kind: 'assignment',
    id: 'assignment_s1',
    tenantId,
    missionId,
    createdAt,
    revision: 0,
    taskId: 'task_s1',
    role: 's1-profile-artifact-engineer',
    contractVersion: 1,
    contextManifestId: 'context_s1',
    tools: [tool],
    outputSchema: { name: 'identity-mapping.v1', version: 1, digest: digestA, mode: 'strict' },
    modelRoute,
    budget,
    spawnPolicy: { enabled: false, maxDepth: 0, allowedRoles: [] },
    requiredEvaluationContractIds: ['evaluation_contract_s1'],
    state: { status: 'created' },
    assignedBy: actor
  },
  'assignment-attempt.v1': {
    schemaVersion: 1,
    kind: 'assignment-attempt',
    id: 'attempt_s1',
    tenantId,
    missionId,
    createdAt,
    assignmentId: 'assignment_s1',
    attemptNumber: 1,
    fence: 1,
    worker: {
      runtime: 'deterministic-runner',
      runtimeVersion: '1',
      protocolVersion: '1',
      processIncarnation: 'process_s1',
      sessionRef: null
    },
    contextManifestId: 'context_s1',
    state: { status: 'running', leaseExpiresAt: laterAt },
    startedAt: createdAt
  },
  'assignment-result.v1': {
    schemaVersion: 1,
    kind: 'assignment-result',
    id: 'assignment_result_s1',
    tenantId,
    missionId,
    createdAt,
    assignmentId: 'assignment_s1',
    attemptId: 'attempt_s1',
    fence: 1,
    outputDigest: digestA,
    outcome: {
      status: 'succeeded',
      artifactVersionIds: ['artifact_version_s1'],
      evidenceIds: ['evidence_s1'],
      gapIds: [],
      planRevisionIds: ['plan_s1']
    },
    usage,
    limitations: ['Synthetic fixture only.'],
    submittedAt: laterAt,
    submittedBy: actor
  },
  'artifact-version.v1': {
    schemaVersion: 1,
    kind: 'artifact-version',
    id: 'artifact_version_s1',
    tenantId,
    missionId,
    createdAt,
    artifactId: 'artifact_s1',
    artifactType: 'mapping',
    version: 1,
    previousVersionId: null,
    content,
    producerAssignmentId: 'assignment_s1',
    producerAttemptId: 'attempt_s1',
    producerFence: 1,
    decisionIds: ['decision_s1'],
    evidenceIds: ['evidence_s1'],
    state: { status: 'proposed' }
  },
  'evaluator-definition.v1': {
    schemaVersion: 1,
    kind: 'evaluator-definition',
    id: 'evaluator_s1',
    tenantId,
    createdAt,
    version: 1,
    evaluatorType: 'deterministic',
    implementation: content,
    supportedSubjectKinds: ['mapping'],
    supportedSubjectSchemaVersions: [1],
    requiredTools: [],
    independence,
    measures: [measureDefinition],
    calibrationCorpus: null,
    knownLimitations: ['Synthetic identity fixture only.'],
    budget,
    revokedAt: null
  },
  'evaluation-contract.v1': {
    schemaVersion: 1,
    kind: 'evaluation-contract',
    id: 'evaluation_contract_s1',
    tenantId,
    createdAt,
    version: 1,
    subjectKind: 'mapping',
    subjectSchemaVersion: 1,
    measures: [{ ...measureDefinition, evaluatorId: 'evaluator_s1', evaluatorVersion: 1 }],
    composition: 'all',
    independence,
    maxAgeMs: 60_000,
    correctionBudget: 2,
    unavailableDisposition: 'unaccepted',
    contradictoryDisposition: 'quarantined',
    revokedAt: null
  },
  'evaluation-assignment.v1': {
    schemaVersion: 1,
    kind: 'evaluation-assignment',
    id: 'evaluation_assignment_s1',
    tenantId,
    missionId,
    createdAt,
    contractId: 'evaluation_contract_s1',
    contractVersion: 1,
    evaluatorId: 'evaluator_s1',
    evaluatorVersion: 1,
    subject: evaluationSubjectV1,
    contextManifestId: 'context_s1',
    inputEvidenceIds: ['evidence_s1'],
    producer: { actor, assignmentId: 'assignment_s1', attemptId: 'attempt_s1', fence: 1 },
    evaluatorAttemptId: 'attempt_eval',
    evaluatorFence: 1,
    deadlineAt: laterAt,
    budget
  },
  'evaluation-result.v1': {
    schemaVersion: 1,
    kind: 'evaluation-result',
    id: 'evaluation_result_s1',
    tenantId,
    missionId,
    createdAt,
    assignmentId: 'evaluation_assignment_s1',
    contractId: 'evaluation_contract_s1',
    contractVersion: 1,
    evaluatorId: 'evaluator_s1',
    evaluatorVersion: 1,
    subject: evaluationSubjectV1,
    status: 'passed',
    measures: [
      {
        name: 'schema_valid',
        status: 'pass',
        value: true,
        threshold: true,
        evidenceIds: ['evidence_s1'],
        failureCode: null
      }
    ],
    coverage: 'complete',
    evidenceIds: ['evidence_s1'],
    limitations: ['Synthetic fixture only.'],
    usage,
    completedAt: laterAt,
    resultDigest: digestA
  },
  'correction-request.v1': {
    schemaVersion: 1,
    kind: 'correction-request',
    id: 'correction_request_s1',
    tenantId,
    missionId,
    createdAt,
    failedSubject: evaluationSubjectV1,
    evaluationResultIds: ['evaluation_result_failed'],
    failedMeasureNames: ['source_key_unique'],
    gapIds: ['gap_s1'],
    allowedMutationPaths: ['/sourceKey'],
    acceptanceContractId: 'evaluation_contract_s1',
    acceptanceContractVersion: 1,
    attempt: 1,
    maxAttempts: 2,
    requestedBy: actor
  },
  'correction-result.v1': {
    schemaVersion: 1,
    kind: 'correction-result',
    id: 'correction_result_s1',
    tenantId,
    missionId,
    createdAt,
    requestId: 'correction_request_s1',
    priorSubject: evaluationSubjectV1,
    newSubject: { ...evaluationSubjectV1, version: 2, digest: digestB },
    changedPaths: ['/sourceKey'],
    evidenceIds: ['evidence_s1'],
    unresolvedGapIds: [],
    acceptanceContractId: 'evaluation_contract_s1',
    acceptanceContractVersion: 1,
    usage,
    completedAt: laterAt,
    producedBy: actor
  },
  ...LEARNING_CONTRACT_SAMPLES,
  ...EFFECT_CONTRACT_SAMPLES
}
