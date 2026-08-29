import { canonicalJson, sha256Text } from '../src/canonical-json.js'

const tenantId = 'tenant_s1'
const missionId = 'mission_s1'
const createdAt = '2026-01-01T00:00:00.000Z'
const laterAt = '2026-01-01T00:01:00.000Z'
const digestA = 'a'.repeat(64)
const digestB = 'b'.repeat(64)
const actor = { kind: 'system', id: 'system_s1' }
const scope = { environment: 'synthetic', system: 'legacy', entity: 'legacy_patient' }
const content = {
  uri: 'artifact://s1/source',
  sha256: digestA,
  mediaType: 'application/json',
  bytes: 128,
  span: { kind: 'whole' }
}
const modelRoute = {
  provider: 'local',
  model: 'deterministic',
  revision: '1',
  effort: 'med',
  dataClasses: ['synthetic']
}
const tool = {
  name: 'evidence_read',
  version: '1',
  schemaDigest: digestA,
  approval: 'read'
}
const memoryContent = {
  lesson: 'Declared identifiers require observed uniqueness before mapping acceptance.'
}
const memoryContentDigest = sha256Text(canonicalJson(memoryContent))

export const MEMORY_SKILL_CONTRACT_SAMPLES = {
  'memory-candidate.v1': {
    schemaVersion: 1,
    kind: 'memory-candidate',
    id: 'memory_candidate_s1',
    tenantId,
    createdAt,
    memoryType: 'failure',
    missionId,
    sourceRecordIds: ['artifact_version_failed', 'correction_request_s1'],
    sourceEvidenceIds: ['evidence_s1'],
    proposedContent: memoryContent,
    contentDigest: memoryContentDigest,
    proposedScope: scope,
    applicability: {
      environment: 'synthetic',
      product: 'legacy-ehr',
      versionConstraint: 'fixture-v1',
      validFrom: createdAt,
      validUntil: null
    },
    creationMethod: 'diagnosed-failure',
    proposedBy: actor,
    creatorVersions: { compiler: '1' },
    reasonForRetention: 'Prevent recurrence of the evaluated identity-key failure.',
    validationContractIds: ['evaluation_contract_s1'],
    dataClass: 'synthetic',
    retention: { expiresAt: null, deletionMode: 'retain', policyId: 'fixture-memory' },
    authorityDelta: 'none',
    state: { status: 'quarantined', usePolicy: 'none', validationStatus: 'not-run' }
  },
  'memory-version.v1': {
    schemaVersion: 1,
    kind: 'memory-version',
    id: 'memory_version_s1',
    tenantId,
    createdAt,
    memoryId: 'memory_s1',
    version: 1,
    candidateId: 'memory_candidate_s1',
    memoryType: 'failure',
    canonicalSourceRecordIds: ['artifact_version_failed', 'correction_request_s1'],
    canonicalSourceEvidenceIds: ['evidence_s1'],
    content: memoryContent,
    contentDigest: memoryContentDigest,
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
    createdBy: actor
  },
  'memory-use.v1': {
    schemaVersion: 1,
    kind: 'memory-use',
    id: 'memory_use_s1',
    tenantId,
    createdAt,
    memoryVersionId: 'memory_version_s1',
    contextManifestId: 'context_s1',
    assignmentId: 'assignment_s1',
    attemptId: 'attempt_s1',
    retrievalQueryId: 'retrieval_query_s1',
    retrievalTraceId: 'retrieval_trace_s1',
    channel: 'lexical',
    rank: 1,
    score: 1,
    renderedDigest: digestA,
    downstreamRecordIds: ['assignment_result_s1'],
    attribution: 'helped'
  },
  'memory-invalidation.v1': {
    schemaVersion: 1,
    kind: 'memory-invalidation',
    id: 'memory_invalidation_s1',
    tenantId,
    createdAt: laterAt,
    memoryVersionId: 'memory_version_s1',
    reason: 'poison',
    evidenceIds: ['evidence_s1'],
    replacementVersionId: 'memory_version_s2',
    impactedUseIds: ['memory_use_s1'],
    impactReviewIds: ['impact_s1'],
    disposition: 'revoked',
    reasonDetail: 'Held-out evaluation found a harmful counterexample.',
    invalidatedBy: actor
  },
  'skill-version.v1': {
    schemaVersion: 1,
    kind: 'skill-version',
    id: 'skill_version_s1',
    tenantId,
    createdAt,
    skillId: 'skill_s1',
    version: 1,
    artifact: content,
    artifactDigest: digestA,
    description: 'Builds a cited identity mapping proposal.',
    discoveryKeywords: ['identity', 'mapping'],
    contract: {
      input: { name: 'specialist-assignment.v1', version: 1, digest: digestA },
      output: { name: 'specialist-result.v1', version: 1, digest: digestB },
      contractDigest: digestA
    },
    compatibleModelRoutes: [modelRoute],
    compatibleRuntimes: [
      { runtime: 'omp-rpc', versionConstraint: '18.0.6', harness: 'migration-control-plane' }
    ],
    requiredTools: [tool],
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
    createdBy: actor
  },
  'skill-lifecycle-event.v1': {
    schemaVersion: 1,
    kind: 'skill-lifecycle-event',
    id: 'skill_lifecycle_s1',
    tenantId,
    createdAt,
    skillId: 'skill_s1',
    skillVersionId: 'skill_version_s1',
    sequence: 1,
    fromStatus: null,
    toStatus: 'quarantined',
    certificationId: null,
    evidenceIds: ['evidence_s1'],
    reason: 'New skill version begins in quarantine.',
    transitionedBy: actor
  }
}
