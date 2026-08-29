import {
  CorrectionCycleV1Schema,
  EvaluationDiagnosisV1Schema
} from '../src/domain/acceptance-correction-contracts.js'
import { initializeSubjectAcceptance } from '../src/subject-acceptance-registry.js'
import { DETERMINISTIC_DISPATCH } from './deterministic-evaluator-fixture.js'

const createdAt = '2026-01-01T00:30:00.000Z'
const acceptance = initializeSubjectAcceptance({
  tenantId: 'tenant_s1',
  missionId: 'mission_s1',
  acceptanceKey: 'sample-acceptance',
  subject: DETERMINISTIC_DISPATCH.assignments[0]!.subject,
  contract: DETERMINISTIC_DISPATCH.assignments[0]!.contract,
  createdAt
})
const diagnosis = EvaluationDiagnosisV1Schema.parse({
  schemaVersion: 1,
  kind: 'evaluation-diagnosis',
  id: 'evaluation_diagnosis_sample',
  tenantId: 'tenant_s1',
  missionId: 'mission_s1',
  createdAt,
  acceptanceId: acceptance.id,
  subject: acceptance.subject,
  contract: acceptance.contract,
  evaluationResultIds: ['evaluation_result_sample_failed'],
  failedMeasures: [
    {
      name: 'policy_valid',
      failureCode: 'deterministic_authority_policy_failed',
      cause: 'authority-or-budget',
      componentPath: '/authority',
      evidenceIds: ['evidence_sample_failure']
    }
  ],
  gapIds: ['gap_sample_evaluation'],
  allowedMutationPaths: ['/authority'],
  recommendedAction: 'quarantine',
  genericRetryAllowed: false,
  diagnosedAt: createdAt,
  diagnosedBy: { kind: 'system', id: 'evaluation-diagnoser', version: '1' },
  acceptanceAuthority: 'none'
})
const correction = CorrectionCycleV1Schema.parse({
  schemaVersion: 1,
  kind: 'correction-cycle',
  id: 'correction_cycle_sample_v1',
  tenantId: 'tenant_s1',
  missionId: 'mission_s1',
  createdAt,
  correctionKey: 'sample-correction',
  version: 1,
  predecessor: null,
  failedAcceptanceId: acceptance.id,
  diagnosisId: diagnosis.id,
  originalSubject: acceptance.subject,
  correctedSubject: null,
  fixedContract: acceptance.contract,
  attempt: 1,
  maxAttempts: 2,
  allowedMutationPaths: ['/authority'],
  changedPaths: [],
  addedEvidenceIds: [],
  evaluationResultIds: [],
  evaluatorChanged: false,
  thresholdChanged: false,
  status: 'requested',
  usage: {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    toolCalls: 0,
    wallTimeMs: 0,
    costUsd: 0
  },
  recordedAt: createdAt,
  recordedBy: { kind: 'system', id: 'correction-coordinator', version: '1' },
  acceptanceAuthority: 'none'
})

export const ACCEPTANCE_CORRECTION_CONTRACT_SAMPLES = {
  'subject-acceptance.v1': acceptance,
  'evaluation-diagnosis.v1': diagnosis,
  'correction-cycle.v1': correction
} as const
