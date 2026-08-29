import { appendFile, cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { PagilaSourceFixtureManifestSchema } from '../src/pagila-source-fixture-contracts.js'
import { loadPagilaSourceFixture } from '../src/pagila-source-fixture-loader.js'

const fixtureRoot = fileURLToPath(new URL('../fixtures/p6-pagila-v3.1.0/', import.meta.url))
const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map(async (root) => rm(root, { recursive: true, force: true }))
  )
})

describe('P6 Pagila source fixture', () => {
  it('pins exact upstream, license, runtime, file, and estate identity', async () => {
    const fixture = await loadPagilaSourceFixture(fixtureRoot)
    expect(fixture.manifest.source).toMatchObject({
      tag: 'pagila-v3.1.0',
      revision: 'fef9675714cfba1756df4719b5e36075a7ddf90e'
    })
    expect(fixture.manifest.runtime).toMatchObject({
      engine: 'postgresql',
      version: '16.15',
      encoding: 'UTF8',
      collation: 'C'
    })
    expect(fixture.manifest.license).toMatchObject({
      spdx: 'MIT',
      redistributionAllowed: true
    })
    expect(fixture.manifest.license.conflictingUpstreamClaim).toContain('PostgreSQL license')
    expect(fixture.manifest.files.map((file) => file.path)).toEqual([
      'UPSTREAM-LICENSE.txt',
      'pagila-schema.sql',
      'pagila-insert-data.sql',
      'expected-estate.json'
    ])
    expect(fixture.manifestDigest).toBe(
      '8f7e13d088a9f0d70762a4b45f63f3367a82fddd51826d48c886ae37fe419f90'
    )
    expect(fixture.fixtureDigest).toBe(
      'c22e7c170feafc06e70bee21771181e1880b5ef9c8ccc8567b093eeaf4fe025d'
    )
    expect(fixture.expectedEstate.objectCounts).toMatchObject({
      ordinaryTables: 21,
      partitionedTables: 1,
      functions: 10,
      triggers: 15,
      foreignKeyConstraints: 36
    })
  })

  it('matches expected row counts to every upstream INSERT target', async () => {
    const fixture = await loadPagilaSourceFixture(fixtureRoot)
    const data = await readFile(fixture.dataPath, 'utf8')
    const actual = new Map<string, number>()
    for (const match of data.matchAll(/^INSERT INTO public\.([a-z0-9_]+) VALUES/gm)) {
      const table = match[1]!
      actual.set(table, (actual.get(table) ?? 0) + 1)
    }
    const expected = Object.fromEntries(
      Object.entries(fixture.expectedEstate.rowCounts).filter(([table]) => table !== 'payment')
    )
    expect(
      Object.fromEntries([...actual].toSorted(([left], [right]) => left.localeCompare(right)))
    ).toEqual(expected)
  })

  it('rejects manifest drift and changed fixture bytes', async () => {
    const manifest = JSON.parse(
      await readFile(join(fixtureRoot, 'fixture-manifest.json'), 'utf8')
    ) as Record<string, unknown>
    const source = manifest.source as Record<string, unknown>
    source.revision = '0'.repeat(40)
    expect(PagilaSourceFixtureManifestSchema.safeParse(manifest).success).toBe(false)

    const root = await mkdtemp(join(tmpdir(), 'orca-pagila-fixture-'))
    temporaryRoots.push(root)
    await cp(fixtureRoot, root, { recursive: true })
    await appendFile(join(root, 'pagila-schema.sql'), '\n-- changed\n')
    await expect(loadPagilaSourceFixture(root)).rejects.toThrow('Fixture byte size mismatch')
  })
})
