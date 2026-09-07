import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { Pool } from 'pg'
import { canonicalizeJson, sha256File, type JsonValue } from './canonical-json.js'
import { fingerprintPostgresSchema } from './database/postgres-schema-fingerprint.js'
import { migratePostgresSchema } from './database/postgres-schema-migrator.js'
import {
  runPrototypeQualificationExperiments,
  runPrototypeQualificationFaults,
  runPrototypeQualificationRepeats
} from './prototype-qualification-campaign.js'
import {
  PrototypeQualificationBundle,
  verifyPrototypeQualificationBundle
} from './prototype-qualification-bundle.js'
import { runPrototypeQualificationLoad } from './prototype-qualification-load.js'
import { loadPrototypeQualificationProfile } from './prototype-qualification-profile.js'
import {
  buildPrototypeQualificationReports,
  repeatabilityDigest
} from './prototype-qualification-reports.js'

export type RunPrototypeQualificationInput = {
  labRoot: string
  profilePath: string
  outputRoot: string
  controlConnectionString: string
  targetConnectionString: string
  pagilaConnectionString: string
  revision?: string
}

export type PrototypeQualificationResult = {
  status: 'passed' | 'failed'
  bundleId: string
  bundlePath: string
  indexedFiles: number
}

export async function runPrototypeQualification(
  input: RunPrototypeQualificationInput
): Promise<PrototypeQualificationResult> {
  const startedAt = performance.now()
  const usageBefore = process.resourceUsage()
  const memoryBefore = process.memoryUsage()
  const { profile, digest: profileDigest } = await loadPrototypeQualificationProfile(
    input.labRoot,
    input.profilePath
  )
  const revision = input.revision ?? process.env.GITHUB_SHA ?? 'working-tree'
  process.env.MIGRATION_CONTROL_DATABASE_URL = input.controlConnectionString
  process.env.MIGRATION_CONTROL_TARGET_DATABASE_URL = input.targetConnectionString
  process.env.PAGILA_DISCOVERY_DATABASE_URL = input.pagilaConnectionString
  await migratePostgresSchema({ connectionString: input.controlConnectionString })
  const bundleId = `p10-${profileDigest.slice(0, 16)}-${revision.slice(0, 12)}`
  const bundle = await PrototypeQualificationBundle.create(input.outputRoot, bundleId)
  const runsRoot = join(input.outputRoot, 'runs')
  const experiments = await runPrototypeQualificationExperiments(
    input.labRoot,
    runsRoot,
    profile,
    revision,
    input.controlConnectionString
  )
  const faults = await runPrototypeQualificationFaults(input.labRoot, runsRoot, profile, revision)
  const repeats = await runPrototypeQualificationRepeats(
    input.labRoot,
    runsRoot,
    profile,
    revision,
    input.controlConnectionString
  )
  const pool = new Pool({ connectionString: input.controlConnectionString, max: 8 })
  const load = await runPrototypeQualificationLoad(pool, profile)
  const postgresVersion = await pool.query<{ server_version: string }>('SHOW server_version')
  const liveContracts = await pool.query<{
    schemas: number
    migrations: number
    tables: number
    registry_digest: string
  }>(
    `SELECT
       (SELECT count(*)::int FROM control_plane.contract_schemas) AS schemas,
       (SELECT count(*)::int FROM control_plane.schema_migrations) AS migrations,
       (SELECT count(*)::int FROM information_schema.tables
        WHERE table_schema = 'control_plane' AND table_type = 'BASE TABLE') AS tables,
       (SELECT value FROM control_plane.kernel_metadata
        WHERE key = 'contract_registry_digest') AS registry_digest`
  )
  const liveSchemaFingerprint = await fingerprintPostgresSchema(input.controlConnectionString)
  await pool.end()
  const documentationPath = resolve(
    input.labRoot,
    '..',
    '..',
    'docs',
    'agentic-substrate-p10-qualification.md'
  )
  await readFile(documentationPath, 'utf8')
  const rootPackage = JSON.parse(
    await readFile(resolve(input.labRoot, '..', '..', 'package.json'), 'utf8')
  ) as { packageManager?: string }
  const usageAfter = process.resourceUsage()
  const memoryAfter = process.memoryUsage()
  const environment = {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    postgres: postgresVersion.rows[0]!.server_version,
    packageManager: rootPackage.packageManager ?? null,
    revision,
    profileDigest,
    packageLockSha256: await sha256File(resolve(input.labRoot, '..', '..', 'pnpm-lock.yaml')),
    liveContracts: liveContracts.rows[0]!,
    liveSchemaFingerprint
  }
  const resourceUsage = {
    elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100,
    userCpuMicros: usageAfter.userCPUTime - usageBefore.userCPUTime,
    systemCpuMicros: usageAfter.systemCPUTime - usageBefore.systemCPUTime,
    maxRssBytes: usageAfter.maxRSS * 1024,
    heapUsedBefore: memoryBefore.heapUsed,
    heapUsedAfter: memoryAfter.heapUsed
  }
  const environmentMatches =
    process.versions.node.split('.')[0] === profile.environment.node &&
    rootPackage.packageManager?.startsWith(`pnpm@${profile.environment.pnpm}`) === true &&
    postgresVersion.rows[0]!.server_version.startsWith(profile.environment.postgres) &&
    liveSchemaFingerprint === profile.contracts.schemaFingerprint &&
    liveContracts.rows[0]!.schemas === profile.contracts.domainSchemas &&
    liveContracts.rows[0]!.migrations === profile.contracts.migrations &&
    liveContracts.rows[0]!.tables === profile.contracts.tables &&
    liveContracts.rows[0]!.registry_digest === profile.contracts.registryDigest
  const reports = buildPrototypeQualificationReports({
    profile,
    profileDigest,
    experiments,
    faults,
    repeats,
    load,
    environment: canonicalizeJson(environment) as Record<string, JsonValue>,
    resourceUsage: canonicalizeJson(resourceUsage) as Record<string, JsonValue>,
    environmentMatches
  })
  const conciseRuns = (runs: typeof experiments) =>
    runs.map(({ experimentId, seed, fault, runId, status, summary, artifactValid }) => ({
      experimentId,
      seed,
      fault,
      runId,
      status,
      summary,
      artifactValid
    }))
  await bundle.writeJson('profile.json', canonicalizeJson({ profile, profileDigest }))
  await bundle.writeJson('environment.json', canonicalizeJson(environment))
  await bundle.writeJson('campaigns/experiments.json', canonicalizeJson(conciseRuns(experiments)))
  await bundle.writeJson('campaigns/faults.json', canonicalizeJson(conciseRuns(faults)))
  await bundle.writeJson(
    'campaigns/repeatability.json',
    canonicalizeJson({
      equivalent: repeats.equivalent,
      runCount: repeats.runs.length,
      acceptedOutputDigest: repeatabilityDigest(repeats.outputDigestSource),
      runs: conciseRuns(repeats.runs)
    })
  )
  await bundle.writeJson('campaigns/load.json', canonicalizeJson(load))
  await bundle.writeJson('reports/criteria.json', reports.criteria)
  await bundle.writeJson('reports/coordinates.json', reports.coordinates)
  await bundle.writeJson('reports/security.json', reports.security)
  await bundle.writeJson('reports/reconstruction.json', reports.reconstruction)
  await bundle.writeJson('reports/baseline.json', reports.baseline)
  await bundle.writeJson('reports/capability.json', reports.capability)
  await bundle.writeJson('reports/limitations.json', reports.limitations)
  await bundle.writeJson('reports/resources.json', reports.resources)
  await bundle.writeJson('reports/review.json', reports.review)
  const index = await bundle.finalize()
  await verifyPrototypeQualificationBundle(input.outputRoot)
  return {
    status: reports.passed ? 'passed' : 'failed',
    bundleId,
    bundlePath: input.outputRoot,
    indexedFiles: index.files.length
  }
}
