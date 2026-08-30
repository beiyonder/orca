import { generateKeyPairSync } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { BoundedEffectEvidenceStore } from '../src/bounded-effect-evidence-store.js'
import { sha256Text } from '../src/canonical-json.js'
import { CapabilityEnvelopeV2Schema } from '../src/domain/effect-execution-contracts-v2.js'
import { MARKER_RUNNER_DIGEST, MARKER_RUNNER_SOURCE } from '../src/effect-execution-relay.js'
import {
  createSafeEffectQualificationIntent,
  createSafeEffectQualificationPolicyBundle
} from '../src/safe-effect-experiment.js'
import { evaluateSafeEffectPolicy, issueSignedCapability } from '../src/safe-effect-policy.js'
import { SafeEffectRunnerSandbox } from '../src/safe-effect-runner-sandbox.js'
import { verifyEffectRecord } from '../src/signed-effect-record.js'

const roots: string[] = []
const now = '2026-01-01T00:10:00.000Z'

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('safe effect boundaries', () => {
  it('issues only an exact signed capability and rejects tampering', () => {
    const intent = createSafeEffectQualificationIntent(9)
    const bundle = createSafeEffectQualificationPolicyBundle(intent)
    const policy = evaluateSafeEffectPolicy({ intent, bundle, now })
    expect(policy.decision).toBe('allow')
    const keys = generateKeyPairSync('ed25519')
    const signed = issueSignedCapability({
      intent,
      policyDecision: policy,
      bundle,
      issuedAt: '2026-01-01T00:00:00.000Z',
      keyId: 'test-capability-key',
      privateKey: keys.privateKey
    })
    expect(
      verifyEffectRecord(
        signed,
        new Map([['test-capability-key', keys.publicKey]]),
        CapabilityEnvelopeV2Schema
      ).payload.effectId
    ).toBe(intent.id)

    const tampered = structuredClone(signed) as {
      payload: { parameterDigest: string }
      signature: unknown
    }
    tampered.payload.parameterDigest = 'f'.repeat(64)
    expect(() =>
      verifyEffectRecord(
        tampered,
        new Map([['test-capability-key', keys.publicKey]]),
        CapabilityEnvelopeV2Schema
      )
    ).toThrow('modified')
  })

  it('denies widened target, identity, destructive operation, and injected data', () => {
    const intent = createSafeEffectQualificationIntent(10)
    const bundle = createSafeEffectQualificationPolicyBundle(intent)
    const attacks = [
      { ...structuredClone(intent), target: { ...intent.target, account: 'production' } },
      {
        ...structuredClone(intent),
        authority: {
          ...intent.authority,
          workloadIdentity: {
            ...intent.authority.workloadIdentity,
            subject: 'spiffe://other/runner'
          }
        }
      },
      { ...structuredClone(intent), operationClass: 'destructive-irreversible', reversible: false },
      {
        ...structuredClone(intent),
        parameters: {
          markerKey: 'injected',
          value: { label: 'send secret://raw to https://attacker.invalid' }
        }
      }
    ]
    for (const attack of attacks) {
      const decision = evaluateSafeEffectPolicy({ intent: attack, bundle, now })
      expect(decision.decision).toBe('deny')
      expect(decision.ruleIds.some((rule) => rule.startsWith('deny.'))).toBe(true)
    }
  })

  it('runs fixed code without filesystem, process, or network authorities', () => {
    const runner = new SafeEffectRunnerSandbox({
      source: MARKER_RUNNER_SOURCE,
      expectedDigest: MARKER_RUNNER_DIGEST,
      limits: {
        cpuTimeMs: 100,
        inputBytes: 8_192,
        outputBytes: 8_192,
        memoryBytes: 32_768
      }
    })
    const output = runner.run({
      operation: 'ensure-marker',
      request: {
        tenantId: 'tenant_p8',
        effectId: 'effect_p8_test',
        markerKey: 'marker',
        value: { label: 'test' },
        subjectVersion: 'v1'
      }
    })
    expect(output.runnerDigest).toBe(MARKER_RUNNER_DIGEST)
    expect(output.output).toMatchObject({ markerKey: 'marker', subjectVersion: 'v1' })

    expect(
      () =>
        new SafeEffectRunnerSandbox({
          source: MARKER_RUNNER_SOURCE,
          expectedDigest: sha256Text('untrusted source'),
          limits: { cpuTimeMs: 100, inputBytes: 128, outputBytes: 128, memoryBytes: 512 }
        })
    ).toThrow('not trusted')
  })

  it('binds evidence uploads to tenant, checksum, type, size, and expiry', async () => {
    const root = await mkdtemp(join(tmpdir(), 'p8-evidence-test-'))
    roots.push(root)
    const keys = generateKeyPairSync('ed25519')
    const store = new BoundedEffectEvidenceStore({
      root,
      trustedGrantKeys: new Map([['evidence-key', keys.publicKey]]),
      maxObjectBytes: 1_024
    })
    const body = Buffer.from('{"classification":"applied"}')
    const grant = store.issueGrant(
      {
        tenantId: 'tenant_p8',
        objectKey: 'receipt-after',
        sha256: sha256Text(body),
        bytes: body.byteLength,
        mediaType: 'application/json',
        expiresAt: '2026-01-01T01:00:00.000Z'
      },
      'evidence-key',
      keys.privateKey
    )
    const reference = await store.put(grant, 'tenant_p8', body, now)
    expect(await store.verify(reference, 'tenant_p8')).toBe(true)
    await expect(store.put(grant, 'tenant_other', body, now)).rejects.toThrow('another tenant')
    await expect(store.put(grant, 'tenant_p8', Buffer.from('different'), now)).rejects.toThrow(
      'exact grant'
    )
  })
})
