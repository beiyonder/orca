import { canonicalJson } from '../src/canonical-json.js'
import { DeterministicEvaluatorSuiteV1Schema } from '../src/domain/deterministic-evaluator-contracts.js'
import { EvaluationContractV2Schema } from '../src/domain/evaluation-contracts-v2.js'
import { EvaluatorDefinitionV2Schema } from '../src/domain/evaluation-definition-contracts-v2.js'
import { EvidenceItemV1Schema } from '../src/domain/epistemic-contracts.js'
import { MigrationProposalV1Schema } from '../src/domain/migration-proposal-contracts.js'
import { evaluationRecordDigest } from '../src/evaluation-contract-registry.js'
import { MIGRATION_PROPOSAL_CONTRACT_SAMPLES } from './migration-proposal-contract-samples.js'

export const DETERMINISTIC_CREATED_AT = '2026-01-01T00:03:00.000Z'
export const DETERMINISTIC_ASSIGNED_AT = '2026-01-01T00:04:00.000Z'
export const DETERMINISTIC_DEADLINE_AT = '2026-01-01T00:05:00.000Z'
export const DETERMINISTIC_MISSION_ID = 'mission_s1'
export const DETERMINISTIC_SUBJECT_SCHEMA = {
  name: 'migration-proposal.v1',
  version: 1,
  digest: '3ee756f315ba833d1357d149c923fb5729ce18ac470b96bc65933f836477a7aa'
} as const
export const DETERMINISTIC_SUITE_SCHEMA = {
  name: 'deterministic-evaluator-suite.v1',
  version: 1,
  digest: '91e66ffa7ee33f11b183e9293c52a4d8d205692dbec29b77e2a9907c54a985dd'
} as const
export const DETERMINISTIC_CONTEXT_SCHEMA = {
  name: 'context-manifest.v1',
  version: 1,
  digest: '5db7b26044848256000f8bb9b6c8f858f80c06d7679c9e43a52773d1e1fe78dc'
} as const
export const DETERMINISTIC_CHECKS = [
  ['structural_valid', 'structural-schema'],
  ['types_valid', 'runtime-types'],
  ['contract_valid', 'contract-lineage'],
  ['compatibility_valid', 'version-compatibility'],
  ['policy_valid', 'authority-policy']
] as const
const measureDefinitions = DETERMINISTIC_CHECKS.map(([name, check]) => ({
  name,
  valueType: 'boolean' as const,
  unit: '',
  hard: true,
  required: true,
  operator: 'eq' as const,
  threshold: true,
  evidenceRequired: true,
  description: `Deterministic ${check} check passes.`
}))
export const DETERMINISTIC_BUDGET = {
  tokenLimit: 0,
  timeLimitMs: 60_000,
  toolCallLimit: 0,
  outputByteLimit: 1_000_000,
  costLimitUsd: 0
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

export const DETERMINISTIC_SUBJECT = MigrationProposalV1Schema.parse(
  MIGRATION_PROPOSAL_CONTRACT_SAMPLES['migration-proposal.v1']
)
export const DETERMINISTIC_INPUT_EVIDENCE = EvidenceItemV1Schema.parse({
  schemaVersion: 1,
  kind: 'evidence-item',
  id: 'evidence_deterministic_subject',
  tenantId: DETERMINISTIC_SUBJECT.tenantId,
  missionId: DETERMINISTIC_MISSION_ID,
  createdAt: DETERMINISTIC_CREATED_AT,
  version: 1,
  sourceRole: 'generated-artifact',
  sourceName: 'migration proposal fixture',
  sourceVersion: '1',
  content: {
    uri: `domain://migration-proposal/${DETERMINISTIC_SUBJECT.id}`,
    sha256: evaluationRecordDigest(DETERMINISTIC_SUBJECT),
    mediaType: 'application/json',
    bytes: Buffer.byteLength(canonicalJson(DETERMINISTIC_SUBJECT), 'utf8'),
    span: { kind: 'whole' }
  },
  scope: { environment: 'synthetic', system: 'migration-control-plane' },
  dataClass: 'synthetic',
  observedAt: DETERMINISTIC_CREATED_AT,
  effectiveFrom: DETERMINISTIC_CREATED_AT,
  effectiveUntil: null,
  supersedesEvidenceId: null,
  limitations: ['Synthetic proposal fixture only.']
})
export const DETERMINISTIC_EVALUATOR_DEFINITION = EvaluatorDefinitionV2Schema.parse({
  schemaVersion: 2,
  kind: 'evaluator-definition',
  id: 'evaluator_deterministic_contract_v1',
  tenantId: DETERMINISTIC_SUBJECT.tenantId,
  createdAt: DETERMINISTIC_CREATED_AT,
  evaluatorKey: 'deterministic-contract',
  version: 1,
  predecessor: null,
  evaluatorType: 'deterministic',
  implementation: {
    version: '1',
    artifact: {
      uri: 'artifact://evaluators/deterministic-contract/1',
      sha256: 'a'.repeat(64),
      mediaType: 'application/javascript',
      bytes: 1,
      span: { kind: 'whole' }
    },
    modelRoute: null
  },
  supportedSubjects: [
    {
      kind: DETERMINISTIC_SUBJECT.kind,
      schemaName: DETERMINISTIC_SUBJECT_SCHEMA.name,
      schemaVersion: DETERMINISTIC_SUBJECT_SCHEMA.version,
      schemaDigest: DETERMINISTIC_SUBJECT_SCHEMA.digest
    }
  ],
  requiredTools: [],
  requiredDataClasses: ['synthetic'],
  requiredAccess: ['none'],
  independence,
  measures: measureDefinitions,
  calibrationCorpus: null,
  knownLimitations: ['Structural migration proposal checks only.'],
  budget: DETERMINISTIC_BUDGET,
  retryPolicy: { maxAttempts: 1, retryableFailureCodes: [], backoffMs: 0 },
  createdBy: { kind: 'system', id: 'evaluation-registry', version: '1' },
  revokedAt: null
})
export const DETERMINISTIC_EVALUATOR_REFERENCE = {
  id: DETERMINISTIC_EVALUATOR_DEFINITION.id,
  version: DETERMINISTIC_EVALUATOR_DEFINITION.version,
  digest: evaluationRecordDigest(DETERMINISTIC_EVALUATOR_DEFINITION)
}
export const DETERMINISTIC_EVALUATION_CONTRACT = EvaluationContractV2Schema.parse({
  schemaVersion: 2,
  kind: 'evaluation-contract',
  id: 'evaluation_contract_deterministic_v1',
  tenantId: DETERMINISTIC_SUBJECT.tenantId,
  createdAt: DETERMINISTIC_CREATED_AT,
  contractKey: 'deterministic-migration-proposal',
  version: 1,
  predecessor: null,
  subject: { kind: DETERMINISTIC_SUBJECT.kind, schema: DETERMINISTIC_SUBJECT_SCHEMA },
  inputRequirements: [
    {
      name: 'subject-output',
      recordKind: DETERMINISTIC_SUBJECT.kind,
      schema: DETERMINISTIC_SUBJECT_SCHEMA,
      required: true,
      bindsSubject: true,
      minimumEvidenceCount: 1,
      maxAgeMs: 60_000,
      description: 'Exact migration proposal and provenance evidence.'
    },
    {
      name: 'deterministic-suite',
      recordKind: 'deterministic-evaluator-suite',
      schema: DETERMINISTIC_SUITE_SCHEMA,
      required: true,
      bindsSubject: false,
      minimumEvidenceCount: 1,
      maxAgeMs: 60_000,
      description: 'Exact deterministic suite and provenance evidence.'
    }
  ],
  requiredEvaluators: [
    {
      ...DETERMINISTIC_EVALUATOR_REFERENCE,
      measureNames: measureDefinitions.map((measure) => measure.name)
    }
  ],
  measures: measureDefinitions.map((measure) => ({
    ...measure,
    evaluator: DETERMINISTIC_EVALUATOR_REFERENCE
  })),
  composition: 'ordered-gates',
  independence,
  maxAgeMs: 60_000,
  correctionBudget: 2,
  unavailableDisposition: 'unaccepted',
  contradictoryDisposition: 'quarantined',
  acceptanceAuthority: 'product-reconciler-only',
  createdBy: { kind: 'system', id: 'evaluation-registry', version: '1' },
  limitations: ['Structural migration proposal checks only.'],
  revokedAt: null
})
export const DETERMINISTIC_EVALUATOR_SUITE = DeterministicEvaluatorSuiteV1Schema.parse({
  schemaVersion: 1,
  kind: 'deterministic-evaluator-suite',
  id: 'deterministic_evaluator_migration_v1',
  tenantId: DETERMINISTIC_SUBJECT.tenantId,
  createdAt: DETERMINISTIC_CREATED_AT,
  suiteKey: 'migration-proposal-contract',
  version: 1,
  predecessor: null,
  evaluatorDefinition: DETERMINISTIC_EVALUATOR_REFERENCE,
  subject: { kind: DETERMINISTIC_SUBJECT.kind, schema: DETERMINISTIC_SUBJECT_SCHEMA },
  operations: DETERMINISTIC_CHECKS.map(([measureName, check]) => ({
    measureName,
    check,
    evidenceRequired: true,
    description: `Run deterministic ${check}.`
  })),
  executionPolicy: {
    network: 'none',
    filesystem: 'none',
    mutationAuthority: 'none',
    modelUse: 'none',
    maximumSubjectBytes: 1_000_000,
    maximumEvidenceItems: 100,
    maximumWallTimeMs: 60_000
  },
  createdBy: { kind: 'system', id: 'evaluation-registry', version: '1' },
  limitations: ['Structural migration proposal checks only.'],
  revokedAt: null
})
export const DETERMINISTIC_SUITE_EVIDENCE = EvidenceItemV1Schema.parse({
  schemaVersion: 1,
  kind: 'evidence-item',
  id: 'evidence_deterministic_suite',
  tenantId: DETERMINISTIC_SUBJECT.tenantId,
  missionId: DETERMINISTIC_MISSION_ID,
  createdAt: DETERMINISTIC_CREATED_AT,
  version: 1,
  sourceRole: 'generated-artifact',
  sourceName: 'deterministic evaluator suite',
  sourceVersion: '1',
  content: {
    uri: `domain://deterministic-evaluator-suite/${DETERMINISTIC_EVALUATOR_SUITE.id}`,
    sha256: evaluationRecordDigest(DETERMINISTIC_EVALUATOR_SUITE),
    mediaType: 'application/json',
    bytes: Buffer.byteLength(canonicalJson(DETERMINISTIC_EVALUATOR_SUITE), 'utf8'),
    span: { kind: 'whole' }
  },
  scope: { environment: 'synthetic', system: 'migration-control-plane' },
  dataClass: 'synthetic',
  observedAt: DETERMINISTIC_CREATED_AT,
  effectiveFrom: DETERMINISTIC_CREATED_AT,
  effectiveUntil: null,
  supersedesEvidenceId: null,
  limitations: ['Synthetic deterministic suite only.']
})
