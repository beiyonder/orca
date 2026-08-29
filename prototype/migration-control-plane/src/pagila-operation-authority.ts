import { canonicalJson, sha256Text } from './canonical-json.js'
import { EvidenceIdSchema } from './domain/common-contracts.js'
import {
  SourceAccessEnvelopeV1Schema,
  SourceAdapterDefinitionV1Schema,
  type SourceOperation,
  type SourceReadLimits
} from './domain/source-adapter-contracts.js'
import { SourceRequestV1Schema } from './domain/source-probe-contracts.js'

const adapterDigest = sha256Text('orca-postgres-source-adapter-v1')
const permissionEvidenceId = EvidenceIdSchema.parse('evidence_pagila_source_permission')

export function createPagilaOperationAuthority(input: {
  operation: SourceOperation
  parameters: unknown
  suffix: string
  databaseName: string
  engineVersion: string
  endpointDigest: string
  fixtureDigest: string
  limits?: Partial<SourceReadLimits>
}) {
  const defaultLimits: SourceReadLimits = {
    timeLimitMs: 120_000,
    statementTimeoutMs: 30_000,
    queryLimit: 200,
    rowLimit: 250_000,
    byteLimit: 67_108_864,
    concurrencyLimit: 1
  }
  const limits = { ...defaultLimits, ...input.limits }
  const source = {
    sourceSystemId: 'source_system_pagila',
    engine: 'postgresql',
    engineVersion: input.engineVersion,
    databaseName: input.databaseName,
    endpointDigest: input.endpointDigest,
    fixtureDigest: input.fixtureDigest
  }
  const definition = SourceAdapterDefinitionV1Schema.parse({
    schemaVersion: 1,
    kind: 'source-adapter-definition',
    id: 'source_adapter_definition_postgres_v1',
    tenantId: 'tenant_s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    adapterId: 'source_adapter_postgres',
    version: 1,
    artifact: {
      uri: 'artifact://source-adapters/postgres-v1',
      sha256: adapterDigest,
      mediaType: 'application/json',
      bytes: 32,
      span: { kind: 'whole' }
    },
    artifactDigest: adapterDigest,
    description: 'Executes bounded semantic PostgreSQL discovery reads.',
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
      'inspect-cdc',
      'run-safe-probe',
      'inspect-capabilities'
    ],
    dataClasses: ['synthetic'],
    defaultLimits,
    errorRecovery: [
      {
        code: 'access-denied',
        retry: 'after-permission-change',
        preservesPartialEvidence: true,
        operatorAction: 'Retain denial evidence or grant the exact missing read scope.'
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
  })
  const access = SourceAccessEnvelopeV1Schema.parse({
    schemaVersion: 1,
    kind: 'source-access-envelope',
    id: `source_access_${input.suffix}`,
    tenantId: 'tenant_s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    adapterDefinitionId: definition.id,
    assignmentId: 'assignment_s1',
    attemptId: 'attempt_s1',
    fence: 1,
    source,
    allowedOperations: [input.operation],
    permissionEvidenceIds: [permissionEvidenceId],
    credentialReference: 'secret://runtime/pagila-source',
    networkEndpointDigests: [input.endpointDigest],
    dataClasses: ['synthetic'],
    limits,
    maxUses: 1,
    issuedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-02T00:00:00.000Z',
    revokedAt: null,
    authority: {
      mode: 'read-only',
      transactionMode: 'read-only',
      mutationVocabulary: [],
      filesystemScopes: []
    },
    issuedBy: { kind: 'system', id: 'source-policy', version: '1' }
  })
  const request = SourceRequestV1Schema.parse({
    schemaVersion: 1,
    kind: 'source-request',
    id: `source_request_${input.suffix}`,
    tenantId: 'tenant_s1',
    createdAt: '2026-01-01T00:10:00.000Z',
    adapterDefinitionId: definition.id,
    accessEnvelopeId: access.id,
    operation: input.operation,
    source,
    parameters: input.parameters,
    parameterDigest: sha256Text(canonicalJson(input.parameters)),
    limits,
    expectedSnapshotToken: null,
    probeRequestId: null,
    dataClass: 'synthetic',
    requestedBy: { kind: 'system', id: 'discovery-coordinator', version: '1' }
  })
  return { definition, access, request }
}
