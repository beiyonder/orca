import { evaluateDeterministicAssignment } from '../src/deterministic-contract-evaluator.js'
import { coordinateEvaluationDispatch } from '../src/evaluation-dispatch-coordinator.js'
import { evaluationRecordDigest } from '../src/evaluation-contract-registry.js'
import {
  DETERMINISTIC_ASSIGNED_AT,
  DETERMINISTIC_BUDGET,
  DETERMINISTIC_CONTEXT_SCHEMA,
  DETERMINISTIC_CREATED_AT,
  DETERMINISTIC_DEADLINE_AT,
  DETERMINISTIC_EVALUATION_CONTRACT,
  DETERMINISTIC_EVALUATOR_DEFINITION,
  DETERMINISTIC_EVALUATOR_REFERENCE,
  DETERMINISTIC_EVALUATOR_SUITE,
  DETERMINISTIC_INPUT_EVIDENCE,
  DETERMINISTIC_MISSION_ID,
  DETERMINISTIC_SUBJECT,
  DETERMINISTIC_SUBJECT_SCHEMA,
  DETERMINISTIC_SUITE_EVIDENCE,
  DETERMINISTIC_SUITE_SCHEMA
} from './deterministic-evaluator-authority-fixture.js'

const subjectEvidenceReference = {
  id: DETERMINISTIC_INPUT_EVIDENCE.id,
  version: DETERMINISTIC_INPUT_EVIDENCE.version,
  digest: evaluationRecordDigest(DETERMINISTIC_INPUT_EVIDENCE)
}
const suiteEvidenceReference = {
  id: DETERMINISTIC_SUITE_EVIDENCE.id,
  version: DETERMINISTIC_SUITE_EVIDENCE.version,
  digest: evaluationRecordDigest(DETERMINISTIC_SUITE_EVIDENCE)
}
export const DETERMINISTIC_DISPATCH_REQUEST = {
  tenantId: DETERMINISTIC_SUBJECT.tenantId,
  missionId: DETERMINISTIC_MISSION_ID,
  coordinationKey: 'deterministic-migration-proposal',
  createdAt: DETERMINISTIC_ASSIGNED_AT,
  resultDeadlineAt: DETERMINISTIC_DEADLINE_AT,
  contract: DETERMINISTIC_EVALUATION_CONTRACT,
  evaluatorDefinitions: [DETERMINISTIC_EVALUATOR_DEFINITION],
  subject: {
    kind: DETERMINISTIC_SUBJECT.kind,
    schema: DETERMINISTIC_SUBJECT_SCHEMA,
    id: DETERMINISTIC_SUBJECT.id,
    version: 1,
    digest: evaluationRecordDigest(DETERMINISTIC_SUBJECT)
  },
  inputs: [
    {
      name: 'subject-output',
      recordKind: DETERMINISTIC_SUBJECT.kind,
      schema: DETERMINISTIC_SUBJECT_SCHEMA,
      recordId: DETERMINISTIC_SUBJECT.id,
      recordVersion: 1,
      digest: evaluationRecordDigest(DETERMINISTIC_SUBJECT),
      evidence: [subjectEvidenceReference],
      observedAt: DETERMINISTIC_CREATED_AT
    },
    {
      name: 'deterministic-suite',
      recordKind: DETERMINISTIC_EVALUATOR_SUITE.kind,
      schema: DETERMINISTIC_SUITE_SCHEMA,
      recordId: DETERMINISTIC_EVALUATOR_SUITE.id,
      recordVersion: DETERMINISTIC_EVALUATOR_SUITE.version,
      digest: evaluationRecordDigest(DETERMINISTIC_EVALUATOR_SUITE),
      evidence: [suiteEvidenceReference],
      observedAt: DETERMINISTIC_CREATED_AT
    }
  ],
  producer: {
    actor: { kind: 'specialist' as const, id: 'migration-designer', version: '1' },
    assignmentId: 'assignment_deterministic_producer',
    attemptId: 'attempt_deterministic_producer',
    fence: 1,
    processIdentity: 'process-deterministic-producer',
    modelRoute: null,
    contextDigest: 'a'.repeat(64),
    credentialScopeDigest: null,
    toolSetDigest: 'a'.repeat(64)
  },
  runners: [
    {
      evaluatorDefinition: DETERMINISTIC_EVALUATOR_REFERENCE,
      execution: {
        actor: { kind: 'evaluator' as const, id: 'deterministic-contract', version: '1' },
        attemptId: 'attempt_deterministic_evaluator',
        fence: 1,
        processIdentity: 'process-deterministic-evaluator',
        modelRoute: null,
        contextDigest: 'b'.repeat(64),
        credentialScopeDigest: null,
        toolSetDigest: 'b'.repeat(64)
      },
      contextManifest: {
        id: 'context_deterministic_evaluator',
        schema: DETERMINISTIC_CONTEXT_SCHEMA,
        digest: 'b'.repeat(64)
      },
      budget: DETERMINISTIC_BUDGET,
      sharedCorpus: 'not-applicable' as const
    }
  ],
  createdBy: { kind: 'system' as const, id: 'evaluation-coordinator', version: '1' },
  limitations: ['Synthetic migration proposal evaluation only.']
}
export const DETERMINISTIC_DISPATCH = coordinateEvaluationDispatch(DETERMINISTIC_DISPATCH_REQUEST)
export const DETERMINISTIC_ASSIGNMENT = DETERMINISTIC_DISPATCH.assignments[0]!

export function runDeterministicFixture(
  subject: unknown = DETERMINISTIC_SUBJECT,
  observedAt = '2026-01-01T00:04:30.000Z',
  inputEvidence: readonly unknown[] = [DETERMINISTIC_INPUT_EVIDENCE, DETERMINISTIC_SUITE_EVIDENCE]
) {
  return evaluateDeterministicAssignment({
    assignment: DETERMINISTIC_ASSIGNMENT,
    contract: DETERMINISTIC_EVALUATION_CONTRACT,
    evaluatorDefinition: DETERMINISTIC_EVALUATOR_DEFINITION,
    suite: DETERMINISTIC_EVALUATOR_SUITE,
    subject,
    inputEvidence,
    dataClass: 'synthetic',
    observedAt
  })
}

export {
  DETERMINISTIC_EVALUATION_CONTRACT,
  DETERMINISTIC_EVALUATOR_DEFINITION,
  DETERMINISTIC_EVALUATOR_SUITE,
  DETERMINISTIC_INPUT_EVIDENCE,
  DETERMINISTIC_SUBJECT,
  DETERMINISTIC_SUITE_EVIDENCE
} from './deterministic-evaluator-authority-fixture.js'
