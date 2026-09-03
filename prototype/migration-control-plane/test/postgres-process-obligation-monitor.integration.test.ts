import { afterEach, describe, expect, it } from 'vitest'
import { rebuildProcessObligationProjection } from '../src/database/postgres-process-obligation-replay.js'
import { PostgresProcessObligationError } from '../src/database/postgres-process-obligation-errors.js'
import {
  recordProcessObligationBreach,
  runProcessObligationMonitorSweep
} from '../src/database/postgres-process-obligation-breach.js'
import {
  claimDueProcessObligations,
  readProcessObligationMonitorHealth
} from '../src/database/postgres-process-obligation-monitor.js'
import type { PostgresKernelTestContext } from './postgres-kernel-test-context.js'
import {
  createProcessObligationTestContext,
  expireProcessObligationTestFixture,
  instantiateProcessObligation,
  processObligationSystemActor,
  registerProcessObligationTestDefinition
} from './postgres-process-obligation-test-fixture.js'

const contexts: PostgresKernelTestContext[] = []

async function monitorContext(options: { breachAction?: 'quarantine' | 'stop-new-use' } = {}) {
  const context = await createProcessObligationTestContext()
  contexts.push(context)
  await registerProcessObligationTestDefinition(context, {
    deadlineOffsetMs: 1,
    graceMs: 0,
    breachAction: options.breachAction ?? 'quarantine'
  })
  return context
}

async function openDueObligation(
  context: PostgresKernelTestContext,
  suffix: string
): Promise<void> {
  await instantiateProcessObligation(context, { suffix })
  await expireProcessObligationTestFixture(context.pool, `obligation_${suffix}`)
}

afterEach(async () => {
  await Promise.all(contexts.splice(0).map((context) => context.close()))
})

describe('PostgreSQL process obligation completeness monitor', () => {
  it('fences concurrent monitors and commits exactly one policy-specific breach', async () => {
    const context = await monitorContext()
    await openDueObligation(context, 'monitor_concurrent')
    const [first, second] = await Promise.all([
      claimDueProcessObligations(context.pool, {
        tenantId: 'tenant_s1',
        ownerId: 'monitor-a',
        claimId: 'obligation_monitor_claim_concurrent_a',
        leaseMs: 5_000,
        limit: 10
      }),
      claimDueProcessObligations(context.pool, {
        tenantId: 'tenant_s1',
        ownerId: 'monitor-b',
        claimId: 'obligation_monitor_claim_concurrent_b',
        leaseMs: 5_000,
        limit: 10
      })
    ])
    const claims = [...first.claims, ...second.claims]
    expect(claims).toHaveLength(1)

    const committed = await recordProcessObligationBreach(
      context.pool,
      claims[0]!,
      processObligationSystemActor
    )
    const replayedCommit = await recordProcessObligationBreach(
      context.pool,
      claims[0]!,
      processObligationSystemActor
    )
    expect(committed).toMatchObject({
      committed: true,
      responseTopic: 'process-obligation.response.quarantine',
      breach: { response: 'quarantine' }
    })
    expect(replayedCommit).toMatchObject({
      committed: false,
      responseMessageId: committed.responseMessageId,
      breach: { id: committed.breach.id }
    })

    const counts = await context.pool.query<{
      breaches: string
      transitions: string
      responses: string
      generic_retries: string
    }>(
      `SELECT
         (SELECT count(*)::text FROM control_plane.domain_records
          WHERE schema_name = 'process-obligation-breach.v1') AS breaches,
         (SELECT count(*)::text FROM control_plane.domain_records
          WHERE schema_name = 'process-obligation-transition.v1'
            AND record_state = 'breach') AS transitions,
         (SELECT count(*)::text FROM control_plane.outbox_messages
          WHERE topic = 'process-obligation.response.quarantine') AS responses,
         (SELECT count(*)::text FROM control_plane.outbox_messages
          WHERE topic = 'process-obligation.response.retry') AS generic_retries`
    )
    expect(counts.rows[0]).toEqual({
      breaches: '1',
      transitions: '1',
      responses: '1',
      generic_retries: '0'
    })

    await rebuildProcessObligationProjection(context.pool, 'tenant_s1', 'mission_s1')
    const rebuilt = await context.pool.query<{ breach_id: string | null }>(
      `SELECT breach_id FROM control_plane.process_obligations
       WHERE tenant_id = 'tenant_s1' AND obligation_id = 'obligation_monitor_concurrent'`
    )
    expect(rebuilt.rows[0]?.breach_id).toBe(committed.breach.id)
  })

  it('reclaims an expired lease and rejects the stale monitor fence', async () => {
    const context = await monitorContext()
    await openDueObligation(context, 'monitor_reclaim')
    const first = await claimDueProcessObligations(context.pool, {
      tenantId: 'tenant_s1',
      ownerId: 'monitor-crashed',
      claimId: 'obligation_monitor_claim_crashed',
      leaseMs: 20,
      limit: 1
    })
    expect(first.claims).toHaveLength(1)
    const claimedHealth = await readProcessObligationMonitorHealth(context.pool, 'tenant_s1')
    expect(claimedHealth).toMatchObject({
      lastSweepSucceededAt: null,
      unclaimedBacklog: 0,
      liveLeases: 1
    })
    expect(claimedHealth.oldestLeaseAgeMs).toBeGreaterThanOrEqual(0)
    await context.pool.query(
      `UPDATE control_plane.process_obligations
       SET monitor_claim_expires_at = transaction_timestamp() - interval '1 millisecond'
       WHERE tenant_id = 'tenant_s1' AND obligation_id = 'obligation_monitor_reclaim'`
    )
    const second = await claimDueProcessObligations(context.pool, {
      tenantId: 'tenant_s1',
      ownerId: 'monitor-recovery',
      claimId: 'obligation_monitor_claim_recovery',
      leaseMs: 5_000,
      limit: 1
    })
    expect(second.claims).toHaveLength(1)
    expect(second.claims[0]!.monitorFence).toBe(first.claims[0]!.monitorFence + 1)
    await expect(
      recordProcessObligationBreach(context.pool, first.claims[0]!, processObligationSystemActor)
    ).rejects.toBeInstanceOf(PostgresProcessObligationError)
    await expect(
      recordProcessObligationBreach(context.pool, second.claims[0]!, processObligationSystemActor)
    ).resolves.toMatchObject({ committed: true })
  })

  it('isolates tenant sweeps and exposes backlog, lease, breach, and success health', async () => {
    const context = await monitorContext({ breachAction: 'stop-new-use' })
    await openDueObligation(context, 'monitor_health')
    const before = await readProcessObligationMonitorHealth(context.pool, 'tenant_s1')
    expect(before).toMatchObject({
      overduePending: 1,
      breachedPending: 0,
      unclaimedBacklog: 1,
      liveLeases: 0
    })
    expect(before.oldestDueAgeMs).toBeGreaterThanOrEqual(0)

    const isolated = await runProcessObligationMonitorSweep(context.pool, {
      tenantId: 'tenant_other',
      ownerId: 'monitor-other',
      claimId: 'obligation_monitor_claim_other',
      leaseMs: 5_000,
      limit: 10,
      selectedBy: processObligationSystemActor
    })
    expect(isolated).toEqual({ claims: 0, breaches: [] })

    const swept = await runProcessObligationMonitorSweep(context.pool, {
      tenantId: 'tenant_s1',
      ownerId: 'monitor-health',
      claimId: 'obligation_monitor_claim_health',
      leaseMs: 5_000,
      limit: 10,
      selectedBy: processObligationSystemActor
    })
    expect(swept).toMatchObject({
      claims: 1,
      breaches: [{ responseTopic: 'process-obligation.response.stop-new-use' }]
    })
    const after = await readProcessObligationMonitorHealth(context.pool, 'tenant_s1')
    expect(after).toMatchObject({
      lastClaimedCount: 1,
      lastBreachedCount: 1,
      activePending: 0,
      overduePending: 1,
      breachedPending: 1,
      unclaimedBacklog: 0,
      liveLeases: 0,
      oldestDueAgeMs: null,
      oldestLeaseAgeMs: null
    })
    expect(after.lastSweepStartedAt).not.toBeNull()
    expect(after.lastSweepSucceededAt).not.toBeNull()
  })
})
