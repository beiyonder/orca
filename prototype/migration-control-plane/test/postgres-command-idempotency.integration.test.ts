import type { Pool } from 'pg'
import { afterEach, describe, expect, it } from 'vitest'
import { canonicalJson, sha256Text } from '../src/canonical-json.js'
import {
  CommandIdentityMismatchError,
  CommandPayloadDigestMismatchError,
  CommandRejectedError,
  executeIdempotentMissionCommand
} from '../src/database/postgres-command-idempotency.js'
import { DOMAIN_CONTRACT_SAMPLES } from './domain-contract-samples.js'
import {
  createPostgresKernelTestContext,
  type PostgresKernelTestContext
} from './postgres-kernel-test-context.js'

const contexts: PostgresKernelTestContext[] = []

async function kernelPool(): Promise<Pool> {
  const context = await createPostgresKernelTestContext()
  contexts.push(context)
  return context.pool
}

function command(
  options: {
    id?: string
    payload?: unknown
    expectedRevision?: number | null
    actorId?: string
  } = {}
): Record<string, unknown> {
  const value = structuredClone(DOMAIN_CONTRACT_SAMPLES['mission-command.v1']) as Record<
    string,
    unknown
  >
  const payload = options.payload ?? { evidenceId: 'evidence_idempotency' }
  value.id = options.id ?? 'command_idempotency'
  value.commandType = 'record-evidence'
  value.expectedRevision = options.expectedRevision ?? 0
  value.payload = payload
  value.payloadDigest = sha256Text(canonicalJson(payload))
  value.actor = { kind: 'system', id: options.actorId ?? 'idempotency-test' }
  return value
}

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(async (context) => context.close()))
})

describe.sequential('PostgreSQL mission command idempotency', () => {
  it('executes once and replays the stored result for an identical retry', async () => {
    const pool = await kernelPool()
    let executions = 0
    const input = command()
    const first = await executeIdempotentMissionCommand(pool, input, async () => {
      executions += 1
      return { accepted: true, revision: 1 }
    })
    const replay = await executeIdempotentMissionCommand(pool, input, async () => {
      executions += 1
      return { accepted: false }
    })

    expect(executions).toBe(1)
    expect(first).toEqual({
      disposition: 'executed',
      outcome: { status: 'committed', result: { accepted: true, revision: 1 } }
    })
    expect(replay).toEqual({ ...first, disposition: 'replayed' })
  })

  it('rejects reused command identity when any semantic input changes', async () => {
    const pool = await kernelPool()
    await executeIdempotentMissionCommand(pool, command(), async () => ({ accepted: true }))

    await expect(
      executeIdempotentMissionCommand(
        pool,
        command({ payload: { evidenceId: 'evidence_other' } }),
        async () => ({ accepted: true })
      )
    ).rejects.toBeInstanceOf(CommandIdentityMismatchError)
    await expect(
      executeIdempotentMissionCommand(pool, command({ actorId: 'different-actor' }), async () => ({
        accepted: true
      }))
    ).rejects.toBeInstanceOf(CommandIdentityMismatchError)
  })

  it('rejects a payload whose bytes do not match the declared digest', async () => {
    const pool = await kernelPool()
    const input = command()
    input.payloadDigest = '0'.repeat(64)
    await expect(
      executeIdempotentMissionCommand(pool, input, async () => ({ accepted: true }))
    ).rejects.toBeInstanceOf(CommandPayloadDigestMismatchError)

    const count = await pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM control_plane.mission_commands'
    )
    expect(count.rows[0]?.count).toBe('0')
  })

  it('serializes concurrent identical submissions around one handler execution', async () => {
    const pool = await kernelPool()
    let executions = 0
    const input = command({ id: 'command_concurrent' })
    const submit = async () =>
      executeIdempotentMissionCommand(pool, input, async (client) => {
        executions += 1
        await client.query('SELECT pg_sleep(0.05)')
        return { accepted: true }
      })
    const results = await Promise.all([submit(), submit()])

    expect(executions).toBe(1)
    expect(results.map((result) => result.disposition).sort()).toEqual(['executed', 'replayed'])
    expect(results[0]?.outcome).toEqual(results[1]?.outcome)
  })

  it('persists and replays deterministic command rejection', async () => {
    const pool = await kernelPool()
    let executions = 0
    const input = command({ id: 'command_rejected' })
    const reject = async () => {
      executions += 1
      throw new CommandRejectedError('version_conflict', 'Expected revision is stale', {
        expected: 0,
        actual: 1
      })
    }
    const first = await executeIdempotentMissionCommand(pool, input, reject)
    const replay = await executeIdempotentMissionCommand(pool, input, reject)

    expect(executions).toBe(1)
    expect(first.disposition).toBe('executed')
    expect(first.outcome).toMatchObject({ status: 'rejected', errorCode: 'version_conflict' })
    expect(replay).toEqual({ ...first, disposition: 'replayed' })
  })

  it('rolls back an indeterminate handler failure so a retry can execute', async () => {
    const pool = await kernelPool()
    const input = command({ id: 'command_retry_after_failure' })
    await expect(
      executeIdempotentMissionCommand(pool, input, async () => {
        throw new Error('injected failure')
      })
    ).rejects.toThrow('injected failure')

    await expect(
      executeIdempotentMissionCommand(pool, input, async () => ({ accepted: true }))
    ).resolves.toMatchObject({ disposition: 'executed', outcome: { status: 'committed' } })
  })
})
