import { resolve } from 'node:path'
import { canonicalJson, sha256File, sha256Text } from './canonical-json.js'
import { verifyFixtureFiles } from './fixture-file-verification.js'
import {
  PagilaExpectedEstateSchema,
  PagilaSourceFixtureManifestSchema,
  type PagilaExpectedEstate,
  type PagilaSourceFixtureManifest
} from './pagila-source-fixture-contracts.js'
import { readJson } from './runtime-validation.js'

const MANIFEST_FILE = 'fixture-manifest.json'
const EXPECTED_FILES = [
  'UPSTREAM-LICENSE.txt',
  'pagila-schema.sql',
  'pagila-insert-data.sql',
  'expected-estate.json'
] as const

export type PagilaSourceFixture = {
  root: string
  manifest: PagilaSourceFixtureManifest
  expectedEstate: PagilaExpectedEstate
  manifestDigest: string
  fixtureDigest: string
  schemaPath: string
  dataPath: string
}

export async function loadPagilaSourceFixture(root: string): Promise<PagilaSourceFixture> {
  const resolvedRoot = resolve(root)
  const manifestPath = resolve(resolvedRoot, MANIFEST_FILE)
  const manifest = PagilaSourceFixtureManifestSchema.parse(await readJson(manifestPath))
  await verifyFixtureFiles(resolvedRoot, manifest.files, EXPECTED_FILES)
  verifyRole(manifest, 'UPSTREAM-LICENSE.txt', 'license')
  verifyRole(manifest, 'pagila-schema.sql', 'schema')
  verifyRole(manifest, 'pagila-insert-data.sql', 'data')
  verifyRole(manifest, 'expected-estate.json', 'expected-estate')
  const expectedEstate = PagilaExpectedEstateSchema.parse(
    await readJson(resolve(resolvedRoot, 'expected-estate.json'))
  )
  verifyEstateCounts(expectedEstate)
  const manifestDigest = await sha256File(manifestPath)
  return {
    root: resolvedRoot,
    manifest,
    expectedEstate,
    manifestDigest,
    fixtureDigest: sha256Text(
      canonicalJson({
        manifestDigest,
        files: manifest.files.map(({ path, sha256, bytes }) => ({ path, sha256, bytes }))
      })
    ),
    schemaPath: resolve(resolvedRoot, 'pagila-schema.sql'),
    dataPath: resolve(resolvedRoot, 'pagila-insert-data.sql')
  }
}

function verifyRole(
  manifest: PagilaSourceFixtureManifest,
  path: string,
  role: PagilaSourceFixtureManifest['files'][number]['role']
): void {
  if (manifest.files.find((file) => file.path === path)?.role !== role) {
    throw new Error(`Pagila fixture role mismatch: ${path}`)
  }
}

function verifyEstateCounts(estate: PagilaExpectedEstate): void {
  const { objectCounts, objects } = estate
  const checks: [label: string, expected: number, actual: number][] = [
    ['ordinary tables', objectCounts.ordinaryTables, objects.ordinaryTables.length],
    ['partitioned tables', objectCounts.partitionedTables, objects.partitionedTables.length],
    ['views', objectCounts.views, objects.views.length],
    ['materialized views', objectCounts.materializedViews, objects.materializedViews.length],
    ['sequences', objectCounts.sequences, objects.sequences.length],
    ['functions', objectCounts.functions, objects.functions.length],
    ['triggers', objectCounts.triggers, objects.triggers.length],
    [
      'domain types',
      objectCounts.domainTypes,
      objects.customTypes.filter((type) => type.kind === 'domain').length
    ],
    [
      'enum types',
      objectCounts.enumTypes,
      objects.customTypes.filter((type) => type.kind === 'enum').length
    ]
  ]
  for (const [label, expected, actual] of checks) {
    if (expected !== actual) {
      throw new Error(`Pagila estate ${label} count mismatch: ${expected} !== ${actual}`)
    }
  }
}
