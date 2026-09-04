import type { IncomingMessage, ServerResponse } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'
import type { Pool } from 'pg'
import { readPublicMissionActivityBatch } from './database/postgres-public-mission-activity.js'
import type { MissionApiPrincipal } from './public-mission-api-contracts.js'
import {
  decodeMissionActivityCursor,
  encodeMissionActivityCursor,
  MissionApiCursorError
} from './public-mission-api-identity.js'
import { MissionApiRequestError } from './public-mission-api-request.js'

export type PublicMissionActivityStreamOptions = {
  pool: Pool
  cursorSecret: string | Buffer
  batchSize?: number
  pollIntervalMs?: number
  heartbeatIntervalMs?: number
  onInternalError?: (error: unknown) => void
}

type ResolvedOptions = Required<
  Pick<PublicMissionActivityStreamOptions, 'batchSize' | 'pollIntervalMs' | 'heartbeatIntervalMs'>
> &
  Pick<PublicMissionActivityStreamOptions, 'pool' | 'cursorSecret' | 'onInternalError'>

function resolveOptions(options: PublicMissionActivityStreamOptions): ResolvedOptions {
  const resolved = {
    ...options,
    batchSize: options.batchSize ?? 100,
    pollIntervalMs: options.pollIntervalMs ?? 1_000,
    heartbeatIntervalMs: options.heartbeatIntervalMs ?? 15_000
  }
  if (
    !Number.isSafeInteger(resolved.batchSize) ||
    resolved.batchSize < 1 ||
    resolved.batchSize > 500
  ) {
    throw new TypeError('Mission activity batch size must be between 1 and 500')
  }
  if (
    !Number.isSafeInteger(resolved.pollIntervalMs) ||
    resolved.pollIntervalMs < 10 ||
    resolved.pollIntervalMs > 60_000
  ) {
    throw new TypeError('Mission activity poll interval must be between 10 ms and 60 seconds')
  }
  if (
    !Number.isSafeInteger(resolved.heartbeatIntervalMs) ||
    resolved.heartbeatIntervalMs < resolved.pollIntervalMs ||
    resolved.heartbeatIntervalMs > 120_000
  ) {
    throw new TypeError(
      'Mission activity heartbeat must be between the poll interval and 2 minutes'
    )
  }
  return resolved
}

function afterRevision(
  request: IncomingMessage,
  secret: string | Buffer,
  tenantId: string,
  missionId: string
): number {
  const header = request.headers['last-event-id']
  if (header === undefined) {
    return 0
  }
  if (typeof header !== 'string' || header.length === 0 || header.length > 2_048) {
    throw new MissionApiCursorError()
  }
  return decodeMissionActivityCursor(secret, header, { tenantId, missionId }).lastRevision
}

async function writeChunk(
  response: ServerResponse,
  request: IncomingMessage,
  chunk: string
): Promise<boolean> {
  if (response.destroyed || request.destroyed) {
    return false
  }
  if (response.write(chunk)) {
    return true
  }
  const { promise, resolve } = Promise.withResolvers<boolean>()
  const cleanup = () => {
    response.off('drain', onDrain)
    response.off('close', onClose)
  }
  const onDrain = () => {
    cleanup()
    resolve(true)
  }
  const onClose = () => {
    cleanup()
    resolve(false)
  }
  response.once('drain', onDrain)
  response.once('close', onClose)
  return promise
}

function eventFrame(
  event: { aggregateRevision: number },
  secret: string | Buffer,
  tenantId: string,
  missionId: string
): string {
  const cursor = encodeMissionActivityCursor(secret, {
    version: 1,
    kind: 'activity',
    tenantId,
    missionId,
    lastRevision: event.aggregateRevision
  })
  return `id: ${cursor}\nevent: mission.activity\ndata: ${JSON.stringify({ apiVersion: 'v1', activity: event })}\n\n`
}

export async function streamPublicMissionActivity(
  request: IncomingMessage,
  response: ServerResponse,
  principal: MissionApiPrincipal,
  missionId: string,
  rawOptions: PublicMissionActivityStreamOptions
): Promise<void> {
  const options = resolveOptions(rawOptions)
  let revision = afterRevision(request, options.cursorSecret, principal.tenantId, missionId)
  let batch = await readPublicMissionActivityBatch(
    options.pool,
    principal.tenantId,
    missionId,
    revision,
    options.batchSize
  )
  if (batch === null) {
    throw new MissionApiRequestError(404, 'mission_not_found', 'Mission not found')
  }
  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'X-Content-Type-Options': 'nosniff'
  })
  if (!(await writeChunk(response, request, `retry: ${options.pollIntervalMs}\n\n`))) {
    return
  }
  const abort = new AbortController()
  response.once('close', () => abort.abort())
  request.once('aborted', () => abort.abort())
  let lastWriteAt = Date.now()
  try {
    while (!abort.signal.aborted) {
      for (const event of batch.events) {
        if (
          !(await writeChunk(
            response,
            request,
            eventFrame(event, options.cursorSecret, principal.tenantId, missionId)
          ))
        ) {
          return
        }
        revision = event.aggregateRevision
        lastWriteAt = Date.now()
      }
      if (revision < batch.currentRevision) {
        batch = (await readPublicMissionActivityBatch(
          options.pool,
          principal.tenantId,
          missionId,
          revision,
          options.batchSize
        ))!
        continue
      }
      const heartbeatRemaining = Math.max(
        0,
        options.heartbeatIntervalMs - (Date.now() - lastWriteAt)
      )
      await delay(Math.min(options.pollIntervalMs, heartbeatRemaining), undefined, {
        signal: abort.signal
      })
      if (Date.now() - lastWriteAt >= options.heartbeatIntervalMs) {
        if (!(await writeChunk(response, request, ': keepalive\n\n'))) {
          return
        }
        lastWriteAt = Date.now()
      }
      batch = (await readPublicMissionActivityBatch(
        options.pool,
        principal.tenantId,
        missionId,
        revision,
        options.batchSize
      ))!
    }
  } catch (error) {
    if (!abort.signal.aborted) {
      options.onInternalError?.(error)
      response.end()
    }
  }
}
