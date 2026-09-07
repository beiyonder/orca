import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z } from 'zod'
import { canonicalJson, sha256Text } from './canonical-json.js'
import { FAULT_POINT_DEFINITIONS } from './fault-injection.js'

const PositiveSeedSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)

export const PrototypeQualificationProfileV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  profileId: z.literal('p10-qualification-v1'),
  environment: z.strictObject({
    node: z.literal('24'),
    pnpm: z.literal('10.24.0'),
    postgres: z.literal('16.15'),
    pagila: z.literal('3.1.0'),
    omp: z.literal('18.0.6')
  }),
  fixtures: z.strictObject({
    identity: z.string().min(1).max(512),
    pagila: z.string().min(1).max(512)
  }),
  contracts: z.strictObject({
    domainSchemas: z.literal(97),
    migrations: z.literal(21),
    tables: z.literal(20),
    schemaFingerprint: z.literal(
      '28ff7a157325c5047694bb6244187c409933c62654112731ba3123af46446f4e'
    ),
    registryDigest: z.literal('083366a12a1e92bd387b504559962ada82a37f17faf118f051f198e54511b851')
  }),
  configuration: z.strictObject({
    apiVersion: z.literal('v1'),
    maxBodyBytes: z.literal(65_536),
    maxPageSize: z.literal(100),
    activityBatchSize: z.literal(100),
    activityPollIntervalMs: z.literal(1_000),
    activityHeartbeatIntervalMs: z.literal(15_000)
  }),
  models: z.array(z.string().min(1).max(128)).min(1),
  prompts: z.array(z.string().min(1).max(128)).min(1),
  skills: z.array(z.string().min(1).max(128)).min(1),
  seeds: z.strictObject({
    baseline: PositiveSeedSchema,
    durable: PositiveSeedSchema,
    discoveryContradiction: PositiveSeedSchema,
    discoveryEstate: PositiveSeedSchema,
    discoveryCdc: PositiveSeedSchema,
    specialist: PositiveSeedSchema,
    retrieval: PositiveSeedSchema,
    memory: PositiveSeedSchema,
    evaluation: PositiveSeedSchema,
    skillLifecycle: PositiveSeedSchema,
    safeEffect: PositiveSeedSchema,
    isolation: PositiveSeedSchema,
    processCompleteness: PositiveSeedSchema
  }),
  repeatRuns: z.literal(10),
  load: z.strictObject({
    missions: z.literal(50),
    agentSlots: z.literal(100),
    controlEventsPerMission: z.number().int().positive().max(100)
  }),
  faultPoints: z.array(z.string().min(1).max(128)).length(14)
})

export type PrototypeQualificationProfileV1 = z.infer<typeof PrototypeQualificationProfileV1Schema>

export async function loadPrototypeQualificationProfile(
  labRoot: string,
  profilePath: string
): Promise<{ profile: PrototypeQualificationProfileV1; digest: string }> {
  const profile = PrototypeQualificationProfileV1Schema.parse(
    JSON.parse(await readFile(resolve(labRoot, profilePath), 'utf8')) as unknown
  )
  const requiredFaults = FAULT_POINT_DEFINITIONS.map((item) => item.id).sort()
  if (canonicalJson([...profile.faultPoints].sort()) !== canonicalJson(requiredFaults)) {
    throw new TypeError('Qualification profile must pin every registered fault point exactly once')
  }
  for (const fixturePath of Object.values(profile.fixtures)) {
    await readFile(resolve(labRoot, fixturePath), 'utf8')
  }
  return { profile, digest: sha256Text(canonicalJson(profile)) }
}
