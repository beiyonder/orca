import type {
  AgentProcessObserver,
  AgentProcessOutput,
  AgentProcessSnapshot
} from './agent-process-contracts.js'
import { BoundedAgentProcessOutput } from './bounded-agent-process-output.js'

export class AgentProcessObservation {
  readonly #stdout: BoundedAgentProcessOutput
  readonly #stderr: BoundedAgentProcessOutput
  readonly #snapshot: () => AgentProcessSnapshot
  readonly #observers = new Set<AgentProcessObserver>()
  #notificationScheduled = false

  constructor(maxOutputBytes: number, snapshot: () => AgentProcessSnapshot) {
    this.#stdout = new BoundedAgentProcessOutput(maxOutputBytes)
    this.#stderr = new BoundedAgentProcessOutput(maxOutputBytes)
    this.#snapshot = snapshot
  }

  output(): AgentProcessOutput {
    const stdout = this.#stdout.snapshot()
    const stderr = this.#stderr.snapshot()
    return {
      stdout: stdout.text,
      stderr: stderr.text,
      stdoutBytes: stdout.bytes,
      stderrBytes: stderr.bytes,
      stdoutTruncated: stdout.truncated,
      stderrTruncated: stderr.truncated
    }
  }

  observe(observer: AgentProcessObserver): () => void {
    observer(this.#snapshot())
    this.#observers.add(observer)
    return () => this.#observers.delete(observer)
  }

  writeStdout(chunk: Buffer | string): void {
    this.#stdout.write(chunk)
    this.#scheduleNotification()
  }

  writeStderr(chunk: Buffer | string): void {
    this.#stderr.write(chunk)
    this.#scheduleNotification()
  }

  notify(): void {
    const snapshot = this.#snapshot()
    for (const observer of this.#observers) {
      try {
        observer(snapshot)
      } catch {
        // Observer failures cannot take down the supervised child.
      }
    }
  }

  clearObservers(): void {
    this.#observers.clear()
  }

  #scheduleNotification(): void {
    if (this.#notificationScheduled) {
      return
    }
    this.#notificationScheduled = true
    queueMicrotask(() => {
      this.#notificationScheduled = false
      this.notify()
    })
  }
}
