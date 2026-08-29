import { EvaluationAssignmentV2Schema } from '../src/domain/evaluation-assignment-contracts-v2.js'
import { EvaluationContractV2Schema } from '../src/domain/evaluation-contracts-v2.js'
import { EvaluatorDefinitionV2Schema } from '../src/domain/evaluation-definition-contracts-v2.js'
import { EvaluationResultV2Schema } from '../src/domain/evaluation-result-contracts-v2.js'
import {
  evaluationRecordDigest,
  evaluationResultDigest
} from '../src/evaluation-contract-registry.js'

const digestA = 'a'.repeat(64)
const digestB = 'b'.repeat(64)
const digestE = 'e'.repeat(64)
const tenantId = 'tenant_s1'
const missionId = 'mission_s1'
const createdAt = '2026-01-01T00:00:00.000Z'
const assignedAt = '2026-01-01T00:01:00.000Z'
const completedAt = '2026-01-01T00:01:30.000Z'
const budget = {
  tokenLimit: 0,
  timeLimitMs: 60_000,
  toolCallLimit: 1,
  outputByteLimit: 1_000_000,
  costLimitUsd: 1
}
const independence = {
  producerMayEvaluate: false as const,
  process: 'different-required' as const,
  model: 'not-applicable' as const,
  provider: 'not-applicable' as const,
  context: 'independent-required' as const,
  credentials: 'not-applicable' as const,
  producerReasoningVisible: false as const,
  sharedCorpus: 'not-applicable' as const
}
const subjectSchema = {
  name: 'assignment-result.v1',
  version: 1,
  digest: 'c39abeb0010722deaab70312092c244cd1f17b08b6386844847de1e609d298d9'
}
const contextSchema = {
  name: 'context-manifest.v1',
  version: 1,
  digest: '5db7b26044848256000f8bb9b6c8f858f80c06d7679c9e43a52773d1e1fe78dc'
}
const measure = {
  name: 'schema_valid',
  valueType: 'boolean' as const,
  unit: '',
  hard: true,
  required: true,
  operator: 'eq' as const,
  threshold: true,
  evidenceRequired: true,
  description: 'Subject matches the exact required schema.'
}

const evaluatorDefinition = EvaluatorDefinitionV2Schema.parse({
  schemaVersion: 2,
  kind: 'evaluator-definition',
  id: 'evaluator_schema_contract_v1',
  tenantId,
  createdAt,
  evaluatorKey: 'schema-contract',
  version: 1,
  predecessor: null,
  evaluatorType: 'deterministic',
  implementation: {
    version: '1.0.0',
    artifact: {
      uri: 'artifact://evaluators/schema-contract/1.0.0',
      sha256: digestA,
      mediaType: 'application/javascript',
      bytes: 1_024,
      span: { kind: 'whole' }
    },
    modelRoute: null
  },
  supportedSubjects: [
    {
      kind: 'assignment-result',
      schemaName: subjectSchema.name,
      schemaVersion: subjectSchema.version,
      schemaDigest: subjectSchema.digest
    }
  ],
  requiredTools: [],
  requiredDataClasses: ['synthetic'],
  requiredAccess: ['none'],
  independence,
  measures: [measure],
  calibrationCorpus: null,
  knownLimitations: ['Synthetic assignment result only.'],
  budget,
  retryPolicy: { maxAttempts: 1, retryableFailureCodes: [], backoffMs: 0 },
  createdBy: { kind: 'system', id: 'evaluation-registry', version: '1' },
  revokedAt: null
})

const evaluatorReference = {
  id: evaluatorDefinition.id,
  version: evaluatorDefinition.version,
  digest: evaluationRecordDigest(evaluatorDefinition)
}
const evaluationContract = EvaluationContractV2Schema.parse({
  schemaVersion: 2,
  kind: 'evaluation-contract',
  id: 'evaluation_contract_schema_v1',
  tenantId,
  createdAt,
  contractKey: 'assignment-result-schema',
  version: 1,
  predecessor: null,
  subject: { kind: 'assignment-result', schema: subjectSchema },
  inputRequirements: [
    {
      name: 'subject-output',
      recordKind: 'assignment-result',
      schema: subjectSchema,
      required: true,
      bindsSubject: true,
      minimumEvidenceCount: 1,
      maxAgeMs: 60_000,
      description: 'Exact producer output and its observation evidence.'
    }
  ],
  requiredEvaluators: [{ ...evaluatorReference, measureNames: [measure.name] }],
  measures: [{ ...measure, evaluator: evaluatorReference }],
  composition: 'all',
  independence,
  maxAgeMs: 60_000,
  correctionBudget: 2,
  unavailableDisposition: 'unaccepted',
  contradictoryDisposition: 'quarantined',
  acceptanceAuthority: 'product-reconciler-only',
  createdBy: { kind: 'system', id: 'evaluation-registry', version: '1' },
  limitations: ['Synthetic assignment result only.'],
  revokedAt: null
})
const contractReference = {
  id: evaluationContract.id,
  version: evaluationContract.version,
  digest: evaluationRecordDigest(evaluationContract)
}
const evidence = {
  id: 'evidence_evaluation_contract',
  version: 1,
  digest: digestE
}
const subject = {
  kind: 'assignment-result',
  schema: subjectSchema,
  id: 'assignment_result_s1',
  version: 1,
  digest: digestA
}
const evaluationAssignment = EvaluationAssignmentV2Schema.parse({
  schemaVersion: 2,
  kind: 'evaluation-assignment',
  id: 'evaluation_assignment_schema_v1',
  tenantId,
  missionId,
  createdAt: assignedAt,
  contract: contractReference,
  evaluatorDefinition: evaluatorReference,
  subject,
  inputs: [
    {
      name: 'subject-output',
      recordKind: 'assignment-result',
      schema: subjectSchema,
      recordId: subject.id,
      recordVersion: subject.version,
      digest: subject.digest,
      evidence: [evidence],
      observedAt: createdAt
    }
  ],
  contextManifest: { id: 'context_s1', schema: contextSchema, digest: digestB },
  producer: {
    actor: { kind: 'specialist', id: 'producer', version: '1' },
    assignmentId: 'assignment_s1',
    attemptId: 'attempt_s1',
    fence: 1,
    processIdentity: 'process-producer',
    modelRoute: null,
    contextDigest: digestA,
    credentialScopeDigest: null,
    toolSetDigest: digestA
  },
  evaluatorExecution: {
    actor: { kind: 'evaluator', id: 'schema-contract', version: '1' },
    attemptId: 'attempt_eval',
    fence: 1,
    processIdentity: 'process-evaluator',
    modelRoute: null,
    contextDigest: digestB,
    credentialScopeDigest: null,
    toolSetDigest: digestB
  },
  independence: {
    process: 'different',
    model: 'not-applicable',
    provider: 'not-applicable',
    context: 'different',
    credentials: 'not-applicable',
    producerReasoningVisible: false,
    sharedCorpus: 'not-applicable'
  },
  deadlineAt: '2026-01-01T00:02:00.000Z',
  budget,
  acceptanceAuthority: 'none'
})
const resultDraft = EvaluationResultV2Schema.parse({
  schemaVersion: 2,
  kind: 'evaluation-result',
  id: 'evaluation_result_schema_v1',
  tenantId,
  missionId,
  createdAt: completedAt,
  assignment: {
    id: evaluationAssignment.id,
    evaluatorAttemptId: evaluationAssignment.evaluatorExecution.attemptId,
    evaluatorFence: evaluationAssignment.evaluatorExecution.fence,
    digest: evaluationRecordDigest(evaluationAssignment)
  },
  contract: contractReference,
  evaluatorDefinition: evaluatorReference,
  subject,
  status: 'passed',
  measures: [
    {
      name: measure.name,
      status: 'pass',
      valueType: measure.valueType,
      unit: measure.unit,
      value: true,
      operator: measure.operator,
      threshold: measure.threshold,
      evidence: [evidence],
      failureCode: null
    }
  ],
  coverage: {
    requiredMeasureNames: [measure.name],
    observedMeasureNames: [measure.name],
    missingMeasureNames: [],
    complete: true
  },
  evidence: [evidence],
  limitations: [],
  usage: {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    toolCalls: 1,
    wallTimeMs: 500,
    costUsd: 0
  },
  completedAt,
  resultDigest: digestA,
  acceptanceAuthority: 'none'
})
const evaluationResult = EvaluationResultV2Schema.parse({
  ...resultDraft,
  resultDigest: evaluationResultDigest(resultDraft)
})

export const EVALUATION_V2_BUNDLE = {
  evaluatorDefinition,
  evaluationContract,
  evaluationAssignment,
  evaluationResult
} as const

export const EVALUATION_CONTRACT_V2_SAMPLES = {
  'evaluator-definition.v2': evaluatorDefinition,
  'evaluation-contract.v2': evaluationContract,
  'evaluation-assignment.v2': evaluationAssignment,
  'evaluation-result.v2': evaluationResult
} as const
