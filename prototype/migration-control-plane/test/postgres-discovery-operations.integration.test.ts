import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { canonicalJson, sha256Text } from '../src/canonical-json.js'
import {
  SourceAccessEnvelopeV1Schema,
  SourceAdapterDefinitionV1Schema,
  type SourceOperation
} from '../src/domain/source-adapter-contracts.js'
import {
  SourceRequestV1Schema,
  type SourceRequestV1
} from '../src/domain/source-probe-contracts.js'
import { buildPostgresCodeExtract, collectPostgresCode } from '../src/postgres-code-extractor.js'
import {
  buildPostgresDataProfile,
  collectPostgresDataProfile
} from '../src/postgres-data-profiler.js'
import {
  buildPostgresEstateInventories,
  collectPostgresEstateInventory
} from '../src/postgres-estate-inventory.js'
import {
  buildPostgresLineageSnapshot,
  collectPostgresLineage
} from '../src/postgres-lineage-inference.js'
import { PostgresSourceSandbox } from '../src/postgres-source-sandbox.js'
import { loadPagilaSourceFixture } from '../src/pagila-source-fixture-loader.js'
import { createPostgresTestDatabase, type PostgresTestDatabase } from './postgres-test-databases.js'
import { SOURCE_CONTRACT_SAMPLES } from './source-contract-samples.js'

const fixtureRoot = fileURLToPath(new URL('../fixtures/p6-pagila-v3.1.0/', import.meta.url))
const actor = { kind: 'system' as const, id: 'source-adapter-postgres', version: '1' }
let database: PostgresTestDatabase
let connectionString: string
let databaseName: string
let engineVersion: string

beforeAll(async () => {
  const fixture = await loadPagilaSourceFixture(fixtureRoot)
  database = await createPostgresTestDatabase({ encoding: 'UTF8', collation: 'C' })
  connectionString = database.connectionString
  databaseName = new URL(connectionString).pathname.slice(1)
  const client = new Client({ connectionString })
  await client.connect()
  try {
    engineVersion = (
      await client.query<{ server_version: string }>('SHOW server_version')
    ).rows[0]!.server_version.split(' ')[0]!
    await client.query(await readFile(fixture.schemaPath, 'utf8'))
    await client.query(await readFile(fixture.dataPath, 'utf8'))
    await client.query('ANALYZE')
  } finally {
    await client.end()
  }
}, 30_000)

afterAll(async () => {
  await database.drop()
})

function operationInput(
  operation: SourceOperation,
  parameters: Record<string, unknown>,
  suffix: string,
  queryLimit = 50
): {
  input: Parameters<PostgresSourceSandbox['run']>[0]
  request: SourceRequestV1
} {
  const source = {
    ...structuredClone(SOURCE_CONTRACT_SAMPLES['source-request.v1']).source,
    databaseName,
    engineVersion
  }
  const limits = {
    ...structuredClone(SOURCE_CONTRACT_SAMPLES['source-access-envelope.v1']).limits,
    queryLimit
  }
  const definition = SourceAdapterDefinitionV1Schema.parse(
    structuredClone(SOURCE_CONTRACT_SAMPLES['source-adapter-definition.v1'])
  )
  const access = SourceAccessEnvelopeV1Schema.parse({
    ...structuredClone(SOURCE_CONTRACT_SAMPLES['source-access-envelope.v1']),
    id: `source_access_${suffix}`,
    source,
    allowedOperations: [operation],
    limits,
    maxUses: 1
  })
  const request = SourceRequestV1Schema.parse({
    ...structuredClone(SOURCE_CONTRACT_SAMPLES['source-request.v1']),
    id: `source_request_${suffix}`,
    accessEnvelopeId: access.id,
    operation,
    source,
    parameters,
    parameterDigest: sha256Text(canonicalJson(parameters)),
    limits
  })
  return {
    request,
    input: {
      definition,
      access,
      request,
      connectionString,
      endpointDigest: source.endpointDigest
    }
  }
}

async function inventory(schemas = ['public']) {
  const operation = operationInput(
    'inventory-schema',
    { schemas, includeSystemSchemas: false },
    `pagila_inventory_${schemas.length}`
  )
  const run = await new PostgresSourceSandbox().run(operation.input, collectPostgresEstateInventory)
  return buildPostgresEstateInventories(operation.request, run, {
    systemInventoryId: `source_system_inventory_pagila_${schemas.length}`,
    schemaInventoryId: `source_schema_inventory_pagila_${schemas.length}`,
    observationId: `source_observation_pagila_inventory_${schemas.length}`,
    capturedBy: actor
  })
}

describe('PostgreSQL discovery operations', () => {
  it('captures exact system and schema inventory with explicit missing coverage', async () => {
    const complete = await inventory()
    expect(complete.system.coverage).toEqual({
      requestedSchemas: ['public'],
      observedSchemas: ['public'],
      deniedSchemas: [],
      unavailableSchemas: [],
      complete: true
    })
    expect(complete.schema.relations).toHaveLength(30)
    expect(complete.schema.constraints).toHaveLength(58)
    expect(complete.schema.indexes).toHaveLength(56)
    expect(complete.schema.routines).toHaveLength(10)
    expect(complete.schema.triggers).toHaveLength(15)
    expect(complete.schema.customTypes).toHaveLength(3)
    expect(complete.schema.sequences).toHaveLength(13)
    expect(complete.schema.relations).toContainEqual(
      expect.objectContaining({ name: 'payment', kind: 'partitioned-table' })
    )

    const partial = await inventory(['missing', 'public'])
    expect(partial.system.coverage).toMatchObject({
      observedSchemas: ['public'],
      unavailableSchemas: ['missing'],
      complete: false
    })
  })

  it('profiles bounded relations without retaining source values', async () => {
    const parameters = {
      relations: [
        { schema: 'public', name: 'actor', columns: ['actor_id', 'first_name', 'last_name'] },
        { schema: 'public', name: 'missing' }
      ],
      maxColumnsPerRelation: 3,
      sampleRowsPerColumn: 3
    }
    const operation = operationInput('profile-data', parameters, 'pagila_profile')
    const run = await new PostgresSourceSandbox().run(operation.input, collectPostgresDataProfile)
    const profile = buildPostgresDataProfile(operation.request, run, {
      profileId: 'source_data_profile_pagila_actor',
      observationId: 'source_observation_pagila_profile',
      capturedBy: actor
    })
    expect(profile.profiles[0]).toMatchObject({
      relation: { schema: 'public', name: 'actor' },
      rowCount: 200,
      columns: [
        { name: 'actor_id', nullCount: 0, distinctCount: 200 },
        { name: 'first_name', nullCount: 0 },
        { name: 'last_name', nullCount: 0 }
      ]
    })
    expect(profile.unavailableRelations).toEqual([
      expect.objectContaining({ relation: { schema: 'public', name: 'missing' } })
    ])
    expect(canonicalJson(profile)).not.toContain('PENELOPE')
  })

  it('extracts versioned routine, view, and trigger definitions into one artifact', async () => {
    const parameters = {
      schemas: ['public'],
      kinds: ['view', 'materialized-view', 'function', 'procedure', 'trigger']
    }
    const operation = operationInput('extract-code', parameters, 'pagila_code')
    const run = await new PostgresSourceSandbox().run(operation.input, collectPostgresCode)
    const body = run.value.artifactBody
    const extract = buildPostgresCodeExtract(operation.request, run, {
      codeExtractId: 'source_code_extract_pagila',
      observationId: 'source_observation_pagila_code',
      capturedBy: actor,
      artifact: {
        uri: 'artifact://source-code/pagila',
        sha256: sha256Text(body),
        mediaType: 'application/json',
        bytes: Buffer.byteLength(body),
        span: { kind: 'whole' }
      }
    })
    expect(extract.objects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'view',
          object: expect.objectContaining({ name: 'actor_info' })
        }),
        expect.objectContaining({
          kind: 'function',
          object: expect.objectContaining({ name: 'rewards_report' })
        }),
        expect.objectContaining({
          kind: 'trigger',
          object: expect.objectContaining({ name: 'last_updated' })
        })
      ])
    )
    expect(extract.contentDigest).toBe(sha256Text(body))
  })

  it('distinguishes declared, static, query-log, and runtime lineage evidence', async () => {
    const estate = await inventory()
    const operation = operationInput('infer-lineage', { schemas: ['public'] }, 'pagila_lineage')
    const run = await new PostgresSourceSandbox().run(operation.input, collectPostgresLineage)
    const snapshot = buildPostgresLineageSnapshot(operation.request, estate.schema, run, {
      lineageSnapshotId: 'source_lineage_snapshot_pagila',
      observationId: 'source_observation_pagila_lineage',
      evidenceIds: ['evidence_pagila_inventory'],
      capturedBy: actor
    })
    expect(snapshot.edges.filter((edge) => edge.kind === 'foreign-key')).toHaveLength(36)
    expect(snapshot.edges.filter((edge) => edge.kind === 'partition-of')).toHaveLength(7)
    expect(snapshot.edges.some((edge) => edge.kind === 'view-depends-on')).toBe(true)
    expect(snapshot.edges.some((edge) => edge.kind === 'trigger-invokes')).toBe(true)
    expect(snapshot.methodsAttempted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'catalog-declared', status: 'complete' }),
        expect.objectContaining({ method: 'static-analysis', status: 'partial' }),
        expect.objectContaining({ method: 'query-log', status: 'unavailable' }),
        expect.objectContaining({ method: 'runtime-trace', status: 'unavailable' })
      ])
    )
  })
})
