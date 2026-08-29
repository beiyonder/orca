import { Client, type QueryResultRow } from 'pg'
import { canonicalJson } from './canonical-json.js'
import {
  SourceAccessEnvelopeV1Schema,
  SourceAdapterDefinitionV1Schema,
  type SourceAccessEnvelopeV1,
  type SourceAdapterDefinitionV1
} from './domain/source-adapter-contracts.js'
import { SourceRequestV1Schema, type SourceRequestV1 } from './domain/source-probe-contracts.js'
import { SourceAdapterRegistry, SourceAdapterRegistryError } from './source-adapter-registry.js'

export class PostgresSourceSandboxError extends Error {
  readonly code: string
  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'PostgresSourceSandboxError'
    this.code = code
  }
}

function failure(code: string, message: string, cause?: unknown): PostgresSourceSandboxError {
  return new PostgresSourceSandboxError(code, message, cause === undefined ? undefined : { cause })
}

export type SourceReadSession = {
  query: <TRow extends QueryResultRow>(text: string, values?: readonly unknown[]) => Promise<TRow[]>
}

export type PostgresSourceSandboxResult<T> = {
  value: T
  snapshotToken: string
  usage: { queryCount: number; rowCount: number; byteCount: number; wallTimeMs: number }
  startedAt: string
  completedAt: string
}

type SandboxInput = {
  definition: SourceAdapterDefinitionV1
  access: SourceAccessEnvelopeV1
  request: SourceRequestV1
  connectionString: string
  endpointDigest: string
}

export class PostgresSourceSandbox {
  readonly #activeByEndpoint = new Map<string, number>()
  readonly #now: () => number

  constructor(options: { now?: () => number } = {}) {
    this.#now = options.now ?? Date.now
  }

  async run<T>(
    input: SandboxInput,
    handler: (session: SourceReadSession, request: SourceRequestV1) => Promise<T>
  ): Promise<PostgresSourceSandboxResult<T>> {
    const definition = SourceAdapterDefinitionV1Schema.parse(input.definition)
    const access = SourceAccessEnvelopeV1Schema.parse(input.access)
    const request = SourceRequestV1Schema.parse(input.request)
    this.#validateAuthority(definition, access, request, input.endpointDigest)
    const active = this.#activeByEndpoint.get(input.endpointDigest) ?? 0
    if (active >= request.limits.concurrencyLimit) {
      throw failure('concurrency-limit-exceeded', 'Source concurrency limit is exhausted')
    }
    this.#activeByEndpoint.set(input.endpointDigest, active + 1)
    const started = this.#now()
    const client = new Client({
      connectionString: input.connectionString,
      connectionTimeoutMillis: Math.min(request.limits.timeLimitMs, 30_000),
      application_name: `orca-source-${request.operation}`
    })
    let queryCount = 0
    let rowCount = 0
    let byteCount = 0
    try {
      await client.connect()
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
      await client.query(`SELECT set_config('statement_timeout', $1, true)`, [
        String(request.limits.statementTimeoutMs)
      ])
      const readOnly = await client.query<{ transaction_read_only: string }>(
        'SHOW transaction_read_only'
      )
      if (readOnly.rows[0]?.transaction_read_only !== 'on') {
        throw failure('sandbox_not_read_only', 'PostgreSQL transaction is not read-only')
      }
      const identity = await client.query<{ database_name: string; engine_version: string }>(
        `SELECT current_database() AS database_name,
                current_setting('server_version') AS engine_version`
      )
      if (
        identity.rows[0]?.database_name !== request.source.databaseName ||
        !identity.rows[0]?.engine_version.startsWith(request.source.engineVersion)
      ) {
        throw failure('source-changed', 'Connected PostgreSQL source identity differs')
      }
      const snapshot = await client.query<{ snapshot: string }>(
        'SELECT pg_export_snapshot() AS snapshot'
      )
      let queryQueue: Promise<void> = Promise.resolve()
      const session: SourceReadSession = {
        query: async <TRow extends QueryResultRow>(
          text: string,
          values: readonly unknown[] = []
        ): Promise<TRow[]> => {
          const execute = async (): Promise<TRow[]> => {
            queryCount += 1
            if (queryCount > request.limits.queryLimit) {
              throw failure('query-limit-exceeded', 'Source query limit is exceeded')
            }
            if (this.#now() - started >= request.limits.timeLimitMs) {
              throw failure('deadline-exceeded', 'Source request deadline is exceeded')
            }
            const result = await client.query<TRow>(text, [...values])
            const nextRows = result.rows.length
            const nextBytes = Buffer.byteLength(canonicalJson(result.rows))
            rowCount += nextRows
            byteCount += nextBytes
            if (rowCount > request.limits.rowLimit) {
              throw failure('row-limit-exceeded', 'Source row limit is exceeded')
            }
            if (byteCount > request.limits.byteLimit) {
              throw failure('byte-limit-exceeded', 'Source byte limit is exceeded')
            }
            return result.rows
          }
          const pending = queryQueue.then(execute, execute)
          queryQueue = pending.then(
            () => undefined,
            () => undefined
          )
          return pending
        }
      }
      const value = await this.#withDeadline(
        handler(session, request),
        request.limits.timeLimitMs,
        started
      )
      const completed = this.#now()
      return {
        value,
        snapshotToken: snapshot.rows[0]?.snapshot ?? 'unavailable',
        usage: { queryCount, rowCount, byteCount, wallTimeMs: completed - started },
        startedAt: new Date(started).toISOString(),
        completedAt: new Date(completed).toISOString()
      }
    } catch (error) {
      if (error instanceof PostgresSourceSandboxError) {
        throw error
      }
      if (error instanceof SourceAdapterRegistryError) {
        throw failure(error.code, error.message, error)
      }
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : 'adapter-failed'
      if (code === '25006') {
        throw failure('mutation-blocked', 'PostgreSQL rejected source mutation', error)
      }
      if (code === '57014') {
        throw failure('deadline-exceeded', 'PostgreSQL cancelled a slow source query', error)
      }
      throw failure('adapter-failed', 'PostgreSQL source adapter failed', error)
    } finally {
      try {
        await client.query('ROLLBACK')
      } catch {
        // Connection loss already makes the read-only transaction non-authoritative.
      }
      await client.end().catch(() => undefined)
      if (active === 0) {
        this.#activeByEndpoint.delete(input.endpointDigest)
      } else {
        this.#activeByEndpoint.set(input.endpointDigest, active)
      }
    }
  }

  #validateAuthority(
    definition: SourceAdapterDefinitionV1,
    access: SourceAccessEnvelopeV1,
    request: SourceRequestV1,
    endpointDigest: string
  ): void {
    if (
      endpointDigest !== request.source.endpointDigest ||
      !access.networkEndpointDigests.includes(endpointDigest)
    ) {
      throw failure('network-denied', 'PostgreSQL endpoint is outside source authority')
    }
    const registry = new SourceAdapterRegistry()
    registry.registerDefinition(definition)
    registry.issueAccess(access)
    registry.admitRequest(request)
  }

  async #withDeadline<T>(promise: Promise<T>, limitMs: number, started: number): Promise<T> {
    const remaining = Math.max(1, limitMs - (this.#now() - started))
    let timeout: NodeJS.Timeout | undefined
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(failure('deadline-exceeded', 'Source request deadline is exceeded')),
            remaining
          )
        })
      ])
    } finally {
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }
}
