import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { Pool } from 'pg'
import { ZodError } from 'zod'
import {
  CommandIdentityMismatchError,
  CommandIndeterminateError,
  CommandResultIntegrityError
} from './database/postgres-command-idempotency.js'
import { PublicMissionProjectionIntegrityError } from './database/postgres-public-mission-query.js'
import {
  streamPublicMissionActivity,
  type PublicMissionActivityStreamOptions
} from './public-mission-activity-stream.js'
import type {
  MissionApiAuthenticator,
  MissionApiPrincipal
} from './public-mission-api-contracts.js'
import { MissionApiCursorError } from './public-mission-api-identity.js'
import {
  authenticatePublicMissionRequest,
  MISSION_API_PREFIX,
  MissionApiRequestError,
  publicMissionApiRoute,
  publicMissionIdempotencyKey,
  publicMissionQueryInput,
  readPublicMissionJsonBody,
  requirePublicMissionPermission,
  type MissionApiRoute
} from './public-mission-api-request.js'
import {
  PublicMissionApiService,
  PublicMissionNotFoundError,
  type PublicMissionCommandResult
} from './public-mission-api-service.js'

const DEFAULT_MAX_BODY_BYTES = 64 * 1024

export type PublicMissionApiServerOptions = {
  pool: Pool
  authenticate: MissionApiAuthenticator
  cursorSecret: string | Buffer
  maxBodyBytes?: number
  activityBatchSize?: number
  activityPollIntervalMs?: number
  activityHeartbeatIntervalMs?: number
  onInternalError?: (error: unknown) => void
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body)
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  })
  response.end(json)
}

function sendData(response: ServerResponse, status: number, data: unknown): void {
  sendJson(response, status, { apiVersion: 'v1', data })
}

function sendError(
  response: ServerResponse,
  status: number,
  code: string,
  message: string,
  details?: unknown
): void {
  sendJson(response, status, {
    apiVersion: 'v1',
    error: { code, message, ...(details === undefined ? {} : { details }) }
  })
}

function sendCommandResult(
  response: ServerResponse,
  result: PublicMissionCommandResult,
  committedStatus: number
): void {
  if (result.outcome === 'rejected') {
    sendError(
      response,
      409,
      result.errorCode ?? 'command_rejected',
      'Mission command was rejected',
      {
        disposition: result.disposition,
        mission: result.mission
      }
    )
    return
  }
  sendData(response, result.disposition === 'replayed' ? 200 : committedStatus, result)
}

async function executeRoute(
  service: PublicMissionApiService,
  route: MissionApiRoute,
  principal: MissionApiPrincipal,
  request: IncomingMessage,
  url: URL,
  response: ServerResponse,
  maxBodyBytes: number,
  activityOptions: PublicMissionActivityStreamOptions
): Promise<void> {
  switch (route.kind) {
    case 'create': {
      const result = await service.createMission(
        principal,
        publicMissionIdempotencyKey(request),
        await readPublicMissionJsonBody(request, maxBodyBytes)
      )
      sendCommandResult(response, result, 201)
      return
    }
    case 'command': {
      const result = await service.changeMissionState(
        principal,
        route.missionId,
        publicMissionIdempotencyKey(request),
        await readPublicMissionJsonBody(request, maxBodyBytes)
      )
      sendCommandResult(response, result, 200)
      return
    }
    case 'list':
      sendData(response, 200, await service.listMissions(principal, publicMissionQueryInput(url)))
      return
    case 'read':
      sendData(response, 200, await service.readMission(principal, route.missionId))
      return
    case 'obligations':
      sendData(
        response,
        200,
        await service.listMissionObligations(
          principal,
          route.missionId,
          publicMissionQueryInput(url)
        )
      )
      return
    case 'activity':
      await service.readMission(principal, route.missionId)
      await streamPublicMissionActivity(
        request,
        response,
        principal,
        route.missionId,
        activityOptions
      )
  }
}

function handleError(
  response: ServerResponse,
  error: unknown,
  onInternalError: ((error: unknown) => void) | undefined
): void {
  if (error instanceof MissionApiRequestError) {
    if (error.status === 401) {
      response.setHeader('WWW-Authenticate', 'Bearer realm="mission-api"')
    }
    sendError(response, error.status, error.code, error.message)
    return
  }
  if (error instanceof PublicMissionNotFoundError) {
    sendError(response, 404, 'mission_not_found', 'Mission not found')
    return
  }
  if (error instanceof MissionApiCursorError) {
    sendError(response, 400, 'invalid_cursor', error.message)
    return
  }
  if (error instanceof ZodError) {
    sendError(
      response,
      400,
      'invalid_request',
      'Request validation failed',
      error.issues.map((issue) => ({
        code: issue.code,
        path: issue.path,
        message: issue.message
      }))
    )
    return
  }
  if (error instanceof CommandIdentityMismatchError) {
    sendError(
      response,
      409,
      'idempotency_conflict',
      'Idempotency key was reused with different input'
    )
    return
  }
  if (
    error instanceof CommandIndeterminateError ||
    error instanceof CommandResultIntegrityError ||
    error instanceof PublicMissionProjectionIntegrityError
  ) {
    onInternalError?.(error)
    sendError(
      response,
      500,
      'integrity_failure',
      'Stored mission state failed integrity validation'
    )
    return
  }
  onInternalError?.(error)
  sendError(response, 500, 'internal_error', 'Mission API request failed')
}

export function createPublicMissionApiServer(options: PublicMissionApiServerOptions): Server {
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1 || maxBodyBytes > 1024 * 1024) {
    throw new TypeError('Mission API body limit must be between 1 byte and 1 MiB')
  }
  const service = new PublicMissionApiService(options.pool, options.cursorSecret)
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://mission-api.local')
      if (!url.pathname.startsWith(MISSION_API_PREFIX)) {
        sendError(response, 404, 'not_found', 'Resource not found')
        return
      }
      const principal = await authenticatePublicMissionRequest(request, options.authenticate)
      const route = publicMissionApiRoute(request, url)
      if (!route) {
        sendError(response, 404, 'not_found', 'Resource not found')
        return
      }
      requirePublicMissionPermission(principal, route.permission)
      await executeRoute(service, route, principal, request, url, response, maxBodyBytes, {
        pool: options.pool,
        cursorSecret: options.cursorSecret,
        ...(options.activityBatchSize === undefined
          ? {}
          : { batchSize: options.activityBatchSize }),
        ...(options.activityPollIntervalMs === undefined
          ? {}
          : { pollIntervalMs: options.activityPollIntervalMs }),
        ...(options.activityHeartbeatIntervalMs === undefined
          ? {}
          : { heartbeatIntervalMs: options.activityHeartbeatIntervalMs }),
        ...(options.onInternalError === undefined
          ? {}
          : { onInternalError: options.onInternalError })
      })
    } catch (error) {
      handleError(response, error, options.onInternalError)
    }
  })
}
