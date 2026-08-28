import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ChildProcess } from 'node:child_process'
import { spawnAgentProcess } from './agent-process-spawn.js'
import { terminateAgentProcessTree } from './agent-process-termination.js'
import {
  deliverContextManifest,
  type ContextManifestDeliveryAuthority,
  type ContextManifestSource
} from './omp-context-manifest-delivery.js'
import { prepareIsolatedOmpEnvironment } from './omp-isolated-environment.js'
import { OmpRpcProcessClient } from './omp-rpc-process-client.js'
import type { OmpRpcFrame } from './omp-rpc-frame-contracts.js'

export type OmpContainmentRuntimeInput = {
  executable: string
  baseDirectory: string
  parentEnv?: NodeJS.ProcessEnv
  contextManifest: unknown
  contextAuthority: ContextManifestDeliveryAuthority
  contextSources: readonly ContextManifestSource[]
  modelBaseUrl: string
}

export type RunningContainmentOmp = {
  client: OmpRpcProcessClient
  deliveryDigest: string
  deliveryMessage: string
  workspace: string
  dispose: () => Promise<void>
}

function modelConfig(baseUrl: string): string {
  return `providers:
  containment:
    baseUrl: ${baseUrl}
    auth: none
    api: openai-completions
    models:
      - id: deterministic
        name: Deterministic containment model
        reasoning: false
        input: [text]
        cost:
          input: 0
          output: 0
          cacheRead: 0
          cacheWrite: 0
        contextWindow: 128000
        maxTokens: 4096
`
}

async function collectVersion(child: ChildProcess): Promise<string> {
  const settled = Promise.withResolvers<string>()
  let stdout = ''
  let stderr = ''
  const timer = setTimeout(() => {
    settled.reject(new Error('OMP version probe timed out'))
    void terminateAgentProcessTree(child, { graceMs: 100, forceTimeoutMs: 2_000 })
  }, 10_000)
  child.stdout?.on('data', (chunk: Buffer | string) => {
    stdout += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk
  })
  child.stderr?.on('data', (chunk: Buffer | string) => {
    stderr += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk
  })
  child.once('error', settled.reject)
  child.once('close', (code) => {
    if (code === 0) {
      settled.resolve(stdout.trim())
    } else {
      settled.reject(new Error(`OMP version probe failed (${String(code)}): ${stderr.trim()}`))
    }
  })
  try {
    return await settled.promise
  } finally {
    clearTimeout(timer)
  }
}

export class OmpContainmentRuntime {
  readonly #input: OmpContainmentRuntimeInput
  readonly #instances: RunningContainmentOmp[] = []

  constructor(input: OmpContainmentRuntimeInput) {
    this.#input = input
  }

  get frames(): readonly OmpRpcFrame[] {
    return this.#instances.flatMap((instance) => instance.client.frames)
  }

  async readVersion(): Promise<string> {
    const environment = await prepareIsolatedOmpEnvironment({
      baseDirectory: this.#input.baseDirectory,
      incarnationId: 'exp10-version',
      ...(this.#input.parentEnv === undefined ? {} : { parentEnv: this.#input.parentEnv })
    })
    try {
      return await collectVersion(
        spawnAgentProcess({
          program: this.#input.executable,
          args: ['--version'],
          cwd: environment.directories.workspace,
          env: environment.env,
          detached: process.platform !== 'win32',
          stdio: ['ignore', 'pipe', 'pipe']
        })
      )
    } finally {
      await environment.dispose()
    }
  }

  async launch(incarnationId: string): Promise<RunningContainmentOmp> {
    const environment = await prepareIsolatedOmpEnvironment({
      baseDirectory: this.#input.baseDirectory,
      incarnationId,
      ...(this.#input.parentEnv === undefined ? {} : { parentEnv: this.#input.parentEnv })
    })
    try {
      await Promise.all([
        writeFile(join(environment.directories.agent, 'config.yml'), 'setupVersion: 2\n', {
          encoding: 'utf8',
          flag: 'wx',
          mode: 0o600
        }),
        writeFile(
          join(environment.directories.agent, 'models.yml'),
          modelConfig(this.#input.modelBaseUrl),
          {
            encoding: 'utf8',
            flag: 'wx',
            mode: 0o600
          }
        )
      ])
      const delivery = await deliverContextManifest({
        workspaceDirectory: environment.directories.workspace,
        commandId: `context-${incarnationId}`,
        manifest: this.#input.contextManifest,
        authority: this.#input.contextAuthority,
        sources: this.#input.contextSources
      })
      const client = await OmpRpcProcessClient.launch({
        program: this.#input.executable,
        args: [
          '--mode',
          'rpc',
          '--no-tools',
          '--no-extensions',
          '--no-skills',
          '--no-rules',
          '--no-session',
          '--model',
          'containment/deterministic',
          '--cwd',
          environment.directories.workspace
        ],
        cwd: environment.directories.workspace,
        env: environment.env,
        startupTimeoutMs: 15_000,
        cancellationGraceMs: 250,
        forceKillTimeoutMs: 5_000
      })
      const running = {
        client,
        deliveryDigest: delivery.deliveryDigest,
        deliveryMessage: delivery.promptCommand.message,
        workspace: environment.directories.workspace,
        dispose: async () => {
          await client.close()
          await environment.dispose()
        }
      }
      this.#instances.push(running)
      return running
    } catch (error) {
      await environment.dispose()
      throw error
    }
  }

  async dispose(): Promise<void> {
    await Promise.all(this.#instances.map(async (instance) => instance.dispose()))
  }
}
