import { Client } from 'pg'
import { afterEach, describe, expect, it } from 'vitest'
import {
  SourceAccessEnvelopeV1Schema,
  SourceAdapterDefinitionV1Schema
} from '../src/domain/source-adapter-contracts.js'
import { SourceRequestV1Schema } from '../src/domain/source-probe-contracts.js'
import {
  PostgresSourceSandbox,
  PostgresSourceSandboxError
} from '../src/postgres-source-sandbox.js'
import { createPostgresTestDatabase, type PostgresTestDatabase } from './postgres-test-databases.js'
import { SOURCE_CONTRACT_SAMPLES } from './source-contract-samples.js'

const databases: PostgresTestDatabase[] = []

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (database) => database.drop()))
})

async function sandboxFixture(options?: {
  rowLimit?: number
  statementTimeoutMs?: number
}): Promise<{
  connectionString: string
  input: Parameters<PostgresSourceSandbox['run']>[0]
  sandbox: PostgresSourceSandbox
}> {
  const database = await createPostgresTestDatabase({ encoding: 'UTF8', collation: 'C' })
  databases.push(database)
  const setup = new Client({ connectionString: database.connectionString })
  await setup.connect()
  let version: string
  try {
    await setup.query('CREATE TABLE public.fixture_rows (id integer PRIMARY KEY, value text)')
    await setup.query("INSERT INTO public.fixture_rows VALUES (1, 'one'), (2, 'two')")
    version = (
      await setup.query<{ server_version: string }>('SHOW server_version')
    ).rows[0]!.server_version.split(' ')[0]!
  } finally {
    await setup.end()
  }
  const databaseName = new URL(database.connectionString).pathname.slice(1)
  const definitionInput = structuredClone(SOURCE_CONTRACT_SAMPLES['source-adapter-definition.v1'])
  const accessInput = structuredClone(SOURCE_CONTRACT_SAMPLES['source-access-envelope.v1'])
  const requestInput = structuredClone(SOURCE_CONTRACT_SAMPLES['source-request.v1'])
  const source = { ...accessInput.source, databaseName, engineVersion: version }
  const limits = {
    ...accessInput.limits,
    ...(options?.rowLimit === undefined ? {} : { rowLimit: options.rowLimit }),
    ...(options?.statementTimeoutMs === undefined
      ? {}
      : { statementTimeoutMs: options.statementTimeoutMs })
  }
  accessInput.source = source
  accessInput.limits = limits
  requestInput.source = source
  requestInput.limits = limits
  return {
    connectionString: database.connectionString,
    input: {
      definition: SourceAdapterDefinitionV1Schema.parse(definitionInput),
      access: SourceAccessEnvelopeV1Schema.parse(accessInput),
      request: SourceRequestV1Schema.parse(requestInput),
      connectionString: database.connectionString,
      endpointDigest: source.endpointDigest
    },
    sandbox: new PostgresSourceSandbox()
  }
}

function expectSandboxCode(error: unknown, code: string): boolean {
  expect(error).toBeInstanceOf(PostgresSourceSandboxError)
  expect((error as PostgresSourceSandboxError).code).toBe(code)
  return true
}

describe('PostgreSQL read-only source sandbox', () => {
  it('runs bounded reads inside an exported read-only snapshot', async () => {
    const { input, sandbox } = await sandboxFixture()
    const result = await sandbox.run(input, async (session) =>
      session.query<{ id: number; value: string }>(
        'SELECT id, value FROM public.fixture_rows ORDER BY id'
      )
    )
    expect(result.value).toEqual([
      { id: 1, value: 'one' },
      { id: 2, value: 'two' }
    ])
    expect(result.snapshotToken).toMatch(/^[a-f0-9-]+$/)
    expect(result.usage).toMatchObject({ queryCount: 1, rowCount: 2 })
  })

  it('lets PostgreSQL reject every source mutation and leaves rows unchanged', async () => {
    const { connectionString, input, sandbox } = await sandboxFixture()
    await expect(
      sandbox.run(input, async (session) => {
        await session.query("INSERT INTO public.fixture_rows VALUES (3, 'three')")
      })
    ).rejects.toSatisfy((error) => expectSandboxCode(error, 'mutation-blocked'))
    const client = new Client({ connectionString })
    await client.connect()
    try {
      expect(
        (await client.query('SELECT count(*)::int AS count FROM public.fixture_rows')).rows
      ).toEqual([{ count: 2 }])
    } finally {
      await client.end()
    }
  })

  it('rejects unauthorized endpoint and connected source identity', async () => {
    const { input, sandbox } = await sandboxFixture()
    await expect(
      sandbox.run({ ...input, endpointDigest: 'c'.repeat(64) }, async () => undefined)
    ).rejects.toSatisfy((error) => expectSandboxCode(error, 'network-denied'))
    await expect(
      sandbox.run(
        {
          ...input,
          access: { ...input.access, source: { ...input.access.source, databaseName: 'other' } },
          request: { ...input.request, source: { ...input.request.source, databaseName: 'other' } }
        },
        async () => undefined
      )
    ).rejects.toSatisfy((error) => expectSandboxCode(error, 'source-changed'))
  })

  it('fails closed when row or statement-time limits are crossed', async () => {
    const rows = await sandboxFixture({ rowLimit: 1 })
    await expect(
      rows.sandbox.run(rows.input, async (session) =>
        session.query('SELECT * FROM public.fixture_rows')
      )
    ).rejects.toSatisfy((error) => expectSandboxCode(error, 'row-limit-exceeded'))

    const slow = await sandboxFixture({ statementTimeoutMs: 10 })
    await expect(
      slow.sandbox.run(slow.input, async (session) => session.query('SELECT pg_sleep(0.1)'))
    ).rejects.toSatisfy((error) => expectSandboxCode(error, 'deadline-exceeded'))
  })

  it('enforces per-endpoint concurrency before connecting more work', async () => {
    const { input, sandbox } = await sandboxFixture()
    const gate = Promise.withResolvers<void>()
    const first = sandbox.run(input, async () => {
      await gate.promise
      return 'done'
    })
    await expect(sandbox.run(input, async () => 'rival')).rejects.toSatisfy((error) =>
      expectSandboxCode(error, 'concurrency-limit-exceeded')
    )
    gate.resolve()
    await expect(first).resolves.toMatchObject({ value: 'done' })
  })
})
