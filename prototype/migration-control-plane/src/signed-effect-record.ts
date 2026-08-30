import { createPublicKey, sign, verify, type KeyObject } from 'node:crypto'
import { z } from 'zod'
import { canonicalJson, sha256Text } from './canonical-json.js'

const SignatureSchema = z
  .object({
    algorithm: z.literal('Ed25519'),
    keyId: z.string().min(1).max(256),
    value: z
      .string()
      .min(1)
      .max(2_048)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/)
  })
  .strict()

export const SignedEffectRecordSchema = z
  .object({
    payload: z.unknown(),
    signature: SignatureSchema
  })
  .strict()

export type SignedEffectRecord<T> = {
  payload: T
  signature: z.infer<typeof SignatureSchema>
}

export class SignedEffectRecordError extends Error {
  readonly code: 'invalid_signed_record' | 'unknown_signing_key' | 'signature_mismatch'

  constructor(code: SignedEffectRecordError['code'], message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SignedEffectRecordError'
    this.code = code
  }
}

export function signingKeyDigest(publicKey: KeyObject): string {
  return sha256Text(createPublicKey(publicKey).export({ type: 'spki', format: 'der' }))
}

export function signEffectRecord<T>(
  payload: T,
  keyId: string,
  privateKey: KeyObject
): SignedEffectRecord<T> {
  return {
    payload,
    signature: {
      algorithm: 'Ed25519',
      keyId,
      value: sign(null, Buffer.from(canonicalJson(payload), 'utf8'), privateKey).toString('base64')
    }
  }
}

export function verifyEffectRecord<T>(
  input: unknown,
  trustedKeys: ReadonlyMap<string, KeyObject>,
  payloadSchema: z.ZodType<T>
): SignedEffectRecord<T> {
  const parsed = SignedEffectRecordSchema.safeParse(input)
  if (!parsed.success) {
    throw new SignedEffectRecordError('invalid_signed_record', 'Signed effect record is invalid', {
      cause: parsed.error
    })
  }
  const key = trustedKeys.get(parsed.data.signature.keyId)
  if (!key) {
    throw new SignedEffectRecordError(
      'unknown_signing_key',
      `Signing key is not trusted: ${parsed.data.signature.keyId}`
    )
  }
  const payload = payloadSchema.safeParse(parsed.data.payload)
  if (!payload.success) {
    throw new SignedEffectRecordError('invalid_signed_record', 'Signed payload is invalid', {
      cause: payload.error
    })
  }
  const valid = verify(
    null,
    Buffer.from(canonicalJson(payload.data), 'utf8'),
    key,
    Buffer.from(parsed.data.signature.value, 'base64')
  )
  if (!valid) {
    throw new SignedEffectRecordError('signature_mismatch', 'Signed effect record was modified')
  }
  return { payload: payload.data, signature: parsed.data.signature }
}
