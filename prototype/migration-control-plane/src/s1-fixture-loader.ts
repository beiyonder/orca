import { resolve } from 'node:path'
import { sha256File } from './canonical-json.js'
import { readJson } from './runtime-validation.js'
import { verifyFixtureFiles } from './fixture-file-verification.js'
import {
  parseExpectedResults,
  parseFixtureManifest,
  parseIdentityProfile,
  parseMutations,
  parseNegativeCases,
  parseOmpWorkerContract
} from './s1-fixture-parser.js'
import type { S1IdentityFixture } from './s1-fixture-contracts.js'

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
  await verifyFixtureFiles(resolvedRoot, manifest.files, Object.keys(EXPECTED_FILES))
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
