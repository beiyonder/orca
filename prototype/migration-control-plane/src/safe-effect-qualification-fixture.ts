import { generateKeyPairSync, type KeyObject } from 'node:crypto'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Pool } from 'pg'
import { BoundedEffectEvidenceStore } from './bounded-effect-evidence-store.js'
import type {
  CapabilityEnvelopeV2,
  EffectIntentV2,
  PolicyDecisionV2
} from './domain/effect-execution-contracts-v2.js'
import { SecretLeaseV1Schema, type SecretLeaseV1 } from './domain/effect-contracts.js'
import { EffectExecutionRelay } from './effect-execution-relay.js'
import {
  EffectRelayDispatchSchema,
  EffectRelayGateway,
  type EffectRelayDispatch,
  type EffectRelayGatewayOptions,
  type RelaySession
} from './effect-relay-gateway.js'
import {
  PostgresMarkerTargetAdapter,
  type MarkerEffectRequest
} from './postgres-marker-target-adapter.js'
import {
  SAFE_EFFECT_CAPABILITY_KEY_ID,
  SAFE_EFFECT_CREATED_AT,
  SAFE_EFFECT_EXPIRES_AT,
  SAFE_EFFECT_NOW,
  SAFE_EFFECT_RECEIPT_KEY_ID,
  SAFE_EFFECT_RELAY_ID,
  SAFE_EFFECT_RELAY_KEY_ID,
  SAFE_EFFECT_TENANT_ID,
  createSafeEffectQualificationIntent,
  createSafeEffectQualificationPolicyBundle
} from './safe-effect-qualification-contracts.js'
import {
  evaluateSafeEffectPolicy,
  issueSignedCapability,
  type SafeEffectPolicyBundle
} from './safe-effect-policy.js'
import { signEffectRecord, type SignedEffectRecord } from './signed-effect-record.js'

export type SafeEffectFixtureKeys = {
  capability: { publicKey: KeyObject; privateKey: KeyObject }
  relay: { publicKey: KeyObject; privateKey: KeyObject }
  receipt: { publicKey: KeyObject; privateKey: KeyObject }
}

export type SafeEffectFixture = {
  intent: EffectIntentV2
  policyBundle: SafeEffectPolicyBundle
  policyDecision: PolicyDecisionV2
  capability: SignedEffectRecord<CapabilityEnvelopeV2>
  secretLease: SignedEffectRecord<SecretLeaseV1>
  dispatch: EffectRelayDispatch
  signedDispatch: SignedEffectRecord<EffectRelayDispatch>
  request: MarkerEffectRequest
}

export type SafeEffectHarness = {
  root: string
  pool: Pool
  adapter: PostgresMarkerTargetAdapter
  keys: SafeEffectFixtureKeys
  gatewayOptions: EffectRelayGatewayOptions
  gateway: EffectRelayGateway
  evidenceStore: BoundedEffectEvidenceStore
  relay: EffectExecutionRelay
  session: RelaySession
}

function createKeys(): SafeEffectFixtureKeys {
  return {
    capability: generateKeyPairSync('ed25519'),
    relay: generateKeyPairSync('ed25519'),
    receipt: generateKeyPairSync('ed25519')
  }
}

export function createSafeEffectFixture(
  index: number,
  keys: SafeEffectFixtureKeys
): SafeEffectFixture {
  const intent = createSafeEffectQualificationIntent(index)
  const policyBundle = createSafeEffectQualificationPolicyBundle(intent)
  const policyDecision = evaluateSafeEffectPolicy({
    intent,
    bundle: policyBundle,
    now: SAFE_EFFECT_NOW
  })
  if (policyDecision.decision !== 'allow') {
    throw new TypeError('Qualification fixture was denied')
  }
  const leaseId = `secret_lease_p8_${index}`
  const secretLeasePayload = SecretLeaseV1Schema.parse({
    schemaVersion: 1,
    kind: 'secret-lease',
    id: leaseId,
    tenantId: intent.tenantId,
    missionId: intent.missionId,
    createdAt: SAFE_EFFECT_CREATED_AT,
    effectId: intent.id,
    secretReference: 'secret://migration-lab/postgres-marker',
    recipient: {
      assignmentId: intent.authority.assignmentId,
      attemptId: intent.authority.attemptId,
      fence: intent.authority.fence,
      audience: intent.authority.workloadIdentity.audience
    },
    target: intent.target,
    scopes: ['postgresql:marker-write'],
    issuedAt: SAFE_EFFECT_CREATED_AT,
    expiresAt: SAFE_EFFECT_EXPIRES_AT,
    maxUses: 1,
    revokedAt: null
  })
  const secretLease = signEffectRecord(
    secretLeasePayload,
    SAFE_EFFECT_CAPABILITY_KEY_ID,
    keys.capability.privateKey
  )
  const capability = issueSignedCapability({
    intent,
    policyDecision,
    bundle: policyBundle,
    issuedAt: SAFE_EFFECT_CREATED_AT,
    keyId: SAFE_EFFECT_CAPABILITY_KEY_ID,
    privateKey: keys.capability.privateKey,
    secretLeaseIds: [leaseId]
  })
  const dispatch = EffectRelayDispatchSchema.parse({
    relayId: SAFE_EFFECT_RELAY_ID,
    tenantId: intent.tenantId,
    sequence: index + 1,
    dispatchId: `dispatch_p8_${index}`,
    effectId: intent.id,
    intent,
    policyDecision,
    capability,
    secretLease,
    createdAt: SAFE_EFFECT_CREATED_AT,
    expiresAt: SAFE_EFFECT_EXPIRES_AT
  })
  return {
    intent,
    policyBundle,
    policyDecision,
    capability,
    secretLease,
    dispatch,
    signedDispatch: signEffectRecord(
      dispatch,
      SAFE_EFFECT_CAPABILITY_KEY_ID,
      keys.capability.privateKey
    ),
    request: {
      tenantId: intent.tenantId,
      effectId: intent.id,
      markerKey: `p8-marker-${index}`,
      value: { label: `qualified marker ${index}` },
      subjectVersion: intent.authority.subjectVersion
    }
  }
}

export async function createSafeEffectHarness(
  connectionString: string
): Promise<SafeEffectHarness> {
  const root = await mkdtemp(join(tmpdir(), 'orca-p8-safe-effect-'))
  const pool = new Pool({ connectionString, max: 4 })
  const adapter = new PostgresMarkerTargetAdapter(pool)
  await adapter.initializeLabTarget()
  const keys = createKeys()
  const capabilityKeys = new Map([[SAFE_EFFECT_CAPABILITY_KEY_ID, keys.capability.publicKey]])
  const gatewayOptions: EffectRelayGatewayOptions = {
    root: join(root, 'spool'),
    relayId: SAFE_EFFECT_RELAY_ID,
    tenantId: SAFE_EFFECT_TENANT_ID,
    trustedRelayKeys: new Map([[SAFE_EFFECT_RELAY_KEY_ID, keys.relay.publicKey]]),
    trustedDispatchKeys: capabilityKeys,
    maxPendingItems: 64,
    maxFrameBytes: 256 * 1024
  }
  const gateway = new EffectRelayGateway(gatewayOptions)
  const signedSession = signEffectRecord(
    {
      relayId: SAFE_EFFECT_RELAY_ID,
      tenantId: SAFE_EFFECT_TENANT_ID,
      audience: 'migration-control-effect-relay',
      sessionNonce: 'p8-session-1',
      expiresAt: SAFE_EFFECT_EXPIRES_AT
    },
    SAFE_EFFECT_RELAY_KEY_ID,
    keys.relay.privateKey
  )
  const evidenceStore = new BoundedEffectEvidenceStore({
    root: join(root, 'evidence'),
    trustedGrantKeys: new Map([[SAFE_EFFECT_RECEIPT_KEY_ID, keys.receipt.publicKey]]),
    maxObjectBytes: 65_536
  })
  const relay = new EffectExecutionRelay({
    gateway,
    adapter,
    evidenceStore,
    trustedCapabilityKeys: capabilityKeys,
    trustedSecretLeaseKeys: capabilityKeys,
    receiptKeyId: SAFE_EFFECT_RECEIPT_KEY_ID,
    receiptPrivateKey: keys.receipt.privateKey,
    evidenceGrantKeyId: SAFE_EFFECT_RECEIPT_KEY_ID,
    evidenceGrantPrivateKey: keys.receipt.privateKey
  })
  return {
    root,
    pool,
    adapter,
    keys,
    gatewayOptions,
    gateway,
    evidenceStore,
    relay,
    session: gateway.authenticate(signedSession, SAFE_EFFECT_NOW)
  }
}

export function restartSafeEffectRelay(harness: SafeEffectHarness): {
  gateway: EffectRelayGateway
  relay: EffectExecutionRelay
} {
  const gateway = new EffectRelayGateway(harness.gatewayOptions)
  const capabilityKeys = new Map([
    [SAFE_EFFECT_CAPABILITY_KEY_ID, harness.keys.capability.publicKey]
  ])
  return {
    gateway,
    relay: new EffectExecutionRelay({
      gateway,
      adapter: harness.adapter,
      evidenceStore: harness.evidenceStore,
      trustedCapabilityKeys: capabilityKeys,
      trustedSecretLeaseKeys: capabilityKeys,
      receiptKeyId: SAFE_EFFECT_RECEIPT_KEY_ID,
      receiptPrivateKey: harness.keys.receipt.privateKey,
      evidenceGrantKeyId: SAFE_EFFECT_RECEIPT_KEY_ID,
      evidenceGrantPrivateKey: harness.keys.receipt.privateKey
    })
  }
}
