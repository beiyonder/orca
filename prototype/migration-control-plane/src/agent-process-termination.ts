import { join } from 'node:path'
import { spawnAgentProcess, type AgentChildProcess } from './agent-process-spawn.js'
import { BoundedAgentProcessOutput } from './bounded-agent-process-output.js'

const POLL_MS = 20

function delay(milliseconds: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>()
  setTimeout(resolve, milliseconds)
  return promise
}

function errorCode(error: unknown): unknown {
  return error && typeof error === 'object' && 'code' in error ? error.code : undefined
}
function rootExited(child: AgentChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null
}

async function waitForRootExit(child: AgentChildProcess, timeoutMs: number): Promise<boolean> {
  const { promise, resolve } = Promise.withResolvers<boolean>()
  let settled = false
  const finish = (value: boolean): void => {
    if (settled) {
      return
    }
    settled = true
    clearTimeout(timer)
    child.off('close', onClose)
    resolve(value)
  }
  const onClose = (): void => finish(true)
  const timer = setTimeout(() => finish(false), timeoutMs)
  child.once('close', onClose)
  if (rootExited(child)) {
    finish(true)
  }
  return promise
}

function processGroupExists(processGroupId: number): boolean {
  try {
    process.kill(-processGroupId, 0)
    return true
  } catch (error) {
    return errorCode(error) !== 'ESRCH'
  }
}
async function readProcessGroupStates(processGroupId: number): Promise<string[] | null> {
  let probe: AgentChildProcess
  try {
    probe = spawnAgentProcess({
      program: process.platform === 'darwin' ? '/bin/ps' : '/usr/bin/ps',
      args: ['-axo', 'pgid=,state='],
      env: process.env,
      detached: false,
      stdio: ['ignore', 'pipe', 'ignore']
    })
  } catch {
    return null
  }
  const output = new BoundedAgentProcessOutput(1024 * 1024)
  probe.stdout?.on('data', (chunk: Buffer | string) => output.write(chunk))
  probe.stdout?.on('error', () => {})
  const { promise, resolve } = Promise.withResolvers<string[] | null>()
  let settled = false
  const finish = (states: string[] | null): void => {
    if (settled) {
      return
    }
    settled = true
    clearTimeout(timer)
    resolve(states)
  }
  const timer = setTimeout(() => {
    probe.kill('SIGKILL')
    finish(null)
  }, 500)
  probe.once('error', () => finish(null))
  probe.once('close', (code) => {
    if (code !== 0 || output.snapshot().truncated) {
      finish(null)
      return
    }
    const states = output
      .snapshot()
      .text.split('\n')
      .flatMap((line) => {
        const match = line.trim().match(/^(\d+)\s+(\S+)/)
        return match && Number(match[1]) === processGroupId ? [match[2]!] : []
      })
    finish(states)
  })
  return promise
}

async function waitForProcessGroupExit(
  processGroupId: number,
  timeoutMs: number
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (true) {
    const states = await readProcessGroupStates(processGroupId)
    if (
      states ? states.every((state) => state.startsWith('Z')) : !processGroupExists(processGroupId)
    ) {
      return true
    }
    if (Date.now() >= deadline) {
      return false
    }
    await delay(POLL_MS)
  }
}

function signalPosixTree(child: AgentChildProcess, signal: NodeJS.Signals): boolean {
  if (!child.pid) {
    return false
  }
  try {
    process.kill(-child.pid, signal)
    return true
  } catch (error) {
    return errorCode(error) === 'ESRCH'
  }
}

async function taskkillWindowsTree(child: AgentChildProcess, timeoutMs: number): Promise<boolean> {
  if (!child.pid) {
    return rootExited(child)
  }
  const systemRoot = process.env.SystemRoot ?? 'C:\\Windows'
  const killer = spawnAgentProcess({
    program: join(systemRoot, 'System32', 'taskkill.exe'),
    args: ['/pid', String(child.pid), '/t', '/f'],
    env: process.env,
    detached: false,
    stdio: 'ignore'
  })
  const killerExited = await waitForRootExit(killer, timeoutMs)
  if (!killerExited) {
    killer.kill('SIGKILL')
    return false
  }
  return killer.exitCode === 0 && (await waitForRootExit(child, timeoutMs))
}

export async function terminateAgentProcessTree(
  child: AgentChildProcess,
  input: { graceMs: number; forceTimeoutMs: number }
): Promise<boolean> {
  if (process.platform === 'win32') {
    return taskkillWindowsTree(child, input.forceTimeoutMs)
  }
  if (!child.pid) {
    try {
      child.kill('SIGTERM')
    } catch {
      return rootExited(child)
    }
    return waitForRootExit(child, input.graceMs)
  }

  signalPosixTree(child, 'SIGTERM')
  const graceful = await waitForRootExit(child, input.graceMs)
  if (!graceful || processGroupExists(child.pid)) {
    signalPosixTree(child, 'SIGKILL')
  }
  const [rootGone, groupGone] = await Promise.all([
    waitForRootExit(child, input.forceTimeoutMs),
    waitForProcessGroupExit(child.pid, input.forceTimeoutMs)
  ])
  return rootGone && groupGone
}

export async function cleanupResidualAgentProcessTree(
  child: AgentChildProcess,
  timeoutMs: number
): Promise<boolean> {
  if (process.platform === 'win32' || !child.pid || !processGroupExists(child.pid)) {
    return true
  }
  signalPosixTree(child, 'SIGKILL')
  return waitForProcessGroupExit(child.pid, timeoutMs)
}
