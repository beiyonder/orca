import type { Pool, PoolClient } from 'pg'
import { z } from 'zod'
import { canonicalJson, sha256Text, type JsonValue } from '../canonical-json.js'
import { IsoDateTimeSchema, JsonValueSchema, TenantIdSchema } from '../domain/common-contracts.js'
import { withPostgresTransaction } from './postgres-transaction.js'

const WorkerIdSchema = z.string().min(1).max(256)
const MessageIdSchema = z.string().min(1).max(256)
const ConsumerNameSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z][a-z0-9._-]{0,127}$/)

type OutboxRow = {
  tenant_id: string
  message_id: string
  mission_id: string
  event_id: string | null
  topic: string
  message_key: string
  payload: JsonValue
  payload_sha256: string
  attempt_count: number
  lease_owner: string | null
  lease_expires_at: Date | null
  fence: string
  delivered_at: Date | null
}

type InboxRow = {
  payload_sha256: string
  result: JsonValue
}

export type OutboxClaim = {
  tenantId: string
  messageId: string
  missionId: string
  eventId: string | null
  topic: string
  key: string
  payload: JsonValue
  attemptCount: number
  leaseOwner: string
  leaseExpiresAt: string
  fence: number
}

export class MessageIdentityMismatchError extends Error {
  constructor(messageId: string) {
    super(`Message ${messageId} was already used with different payload bytes`)
    this.name = 'MessageIdentityMismatchError'
  }
}

export class MessageIntegrityError extends Error {
  constructor(messageId: string) {
    super(`Message ${messageId} failed its stored payload integrity check`)
    this.name = 'MessageIntegrityError'
  }
}

export class StaleDeliveryClaimError extends Error {
  constructor(messageId: string) {
    super(`Outbox claim is stale or unauthorized: ${messageId}`)
    this.name = 'StaleDeliveryClaimError'
  }
}

function checkedJson(value: unknown): { value: JsonValue; json: string; sha256: string } {
  const parsed = JsonValueSchema.parse(value) as JsonValue
  const json = canonicalJson(parsed)
  return { value: parsed, json, sha256: sha256Text(json) }
}

function checkedOutboxClaim(row: OutboxRow): OutboxClaim {
  const payload = checkedJson(row.payload)
  if (payload.sha256 !== row.payload_sha256.trim()) {
    throw new MessageIntegrityError(row.message_id)
  }
  if (!row.lease_owner || !row.lease_expires_at) {
    throw new StaleDeliveryClaimError(row.message_id)
  }
  return {
    tenantId: row.tenant_id,
    messageId: row.message_id,
    missionId: row.mission_id,
    eventId: row.event_id,
    topic: row.topic,
    key: row.message_key,
    payload: payload.value,
    attemptCount: row.attempt_count,
    leaseOwner: row.lease_owner,
    leaseExpiresAt: row.lease_expires_at.toISOString(),
    fence: Number(row.fence)
  }
}

export async function claimOutboxMessages(
  pool: Pool,
  input: {
    tenantId: string
    workerId: string
    now: string
    leaseMs: number
    limit: number
  }
): Promise<OutboxClaim[]> {
  const tenantId = TenantIdSchema.parse(input.tenantId)
  const workerId = WorkerIdSchema.parse(input.workerId)
  const now = IsoDateTimeSchema.parse(input.now)
  const leaseMs = z.number().int().positive().max(300_000).parse(input.leaseMs)
  const limit = z.number().int().positive().max(100).parse(input.limit)
  return withPostgresTransaction(pool, async (client) => {
    const result = await client.query<OutboxRow>(
      `WITH ready AS (
         SELECT tenant_id, message_id
         FROM control_plane.outbox_messages
         WHERE tenant_id = $1
           AND delivered_at IS NULL
           AND available_at <= $2
           AND (lease_expires_at IS NULL OR lease_expires_at <= $2)
         ORDER BY available_at, message_id
         FOR UPDATE SKIP LOCKED
         LIMIT $3
       )
       UPDATE control_plane.outbox_messages AS message
       SET lease_owner = $4,
           lease_expires_at = $2::timestamptz + $5::double precision * interval '1 millisecond',
           attempt_count = message.attempt_count + 1,
           fence = message.fence + 1
       FROM ready
       WHERE message.tenant_id = ready.tenant_id AND message.message_id = ready.message_id
       RETURNING message.*`,
      [tenantId, now, limit, workerId, leaseMs]
    )
    return result.rows
      .map(checkedOutboxClaim)
      .sort((left, right) => left.messageId.localeCompare(right.messageId))
  })
}

async function lockedOutboxRow(
  client: PoolClient,
  tenantId: string,
  messageId: string
): Promise<OutboxRow> {
  const result = await client.query<OutboxRow>(
    `SELECT * FROM control_plane.outbox_messages
     WHERE tenant_id = $1 AND message_id = $2
     FOR UPDATE`,
    [tenantId, messageId]
  )
  const row = result.rows[0]
  if (!row) {
    throw new StaleDeliveryClaimError(messageId)
  }
  return row
}

export async function acknowledgeOutboxMessage(
  pool: Pool,
  input: {
    tenantId: string
    messageId: string
    workerId: string
    fence: number
    deliveredAt: string
  }
): Promise<{ disposition: 'acknowledged' | 'replayed' }> {
  const tenantId = TenantIdSchema.parse(input.tenantId)
  const messageId = MessageIdSchema.parse(input.messageId)
  const workerId = WorkerIdSchema.parse(input.workerId)
  const fence = z.number().int().positive().parse(input.fence)
  const deliveredAt = IsoDateTimeSchema.parse(input.deliveredAt)
  return withPostgresTransaction(pool, async (client) => {
    const row = await lockedOutboxRow(client, tenantId, messageId)
    const sameClaim = row.lease_owner === workerId && Number(row.fence) === fence
    if (row.delivered_at) {
      if (!sameClaim) {
        throw new StaleDeliveryClaimError(messageId)
      }
      return { disposition: 'replayed' }
    }
    if (
      !sameClaim ||
      !row.lease_expires_at ||
      row.lease_expires_at.getTime() < Date.parse(deliveredAt)
    ) {
      throw new StaleDeliveryClaimError(messageId)
    }
    const updated = await client.query(
      `UPDATE control_plane.outbox_messages
       SET delivered_at = $5
       WHERE tenant_id = $1 AND message_id = $2
         AND lease_owner = $3 AND fence = $4 AND delivered_at IS NULL`,
      [tenantId, messageId, workerId, fence, deliveredAt]
    )
    if (updated.rowCount !== 1) {
      throw new StaleDeliveryClaimError(messageId)
    }
    return { disposition: 'acknowledged' }
  })
}

export async function releaseOutboxMessage(
  pool: Pool,
  input: {
    tenantId: string
    messageId: string
    workerId: string
    fence: number
    now: string
    availableAt: string
  }
): Promise<void> {
  const tenantId = TenantIdSchema.parse(input.tenantId)
  const messageId = MessageIdSchema.parse(input.messageId)
  const workerId = WorkerIdSchema.parse(input.workerId)
  const fence = z.number().int().positive().parse(input.fence)
  const now = IsoDateTimeSchema.parse(input.now)
  const availableAt = IsoDateTimeSchema.parse(input.availableAt)
  const result = await pool.query(
    `UPDATE control_plane.outbox_messages
     SET lease_owner = NULL, lease_expires_at = NULL, available_at = $6
     WHERE tenant_id = $1 AND message_id = $2
       AND lease_owner = $3 AND fence = $4 AND lease_expires_at >= $5
       AND delivered_at IS NULL`,
    [tenantId, messageId, workerId, fence, now, availableAt]
  )
  if (result.rowCount !== 1) {
    throw new StaleDeliveryClaimError(messageId)
  }
}

export async function consumeInboxMessage(
  pool: Pool,
  input: {
    tenantId: string
    consumer: string
    messageId: string
    payload: unknown
    receivedAt: string
  },
  handler: (client: PoolClient, payload: JsonValue) => Promise<unknown>
): Promise<{ disposition: 'consumed' | 'replayed'; result: JsonValue }> {
  const tenantId = TenantIdSchema.parse(input.tenantId)
  const consumer = ConsumerNameSchema.parse(input.consumer)
  const messageId = MessageIdSchema.parse(input.messageId)
  const receivedAt = IsoDateTimeSchema.parse(input.receivedAt)
  const payload = checkedJson(input.payload)
  return withPostgresTransaction(pool, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `${tenantId}:${consumer}:${messageId}`
    ])
    const existing = await client.query<InboxRow>(
      `SELECT trim(payload_sha256) AS payload_sha256, result
       FROM control_plane.inbox_messages
       WHERE tenant_id = $1 AND consumer_name = $2 AND message_id = $3
       FOR SHARE`,
      [tenantId, consumer, messageId]
    )
    const row = existing.rows[0]
    if (row) {
      if (row.payload_sha256 !== payload.sha256) {
        throw new MessageIdentityMismatchError(messageId)
      }
      return { disposition: 'replayed', result: checkedJson(row.result).value }
    }

    const result = checkedJson(await handler(client, payload.value))
    await client.query(
      `INSERT INTO control_plane.inbox_messages (
         tenant_id, consumer_name, message_id, payload_sha256, result, received_at, processed_at
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, transaction_timestamp())`,
      [tenantId, consumer, messageId, payload.sha256, result.json, receivedAt]
    )
    return { disposition: 'consumed', result: result.value }
  })
}
