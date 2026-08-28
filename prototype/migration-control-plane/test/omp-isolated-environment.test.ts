import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { afterEach, describe, expect, it } from 'vitest'
import { canonicalJson, sha256Text } from '../src/canonical-json.js'
import { AgentProcessSupervisor } from '../src/agent-process-supervisor.js'
import {
  prepareIsolatedOmpEnvironment,
  type PreparedOmpEnvironment
} from '../src/omp-isolated-environment.js'

const childFixture = fileURLToPath(new URL('./fixtures/agent-process-child.mjs', import.meta.url))
const prepared: PreparedOmpEnvironment[] = []
const bases: string[] = []

const PrintEnvSchema = z.strictObject({
  cwd: z.string(),
  variables: z.record(z.string(), z.string().nullable())
})

async function baseDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'omp-isolation-'))
  bases.push(path)
  return path
}

async function environment(
  incarnationId: string,
  parentEnv: NodeJS.ProcessEnv = process.env,
  base?: string
): Promise<PreparedOmpEnvironment> {
  const resolvedBase = base ?? (await baseDirectory())
  const value = await prepareIsolatedOmpEnvironment({
    baseDirectory: resolvedBase,
    incarnationId,
    parentEnv
  })
  prepared.push(value)
  return value
}

afterEach(async () => {
  await Promise.all(prepared.splice(0).map(async (value) => value.dispose()))
  await Promise.all(bases.splice(0).map(async (path) => rm(path, { recursive: true, force: true })))
})

describe('isolated OMP environment', () => {
  it('copies only platform runtime variables and replaces every state root', async () => {
    const isolated = await environment('isolation-hostile', {
      PATH: '/safe/runtime/bin',
      LANG: 'C.UTF-8',
      HOME: '/host/home',
      USERPROFILE: 'C:\\host-home',
      AWS_ACCESS_KEY_ID: 'host-aws-key',
      ANTHROPIC_API_KEY: 'host-model-key',
      GH_TOKEN: 'host-github-token',
      OMP_PROFILE: 'personal',
      PI_PROFILE: 'personal',
      PI_CONFIG_FILES: '/host/config.yml',
      OMP_AUTH_BROKER_TOKEN: 'host-broker-token',
      NODE_OPTIONS: '--require=/host/hook.js',
      BUN_OPTIONS: '--preload=/host/hook.ts',
      SSH_AUTH_SOCK: '/host/ssh.sock'
    })

    expect(isolated.env.PATH).toBe('/safe/runtime/bin')
    expect(isolated.env.LANG).toBe('C.UTF-8')
    expect(isolated.env).toMatchObject({
      HOME: isolated.directories.home,
      USERPROFILE: isolated.directories.home,
      PI_CODING_AGENT_DIR: isolated.directories.agent,
      XDG_CONFIG_HOME: isolated.directories.config,
      XDG_DATA_HOME: isolated.directories.data,
      XDG_STATE_HOME: isolated.directories.state,
      XDG_CACHE_HOME: isolated.directories.cache,
      TMPDIR: isolated.directories.temp,
      GIT_CONFIG_NOSYSTEM: '1',
      AWS_EC2_METADATA_DISABLED: 'true',
      PI_NOTIFICATIONS: 'off'
    })
    for (const forbidden of [
      'AWS_ACCESS_KEY_ID',
      'ANTHROPIC_API_KEY',
      'GH_TOKEN',
      'OMP_PROFILE',
      'PI_PROFILE',
      'PI_CONFIG_FILES',
      'OMP_AUTH_BROKER_TOKEN',
      'NODE_OPTIONS',
      'BUN_OPTIONS',
      'SSH_AUTH_SOCK'
    ]) {
      expect(isolated.env).not.toHaveProperty(forbidden)
    }
    expect(JSON.stringify(isolated.manifest)).not.toContain('host-')
  })

  it('creates private empty roots and checksum-bound environment metadata', async () => {
    const isolated = await environment('isolation-layout', { PATH: '/runtime' })
    expect(await readdir(isolated.directories.workspace)).toEqual([])
    for (const path of Object.values(isolated.directories)) {
      const metadata = await stat(path)
      expect(metadata.isDirectory()).toBe(true)
      if (process.platform !== 'win32') {
        expect(metadata.mode & 0o077).toBe(0)
      }
    }
    for (const file of [
      isolated.env.GIT_CONFIG_GLOBAL,
      isolated.env.NPM_CONFIG_USERCONFIG,
      isolated.env.KUBECONFIG,
      isolated.env.AWS_CONFIG_FILE,
      isolated.env.AWS_SHARED_CREDENTIALS_FILE
    ]) {
      const metadata = await stat(file!)
      expect(metadata.isFile()).toBe(true)
      if (process.platform !== 'win32') {
        expect(metadata.mode & 0o077).toBe(0)
      }
    }
    const { digest, ...manifest } = isolated.manifest
    expect(digest).toBe(sha256Text(canonicalJson(manifest)))
    const variableNames = manifest.variableDigests.map((entry) => entry.name)
    expect(variableNames).toEqual(variableNames.toSorted())
  })

  it('refuses hidden-state reuse and allows the incarnation only after cleanup', async () => {
    const base = await baseDirectory()
    const first = await environment('isolation-exclusive', {}, base)
    await expect(
      prepareIsolatedOmpEnvironment({
        baseDirectory: base,
        incarnationId: 'isolation-exclusive',
        parentEnv: {}
      })
    ).rejects.toMatchObject({ code: 'EEXIST' })
    await first.dispose()
    const replacement = await environment('isolation-exclusive', {}, base)
    expect(replacement.directories.root).toBe(first.directories.root)
  })

  it('delivers the isolated cwd and environment to a real supervised child', async () => {
    const isolated = await environment('isolation-child', {
      PATH: process.env.PATH,
      HOME: '/host/home',
      AWS_ACCESS_KEY_ID: 'host-key',
      ANTHROPIC_API_KEY: 'host-model-key',
      OMP_PROFILE: 'personal',
      PI_CONFIG_FILES: '/host/config.yml',
      NODE_OPTIONS: '--require=/host/hook.js',
      SSH_AUTH_SOCK: '/host/ssh.sock'
    })
    const supervisor = new AgentProcessSupervisor({
      incarnationId: 'isolation-child',
      program: process.execPath,
      args: [childFixture, 'print-env'],
      cwd: isolated.directories.workspace,
      env: isolated.env,
      runtimeTimeoutMs: 5_000
    })
    await supervisor.start()
    const result = await supervisor.wait()
    const observed = PrintEnvSchema.parse(JSON.parse(result.stdout))
    expect(observed.cwd).toBe(isolated.directories.workspace)
    expect(observed.variables).toMatchObject({
      HOME: isolated.directories.home,
      USERPROFILE: isolated.directories.home,
      XDG_CONFIG_HOME: isolated.directories.config,
      PI_CODING_AGENT_DIR: isolated.directories.agent,
      AWS_ACCESS_KEY_ID: null,
      ANTHROPIC_API_KEY: null,
      OMP_PROFILE: null,
      PI_CONFIG_FILES: null,
      NODE_OPTIONS: null,
      SSH_AUTH_SOCK: null
    })
    await supervisor.dispose()
  })
})
