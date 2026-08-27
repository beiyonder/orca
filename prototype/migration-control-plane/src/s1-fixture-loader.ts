import { stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import { sha256File } from './canonical-json.js'
import { readJson } from './runtime-validation.js'
import {
  parseExpectedResults,
  parseFixtureManifest,
  parseIdentityProfile,
  parseMutations,
  parseNegativeCases,
  parseOmpWorkerContract
} from './s1-fixture-parser.js'
import type { FixtureManifest, S1IdentityFixture } from './s1-fixture-contracts.js'

const MANIFEST_FILE = 'fixture-manifest.json'
const EXPECTED_FILES: Record<string, true> = {
  'LICENSE.txt': true,
  'customer-architecture.md': true,
  'observed-key-profile.json': true,
  'identity-mapping.schema.json': true,
  'expected-results.json': true,
  'mutations.json': true,
  'negative-cases.json': true,
  'omp-worker-contract.json': true
}

export async function loadS1IdentityFixture(root: string): Promise<S1IdentityFixture> {
  const resolvedRoot = resolve(root)
  const manifestPath = resolve(resolvedRoot, MANIFEST_FILE)
  const manifest = parseFixtureManifest(await readJson(manifestPath))
  await verifyManifestFiles(resolvedRoot, manifest)
  const profile = parseIdentityProfile(
    await readJson(resolve(resolvedRoot, 'observed-key-profile.json'))
  )
  if (profile.fixtureId !== manifest.fixtureId) {
    throw new Error('Fixture ID mismatch between manifest and profile')
  }
  return {
    root: resolvedRoot,
    manifest,
    manifestDigest: await sha256File(manifestPath),
    profile,
    expected: parseExpectedResults(await readJson(resolve(resolvedRoot, 'expected-results.json'))),
    mutations: parseMutations(await readJson(resolve(resolvedRoot, 'mutations.json'))),
    negativeCases: parseNegativeCases(await readJson(resolve(resolvedRoot, 'negative-cases.json'))),
    workerContract: parseOmpWorkerContract(
      await readJson(resolve(resolvedRoot, 'omp-worker-contract.json'))
    )
  }
}

async function verifyManifestFiles(root: string, manifest: FixtureManifest): Promise<void> {
  const listed = new Set(manifest.files.map((entry) => entry.path))
  if (listed.size !== manifest.files.length) {
    throw new Error('Fixture manifest contains duplicate paths')
  }
  const expectedPaths = Object.keys(EXPECTED_FILES)
  if (
    listed.size !== expectedPaths.length ||
    expectedPaths.some((path) => !listed.has(path)) ||
    [...listed].some((path) => !Object.hasOwn(EXPECTED_FILES, path))
  ) {
    throw new Error('Fixture manifest file set is incomplete')
  }
  for (const entry of manifest.files) {
    if (isAbsolute(entry.path)) throw new Error(`Fixture path must be relative: ${entry.path}`)
    const target = resolve(root, entry.path)
    const fromRoot = relative(root, target)
    if (
      fromRoot === '..' ||
      fromRoot.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
    ) {
      throw new Error(`Fixture path escapes root: ${entry.path}`)
    }
    const fileStat = await stat(target)
    if (!fileStat.isFile() || fileStat.size !== entry.bytes) {
      throw new Error(`Fixture byte size mismatch: ${entry.path}`)
    }
    if ((await sha256File(target)) !== entry.sha256) {
      throw new Error(`Fixture digest mismatch: ${entry.path}`)
    }
  }
}
