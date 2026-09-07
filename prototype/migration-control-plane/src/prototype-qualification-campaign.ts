import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Client } from 'pg'
import { canonicalJson } from './canonical-json.js'
import { runExperiment } from './experiment-runner.js'
import { verifyRunArtifact } from './run-artifact-integrity.js'
import type { PrototypeQualificationProfileV1 } from './prototype-qualification-profile.js'

export type QualificationRunEvidence = {
  experimentId: string
  seed: number
  fault: string
  runId: string
  runPath: string
  status: string
  summary: string
  artifactValid: boolean
}

function experimentSpecs(profile: PrototypeQualificationProfileV1) {
  return [
    ['BASELINE-EXP-01', profile.seeds.baseline],
    ['DUR-EXP-01', profile.seeds.durable],
    ['EXP-02', profile.seeds.discoveryContradiction],
    ['EXP-03', profile.seeds.discoveryEstate],
    ['EXP-04', profile.seeds.discoveryCdc],
    ['EXP-05', profile.seeds.specialist],
    ['EXP-06', profile.seeds.retrieval],
    ['EXP-07', profile.seeds.memory],
    ['EXP-08', profile.seeds.evaluation],
    ['EXP-09', profile.seeds.skillLifecycle],
    ['EXP-11', profile.seeds.safeEffect],
    ['EXP-12', profile.seeds.isolation],
    ['EXP-13', profile.seeds.processCompleteness]
  ] as const
}

async function runOne(
  labRoot: string,
  outputRoot: string,
  experimentId: string,
  seed: number,
  fault: string,
  revision: string
): Promise<QualificationRunEvidence> {
  const result = await runExperiment({
    labRoot,
    outputRoot,
    experimentId,
    seed,
    arm: 'baseline',
    fault,
    prototypeRevision: revision
  })
  const verification = await verifyRunArtifact(result.runPath)
  return {
    experimentId,
    seed,
    fault,
    runId: result.runId,
    runPath: result.runPath,
    status: result.status,
    summary: result.summary,
    artifactValid: verification.valid
  }
}

export async function runPrototypeQualificationExperiments(
  labRoot: string,
  runsRoot: string,
  profile: PrototypeQualificationProfileV1,
  revision: string,
  controlConnectionString: string
): Promise<QualificationRunEvidence[]> {
  const results: QualificationRunEvidence[] = []
  for (const [experimentId, seed] of experimentSpecs(profile)) {
    const previousTarget = process.env.MIGRATION_CONTROL_TARGET_DATABASE_URL
    if (experimentId === 'EXP-13') {
      process.env.MIGRATION_CONTROL_TARGET_DATABASE_URL = controlConnectionString
    }
    try {
      results.push(await runOne(labRoot, runsRoot, experimentId, seed, 'none', revision))
    } finally {
      if (previousTarget === undefined) {
        delete process.env.MIGRATION_CONTROL_TARGET_DATABASE_URL
      } else {
        process.env.MIGRATION_CONTROL_TARGET_DATABASE_URL = previousTarget
      }
    }
  }
  return results
}

export async function runPrototypeQualificationFaults(
  labRoot: string,
  runsRoot: string,
  profile: PrototypeQualificationProfileV1,
  revision: string
): Promise<QualificationRunEvidence[]> {
  const results: QualificationRunEvidence[] = []
  for (const [index, fault] of profile.faultPoints.entries()) {
    results.push(await runOne(labRoot, runsRoot, 'LAB-EXP-01', 30_000 + index, fault, revision))
  }
  return results
}

function databaseUrl(baseConnectionString: string, databaseName: string): string {
  const url = new URL(baseConnectionString)
  url.pathname = `/${databaseName}`
  return url.toString()
}

async function createRepeatDatabase(baseConnectionString: string, databaseName: string) {
  const admin = new Client({ connectionString: databaseUrl(baseConnectionString, 'postgres') })
  await admin.connect()
  await admin.query(`CREATE DATABASE ${databaseName}`)
  await admin.end()
  return async () => {
    const cleanup = new Client({ connectionString: databaseUrl(baseConnectionString, 'postgres') })
    await cleanup.connect()
    await cleanup.query(`DROP DATABASE ${databaseName} WITH (FORCE)`)
    await cleanup.end()
  }
}

export async function runPrototypeQualificationRepeats(
  labRoot: string,
  runsRoot: string,
  profile: PrototypeQualificationProfileV1,
  revision: string,
  baseConnectionString: string
): Promise<{
  equivalent: boolean
  runs: QualificationRunEvidence[]
  outputDigestSource: string
}> {
  const runs: QualificationRunEvidence[] = []
  const outputs: string[] = []
  for (let index = 0; index < profile.repeatRuns; index += 1) {
    const databaseName = `p10_repeat_${process.pid}_${index}`
    const drop = await createRepeatDatabase(baseConnectionString, databaseName)
    const previous = process.env.MIGRATION_CONTROL_DATABASE_URL
    process.env.MIGRATION_CONTROL_DATABASE_URL = databaseUrl(baseConnectionString, databaseName)
    try {
      const run = await runOne(
        labRoot,
        join(runsRoot, `repeat-${String(index + 1).padStart(2, '0')}`),
        'DUR-EXP-01',
        profile.seeds.durable,
        'none',
        revision
      )
      runs.push(run)
      const output = JSON.parse(
        await readFile(join(run.runPath, 'outputs', 'experiment-result.json'), 'utf8')
      ) as unknown
      outputs.push(canonicalJson(output))
    } finally {
      if (previous === undefined) {
        delete process.env.MIGRATION_CONTROL_DATABASE_URL
      } else {
        process.env.MIGRATION_CONTROL_DATABASE_URL = previous
      }
      await drop()
    }
  }
  return {
    equivalent: new Set(outputs).size === 1,
    runs,
    outputDigestSource: outputs[0] ?? ''
  }
}
