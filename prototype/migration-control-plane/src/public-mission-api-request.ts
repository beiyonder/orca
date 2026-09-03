import type { IncomingMessage } from 'node:http'
import { MissionIdSchema } from './domain/common-contracts.js'
import {
  MissionApiPrincipalSchema,
  type MissionApiAuthenticator,
  type MissionApiPermission,
  type MissionApiPrincipal
} from './public-mission-api-contracts.js'
import { PublicMissionNotFoundError } from './public-mission-api-service.js'

export const MISSION_API_PREFIX = '/api/v1'
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/

export class MissionApiRequestError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'MissionApiRequestError'
    this.status = status
    this.code = code
  }
}

export type MissionApiRoute =
  | { kind: 'create'; permission: 'mission:write' }
  | { kind: 'list'; permission: 'mission:read' }
  | { kind: 'read'; permission: 'mission:read'; missionId: string }
  | { kind: 'command'; permission: 'mission:write'; missionId: string }
  | { kind: 'obligations'; permission: 'mission:read'; missionId: string }

export function publicMissionApiRoute(request: IncomingMessage, url: URL): MissionApiRoute | null {
  if (url.pathname === `${MISSION_API_PREFIX}/missions`) {
    if (request.method === 'POST') {
      return { kind: 'create', permission: 'mission:write' }
    }
    if (request.method === 'GET') {
      return { kind: 'list', permission: 'mission:read' }
    }
    return null
  }
  const match = /^\/api\/v1\/missions\/([^/]+)(?:\/(commands|obligations))?$/.exec(url.pathname)
  if (!match) {
    return null
  }
  let missionId: string
  try {
    missionId = decodeURIComponent(match[1]!)
  } catch {
    throw new PublicMissionNotFoundError()
  }
  if (!MissionIdSchema.safeParse(missionId).success) {
    throw new PublicMissionNotFoundError()
  }
  if (match[2] === 'commands' && request.method === 'POST') {
    return { kind: 'command', permission: 'mission:write', missionId }
  }
  if (match[2] === 'obligations' && request.method === 'GET') {
    return { kind: 'obligations', permission: 'mission:read', missionId }
  }
  if (match[2] === undefined && request.method === 'GET') {
    return { kind: 'read', permission: 'mission:read', missionId }
  }
  return null
}

export async function authenticatePublicMissionRequest(
  request: IncomingMessage,
  authenticate: MissionApiAuthenticator
): Promise<MissionApiPrincipal> {
  const authorization = request.headers.authorization
  const match = typeof authorization === 'string' ? /^Bearer ([^\s]+)$/.exec(authorization) : null
  if (!match) {
    throw new MissionApiRequestError(401, 'unauthenticated', 'Bearer authentication is required')
  }
  let rawPrincipal: unknown
  try {
    rawPrincipal = await authenticate(match[1]!)
  } catch {
    throw new MissionApiRequestError(401, 'unauthenticated', 'Bearer authentication failed')
  }
  const parsed = MissionApiPrincipalSchema.safeParse(rawPrincipal)
  if (!parsed.success) {
    throw new MissionApiRequestError(401, 'unauthenticated', 'Bearer authentication failed')
  }
  return parsed.data
}

export function requirePublicMissionPermission(
  principal: MissionApiPrincipal,
  permission: MissionApiPermission
): void {
  if (!principal.permissions.includes(permission)) {
    throw new MissionApiRequestError(403, 'forbidden', 'Mission permission is required')
  }
}

export function publicMissionIdempotencyKey(request: IncomingMessage): string {
  const value = request.headers['idempotency-key']
  if (typeof value !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw new MissionApiRequestError(
      400,
      'invalid_idempotency_key',
      'Idempotency-Key must be 1-128 stable ASCII characters'
    )
  }
  return value
}

export async function readPublicMissionJsonBody(
  request: IncomingMessage,
  maxBodyBytes: number
): Promise<unknown> {
  const contentType = request.headers['content-type']
  if (typeof contentType !== 'string' || !/^application\/json(?:\s*;|$)/i.test(contentType)) {
    throw new MissionApiRequestError(415, 'unsupported_media_type', 'Content-Type must be JSON')
  }
  const declaredLength = request.headers['content-length']
  if (declaredLength !== undefined) {
    const bytes = Number(declaredLength)
    if (!Number.isSafeInteger(bytes) || bytes < 0) {
      throw new MissionApiRequestError(400, 'invalid_content_length', 'Content-Length is invalid')
    }
    if (bytes > maxBodyBytes) {
      request.resume()
      throw new MissionApiRequestError(413, 'payload_too_large', 'Request body exceeds limit')
    }
  }
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += buffer.byteLength
    if (bytes > maxBodyBytes) {
      request.resume()
      throw new MissionApiRequestError(413, 'payload_too_large', 'Request body exceeds limit')
    }
    chunks.push(buffer)
  }
  if (bytes === 0) {
    throw new MissionApiRequestError(400, 'invalid_json', 'Request body must contain JSON')
  }
  try {
    return JSON.parse(Buffer.concat(chunks, bytes).toString('utf8')) as unknown
  } catch {
    throw new MissionApiRequestError(400, 'invalid_json', 'Request body contains invalid JSON')
  }
}

export function publicMissionQueryInput(url: URL): Record<string, string> {
  const input: Record<string, string> = {}
  for (const [key, value] of url.searchParams) {
    if (key in input) {
      throw new MissionApiRequestError(400, 'invalid_query', 'Query parameters must be unique')
    }
    input[key] = value
  }
  return input
}
