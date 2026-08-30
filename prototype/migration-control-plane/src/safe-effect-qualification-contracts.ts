import { canonicalJson, sha256Text } from './canonical-json.js'
import {
  EffectIntentV2Schema,
  type EffectIntentV2
} from './domain/effect-execution-contracts-v2.js'
import { POSTGRES_MARKER_ADAPTER } from './postgres-marker-target-adapter.js'
import type { SafeEffectPolicyBundle } from './safe-effect-policy.js'
import { MARKER_RUNNER_DIGEST } from './safe-effect-marker-runner.js'

export const SAFE_EFFECT_NOW = '2026-01-01T00:10:00.000Z'
export const SAFE_EFFECT_CREATED_AT = '2026-01-01T00:00:00.000Z'
export const SAFE_EFFECT_EXPIRES_AT = '2026-01-01T01:00:00.000Z'
export const SAFE_EFFECT_RELAY_ID = 'relay_p8'
export const SAFE_EFFECT_TENANT_ID = 'tenant_p8'
export const SAFE_EFFECT_CAPABILITY_KEY_ID = 'p8-capability-ed25519'
export const SAFE_EFFECT_RELAY_KEY_ID = 'p8-relay-ed25519'
export const SAFE_EFFECT_RECEIPT_KEY_ID = 'p8-receipt-ed25519'

const TOOL_SCHEMA_DIGEST = sha256Text(
  canonicalJson({ markerKey: 'string', value: { label: 'string' } })
)

export function createSafeEffectQualificationIntent(
  index: number,
  tenantId = SAFE_EFFECT_TENANT_ID
): EffectIntentV2 {
  const effectId = `effect_p8_${index}`
  const markerKey = `p8-marker-${index}`
  const parameters = { markerKey, value: { label: `qualified marker ${index}` } }
  const target = {
    provider: 'postgresql',
    account: 'migration-lab-non-production',
    project: 'migration-control-plane',
    region: null,
    resourceType: 'marker',
    resourceId: markerKey
  }
  return EffectIntentV2Schema.parse({
    schemaVersion: 2,
    kind: 'effect-intent',
    id: effectId,
    tenantId,
    missionId: 'mission_p8',
    createdAt: SAFE_EFFECT_CREATED_AT,
    authority: {
      planRevisionId: 'plan_revision_p8',
      taskId: `task_p8_${index}`,
      assignmentId: `assignment_p8_${index}`,
      attemptId: `attempt_p8_${index}`,
      fence: 1,
      subjectVersion: `marker-subject-${index}-v1`,
      workloadIdentity: {
        issuer: 'spiffe://migration-lab',
        subject: 'spiffe://migration-lab/effect-runner',
        audience: 'postgres-marker-adapter'
      },
      skill: {
        name: 'postgres-marker-ensure',
        version: '1.0.0',
        digest: sha256Text('postgres-marker-ensure@1.0.0')
      }
    },
    operationClass: 'declarative-ensure',
    adapter: {
      name: POSTGRES_MARKER_ADAPTER.name,
      version: POSTGRES_MARKER_ADAPTER.version,
      method: POSTGRES_MARKER_ADAPTER.method
    },
    target,
    parameters,
    parameterDigest: sha256Text(canonicalJson(parameters)),
    expectedPreState: { classification: 'absent' },
    desiredPostState: parameters,
    expectedTargetVersion: `marker-subject-${index}-v1`,
    idempotency: {
      kind: 'natural-key',
      key: `${tenantId}:${markerKey}`,
      retentionExpiresAt: SAFE_EFFECT_EXPIRES_AT,
      parameterDigest: sha256Text(canonicalJson(parameters))
    },
    requiredTools: [
      {
        name: 'postgres_marker_ensure',
        version: '1',
        schemaDigest: TOOL_SCHEMA_DIGEST,
        approval: 'write'
      }
    ],
    allowedNetworkDestinations: ['postgresql://migration-lab-target'],
    requiredSecretScopes: ['postgresql:marker-write'],
    dataClasses: ['synthetic'],
    budget: {
      tokenLimit: 0,
      timeLimitMs: 5_000,
      toolCallLimit: 1,
      outputByteLimit: 65_536,
      costLimitUsd: 0
    },
    blastRadius: { targetCount: 1, maxChangedRows: 1, maxChangedBytes: 4_096 },
    recovery: {
      strategy: 'read-reconcile',
      inspectionMethod: POSTGRES_MARKER_ADAPTER.inspectMethod,
      blindRetryAllowed: false
    },
    expiresAt: SAFE_EFFECT_EXPIRES_AT,
    reversible: true,
    compensationId: null,
    evaluatorContractIds: ['evaluation_contract_p8'],
    evidenceRecordIds: [`evidence_p8_${index}`],
    proposedBy: { kind: 'system', id: 'safe-effect-planner', version: '1' }
  })
}

export function createSafeEffectQualificationPolicyBundle(
  intent: EffectIntentV2
): SafeEffectPolicyBundle {
  return {
    version: 'safe-effect-policy.v2',
    tenantId: intent.tenantId,
    policyEngineId: 'safe-effect-policy',
    allowedAdapter: intent.adapter,
    allowedTarget: intent.target,
    allowedSkill: intent.authority.skill,
    allowedWorkload: intent.authority.workloadIdentity,
    runnerDigest: MARKER_RUNNER_DIGEST,
    maxBudget: intent.budget
  }
}
