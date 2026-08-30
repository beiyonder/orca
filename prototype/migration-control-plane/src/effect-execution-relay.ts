import type { KeyObject } from 'node:crypto'
import { canonicalJson, sha256Text, type JsonValue } from './canonical-json.js'
import type { BoundedEffectEvidenceStore } from './bounded-effect-evidence-store.js'
import {
  CapabilityEnvelopeV2Schema,
  type CapabilityEnvelopeV2
} from './domain/effect-execution-contracts-v2.js'
import {
  EffectReceiptV1Schema,
  SecretLeaseV1Schema,
  type EffectReceiptV1
} from './domain/effect-contracts.js'
import type { EffectRelayDispatch, EffectRelayGateway } from './effect-relay-gateway.js'
import { OmpHostToolAuthority } from './omp-host-tool-authority.js'
import { POSTGRES_MARKER_ADAPTER } from './postgres-marker-target-adapter.js'
import type {
  MarkerEffectRequest,
  MarkerTargetState,
  PostgresMarkerTargetAdapter,
  PreparedMarkerEffect
} from './postgres-marker-target-adapter.js'
import { SafeEffectRunnerSandbox } from './safe-effect-runner-sandbox.js'
import {
  signEffectRecord,
  verifyEffectRecord,
  type SignedEffectRecord
} from './signed-effect-record.js'

export const MARKER_RUNNER_SOURCE = `
if (
  typeof input !== "object" || input === null ||
  input.operation !== "ensure-marker" ||
  typeof input.request !== "object" || input.request === null
) throw new TypeError("invalid marker runner input")
const request = input.request
if (
  typeof request.tenantId !== "string" ||
  typeof request.effectId !== "string" ||
  typeof request.markerKey !== "string" ||
  typeof request.subjectVersion !== "string"
) throw new TypeError("invalid marker request")
output = JSON.parse(JSON.stringify(request))
`.trim()

export const MARKER_RUNNER_DIGEST = sha256Text(MARKER_RUNNER_SOURCE)

export type EffectRelayFaultPoint =
  | 'before_capability'
  | 'after_capability'
  | 'before_prepare'
  | 'after_prepare'
  | 'before_send'
  | 'after_send'
  | 'before_receipt'
  | 'after_receipt'
  | 'before_ack'
  | 'after_ack'

export type EffectRelayFaultHook = (point: EffectRelayFaultPoint) => void | Promise<void>

export type EffectExecutionRelayOptions = {
  gateway: EffectRelayGateway
  adapter: PostgresMarkerTargetAdapter
  evidenceStore: BoundedEffectEvidenceStore
  trustedCapabilityKeys: ReadonlyMap<string, KeyObject>
  trustedSecretLeaseKeys: ReadonlyMap<string, KeyObject>
  receiptKeyId: string
  receiptPrivateKey: KeyObject
  evidenceGrantKeyId: string
  evidenceGrantPrivateKey: KeyObject
  runner?: SafeEffectRunnerSandbox
}

export type ProcessedEffectDispatch = {
  dispatchId: string
  receipt: SignedEffectRecord<EffectReceiptV1>
  reconciled: boolean
}

function markerRequest(dispatch: EffectRelayDispatch): MarkerEffectRequest {
  const parameters = dispatch.intent.parameters
  if (typeof parameters !== 'object' || parameters === null || Array.isArray(parameters)) {
    throw new TypeError('Marker parameters must be an object')
  }
  const markerKey = parameters.markerKey
  const value = parameters.value
  if (typeof markerKey !== 'string' || value === undefined) {
    throw new TypeError('Marker parameters require markerKey and value')
  }
  return {
    tenantId: dispatch.tenantId,
    effectId: dispatch.effectId,
    markerKey,
    value,
    subjectVersion: dispatch.intent.authority.subjectVersion
  }
}

export class EffectExecutionRelay {
  readonly #gateway: EffectRelayGateway
  readonly #adapter: PostgresMarkerTargetAdapter
  readonly #evidenceStore: BoundedEffectEvidenceStore
  readonly #trustedCapabilityKeys: ReadonlyMap<string, KeyObject>
  readonly #trustedSecretLeaseKeys: ReadonlyMap<string, KeyObject>
  readonly #receiptKeyId: string
  readonly #receiptPrivateKey: KeyObject
  readonly #evidenceGrantKeyId: string
  readonly #evidenceGrantPrivateKey: KeyObject
  readonly #runner: SafeEffectRunnerSandbox

  constructor(options: EffectExecutionRelayOptions) {
    this.#gateway = options.gateway
    this.#adapter = options.adapter
    this.#evidenceStore = options.evidenceStore
    this.#trustedCapabilityKeys = options.trustedCapabilityKeys
    this.#trustedSecretLeaseKeys = options.trustedSecretLeaseKeys
    this.#receiptKeyId = options.receiptKeyId
    this.#receiptPrivateKey = options.receiptPrivateKey
    this.#evidenceGrantKeyId = options.evidenceGrantKeyId
    this.#evidenceGrantPrivateKey = options.evidenceGrantPrivateKey
    this.#runner =
      options.runner ??
      new SafeEffectRunnerSandbox({
        source: MARKER_RUNNER_SOURCE,
        expectedDigest: MARKER_RUNNER_DIGEST,
        limits: {
          cpuTimeMs: 100,
          inputBytes: 64 * 1024,
          outputBytes: 64 * 1024,
          memoryBytes: 256 * 1024
        }
      })
  }

  async processPending(
    now: string,
    fault?: EffectRelayFaultHook
  ): Promise<ProcessedEffectDispatch[]> {
    const processed: ProcessedEffectDispatch[] = []
    for (const pending of await this.#gateway.pending()) {
      const dispatch = pending.frame.payload
      const result = await this.#processDispatch(dispatch, pending.path, now, fault)
      await fault?.('before_ack')
      await this.#gateway.persistReceipt(pending.path, result.receipt)
      await fault?.('after_ack')
      processed.push({ dispatchId: dispatch.dispatchId, ...result })
    }
    return processed
  }

  async #processDispatch(
    dispatch: EffectRelayDispatch,
    dispatchPath: string,
    now: string,
    fault?: EffectRelayFaultHook
  ): Promise<{ receipt: ProcessedEffectDispatch['receipt']; reconciled: boolean }> {
    await fault?.('before_capability')
    const signedCapability = verifyEffectRecord(
      dispatch.capability,
      this.#trustedCapabilityKeys,
      CapabilityEnvelopeV2Schema
    )
    const capability = signedCapability.payload
    const secretLease = verifyEffectRecord(
      dispatch.secretLease,
      this.#trustedSecretLeaseKeys,
      SecretLeaseV1Schema
    ).payload
    if (
      secretLease.tenantId !== dispatch.tenantId ||
      secretLease.effectId !== dispatch.effectId ||
      !capability.secretLeaseIds.includes(secretLease.id) ||
      secretLease.recipient.assignmentId !== capability.workload.assignmentId ||
      secretLease.recipient.attemptId !== capability.workload.attemptId ||
      secretLease.recipient.fence !== capability.workload.fence ||
      secretLease.recipient.audience !== capability.workload.audience ||
      canonicalJson(secretLease.target) !== canonicalJson(capability.target) ||
      secretLease.revokedAt !== null ||
      Date.parse(now) >= Date.parse(secretLease.expiresAt) ||
      !secretLease.secretReference.startsWith('secret://')
    ) {
      throw new TypeError('Secret lease is expired, revoked, or not bound to this dispatch')
    }
    this.#assertDispatchBinding(dispatch, capability)
    await fault?.('after_capability')
    const request = markerRequest(dispatch)
    await fault?.('before_prepare')
    const storedJournal = await this.#gateway.readExecutionJournal(dispatchPath)
    let prepared: PreparedMarkerEffect
    if (storedJournal === null) {
      prepared = await this.#adapter.prepare(request)
      await this.#gateway.persistExecutionJournal(dispatchPath, prepared)
    } else {
      if (typeof storedJournal !== 'object' || storedJournal === null) {
        throw new TypeError('Execution journal is invalid')
      }
      const candidate = storedJournal as Partial<PreparedMarkerEffect>
      if (
        typeof candidate.requestDigest !== 'string' ||
        candidate.request === undefined ||
        candidate.before === undefined ||
        canonicalJson(candidate.request) !== canonicalJson(request)
      ) {
        throw new TypeError('Execution journal does not bind the pending request')
      }
      prepared = candidate as PreparedMarkerEffect
    }
    await fault?.('after_prepare')
    let after: MarkerTargetState
    let providerRequestId: string | null = null
    let reconciled = false
    if (prepared.before.classification === 'applied') {
      after = prepared.before
      providerRequestId = `${request.tenantId}:${request.effectId}`
      reconciled = true
    } else if (prepared.before.classification === 'absent') {
      const tool = capability.allowedTools.find(
        (candidate) => candidate.name === 'postgres_marker_ensure'
      )
      if (!tool) throw new TypeError('Capability omits the marker tool')
      const authority = new OmpHostToolAuthority({
        attempt: {
          tenantId: dispatch.tenantId,
          missionId: dispatch.intent.missionId,
          assignmentId: dispatch.intent.authority.assignmentId,
          attemptId: dispatch.intent.authority.attemptId,
          fence: dispatch.intent.authority.fence,
          issuer: dispatch.intent.authority.workloadIdentity.issuer,
          subject: dispatch.intent.authority.workloadIdentity.subject,
          audience: dispatch.intent.authority.workloadIdentity.audience,
          subjectVersion: dispatch.intent.authority.subjectVersion,
          runnerDigest: MARKER_RUNNER_DIGEST,
          status: 'running'
        },
        capabilityEnvelope: capability,
        policyDecision: dispatch.policyDecision
      })
      authority.reserve({ now, tool, parameterDigest: dispatch.intent.parameterDigest })
      const runner = this.#runner.run({ operation: 'ensure-marker', request } as JsonValue)
      if (runner.runnerDigest !== capability.runnerDigest) {
        throw new TypeError('Runner digest differs from capability')
      }
      await fault?.('before_send')
      const applied = await this.#adapter.apply({
        ...prepared,
        request: runner.output as unknown as MarkerEffectRequest
      })
      after = applied.state
      providerRequestId = applied.providerRequestId
      await fault?.('after_send')
    } else {
      after = prepared.before
      reconciled = true
    }
    await fault?.('before_receipt')
    const beforeEvidence = await this.#writeEvidence(dispatch, 'before', prepared.before, now)
    const afterEvidence = await this.#writeEvidence(dispatch, 'after', after, now)
    const receiptDigest = sha256Text(
      canonicalJson({ effectId: dispatch.effectId, dispatchId: dispatch.dispatchId })
    )
    const applied = after.classification === 'applied'
    const absent = after.classification === 'absent'
    const receipt = EffectReceiptV1Schema.parse({
      schemaVersion: 1,
      kind: 'effect-receipt',
      id: `receipt_${receiptDigest.slice(0, 24)}`,
      tenantId: dispatch.tenantId,
      missionId: dispatch.intent.missionId,
      createdAt: now,
      effectId: dispatch.effectId,
      attemptId: `effect_attempt_${receiptDigest.slice(0, 24)}`,
      fence: dispatch.intent.authority.fence,
      adapterName: POSTGRES_MARKER_ADAPTER.name,
      adapterVersion: POSTGRES_MARKER_ADAPTER.version,
      runnerDigest: MARKER_RUNNER_DIGEST,
      requestDigest: prepared.requestDigest,
      idempotencyKeyHash: sha256Text(dispatch.intent.idempotency.key ?? dispatch.effectId),
      providerRequestId,
      providerResourceIds: [request.markerKey],
      status: applied ? 'applied' : absent ? 'absent' : 'unknown',
      responseCategory: reconciled ? 'independent-readback' : 'target-response',
      beforeEvidence,
      afterEvidence: applied ? afterEvidence : null,
      residualResources: applied || absent ? [] : [after],
      rawResponse: null,
      signer: this.#receiptKeyId,
      observedAt: now
    })
    const signedReceipt = signEffectRecord(receipt, this.#receiptKeyId, this.#receiptPrivateKey)
    await fault?.('after_receipt')
    return { receipt: signedReceipt, reconciled }
  }

  async #writeEvidence(
    dispatch: EffectRelayDispatch,
    phase: 'before' | 'after',
    state: MarkerTargetState,
    now: string
  ) {
    const body = Buffer.from(canonicalJson(state), 'utf8')
    const objectKey = `${dispatch.dispatchId}-${phase}`
    const grant = this.#evidenceStore.issueGrant(
      {
        tenantId: dispatch.tenantId,
        objectKey,
        sha256: sha256Text(body),
        bytes: body.byteLength,
        mediaType: 'application/json',
        expiresAt: dispatch.expiresAt
      },
      this.#evidenceGrantKeyId,
      this.#evidenceGrantPrivateKey
    )
    return this.#evidenceStore.put(grant, dispatch.tenantId, body, now)
  }

  #assertDispatchBinding(dispatch: EffectRelayDispatch, capability: CapabilityEnvelopeV2): void {
    if (
      capability.tenantId !== dispatch.tenantId ||
      capability.effectId !== dispatch.effectId ||
      capability.intentDigest !== sha256Text(canonicalJson(dispatch.intent)) ||
      capability.policyDecisionId !== dispatch.policyDecision.id ||
      capability.parameterDigest !== dispatch.intent.parameterDigest ||
      capability.adapterName !== POSTGRES_MARKER_ADAPTER.name ||
      capability.adapterVersion !== POSTGRES_MARKER_ADAPTER.version ||
      capability.adapterMethod !== POSTGRES_MARKER_ADAPTER.method ||
      capability.runnerDigest !== MARKER_RUNNER_DIGEST ||
      capability.workload.fence !== dispatch.intent.authority.fence
    ) {
      throw new TypeError('Dispatch, intent, policy, capability, and runner are not exactly bound')
    }
  }
}
