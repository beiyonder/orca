import { chmod, mkdir, open, realpath, rm, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { canonicalJson, sha256Text } from './canonical-json.js'

const INHERITED_VARIABLES = [
  'PATH',
  'SystemRoot',
  'WINDIR',
  'ComSpec',
  'PATHEXT',
  'LANG',
  'LC_ALL',
  'TZ'
] as const

export type IsolatedOmpDirectories = {
  root: string
  home: string
  workspace: string
  agent: string
  temp: string
  config: string
  data: string
  state: string
  cache: string
}

export type IsolatedOmpEnvironmentManifest = {
  schemaVersion: 1
  incarnationId: string
  root: string
  variableDigests: { name: string; sha256: string }[]
  digest: string
}

export type PreparedOmpEnvironment = {
  directories: IsolatedOmpDirectories
  env: NodeJS.ProcessEnv
  manifest: IsolatedOmpEnvironmentManifest
  dispose: () => Promise<void>
}

export type PrepareOmpEnvironmentInput = {
  baseDirectory: string
  incarnationId: string
  parentEnv?: NodeJS.ProcessEnv
}

function envValue(env: NodeJS.ProcessEnv, name: string): string | undefined {
  if (process.platform !== 'win32') {
    return env[name]
  }
  const key = Object.keys(env).find((candidate) => candidate.toLowerCase() === name.toLowerCase())
  return key ? env[key] : undefined
}

async function createPrivateDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 })
  const metadata = await stat(path)
  if (!metadata.isDirectory()) {
    throw new Error(`Isolated OMP path is not a directory: ${path}`)
  }
  if (process.platform !== 'win32' && (metadata.mode & 0o077) !== 0) {
    await chmod(path, 0o700)
  }
}

async function createPrivateFile(path: string): Promise<void> {
  const handle = await open(path, 'wx', 0o600)
  await handle.close()
}

function buildEnvironment(
  directories: IsolatedOmpDirectories,
  parentEnv: NodeJS.ProcessEnv
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const name of INHERITED_VARIABLES) {
    const value = envValue(parentEnv, name)
    if (value !== undefined) {
      env[name] = value
    }
  }
  Object.assign(env, {
    HOME: directories.home,
    USERPROFILE: directories.home,
    APPDATA: join(directories.config, 'windows-roaming'),
    LOCALAPPDATA: join(directories.data, 'windows-local'),
    XDG_CONFIG_HOME: directories.config,
    XDG_DATA_HOME: directories.data,
    XDG_STATE_HOME: directories.state,
    XDG_CACHE_HOME: directories.cache,
    PI_CODING_AGENT_DIR: directories.agent,
    CLAUDE_CONFIG_DIR: join(directories.config, 'claude'),
    CODEX_HOME: join(directories.config, 'codex'),
    GH_CONFIG_DIR: join(directories.config, 'gh'),
    AZURE_CONFIG_DIR: join(directories.config, 'azure'),
    DOCKER_CONFIG: join(directories.config, 'docker'),
    AWS_CONFIG_FILE: join(directories.config, 'aws', 'config'),
    AWS_SHARED_CREDENTIALS_FILE: join(directories.config, 'aws', 'credentials'),
    AWS_EC2_METADATA_DISABLED: 'true',
    KUBECONFIG: join(directories.config, 'kubeconfig'),
    GIT_CONFIG_GLOBAL: join(directories.config, 'gitconfig'),
    GIT_CONFIG_NOSYSTEM: '1',
    NPM_CONFIG_USERCONFIG: join(directories.config, 'npmrc'),
    TMPDIR: directories.temp,
    TMP: directories.temp,
    TEMP: directories.temp,
    PI_NOTIFICATIONS: 'off',
    NO_COLOR: '1'
  })
  return env
}

export async function prepareIsolatedOmpEnvironment(
  input: PrepareOmpEnvironmentInput
): Promise<PreparedOmpEnvironment> {
  if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(input.incarnationId)) {
    throw new TypeError('incarnationId must be a bounded opaque identifier')
  }
  await createPrivateDirectory(resolve(input.baseDirectory))
  const baseDirectory = await realpath(resolve(input.baseDirectory))
  const root = join(baseDirectory, input.incarnationId)
  await mkdir(root, { recursive: false, mode: 0o700 })
  const directories: IsolatedOmpDirectories = {
    root,
    home: join(root, 'home'),
    workspace: join(root, 'workspace'),
    agent: join(root, 'agent'),
    temp: join(root, 'tmp'),
    config: join(root, 'xdg', 'config'),
    data: join(root, 'xdg', 'data'),
    state: join(root, 'xdg', 'state'),
    cache: join(root, 'xdg', 'cache')
  }
  try {
    await Promise.all(
      Object.values(directories)
        .filter((path) => path !== root)
        .map(async (path) => createPrivateDirectory(path))
    )
    await createPrivateDirectory(join(directories.config, 'aws'))
    await Promise.all([
      createPrivateFile(join(directories.config, 'gitconfig')),
      createPrivateFile(join(directories.config, 'npmrc')),
      createPrivateFile(join(directories.config, 'kubeconfig')),
      createPrivateFile(join(directories.config, 'aws', 'config')),
      createPrivateFile(join(directories.config, 'aws', 'credentials'))
    ])
    const env = buildEnvironment(directories, input.parentEnv ?? process.env)
    const variableDigests = Object.entries(env)
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, value]) => ({ name, sha256: sha256Text(value) }))
    const manifestWithoutDigest = {
      schemaVersion: 1 as const,
      incarnationId: input.incarnationId,
      root,
      variableDigests
    }
    let disposed = false
    return {
      directories,
      env,
      manifest: {
        ...manifestWithoutDigest,
        digest: sha256Text(canonicalJson(manifestWithoutDigest))
      },
      dispose: async () => {
        if (disposed) {
          return
        }
        disposed = true
        await rm(root, { recursive: true, force: true })
      }
    }
  } catch (error) {
    await rm(root, { recursive: true, force: true })
    throw error
  }
}
