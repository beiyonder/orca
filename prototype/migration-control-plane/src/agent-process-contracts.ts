export type AgentProcessStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'cancelling'
  | 'exited'
  | 'failed'

export type AgentProcessTermination = 'exited' | 'unverifiable'

export type AgentProcessSpec = {
  incarnationId: string
  program: string
  args?: readonly string[]
  cwd: string
  env: NodeJS.ProcessEnv
  startupTimeoutMs?: number
  runtimeTimeoutMs?: number | null
  cancellationGraceMs?: number
  forceKillTimeoutMs?: number
  maxOutputBytes?: number
}

export type AgentProcessOutput = {
  stdout: string
  stderr: string
  stdoutBytes: number
  stderrBytes: number
  stdoutTruncated: boolean
  stderrTruncated: boolean
}

export type AgentProcessSnapshot = AgentProcessOutput & {
  incarnationId: string
  status: AgentProcessStatus
  pid: number | null
  startedAt: string | null
  endedAt: string | null
  cancellationReason: string | null
}

export type AgentProcessObserver = (snapshot: AgentProcessSnapshot) => void

export type AgentProcessResult = AgentProcessSnapshot & {
  status: 'exited' | 'failed'
  code: number | null
  signal: NodeJS.Signals | null
  termination: AgentProcessTermination
}

export class AgentProcessStartError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'AgentProcessStartError'
  }
}

export class AgentProcessStateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentProcessStateError'
  }
}

export class AgentProcessSpecError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentProcessSpecError'
  }
}
