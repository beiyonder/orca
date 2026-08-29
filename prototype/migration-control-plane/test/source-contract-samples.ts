import { canonicalJson, sha256Text } from '../src/canonical-json.js'

const createdAt = '2026-01-01T00:00:00.000Z'
const laterAt = '2026-01-01T00:01:00.000Z'
const digestA = 'a'.repeat(64)
const digestB = 'b'.repeat(64)
const source = {
  sourceSystemId: 'source_system_pagila',
  engine: 'postgresql',
  engineVersion: '16.15',
  databaseName: 'pagila',
  endpointDigest: digestB,
  fixtureDigest: 'c22e7c170feafc06e70bee21771181e1880b5ef9c8ccc8567b093eeaf4fe025d'
}
const limits = {
  timeLimitMs: 60_000,
  statementTimeoutMs: 10_000,
  queryLimit: 20,
  rowLimit: 100_000,
  byteLimit: 16_777_216,
  concurrencyLimit: 1
}
const definitionLimits = { ...limits, queryLimit: 200 }
const parameters = { schemas: ['public'], includeSystemSchemas: false }

export const SOURCE_CONTRACT_SAMPLES = {
  'source-adapter-definition.v1': {
    schemaVersion: 1,
    kind: 'source-adapter-definition',
    id: 'source_adapter_definition_postgres_v1',
    tenantId: 'tenant_s1',
    createdAt,
    adapterId: 'source_adapter_postgres',
    version: 1,
    artifact: {
      uri: 'artifact://source-adapters/postgres-v1',
      sha256: digestA,
      mediaType: 'application/json',
      bytes: 128,
      span: { kind: 'whole' }
    },
    artifactDigest: digestA,
    description: 'Reads bounded PostgreSQL metadata and observations.',
    supportedSources: [
      {
        engine: 'postgresql',
        versionConstraint: '>=12 <17',
        requiredFeatures: ['pg_catalog'],
        unsupportedFeatures: ['superuser-only-observation']
      }
    ],
    operations: [
      'inventory-system',
      'inventory-schema',
      'profile-data',
      'extract-code',
      'infer-lineage',
      'run-safe-probe'
    ],
    dataClasses: ['synthetic'],
    defaultLimits: definitionLimits,
    errorRecovery: [
      {
        code: 'access-denied',
        retry: 'after-permission-change',
        preservesPartialEvidence: true,
        operatorAction: 'Grant the missing read scope or retain the denial.'
      },
      {
        code: 'source-unavailable',
        retry: 'after-reconnect',
        preservesPartialEvidence: true,
        operatorAction: null
      }
    ],
    authority: {
      mode: 'read-only',
      transactionMode: 'read-only',
      mutationVocabulary: [],
      filesystemScopes: [],
      allowsArbitrarySql: false
    },
    predecessorDefinitionId: null,
    license: 'MIT',
    signer: null,
    createdBy: { kind: 'system', id: 'source-adapter-registry', version: '1' }
  },
  'source-access-envelope.v1': {
    schemaVersion: 1,
    kind: 'source-access-envelope',
    id: 'source_access_pagila',
    tenantId: 'tenant_s1',
    createdAt,
    adapterDefinitionId: 'source_adapter_definition_postgres_v1',
    assignmentId: 'assignment_s1',
    attemptId: 'attempt_s1',
    fence: 1,
    source,
    allowedOperations: ['inventory-system', 'inventory-schema'],
    permissionEvidenceIds: ['evidence_source_grant'],
    credentialReference: null,
    networkEndpointDigests: [digestB],
    dataClasses: ['synthetic'],
    limits,
    maxUses: 2,
    issuedAt: createdAt,
    expiresAt: '2026-01-01T01:00:00.000Z',
    revokedAt: null,
    authority: {
      mode: 'read-only',
      transactionMode: 'read-only',
      mutationVocabulary: [],
      filesystemScopes: []
    },
    issuedBy: { kind: 'system', id: 'source-policy', version: '1' }
  },
  'source-request.v1': {
    schemaVersion: 1,
    kind: 'source-request',
    id: 'source_request_pagila_inventory',
    tenantId: 'tenant_s1',
    createdAt,
    adapterDefinitionId: 'source_adapter_definition_postgres_v1',
    accessEnvelopeId: 'source_access_pagila',
    operation: 'inventory-schema',
    source,
    parameters,
    parameterDigest: sha256Text(canonicalJson(parameters)),
    limits,
    expectedSnapshotToken: null,
    probeRequestId: null,
    dataClass: 'synthetic',
    requestedBy: { kind: 'system', id: 'discovery-coordinator', version: '1' }
  },
  'source-observation.v1': {
    schemaVersion: 1,
    kind: 'source-observation',
    id: 'source_observation_pagila_inventory',
    tenantId: 'tenant_s1',
    createdAt: laterAt,
    requestId: 'source_request_pagila_inventory',
    adapterDefinitionId: 'source_adapter_definition_postgres_v1',
    accessEnvelopeId: 'source_access_pagila',
    operation: 'inventory-schema',
    source,
    observedSnapshotToken: 'pg-snapshot-fixture',
    outcome: {
      status: 'succeeded',
      evidence: [
        {
          evidenceId: 'evidence_pagila_inventory',
          artifact: {
            uri: 'artifact://source-observations/pagila-inventory',
            sha256: digestA,
            mediaType: 'application/json',
            bytes: 512,
            span: { kind: 'whole' }
          },
          role: 'schema-inventory',
          dataClass: 'synthetic',
          rowCount: 22,
          complete: true,
          limitations: []
        }
      ],
      coverage: {
        requested: ['public'],
        observed: ['public'],
        denied: [],
        unavailable: [],
        complete: true
      },
      warnings: []
    },
    usage: { queryCount: 2, rowCount: 22, byteCount: 512, wallTimeMs: 10 },
    startedAt: createdAt,
    completedAt: laterAt,
    observedBy: { kind: 'system', id: 'source-adapter-postgres', version: '1' }
  }
}
