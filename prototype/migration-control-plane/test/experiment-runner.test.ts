import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { runExperiment } from '../src/experiment-runner.js'
import { FAULT_POINT_DEFINITIONS } from '../src/fault-injection.js'

const labRoot = fileURLToPath(new URL('..', import.meta.url))
const temporaryRoots: string[] = []

async function outputRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'orca-experiment-runner-'))
  temporaryRoots.push(root)
  return root
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  )
})

describe('one-command experiment runner core', () => {
  it('writes a complete passing non-agent baseline run', async () => {
    const output = await outputRoot()
    const summary = await runExperiment({
      labRoot,
      outputRoot: output,
      experimentId: 'BASELINE-EXP-01',
      seed: 11,
      arm: 'baseline',
      fault: 'none',
      prototypeRevision: 'test'
    })

    expect(summary.status).toBe('passed')
    expect(await readJson(join(summary.runPath, 'verdict.json'))).toMatchObject({
      status: 'passed',
      summary: 'Non-agent baseline selected the composite key and passed all six measures.'
    })
    expect(await readJson(join(summary.runPath, 'usage.json'))).toMatchObject({
      modelCalls: 0,
      externalEffects: 0
    })
    expect(
      await readJson(join(summary.runPath, 'outputs', 'experiment-result.json'))
    ).toMatchObject({
      baselineMapping: {
        sourceKey: ['facility_id', 'patient_num']
      }
    })
    expect(
      (await readFile(join(summary.runPath, 'events.jsonl'), 'utf8')).trim().split('\n')
    ).toHaveLength(3)
  })

  it('replays identical non-environment artifacts for the same seed', async () => {
    const first = await runExperiment({
      labRoot,
      outputRoot: await outputRoot(),
      experimentId: 'BASELINE-EXP-01',
      seed: 23,
      arm: 'baseline',
      fault: 'none',
      prototypeRevision: 'test'
    })
    const second = await runExperiment({
      labRoot,
      outputRoot: await outputRoot(),
      experimentId: 'BASELINE-EXP-01',
      seed: 23,
      arm: 'baseline',
      fault: 'none',
      prototypeRevision: 'test'
    })

    expect(first.runId).toBe(second.runId)
    for (const file of [
      'events.jsonl',
      'metrics.json',
      'verdict.json',
      'usage.json',
      'outputs/experiment-result.json'
    ]) {
      expect(await readFile(join(first.runPath, file), 'utf8')).toBe(
        await readFile(join(second.runPath, file), 'utf8')
      )
    }
  })

  it('preserves an inspectable failed run at a named fault point', async () => {
    const summary = await runExperiment({
      labRoot,
      outputRoot: await outputRoot(),
      experimentId: 'BASELINE-EXP-01',
      seed: 31,
      arm: 'baseline',
      fault: 'evaluator.before_run',
      prototypeRevision: 'test'
    })

    expect(summary.status).toBe('failed')
    expect(await readJson(join(summary.runPath, 'verdict.json'))).toMatchObject({
      status: 'failed',
      summary: 'Run stopped at injected fault evaluator.before_run.'
    })
    const faults = (await readFile(join(summary.runPath, 'faults.jsonl'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    expect(faults).toContainEqual({
      point: 'evaluator.before_run',
      boundary: 'evaluator',
      occurrence: 1
    })
  })

  it('preserves an inspectable artifact for every registered fault point', async () => {
    const output = await outputRoot()
    for (const [index, definition] of FAULT_POINT_DEFINITIONS.entries()) {
      const summary = await runExperiment({
        labRoot,
        outputRoot: output,
        experimentId: 'LAB-EXP-01',
        seed: 1_000 + index,
        arm: 'baseline',
        fault: definition.id,
        prototypeRevision: 'test'
      })
      expect(summary.status).toBe('failed')
      expect(await readJson(join(summary.runPath, 'verdict.json'))).toMatchObject({
        status: 'failed',
        summary: `Run stopped at injected fault ${definition.id}.`
      })
      expect(await readFile(join(summary.runPath, 'faults.jsonl'), 'utf8')).toContain(definition.id)
    }
  })

  it('reports the OMP fixture as inconclusive until the real binary runs', async () => {
    const summary = await runExperiment({
      labRoot,
      outputRoot: await outputRoot(),
      experimentId: 'WORKER-EXP-01',
      seed: 5,
      arm: 'baseline',
      fault: 'none',
      prototypeRevision: 'test'
    })
    expect(summary.status).toBe('inconclusive')
    expect(await readJson(join(summary.runPath, 'verdict.json'))).toMatchObject({
      status: 'inconclusive'
    })
  })

  it('seals the 20-case EXP-05 disagreement benchmark', async () => {
    const summary = await runExperiment({
      labRoot,
      outputRoot: await outputRoot(),
      experimentId: 'EXP-05',
      seed: 413,
      arm: 'baseline',
      fault: 'none',
      prototypeRevision: 'test'
    })
    expect(summary.status).toBe('passed')
    expect(await readJson(join(summary.runPath, 'verdict.json'))).toMatchObject({
      status: 'passed',
      summary: '15/15 resolvable choices correct; 20/20 cited; 5/5 true ties explicit.'
    })
  })

  it('rejects unknown experiments, unsupported arms, and immutable run reuse', async () => {
    const output = await outputRoot()
    await expect(
      runExperiment({
        labRoot,
        outputRoot: output,
        experimentId: 'UNKNOWN',
        seed: 1,
        arm: 'baseline',
        fault: 'none'
      })
    ).rejects.toThrow('Unknown experiment')
    await expect(
      runExperiment({
        labRoot,
        outputRoot: output,
        experimentId: 'BASELINE-EXP-01',
        seed: 1,
        arm: 'candidate',
        fault: 'none'
      })
    ).rejects.toThrow('does not support arm candidate')

    const options = {
      labRoot,
      outputRoot: output,
      experimentId: 'BASELINE-EXP-01',
      seed: 41,
      arm: 'baseline' as const,
      fault: 'none',
      prototypeRevision: 'test'
    }
    await runExperiment(options)
    await expect(runExperiment(options)).rejects.toThrow('Run artifact already exists')
  })
})
