import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runPagilaDiscoveryPipeline } from '../src/pagila-discovery-pipeline.js'
import { loadPagilaSourceFixture } from '../src/pagila-source-fixture-loader.js'
import { createPostgresTestDatabase, type PostgresTestDatabase } from './postgres-test-databases.js'

const labRoot = fileURLToPath(new URL('..', import.meta.url))
const fixtureRoot = fileURLToPath(new URL('../fixtures/p6-pagila-v3.1.0/', import.meta.url))
let database: PostgresTestDatabase

beforeAll(async () => {
  const fixture = await loadPagilaSourceFixture(fixtureRoot)
  database = await createPostgresTestDatabase({ encoding: 'UTF8', collation: 'C' })
  const client = new Client({ connectionString: database.connectionString })
  await client.connect()
  try {
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

describe('full Pagila discovery pipeline', () => {
  it('produces cited gaps, safe probe, target model, CDC truth, and proposal-only plan', async () => {
    const result = await runPagilaDiscoveryPipeline({
      connectionString: database.connectionString,
      labRoot
    })
    expect(result.cases.fixtureDigest).toBe(
      '828ffc6c72c6635bec367e91c06b17c0aed278ba100fe67861a412eba9eb995d'
    )
    expect(result.comparison.summary).toEqual({
      supported: 1,
      refuted: 8,
      unresolved: 0,
      denied: 1,
      stale: 0,
      materialContradictions: 8
    })
    expect(result.comparison.results.every((claim) => claim.evidenceIds.length > 0)).toBe(true)
    expect(result.plan.humanException).toMatchObject({
      gapIds: [expect.stringContaining('private_audit')]
    })
    expect(result.ranking.gaps).toHaveLength(9)
    expect(result.plan.selectedCandidateId).toBe('probe_verify_pagila_claims')
    expect(result.cdc.gaps).toEqual([])
    expect(result.cdc.eventDispositions).toHaveLength(10)
    expect(
      result.cdc.eventDispositions.filter((event) => event.disposition === 'duplicate')
    ).toHaveLength(1)
    expect(result.proposal).toMatchObject({
      authority: 'proposal-only',
      state: 'reconciler-required',
      estate: { assetCount: 30, coverageComplete: true }
    })
    expect(result.proposal.mappings).toHaveLength(22)
    expect(result.proposal.tasks).toHaveLength(5)
    expect(result.target.status).toBe('observed')
  })
})
