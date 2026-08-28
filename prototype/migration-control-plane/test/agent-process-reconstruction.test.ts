import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { canonicalJson, sha256File, sha256Text } from '../src/canonical-json.js'
import {
  AgentProcessReconstructionError,
  reconstructAgentProcess,
  type PersistedWorkerAuthority,
  type ReconstructedAgentProcess
} from '../src/agent-process-reconstruction.js'
import {
  reconstructionContextAuthority,
  reconstructionContextManifest,
  reconstructionContextSources
} from '../src/s1-agent-context-fixture.js'

const childFixture = fileURLToPath(new URL('./fixtures/agent-process-child.mjs', import.meta.url))
const executableDigest = await sha256File(process.execPath)
const ledgerDigest = '9'.repeat(64)
const roots: string[] = []
const reconstructed: ReconstructedAgentProcess[] = []

function persisted(overrides: Partial<PersistedWorkerAuthority> = {}): PersistedWorkerAuthority {
  return {
    tenantId: 'tenant_s1',
    missionId: 'mission_s1',
    assignmentId: 'assignment_reconstruction',
    attemptId: 'attempt_reconstruction',
    fence: 5,
    attemptStatus: 'running',
    contextManifestId: 'context_reconstruction',
    expectedContextDeliveryDigest: null,
    ledgerPosition: 42,
    ledgerDigest,
    executableVersion: process.version,
    executableDigest,
    program: process.execPath,
    argumentTemplate: [
      childFixture,
      'reconstruct-context',
      '{CONTEXT_DELIVERY_PATH}',
      '{CONTEXT_DELIVERY_DIGEST}'
    ],
    ...overrides
  }
}

async function baseDirectory(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'orca-agent-reconstruction-'))
  roots.push(root)
  return root
}

async function reconstruct(
  base: string,
  incarnationId: string,
  authority: unknown,
  manifest: unknown = reconstructionContextManifest(),
  priorIncarnationId: string | null = null
): Promise<ReconstructedAgentProcess> {
  const result = await reconstructAgentProcess({
    baseDirectory: base,
    incarnationId,
    priorIncarnationId,
    parentEnv: { PATH: process.env.PATH },
    authority,
    contextManifest: manifest,
    contextAuthority: reconstructionContextAuthority(),
    contextSources: reconstructionContextSources,
    commandId: `context-${incarnationId}`,
    reconstructedAt: '2026-01-01T00:04:00.000Z',
    processLimits: {
      startupTimeoutMs: 2_000,
      runtimeTimeoutMs: null,
      cancellationGraceMs: 25,
      forceKillTimeoutMs: 2_000,
      maxOutputBytes: 64 * 1024
    }
  })
  reconstructed.push(result)
  return result
}

function waitForChildReport(process: ReconstructedAgentProcess): Promise<{
  contextDigest: string
  expectedDigest: string
  hadHiddenState: boolean
}> {
  const pending = Promise.withResolvers<{
    contextDigest: string
    expectedDigest: string
    hadHiddenState: boolean
  }>()
  let stop = () => {}
  stop = process.supervisor.observe((snapshot) => {
    const lineEnd = snapshot.stdout.indexOf('\n')
    if (lineEnd === -1) {
      return
    }
    try {
      const parsed = JSON.parse(snapshot.stdout.slice(0, lineEnd)) as {
        contextDigest: string
        expectedDigest: string
        hadHiddenState: boolean
      }
      pending.resolve(parsed)
    } catch (error) {
      pending.reject(error)
    }
  })
  return pending.promise.finally(stop)
}

async function expectReconstructionError(
  operation: () => Promise<unknown>,
  code: string
): Promise<void> {
  try {
    await operation()
    throw new Error('Expected agent process reconstruction error')
  } catch (error) {
    if (!(error instanceof AgentProcessReconstructionError)) {
      throw error
    }
    expect(error.code).toBe(code)
  }
}

afterEach(async () => {
  await Promise.all(reconstructed.splice(0).map(async (process) => process.dispose()))
  await Promise.all(roots.splice(0).map(async (root) => rm(root, { recursive: true, force: true })))
})

describe('agent process reconstruction', () => {
  it('kills and replaces a worker from persisted assignment, context, and ledger only', async () => {
    const base = await baseDirectory()
    const first = await reconstruct(base, 'worker-original', persisted())
    const firstReport = waitForChildReport(first)
    await first.supervisor.start()
    expect(await firstReport).toEqual({
      contextDigest: first.delivery.deliveryDigest,
      expectedDigest: first.delivery.deliveryDigest,
      hadHiddenState: false
    })
    const originalRoot = first.environment.directories.root
    const killed = await first.supervisor.cancel('simulated-worker-loss')
    expect(killed).toMatchObject({ status: 'exited', cancellationReason: 'simulated-worker-loss' })
    await first.dispose()
    await expect(stat(originalRoot)).rejects.toMatchObject({ code: 'ENOENT' })

    const replacementAuthority = persisted({
      expectedContextDeliveryDigest: first.delivery.deliveryDigest
    })
    const replacement = await reconstruct(
      base,
      'worker-replacement',
      replacementAuthority,
      reconstructionContextManifest(),
      'worker-original'
    )
    const replacementReport = waitForChildReport(replacement)
    await replacement.supervisor.start()
    expect(await replacementReport).toEqual({
      contextDigest: replacement.delivery.deliveryDigest,
      expectedDigest: replacement.delivery.deliveryDigest,
      hadHiddenState: false
    })
    expect(replacement.delivery.deliveryDigest).toBe(first.delivery.deliveryDigest)
    expect(replacement.record.logicalInvocationDigest).toBe(first.record.logicalInvocationDigest)
    expect(replacement.record).toMatchObject({
      assignmentId: 'assignment_reconstruction',
      attemptId: 'attempt_reconstruction',
      fence: 5,
      ledgerPosition: 42,
      ledgerDigest,
      priorIncarnationId: 'worker-original',
      incarnationId: 'worker-replacement'
    })
    expect(replacement.environment.directories.root).not.toBe(originalRoot)
  })

  it('rejects context drift instead of reconstructing a different invocation', async () => {
    const base = await baseDirectory()
    const initial = await reconstruct(base, 'context-baseline', persisted())
    await initial.dispose()
    const changedManifest = {
      ...reconstructionContextManifest(),
      strategyVersion: 'changed-strategy'
    }
    await expectReconstructionError(
      () =>
        reconstruct(
          base,
          'context-drift',
          persisted({ expectedContextDeliveryDigest: initial.delivery.deliveryDigest }),
          changedManifest,
          'context-baseline'
        ),
      'context_reconstruction_mismatch'
    )
    await expect(stat(join(base, 'context-drift'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects a changed executable and non-running persisted authority before spawn', async () => {
    const base = await baseDirectory()
    await expectReconstructionError(
      () => reconstruct(base, 'bad-executable', persisted({ executableDigest: 'f'.repeat(64) })),
      'executable_digest_mismatch'
    )
    await expectReconstructionError(
      () => reconstruct(base, 'terminal-attempt', { ...persisted(), attemptStatus: 'terminal' }),
      'invalid_persisted_authority'
    )
  })

  it('digests the complete reconstruction record and changes only incarnation evidence', async () => {
    const base = await baseDirectory()
    const first = await reconstruct(base, 'record-first', persisted())
    const second = await reconstruct(
      base,
      'record-second',
      persisted({ expectedContextDeliveryDigest: first.delivery.deliveryDigest }),
      reconstructionContextManifest(),
      'record-first'
    )
    for (const process of [first, second]) {
      const { digest, ...record } = process.record
      expect(digest).toBe(sha256Text(canonicalJson(record)))
    }
    expect(second.record.logicalInvocationDigest).toBe(first.record.logicalInvocationDigest)
    expect(second.record.environmentDigest).not.toBe(first.record.environmentDigest)
  })
})
