import { canonicalJson, sha256Text } from '../src/canonical-json.js'

const createdAt = '2026-01-01T00:00:00.000Z'
export const helpfulMemoryContent = {
  lesson: 'Use facility_id plus patient_num after observed uniqueness refutes patient_num alone.'
}
const contentDigest = sha256Text(canonicalJson(helpfulMemoryContent))
const scope = { environment: 'synthetic', system: 'legacy-ehr', entity: 'legacy_patient' }

export function memoryCandidate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    kind: 'memory-candidate',
    id: 'memory_candidate_helpful',
    tenantId: 'tenant_s1',
    createdAt,
    memoryType: 'failure',
    missionId: 'mission_s1',
    sourceRecordIds: ['artifact_version_failed', 'correction_request_s1'],
    sourceEvidenceIds: ['evidence_profile'],
    proposedContent: helpfulMemoryContent,
    contentDigest,
    proposedScope: scope,
    applicability: {
      environment: 'synthetic',
      product: 'legacy-ehr',
      versionConstraint: 'fixture-v1',
      validFrom: createdAt,
      validUntil: null
    },
    creationMethod: 'diagnosed-failure',
    proposedBy: { kind: 'system', id: 'memory-candidate-compiler', version: '1' },
    creatorVersions: { compiler: '1', evaluator: '1' },
    reasonForRetention: 'Prevent recurrence of the evaluated identity-key failure.',
    validationContractIds: ['evaluation_contract_s1'],
    dataClass: 'synthetic',
    retention: { expiresAt: null, deletionMode: 'retain', policyId: 'synthetic-memory' },
    authorityDelta: 'none',
    state: { status: 'quarantined', usePolicy: 'none', validationStatus: 'not-run' },
    ...overrides
  }
}

export function memoryVersion(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    kind: 'memory-version',
    id: 'memory_version_helpful_v1',
    tenantId: 'tenant_s1',
    createdAt,
    memoryId: 'memory_helpful',
    version: 1,
    candidateId: 'memory_candidate_helpful',
    memoryType: 'failure',
    canonicalSourceRecordIds: ['artifact_version_failed', 'correction_request_s1'],
    canonicalSourceEvidenceIds: ['evidence_profile'],
    content: helpfulMemoryContent,
    contentDigest,
    scope,
    applicability: {
      environment: 'synthetic',
      product: 'legacy-ehr',
      versionConstraint: 'fixture-v1',
      validFrom: createdAt,
      validUntil: null
    },
    status: 'active',
    validationResultIds: ['evaluation_result_s1'],
    usePolicy: {
      allowRecall: true,
      roles: ['mapping'],
      taskClasses: ['identity-mapping'],
      dataClasses: ['synthetic']
    },
    supersedesVersionId: null,
    validFrom: createdAt,
    validUntil: null,
    createdBy: { kind: 'system', id: 'memory-validator', version: '1' },
    ...overrides
  }
}

export function memoryUse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    kind: 'memory-use',
    id: 'memory_use_helpful',
    tenantId: 'tenant_s1',
    createdAt: '2026-01-01T00:01:00.000Z',
    memoryVersionId: 'memory_version_helpful_v1',
    contextManifestId: 'context_s1',
    assignmentId: 'assignment_s1',
    attemptId: 'attempt_s1',
    retrievalQueryId: 'retrieval_query_s1',
    retrievalTraceId: 'retrieval_trace_s1',
    channel: 'lexical',
    rank: 1,
    score: 1,
    renderedDigest: 'a'.repeat(64),
    downstreamRecordIds: ['assignment_result_s1'],
    attribution: 'helped',
    ...overrides
  }
}

export function revokedMemoryVersion(): Record<string, unknown> {
  return memoryVersion({
    id: 'memory_version_helpful_v2',
    version: 2,
    status: 'revoked',
    validationResultIds: ['evaluation_result_s1'],
    usePolicy: {
      allowRecall: false,
      roles: ['mapping'],
      taskClasses: ['identity-mapping'],
      dataClasses: ['synthetic']
    },
    supersedesVersionId: 'memory_version_helpful_v1',
    createdAt: '2026-01-01T00:02:00.000Z'
  })
}

export function memoryInvalidation(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    kind: 'memory-invalidation',
    id: 'memory_invalidation_helpful',
    tenantId: 'tenant_s1',
    createdAt: '2026-01-01T00:02:00.000Z',
    memoryVersionId: 'memory_version_helpful_v1',
    reason: 'poison',
    evidenceIds: ['evidence_counterexample'],
    replacementVersionId: 'memory_version_helpful_v2',
    impactedUseIds: ['memory_use_helpful'],
    impactReviewIds: ['impact_s1'],
    disposition: 'revoked',
    reasonDetail: 'A held-out counterexample makes the lesson unsafe.',
    invalidatedBy: { kind: 'system', id: 'memory-validator', version: '1' },
    ...overrides
  }
}

export function skillVersion(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const digest = 'b'.repeat(64)
  return {
    schemaVersion: 1,
    kind: 'skill-version',
    id: 'skill_version_identity_v1',
    tenantId: 'tenant_s1',
    createdAt,
    skillId: 'skill_identity_mapping',
    version: 1,
    artifact: {
      uri: 'artifact://skills/identity-mapping-v1',
      sha256: digest,
      mediaType: 'application/json',
      bytes: 128,
      span: { kind: 'whole' }
    },
    artifactDigest: digest,
    description: 'Builds an evidence-cited patient identity mapping proposal.',
    discoveryKeywords: ['identity', 'mapping'],
    contract: {
      input: { name: 'specialist-assignment.v1', version: 1, digest },
      output: { name: 'specialist-result.v1', version: 1, digest },
      contractDigest: digest
    },
    compatibleModelRoutes: [
      {
        provider: 'test',
        model: 'deterministic',
        revision: '1',
        effort: 'med',
        dataClasses: ['synthetic']
      }
    ],
    compatibleRuntimes: [
      { runtime: 'omp-rpc', versionConstraint: '18.0.6', harness: 'migration-control-plane' }
    ],
    requiredTools: [
      { name: 'evidence_read', version: '1', schemaDigest: digest, approval: 'read' }
    ],
    evaluationContractIds: ['evaluation_contract_s1'],
    dataClasses: ['synthetic'],
    authorityEnvelope: {
      toolNames: ['evidence_read'],
      networkDestinations: [],
      filesystemScopes: [],
      secretScopes: [],
      effectClasses: []
    },
    dependencyVersionIds: [],
    supportedTaskClasses: ['identity-mapping'],
    unsupportedTaskClasses: [],
    predecessorVersionId: null,
    license: 'MIT',
    signer: null,
    createdBy: { kind: 'system', id: 'skill-registry', version: '1' },
    ...overrides
  }
}

export function skillEvent(
  sequence: number,
  fromStatus: string | null,
  toStatus: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    kind: 'skill-lifecycle-event',
    id: `skill_lifecycle_identity_${sequence}`,
    tenantId: 'tenant_s1',
    createdAt: `2026-01-01T00:0${sequence}:00.000Z`,
    skillId: 'skill_identity_mapping',
    skillVersionId: 'skill_version_identity_v1',
    sequence,
    fromStatus,
    toStatus,
    certificationId: toStatus === 'certified' || toStatus === 'active' ? 'certification_s1' : null,
    evidenceIds: ['evaluation_result_s1'],
    reason: `Transition to ${toStatus}.`,
    transitionedBy: { kind: 'system', id: 'skill-registry', version: '1' },
    ...overrides
  }
}
