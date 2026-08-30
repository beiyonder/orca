import type { KeyObject } from 'node:crypto'
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { z } from 'zod'
import { canonicalJson } from './canonical-json.js'
import {
  EffectIntentV2Schema,
  PolicyDecisionV2Schema
} from './domain/effect-execution-contracts-v2.js'
import {
  SignedEffectRecordSchema,
  verifyEffectRecord,
  type SignedEffectRecord
} from './signed-effect-record.js'

const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,128}$/
const RelaySessionSchema = z
  .object({
    relayId: z.string().regex(SAFE_SEGMENT),
    tenantId: z.string().regex(SAFE_SEGMENT),
    audience: z.literal('migration-control-effect-relay'),
    sessionNonce: z.string().regex(SAFE_SEGMENT),
    expiresAt: z.iso.datetime({ offset: true })
  })
  .strict()

export const EffectRelayDispatchSchema = z
  .object({
    relayId: z.string().regex(SAFE_SEGMENT),
    tenantId: z.string().regex(SAFE_SEGMENT),
    sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    dispatchId: z.string().regex(SAFE_SEGMENT),
    effectId: z.string().regex(/^effect_[A-Za-z0-9_-]+$/),
    intent: EffectIntentV2Schema,
    policyDecision: PolicyDecisionV2Schema,
    capability: SignedEffectRecordSchema,
    secretLease: SignedEffectRecordSchema,
    createdAt: z.iso.datetime({ offset: true }),
    expiresAt: z.iso.datetime({ offset: true })
  })
  .strict()

export type RelaySession = z.infer<typeof RelaySessionSchema>
export type EffectRelayDispatch = z.infer<typeof EffectRelayDispatchSchema>
export type RelayAcceptAcknowledgment = {
  relayId: string
  sequence: number
  dispatchId: string
  status: 'durably-accepted'
}

export class EffectRelayError extends Error {
  readonly code: string

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'EffectRelayError'
    this.code = code
  }
}

export type EffectRelayGatewayOptions = {
  root: string
  relayId: string
  tenantId: string
  trustedRelayKeys: ReadonlyMap<string, KeyObject>
  trustedDispatchKeys: ReadonlyMap<string, KeyObject>
  maxPendingItems?: number
  maxFrameBytes?: number
}

type PendingDispatch = {
  frame: SignedEffectRecord<EffectRelayDispatch>
  path: string
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const temporaryPath = `${path}.${process.pid}.tmp`
  await writeFile(temporaryPath, canonicalJson(value), { flag: 'wx', mode: 0o600 })
  await rename(temporaryPath, path)
}

export class EffectRelayGateway {
  readonly #root: string
  readonly #relayId: string
  readonly #tenantId: string
  readonly #trustedRelayKeys: ReadonlyMap<string, KeyObject>
  readonly #trustedDispatchKeys: ReadonlyMap<string, KeyObject>
  readonly #maxPendingItems: number
  readonly #maxFrameBytes: number

  constructor(options: EffectRelayGatewayOptions) {
    this.#root = resolve(options.root)
    this.#relayId = options.relayId
    this.#tenantId = options.tenantId
    this.#trustedRelayKeys = options.trustedRelayKeys
    this.#trustedDispatchKeys = options.trustedDispatchKeys
    this.#maxPendingItems = options.maxPendingItems ?? 128
    this.#maxFrameBytes = options.maxFrameBytes ?? 256 * 1024
  }

  authenticate(signedSession: unknown, now: string): RelaySession {
    const session = verifyEffectRecord(
      signedSession,
      this.#trustedRelayKeys,
      RelaySessionSchema
    ).payload
    if (session.relayId !== this.#relayId || session.tenantId !== this.#tenantId) {
      throw new EffectRelayError(
        'relay_identity_mismatch',
        'Relay session identity is not assigned'
      )
    }
    if (Date.parse(now) >= Date.parse(session.expiresAt)) {
      throw new EffectRelayError('relay_session_expired', 'Relay session is expired')
    }
    return session
  }

  async accept(
    signedDispatch: unknown,
    session: RelaySession,
    now: string
  ): Promise<RelayAcceptAcknowledgment> {
    this.#assertActiveSession(session, now)
    const verified = verifyEffectRecord(
      signedDispatch,
      this.#trustedDispatchKeys,
      EffectRelayDispatchSchema
    )
    const dispatch = verified.payload
    if (
      dispatch.relayId !== session.relayId ||
      dispatch.tenantId !== session.tenantId ||
      dispatch.intent.tenantId !== session.tenantId ||
      dispatch.effectId !== dispatch.intent.id
    ) {
      throw new EffectRelayError('dispatch_identity_mismatch', 'Dispatch crosses relay authority')
    }
    if (Date.parse(now) >= Date.parse(dispatch.expiresAt)) {
      throw new EffectRelayError('dispatch_expired', 'Expired work is not accepted')
    }
    if (Buffer.byteLength(canonicalJson(verified), 'utf8') > this.#maxFrameBytes) {
      throw new EffectRelayError('frame_too_large', 'Dispatch exceeds relay frame limit')
    }
    await mkdir(this.#root, { recursive: true, mode: 0o700 })
    const pending = await this.pending()
    const duplicate = pending.find((item) => item.frame.payload.sequence === dispatch.sequence)
    if (duplicate) {
      if (duplicate.frame.payload.dispatchId !== dispatch.dispatchId) {
        throw new EffectRelayError(
          'sequence_conflict',
          'Relay sequence was reused for another dispatch'
        )
      }
      return this.#acknowledgment(dispatch)
    }
    const expectedSequence = await this.#nextSequence()
    if (dispatch.sequence !== expectedSequence) {
      throw new EffectRelayError(
        'sequence_gap',
        `Expected relay sequence ${expectedSequence}, received ${dispatch.sequence}`
      )
    }
    if (pending.length >= this.#maxPendingItems) {
      throw new EffectRelayError('spool_full', 'Relay spool capacity is exhausted')
    }
    const fileName = `${String(dispatch.sequence).padStart(12, '0')}-${dispatch.dispatchId}.json`
    await writeJsonAtomic(join(this.#root, fileName), verified)
    await writeJsonAtomic(join(this.#root, 'checkpoint.json'), {
      relayId: this.#relayId,
      tenantId: this.#tenantId,
      acceptedThrough: dispatch.sequence,
      updatedAt: now
    })
    return this.#acknowledgment(dispatch)
  }

  async pending(): Promise<PendingDispatch[]> {
    let entries: string[]
    try {
      entries = await readdir(this.#root)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []
      }
      throw error
    }
    const pending: PendingDispatch[] = []
    for (const entry of entries.sort()) {
      if (!/^\d{12}-[A-Za-z0-9_-]{1,128}\.json$/.test(entry)) {
        continue
      }
      const path = join(this.#root, entry)
      const receiptPath = `${path}.receipt.json`
      try {
        await readFile(receiptPath)
        continue
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error
        }
      }
      const frame = verifyEffectRecord(
        JSON.parse(await readFile(path, 'utf8')) as unknown,
        this.#trustedDispatchKeys,
        EffectRelayDispatchSchema
      )
      pending.push({ frame, path })
    }
    return pending
  }
  async completedReceipts(): Promise<unknown[]> {
    let entries: string[]
    try {
      entries = await readdir(this.#root)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []
      }
      throw error
    }
    const receipts: unknown[] = []
    for (const entry of entries.sort()) {
      if (!/^\d{12}-[A-Za-z0-9_-]{1,128}\.json\.receipt\.json$/.test(entry)) {
        continue
      }
      receipts.push(JSON.parse(await readFile(join(this.#root, entry), 'utf8')) as unknown)
    }
    return receipts
  }
  async readExecutionJournal(dispatchPath: string): Promise<unknown> {
    const childPath = relative(this.#root, dispatchPath)
    if (childPath.startsWith('..') || isAbsolute(childPath)) {
      throw new EffectRelayError('invalid_dispatch_path', 'Journal path leaves relay spool')
    }
    try {
      return JSON.parse(await readFile(`${dispatchPath}.journal.json`, 'utf8')) as unknown
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null
      }
      throw error
    }
  }

  async persistExecutionJournal(dispatchPath: string, journal: unknown): Promise<void> {
    const existing = await this.readExecutionJournal(dispatchPath)
    if (existing !== null) {
      if (canonicalJson(existing) !== canonicalJson(journal)) {
        throw new EffectRelayError('journal_conflict', 'Execution journal is immutable')
      }
      return
    }
    await writeJsonAtomic(`${dispatchPath}.journal.json`, journal)
  }

  async persistReceipt(dispatchPath: string, signedReceipt: unknown): Promise<void> {
    const childPath = relative(this.#root, dispatchPath)
    if (childPath.startsWith('..') || isAbsolute(childPath)) {
      throw new EffectRelayError('invalid_dispatch_path', 'Receipt path leaves relay spool')
    }
    await writeJsonAtomic(`${dispatchPath}.receipt.json`, signedReceipt)
  }

  #assertActiveSession(session: RelaySession, now: string): void {
    const parsed = RelaySessionSchema.parse(session)
    if (parsed.relayId !== this.#relayId || parsed.tenantId !== this.#tenantId) {
      throw new EffectRelayError(
        'relay_identity_mismatch',
        'Relay session identity is not assigned'
      )
    }
    if (Date.parse(now) >= Date.parse(parsed.expiresAt)) {
      throw new EffectRelayError('relay_session_expired', 'Relay session is expired')
    }
  }

  async #nextSequence(): Promise<number> {
    try {
      const checkpoint = JSON.parse(
        await readFile(join(this.#root, 'checkpoint.json'), 'utf8')
      ) as { acceptedThrough?: unknown }
      if (typeof checkpoint.acceptedThrough === 'number') {
        return checkpoint.acceptedThrough + 1
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
    const entries = await readdir(this.#root)
    const sequences = entries
      .map((entry) => /^([0-9]{12})-/.exec(entry)?.[1])
      .filter((value): value is string => value !== undefined)
      .map(Number)
    return sequences.length === 0 ? 1 : Math.max(...sequences) + 1
  }

  #acknowledgment(dispatch: EffectRelayDispatch): RelayAcceptAcknowledgment {
    return {
      relayId: dispatch.relayId,
      sequence: dispatch.sequence,
      dispatchId: dispatch.dispatchId,
      status: 'durably-accepted'
    }
  }
}
