import { appendFile, cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { analyzeCdcBehavior } from '../src/cdc-behavior-analyzer.js'
import { loadDiscoveryQualificationFixture } from '../src/discovery-qualification-fixture.js'

const root = fileURLToPath(new URL('../fixtures/p6-discovery-cases-v1/', import.meta.url))
const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map(async (temporary) => rm(temporary, { recursive: true, force: true }))
  )
})

describe('P6 discovery qualification fixture', () => {
  it('pins claims, hidden estate, CDC, target, thresholds, and exact identity', async () => {
    const fixture = await loadDiscoveryQualificationFixture(root)
    expect(fixture.manifestDigest).toBe(
      '997951d5be67c6c7c256fb66cb62d18060611897661311bf4a7c11a9efc5ee35'
    )
    expect(fixture.fixtureDigest).toBe(
      '828ffc6c72c6635bec367e91c06b17c0aed278ba100fe67861a412eba9eb995d'
    )
    expect(
      fixture.claims.claims.filter((claim) => claim.expectedStatus === 'refuted')
    ).toHaveLength(8)
    expect(fixture.hiddenEstate.planted).toHaveLength(10)
    expect(fixture.hiddenEstate.denials).toHaveLength(2)
    expect(fixture.cdcTrace.events).toHaveLength(10)
    expect(fixture.targetCapability.status).toBe('observed')
  })

  it('replays the authored CDC trace to the exact final state', async () => {
    const fixture = await loadDiscoveryQualificationFixture(root)
    const analysis = analyzeCdcBehavior(fixture.cdcTrace, {
      analysisId: 'source_cdc_analysis_fixture_validation',
      analyzedAt: '2026-01-01T00:11:00.000Z',
      analyzedBy: { kind: 'system', id: 'fixture-validation', version: '1' }
    })
    expect(analysis.finalStateDigest).toBe(fixture.cdcTrace.expectedFinalStateDigest)
    expect(analysis.gaps).toEqual([])
    expect(analysis.eventDispositions).toHaveLength(fixture.cdcTrace.events.length)
  })

  it('rejects changed qualification bytes', async () => {
    const temporary = await mkdtemp(join(tmpdir(), 'orca-discovery-cases-'))
    temporaryRoots.push(temporary)
    await cp(root, temporary, { recursive: true })
    await appendFile(join(temporary, 'supplied-claims.json'), '\n')
    await expect(loadDiscoveryQualificationFixture(temporary)).rejects.toThrow(
      'Fixture byte size mismatch'
    )
  })
})
