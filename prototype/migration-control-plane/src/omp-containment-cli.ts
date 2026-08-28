import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { canonicalJson, sha256Text } from './canonical-json.js'
import { runOmpContainmentExperiment } from './omp-containment-experiment.js'
import { RunArtifactStore } from './run-artifact-store.js'
import {
  reconstructionContextAuthority,
  reconstructionContextManifest,
  reconstructionContextSources
} from './s1-agent-context-fixture.js'

const REQUIRED_OMP_VERSION = '18.0.6'
const ARGUMENTS = new Set(['--omp-binary', '--omp-digest', '--output', '--prototype-revision'])

function parseArguments(argv: readonly string[]): Record<string, string> {
  const argumentsList = argv[0] === '--' ? argv.slice(1) : argv
  const parsed: Record<string, string> = {}
  for (let index = 0; index < argumentsList.length; index += 2) {
    const name = argumentsList[index]
    const value = argumentsList[index + 1]
    if (name === undefined || !ARGUMENTS.has(name) || value === undefined || value.length === 0) {
      throw new TypeError(
        'Usage: --omp-binary <path> --omp-digest <sha256> --output <dir> --prototype-revision <revision>'
      )
    }
    parsed[name] = value
  }
  if ([...ARGUMENTS].some((name) => parsed[name] === undefined)) {
    throw new TypeError('All OMP containment arguments are required')
  }
  return parsed
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2))
  const startedAt = new Date().toISOString()
  const baseDirectory = await mkdtemp(join(tmpdir(), 'orca-omp-containment-'))
  try {
    const contextManifest = reconstructionContextManifest()
    const report = await runOmpContainmentExperiment({
      executable: resolve(args['--omp-binary']!),
      requiredVersion: REQUIRED_OMP_VERSION,
      requiredExecutableDigest: args['--omp-digest']!,
      baseDirectory,
      parentEnv: process.env,
      contextManifest,
      contextAuthority: reconstructionContextAuthority(),
      contextSources: reconstructionContextSources,
      startedAt
    })
    const store = await RunArtifactStore.create(resolve(args['--output']!), {
      schemaVersion: 1,
      runId: report.runId,
      experimentId: report.experimentId,
      seed: 412,
      arm: 'baseline',
      fault: null,
      createdAt: startedAt,
      fixtureId: 's1-agent-context-fixture',
      fixtureDigest: sha256Text(canonicalJson(contextManifest)),
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        prototypeRevision: args['--prototype-revision']!
      }
    })
    await store.writeJson('outputs/containment-report.json', report)
    await store.writeJson('outputs/experiment-result.json', {
      status: report.status,
      summary:
        report.status === 'passed'
          ? 'Pinned OMP RPC containment passed every mandatory measure.'
          : 'Pinned OMP RPC containment failed one or more mandatory measures.',
      measures: report.measures.map((measure) => ({
        name: measure.name,
        status: measure.passed ? 'pass' : 'fail',
        value: measure.evidence,
        threshold: 'must pass',
        evidence: [measure.evidence]
      })),
      outputs: {
        reportDigest: report.reportDigest,
        contextDeliveryDigest: report.contextDeliveryDigest,
        executableDigest: report.executableDigest
      },
      limitations: [
        'The prompt path uses the isolated real RPC process without production model credentials or customer data.'
      ]
    })
    const finalPath = await store.finalize(report.status, report.completedAt)
    process.stdout.write(`${canonicalJson({ finalPath, report })}`)
    if (report.status !== 'passed') {
      process.exitCode = 1
    }
  } finally {
    await rm(baseDirectory, { recursive: true, force: true })
  }
}

await main()
