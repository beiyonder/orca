import { canonicalJson } from './canonical-json.js'
import {
  CapabilityEnvelopeV1Schema,
  PolicyDecisionV1Schema,
  type CapabilityEnvelopeV1,
  type PolicyDecisionV1
} from './domain/effect-contracts.js'

export type ActiveToolAttempt = {
  tenantId: string
  missionId: string
  assignmentId: string
  attemptId: string
  fence: number
  status: 'running' | 'cancelled' | 'terminal'
}

export type HostToolReference = {
  name: string
  version: string
  schemaDigest: string
  approval: 'read' | 'write' | 'exec'
}

export type HostToolReservationInput = {
  now: string
  tool: HostToolReference
  parameterDigest: string
}

export type HostToolReservation = {
  effectId: string
  capabilityEnvelopeId: string
  policyDecisionId: string
  use: number
}

export type OmpHostToolAuthorityInput = {
  attempt: ActiveToolAttempt
  capabilityEnvelope: unknown
  policyDecision: unknown
}

export class HostToolAuthorityError extends Error {
  readonly code: string

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'HostToolAuthorityError'
    this.code = code
  }
}

function failure(code: string, message: string, cause?: unknown): HostToolAuthorityError {
  return new HostToolAuthorityError(code, message, cause === undefined ? undefined : { cause })
}

function sameJson(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right)
}

function parseTime(value: string, label: string): number {
  const milliseconds = Date.parse(value)
  if (!Number.isFinite(milliseconds)) {
    throw failure('invalid_time', `${label} is invalid`)
  }
  return milliseconds
}

export class OmpHostToolAuthority {
  readonly #attempt: ActiveToolAttempt
  readonly #envelope: CapabilityEnvelopeV1
  readonly #policy: PolicyDecisionV1
  #uses = 0
  #cancelledAt: string | null = null
  #revokedAt: string | null = null

  constructor(input: OmpHostToolAuthorityInput) {
    this.#attempt = { ...input.attempt }
    try {
      this.#envelope = CapabilityEnvelopeV1Schema.parse(input.capabilityEnvelope)
      this.#policy = PolicyDecisionV1Schema.parse(input.policyDecision)
    } catch (error) {
      throw failure('invalid_authority', 'Capability or policy authority is invalid', error)
    }
    this.#assertStaticBinding()
  }

  get uses(): number {
    return this.#uses
  }

  get cancelledAt(): string | null {
    return this.#cancelledAt
  }

  get revokedAt(): string | null {
    return this.#revokedAt ?? this.#envelope.revokedAt
  }

  #assertStaticBinding(): void {
    const envelope = this.#envelope
    const policy = this.#policy
    const attempt = this.#attempt
    if (
      envelope.tenantId !== attempt.tenantId ||
      envelope.missionId !== attempt.missionId ||
      envelope.workload.assignmentId !== attempt.assignmentId ||
      envelope.workload.attemptId !== attempt.attemptId ||
      envelope.workload.fence !== attempt.fence
    ) {
      throw failure('capability_binding_mismatch', 'Capability is not bound to this attempt')
    }
    if (
      policy.tenantId !== attempt.tenantId ||
      policy.missionId !== attempt.missionId ||
      envelope.effectId !== policy.effectId ||
      envelope.intentDigest !== policy.intentDigest ||
      envelope.policyDecisionId !== policy.id
    ) {
      throw failure('policy_binding_mismatch', 'Policy is not bound to this capability')
    }
    const grant = policy.grant
    if (policy.decision !== 'allow' || grant === null) {
      throw failure('policy_denied', 'Policy does not allow the capability')
    }
    if (
      !sameJson(envelope.target, grant.target) ||
      envelope.adapterName !== grant.adapterName ||
      envelope.adapterMethod !== grant.adapterMethod ||
      envelope.parameterDigest !== grant.parameterDigest
    ) {
      throw failure('grant_binding_mismatch', 'Policy grant differs from the capability')
    }
  }

  reserve(input: HostToolReservationInput): HostToolReservation {
    const now = parseTime(input.now, 'Reservation time')
    if (this.#attempt.status !== 'running' || this.#cancelledAt !== null) {
      throw failure('attempt_not_active', 'Attempt is not active')
    }
    if (this.revokedAt !== null) {
      throw failure('capability_revoked', 'Capability is revoked')
    }
    if (now >= parseTime(this.#envelope.expiresAt, 'Capability expiry')) {
      throw failure('capability_expired', 'Capability is expired')
    }
    if (now >= parseTime(this.#policy.expiresAt, 'Policy expiry')) {
      throw failure('policy_expired', 'Policy decision is expired')
    }
    const grant = this.#policy.grant!
    if (now >= parseTime(grant.expiresAt, 'Policy grant expiry')) {
      throw failure('policy_expired', 'Policy grant is expired')
    }
    const allowedTools = this.#envelope.allowedTools.filter((tool) => tool.name === input.tool.name)
    if (
      allowedTools.length !== 1 ||
      allowedTools[0]!.version !== input.tool.version ||
      allowedTools[0]!.schemaDigest !== input.tool.schemaDigest ||
      allowedTools[0]!.approval !== input.tool.approval ||
      !grant.toolNames.includes(input.tool.name)
    ) {
      throw failure('tool_not_allowed', 'Tool is not in the current capability and policy grant')
    }
    if (input.parameterDigest !== this.#envelope.parameterDigest) {
      throw failure('parameter_mismatch', 'Tool arguments differ from the authorized parameters')
    }
    const useLimit = Math.min(
      this.#envelope.maxUses,
      grant.maxUses,
      this.#envelope.budget.toolCallLimit
    )
    if (this.#uses >= useLimit) {
      throw failure('tool_budget_exhausted', 'Tool use budget is exhausted')
    }
    this.#uses += 1
    return {
      effectId: this.#envelope.effectId,
      capabilityEnvelopeId: this.#envelope.id,
      policyDecisionId: this.#policy.id,
      use: this.#uses
    }
  }

  acknowledgeCancellation(at: string): boolean {
    parseTime(at, 'Cancellation acknowledgement')
    if (this.#cancelledAt !== null) {
      return false
    }
    this.#cancelledAt = at
    this.#attempt.status = 'cancelled'
    return true
  }

  revoke(at: string): boolean {
    parseTime(at, 'Revocation acknowledgement')
    if (this.revokedAt !== null) {
      return false
    }
    this.#revokedAt = at
    return true
  }
}
