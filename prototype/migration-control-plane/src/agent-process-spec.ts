import { isAbsolute } from 'node:path'
import { AgentProcessSpecError, type AgentProcessSpec } from './agent-process-contracts.js'

const DEFAULT_STARTUP_TIMEOUT_MS = 5_000
const DEFAULT_RUNTIME_TIMEOUT_MS = 5 * 60_000
const DEFAULT_CANCELLATION_GRACE_MS = 1_000
const DEFAULT_FORCE_KILL_TIMEOUT_MS = 2_000
const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024

export type NormalizedAgentProcessSpec = AgentProcessSpec & {
  args: readonly string[]
  startupTimeoutMs: number
  runtimeTimeoutMs: number | null
  cancellationGraceMs: number
  forceKillTimeoutMs: number
  maxOutputBytes: number
}

function boundedInteger(
  value: number | undefined,
  fallback: number,
  label: string,
  maximum: number
): number {
  const resolved = value ?? fallback
  if (!Number.isSafeInteger(resolved) || resolved <= 0 || resolved > maximum) {
    throw new AgentProcessSpecError(`${label} must be an integer from 1 through ${maximum}`)
  }
  return resolved
}

export function normalizeAgentProcessSpec(spec: AgentProcessSpec): NormalizedAgentProcessSpec {
  if (!/^[a-zA-Z0-9._:-]{1,256}$/.test(spec.incarnationId)) {
    throw new AgentProcessSpecError('incarnationId must be a bounded opaque identifier')
  }
  if (!isAbsolute(spec.program) || spec.program.includes('\0')) {
    throw new AgentProcessSpecError('program must be an absolute path without NUL bytes')
  }
  if (!isAbsolute(spec.cwd) || spec.cwd.includes('\0')) {
    throw new AgentProcessSpecError('cwd must be an absolute path without NUL bytes')
  }
  const args = spec.args ?? []
  if (args.length > 256 || args.some((arg) => arg.length > 32_768 || arg.includes('\0'))) {
    throw new AgentProcessSpecError('args exceed count, size, or NUL-byte limits')
  }
  const runtimeTimeoutMs =
    spec.runtimeTimeoutMs === null
      ? null
      : boundedInteger(
          spec.runtimeTimeoutMs,
          DEFAULT_RUNTIME_TIMEOUT_MS,
          'runtimeTimeoutMs',
          24 * 60 * 60_000
        )
  return {
    ...spec,
    args,
    startupTimeoutMs: boundedInteger(
      spec.startupTimeoutMs,
      DEFAULT_STARTUP_TIMEOUT_MS,
      'startupTimeoutMs',
      60_000
    ),
    runtimeTimeoutMs,
    cancellationGraceMs: boundedInteger(
      spec.cancellationGraceMs,
      DEFAULT_CANCELLATION_GRACE_MS,
      'cancellationGraceMs',
      60_000
    ),
    forceKillTimeoutMs: boundedInteger(
      spec.forceKillTimeoutMs,
      DEFAULT_FORCE_KILL_TIMEOUT_MS,
      'forceKillTimeoutMs',
      60_000
    ),
    maxOutputBytes: boundedInteger(
      spec.maxOutputBytes,
      DEFAULT_MAX_OUTPUT_BYTES,
      'maxOutputBytes',
      64 * 1024 * 1024
    )
  }
}
