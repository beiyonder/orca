import type { KeyObject } from 'node:crypto'
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { sha256Text } from './canonical-json.js'
import {
  signEffectRecord,
  verifyEffectRecord,
  type SignedEffectRecord
} from './signed-effect-record.js'

const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,128}$/
const EvidenceUploadGrantSchema = z
  .object({
    tenantId: z.string().regex(SAFE_SEGMENT),
    objectKey: z.string().regex(SAFE_SEGMENT),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z.number().int().nonnegative().max(1_048_576),
    mediaType: z.enum(['application/json', 'text/plain']),
    expiresAt: z.iso.datetime({ offset: true })
  })
  .strict()

export type EvidenceUploadGrant = z.infer<typeof EvidenceUploadGrantSchema>
export type EffectEvidenceReference = {
  uri: string
  sha256: string
  mediaType: string
  bytes: number
  span: { kind: 'whole' }
}

export class EffectEvidenceStoreError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'EffectEvidenceStoreError'
    this.code = code
  }
}

export type BoundedEffectEvidenceStoreOptions = {
  root: string
  trustedGrantKeys: ReadonlyMap<string, KeyObject>
  maxObjectBytes?: number
}

export class BoundedEffectEvidenceStore {
  readonly #root: string
  readonly #trustedGrantKeys: ReadonlyMap<string, KeyObject>
  readonly #maxObjectBytes: number

  constructor(options: BoundedEffectEvidenceStoreOptions) {
    this.#root = options.root
    this.#trustedGrantKeys = options.trustedGrantKeys
    this.#maxObjectBytes = options.maxObjectBytes ?? 1_048_576
  }

  issueGrant(
    grant: EvidenceUploadGrant,
    keyId: string,
    privateKey: KeyObject
  ): SignedEffectRecord<EvidenceUploadGrant> {
    return signEffectRecord(EvidenceUploadGrantSchema.parse(grant), keyId, privateKey)
  }

  async put(
    signedGrant: unknown,
    tenantId: string,
    body: Uint8Array,
    now: string
  ): Promise<EffectEvidenceReference> {
    const verified = verifyEffectRecord(
      signedGrant,
      this.#trustedGrantKeys,
      EvidenceUploadGrantSchema
    )
    const grant = verified.payload
    if (grant.tenantId !== tenantId) {
      throw new EffectEvidenceStoreError(
        'tenant_mismatch',
        'Upload grant belongs to another tenant'
      )
    }
    if (Date.parse(now) >= Date.parse(grant.expiresAt)) {
      throw new EffectEvidenceStoreError('grant_expired', 'Upload grant is expired')
    }
    if (body.byteLength !== grant.bytes || body.byteLength > this.#maxObjectBytes) {
      throw new EffectEvidenceStoreError('size_mismatch', 'Evidence size exceeds its exact grant')
    }
    const digest = sha256Text(body)
    if (digest !== grant.sha256) {
      throw new EffectEvidenceStoreError('digest_mismatch', 'Evidence checksum differs from grant')
    }
    const directory = join(this.#root, tenantId)
    await mkdir(directory, { recursive: true, mode: 0o700 })
    const objectPath = join(directory, grant.objectKey)
    try {
      const existing = await readFile(objectPath)
      if (existing.byteLength !== body.byteLength || sha256Text(existing) !== digest) {
        throw new EffectEvidenceStoreError(
          'object_conflict',
          'Evidence object key already has different content'
        )
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
      await writeFile(objectPath, body, { flag: 'wx', mode: 0o600 })
    }
    const metadata = JSON.stringify({
      tenantId,
      objectKey: grant.objectKey,
      sha256: grant.sha256,
      bytes: grant.bytes,
      mediaType: grant.mediaType,
      uploadedAt: now
    })
    try {
      await writeFile(`${objectPath}.metadata.json`, metadata, { flag: 'wx', mode: 0o600 })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error
      }
      const existingMetadata = JSON.parse(
        await readFile(`${objectPath}.metadata.json`, 'utf8')
      ) as Record<string, unknown>
      if (
        existingMetadata.tenantId !== tenantId ||
        existingMetadata.objectKey !== grant.objectKey ||
        existingMetadata.sha256 !== grant.sha256 ||
        existingMetadata.bytes !== grant.bytes ||
        existingMetadata.mediaType !== grant.mediaType
      ) {
        throw new EffectEvidenceStoreError(
          'metadata_conflict',
          'Evidence metadata differs from the upload grant'
        )
      }
    }
    return {
      uri: `artifact://safe-effect/${tenantId}/${grant.objectKey}`,
      sha256: grant.sha256,
      mediaType: grant.mediaType,
      bytes: grant.bytes,
      span: { kind: 'whole' }
    }
  }

  async verify(
    reference: Pick<EffectEvidenceReference, 'uri' | 'sha256' | 'bytes'>,
    tenantId: string
  ): Promise<boolean> {
    const prefix = `artifact://safe-effect/${tenantId}/`
    if (!reference.uri.startsWith(prefix)) {
      return false
    }
    const objectKey = reference.uri.slice(prefix.length)
    if (!SAFE_SEGMENT.test(objectKey)) {
      return false
    }
    const body = await readFile(join(this.#root, tenantId, objectKey))
    return body.byteLength === reference.bytes && sha256Text(body) === reference.sha256
  }

  async cleanupOrphans(
    tenantId: string,
    referencedObjectKeys: ReadonlySet<string>,
    olderThan: string
  ): Promise<string[]> {
    const directory = join(this.#root, tenantId)
    let entries: string[]
    try {
      entries = await readdir(directory)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []
      }
      throw error
    }
    const removed: string[] = []
    for (const entry of entries) {
      if (entry.endsWith('.metadata.json') || entry.endsWith('.tmp')) {
        continue
      }
      if (!SAFE_SEGMENT.test(entry) || referencedObjectKeys.has(entry)) {
        continue
      }
      const details = await stat(join(directory, entry))
      if (details.mtimeMs >= Date.parse(olderThan)) {
        continue
      }
      await rm(join(directory, entry), { force: true })
      await rm(join(directory, `${entry}.metadata.json`), { force: true })
      removed.push(entry)
    }
    return removed.sort()
  }
}
