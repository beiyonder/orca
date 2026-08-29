const createdAt = '2026-01-01T00:01:00.000Z'
const digestA = 'a'.repeat(64)
const source = {
  sourceSystemId: 'source_system_pagila',
  engine: 'postgresql',
  engineVersion: '16.15',
  databaseName: 'pagila',
  endpointDigest: 'b'.repeat(64),
  fixtureDigest: 'c22e7c170feafc06e70bee21771181e1880b5ef9c8ccc8567b093eeaf4fe025d'
}
const lineage = {
  source,
  requestId: 'source_request_pagila_inventory',
  observationId: 'source_observation_pagila_inventory',
  snapshotToken: 'fixture-snapshot',
  capturedAt: createdAt,
  capturedBy: { kind: 'system', id: 'source-adapter-postgres', version: '1' }
}

export const SOURCE_DISCOVERY_CONTRACT_SAMPLES = {
  'source-system-inventory.v1': {
    schemaVersion: 1,
    kind: 'source-system-inventory',
    id: 'source_system_inventory_pagila',
    tenantId: 'tenant_s1',
    createdAt,
    lineage,
    database: {
      name: 'pagila',
      owner: 'postgres',
      encoding: 'UTF8',
      collation: 'C',
      characterType: 'C',
      defaultTablespace: 'pg_default'
    },
    server: {
      version: '16.15',
      versionNumber: 160015,
      currentUser: 'postgres',
      readOnly: true,
      settings: { server_version_num: '160015' }
    },
    schemas: [{ name: 'public', owner: 'postgres', canUse: true, canCreate: false }],
    extensions: [{ name: 'plpgsql', version: '1.0', schema: 'pg_catalog' }],
    coverage: {
      requestedSchemas: ['public'],
      observedSchemas: ['public'],
      deniedSchemas: [],
      unavailableSchemas: [],
      complete: true
    }
  },
  'source-schema-inventory.v1': {
    schemaVersion: 1,
    kind: 'source-schema-inventory',
    id: 'source_schema_inventory_pagila',
    tenantId: 'tenant_s1',
    createdAt,
    lineage,
    schemas: ['public'],
    relations: [
      {
        schema: 'public',
        name: 'actor',
        kind: 'table',
        owner: 'postgres',
        parent: null,
        partitionKey: null,
        rowSecurity: false,
        estimatedRows: 200
      }
    ],
    columns: [
      {
        schema: 'public',
        name: 'actor',
        ordinal: 1,
        column: 'actor_id',
        dataType: 'integer',
        nullable: false,
        generated: false,
        defaultDigest: digestA
      }
    ],
    constraints: [
      {
        schema: 'public',
        name: 'actor',
        constraint: 'actor_pkey',
        kind: 'primary-key',
        columns: ['actor_id'],
        referencedRelation: null,
        referencedColumns: [],
        definitionDigest: digestA
      }
    ],
    indexes: [
      {
        schema: 'public',
        name: 'actor',
        index: 'actor_pkey',
        unique: true,
        primary: true,
        valid: true,
        definitionDigest: digestA
      }
    ],
    routines: [],
    triggers: [],
    customTypes: [],
    sequences: [],
    grants: [],
    denials: []
  },
  'source-data-profile.v1': {
    schemaVersion: 1,
    kind: 'source-data-profile',
    id: 'source_data_profile_pagila_actor',
    tenantId: 'tenant_s1',
    createdAt,
    lineage,
    dataClass: 'synthetic',
    requestedRelations: [{ schema: 'public', name: 'actor' }],
    profiles: [
      {
        relation: { schema: 'public', name: 'actor' },
        rowCount: 200,
        rowCountKind: 'exact',
        rowsScanned: 200,
        scanPredicateDigest: null,
        columns: [
          {
            name: 'actor_id',
            dataType: 'integer',
            rowsObserved: 200,
            nullCount: 0,
            distinctCount: 200,
            minimumDigest: digestA,
            maximumDigest: digestA,
            sampleValueDigests: [digestA],
            limitations: []
          }
        ],
        limitations: []
      }
    ],
    denials: [],
    unavailableRelations: [],
    coverage: { requested: 1, profiled: 1, denied: 0, unavailable: 0, complete: true }
  },
  'source-code-extract.v1': {
    schemaVersion: 1,
    kind: 'source-code-extract',
    id: 'source_code_extract_pagila',
    tenantId: 'tenant_s1',
    createdAt,
    lineage,
    artifact: {
      uri: 'artifact://source-code/pagila',
      sha256: digestA,
      mediaType: 'application/json',
      bytes: 128,
      span: { kind: 'whole' }
    },
    contentDigest: digestA,
    objects: [
      {
        object: { schema: 'public', name: 'actor_info', identity: 'public.actor_info' },
        kind: 'view',
        language: 'sql',
        definitionDigest: digestA,
        artifactPointer: '/definitions/0',
        dependencyHints: [],
        limitations: []
      }
    ],
    coverage: {
      requestedKinds: ['view'],
      extracted: 1,
      denied: [],
      unavailable: [],
      complete: true
    }
  },
  'source-lineage-snapshot.v1': {
    schemaVersion: 1,
    kind: 'source-lineage-snapshot',
    id: 'source_lineage_snapshot_pagila',
    tenantId: 'tenant_s1',
    createdAt,
    lineage,
    nodes: [
      {
        id: 'relation:public.actor',
        kind: 'relation',
        qualifiedName: 'public.actor',
        definitionDigest: null
      },
      {
        id: 'relation:public.film_actor',
        kind: 'relation',
        qualifiedName: 'public.film_actor',
        definitionDigest: null
      }
    ],
    edges: [
      {
        id: 'lineage_edge_actor',
        fromNodeId: 'relation:public.film_actor',
        toNodeId: 'relation:public.actor',
        kind: 'foreign-key',
        method: 'catalog-declared',
        confidence: 'observed',
        evidenceIds: ['evidence_pagila_inventory'],
        limitations: []
      }
    ],
    methodsAttempted: [
      {
        method: 'catalog-declared',
        status: 'complete',
        evidenceId: 'evidence_pagila_inventory',
        reason: null
      }
    ],
    unresolvedReferences: []
  }
}
