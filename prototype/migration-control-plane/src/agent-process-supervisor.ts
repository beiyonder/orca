import {
  AgentProcessSpecError,
  AgentProcessStartError,
  AgentProcessStateError,
  type AgentProcessObserver,
  type AgentProcessResult,
  type AgentProcessSnapshot,
  type AgentProcessSpec,
  type AgentProcessStatus,
  type AgentProcessTermination
} from './agent-process-contracts.js'
import { spawnAgentProcess, type AgentChildProcess } from './agent-process-spawn.js'
import {
  cleanupResidualAgentProcessTree,
  terminateAgentProcessTree
} from './agent-process-termination.js'
import { normalizeAgentProcessSpec, type NormalizedAgentProcessSpec } from './agent-process-spec.js'
import { AgentProcessObservation } from './agent-process-observation.js'

function nowIso(): string {
  return new Date().toISOString()
}

export class AgentProcessSupervisor {
  readonly #spec: NormalizedAgentProcessSpec
  readonly #observation: AgentProcessObservation
  readonly #resultPromise: Promise<AgentProcessResult>
  readonly #resolveResult: (result: AgentProcessResult) => void
  #status: AgentProcessStatus = 'idle'
  #child: AgentChildProcess | null = null
  #startedAt: string | null = null
  #endedAt: string | null = null
  #cancellationReason: string | null = null
  #startupTimer: NodeJS.Timeout | null = null
  #runtimeTimer: NodeJS.Timeout | null = null
  #startResolve: ((snapshot: AgentProcessSnapshot) => void) | null = null
  #startReject: ((error: unknown) => void) | null = null
  #startSettled = false
  #finalized = false
  #cancellationPromise: Promise<AgentProcessResult> | null = null
  #pendingClose: { code: number | null; signal: NodeJS.Signals | null } | null = null

  constructor(spec: AgentProcessSpec) {
    this.#spec = normalizeAgentProcessSpec(spec)
    this.#observation = new AgentProcessObservation(this.#spec.maxOutputBytes, () =>
      this.snapshot()
    )
    const result = Promise.withResolvers<AgentProcessResult>()
    this.#resultPromise = result.promise
    this.#resolveResult = result.resolve
  }

  snapshot(): AgentProcessSnapshot {
    const output = this.#observation.output()
    return {
      incarnationId: this.#spec.incarnationId,
      status: this.#status,
      pid: this.#child?.pid ?? null,
      startedAt: this.#startedAt,
      endedAt: this.#endedAt,
      cancellationReason: this.#cancellationReason,
      ...output
    }
  }

  observe(observer: AgentProcessObserver): () => void {
    return this.#observation.observe(observer)
  }

  start(): Promise<AgentProcessSnapshot> {
    if (this.#status !== 'idle') {
      throw new AgentProcessStateError(`Cannot start child from ${this.#status}`)
    }
    const started = Promise.withResolvers<AgentProcessSnapshot>()
    this.#startResolve = started.resolve
    this.#startReject = started.reject
    this.#setStatus('starting')
    try {
      this.#child = spawnAgentProcess({
        program: this.#spec.program,
        args: this.#spec.args,
        cwd: this.#spec.cwd,
        env: this.#spec.env,
        detached: process.platform !== 'win32',
        stdio: ['pipe', 'pipe', 'pipe']
      })
    } catch (error) {
      this.#failStart(error)
      return started.promise
    }
    this.#bindChild(this.#child)
    this.#startupTimer = setTimeout(() => {
      void this.#handleStartupTimeout()
    }, this.#spec.startupTimeoutMs)
    return started.promise
  }

  wait(): Promise<AgentProcessResult> {
    if (this.#status === 'idle') {
      throw new AgentProcessStateError('Cannot wait before the child is started')
    }
    return this.#resultPromise
  }

  cancel(reason = 'cancelled'): Promise<AgentProcessResult> {
    if (reason.length === 0 || reason.length > 512) {
      throw new AgentProcessSpecError('Cancellation reason must contain 1 through 512 characters')
    }
    if (this.#status === 'idle') {
      throw new AgentProcessStateError('Cannot cancel before the child is started')
    }
    if (this.#finalized) {
      return this.#resultPromise
    }
    if (this.#cancellationPromise) {
      return this.#cancellationPromise
    }
    this.#cancellationReason = reason
    this.#clearTimers()
    this.#setStatus('cancelling')
    this.#cancellationPromise = this.#cancelChild()
    return this.#cancellationPromise
  }

  async dispose(): Promise<void> {
    if (this.#status !== 'idle' && !this.#finalized) {
      await this.cancel('supervisor-disposed')
    }
    this.#observation.clearObservers()
  }

  async #cancelChild(): Promise<AgentProcessResult> {
    const child = this.#child
    const verified = child
      ? await terminateAgentProcessTree(child, {
          graceMs: this.#spec.cancellationGraceMs,
          forceTimeoutMs: this.#spec.forceKillTimeoutMs
        })
      : true
    if (!this.#finalized) {
      const close = this.#pendingClose
      await this.#complete(
        close?.code ?? child?.exitCode ?? null,
        close?.signal ?? child?.signalCode ?? null,
        verified ? 'exited' : 'unverifiable',
        !verified,
        true
      )
    }
    return this.#resultPromise
  }

  #bindChild(child: AgentChildProcess): void {
    child.stdout?.on('data', (chunk: Buffer | string) => {
      this.#observation.writeStdout(chunk)
    })
    child.stderr?.on('data', (chunk: Buffer | string) => {
      this.#observation.writeStderr(chunk)
    })
    child.stdout?.on('error', () => {})
    child.stderr?.on('error', () => {})
    child.once('spawn', () => {
      if (this.#status !== 'starting') {
        return
      }
      this.#startedAt = nowIso()
      this.#setStatus('running')
      this.#settleStart(true)
      if (this.#spec.runtimeTimeoutMs !== null) {
        this.#runtimeTimer = setTimeout(() => {
          void this.cancel('runtime-timeout')
        }, this.#spec.runtimeTimeoutMs)
      }
    })
    child.once('error', (error) => {
      if (!this.#startSettled) {
        this.#failStart(error)
        return
      }
      this.#observation.writeStderr(error.message)
    })
    child.once('close', (code, signal) => {
      if (this.#status === 'cancelling') {
        this.#pendingClose = { code, signal }
        return
      }
      void this.#complete(code, signal, 'exited', false)
    })
  }

  async #handleStartupTimeout(): Promise<void> {
    if (this.#startSettled || this.#finalized) {
      return
    }
    const error = new AgentProcessStartError(
      `Child did not start within ${this.#spec.startupTimeoutMs}ms`
    )
    this.#startReject?.(error)
    this.#startSettled = true
    this.#cancellationReason = 'startup-timeout'
    this.#setStatus('cancelling')
    const child = this.#child
    const verified = child
      ? await terminateAgentProcessTree(child, {
          graceMs: this.#spec.cancellationGraceMs,
          forceTimeoutMs: this.#spec.forceKillTimeoutMs
        })
      : true
    if (!this.#finalized) {
      const close = this.#pendingClose
      await this.#complete(
        close?.code ?? child?.exitCode ?? null,
        close?.signal ?? child?.signalCode ?? null,
        verified ? 'exited' : 'unverifiable',
        !verified,
        true
      )
    }
  }

  #failStart(error: unknown): void {
    const failure = new AgentProcessStartError('Failed to start child process', {
      cause: error
    })
    this.#startReject?.(failure)
    this.#startSettled = true
    void this.#complete(null, null, 'exited', true)
  }

  #settleStart(success: boolean): void {
    if (this.#startSettled) {
      return
    }
    this.#startSettled = true
    if (this.#startupTimer) {
      clearTimeout(this.#startupTimer)
      this.#startupTimer = null
    }
    if (success) {
      this.#startResolve?.(this.snapshot())
    }
  }

  async #complete(
    code: number | null,
    signal: NodeJS.Signals | null,
    termination: AgentProcessTermination,
    failed: boolean,
    treeAlreadyHandled = false
  ): Promise<void> {
    if (this.#finalized) {
      return
    }
    this.#finalized = true
    this.#clearTimers()
    if (!this.#startSettled) {
      this.#startReject?.(new AgentProcessStartError('Child exited before startup completed'))
      this.#startSettled = true
    }
    const child = this.#child
    const residualClean =
      treeAlreadyHandled || !child
        ? termination === 'exited'
        : await cleanupResidualAgentProcessTree(child, this.#spec.forceKillTimeoutMs)
    this.#endedAt = nowIso()
    this.#status = failed ? 'failed' : 'exited'
    child?.stdin?.destroy()
    const result: AgentProcessResult = {
      ...this.snapshot(),
      status: this.#status,
      code,
      signal,
      termination: residualClean ? termination : 'unverifiable'
    }
    this.#resolveResult(result)
    this.#observation.notify()
  }

  #clearTimers(): void {
    if (this.#startupTimer) {
      clearTimeout(this.#startupTimer)
      this.#startupTimer = null
    }
    if (this.#runtimeTimer) {
      clearTimeout(this.#runtimeTimer)
      this.#runtimeTimer = null
    }
  }

  #setStatus(status: AgentProcessStatus): void {
    this.#status = status
    this.#observation.notify()
  }
}
