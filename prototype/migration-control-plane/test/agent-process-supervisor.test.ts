import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { afterEach, describe, expect, it } from 'vitest'
import {
  AgentProcessSpecError,
  AgentProcessStartError,
  AgentProcessStateError,
  type AgentProcessSpec,
  type AgentProcessStatus
} from '../src/agent-process-contracts.js'
import { resolveAgentSpawn } from '../src/agent-process-spawn.js'
import { AgentProcessSupervisor } from '../src/agent-process-supervisor.js'

const labRoot = fileURLToPath(new URL('..', import.meta.url))
const childFixture = fileURLToPath(new URL('./fixtures/agent-process-child.mjs', import.meta.url))
const supervisors: AgentProcessSupervisor[] = []

// Real subprocess and process-group events are OS-owned; fake timers cannot drive them.

function delay(milliseconds: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>()
  setTimeout(resolve, milliseconds)
  return promise
}

async function waitUntil(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for supervised process state')
    }
    await delay(10)
  }
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
    return code !== 'ESRCH'
  }
}

function spec(mode: string, overrides: Partial<AgentProcessSpec> = {}): AgentProcessSpec {
  return {
    incarnationId: `incarnation-${mode}`,
    program: process.execPath,
    args: [childFixture, mode],
    cwd: labRoot,
    env: { ...process.env },
    startupTimeoutMs: 2_000,
    runtimeTimeoutMs: null,
    cancellationGraceMs: 100,
    forceKillTimeoutMs: 2_000,
    maxOutputBytes: 64 * 1024,
    ...overrides
  }
}

function supervisor(processSpec: AgentProcessSpec): AgentProcessSupervisor {
  const created = new AgentProcessSupervisor(processSpec)
  supervisors.push(created)
  return created
}

afterEach(async () => {
  await Promise.all(supervisors.splice(0).map(async (created) => created.dispose()))
})

describe('agent process supervisor', () => {
  it('starts, observes, and records a natural nonzero exit', async () => {
    const created = supervisor(spec('echo'))
    const statuses: AgentProcessStatus[] = []
    created.observe((snapshot) => statuses.push(snapshot.status))

    const started = await created.start()
    const result = await created.wait()

    expect(started).toMatchObject({ status: 'running', incarnationId: 'incarnation-echo' })
    expect(result).toMatchObject({
      status: 'exited',
      code: 7,
      termination: 'exited',
      stdout: 'ready\n',
      stderr: 'diagnostic\n',
      cancellationReason: null
    })
    expect(result.pid).toBeTypeOf('number')
    expect(result.startedAt).not.toBeNull()
    expect(result.endedAt).not.toBeNull()
    expect(statuses).toContain('running')
    expect(statuses.at(-1)).toBe('exited')
    expect(() => created.start()).toThrow(AgentProcessStateError)
  })

  it('cancels idempotently and returns the same verified terminal result', async () => {
    const created = supervisor(spec('idle'))
    await created.start()
    await waitUntil(() => created.snapshot().stdout.includes('ready'))

    const [first, second, waited] = await Promise.all([
      created.cancel('operator-cancelled'),
      created.cancel('ignored-second-reason'),
      created.wait()
    ])
    expect(second).toEqual(first)
    expect(waited).toEqual(first)
    expect(first).toMatchObject({
      status: 'exited',
      termination: 'exited',
      cancellationReason: 'operator-cancelled'
    })
  })

  it('force-terminates a child that ignores graceful cancellation', async () => {
    const created = supervisor(
      spec('ignore-term', { cancellationGraceMs: 25, forceKillTimeoutMs: 2_000 })
    )
    await created.start()
    await waitUntil(() => created.snapshot().stdout.includes('ready'))
    const result = await created.cancel('forced-test')
    expect(result.status).toBe('exited')
    expect(result.termination).toBe('exited')
    expect(result.cancellationReason).toBe('forced-test')
  })

  it('cleans a spawned descendant when cancelling the process tree', async () => {
    const created = supervisor(spec('tree', { cancellationGraceMs: 25 }))
    await created.start()
    await waitUntil(() => created.snapshot().stdout.includes('grandchildPid'))
    const firstLine = created.snapshot().stdout.trim().split('\n')[0]!
    const treeLine = z
      .strictObject({ grandchildPid: z.number().int().positive() })
      .parse(JSON.parse(firstLine))
    const grandchildPid = treeLine.grandchildPid
    expect(processExists(grandchildPid)).toBe(true)

    const result = await created.cancel('tree-cleanup')
    await waitUntil(() => !processExists(grandchildPid))
    expect(result.termination).toBe('exited')
  })

  it('bounds captured output while retaining observed byte counts', async () => {
    const created = supervisor(spec('flood', { maxOutputBytes: 1_024 }))
    await created.start()
    const result = await created.wait()

    expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(1_024)
    expect(Buffer.byteLength(result.stderr)).toBeLessThanOrEqual(1_024)
    expect(result.stdoutBytes).toBe(128 * 1_024)
    expect(result.stderrBytes).toBe(128 * 1_024)
    expect(result.stdoutTruncated).toBe(true)
    expect(result.stderrTruncated).toBe(true)
  })

  it('cancels automatically at the runtime deadline', async () => {
    const created = supervisor(
      spec('ignore-term', {
        runtimeTimeoutMs: 40,
        cancellationGraceMs: 20,
        forceKillTimeoutMs: 2_000
      })
    )
    await created.start()
    const result = await created.wait()
    expect(result).toMatchObject({ cancellationReason: 'runtime-timeout', termination: 'exited' })
  })

  it('reports spawn failure and rejects invalid or duplicate start requests', async () => {
    expect(
      () =>
        new AgentProcessSupervisor({
          ...spec('invalid'),
          program: 'relative-program'
        })
    ).toThrow(AgentProcessSpecError)

    const created = supervisor(
      spec('missing', { program: join(labRoot, 'definitely-missing-agent-binary') })
    )
    await expect(created.start()).rejects.toBeInstanceOf(AgentProcessStartError)
    await expect(created.wait()).resolves.toMatchObject({ status: 'failed', termination: 'exited' })
    expect(() => created.start()).toThrow(AgentProcessStateError)
  })

  it('resolves Windows command shims without shell mode or visible consoles', () => {
    const resolved = resolveAgentSpawn(
      {
        program: 'C:\\Program Files\\omp.cmd',
        args: ['a b', 'c"d', 'e%F%g', 'h&i'],
        cwd: 'C:\\work tree',
        env: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' },
        detached: false
      },
      'win32'
    )
    expect(resolved.file).toBe('C:\\Windows\\System32\\cmd.exe')
    expect(resolved.options).toMatchObject({
      shell: false,
      windowsHide: true,
      windowsVerbatimArguments: true
    })
    expect(resolved.args).toHaveLength(1)
    expect(resolved.args[0]).toContain('/d /v:off /s /c')
  })
})
