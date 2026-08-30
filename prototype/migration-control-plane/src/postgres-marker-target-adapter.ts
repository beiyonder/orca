import type { Pool, PoolClient } from 'pg'
import { canonicalJson, sha256Text, type JsonValue } from './canonical-json.js'

export const POSTGRES_MARKER_ADAPTER = {
  name: 'postgres-marker',
  version: '1.0.0',
  method: 'ensure-marker',
  inspectMethod: 'inspect-marker'
} as const

export type MarkerEffectRequest = {
  tenantId: string
  effectId: string
  markerKey: string
  value: JsonValue
  subjectVersion: string
}

export type MarkerTargetState = {
  classification: 'applied' | 'absent' | 'changed-by-other' | 'ambiguous' | 'inaccessible'
  markerKey: string
  effectId: string | null
  payloadDigest: string | null
  subjectVersion: string | null
}

export type PreparedMarkerEffect = {
  request: MarkerEffectRequest
  requestDigest: string
  before: MarkerTargetState
}

export type AppliedMarkerEffect = {
  requestDigest: string
  providerRequestId: string
  resourceIds: string[]
  state: MarkerTargetState
  replayed: boolean
}

export type MarkerRecoveryDisposition = {
  action: 'accept-applied' | 'retry-same-key' | 'quarantine'
  observation: MarkerTargetState
  reason: string
}

export class PostgresMarkerAdapterError extends Error {
  readonly code: string

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'PostgresMarkerAdapterError'
    this.code = code
  }
}

function validateRequest(request: MarkerEffectRequest): void {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(request.tenantId)) {
    throw new PostgresMarkerAdapterError('invalid_tenant', 'Marker tenant is invalid')
  }
  if (!/^effect_[A-Za-z0-9_-]+$/.test(request.effectId)) {
    throw new PostgresMarkerAdapterError('invalid_effect', 'Marker effect identity is invalid')
  }
  if (!/^[A-Za-z0-9_.-]{1,256}$/.test(request.markerKey)) {
    throw new PostgresMarkerAdapterError('invalid_marker_key', 'Marker natural key is invalid')
  }
}

async function inTransaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export class PostgresMarkerTargetAdapter {
  readonly #pool: Pool

  constructor(pool: Pool) {
    this.#pool = pool
  }

  async initializeLabTarget(): Promise<void> {
    await this.#pool.query(`
      CREATE SCHEMA IF NOT EXISTS migration_effect_lab;
      CREATE TABLE IF NOT EXISTS migration_effect_lab.markers (
        tenant_id text NOT NULL,
        marker_key text NOT NULL,
        effect_id text NOT NULL,
        payload jsonb NOT NULL,
        payload_sha256 text NOT NULL,
        subject_version text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
        PRIMARY KEY (tenant_id, marker_key),
        UNIQUE (tenant_id, effect_id)
      )
    `)
  }

  async prepare(request: MarkerEffectRequest): Promise<PreparedMarkerEffect> {
    validateRequest(request)
    const before = await this.inspect(request)
    return {
      request,
      requestDigest: sha256Text(canonicalJson(request)),
      before
    }
  }

  async apply(prepared: PreparedMarkerEffect): Promise<AppliedMarkerEffect> {
    validateRequest(prepared.request)
    if (sha256Text(canonicalJson(prepared.request)) !== prepared.requestDigest) {
      throw new PostgresMarkerAdapterError(
        'request_digest_mismatch',
        'Prepared request was modified'
      )
    }
    const request = prepared.request
    const payloadJson = canonicalJson(request.value)
    const payloadDigest = sha256Text(payloadJson)
    return inTransaction(this.#pool, async (client) => {
      const insert = await client.query(
        `INSERT INTO migration_effect_lab.markers (
           tenant_id, marker_key, effect_id, payload, payload_sha256, subject_version
         ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
         ON CONFLICT (tenant_id, marker_key) DO NOTHING`,
        [
          request.tenantId,
          request.markerKey,
          request.effectId,
          payloadJson,
          payloadDigest,
          request.subjectVersion
        ]
      )
      const state = await this.#inspectWithClient(client, request)
      if (state.classification !== 'applied') {
        throw new PostgresMarkerAdapterError(
          'idempotency_conflict',
          'Marker key already belongs to another effect or payload'
        )
      }
      return {
        requestDigest: prepared.requestDigest,
        providerRequestId: `${request.tenantId}:${request.effectId}`,
        resourceIds: [request.markerKey],
        state,
        replayed: insert.rowCount === 0
      }
    })
  }

  async inspect(request: MarkerEffectRequest): Promise<MarkerTargetState> {
    validateRequest(request)
    try {
      return await this.#inspectWithClient(this.#pool, request)
    } catch {
      return {
        classification: 'inaccessible',
        markerKey: request.markerKey,
        effectId: null,
        payloadDigest: null,
        subjectVersion: null
      }
    }
  }

  async reconcile(request: MarkerEffectRequest): Promise<MarkerRecoveryDisposition> {
    const observation = await this.inspect(request)
    if (observation.classification === 'applied') {
      return { action: 'accept-applied', observation, reason: 'Exact marker identity is present.' }
    }
    if (observation.classification === 'absent') {
      return {
        action: 'retry-same-key',
        observation,
        reason: 'Exact marker is absent; same natural key remains authorized.'
      }
    }
    return {
      action: 'quarantine',
      observation,
      reason: 'Readback is ambiguous, inaccessible, or owned by another effect.'
    }
  }

  async cleanup(request: MarkerEffectRequest): Promise<boolean> {
    validateRequest(request)
    const payloadDigest = sha256Text(canonicalJson(request.value))
    const result = await this.#pool.query(
      `DELETE FROM migration_effect_lab.markers
       WHERE tenant_id = $1 AND marker_key = $2 AND effect_id = $3
         AND payload_sha256 = $4 AND subject_version = $5`,
      [request.tenantId, request.markerKey, request.effectId, payloadDigest, request.subjectVersion]
    )
    return result.rowCount === 1
  }

  async #inspectWithClient(
    client: Pick<Pool, 'query'> | Pick<PoolClient, 'query'>,
    request: MarkerEffectRequest
  ): Promise<MarkerTargetState> {
    const result = await client.query<{
      effect_id: string
      payload_sha256: string
      subject_version: string
    }>(
      `SELECT effect_id, payload_sha256, subject_version
       FROM migration_effect_lab.markers
       WHERE tenant_id = $1 AND marker_key = $2`,
      [request.tenantId, request.markerKey]
    )
    const row = result.rows[0]
    if (!row) {
      return {
        classification: 'absent',
        markerKey: request.markerKey,
        effectId: null,
        payloadDigest: null,
        subjectVersion: null
      }
    }
    const expectedDigest = sha256Text(canonicalJson(request.value))
    const matches =
      row.effect_id === request.effectId &&
      row.payload_sha256 === expectedDigest &&
      row.subject_version === request.subjectVersion
    return {
      classification: matches ? 'applied' : 'changed-by-other',
      markerKey: request.markerKey,
      effectId: row.effect_id,
      payloadDigest: row.payload_sha256,
      subjectVersion: row.subject_version
    }
  }
}
