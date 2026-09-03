import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { canonicalJson, sha256Text } from './canonical-json.js'
import { MissionIdSchema, TenantIdSchema } from './domain/common-contracts.js'

const CursorPayloadSchema = z.strictObject({
  version: z.literal(1),
  kind: z.enum(['missions', 'obligations']),
  tenantId: TenantIdSchema,
  missionId: MissionIdSchema.nullable(),
  lastId: z.string().min(1).max(128)
})

type CursorPayload = z.input<typeof CursorPayloadSchema>
type ParsedCursorPayload = z.output<typeof CursorPayloadSchema>

export class MissionApiCursorError extends Error {
  constructor() {
    super('Pagination cursor is invalid for this resource')
    this.name = 'MissionApiCursorError'
  }
}

function signature(secret: string | Buffer, payload: string): Buffer {
  return createHmac('sha256', secret).update(payload).digest()
}

export function stablePublicMissionApiId(prefix: string, identity: unknown): string {
  return `${prefix}_${sha256Text(canonicalJson(identity)).slice(0, 32)}`
}

export function encodeMissionApiCursor(secret: string | Buffer, payload: CursorPayload): string {
  const parsed = CursorPayloadSchema.parse(payload)
  const encoded = Buffer.from(canonicalJson(parsed), 'utf8').toString('base64url')
  return `${encoded}.${signature(secret, encoded).toString('base64url')}`
}

export function decodeMissionApiCursor(
  secret: string | Buffer,
  token: string,
  expected: Pick<CursorPayload, 'kind' | 'tenantId' | 'missionId'>
): ParsedCursorPayload {
  try {
    const [encoded, encodedSignature, extra] = token.split('.')
    if (!encoded || !encodedSignature || extra !== undefined) {
      throw new MissionApiCursorError()
    }
    const supplied = Buffer.from(encodedSignature, 'base64url')
    const expectedSignature = signature(secret, encoded)
    if (
      supplied.length !== expectedSignature.length ||
      !timingSafeEqual(supplied, expectedSignature)
    ) {
      throw new MissionApiCursorError()
    }
    const payload = CursorPayloadSchema.parse(
      JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as unknown
    )
    if (
      payload.kind !== expected.kind ||
      payload.tenantId !== expected.tenantId ||
      payload.missionId !== expected.missionId
    ) {
      throw new MissionApiCursorError()
    }
    return payload
  } catch (error) {
    if (error instanceof MissionApiCursorError) {
      throw error
    }
    throw new MissionApiCursorError()
  }
}
