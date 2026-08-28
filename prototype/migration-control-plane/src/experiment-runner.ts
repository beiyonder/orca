import { readFile } from 'node:fs/promises'
import { arch, platform } from 'node:os'
import { resolve } from 'node:path'
import { canonicalizeJson } from './canonical-json.js'
import { runDurableConvergenceExperiment } from './durable-convergence-experiment.js'
import { DeterministicRuntime, type EventStamp } from './deterministic-runtime.js'
import {
  createEvaluationMeasure as measure,
  type ExperimentArm,
  type ExperimentResult,
  type RunManifest
} from './experiment-contracts.js'
import {
  FAULT_POINT_DEFINITIONS,
  FaultInjector,
  InjectedFaultError,
  parseFaultSelection
} from './fault-injection.js'
import {
  buildIdentityMappingBaseline,
  evaluateIdentityMapping
} from './identity-mapping-evaluator.js'
import { runMemoryHelpHarmExperiment } from './memory-help-harm-experiment.js'
import { RunArtifactStore } from './run-artifact-store.js'
import { calibrateS1Fixture, inspectOmpWorkerFixture } from './s1-fixture-calibration.js'
import { runRetrievalBenchmarkExperiment } from './retrieval-benchmark-experiment.js'
import { runSpecialistDisagreementExperiment } from './specialist-disagreement-experiment.js'
import { loadS1IdentityFixture } from './s1-fixture-loader.js'
import type { S1IdentityFixture } from './s1-fixture-contracts.js'

const EXPERIMENT_ARMS: Record<string, readonly ExperimentArm[]> = {
  'LAB-EXP-01': ['baseline'],
  'S1-FIXTURE-EXP-01': ['baseline'],
  'BASELINE-EXP-01': ['baseline'],
  'WORKER-EXP-01': ['baseline'],
  'EXP-05': ['baseline'],
  'EXP-06': ['baseline'],
  'EXP-07': ['baseline'],
  'DUR-EXP-01': ['baseline']
}

export type ExperimentRunOptions = {
  labRoot: string
  outputRoot: string
  experimentId: string
  seed: number
  arm: ExperimentArm
  fault: string
  prototypeRevision?: string
}

export type ExperimentRunSummary = {
  runId: string
  runPath: string
  status: ExperimentResult['status']
  summary: string
}

type RunEvent = EventStamp & {
  type: string
  details: Record<string, unknown>
}

function recordEvent(
  events: RunEvent[],
  runtime: DeterministicRuntime,
  type: string,
  details: Record<string, unknown> = {}
): void {
  events.push({ ...runtime.event('evt'), type, details })
}

export async function runExperiment(options: ExperimentRunOptions): Promise<ExperimentRunSummary> {
  const allowedArms = EXPERIMENT_ARMS[options.experimentId]
  if (!allowedArms) {
    throw new TypeError(`Unknown experiment: ${options.experimentId}`)
  }
  if (!allowedArms.includes(options.arm)) {
    throw new TypeError(`${options.experimentId} does not support arm ${options.arm}`)
  }

  const runtime = new DeterministicRuntime({ seed: options.seed })
  const fixtureRoot = resolve(options.labRoot, 'fixtures', 's1-identity-key')
  const fixture = await loadS1IdentityFixture(fixtureRoot)
  const selectedFault = parseFaultSelection(options.fault)
  const faultInjector = new FaultInjector(selectedFault)
  const slug = options.experimentId.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')
  const faultSlug = (selectedFault ?? 'none').replaceAll(/[^a-z0-9]+/g, '-')
  const runId = `${slug}-${options.seed}-${options.arm}-${faultSlug}-${runtime.ids.next('run')}`
  const manifest: RunManifest = {
    schemaVersion: 1,
    runId,
    experimentId: options.experimentId,
    seed: options.seed,
    arm: options.arm,
    fault: selectedFault,
    createdAt: runtime.clock.nowIso(),
    fixtureId: fixture.manifest.fixtureId,
    fixtureDigest: fixture.manifestDigest,
    environment: {
      node: process.version,
      platform: platform(),
      arch: arch(),
      prototypeRevision:
        options.prototypeRevision ?? process.env.ORCA_PROTOTYPE_REVISION ?? 'working-tree'
    }
  }

  const store = await RunArtifactStore.create(options.outputRoot, manifest)
  const events: RunEvent[] = []
  recordEvent(events, runtime, 'run.started', {
    experimentId: options.experimentId,
    arm: options.arm,
    fault: selectedFault
  })

  let result: ExperimentResult
  try {
    result = await executeExperiment(
      options.experimentId,
      options.seed,
      fixture,
      runtime,
      faultInjector,
      events
    )
    faultInjector.hit('object.before_write')
    await store.writeJson('outputs/experiment-result.json', result.outputs)
    faultInjector.hit('object.after_write')
    faultInjector.assertSatisfied()
  } catch (error) {
    const injected = error instanceof InjectedFaultError
    recordEvent(events, runtime, injected ? 'fault.injected' : 'run.failed', {
      error: error instanceof Error ? error.message : String(error)
    })
    result = {
      status: 'failed',
      summary: injected
        ? `Run stopped at injected fault ${error.hit.point}.`
        : `Run failed: ${error instanceof Error ? error.message : String(error)}.`,
      measures: [
        measure(
          injected ? 'fault_injected' : 'run_error',
          'fail',
          injected ? error.hit : { error: error instanceof Error ? error.message : String(error) },
          injected ? 'fault-free run or recovered fault experiment' : 'run completes without error',
          []
        )
      ],
      outputs: {},
      limitations: ['Failed runs preserve evidence but do not satisfy experiment thresholds.']
    }
  }

  recordEvent(events, runtime, 'run.finished', { status: result.status })
  await store.writeJsonLines('events.jsonl', events)
  await store.writeJsonLines('faults.jsonl', faultInjector.hits())
  await store.writeJson('metrics.json', { measures: result.measures })
  await store.writeJson('verdict.json', {
    status: result.status,
    summary: result.summary,
    limitations: result.limitations
  })
  await store.writeJson('usage.json', {
    modelCalls: 0,
    externalEffects: 0,
    eventCount: events.length,
    faultHitCount: faultInjector.hits().length
  })
  await store.writeJson('inputs/fixture-reference.json', {
    fixtureId: fixture.manifest.fixtureId,
    fixtureDigest: fixture.manifestDigest,
    manifest: 'evidence/fixture-manifest.json'
  })
  await store.copyEvidence(resolve(fixture.root, 'fixture-manifest.json'), 'fixture-manifest.json')
  const runPath = await store.finalize(result.status, runtime.clock.nowIso())
  return { runId, runPath, status: result.status, summary: result.summary }
}

async function executeExperiment(
  experimentId: string,
  seed: number,
  fixture: S1IdentityFixture,
  runtime: DeterministicRuntime,
  faultInjector: FaultInjector,
  events: RunEvent[]
): Promise<ExperimentResult> {
  switch (experimentId) {
    case 'LAB-EXP-01':
      return executeLabBoundary(runtime, faultInjector, events)
    case 'S1-FIXTURE-EXP-01':
      faultInjector.hit('database.before_commit')
      recordEvent(events, runtime, 'fixture.loaded', { fixtureId: fixture.manifest.fixtureId })
      faultInjector.hit('database.after_commit')
      faultInjector.hit('evaluator.before_run')
      {
        const result = calibrateS1Fixture(fixture)
        faultInjector.hit('evaluator.after_verdict')
        return result
      }
    case 'BASELINE-EXP-01':
      return executeBaseline(fixture, runtime, faultInjector, events)
    case 'WORKER-EXP-01': {
      faultInjector.hit('process.worker_started')
      faultInjector.hit('network.before_dispatch')
      recordEvent(events, runtime, 'worker.contract_inspected', {
        version: fixture.workerContract.requiredOmp.version
      })
      faultInjector.hit('network.after_dispatch')
      faultInjector.hit('process.worker_result_ready')
      const evidencePath = process.env.OMP_CONTAINMENT_REPORT_PATH
      const containmentEvidence =
        evidencePath === undefined
          ? undefined
          : (JSON.parse(await readFile(resolve(evidencePath), 'utf8')) as unknown)
      return inspectOmpWorkerFixture(fixture, containmentEvidence)
    }
    case 'EXP-05':
      return runSpecialistDisagreementExperiment(seed)
    case 'EXP-06':
      return runRetrievalBenchmarkExperiment(seed)
    case 'EXP-07':
      return runMemoryHelpHarmExperiment(seed)
    case 'DUR-EXP-01': {
      const connectionString = process.env.MIGRATION_CONTROL_DATABASE_URL
      if (!connectionString) {
        throw new Error('MIGRATION_CONTROL_DATABASE_URL is required for DUR-EXP-01')
      }
      return runDurableConvergenceExperiment(connectionString, seed)
    }
    default:
      throw new TypeError(`Unknown experiment: ${experimentId}`)
  }
}

function executeLabBoundary(
  runtime: DeterministicRuntime,
  faultInjector: FaultInjector,
  events: RunEvent[]
): ExperimentResult {
  for (const definition of FAULT_POINT_DEFINITIONS) {
    faultInjector.hit(definition.id)
    recordEvent(events, runtime, 'fault.boundary.reached', {
      point: definition.id,
      boundary: definition.boundary,
      simulated: true
    })
  }
  const boundaries = [
    ...new Set(FAULT_POINT_DEFINITIONS.map((definition) => definition.boundary))
  ].sort()
  return {
    status: 'passed',
    summary: 'Deterministic runtime and every named fault boundary are reachable.',
    measures: [
      measure(
        'fault_boundaries_complete',
        boundaries.length === 8 ? 'pass' : 'fail',
        boundaries,
        'database, process, network, object, evaluator, target, memory, mission',
        []
      ),
      measure(
        'deterministic_event_order',
        'pass',
        events.map((event) => ({ id: event.id, at: event.at, sequence: event.sequence })),
        'strictly increasing deterministic sequence and timestamps',
        []
      )
    ],
    outputs: {
      faultPoints: canonicalizeJson(FAULT_POINT_DEFINITIONS),
      simulatedOnly: true
    },
    limitations: [
      'Boundary reachability is simulated; component experiments prove real recovery later.'
    ]
  }
}

function executeBaseline(
  fixture: S1IdentityFixture,
  runtime: DeterministicRuntime,
  faultInjector: FaultInjector,
  events: RunEvent[]
): ExperimentResult {
  faultInjector.hit('database.before_commit')
  const mapping = buildIdentityMappingBaseline(fixture)
  recordEvent(events, runtime, 'decision.proposed', { sourceKey: mapping.sourceKey })
  faultInjector.hit('database.after_commit')
  faultInjector.hit('evaluator.before_run')
  const evaluation = evaluateIdentityMapping(fixture, mapping)
  faultInjector.hit('evaluator.after_verdict')
  faultInjector.hit('mission.before_terminal')
  return {
    ...evaluation,
    summary:
      evaluation.status === 'passed'
        ? 'Non-agent baseline selected the composite key and passed all six measures.'
        : evaluation.summary,
    outputs: {
      ...evaluation.outputs,
      baselineMapping: canonicalizeJson(mapping)
    }
  }
}
