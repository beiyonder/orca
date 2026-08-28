import { sha256Text } from '../src/canonical-json.js'

export const corpusSourceBytes = Buffer.from(
  'legacy_patient.patient_num is not globally unique.\nlegacy_patient.facility_id plus patient_num is unique.\n'
)
export const corpusParsedBytes = Buffer.from(corpusSourceBytes)
const sourceDigest = sha256Text(corpusSourceBytes)
const parsedDigest = sha256Text(corpusParsedBytes)
const createdAt = '2026-01-01T00:00:00.000Z'
const scope = { environment: 'synthetic', system: 'legacy-ehr', entity: 'legacy_patient' }

export function corpusManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    kind: 'corpus-source-manifest',
    id: 'corpus_manifest_identity_profile',
    tenantId: 'tenant_s1',
    createdAt,
    sourceId: 'corpus_source_identity_profile',
    version: 1,
    sourceVersion: 'fixture-v1',
    sourceClass: 'environment-evidence',
    visibility: 'tenant',
    owner: { kind: 'system', id: 'fixture', name: 'Synthetic Fixture' },
    permission: {
      basis: 'internal',
      licenseId: 'MIT',
      termsUri: null,
      ingestAllowed: true,
      renderAllowed: true,
      derivativeAllowed: true
    },
    canonicalUri: 'fixture://s1/identity-profile',
    title: 'Synthetic identity profile',
    publisher: 'Orca Lab',
    content: {
      uri: `corpus-object://sha256/${sourceDigest}`,
      sha256: sourceDigest,
      mediaType: 'text/plain',
      bytes: corpusSourceBytes.byteLength,
      span: { kind: 'whole' }
    },
    dataClass: 'synthetic',
    applicability: {
      scope,
      product: 'legacy-ehr',
      versionConstraint: 'fixture-v1',
      effectiveFrom: createdAt,
      effectiveUntil: null
    },
    observedAt: createdAt,
    sourcePublishedAt: null,
    freshness: { kind: 'refresh-after', maxAgeDays: 30, staleDisposition: 'exclude' },
    retention: { retainUntil: null, deletionMode: 'retain', policyId: 'synthetic-fixture' },
    supersedesManifestId: null,
    limitations: ['Synthetic fixture only.'],
    registeredBy: { kind: 'system', id: 'corpus-ingestion', version: '1' },
    ...overrides
  }
}

export function corpusParseBundle() {
  const chunks = [
    {
      schemaVersion: 1,
      kind: 'corpus-chunk',
      id: 'corpus_chunk_patient_num',
      tenantId: 'tenant_s1',
      createdAt,
      sourceManifestId: 'corpus_manifest_identity_profile',
      parseVersionId: 'corpus_parse_identity_profile',
      ordinal: 0,
      chunkType: 'data-profile',
      content: 'legacy_patient.patient_num is not globally unique.',
      contentDigest: sha256Text('legacy_patient.patient_num is not globally unique.'),
      sourceSpan: { kind: 'text-lines' as const, startLine: 1, endLine: 1 },
      mediaType: 'text/plain',
      tokenEstimate: 8,
      sourceRole: 'direct-observation',
      dataClass: 'synthetic' as const,
      applicability: {
        scope,
        product: 'legacy-ehr',
        versionConstraint: 'fixture-v1',
        effectiveFrom: createdAt,
        effectiveUntil: null
      },
      entityKeys: ['legacy_patient.patient_num']
    },
    {
      schemaVersion: 1,
      kind: 'corpus-chunk',
      id: 'corpus_chunk_composite_key',
      tenantId: 'tenant_s1',
      createdAt,
      sourceManifestId: 'corpus_manifest_identity_profile',
      parseVersionId: 'corpus_parse_identity_profile',
      ordinal: 1,
      chunkType: 'data-profile',
      content: 'legacy_patient.facility_id plus patient_num is unique.',
      contentDigest: sha256Text('legacy_patient.facility_id plus patient_num is unique.'),
      sourceSpan: { kind: 'text-lines' as const, startLine: 2, endLine: 2 },
      mediaType: 'text/plain',
      tokenEstimate: 9,
      sourceRole: 'direct-observation',
      dataClass: 'synthetic' as const,
      applicability: {
        scope,
        product: 'legacy-ehr',
        versionConstraint: 'fixture-v1',
        effectiveFrom: createdAt,
        effectiveUntil: null
      },
      entityKeys: ['legacy_patient.facility_id', 'legacy_patient.patient_num']
    }
  ]
  const entities = [
    {
      schemaVersion: 1,
      kind: 'corpus-entity',
      id: 'corpus_entity_patient_num',
      tenantId: 'tenant_s1',
      createdAt,
      entityType: 'column',
      canonicalKey: 'legacy_patient.patient_num',
      displayName: 'patient_num',
      attributes: { unique: false },
      provenanceChunkIds: ['corpus_chunk_patient_num']
    },
    {
      schemaVersion: 1,
      kind: 'corpus-entity',
      id: 'corpus_entity_facility_id',
      tenantId: 'tenant_s1',
      createdAt,
      entityType: 'column',
      canonicalKey: 'legacy_patient.facility_id',
      displayName: 'facility_id',
      attributes: { participatesInCompositeKey: true },
      provenanceChunkIds: ['corpus_chunk_composite_key']
    }
  ]
  return {
    parse: {
      schemaVersion: 1,
      kind: 'corpus-parse-version',
      id: 'corpus_parse_identity_profile',
      tenantId: 'tenant_s1',
      createdAt,
      sourceManifestId: 'corpus_manifest_identity_profile',
      sourceId: 'corpus_source_identity_profile',
      sourceVersion: 1,
      sourceDigest,
      parser: { name: 'line-parser', version: '1', implementationDigest: 'b'.repeat(64) },
      output: {
        uri: `corpus-parse://sha256/${parsedDigest}`,
        sha256: parsedDigest,
        mediaType: 'text/plain',
        bytes: corpusParsedBytes.byteLength,
        span: { kind: 'whole' }
      },
      warnings: [],
      parsedBy: { kind: 'system', id: 'corpus-parser', version: '1' }
    },
    chunks,
    entities,
    relations: [
      {
        schemaVersion: 1,
        kind: 'corpus-relation',
        id: 'corpus_relation_composite_key',
        tenantId: 'tenant_s1',
        createdAt,
        fromEntityId: 'corpus_entity_facility_id',
        toEntityId: 'corpus_entity_patient_num',
        relationType: 'composes-key-with',
        directed: false,
        attributes: { observedUnique: true },
        provenanceChunkIds: ['corpus_chunk_composite_key']
      }
    ],
    parsedBytes: corpusParsedBytes
  }
}
