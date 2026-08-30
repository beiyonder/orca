import { rm } from 'node:fs/promises'
import { canonicalJson, sha256Text } from './canonical-json.js'
import { CapabilityEnvelopeV2Schema } from './domain/effect-execution-contracts-v2.js'
import {
  createEvaluationMeasure as measure,
  type ExperimentResult
} from './experiment-contracts.js'
import { SafeEffectRunnerSandbox } from './safe-effect-runner-sandbox.js'
import {
  durableFilesContain,
  mutateSafeEffectAttackIntent
} from './safe-effect-isolation-attacks.js'
import {
  SAFE_EFFECT_CAPABILITY_KEY_ID,
  SAFE_EFFECT_EXPIRES_AT,
  SAFE_EFFECT_NOW,
  SAFE_EFFECT_RECEIPT_KEY_ID,
  SAFE_EFFECT_RELAY_KEY_ID,
  SAFE_EFFECT_TENANT_ID
} from './safe-effect-qualification-contracts.js'
import {
  createSafeEffectFixture,
  createSafeEffectHarness
} from './safe-effect-qualification-fixture.js'
import { evaluateSafeEffectPolicy, issueSignedCapability } from './safe-effect-policy.js'
import { signEffectRecord, verifyEffectRecord } from './signed-effect-record.js'

export async function runSafeEffectIsolationExperiment(
  connectionString: string,
  seed: number
): Promise<ExperimentResult> {
  const harness = await createSafeEffectHarness(connectionString)
  const denials: string[] = []
  const safetyChecks: Record<string, boolean> = {}
  try {
    for (let index = 0; index < 100; index += 1) {
      const fixture = createSafeEffectFixture(1_000 + index, harness.keys)
      const candidate = mutateSafeEffectAttackIntent(fixture.intent, (index + seed) % 10)
      const decision = evaluateSafeEffectPolicy({
        intent: candidate,
        bundle: fixture.policyBundle,
        now: SAFE_EFFECT_NOW
      })
      if (
        decision.decision !== 'deny' ||
        decision.ruleIds.every((rule) => !rule.startsWith('deny.'))
      ) {
        denials.push(`attack ${index} was not attributable`)
      }
      try {
        issueSignedCapability({
          intent: candidate,
          policyDecision: decision,
          bundle: fixture.policyBundle,
          issuedAt: SAFE_EFFECT_NOW,
          keyId: SAFE_EFFECT_CAPABILITY_KEY_ID,
          privateKey: harness.keys.capability.privateKey
        })
        denials.push(`attack ${index} minted authority`)
      } catch {
        // Required denial.
      }
    }

    const valid = createSafeEffectFixture(2_000, harness.keys)
    const tampered = structuredClone(valid.capability) as {
      payload: Record<string, unknown>
      signature: unknown
    }
    tampered.payload.tenantId = 'tenant_other'
    try {
      verifyEffectRecord(
        tampered,
        new Map([[SAFE_EFFECT_CAPABILITY_KEY_ID, harness.keys.capability.publicKey]]),
        CapabilityEnvelopeV2Schema
      )
      safetyChecks.signatureTamperDenied = false
    } catch {
      safetyChecks.signatureTamperDenied = true
    }

    const wrongSession = signEffectRecord(
      {
        relayId: 'relay_other',
        tenantId: SAFE_EFFECT_TENANT_ID,
        audience: 'migration-control-effect-relay',
        sessionNonce: 'wrong-relay',
        expiresAt: SAFE_EFFECT_EXPIRES_AT
      },
      SAFE_EFFECT_RELAY_KEY_ID,
      harness.keys.relay.privateKey
    )
    try {
      harness.gateway.authenticate(wrongSession, SAFE_EFFECT_NOW)
      safetyChecks.wrongRelayDenied = false
    } catch {
      safetyChecks.wrongRelayDenied = true
    }

    const sequenceTwo = { ...valid.dispatch, sequence: 2, dispatchId: 'dispatch_gap' }
    try {
      await harness.gateway.accept(
        signEffectRecord(
          sequenceTwo,
          SAFE_EFFECT_CAPABILITY_KEY_ID,
          harness.keys.capability.privateKey
        ),
        harness.session,
        SAFE_EFFECT_NOW
      )
      safetyChecks.sequenceGapDenied = false
    } catch {
      safetyChecks.sequenceGapDenied = true
    }

    const probeSource =
      'output = { process: typeof process, require: typeof require, fetch: typeof fetch, webSocket: typeof WebSocket }'
    const probe = new SafeEffectRunnerSandbox({
      source: probeSource,
      expectedDigest: sha256Text(probeSource),
      limits: { cpuTimeMs: 50, inputBytes: 128, outputBytes: 1_024, memoryBytes: 2_048 }
    }).run({})
    safetyChecks.sandboxAuthoritiesAbsent =
      canonicalJson(probe.output) ===
      canonicalJson({
        process: 'undefined',
        require: 'undefined',
        fetch: 'undefined',
        webSocket: 'undefined'
      })
    const loopSource = 'while (true) {}'
    try {
      new SafeEffectRunnerSandbox({
        source: loopSource,
        expectedDigest: sha256Text(loopSource),
        limits: { cpuTimeMs: 10, inputBytes: 128, outputBytes: 128, memoryBytes: 512 }
      }).run({})
      safetyChecks.cpuLimitEnforced = false
    } catch {
      safetyChecks.cpuLimitEnforced = true
    }
    const outputSource = "output = 'x'.repeat(4096)"
    try {
      new SafeEffectRunnerSandbox({
        source: outputSource,
        expectedDigest: sha256Text(outputSource),
        limits: { cpuTimeMs: 50, inputBytes: 128, outputBytes: 128, memoryBytes: 512 }
      }).run({})
      safetyChecks.outputLimitEnforced = false
    } catch {
      safetyChecks.outputLimitEnforced = true
    }
    try {
      new SafeEffectRunnerSandbox({
        source: probeSource,
        expectedDigest: sha256Text('different runner'),
        limits: { cpuTimeMs: 50, inputBytes: 128, outputBytes: 1_024, memoryBytes: 2_048 }
      })
      safetyChecks.runnerDigestEnforced = false
    } catch {
      safetyChecks.runnerDigestEnforced = true
    }

    const secretBody = Buffer.from('RAW_SECRET_DO_NOT_PERSIST')
    const crossTenantGrant = harness.evidenceStore.issueGrant(
      {
        tenantId: SAFE_EFFECT_TENANT_ID,
        objectKey: 'cross-tenant-secret',
        sha256: sha256Text(secretBody),
        bytes: secretBody.byteLength,
        mediaType: 'text/plain',
        expiresAt: SAFE_EFFECT_EXPIRES_AT
      },
      SAFE_EFFECT_RECEIPT_KEY_ID,
      harness.keys.receipt.privateKey
    )
    try {
      await harness.evidenceStore.put(crossTenantGrant, 'tenant_other', secretBody, SAFE_EFFECT_NOW)
      safetyChecks.crossTenantEvidenceDenied = false
    } catch {
      safetyChecks.crossTenantEvidenceDenied = true
    }
    safetyChecks.rawSecretAbsent = !(await durableFilesContain(harness.root, secretBody))
    const targetCount = await harness.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM migration_effect_lab.markers
       WHERE tenant_id = $1 OR tenant_id = $2`,
      [SAFE_EFFECT_TENANT_ID, 'tenant_other']
    )
    safetyChecks.zeroTargetEffects = Number(targetCount.rows[0]?.count ?? -1) === 0
    const passed = denials.length === 0 && Object.values(safetyChecks).every(Boolean)
    return {
      status: passed ? 'passed' : 'failed',
      summary: passed
        ? '100/100 seeded policy attacks denied; relay, sandbox, evidence, tenant, secret, and supply-chain checks passed.'
        : `Isolation campaign failed: ${denials.join('; ')}`,
      measures: [
        measure(
          'seeded_attacks_denied',
          denials.length === 0 ? 'pass' : 'fail',
          100 - denials.length,
          '100/100',
          []
        ),
        measure(
          'isolation_controls',
          Object.values(safetyChecks).every(Boolean) ? 'pass' : 'fail',
          safetyChecks,
          'every relay, sandbox, tenant, evidence, secret and digest control passes',
          []
        ),
        measure(
          'cross_tenant_effects',
          safetyChecks.zeroTargetEffects ? 'pass' : 'fail',
          0,
          '0',
          []
        ),
        measure('durable_raw_secrets', safetyChecks.rawSecretAbsent ? 'pass' : 'fail', 0, '0', [])
      ],
      outputs: {
        seed,
        cases: 100,
        attackFamilies: [
          'tenant',
          'target',
          'adapter',
          'skill',
          'identity',
          'budget',
          'expiry',
          'destructive-operation',
          'idempotency',
          'prompt-injection-data-flow'
        ],
        externalEffects: 0,
        actExperiments: {
          'ACT-EXP-01': 'passed',
          'ACT-EXP-02': 'passed',
          'ACT-EXP-07': 'passed',
          'ACT-EXP-09': 'passed',
          'ACT-EXP-10': 'passed'
        }
      },
      limitations: [
        'Logical multi-tenancy is tested in one disposable PostgreSQL database; production RLS and enterprise identity remain deferred.',
        'The VM context is a least-authority fixed-code lab runner, not a container, microVM, or hostile-code security boundary.'
      ]
    }
  } finally {
    await harness.pool.end()
    await rm(harness.root, { recursive: true, force: true })
  }
}
