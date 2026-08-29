const tenantId = 'tenant_s1'
const createdAt = '2026-01-01T00:00:00.000Z'
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
const retrievalCandidate = {
  id: 'retrieval_candidate_s1',
  chunkId: 'corpus_chunk_s1',
  sourceManifestId: 'corpus_manifest_s1',
  sourceId: 'corpus_source_s1',
  sourceVersion: 1,
  sourceDigest: digestA,
  parseVersionId: 'corpus_parse_s1',
  sourceSpan: { kind: 'text-lines', startLine: 1, endLine: 1 },
  contentDigest: digestA,
  tokenEstimate: 8,
  dataClass: 'synthetic',
  sourceClass: 'reference',
  channels: ['structured', 'lexical'],
  channelRanks: { structured: 1, lexical: 1 },
  scores: { exact: 1, lexical: 1, semantic: 0, graph: 0, fused: 0.1 },
  eligible: true,
  exclusionReason: null
}

export const KNOWLEDGE_RETRIEVAL_CONTRACT_SAMPLES = {
  'corpus-source-manifest.v1': {
    schemaVersion: 1,
    kind: 'corpus-source-manifest',
    id: 'corpus_manifest_s1',
    tenantId,
    createdAt,
    sourceId: 'corpus_source_s1',
    version: 1,
    sourceVersion: 'v1',
    sourceClass: 'reference',
    visibility: 'tenant',
    owner: { kind: 'vendor', id: 'vendor_s1', name: 'Fixture Vendor' },
    permission: {
      basis: 'licensed',
      licenseId: 'MIT',
      termsUri: null,
      ingestAllowed: true,
      renderAllowed: true,
      derivativeAllowed: true
    },
    canonicalUri: 'source://s1/reference',
    title: 'Synthetic source reference',
    publisher: 'Fixture Vendor',
    content: { ...content, uri: `corpus-object://sha256/${digestA}` },
    dataClass: 'synthetic',
    applicability: {
      scope,
      product: 'fixture',
      versionConstraint: 'v1',
      effectiveFrom: createdAt,
      effectiveUntil: null
    },
    observedAt: createdAt,
    sourcePublishedAt: createdAt,
    freshness: { kind: 'immutable', staleDisposition: 'never-stale' },
    retention: { retainUntil: null, deletionMode: 'retain', policyId: 'fixture-retention' },
    supersedesManifestId: null,
    limitations: ['Synthetic fixture only.'],
    registeredBy: actor
  },
  'corpus-parse-version.v1': {
    schemaVersion: 1,
    kind: 'corpus-parse-version',
    id: 'corpus_parse_s1',
    tenantId,
    createdAt,
    sourceManifestId: 'corpus_manifest_s1',
    sourceId: 'corpus_source_s1',
    sourceVersion: 1,
    sourceDigest: digestA,
    parser: { name: 'fixture-parser', version: '1', implementationDigest: digestB },
    output: { ...content, uri: 'artifact://s1/parsed', sha256: digestB },
    warnings: [],
    parsedBy: actor
  },
  'corpus-chunk.v1': {
    schemaVersion: 1,
    kind: 'corpus-chunk',
    id: 'corpus_chunk_s1',
    tenantId,
    createdAt,
    sourceManifestId: 'corpus_manifest_s1',
    parseVersionId: 'corpus_parse_s1',
    ordinal: 0,
    chunkType: 'document',
    content: 'patient_num repeats across facilities',
    contentDigest: digestA,
    sourceSpan: { kind: 'text-lines', startLine: 1, endLine: 1 },
    mediaType: 'text/plain',
    tokenEstimate: 8,
    sourceRole: 'external-reference',
    dataClass: 'synthetic',
    applicability: {
      scope,
      product: 'fixture',
      versionConstraint: 'v1',
      effectiveFrom: createdAt,
      effectiveUntil: null
    },
    entityKeys: ['legacy_patient.patient_num']
  },
  'corpus-entity.v1': {
    schemaVersion: 1,
    kind: 'corpus-entity',
    id: 'corpus_entity_s1',
    tenantId,
    createdAt,
    entityType: 'column',
    canonicalKey: 'legacy_patient.patient_num',
    displayName: 'patient_num',
    attributes: { nullable: false },
    provenanceChunkIds: ['corpus_chunk_s1']
  },
  'corpus-relation.v1': {
    schemaVersion: 1,
    kind: 'corpus-relation',
    id: 'corpus_relation_s1',
    tenantId,
    createdAt,
    fromEntityId: 'corpus_entity_s1',
    toEntityId: 'corpus_entity_target',
    relationType: 'maps-to',
    directed: true,
    attributes: { confidence: 'observed' },
    provenanceChunkIds: ['corpus_chunk_s1']
  },
  'retrieval-query.v1': {
    schemaVersion: 1,
    kind: 'retrieval-query',
    id: 'retrieval_query_s1',
    tenantId,
    createdAt,
    purpose: 'specialist-assignment',
    role: 'mapping',
    question: 'Which source key is unique?',
    lexicalTerms: ['legacy_patient.patient_num'],
    semanticQuery: null,
    scopes: [scope],
    allowedSourceClasses: ['reference', 'environment-evidence'],
    allowedDataClasses: ['synthetic'],
    requiredCoverage: [{ key: 'identity-key', evidenceTerms: ['patient_num', 'facility_id'] }],
    allowedSourceIds: ['corpus_source_s1'],
    currentOnly: true,
    asOf: createdAt,
    maximumAgeDays: 30,
    channels: { structured: true, lexical: true, semantic: false, graph: false },
    graphSeedEntityIds: [],
    maxGraphDepth: 0,
    maxCandidates: 10,
    tokenBudget: 1_000,
    requestedBy: actor
  },
  'retrieval-trace.v1': {
    schemaVersion: 1,
    kind: 'retrieval-trace',
    id: 'retrieval_trace_s1',
    tenantId,
    createdAt,
    queryId: 'retrieval_query_s1',
    policyVersion: '1',
    channelVersions: {
      structured: '1',
      lexical: '1',
      semantic: 'disabled',
      graph: 'disabled',
      fusion: '1'
    },
    candidates: [retrievalCandidate],
    includedCandidateIds: ['retrieval_candidate_s1'],
    excluded: [],
    coverage: { required: ['identity-key'], covered: ['identity-key'], missing: [] },
    warnings: [],
    completedAt: createdAt
  },
  'knowledge-context-manifest.v1': {
    schemaVersion: 1,
    kind: 'knowledge-context-manifest',
    id: 'knowledge_context_s1',
    tenantId,
    createdAt,
    queryId: 'retrieval_query_s1',
    traceId: 'retrieval_trace_s1',
    compilerVersion: '1',
    policyVersion: '1',
    tokenBudget: 1_000,
    tokenAllocation: 8,
    items: [
      {
        candidateId: 'retrieval_candidate_s1',
        chunkId: 'corpus_chunk_s1',
        sourceManifestId: 'corpus_manifest_s1',
        sourceVersion: 1,
        sourceDigest: digestA,
        sourceSpan: { kind: 'text-lines', startLine: 1, endLine: 1 },
        renderedContent: 'patient_num repeats across facilities',
        renderedDigest: digestA,
        tokenEstimate: 8,
        position: 0,
        channels: ['structured', 'lexical'],
        fusedScore: 0.1,
        redactions: [],
        inclusionReason: 'Required identity evidence.'
      }
    ],
    excluded: [],
    renderedContextDigest: digestB,
    compiledBy: actor
  }
}
