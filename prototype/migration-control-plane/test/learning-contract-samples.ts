import { SKILL_CERTIFICATION_CONTRACT_SAMPLES } from './skill-certification-contract-samples.js'

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

export const LEARNING_CONTRACT_SAMPLES = {
  ...SKILL_CERTIFICATION_CONTRACT_SAMPLES,
  'learning-candidate.v1': {
    schemaVersion: 1,
    kind: 'learning-candidate',
    id: 'learning_s1',
    tenantId,
    missionId,
    createdAt,
    candidateType: 'memory',
    sourceEvaluationResultIds: ['evaluation_result_s1'],
    sourceEvidenceIds: ['evidence_s1'],
    sourceRecordIds: ['correction_request_s1', 'artifact_s1'],
    causalHypothesis: 'Declared identifiers require observed uniqueness verification.',
    proposedArtifact: content,
    targetEnvelope: {
      taskClasses: ['identity-mapping'],
      modelRoutes: [],
      dataClasses: ['synthetic'],
      environment: 'prototype'
    },
    allowedMutationPaths: ['/memory/failure-lessons'],
    authorityDelta: 'none',
    retentionExpiresAt: null,
    state: { status: 'quarantined', usePolicy: 'none', validationStatus: 'not-run' },
    proposedBy: actor
  },
  'capability-manifest.v1': {
    schemaVersion: 1,
    kind: 'capability-manifest',
    id: 'capability_s1',
    tenantId,
    createdAt,
    version: 1,
    capabilityType: 'skill',
    artifact: content,
    contract: { inputSchemaId: 'input.v1', outputSchemaId: 'output.v1', schemaDigest: digestA },
    compatibleModelRoutes: [modelRoute],
    requiredTools: [tool],
    dataClasses: ['synthetic'],
    authorityEnvelope: {},
    evaluationContractIds: ['evaluation_contract_s1'],
    predecessorCapabilityId: null,
    license: 'MIT',
    signer: null,
    status: { status: 'certified', certificationId: 'certification_s1' }
  },
  'certification-result.v1': {
    schemaVersion: 1,
    kind: 'certification-result',
    id: 'certification_s1',
    tenantId,
    createdAt,
    capabilityId: 'capability_s1',
    capabilityVersion: 1,
    baselineCapabilityId: null,
    evaluationResultIds: ['evaluation_result_s1'],
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
    protectedSliceResults: { synthetic: 'pass' },
    repetitions: 1,
    status: 'passed',
    limitations: [],
    completedAt: laterAt
  },
  'promotion-decision.v1': {
    schemaVersion: 1,
    kind: 'promotion-decision',
    id: 'promotion_s1',
    tenantId,
    createdAt,
    capabilityId: 'capability_s1',
    capabilityVersion: 1,
    certificationId: 'certification_s1',
    stableCapabilityId: null,
    stage: 'shadow',
    trafficLimitPercent: 0,
    taskLimit: 10,
    timeLimitMs: 60_000,
    abortConditions: ['Any hard evaluator failure.'],
    decidedBy: actor
  },
  'capability-use.v1': {
    schemaVersion: 1,
    kind: 'capability-use',
    id: 'capability_use_s1',
    tenantId,
    missionId,
    createdAt,
    capabilityId: 'capability_s1',
    capabilityVersion: 1,
    assignmentId: 'assignment_s1',
    attemptId: 'attempt_s1',
    modelRoute,
    inputDigest: digestA,
    outputDigest: digestB,
    evaluationResultIds: ['evaluation_result_s1'],
    outcome: 'unknown',
    usage
  },
  'drift-signal.v1': {
    schemaVersion: 1,
    kind: 'drift-signal',
    id: 'drift_s1',
    tenantId,
    createdAt,
    capabilityId: 'capability_s1',
    capabilityVersion: 1,
    windowStartedAt: createdAt,
    windowEndedAt: laterAt,
    baselineDigest: digestA,
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
    affectedUseIds: ['capability_use_s1'],
    severity: 'info',
    action: 'observe',
    detectedBy: actor
  }
}
