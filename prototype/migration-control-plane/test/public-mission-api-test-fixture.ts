import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { sha256Text } from '../src/canonical-json.js'
import { registerProcessObligationDefinition } from '../src/database/postgres-process-obligation-definition.js'
import type { PostgresKernelTestContext } from './postgres-kernel-test-context.js'
import { createPostgresKernelTestContext } from './postgres-kernel-test-context.js'
import { createPublicMissionApiServer } from '../src/public-mission-api-server.js'

const CURSOR_SECRET = 'mission-api-test-cursor-secret-at-least-32-bytes'

const principals = {
  'writer-a': {
    tenantId: 'tenant_api_a',
    actor: { kind: 'operator', id: 'operator-api-a', version: '1' },
    permissions: ['mission:read', 'mission:write']
  },
  'reader-a': {
    tenantId: 'tenant_api_a',
    actor: { kind: 'operator', id: 'reader-api-a', version: '1' },
    permissions: ['mission:read']
  },
  'writer-b': {
    tenantId: 'tenant_api_b',
    actor: { kind: 'operator', id: 'operator-api-b', version: '1' },
    permissions: ['mission:read', 'mission:write']
  }
} as const

export type MissionApiTestResponse = {
  status: number
  headers: Headers
  body: Record<string, unknown>
}

export type MissionApiTestHarness = {
  context: PostgresKernelTestContext
  baseUrl: string
  request: (
    path: string,
    options?: {
      method?: string
      token?: string
      body?: unknown
      rawBody?: string
      idempotencyKey?: string
    }
  ) => Promise<MissionApiTestResponse>
  restart: () => Promise<void>
  close: () => Promise<void>
}

async function listen(server: Server): Promise<string> {
  const { promise, resolve, reject } = Promise.withResolvers<void>()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
  await promise
  server.off('error', reject)
  const address = server.address() as AddressInfo
  return `http://127.0.0.1:${address.port}`
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) {
    return
  }
  const { promise, resolve, reject } = Promise.withResolvers<void>()
  server.close((error) => (error ? reject(error) : resolve()))
  await promise
}

export async function createMissionApiTestHarness(
  maxBodyBytes = 64 * 1024,
  activityPollIntervalMs = 20
): Promise<MissionApiTestHarness> {
  const context = await createPostgresKernelTestContext()
  let server = createPublicMissionApiServer({
    pool: context.pool,
    cursorSecret: CURSOR_SECRET,
    maxBodyBytes,
    activityPollIntervalMs,
    activityHeartbeatIntervalMs: Math.max(40, activityPollIntervalMs),
    authenticate: async (token) => principals[token as keyof typeof principals] ?? null
  })
  let baseUrl = await listen(server)
  return {
    context,
    get baseUrl() {
      return baseUrl
    },
    async request(path, options = {}) {
      const headers: Record<string, string> = {}
      if (options.token) {
        headers.Authorization = `Bearer ${options.token}`
      }
      let body: string | undefined
      if (options.rawBody !== undefined) {
        body = options.rawBody
        headers['Content-Type'] = 'application/json'
      } else if (options.body !== undefined) {
        body = JSON.stringify(options.body)
        headers['Content-Type'] = 'application/json'
      }
      if (options.method === 'POST') {
        headers['Idempotency-Key'] =
          options.idempotencyKey ?? `key-${path.replaceAll(/[^a-z0-9]+/gi, '-').slice(0, 80)}`
      }
      const response = await fetch(`${baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        ...(body === undefined ? {} : { body })
      })
      return {
        status: response.status,
        headers: response.headers,
        body: (await response.json()) as Record<string, unknown>
      }
    },
    async restart() {
      await closeServer(server)
      server = createPublicMissionApiServer({
        pool: context.pool,
        cursorSecret: CURSOR_SECRET,
        maxBodyBytes,
        activityPollIntervalMs,
        activityHeartbeatIntervalMs: Math.max(40, activityPollIntervalMs),
        authenticate: async (token) => principals[token as keyof typeof principals] ?? null
      })
      baseUrl = await listen(server)
    },
    async close() {
      await closeServer(server)
      await context.close()
    }
  }
}

export function createMissionBody(objective: string, issuedAt = '2026-01-01T00:00:00.000Z') {
  return {
    objective,
    priorities: ['correctness'],
    dataClass: 'synthetic',
    labels: { source: 'api-test' },
    issuedAt
  }
}

export async function registerApiObligationDefinitions(
  context: PostgresKernelTestContext,
  count: number
): Promise<void> {
  const contract = await context.pool.query<{ schema_sha256: string }>(
    `SELECT trim(schema_sha256) AS schema_sha256 FROM control_plane.contract_schemas
     WHERE schema_name = 'mission-record.v1'`
  )
  for (let index = 1; index <= count; index += 1) {
    await registerProcessObligationDefinition(context.pool, {
      schemaVersion: 1,
      kind: 'process-obligation-definition',
      id: `obligation_definition_api_${index}`,
      tenantId: 'tenant_api_a',
      createdAt: '2026-01-01T00:00:00.000Z',
      definitionKey: `api-state-proof-${index}`,
      version: 1,
      predecessorDefinitionId: null,
      scopeKinds: ['mission'],
      trigger: {
        eventKind: 'mission-state-changed',
        applicabilityPolicyVersion: 'api-v1',
        applicabilityPolicyDigest: sha256Text(`api-applicability-${index}`)
      },
      timing: { deadlineOffsetMs: 60_000, graceMs: 60_000, clock: 'database' },
      proof: {
        recordKinds: ['mission'],
        schemas: [
          { name: 'mission-record.v1', version: 1, digest: contract.rows[0]!.schema_sha256 }
        ],
        minimumCount: 1,
        authority: 'product',
        maxAgeMs: null
      },
      severity: 'blocking',
      breachAction: 'block',
      waiver: {
        allowed: false,
        authorizedActorKinds: [],
        evidenceRequired: false,
        maximumDurationMs: null
      },
      supersession: 'cancel',
      activatedAt: '2026-01-01T00:00:00.000Z',
      revokedAt: null
    })
  }
}
