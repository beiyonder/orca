import type { ChildProcess } from 'node:child_process'
import { spawnAgentProcess } from './agent-process-spawn.js'
import { terminateAgentProcessTree } from './agent-process-termination.js'
import {
  OMP_RPC_MAX_PHYSICAL_FRAME_BYTES,
  OmpRpcFrameStreamDecoder
} from './omp-rpc-frame-decoder.js'
import type { OmpRpcFrame } from './omp-rpc-frame-contracts.js'

export type OmpRpcProcessSpec = {
  program: string
  args: readonly string[]
  cwd: string
  env: NodeJS.ProcessEnv
  startupTimeoutMs?: number
  cancellationGraceMs?: number
  forceKillTimeoutMs?: number
}

export type OmpRpcCommand = {
  id: string
  type: string
  [key: string]: unknown
}

export class OmpRpcProcessError extends Error {
  readonly code: string
  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'OmpRpcProcessError'
    this.code = code
  }
}

function failure(code: string, message: string, cause?: unknown): OmpRpcProcessError {
  return new OmpRpcProcessError(code, message, cause === undefined ? undefined : { cause })
}

export class OmpRpcProcessClient {
  readonly #child: ChildProcess
  readonly #decoder = new OmpRpcFrameStreamDecoder()
  readonly #pending = new Map<
    string,
    { resolve: (frame: OmpRpcFrame) => void; reject: (error: unknown) => void }
  >()
  readonly #frames: OmpRpcFrame[] = []
  readonly #waiters = new Set<{
    predicate: (frame: OmpRpcFrame) => boolean
    resolve: (frame: OmpRpcFrame) => void
    reject: (error: unknown) => void
    timer: NodeJS.Timeout
  }>()
  readonly #cancellationGraceMs: number
  readonly #forceKillTimeoutMs: number
  readonly #readyPromise: Promise<OmpRpcFrame>
  readonly #resolveReady: (frame: OmpRpcFrame) => void
  readonly #rejectReady: (error: unknown) => void
  readonly #exitPromise: Promise<{ code: number | null; signal: NodeJS.Signals | null }>
  readonly #resolveExit: (result: { code: number | null; signal: NodeJS.Signals | null }) => void
  #ready = false
  #closed = false
  #stderr = ''
  #fatalError: OmpRpcProcessError | null = null

  private constructor(spec: OmpRpcProcessSpec) {
    this.#cancellationGraceMs = spec.cancellationGraceMs ?? 250
    this.#forceKillTimeoutMs = spec.forceKillTimeoutMs ?? 2_000
    const ready = Promise.withResolvers<OmpRpcFrame>()
    this.#readyPromise = ready.promise
    this.#resolveReady = ready.resolve
    this.#rejectReady = ready.reject
    const exit = Promise.withResolvers<{ code: number | null; signal: NodeJS.Signals | null }>()
    this.#exitPromise = exit.promise
    this.#resolveExit = exit.resolve
    this.#child = spawnAgentProcess({
      program: spec.program,
      args: spec.args,
      cwd: spec.cwd,
      env: spec.env,
      detached: process.platform !== 'win32',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    this.#bindChild()
  }

  static async launch(spec: OmpRpcProcessSpec): Promise<OmpRpcProcessClient> {
    const client = new OmpRpcProcessClient(spec)
    const timeout = setTimeout(() => {
      client.#rejectReady(
        failure(
          'startup_timeout',
          `OMP did not emit ready before the deadline; stderr=${client.stderr || '<empty>'}`
        )
      )
    }, spec.startupTimeoutMs ?? 10_000)
    try {
      await client.#readyPromise
      return client
    } catch (error) {
      await client.close()
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  get pid(): number | undefined {
    return this.#child.pid
  }

  get protocolVersion(): 1 | 2 {
    return this.#decoder.protocolVersion
  }

  get frames(): readonly OmpRpcFrame[] {
    return this.#frames
  }

  get stderr(): string {
    return this.#stderr
  }

  async command(command: OmpRpcCommand, timeoutMs = 5_000): Promise<OmpRpcFrame> {
    if (this.#closed) {
      throw failure('process_closed', 'OMP process is closed')
    }
    if (this.#pending.has(command.id)) {
      throw failure('duplicate_command_id', `OMP command ID is already pending: ${command.id}`)
    }
    const response = Promise.withResolvers<OmpRpcFrame>()
    const timeout = setTimeout(() => {
      response.reject(failure('command_timeout', `OMP command timed out: ${command.type}`))
    }, timeoutMs)
    this.#pending.set(command.id, { resolve: response.resolve, reject: response.reject })
    try {
      await this.sendRaw(`${JSON.stringify(command)}\n`)
      return await response.promise
    } finally {
      clearTimeout(timeout)
      this.#pending.delete(command.id)
    }
  }

  async sendRaw(frame: string | Uint8Array): Promise<void> {
    if (this.#closed || this.#child.stdin === null) {
      throw failure('process_closed', 'OMP stdin is unavailable')
    }
    const bytes = typeof frame === 'string' ? Buffer.from(frame) : Buffer.from(frame)
    let physicalFrameBytes = 0
    for (const byte of bytes) {
      if (byte === 0x0a) {
        physicalFrameBytes = 0
        continue
      }
      physicalFrameBytes += 1
      if (physicalFrameBytes > OMP_RPC_MAX_PHYSICAL_FRAME_BYTES) {
        throw failure('outgoing_frame_too_large', 'Outgoing OMP frame exceeds the physical limit')
      }
    }
    const write = Promise.withResolvers<void>()
    this.#child.stdin.write(bytes, (error) => {
      if (error) {
        write.reject(error)
      } else {
        write.resolve()
      }
    })
    await write.promise
  }

  waitForFrame(
    predicate: (frame: OmpRpcFrame) => boolean,
    timeoutMs = 5_000
  ): Promise<OmpRpcFrame> {
    const existing = this.#frames.find(predicate)
    if (existing) {
      return Promise.resolve(existing)
    }
    if (this.#closed) {
      return Promise.reject(failure('process_closed', 'OMP process is closed'))
    }
    const pending = Promise.withResolvers<OmpRpcFrame>()
    const waiter = {
      predicate,
      resolve: pending.resolve,
      reject: pending.reject,
      timer: setTimeout(() => {
        this.#waiters.delete(waiter)
        pending.reject(failure('frame_timeout', 'Expected OMP frame did not arrive'))
      }, timeoutMs)
    }
    this.#waiters.add(waiter)
    return pending.promise
  }

  waitForExit(): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
    return this.#exitPromise
  }

  async close(): Promise<void> {
    if (this.#closed) {
      return
    }
    this.#closed = true
    const terminated = await terminateAgentProcessTree(this.#child, {
      graceMs: this.#cancellationGraceMs,
      forceTimeoutMs: this.#forceKillTimeoutMs
    })
    if (!terminated) {
      throw failure('termination_unverified', 'OMP process-tree exit was not verified')
    }
  }

  #bindChild(): void {
    this.#child.stdout?.on('data', (chunk: Buffer | string) => {
      try {
        for (const frame of this.#decoder.push(chunk)) {
          this.#acceptFrame(frame)
        }
      } catch (error) {
        this.#fail(failure('invalid_omp_output', 'OMP emitted an invalid frame', error))
      }
    })
    this.#child.stderr?.on('data', (chunk: Buffer | string) => {
      if (this.#stderr.length < 64 * 1024) {
        this.#stderr += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk
        this.#stderr = this.#stderr.slice(0, 64 * 1024)
      }
    })
    this.#child.once('error', (error) => {
      this.#fail(failure('spawn_failed', 'OMP process failed to start', error))
    })
    this.#child.once('close', (code, signal) => {
      try {
        this.#decoder.finish()
      } catch (error) {
        this.#fail(failure('truncated_omp_output', 'OMP output ended mid-frame', error))
      }
      this.#closed = true
      const closeError =
        this.#fatalError ??
        failure('process_exited', `OMP exited (${String(code)}, ${String(signal)})`)
      this.#rejectAll(closeError)
      this.#resolveExit({ code, signal })
    })
  }

  #acceptFrame(frame: OmpRpcFrame): void {
    this.#frames.push(frame)
    if (frame.category === 'ready' && !this.#ready) {
      this.#ready = true
      this.#resolveReady(frame)
    }
    if ('id' in frame.value && typeof frame.value.id === 'string') {
      this.#pending.get(frame.value.id)?.resolve(frame)
    }
    for (const waiter of this.#waiters) {
      if (!waiter.predicate(frame)) {
        continue
      }
      clearTimeout(waiter.timer)
      this.#waiters.delete(waiter)
      waiter.resolve(frame)
    }
  }

  #fail(error: OmpRpcProcessError): void {
    if (this.#fatalError !== null) {
      return
    }
    this.#fatalError = error
    this.#rejectReady(error)
    this.#rejectAll(error)
    void this.close()
  }

  #rejectAll(error: OmpRpcProcessError): void {
    for (const pending of this.#pending.values()) {
      pending.reject(error)
    }
    for (const waiter of this.#waiters) {
      clearTimeout(waiter.timer)
      waiter.reject(error)
    }
    this.#waiters.clear()
  }
}
