import type { KeyObject } from 'node:crypto'
import { canonicalJson, sha256Text } from './canonical-json.js'
import {
  CapabilityEnvelopeV2Schema,
  EffectIntentV2Schema,
  PolicyDecisionV2Schema,
  type CapabilityEnvelopeV2,
  type EffectIntentV2,
  type PolicyDecisionV2
} from './domain/effect-execution-contracts-v2.js'
import { signEffectRecord, type SignedEffectRecord } from './signed-effect-record.js'

export type SafeEffectPolicyBundle = {
  version: string
  tenantId: string
  policyEngineId: string
  allowedAdapter: { name: string; version: string; method: string }
  allowedTarget: EffectIntentV2['target']
  allowedSkill: { name: string; version: string; digest: string }
  allowedWorkload: { issuer: string; subject: string; audience: string }
  runnerDigest: string
  maxBudget: EffectIntentV2['budget']
}

export type EffectPolicyEvaluationInput = {
  intent: unknown
  bundle: SafeEffectPolicyBundle
  now: string
}

function budgetWithinLimit(
  requested: EffectIntentV2['budget'],
  maximum: EffectIntentV2['budget']
): boolean {
  return (
    requested.tokenLimit <= maximum.tokenLimit &&
    requested.timeLimitMs <= maximum.timeLimitMs &&
    requested.toolCallLimit <= maximum.toolCallLimit &&
    requested.outputByteLimit <= maximum.outputByteLimit &&
    requested.costLimitUsd <= maximum.costLimitUsd
  )
}

function collectDenials(
  intent: EffectIntentV2,
  bundle: SafeEffectPolicyBundle,
  now: string
): string[] {
  const failures: string[] = []
  const authority = intent.authority
  if (intent.tenantId !== bundle.tenantId) failures.push('tenant')
  if (canonicalJson(intent.target) !== canonicalJson(bundle.allowedTarget)) failures.push('target')
  if (
    intent.adapter.name !== bundle.allowedAdapter.name ||
    intent.adapter.version !== bundle.allowedAdapter.version ||
    intent.adapter.method !== bundle.allowedAdapter.method
  ) {
    failures.push('adapter')
  }
  if (canonicalJson(authority.skill) !== canonicalJson(bundle.allowedSkill)) failures.push('skill')
  if (
    authority.workloadIdentity.issuer !== bundle.allowedWorkload.issuer ||
    authority.workloadIdentity.subject !== bundle.allowedWorkload.subject ||
    authority.workloadIdentity.audience !== bundle.allowedWorkload.audience
  ) {
    failures.push('identity')
  }
  if (!budgetWithinLimit(intent.budget, bundle.maxBudget)) failures.push('budget')
  if (Date.parse(now) >= Date.parse(intent.expiresAt)) failures.push('expiry')
  if (intent.operationClass !== 'declarative-ensure') failures.push('operation_class')
  if (intent.idempotency.kind !== 'natural-key' || intent.idempotency.key === null) {
    failures.push('idempotency')
  }
  if (
    intent.recovery.strategy !== 'read-reconcile' ||
    intent.recovery.inspectionMethod !== 'inspect-marker' ||
    intent.recovery.blindRetryAllowed
  ) {
    failures.push('recovery')
  }
  if (intent.blastRadius.targetCount !== 1 || intent.blastRadius.maxChangedRows !== 1) {
    failures.push('blast_radius')
  }
  if (intent.dataClasses.some((dataClass) => dataClass !== 'synthetic')) {
    failures.push('data_class')
  }
  const parameters = intent.parameters
  const markerParametersValid =
    typeof parameters === 'object' &&
    parameters !== null &&
    !Array.isArray(parameters) &&
    typeof parameters.markerKey === 'string' &&
    /^[A-Za-z0-9_.-]{1,128}$/.test(parameters.markerKey) &&
    typeof parameters.value === 'object' &&
    parameters.value !== null &&
    !Array.isArray(parameters.value) &&
    typeof parameters.value.label === 'string' &&
    /^[A-Za-z0-9 ._-]{1,128}$/.test(parameters.value.label) &&
    Object.keys(parameters).length === 2 &&
    Object.keys(parameters.value).length === 1
  if (!markerParametersValid || sha256Text(canonicalJson(parameters)) !== intent.parameterDigest) {
    failures.push('parameters')
  }
  if (
    canonicalJson(intent.expectedPreState) !== canonicalJson({ classification: 'absent' }) ||
    canonicalJson(intent.desiredPostState) !== canonicalJson(parameters)
  ) {
    failures.push('expected_state')
  }
  if (
    canonicalJson(intent.allowedNetworkDestinations) !==
      canonicalJson(['postgresql://migration-lab-target']) ||
    canonicalJson(intent.requiredSecretScopes) !== canonicalJson(['postgresql:marker-write'])
  ) {
    failures.push('scope')
  }
  if (
    intent.requiredTools.length !== 1 ||
    intent.requiredTools[0]?.name !== 'postgres_marker_ensure' ||
    intent.requiredTools[0].approval !== 'write'
  ) {
    failures.push('tool')
  }
  return failures
}

export function evaluateSafeEffectPolicy(input: EffectPolicyEvaluationInput): PolicyDecisionV2 {
  const intent = EffectIntentV2Schema.parse(input.intent)
  const failures = collectDenials(intent, input.bundle, input.now)
  const intentDigest = sha256Text(canonicalJson(intent))
  const bundleDigest = sha256Text(canonicalJson(input.bundle))
  const structuredInputDigest = sha256Text(
    canonicalJson({ intentDigest, bundleDigest, now: input.now })
  )
  const expiresAt = intent.expiresAt
  const decision = {
    schemaVersion: 2,
    kind: 'policy-decision',
    id: `policy_${structuredInputDigest.slice(0, 24)}`,
    tenantId: intent.tenantId,
    missionId: intent.missionId,
    createdAt: input.now,
    effectId: intent.id,
    intentDigest,
    policyBundleVersion: input.bundle.version,
    policyBundleDigest: bundleDigest,
    structuredInputDigest,
    decision: failures.length === 0 ? 'allow' : 'deny',
    grant:
      failures.length === 0
        ? {
            target: intent.target,
            adapterName: intent.adapter.name,
            adapterVersion: intent.adapter.version,
            adapterMethod: intent.adapter.method,
            parameterDigest: intent.parameterDigest,
            expectedPreStateDigest: sha256Text(canonicalJson(intent.expectedPreState)),
            subjectVersion: intent.authority.subjectVersion,
            runnerDigest: input.bundle.runnerDigest,
            toolNames: intent.requiredTools.map((tool) => tool.name),
            networkDestinations: intent.allowedNetworkDestinations,
            secretScopes: intent.requiredSecretScopes,
            budget: intent.budget,
            maxUses: 1,
            expiresAt
          }
        : null,
    obligations: ['Persist request journal before send.', 'Reconcile unknown without blind retry.'],
    ruleIds:
      failures.length === 0 ? ['safe-effect.v2.allow'] : failures.map((item) => `deny.${item}`),
    reasons:
      failures.length === 0
        ? ['Exact non-production declarative marker effect is authorized.']
        : failures.map((item) => `Policy predicate failed: ${item}.`),
    decidedBy: { kind: 'system', id: input.bundle.policyEngineId, version: input.bundle.version },
    expiresAt
  }
  return PolicyDecisionV2Schema.parse(decision)
}

export type IssueCapabilityInput = {
  intent: unknown
  policyDecision: unknown
  bundle: SafeEffectPolicyBundle
  issuedAt: string
  keyId: string
  privateKey: KeyObject
  secretLeaseIds?: string[]
}

export function issueSignedCapability(
  input: IssueCapabilityInput
): SignedEffectRecord<CapabilityEnvelopeV2> {
  const intent = EffectIntentV2Schema.parse(input.intent)
  const policy = PolicyDecisionV2Schema.parse(input.policyDecision)
  if (policy.decision !== 'allow' || policy.grant === null) {
    throw new TypeError('Denied policy cannot issue a capability')
  }
  if (policy.intentDigest !== sha256Text(canonicalJson(intent))) {
    throw new TypeError('Policy decision does not bind the supplied intent')
  }
  const digest = sha256Text(canonicalJson({ effectId: intent.id, policyDecisionId: policy.id }))
  const envelope = CapabilityEnvelopeV2Schema.parse({
    schemaVersion: 2,
    kind: 'capability-envelope',
    id: `envelope_${digest.slice(0, 24)}`,
    tenantId: intent.tenantId,
    missionId: intent.missionId,
    createdAt: input.issuedAt,
    effectId: intent.id,
    intentDigest: policy.intentDigest,
    policyDecisionId: policy.id,
    workload: {
      assignmentId: intent.authority.assignmentId,
      attemptId: intent.authority.attemptId,
      fence: intent.authority.fence,
      ...intent.authority.workloadIdentity
    },
    target: intent.target,
    adapterName: intent.adapter.name,
    adapterVersion: intent.adapter.version,
    adapterMethod: intent.adapter.method,
    parameterDigest: intent.parameterDigest,
    expectedPreStateDigest: sha256Text(canonicalJson(intent.expectedPreState)),
    subjectVersion: intent.authority.subjectVersion,
    runnerDigest: input.bundle.runnerDigest,
    allowedTools: intent.requiredTools,
    allowedNetworkDestinations: intent.allowedNetworkDestinations,
    dataClasses: intent.dataClasses,
    secretLeaseIds: input.secretLeaseIds ?? [],
    budget: intent.budget,
    maxUses: 1,
    issuedAt: input.issuedAt,
    expiresAt: intent.expiresAt,
    revokedAt: null
  })
  return signEffectRecord(envelope, input.keyId, input.privateKey)
}
