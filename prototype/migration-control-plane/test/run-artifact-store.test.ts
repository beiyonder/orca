import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { RunManifest } from '../src/experiment-contracts.js'
import { verifyRunArtifact } from '../src/run-artifact-integrity.js'
import { RunArtifactStore } from '../src/run-artifact-store.js'

const roots: string[] = []

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'orca-migration-lab-'))
  roots.push(root)
  return root
}

function manifest(runId: string): RunManifest {
  return {
    schemaVersion: 1,
    runId,
    experimentId: 'LAB-EXP-01',
    seed: 1,
    arm: 'baseline',
    fault: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    fixtureId: 'fixture',
    fixtureDigest: 'a'.repeat(64),
    environment: {
      node: 'v24.0.0',
      platform: 'linux',
      arch: 'x64',
      prototypeRevision: 'test'
    }
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('immutable run artifact store', () => {
  it('publishes a complete run atomically and refuses later writes', async () => {
    const root = await temporaryRoot()
    const evidence = join(root, 'source.json')
    await writeFile(evidence, '{"ok":true}\n')
    const store = await RunArtifactStore.create(join(root, 'runs'), manifest('run-one'))
    await store.writeJson('metrics.json', { b: 2, a: 1 })
    await store.copyEvidence(evidence, 'source.json')
    const finalPath = await store.finalize('passed', '2026-01-01T00:00:01.000Z')

    expect(finalPath).toBe(join(root, 'runs', 'run-one'))
    expect(JSON.parse(await readFile(join(finalPath, 'metrics.json'), 'utf8'))).toEqual({
      a: 1,
      b: 2
    })
    expect((await stat(join(finalPath, 'evidence', 'source.json'))).isFile()).toBe(true)
    await expect(store.writeText('late.txt', 'no')).rejects.toThrow('finalized')
    await expect(stat(store.pendingPath())).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await verifyRunArtifact(finalPath)).toEqual({ valid: true, failures: [] })
    await writeFile(join(finalPath, 'metrics.json'), '{"tampered":true}\n')
    expect(await verifyRunArtifact(finalPath)).toEqual({
      valid: false,
      failures: ['bytes:metrics.json', 'sha256:metrics.json']
    })
  })

  it('rejects traversal and duplicate artifact writes', async () => {
    const root = await temporaryRoot()
    const store = await RunArtifactStore.create(join(root, 'runs'), manifest('run-two'))
    await expect(store.writeText('../escape.txt', 'no')).rejects.toThrow('escapes the run')
    await store.writeText('outputs/result.txt', 'first')
    await expect(store.writeText('outputs/result.txt', 'second')).rejects.toMatchObject({
      code: 'EEXIST'
    })
    await store.finalize('failed', '2026-01-01T00:00:01.000Z')
  })
})
