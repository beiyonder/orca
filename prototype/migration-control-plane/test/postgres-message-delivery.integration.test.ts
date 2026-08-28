import type { Pool } from 'pg'
import { afterEach, describe, expect, it } from 'vitest'
import {
  MessageIdentityMismatchError,
  StaleDeliveryClaimError,
  acknowledgeOutboxMessage,
  claimOutboxMessages,
  consumeInboxMessage,
  releaseOutboxMessage
} from '../src/database/postgres-message-delivery.js'
import {
  createPostgresKernelTestContext,
  type PostgresKernelTestContext
} from './postgres-kernel-test-context.js'
import { createMissionFixture } from './postgres-mission-test-fixture.js'

const contexts: PostgresKernelTestContext[] = []

async function kernelPool(): Promise<Pool> {
  const context = await createPostgresKernelTestContext()
  contexts.push(context)
  return context.pool
}

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(async (context) => context.close()))
})

describe.sequential('PostgreSQL outbox and inbox', () => {
  it('allows only one concurrent worker to claim one ready outbox message', async () => {
    const pool = await kernelPool()
    await createMissionFixture(pool)
    const claim = (workerId: string) =>
      claimOutboxMessages(pool, {
        tenantId: 'tenant_s1',
        workerId,
        now: '2026-01-01T00:00:02.000Z',
        leaseMs: 1_000,
        limit: 1
      })
    const claims = await Promise.all([claim('delivery-a'), claim('delivery-b')])

    expect(claims.map((rows) => rows.length).sort()).toEqual([0, 1])
    expect(claims.flat()[0]).toMatchObject({
      messageId: 'message_mission_created',
      attemptCount: 1,
      fence: 1
    })
  })

  it('reclaims expired delivery with a higher fence and rejects the stale acknowledgement', async () => {
    const pool = await kernelPool()
    await createMissionFixture(pool)
    const first = (
      await claimOutboxMessages(pool, {
        tenantId: 'tenant_s1',
        workerId: 'delivery-old',
        now: '2026-01-01T00:00:02.000Z',
        leaseMs: 1_000,
        limit: 1
      })
    )[0]!
    const second = (
      await claimOutboxMessages(pool, {
        tenantId: 'tenant_s1',
        workerId: 'delivery-new',
        now: '2026-01-01T00:00:04.000Z',
        leaseMs: 2_000,
        limit: 1
      })
    )[0]!

    expect(second.fence).toBe(first.fence + 1)
    await expect(
      acknowledgeOutboxMessage(pool, {
        tenantId: first.tenantId,
        messageId: first.messageId,
        workerId: first.leaseOwner,
        fence: first.fence,
        deliveredAt: '2026-01-01T00:00:02.500Z'
      })
    ).rejects.toBeInstanceOf(StaleDeliveryClaimError)
    await expect(
      acknowledgeOutboxMessage(pool, {
        tenantId: second.tenantId,
        messageId: second.messageId,
        workerId: second.leaseOwner,
        fence: second.fence,
        deliveredAt: '2026-01-01T00:00:05.000Z'
      })
    ).resolves.toEqual({ disposition: 'acknowledged' })
    await expect(
      acknowledgeOutboxMessage(pool, {
        tenantId: second.tenantId,
        messageId: second.messageId,
        workerId: second.leaseOwner,
        fence: second.fence,
        deliveredAt: '2026-01-01T00:00:05.000Z'
      })
    ).resolves.toEqual({ disposition: 'replayed' })
  })

  it('releases failed delivery for a delayed at-least-once retry', async () => {
    const pool = await kernelPool()
    await createMissionFixture(pool)
    const first = (
      await claimOutboxMessages(pool, {
        tenantId: 'tenant_s1',
        workerId: 'delivery-release',
        now: '2026-01-01T00:00:02.000Z',
        leaseMs: 1_000,
        limit: 1
      })
    )[0]!
    await releaseOutboxMessage(pool, {
      tenantId: first.tenantId,
      messageId: first.messageId,
      workerId: first.leaseOwner,
      fence: first.fence,
      now: '2026-01-01T00:00:02.500Z',
      availableAt: '2026-01-01T00:00:10.000Z'
    })

    await expect(
      claimOutboxMessages(pool, {
        tenantId: 'tenant_s1',
        workerId: 'delivery-early',
        now: '2026-01-01T00:00:09.000Z',
        leaseMs: 1_000,
        limit: 1
      })
    ).resolves.toEqual([])
    const retry = await claimOutboxMessages(pool, {
      tenantId: 'tenant_s1',
      workerId: 'delivery-retry',
      now: '2026-01-01T00:00:10.000Z',
      leaseMs: 1_000,
      limit: 1
    })
    expect(retry[0]).toMatchObject({ attemptCount: 2, fence: 2 })
  })

  it('deduplicates concurrent inbox import around one transactional handler', async () => {
    const pool = await kernelPool()
    let executions = 0
    const consume = async () =>
      consumeInboxMessage(
        pool,
        {
          tenantId: 'tenant_s1',
          consumer: 'mission-projector',
          messageId: 'incoming_event_1',
          payload: { eventId: 'event_external' },
          receivedAt: '2026-01-01T00:00:00.000Z'
        },
        async (client) => {
          executions += 1
          await client.query('SELECT pg_sleep(0.05)')
          return { imported: true }
        }
      )
    const results = await Promise.all([consume(), consume()])

    expect(executions).toBe(1)
    expect(results.map((result) => result.disposition).sort()).toEqual(['consumed', 'replayed'])
    expect(results[0]?.result).toEqual(results[1]?.result)
  })

  it('rejects inbox identity reuse with different payload and retries handler failure safely', async () => {
    const pool = await kernelPool()
    const base = {
      tenantId: 'tenant_s1',
      consumer: 'mission-projector',
      messageId: 'incoming_event_2',
      receivedAt: '2026-01-01T00:00:00.000Z'
    }
    await expect(
      consumeInboxMessage(pool, { ...base, payload: { version: 1 } }, async () => {
        throw new Error('injected import failure')
      })
    ).rejects.toThrow('injected import failure')
    await expect(
      consumeInboxMessage(pool, { ...base, payload: { version: 1 } }, async () => ({ ok: true }))
    ).resolves.toMatchObject({ disposition: 'consumed', result: { ok: true } })
    await expect(
      consumeInboxMessage(pool, { ...base, payload: { version: 2 } }, async () => ({ ok: true }))
    ).rejects.toBeInstanceOf(MessageIdentityMismatchError)
  })
})
