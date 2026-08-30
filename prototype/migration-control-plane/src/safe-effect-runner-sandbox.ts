import { Script, createContext } from 'node:vm'
import { canonicalJson, sha256Text, type JsonValue } from './canonical-json.js'

export type SafeEffectRunnerLimits = {
  cpuTimeMs: number
  inputBytes: number
  outputBytes: number
  memoryBytes: number
}

export type SafeEffectRunnerSandboxOptions = {
  source: string
  expectedDigest: string
  limits: SafeEffectRunnerLimits
}

export type SafeEffectRunnerResult = {
  output: JsonValue
  runnerDigest: string
  limits: SafeEffectRunnerLimits
}

export class SafeEffectRunnerError extends Error {
  readonly code: string

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SafeEffectRunnerError'
    this.code = code
  }
}

export class SafeEffectRunnerSandbox {
  readonly #source: string
  readonly #runnerDigest: string
  readonly #limits: SafeEffectRunnerLimits

  constructor(options: SafeEffectRunnerSandboxOptions) {
    const digest = sha256Text(options.source)
    if (digest !== options.expectedDigest) {
      throw new SafeEffectRunnerError('runner_digest_mismatch', 'Runner source is not trusted')
    }
    if (
      options.limits.cpuTimeMs < 1 ||
      options.limits.inputBytes < 1 ||
      options.limits.outputBytes < 1 ||
      options.limits.memoryBytes < options.limits.inputBytes + options.limits.outputBytes
    ) {
      throw new SafeEffectRunnerError('invalid_limits', 'Runner resource limits are invalid')
    }
    this.#source = options.source
    this.#runnerDigest = digest
    this.#limits = { ...options.limits }
  }

  run(input: JsonValue): SafeEffectRunnerResult {
    const inputJson = canonicalJson(input)
    if (Buffer.byteLength(inputJson, 'utf8') > this.#limits.inputBytes) {
      throw new SafeEffectRunnerError('input_limit', 'Runner input exceeds its byte limit')
    }
    const sandbox = Object.create(null) as Record<string, unknown>
    sandbox.input = JSON.parse(inputJson) as JsonValue
    sandbox.output = null
    const context = createContext(sandbox, {
      name: 'safe-effect-runner',
      codeGeneration: { strings: false, wasm: false }
    })
    try {
      new Script(`"use strict";\n${this.#source}`, {
        filename: `safe-effect-runner-${this.#runnerDigest.slice(0, 12)}.js`
      }).runInContext(context, { timeout: this.#limits.cpuTimeMs, breakOnSigint: true })
    } catch (error) {
      throw new SafeEffectRunnerError('runner_failed', 'Sandboxed runner failed', { cause: error })
    }
    const output = context.output as unknown
    const outputJson = canonicalJson(output)
    if (Buffer.byteLength(outputJson, 'utf8') > this.#limits.outputBytes) {
      throw new SafeEffectRunnerError('output_limit', 'Runner output exceeds its byte limit')
    }
    const retainedBytes =
      Buffer.byteLength(inputJson, 'utf8') + Buffer.byteLength(outputJson, 'utf8')
    if (retainedBytes > this.#limits.memoryBytes) {
      throw new SafeEffectRunnerError('memory_limit', 'Runner retained data exceeds memory limit')
    }
    return {
      output: JSON.parse(outputJson) as JsonValue,
      runnerDigest: this.#runnerDigest,
      limits: { ...this.#limits }
    }
  }
}
