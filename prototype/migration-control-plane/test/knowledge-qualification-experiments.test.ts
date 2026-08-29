import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { runExperiment } from '../src/experiment-runner.js'
import { runMemoryHelpHarmExperiment } from '../src/memory-help-harm-experiment.js'
import { createRetrievalBenchmarkCorpus } from '../src/retrieval-benchmark-corpus.js'
import { runRetrievalBenchmarkExperiment } from '../src/retrieval-benchmark-experiment.js'
import { verifyRunArtifact } from '../src/run-artifact-integrity.js'

const labRoot = fileURLToPath(new URL('..', import.meta.url))
const roots: string[] = []

async function outputRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'orca-knowledge-benchmark-'))
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => rm(root, { recursive: true, force: true })))
})

describe('knowledge qualification experiments', () => {
  it('passes EXP-06 on a 55-document known-answer corpus', () => {
    expect(createRetrievalBenchmarkCorpus(506).catalog.allChunkRecords()).toHaveLength(55)
    const result = runRetrievalBenchmarkExperiment(506)
    expect(result.status).toBe('passed')
    expect(result.measures).toHaveLength(4)
    expect(result.measures.every((entry) => entry.status === 'pass')).toBe(true)
    expect(result.summary).toBe(
      '20/20 known answers retrieved; 20/20 cited; 0 unauthorized; semantic delta +5.'
    )
    expect(result.outputs.cases).toHaveLength(20)
  })

  it('passes EXP-07 with help, poison, isolation, and invalidation evidence', () => {
    const result = runMemoryHelpHarmExperiment(507)
    expect(result.status).toBe('passed')
    expect(result.measures).toHaveLength(5)
    expect(result.measures.every((entry) => entry.status === 'pass')).toBe(true)
    expect(result.summary).toBe(
      'Task accuracy 10/20 to 20/20; 0 poisoned, 0 cross-tenant, 0 post-invalidation recalls.'
    )
    expect(result.outputs.cases).toHaveLength(20)
  })

  it.each([
    ['EXP-06', 506],
    ['EXP-07', 507]
  ])('seals and verifies the %s run artifact', async (experimentId, seed) => {
    const summary = await runExperiment({
      labRoot,
      outputRoot: await outputRoot(),
      experimentId,
      seed,
      arm: 'baseline',
      fault: 'none',
      prototypeRevision: 'test'
    })
    expect(summary.status).toBe('passed')
    expect(await verifyRunArtifact(summary.runPath)).toEqual({ valid: true, failures: [] })
  })
})
