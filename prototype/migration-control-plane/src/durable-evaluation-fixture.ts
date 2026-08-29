import type { AssignmentRecordV1, AssignmentResultV1 } from './domain/assignment-contracts.js'
import { EvaluationAssignmentV2Schema } from './domain/evaluation-assignment-contracts-v2.js'
import { EvaluationContractV2Schema } from './domain/evaluation-contracts-v2.js'
import { EvaluatorDefinitionV2Schema } from './domain/evaluation-definition-contracts-v2.js'
import { EvidenceItemV1Schema } from './domain/epistemic-contracts.js'
import { EvaluationResultV2Schema } from './domain/evaluation-result-contracts-v2.js'
import {
  DURABLE_FIXTURE_ACTOR,
  DURABLE_FIXTURE_BUDGET,
  DURABLE_FIXTURE_DIGEST
} from './durable-convergence-mission-fixture.js'
import { evaluationRecordDigest, evaluationResultDigest } from './evaluation-contract-registry.js'

const ASSIGNMENT_RESULT_SCHEMA = {
  name: 'assignment-result.v1',
  version: 1,
  digest: 'c39abeb0010722deaab70312092c244cd1f17b08b6386844847de1e609d298d9'
} as const
const CONTEXT_MANIFEST_SCHEMA = {
  name: 'context-manifest.v1',
  version: 1,
  digest: '5db7b26044848256000f8bb9b6c8f858f80c06d7679c9e43a52773d1e1fe78dc'
} as const
const EVALUATOR_CONTEXT_DIGEST = 'e'.repeat(64)
const MEASURE = {
  name: 'durable-state',
  valueType: 'boolean' as const,
  unit: '',
  hard: true,
  required: true,
  operator: 'eq' as const,
  threshold: true,
  evidenceRequired: true,
  description: 'The accepted durable assignment result satisfies its state invariant.'
}

export function buildDurableEvaluationFixture(input: {
  suffix: string
  tenantId: string
  missionId: string
  createdAt: string
  changedAt: string
  completedAt: string
  evaluationContractId: string
  evaluationAssignmentId: string
  evaluationResultId: string
  assignment: AssignmentRecordV1
  assignmentResult: AssignmentResultV1
}) {
  const evidence = EvidenceItemV1Schema.parse({
    schemaVersion: 1,
    kind: 'evidence-item',
    id: `evidence_dur_${input.suffix}`,
    tenantId: input.tenantId,
    missionId: input.missionId,
    createdAt: input.changedAt,
    version: 1,
    sourceRole: 'generated-artifact',
    sourceName: 'durable convergence assignment result',
    sourceVersion: '1',
    content: {
      uri: `artifact://durable-convergence/${input.assignmentResult.id}`,
      sha256: input.assignmentResult.outputDigest,
      mediaType: 'application/json',
      bytes: 1,
      span: { kind: 'whole' }
    },
    scope: { environment: 'synthetic', system: 'durable-kernel' },
    dataClass: 'synthetic',
    observedAt: input.changedAt,
    effectiveFrom: input.changedAt,
    effectiveUntil: null,
    supersedesEvidenceId: null,
    limitations: []
  })
  const evidenceReference = {
    id: evidence.id,
    version: evidence.version,
    digest: evaluationRecordDigest(evidence)
  }
  const definition = EvaluatorDefinitionV2Schema.parse({
    schemaVersion: 2,
    kind: 'evaluator-definition',
    id: `evaluator_dur_${input.suffix}`,
    tenantId: input.tenantId,
    createdAt: input.createdAt,
    evaluatorKey: 'durable-state',
    version: 1,
    predecessor: null,
    evaluatorType: 'deterministic',
    implementation: {
      version: '1',
      artifact: {
        uri: 'artifact://evaluators/durable-state/1',
        sha256: DURABLE_FIXTURE_DIGEST,
        mediaType: 'application/javascript',
        bytes: 1,
        span: { kind: 'whole' }
      },
      modelRoute: null
    },
    supportedSubjects: [
      {
        kind: 'assignment-result',
        schemaName: ASSIGNMENT_RESULT_SCHEMA.name,
        schemaVersion: ASSIGNMENT_RESULT_SCHEMA.version,
        schemaDigest: ASSIGNMENT_RESULT_SCHEMA.digest
      }
    ],
    requiredTools: [],
    requiredDataClasses: ['synthetic'],
    requiredAccess: ['none'],
    independence: {
      producerMayEvaluate: false,
      process: 'different-required',
      model: 'not-applicable',
      provider: 'not-applicable',
      context: 'independent-required',
      credentials: 'not-applicable',
      producerReasoningVisible: false,
      sharedCorpus: 'not-applicable'
    },
    measures: [MEASURE],
    calibrationCorpus: null,
    knownLimitations: ['Synthetic durable-state fixture only.'],
    budget: DURABLE_FIXTURE_BUDGET,
    retryPolicy: { maxAttempts: 1, retryableFailureCodes: [], backoffMs: 0 },
    createdBy: DURABLE_FIXTURE_ACTOR,
    revokedAt: null
  })
  const evaluatorReference = {
    id: definition.id,
    version: definition.version,
    digest: evaluationRecordDigest(definition)
  }
  const contract = EvaluationContractV2Schema.parse({
    schemaVersion: 2,
    kind: 'evaluation-contract',
    id: input.evaluationContractId,
    tenantId: input.tenantId,
    createdAt: input.createdAt,
    contractKey: 'durable-state',
    version: 1,
    predecessor: null,
    subject: { kind: 'assignment-result', schema: ASSIGNMENT_RESULT_SCHEMA },
    inputRequirements: [
      {
        name: 'subject-output',
        recordKind: 'assignment-result',
        schema: ASSIGNMENT_RESULT_SCHEMA,
        required: true,
        bindsSubject: true,
        minimumEvidenceCount: 1,
        maxAgeMs: 60_000,
        description: 'Exact accepted assignment output and observation evidence.'
      }
    ],
    requiredEvaluators: [{ ...evaluatorReference, measureNames: [MEASURE.name] }],
    measures: [{ ...MEASURE, evaluator: evaluatorReference }],
    composition: 'all',
    independence: definition.independence,
    maxAgeMs: 60_000,
    correctionBudget: 1,
    unavailableDisposition: 'unaccepted',
    contradictoryDisposition: 'quarantined',
    acceptanceAuthority: 'product-reconciler-only',
    createdBy: DURABLE_FIXTURE_ACTOR,
    limitations: ['Synthetic durable-state fixture only.'],
    revokedAt: null
  })
  const contractReference = {
    id: contract.id,
    version: contract.version,
    digest: evaluationRecordDigest(contract)
  }
  const subject = {
    kind: 'assignment-result',
    schema: ASSIGNMENT_RESULT_SCHEMA,
    id: input.assignmentResult.id,
    version: 1,
    digest: input.assignmentResult.outputDigest
  }
  const assignment = EvaluationAssignmentV2Schema.parse({
    schemaVersion: 2,
    kind: 'evaluation-assignment',
    id: input.evaluationAssignmentId,
    tenantId: input.tenantId,
    missionId: input.missionId,
    createdAt: input.changedAt,
    contract: contractReference,
    evaluatorDefinition: evaluatorReference,
    subject,
    inputs: [
      {
        name: 'subject-output',
        recordKind: 'assignment-result',
        schema: ASSIGNMENT_RESULT_SCHEMA,
        recordId: input.assignmentResult.id,
        recordVersion: 1,
        digest: input.assignmentResult.outputDigest,
        evidence: [evidenceReference],
        observedAt: input.changedAt
      }
    ],
    contextManifest: {
      id: input.assignment.contextManifestId,
      schema: CONTEXT_MANIFEST_SCHEMA,
      digest: DURABLE_FIXTURE_DIGEST
    },
    producer: {
      actor: DURABLE_FIXTURE_ACTOR,
      assignmentId: input.assignment.id,
      attemptId: input.assignmentResult.attemptId,
      fence: input.assignmentResult.fence,
      processIdentity: `process_producer_${input.suffix}`,
      modelRoute: null,
      contextDigest: DURABLE_FIXTURE_DIGEST,
      credentialScopeDigest: null,
      toolSetDigest: DURABLE_FIXTURE_DIGEST
    },
    evaluatorExecution: {
      actor: { kind: 'evaluator', id: 'durable-state', version: '1' },
      attemptId: `attempt_evaluator_dur_${input.suffix}`,
      fence: 1,
      processIdentity: `process_evaluator_${input.suffix}`,
      modelRoute: null,
      contextDigest: EVALUATOR_CONTEXT_DIGEST,
      credentialScopeDigest: null,
      toolSetDigest: DURABLE_FIXTURE_DIGEST
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
    deadlineAt: input.completedAt,
    budget: DURABLE_FIXTURE_BUDGET,
    acceptanceAuthority: 'none'
  })
  const resultDraft = EvaluationResultV2Schema.parse({
    schemaVersion: 2,
    kind: 'evaluation-result',
    id: input.evaluationResultId,
    tenantId: input.tenantId,
    missionId: input.missionId,
    createdAt: input.changedAt,
    assignment: {
      id: assignment.id,
      evaluatorAttemptId: assignment.evaluatorExecution.attemptId,
      evaluatorFence: assignment.evaluatorExecution.fence,
      digest: evaluationRecordDigest(assignment)
    },
    contract: contractReference,
    evaluatorDefinition: evaluatorReference,
    subject,
    status: 'passed',
    measures: [
      {
        name: MEASURE.name,
        status: 'pass',
        valueType: MEASURE.valueType,
        unit: MEASURE.unit,
        value: true,
        operator: MEASURE.operator,
        threshold: MEASURE.threshold,
        evidence: [evidenceReference],
        failureCode: null
      }
    ],
    coverage: {
      requiredMeasureNames: [MEASURE.name],
      observedMeasureNames: [MEASURE.name],
      missingMeasureNames: [],
      complete: true
    },
    evidence: [evidenceReference],
    limitations: [],
    usage: input.assignmentResult.usage,
    completedAt: input.changedAt,
    resultDigest: DURABLE_FIXTURE_DIGEST,
    acceptanceAuthority: 'none'
  })
  const result = EvaluationResultV2Schema.parse({
    ...resultDraft,
    resultDigest: evaluationResultDigest(resultDraft)
  })
  return {
    evaluatorDefinition: definition,
    evaluationContract: contract,
    evaluationEvidence: evidence,
    evaluationAssignment: assignment,
    evaluationResult: result
  }
}
