import { resolve } from 'node:path'
import { z } from 'zod'
import { canonicalJson, sha256File, sha256Text } from './canonical-json.js'
import { TargetCapabilitySnapshotV1Schema } from './domain/migration-proposal-contracts.js'
import { SourceCdcTraceV1Schema } from './domain/source-cdc-contracts.js'
import { verifyFixtureFiles } from './fixture-file-verification.js'
import { readJson } from './runtime-validation.js'

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)
const FileSchema = z.strictObject({
  path: z.string().min(1).max(256),
  bytes: z.number().int().positive(),
  sha256: Sha256Schema
})
const ManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  fixtureId: z.literal('p6-discovery-cases-v1'),
  coordinates: z.array(z.string().min(1).max(64)).length(9),
  baseFixture: z.strictObject({
    fixtureId: z.literal('p6-pagila-v3.1.0'),
    fixtureDigest: z.literal('c22e7c170feafc06e70bee21771181e1880b5ef9c8ccc8567b093eeaf4fe025d')
  }),
  license: z.literal('MIT'),
  dataClass: z.literal('synthetic-no-phi'),
  createdBy: z.string().min(1).max(256),
  files: z.array(FileSchema).length(5),
  thresholds: z.strictObject({
    materialContradictions: z.literal(8),
    minimumHiddenRecall: z.literal(9),
    maximumFabricatedAccepted: z.literal(0),
    explicitDenials: z.literal(2),
    cdcFinalStateExact: z.literal(true),
    cdcEveryEventDisposed: z.literal(true)
  }),
  limitations: z.array(z.string().min(1).max(1_024)).min(1).max(16)
})

const ClaimsSchema = z.strictObject({
  schemaVersion: z.literal(1),
  fixtureId: z.literal('p6-discovery-cases-v1'),
  claims: z.array(
    z.strictObject({
      id: z.string().min(1).max(128),
      statement: z.string().min(1).max(8_192),
      scope: z.string().min(1).max(1_024),
      material: z.boolean(),
      value: z.json(),
      observedKey: z.string().min(1).max(256),
      expectedStatus: z.enum(['supported', 'refuted', 'unresolved', 'denied', 'stale'])
    })
  )
})

const HiddenEstateSchema = z.strictObject({
  schemaVersion: z.literal(1),
  fixtureId: z.literal('p6-discovery-cases-v1'),
  planted: z.array(
    z.strictObject({
      id: z.string().min(1).max(128),
      kind: z.enum(['asset', 'dependency']),
      identity: z.string().min(1).max(1_024),
      evidenceKey: z.string().min(1).max(1_024).optional(),
      edgeKind: z.string().min(1).max(128).optional()
    })
  ),
  denials: z.array(
    z.strictObject({ scope: z.string().min(1).max(512), reason: z.string().min(1).max(1_024) })
  ),
  decoy: z.strictObject({
    identity: z.string().min(1).max(1_024),
    mustNotBeAccepted: z.literal(true)
  }),
  thresholds: z.strictObject({
    minimumPlantedRecall: z.number().int().positive(),
    maximumFabricatedAccepted: z.number().int().nonnegative(),
    requiredExplicitDenials: z.number().int().positive()
  })
})

export type DiscoveryQualificationFixture = {
  root: string
  manifest: z.infer<typeof ManifestSchema>
  claims: z.infer<typeof ClaimsSchema>
  hiddenEstate: z.infer<typeof HiddenEstateSchema>
  cdcTrace: z.infer<typeof SourceCdcTraceV1Schema>
  targetCapability: z.infer<typeof TargetCapabilitySnapshotV1Schema>
  manifestDigest: string
  fixtureDigest: string
}

const EXPECTED_FILES = [
  'LICENSE.txt',
  'supplied-claims.json',
  'hidden-estate.json',
  'cdc-trace.json',
  'target-capability.json'
] as const

export async function loadDiscoveryQualificationFixture(
  root: string
): Promise<DiscoveryQualificationFixture> {
  const resolvedRoot = resolve(root)
  const manifestPath = resolve(resolvedRoot, 'fixture-manifest.json')
  const manifest = ManifestSchema.parse(await readJson(manifestPath))
  await verifyFixtureFiles(resolvedRoot, manifest.files, EXPECTED_FILES)
  const claims = ClaimsSchema.parse(await readJson(resolve(resolvedRoot, 'supplied-claims.json')))
  const hiddenEstate = HiddenEstateSchema.parse(
    await readJson(resolve(resolvedRoot, 'hidden-estate.json'))
  )
  const cdcTrace = SourceCdcTraceV1Schema.parse(
    await readJson(resolve(resolvedRoot, 'cdc-trace.json'))
  )
  const targetCapability = TargetCapabilitySnapshotV1Schema.parse(
    await readJson(resolve(resolvedRoot, 'target-capability.json'))
  )
  const manifestDigest = await sha256File(manifestPath)
  return {
    root: resolvedRoot,
    manifest,
    claims,
    hiddenEstate,
    cdcTrace,
    targetCapability,
    manifestDigest,
    fixtureDigest: sha256Text(
      canonicalJson({
        manifestDigest,
        baseFixture: manifest.baseFixture,
        files: manifest.files
      })
    )
  }
}
