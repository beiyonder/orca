import { canonicalJson } from './canonical-json.js'
import {
  EffectAttemptV1Schema,
  EffectReceiptV1Schema,
  TargetObservationV1Schema,
  type EffectAttemptV1,
  type EffectReceiptV1,
  type TargetObservationV1
} from './domain/effect-contracts.js'

export type EffectStatus = EffectAttemptV1['state']['status']

const EFFECT_TRANSITIONS: Readonly<Record<EffectStatus, readonly EffectStatus[]>> = {
  prepared: ['issued'],
  issued: ['applied', 'absent', 'unknown', 'failed'],
  applied: ['evaluating'],
  absent: [],
  unknown: ['reconciling'],
  failed: [],
  reconciling: ['applied', 'absent', 'unknown', 'failed'],
  evaluating: ['accepted', 'rejected'],
  accepted: [],
  rejected: []
}

export type EffectAttemptTransitionInput = {
  current: unknown
  next: unknown
  receipt?: unknown
  observation?: unknown
  latestReceipt: unknown
}

export type ValidatedEffectAttemptTransition = {
  next: EffectAttemptV1
  evidence: EffectTransitionEvidence
}

export type EffectTransitionEvidence = {
  receipt: EffectReceiptV1 | null
  observation: TargetObservationV1 | null
}

export class EffectStateTransitionError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'EffectStateTransitionError'
    this.code = code
  }
}

export class StaleEffectFenceError extends Error {
  constructor(effectId: string, effectAttemptId: string, fence: number) {
    super(`Effect attempt is stale for ${effectId}: ${effectAttemptId} fence ${fence}`)
    this.name = 'StaleEffectFenceError'
  }
}

function fail(code: string, message: string): never {
  throw new EffectStateTransitionError(code, message)
}

function immutableEffectAttempt(attempt: EffectAttemptV1): string {
  return canonicalJson({
    schemaVersion: attempt.schemaVersion,
    kind: attempt.kind,
    id: attempt.id,
    tenantId: attempt.tenantId,
    missionId: attempt.missionId,
    createdAt: attempt.createdAt,
    effectId: attempt.effectId,
    attemptNumber: attempt.attemptNumber,
    fence: attempt.fence,
    capabilityEnvelopeId: attempt.capabilityEnvelopeId,
    adapterName: attempt.adapterName,
    adapterVersion: attempt.adapterVersion,
    runnerDigest: attempt.runnerDigest,
    requestDigest: attempt.requestDigest,
    idempotencyKeyHash: attempt.idempotencyKeyHash,
    preRequestJournal: attempt.preRequestJournal
  })
}

export function effectAttemptCompletedAt(attempt: EffectAttemptV1): string | null {
  if (attempt.state.status === 'accepted' || attempt.state.status === 'rejected') {
    return attempt.state.completedAt
  }
  if (
    attempt.state.status === 'applied' ||
    attempt.state.status === 'absent' ||
    attempt.state.status === 'failed'
  ) {
    return attempt.state.settledAt
  }
  if (attempt.state.status === 'unknown') {
    return attempt.state.unknownAt
  }
  return null
}

function validateReceipt(
  nextAttempt: EffectAttemptV1,
  receiptInput: unknown,
  expectedStatus: 'applied' | 'absent' | 'failed' | 'unknown'
): EffectReceiptV1 {
  const receipt = EffectReceiptV1Schema.parse(receiptInput)
  if (
    receipt.effectId !== nextAttempt.effectId ||
    receipt.attemptId !== nextAttempt.id ||
    receipt.fence !== nextAttempt.fence ||
    receipt.status !== expectedStatus
  ) {
    fail('receipt_mismatch', 'Effect receipt does not match effect attempt authority')
  }
  if (
    nextAttempt.state.status !== 'unknown' &&
    'receiptId' in nextAttempt.state &&
    nextAttempt.state.receiptId !== receipt.id
  ) {
    fail('receipt_mismatch', 'Effect attempt references a different receipt')
  }
  return receipt
}

function validateObservation(
  nextAttempt: EffectAttemptV1,
  observationInput: unknown
): TargetObservationV1 {
  const observation = TargetObservationV1Schema.parse(observationInput)
  if (observation.effectId !== nextAttempt.effectId) {
    fail('observation_mismatch', 'Target observation belongs to another effect')
  }
  if (
    nextAttempt.state.status === 'reconciling' &&
    !nextAttempt.state.observationIds.includes(observation.id)
  ) {
    fail('observation_mismatch', 'Reconciling state does not reference target observation')
  }
  return observation
}

export function validateEffectAttemptTransition(
  input: EffectAttemptTransitionInput
): ValidatedEffectAttemptTransition {
  const current = EffectAttemptV1Schema.parse(input.current)
  const next = EffectAttemptV1Schema.parse(input.next)
  if (immutableEffectAttempt(current) !== immutableEffectAttempt(next)) {
    fail('effect_attempt_identity_changed', 'Effect attempt immutable fields changed')
  }
  if (!EFFECT_TRANSITIONS[current.state.status].includes(next.state.status)) {
    fail(
      'invalid_effect_transition',
      `Effect cannot transition from ${current.state.status} to ${next.state.status}`
    )
  }

  let receipt: EffectReceiptV1 | null = null
  if (
    next.state.status === 'applied' ||
    next.state.status === 'absent' ||
    next.state.status === 'failed'
  ) {
    receipt = validateReceipt(next, input.receipt, next.state.status)
  } else if (next.state.status === 'unknown' && input.receipt !== undefined) {
    receipt = validateReceipt(next, input.receipt, 'unknown')
  }
  const observation =
    next.state.status === 'reconciling' ? validateObservation(next, input.observation) : null
  const latestReceipt =
    receipt ??
    (input.latestReceipt === null ? null : EffectReceiptV1Schema.parse(input.latestReceipt))
  if (
    (next.state.status === 'evaluating' ||
      next.state.status === 'accepted' ||
      next.state.status === 'rejected') &&
    (!latestReceipt || next.state.receiptId !== latestReceipt.id)
  ) {
    fail('receipt_mismatch', 'Effect evaluation must retain the settled receipt identity')
  }
  return { next, evidence: { receipt, observation } }
}
