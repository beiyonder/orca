import type { Pool } from 'pg'
import { z } from 'zod'
import { canonicalJson, sha256Text } from '../canonical-json.js'
import { TenantIdSchema } from '../domain/common-contracts.js'
import {
  ProcessObligationV1Schema,
  type ProcessObligationV1
} from '../domain/process-obligation-contracts.js'
import { failProcessObligation } from './postgres-process-obligation-errors.js'
import { withPostgresTransaction } from './postgres-transaction.js'

const MonitorClaimInputSchema = z.strictObject({
  tenantId: TenantIdSchema,
  ownerId: z.string().min(1).max(128),
  claimId: z
    .string()
    .min(1)
    .max(128)
    .regex(/^obligation_monitor_claim_[a-z0-9][a-z0-9_-]*$/),
  leaseMs: z
    .number()
    .int()
    .positive()
    .max(24 * 60 * 60 * 1_000),
  limit: z.number().int().positive().max(1_000)
})

export type ClaimDueProcessObligationsInput = z.input<typeof MonitorClaimInputSchema>

export type ProcessObligationMonitorClaim = {
  tenantId: string
  missionId: string
  obligationId: string
  ownerId: string
  claimId: string
  claimedAt: string
  expiresAt: string
  monitorFence: number
  obligation: ProcessObligationV1
}

export type ProcessObligationMonitorHealth = {
  databaseTime: string
  lastSweepStartedAt: string | null
  lastSweepSucceededAt: string | null
  lastClaimedCount: number
  lastBreachedCount: number
  activePending: number
  overduePending: number
  breachedPending: number
  unclaimedBacklog: number
  liveLeases: number
  oldestDueAgeMs: number | null
  oldestLeaseAgeMs: number | null
}

type ClaimRow = {
  tenant_id: string
  mission_id: string
  obligation_id: string
  current_fence: string
  monitor_claimed_by: string
  monitor_claim_id: string
  monitor_claimed_at: Date
  monitor_claim_expires_at: Date
  monitor_claim_fence: string
  obligation: unknown
  obligation_sha256: string
}

type HealthRow = {
  database_time: Date
  last_sweep_started_at: Date | null
  last_sweep_succeeded_at: Date | null
  last_claimed_count: number | null
  last_breached_count: number | null
  active_pending: number
  overdue_pending: number
  breached_pending: number
  unclaimed_backlog: number
  live_leases: number
  oldest_due_age_ms: string | null
  oldest_lease_age_ms: string | null
}

async function markSweepStarted(pool: Pool, tenantId: string): Promise<string> {
  return withPostgresTransaction(pool, async (client) => {
    const clock = await client.query<{ now: Date }>('SELECT transaction_timestamp() AS now')
    const now = clock.rows[0]!.now
    await client.query(
      `INSERT INTO control_plane.process_obligation_monitor_health (
         tenant_id, last_sweep_started_at, last_sweep_succeeded_at,
         last_claimed_count, last_breached_count, updated_at
       ) VALUES ($1, $2, NULL, 0, 0, $2)
       ON CONFLICT (tenant_id) DO UPDATE
       SET last_sweep_started_at = EXCLUDED.last_sweep_started_at,
           last_sweep_succeeded_at = NULL,
           last_claimed_count = 0,
           last_breached_count = 0,
           updated_at = EXCLUDED.updated_at`,
      [tenantId, now]
    )
    return now.toISOString()
  })
}

function parseClaimRow(row: ClaimRow): ProcessObligationMonitorClaim {
  const obligation = ProcessObligationV1Schema.parse(row.obligation)
  const obligationJson = canonicalJson(obligation)
  if (
    obligation.tenantId !== row.tenant_id ||
    obligation.missionId !== row.mission_id ||
    obligation.id !== row.obligation_id ||
    obligation.currentFence !== Number(row.current_fence) ||
    sha256Text(obligationJson) !== row.obligation_sha256
  ) {
    failProcessObligation(
      'obligation_projection_mismatch',
      `Process obligation projection differs for ${row.obligation_id}`
    )
  }
  return {
    tenantId: row.tenant_id,
    missionId: row.mission_id,
    obligationId: row.obligation_id,
    ownerId: row.monitor_claimed_by,
    claimId: row.monitor_claim_id,
    claimedAt: row.monitor_claimed_at.toISOString(),
    expiresAt: row.monitor_claim_expires_at.toISOString(),
    monitorFence: Number(row.monitor_claim_fence),
    obligation
  }
}

export async function claimDueProcessObligations(
  pool: Pool,
  rawInput: ClaimDueProcessObligationsInput
): Promise<{ startedAt: string; claims: ProcessObligationMonitorClaim[] }> {
  const input = MonitorClaimInputSchema.parse(rawInput)
  const startedAt = await markSweepStarted(pool, input.tenantId)
  const claims = await withPostgresTransaction(pool, async (client) => {
    const result = await client.query<ClaimRow>(
      `WITH candidates AS (
         SELECT tenant_id, obligation_id
         FROM control_plane.process_obligations
         WHERE tenant_id = $1
           AND obligation_state = 'pending'
           AND breach_id IS NULL
           AND grace_until <= transaction_timestamp()
           AND (
             monitor_claim_expires_at IS NULL
             OR monitor_claim_expires_at <= transaction_timestamp()
           )
         ORDER BY grace_until, obligation_id
         LIMIT $5
         FOR UPDATE SKIP LOCKED
       )
       UPDATE control_plane.process_obligations AS obligation
       SET monitor_claimed_by = $2,
           monitor_claim_id = $3,
           monitor_claimed_at = transaction_timestamp(),
           monitor_claim_expires_at = transaction_timestamp()
             + $4::double precision * interval '1 millisecond',
           monitor_claim_fence = obligation.monitor_claim_fence + 1,
           updated_at = transaction_timestamp()
       FROM candidates
       WHERE obligation.tenant_id = candidates.tenant_id
         AND obligation.obligation_id = candidates.obligation_id
       RETURNING obligation.tenant_id, obligation.mission_id, obligation.obligation_id,
                 obligation.current_fence::text, obligation.monitor_claimed_by,
                 obligation.monitor_claim_id, obligation.monitor_claimed_at,
                 obligation.monitor_claim_expires_at,
                 obligation.monitor_claim_fence::text, obligation.obligation,
                 trim(obligation.obligation_sha256) AS obligation_sha256`,
      [input.tenantId, input.ownerId, input.claimId, input.leaseMs, input.limit]
    )
    const parsed = result.rows.map(parseClaimRow)
    await client.query(
      `UPDATE control_plane.process_obligation_monitor_health
       SET last_claimed_count = $3, updated_at = transaction_timestamp()
       WHERE tenant_id = $1 AND last_sweep_started_at = $2`,
      [input.tenantId, startedAt, parsed.length]
    )
    return parsed
  })
  return { startedAt, claims }
}

export async function markProcessObligationSweepSucceeded(
  pool: Pool,
  tenantId: string,
  startedAt: string,
  breachedCount: number
): Promise<void> {
  await pool.query(
    `UPDATE control_plane.process_obligation_monitor_health
     SET last_sweep_succeeded_at = transaction_timestamp(),
         last_breached_count = $3,
         updated_at = transaction_timestamp()
     WHERE tenant_id = $1 AND last_sweep_started_at = $2`,
    [tenantId, startedAt, breachedCount]
  )
}

export async function readProcessObligationMonitorHealth(
  pool: Pool,
  tenantId: string
): Promise<ProcessObligationMonitorHealth> {
  const parsedTenantId = TenantIdSchema.parse(tenantId)
  const result = await pool.query<HealthRow>(
    `WITH clock AS (SELECT transaction_timestamp() AS now)
     SELECT clock.now AS database_time,
            health.last_sweep_started_at,
            health.last_sweep_succeeded_at,
            health.last_claimed_count,
            health.last_breached_count,
            count(obligation.*) FILTER (
              WHERE obligation_state = 'pending' AND grace_until > clock.now
            )::int AS active_pending,
            count(obligation.*) FILTER (
              WHERE obligation_state = 'pending' AND grace_until <= clock.now
            )::int AS overdue_pending,
            count(obligation.*) FILTER (
              WHERE obligation_state = 'pending' AND breach_id IS NOT NULL
            )::int AS breached_pending,
            count(obligation.*) FILTER (
              WHERE obligation_state = 'pending' AND breach_id IS NULL
                AND grace_until <= clock.now
                AND (monitor_claim_expires_at IS NULL OR monitor_claim_expires_at <= clock.now)
            )::int AS unclaimed_backlog,
            count(obligation.*) FILTER (
              WHERE obligation_state = 'pending' AND breach_id IS NULL
                AND monitor_claim_expires_at > clock.now
            )::int AS live_leases,
            (max(EXTRACT(EPOCH FROM (clock.now - grace_until)) * 1000) FILTER (
              WHERE obligation_state = 'pending' AND breach_id IS NULL
                AND grace_until <= clock.now
            ))::bigint::text AS oldest_due_age_ms,
            (max(EXTRACT(EPOCH FROM (clock.now - monitor_claimed_at)) * 1000) FILTER (
              WHERE obligation_state = 'pending' AND breach_id IS NULL
                AND monitor_claim_expires_at > clock.now
            ))::bigint::text AS oldest_lease_age_ms
     FROM clock
     LEFT JOIN control_plane.process_obligation_monitor_health AS health
       ON health.tenant_id = $1
     LEFT JOIN control_plane.process_obligations AS obligation
       ON obligation.tenant_id = $1
     GROUP BY clock.now, health.last_sweep_started_at, health.last_sweep_succeeded_at,
              health.last_claimed_count, health.last_breached_count`,
    [parsedTenantId]
  )
  const row = result.rows[0]!
  return {
    databaseTime: row.database_time.toISOString(),
    lastSweepStartedAt: row.last_sweep_started_at?.toISOString() ?? null,
    lastSweepSucceededAt: row.last_sweep_succeeded_at?.toISOString() ?? null,
    lastClaimedCount: row.last_claimed_count ?? 0,
    lastBreachedCount: row.last_breached_count ?? 0,
    activePending: row.active_pending,
    overduePending: row.overdue_pending,
    breachedPending: row.breached_pending,
    unclaimedBacklog: row.unclaimed_backlog,
    liveLeases: row.live_leases,
    oldestDueAgeMs: row.oldest_due_age_ms === null ? null : Number(row.oldest_due_age_ms),
    oldestLeaseAgeMs: row.oldest_lease_age_ms === null ? null : Number(row.oldest_lease_age_ms)
  }
}
