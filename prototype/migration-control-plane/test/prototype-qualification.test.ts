import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PrototypeQualificationBundle,
  verifyPrototypeQualificationBundle
} from '../src/prototype-qualification-bundle.js'
import type { QualificationRunEvidence } from '../src/prototype-qualification-campaign.js'
import {
  loadPrototypeQualificationProfile,
  PrototypeQualificationProfileV1Schema
} from '../src/prototype-qualification-profile.js'
import { buildPrototypeQualificationReports } from '../src/prototype-qualification-reports.js'

const labRoot = fileURLToPath(new URL('..', import.meta.url))
const temporaryRoots: string[] = []

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'orca-p10-qualification-'))
  temporaryRoots.push(root)
  return root
}

function run(experimentId: string, status = 'passed'): QualificationRunEvidence {
  return {
    experimentId,
    seed: 1,
    fault: 'none',
    runId: `run-${experimentId}`,
    runPath: `/runs/${experimentId}`,
    status,
    summary: status === 'passed' ? 'passed' : 'failed',
    artifactValid: true
  }
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })))
})

describe('P10 qualification contracts', () => {
  it('loads the exact frozen profile and all registered fault points', async () => {
    const loaded = await loadPrototypeQualificationProfile(
      labRoot,
      'qualification/p10-profile.v1.json'
    )
    expect(loaded.digest).toMatch(/^[a-f0-9]{64}$/)
    expect(loaded.profile).toMatchObject({
      environment: { node: '24', pnpm: '10.24.0', postgres: '16.15', pagila: '3.1.0' },
      repeatRuns: 10,
      load: { missions: 50, agentSlots: 100 }
    })
    expect(new Set(loaded.profile.faultPoints).size).toBe(14)
    expect(() =>
      PrototypeQualificationProfileV1Schema.parse({ ...loaded.profile, repeatRuns: 9 })
    ).toThrow()
  })

  it('indexes every evidence file and detects cold-review tampering', async () => {
    const root = join(await temporaryRoot(), 'bundle')
    const bundle = await PrototypeQualificationBundle.create(root, 'bundle-test')
    await bundle.writeJson('reports/review.json', { status: 'passed' })
    await bundle.writeJson('campaigns/load.json', { missions: 50, agentSlots: 100 })
    const index = await bundle.finalize()
    expect(index.files.map((entry) => entry.path)).toEqual([
      'campaigns/load.json',
      'reports/review.json'
    ])
    await expect(verifyPrototypeQualificationBundle(root)).resolves.toMatchObject({
      bundleId: 'bundle-test'
    })
    await writeFile(join(root, 'reports', 'review.json'), '{"status":"changed"}\n')
    await expect(verifyPrototypeQualificationBundle(root)).rejects.toThrow('integrity failed')
  })

  it('propagates one failed authority into criteria, coordinate, and review failure', async () => {
    const { profile, digest } = await loadPrototypeQualificationProfile(
      labRoot,
      'qualification/p10-profile.v1.json'
    )
    const experiments = [
      'BASELINE-EXP-01',
      'DUR-EXP-01',
      'EXP-02',
      'EXP-03',
      'EXP-04',
      'EXP-05',
      'EXP-06',
      'EXP-07',
      'EXP-08',
      'EXP-09',
      'EXP-11',
      'EXP-12',
      'EXP-13'
    ].map((id) => run(id, id === 'EXP-12' ? 'failed' : 'passed'))
    const faults = profile.faultPoints.map((fault, index) => ({
      ...run('LAB-EXP-01', 'failed'),
      seed: 30_000 + index,
      fault,
      summary: `Run stopped at injected fault ${fault}.`
    }))
    const repeats = Array.from({ length: 10 }, (_, index) => ({
      ...run('DUR-EXP-01'),
      runId: `repeat-${index}`
    }))
    const reports = buildPrototypeQualificationReports({
      profile,
      profileDigest: digest,
      experiments,
      faults,
      repeats: { equivalent: true, runs: repeats, outputDigestSource: 'accepted' },
      load: {
        missions: 50,
        assignmentRecords: 100,
        controlEvents: 50,
        elapsedMs: 1,
        missionEventBytes: 1,
        bottlenecks: []
      },
      environment: {},
      resourceUsage: {},
      environmentMatches: true
    })
    expect(reports.passed).toBe(false)
    expect(reports.review).toMatchObject({ decision: 'rework', status: 'failed' })
    expect(reports.security).toMatchObject({ status: 'failed' })
    expect(reports.coordinates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ coordinate: 'P10-QUAL-12', status: 'failed' })
      ])
    )
    expect(await readFile(join(labRoot, 'qualification/p10-profile.v1.json'), 'utf8')).toContain(
      'p10-qualification-v1'
    )
  })
})
