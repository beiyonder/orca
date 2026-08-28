import {
  spawn as nodeSpawn,
  type ChildProcess,
  type SpawnOptions,
  type StdioOptions
} from 'node:child_process'

export type AgentSpawnSpec = {
  program: string
  args: readonly string[]
  cwd?: string
  env?: NodeJS.ProcessEnv
  detached: boolean
  stdio?: StdioOptions
}

export type AgentChildProcess = ChildProcess

export type ResolvedAgentSpawn = {
  file: string
  args: readonly string[]
  options: SpawnOptions
}

function quoteWindowsCmdArgument(value: string): string {
  let quoted = '"'
  let backslashes = 0
  for (const char of value) {
    if (char === '\\') {
      backslashes += 1
      continue
    }
    if (char === '"') {
      quoted += `${'\\'.repeat(backslashes * 2)}""`
      backslashes = 0
      continue
    }
    if (char === '%') {
      quoted += `${'\\'.repeat(backslashes * 2)}"^%"`
      backslashes = 0
      continue
    }
    quoted += `${'\\'.repeat(backslashes)}${char}`
    backslashes = 0
  }
  return `${quoted}${'\\'.repeat(backslashes * 2)}"`
}

function windowsCmdLine(program: string, args: readonly string[]): string {
  for (const value of [program, ...args]) {
    if (/[\r\n]/.test(value)) {
      throw new Error('cmd.exe cannot receive an argument containing a line break')
    }
  }
  const command = [program, ...args].map(quoteWindowsCmdArgument).join(' ')
  return `/d /v:off /s /c "${command}"`
}

function isWindowsCommandScript(program: string): boolean {
  const lower = program.toLowerCase()
  return lower.endsWith('.cmd') || lower.endsWith('.bat')
}

export function resolveAgentSpawn(
  spec: AgentSpawnSpec,
  platform: NodeJS.Platform
): ResolvedAgentSpawn {
  const options: SpawnOptions = {
    cwd: spec.cwd,
    env: spec.env,
    stdio: spec.stdio ?? ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    detached: spec.detached,
    shell: false
  }
  if (platform !== 'win32' || !isWindowsCommandScript(spec.program)) {
    return { file: spec.program, args: spec.args, options }
  }
  return {
    file: spec.env?.ComSpec ?? process.env.ComSpec ?? 'cmd.exe',
    args: [windowsCmdLine(spec.program, spec.args)],
    options: { ...options, windowsVerbatimArguments: true }
  }
}

// Why: the isolated lab cannot import Orca's private helper; this preserves its shell/console rules.
export function spawnAgentProcess(spec: AgentSpawnSpec): ChildProcess {
  const resolved = resolveAgentSpawn(spec, process.platform)
  return nodeSpawn(resolved.file, [...resolved.args], resolved.options)
}
