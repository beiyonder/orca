import { afterEach, describe, expect, it } from 'vitest'
import {
  runSafeEffectIsolationExperiment,
  runSafeEffectKillPointExperiment
} from '../src/safe-effect-experiment.js'
import {
  createPostgresKernelTestContext,
  type PostgresKernelTestContext
} from './postgres-kernel-test-context.js'

const contexts: PostgresKernelTestContext[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map((context) => context.close()))
})

async function testConnectionString(): Promise<string> {
  const context = await createPostgresKernelTestContext()
  contexts.push(context)
  return context.connectionString
}

describe('P8 safe-effect qualification', () => {
  it('recovers all 50 request, receipt, evidence, and acknowledgment kill cases', async () => {
    const result = await runSafeEffectKillPointExperiment(await testConnectionString(), 811)
    expect(result.status).toBe('passed')
    expect(result.measures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'kill_points_recovered', status: 'pass', value: 50 }),
        expect.objectContaining({ name: 'signed_receipts_verified', status: 'pass', value: 50 }),
        expect.objectContaining({ name: 'evidence_survived_restarts', status: 'pass', value: 50 })
      ])
    )
    expect(result.outputs.externalEffects).toBe(50)
  }, 30_000)

  it('denies 100 seeded tenant, secret, relay, sandbox, and authority attacks', async () => {
    const result = await runSafeEffectIsolationExperiment(await testConnectionString(), 812)
    expect(result.status).toBe('passed')
    expect(result.measures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'seeded_attacks_denied', status: 'pass', value: 100 }),
        expect.objectContaining({ name: 'cross_tenant_effects', status: 'pass', value: 0 }),
        expect.objectContaining({ name: 'durable_raw_secrets', status: 'pass', value: 0 })
      ])
    )
    expect(result.outputs.externalEffects).toBe(0)
  }, 30_000)
})
