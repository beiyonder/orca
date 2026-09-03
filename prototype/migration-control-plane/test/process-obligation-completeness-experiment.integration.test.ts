import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { runExperiment } from '../src/experiment-runner.js'
import {
  createPostgresKernelTestContext,
  type PostgresKernelTestContext
} from './postgres-kernel-test-context.js'

const labRoot = fileURLToPath(new URL('..', import.meta.url))
const contexts: PostgresKernelTestContext[] = []
const temporaryRoots: string[] = []
const originalTargetUrl = process.env.MIGRATION_CONTROL_TARGET_DATABASE_URL

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
}

afterEach(async () => {
  await Promise.all(contexts.splice(0).map((context) => context.close()))
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  )
  if (originalTargetUrl === undefined) {
    delete process.env.MIGRATION_CONTROL_TARGET_DATABASE_URL
  } else {
    process.env.MIGRATION_CONTROL_TARGET_DATABASE_URL = originalTargetUrl
  }
})

describe('EXP-13 process obligation completeness qualification', () => {
  it('seals all critical, benign, authority, replay, and safety measures', async () => {
    const context = await createPostgresKernelTestContext()
    contexts.push(context)
    process.env.MIGRATION_CONTROL_TARGET_DATABASE_URL = context.connectionString
    const outputRoot = await mkdtemp(join(tmpdir(), 'orca-exp13-run-'))
    temporaryRoots.push(outputRoot)

    const summary = await runExperiment({
      labRoot,
      outputRoot,
      experimentId: 'EXP-13',
      seed: 913,
      arm: 'baseline',
      fault: 'none',
      prototypeRevision: 'test'
    })
    expect(summary).toMatchObject({
      status: 'passed',
      summary: '16/16 critical process omissions detected; 0/8 benign controls falsely rejected.'
    })
    const metrics = await readJson(join(summary.runPath, 'metrics.json'))
    expect(metrics.measures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'critical_omissions_detected', status: 'pass', value: 16 }),
        expect.objectContaining({ name: 'benign_false_positives', status: 'pass', value: 0 }),
        expect.objectContaining({ name: 'definition_coverage', status: 'pass' }),
        expect.objectContaining({ name: 'obligation_instantiation', status: 'pass' }),
        expect.objectContaining({ name: 'proof_admission', status: 'pass' }),
        expect.objectContaining({ name: 'breach_detection', status: 'pass' }),
        expect.objectContaining({ name: 'response_selection', status: 'pass' }),
        expect.objectContaining({ name: 'monitor_recovery', status: 'pass' }),
        expect.objectContaining({
          name: 'safety_invariants',
          status: 'pass',
          value: {
            boundedDetection: true,
            crossTenantEffects: 0,
            duplicateBreaches: 0,
            exactRebuild: true,
            genericRetries: 0,
            unauthorizedWaivers: 0
          }
        })
      ])
    )
    expect(await readJson(join(summary.runPath, 'usage.json'))).toMatchObject({
      modelCalls: 0,
      externalEffects: 0
    })
  }, 30_000)
})
