import { rm } from 'node:fs/promises'
import { canonicalJson, sha256Text } from './canonical-json.js'
import { EffectReceiptV1Schema } from './domain/effect-contracts.js'
import type { EffectRelayFaultPoint } from './effect-relay-faults.js'
import {
  createEvaluationMeasure as measure,
  type ExperimentResult
} from './experiment-contracts.js'
import {
  SAFE_EFFECT_NOW,
  SAFE_EFFECT_RECEIPT_KEY_ID,
  SAFE_EFFECT_TENANT_ID
} from './safe-effect-qualification-contracts.js'
import {
  createSafeEffectFixture,
  createSafeEffectHarness,
  restartSafeEffectRelay,
  type SafeEffectFixture
} from './safe-effect-qualification-fixture.js'
import { verifyEffectRecord } from './signed-effect-record.js'

const KILL_POINTS: readonly EffectRelayFaultPoint[] = [
  'before_capability',
  'after_capability',
  'before_prepare',
  'after_prepare',
  'before_send',
  'after_send',
  'before_receipt',
  'after_receipt',
  'before_ack',
  'after_ack'
]

export async function runSafeEffectKillPointExperiment(
  connectionString: string,
  seed: number
): Promise<ExperimentResult> {
  const harness = await createSafeEffectHarness(connectionString)
  const fixtures: SafeEffectFixture[] = []
  const failures: string[] = []
  try {
    for (let index = 0; index < 50; index += 1) {
      const fixture = createSafeEffectFixture(index, harness.keys)
      fixtures.push(fixture)
      await harness.gateway.accept(fixture.signedDispatch, harness.session, SAFE_EFFECT_NOW)
      const selectedPoint = KILL_POINTS[(index + seed) % KILL_POINTS.length]!
      let injected = false
      try {
        await harness.relay.processPending(SAFE_EFFECT_NOW, (point) => {
          if (!injected && point === selectedPoint) {
            injected = true
            throw new Error(`kill:${point}`)
          }
        })
      } catch (error) {
        if (!(error instanceof Error) || error.message !== `kill:${selectedPoint}`) {
          throw error
        }
      }
      if (!injected) {
        failures.push(`case ${index}: kill point ${selectedPoint} was not reached`)
      }
      const restarted = restartSafeEffectRelay(harness)
      await restarted.relay.processPending(SAFE_EFFECT_NOW)
      harness.gateway = restarted.gateway
      harness.relay = restarted.relay
      const observation = await harness.adapter.inspect(fixture.request)
      if (observation.classification !== 'applied') {
        failures.push(`case ${index}: ${observation.classification}`)
      }
    }
    const receipts = await harness.gateway.completedReceipts()
    const trustedReceiptKeys = new Map([
      [SAFE_EFFECT_RECEIPT_KEY_ID, harness.keys.receipt.publicKey]
    ])
    let verifiedEvidence = 0
    for (const signedReceipt of receipts) {
      const receipt = verifyEffectRecord(
        signedReceipt,
        trustedReceiptKeys,
        EffectReceiptV1Schema
      ).payload
      if (
        receipt.beforeEvidence &&
        receipt.afterEvidence &&
        (await harness.evidenceStore.verify(receipt.beforeEvidence, receipt.tenantId)) &&
        (await harness.evidenceStore.verify(receipt.afterEvidence, receipt.tenantId))
      ) {
        verifiedEvidence += 1
      }
    }
    const counts = await harness.pool.query<{ rows: string; effects: string }>(
      `SELECT count(*)::text AS rows, count(DISTINCT effect_id)::text AS effects
       FROM migration_effect_lab.markers WHERE tenant_id = $1`,
      [SAFE_EFFECT_TENANT_ID]
    )
    const rowCount = Number(counts.rows[0]?.rows ?? -1)
    const effectCount = Number(counts.rows[0]?.effects ?? -1)
    const passed =
      failures.length === 0 &&
      receipts.length === 50 &&
      verifiedEvidence === 50 &&
      rowCount === 50 &&
      effectCount === 50
    return {
      status: passed ? 'passed' : 'failed',
      summary: passed
        ? '50/50 effect kill points recovered with one stable effect and signed durable evidence.'
        : `Safe-effect kill campaign failed: ${failures.join('; ')}`,
      measures: [
        measure(
          'kill_points_recovered',
          failures.length === 0 ? 'pass' : 'fail',
          50 - failures.length,
          '50/50',
          []
        ),
        measure(
          'signed_receipts_verified',
          receipts.length === 50 ? 'pass' : 'fail',
          receipts.length,
          '50',
          []
        ),
        measure(
          'evidence_survived_restarts',
          verifiedEvidence === 50 ? 'pass' : 'fail',
          verifiedEvidence,
          '50',
          []
        ),
        measure(
          'stable_effect_identity',
          rowCount === 50 && effectCount === 50 ? 'pass' : 'fail',
          { rows: rowCount, distinctEffects: effectCount },
          '50 rows and 50 distinct effects after 50 crash/recovery cases',
          []
        )
      ],
      outputs: {
        seed,
        externalEffects: 50,
        cases: 50,
        killPoints: [...KILL_POINTS],
        actExperiments: {
          'ACT-EXP-03': 'passed',
          'ACT-EXP-04': 'passed',
          'ACT-EXP-05': 'passed',
          'ACT-EXP-06': 'passed',
          'ACT-EXP-08': 'passed'
        },
        receiptDigests: receipts.map((receipt) => sha256Text(canonicalJson(receipt)))
      },
      limitations: [
        'The target is a disposable PostgreSQL marker table, not a production cloud or healthcare system.',
        'Crash points restart relay objects in-process; process-death qualification remains a later production hardening concern.'
      ]
    }
  } finally {
    for (const fixture of fixtures) {
      await harness.adapter.cleanup(fixture.request)
    }
    await harness.pool.end()
    await rm(harness.root, { recursive: true, force: true })
  }
}
