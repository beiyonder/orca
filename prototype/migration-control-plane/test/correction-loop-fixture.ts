import { canonicalJson } from '../src/canonical-json.js'
import { evaluateDeterministicAssignment } from '../src/deterministic-contract-evaluator.js'
import { EvidenceItemV1Schema } from '../src/domain/epistemic-contracts.js'
import { MigrationProposalV1Schema } from '../src/domain/migration-proposal-contracts.js'
import { coordinateEvaluationDispatch } from '../src/evaluation-dispatch-coordinator.js'
import { evaluationRecordDigest } from '../src/evaluation-contract-registry.js'
import { reconcileEvaluationCoordination } from '../src/evaluation-result-coordinator.js'
import {
  DETERMINISTIC_DISPATCH_REQUEST,
  DETERMINISTIC_EVALUATION_CONTRACT,
  DETERMINISTIC_EVALUATOR_DEFINITION,
  DETERMINISTIC_EVALUATOR_SUITE,
  DETERMINISTIC_SUBJECT,
  DETERMINISTIC_SUITE_EVIDENCE
} from './deterministic-evaluator-fixture.js'

function subjectEvidence(subject: unknown, id: string, createdAt: string) {
  return EvidenceItemV1Schema.parse({
    schemaVersion: 1,
    kind: 'evidence-item',
    id,
    tenantId: 'tenant_s1',
    missionId: 'mission_s1',
    createdAt,
    version: 1,
    sourceRole: 'generated-artifact',
    sourceName: 'correction subject',
    sourceVersion: '1',
    content: {
      uri: `domain://correction-subject/${id}`,
      sha256: evaluationRecordDigest(subject),
      mediaType: 'application/json',
      bytes: Buffer.byteLength(canonicalJson(subject), 'utf8'),
      span: { kind: 'whole' }
    },
    scope: { environment: 'synthetic', system: 'migration-control-plane' },
    dataClass: 'synthetic',
    observedAt: createdAt,
    effectiveFrom: createdAt,
    effectiveUntil: null,
    supersedesEvidenceId: null,
    limitations: ['Synthetic correction fixture.']
  })
}

function evaluationFlow(input: {
  subject: unknown
  id: string
  version: number
  evidence: ReturnType<typeof EvidenceItemV1Schema.parse>
  key: string
  createdAt: string
  deadlineAt: string
  evaluatedAt: string
}) {
  const request = structuredClone(DETERMINISTIC_DISPATCH_REQUEST) as Record<string, unknown>
  const subject = {
    kind: 'migration-proposal',
    schema: DETERMINISTIC_DISPATCH_REQUEST.subject.schema,
    id: input.id,
    version: input.version,
    digest: evaluationRecordDigest(input.subject)
  }
  const inputs = structuredClone(DETERMINISTIC_DISPATCH_REQUEST.inputs)
  const subjectInput = inputs.find((item) => item.name === 'subject-output')! as unknown as {
    recordId: string
    recordVersion: number
    digest: string
    observedAt: string
    evidence: { id: string; version: number; digest: string }[]
  }
  subjectInput.recordId = input.id
  subjectInput.recordVersion = input.version
  subjectInput.digest = subject.digest
  subjectInput.observedAt = input.evidence.observedAt
  subjectInput.evidence = [
    {
      id: input.evidence.id,
      version: input.evidence.version,
      digest: evaluationRecordDigest(input.evidence)
    }
  ]
  request.coordinationKey = input.key
  request.createdAt = input.createdAt
  request.resultDeadlineAt = input.deadlineAt
  request.subject = subject
  request.inputs = inputs
  request.producer = {
    ...DETERMINISTIC_DISPATCH_REQUEST.producer,
    assignmentId: `assignment_${input.key}`,
    attemptId: `attempt_${input.key}`
  }
  request.runners = DETERMINISTIC_DISPATCH_REQUEST.runners.map((runner) => ({
    ...runner,
    execution: {
      ...runner.execution,
      attemptId: `attempt_evaluator_${input.key}`,
      processIdentity: `process_evaluator_${input.key}`
    },
    contextManifest: { ...runner.contextManifest, id: `context_${input.key}` }
  }))
  const dispatch = coordinateEvaluationDispatch(request)
  const assignment = dispatch.assignments[0]!
  const output = evaluateDeterministicAssignment({
    assignment,
    contract: DETERMINISTIC_EVALUATION_CONTRACT,
    evaluatorDefinition: DETERMINISTIC_EVALUATOR_DEFINITION,
    suite: DETERMINISTIC_EVALUATOR_SUITE,
    subject: input.subject,
    inputEvidence: [input.evidence, DETERMINISTIC_SUITE_EVIDENCE],
    dataClass: 'synthetic',
    observedAt: input.evaluatedAt
  })
  const coordination = reconcileEvaluationCoordination({
    snapshots: [dispatch.coordination],
    definitions: [DETERMINISTIC_EVALUATOR_DEFINITION],
    contract: DETERMINISTIC_EVALUATION_CONTRACT,
    assignments: dispatch.assignments,
    results: [output.result],
    observedAt: input.evaluatedAt,
    observedBy: { kind: 'system', id: 'evaluation-coordinator', version: '1' }
  })
  return { subject, evidence: input.evidence, dispatch, output, coordination }
}

export const FAILED_SUBJECT = {
  ...structuredClone(DETERMINISTIC_SUBJECT),
  authority: 'effectful'
}
export const FAILED_EVIDENCE = subjectEvidence(
  FAILED_SUBJECT,
  'evidence_correction_failed_subject',
  '2026-01-01T00:04:00.000Z'
)
export const FAILED_FLOW = evaluationFlow({
  subject: FAILED_SUBJECT,
  id: DETERMINISTIC_SUBJECT.id,
  version: 1,
  evidence: FAILED_EVIDENCE,
  key: 'correction-failed-v1',
  createdAt: '2026-01-01T00:04:30.000Z',
  deadlineAt: '2026-01-01T00:05:30.000Z',
  evaluatedAt: '2026-01-01T00:05:00.000Z'
})

export const CORRECTED_SUBJECT = MigrationProposalV1Schema.parse({
  ...structuredClone(DETERMINISTIC_SUBJECT),
  id: 'migration_proposal_fixture_v2',
  version: 2,
  baseProposalId: DETERMINISTIC_SUBJECT.id,
  proposedAt: '2026-01-01T00:06:00.000Z'
})
export const CORRECTED_EVIDENCE = subjectEvidence(
  CORRECTED_SUBJECT,
  'evidence_correction_fixed_subject',
  '2026-01-01T00:06:00.000Z'
)
export const CORRECTED_FLOW = evaluationFlow({
  subject: CORRECTED_SUBJECT,
  id: CORRECTED_SUBJECT.id,
  version: 2,
  evidence: CORRECTED_EVIDENCE,
  key: 'correction-fixed-v2',
  createdAt: '2026-01-01T00:06:30.000Z',
  deadlineAt: '2026-01-01T00:07:30.000Z',
  evaluatedAt: '2026-01-01T00:07:00.000Z'
})
