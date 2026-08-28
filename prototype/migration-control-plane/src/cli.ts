import { resolve } from 'node:path'
import type { ExperimentArm } from './experiment-contracts.js'
import { runExperiment } from './experiment-runner.js'

const MAX_SEED = 0x7fffffff

type CliOptions = {
  experimentId: string
  seed: number
  arm: ExperimentArm
  fault: string
  outputRoot: string
}

function parseCliOptions(args: readonly string[]): CliOptions {
  if (args[0] !== 'run') throw new TypeError('Expected experiment subcommand: run')
  const values: Record<string, string> = {}
  for (let index = 1; index < args.length; index += 2) {
    const flag = args[index]
    const value = args[index + 1]
    if (!flag?.startsWith('--') || value === undefined || value.startsWith('--')) {
      throw new TypeError(`Invalid argument near ${flag ?? '<end>'}`)
    }
    const key = flag.slice(2)
    if (Object.hasOwn(values, key)) throw new TypeError(`Duplicate argument: --${key}`)
    values[key] = value
  }
  const supported: Record<string, true> = {
    experiment: true,
    seed: true,
    arm: true,
    fault: true,
    output: true
  }
  const unknown = Object.keys(values).filter((key) => !Object.hasOwn(supported, key))
  if (unknown.length > 0) throw new TypeError(`Unknown argument: --${unknown[0]}`)
  const experimentId = values.experiment
  if (!experimentId) throw new TypeError('--experiment is required')
  const seed = Number(values.seed)
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > MAX_SEED) {
    throw new TypeError(`--seed must be an integer from 0 through ${MAX_SEED}`)
  }
  const arm = values.arm ?? 'baseline'
  if (arm !== 'baseline' && arm !== 'candidate') {
    throw new TypeError('--arm must be baseline or candidate')
  }
  return {
    experimentId,
    seed,
    arm,
    fault: values.fault ?? 'none',
    outputRoot: resolve(values.output ?? '.runs')
  }
}

async function main(): Promise<void> {
  try {
    const options = parseCliOptions(process.argv.slice(2))
    const summary = await runExperiment({
      labRoot: process.cwd(),
      outputRoot: options.outputRoot,
      experimentId: options.experimentId,
      seed: options.seed,
      arm: options.arm,
      fault: options.fault
    })
    process.stdout.write(`${JSON.stringify(summary)}\n`)
    process.exitCode = summary.status === 'passed' ? 0 : 1
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${JSON.stringify({ status: 'error', error: message })}\n`)
    process.exitCode = 2
  }
}

await main()
