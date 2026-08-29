import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runExperiment } from '../src/experiment-runner.js'
import { loadPagilaSourceFixture } from '../src/pagila-source-fixture-loader.js'
import { verifyRunArtifact } from '../src/run-artifact-integrity.js'
import { createPostgresTestDatabase, type PostgresTestDatabase } from './postgres-test-databases.js'

const labRoot = fileURLToPath(new URL('..', import.meta.url))
const fixtureRoot = fileURLToPath(new URL('../fixtures/p6-pagila-v3.1.0/', import.meta.url))
const roots: string[] = []
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
  process.env.PAGILA_DISCOVERY_DATABASE_URL = database.connectionString
}, 30_000)

afterAll(async () => {
  delete process.env.PAGILA_DISCOVERY_DATABASE_URL
  await database.drop()
  await Promise.all(roots.splice(0).map(async (root) => rm(root, { recursive: true, force: true })))
})

async function outputRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'orca-discovery-experiment-'))
  roots.push(root)
  return root
}

describe('Phase 6 qualification experiments', () => {
  it.each([
    ['EXP-02', 602, '8/8 material contradictions detected'],
    ['EXP-03', 603, 'planted assets/dependencies found'],
    ['EXP-04', 604, 'events disposed']
  ])('seals passing %s evidence', async (experimentId, seed, summaryFragment) => {
    const summary = await runExperiment({
      labRoot,
      outputRoot: await outputRoot(),
      experimentId,
      seed,
      arm: 'baseline',
      fault: 'none',
      prototypeRevision: 'test'
    })
    expect(summary.status).toBe('passed')
    expect(summary.summary).toContain(summaryFragment)
    expect(await verifyRunArtifact(summary.runPath)).toEqual({ valid: true, failures: [] })
  })
})
