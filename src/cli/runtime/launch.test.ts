import { EventEmitter } from 'node:events'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encodePairingOffer, PAIRING_OFFER_VERSION } from '../../shared/pairing'

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn()
}))

vi.mock('child_process', () => ({
  spawn: spawnMock
}))

import { launchOrcaApp, serveOrcaApp } from './launch'

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter()
  kill = vi.fn()
  unref = vi.fn()
}

const RECIPE_JSON = JSON.stringify({
  schemaVersion: 1,
  pairingCode: encodePairingOffer({
    v: PAIRING_OFFER_VERSION,
    endpoint: 'wss://sandbox.example.com',
    deviceToken: 'token',
    publicKeyB64: 'public-key'
  }),
  projectRoot: '/workspace/repo'
})
const SERVE_INSTALL_STATUS = '[serve] orca CLI install: installed'
const SSH_RECIPE_JSON =
  '{"schemaVersion":1,"connection":{"type":"ssh","target":{"label":"Sandbox","host":"sandbox.example.com","port":22,"username":"root"},"projectRoot":"/workspace/repo"}}'

function startRecipeJsonServer() {
  const child = new FakeChildProcess()
  spawnMock.mockReturnValue(child)
  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  const result = serveOrcaApp({
    recipeJson: true,
    projectRoot: '/workspace/repo'
  })
  return { child, result, stdoutSpy, stderrSpy }
}

describe('serveOrcaApp', () => {
  beforeEach(() => {
    spawnMock.mockReset()
    process.env.ORCA_APP_EXECUTABLE = '/Applications/Orca.app/Contents/MacOS/Orca'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.ORCA_APP_EXECUTABLE
    delete process.env.ORCA_APP_EXECUTABLE_NEEDS_APP_ROOT
  })

  it('pins the Electron child cwd to the app root instead of the caller cwd', async () => {
    const child = {
      kill: vi.fn(),
      once: vi.fn(
        (event: string, handler: (code: number | null, signal: string | null) => void) => {
          if (event === 'exit') {
            queueMicrotask(() => handler(0, null))
          }
          return child
        }
      )
    }
    spawnMock.mockReturnValue(child)

    await expect(serveOrcaApp({ json: true })).resolves.toBe(0)

    expect(spawnMock).toHaveBeenCalledWith(
      '/Applications/Orca.app/Contents/MacOS/Orca',
      ['--serve', '--serve-json'],
      expect.objectContaining({
        cwd: resolve(__dirname, '../../..')
      })
    )
  })

  it('passes mobile pairing through to the foreground server child', async () => {
    const child = {
      kill: vi.fn(),
      once: vi.fn(
        (event: string, handler: (code: number | null, signal: string | null) => void) => {
          if (event === 'exit') {
            queueMicrotask(() => handler(0, null))
          }
          return child
        }
      )
    }
    spawnMock.mockReturnValue(child)

    await expect(
      serveOrcaApp({
        json: true,
        port: '6768',
        pairingAddress: '100.64.1.20',
        mobilePairing: true
      })
    ).resolves.toBe(0)

    expect(spawnMock).toHaveBeenCalledWith(
      '/Applications/Orca.app/Contents/MacOS/Orca',
      [
        '--serve',
        '--serve-json',
        '--serve-port',
        '6768',
        '--serve-pairing-address',
        '100.64.1.20',
        '--serve-mobile-pairing'
      ],
      expect.objectContaining({
        cwd: resolve(__dirname, '../../..')
      })
    )
  })

  it('passes the app root before serve flags for dev Electron executables', async () => {
    process.env.ORCA_APP_EXECUTABLE = '/repo/node_modules/.bin/electron'
    process.env.ORCA_APP_EXECUTABLE_NEEDS_APP_ROOT = '1'
    const child = {
      kill: vi.fn(),
      once: vi.fn(
        (event: string, handler: (code: number | null, signal: string | null) => void) => {
          if (event === 'exit') {
            queueMicrotask(() => handler(0, null))
          }
          return child
        }
      )
    }
    spawnMock.mockReturnValue(child)

    await expect(serveOrcaApp({ json: true, port: '6768' })).resolves.toBe(0)

    expect(spawnMock).toHaveBeenCalledWith(
      '/repo/node_modules/.bin/electron',
      [resolve(__dirname, '../../..'), '--serve', '--serve-json', '--serve-port', '6768'],
      expect.objectContaining({
        cwd: resolve(__dirname, '../../..')
      })
    )
  })

  it('prints recipe JSON from a detached server child and exits', async () => {
    const child = new FakeChildProcess()
    spawnMock.mockReturnValue(child)
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    const result = serveOrcaApp({
      pairingAddress: 'wss://sandbox.example.com',
      recipeJson: true,
      projectRoot: '/workspace/repo'
    })
    queueMicrotask(() => {
      child.stdout.emit('data', `${RECIPE_JSON}\n`)
    })

    await expect(result).resolves.toBe(0)

    expect(spawnMock).toHaveBeenCalledWith(
      '/Applications/Orca.app/Contents/MacOS/Orca',
      [
        '--serve',
        '--serve-pairing-address',
        'wss://sandbox.example.com',
        '--serve-recipe-json',
        '--serve-project-root',
        '/workspace/repo'
      ],
      expect.objectContaining({
        cwd: resolve(__dirname, '../../..'),
        detached: true,
        stdio: ['ignore', 'pipe', 'inherit']
      })
    )
    expect(writeSpy).toHaveBeenCalledWith(`${RECIPE_JSON}\n`)
    expect(child.unref).toHaveBeenCalled()
  })

  it('waits past startup status lines for valid recipe JSON', async () => {
    const { child, result, stdoutSpy, stderrSpy } = startRecipeJsonServer()
    queueMicrotask(() => {
      child.stdout.emit(
        'data',
        `${SERVE_INSTALL_STATUS}\n${SSH_RECIPE_JSON}\n${RECIPE_JSON.slice(0, 40)}`
      )
      child.stdout.emit('data', `${RECIPE_JSON.slice(40)}\n`)
    })

    await expect(result).resolves.toBe(0)

    expect(stderrSpy).toHaveBeenCalledWith(`${SERVE_INSTALL_STATUS}\n`)
    expect(stderrSpy).toHaveBeenCalledWith(`${SSH_RECIPE_JSON}\n`)
    expect(stdoutSpy).toHaveBeenCalledTimes(1)
    expect(stdoutSpy).toHaveBeenCalledWith(`${RECIPE_JSON}\n`)
    expect(child.unref).toHaveBeenCalledOnce()
  })

  it('rejects when the server exits without valid recipe JSON', async () => {
    const { child, result, stdoutSpy, stderrSpy } = startRecipeJsonServer()
    queueMicrotask(() => {
      child.stdout.emit('data', `${SERVE_INSTALL_STATUS}\nnot recipe JSON\n`)
      child.emit('exit', 0, null)
      child.emit('close', 0, null)
    })

    await expect(result).rejects.toMatchObject({
      code: 'runtime_serve_failed',
      message: 'Orca serve exited before printing valid recipe JSON with code 0.'
    })
    expect(stdoutSpy).not.toHaveBeenCalled()
    expect(stderrSpy).toHaveBeenCalledWith(`${SERVE_INSTALL_STATUS}\n`)
    expect(stderrSpy).toHaveBeenCalledWith('not recipe JSON\n')
    expect(child.unref).not.toHaveBeenCalled()
  })

  it('accepts valid recipe JSON at exit without a trailing newline', async () => {
    const { child, result, stdoutSpy } = startRecipeJsonServer()
    queueMicrotask(() => {
      child.emit('exit', 0, null)
      child.stdout.emit('data', RECIPE_JSON)
      child.emit('close', 0, null)
    })

    await expect(result).resolves.toBe(0)

    expect(stdoutSpy).toHaveBeenCalledWith(`${RECIPE_JSON}\n`)
    expect(child.unref).toHaveBeenCalledOnce()
  })

  it('uses a shell when a Windows npm command shim is the Electron executable', async () => {
    const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')
    Object.defineProperty(process, 'platform', { value: 'win32' })
    process.env.ORCA_APP_EXECUTABLE = 'C:\\repo\\node_modules\\.bin\\electron.cmd'
    const child = {
      kill: vi.fn(),
      once: vi.fn(
        (event: string, handler: (code: number | null, signal: string | null) => void) => {
          if (event === 'exit') {
            queueMicrotask(() => handler(0, null))
          }
          return child
        }
      )
    }
    spawnMock.mockReturnValue(child)

    try {
      await expect(serveOrcaApp({ json: true })).resolves.toBe(0)
      expect(spawnMock).toHaveBeenCalledWith(
        'C:\\repo\\node_modules\\.bin\\electron.cmd',
        ['--serve', '--serve-json'],
        expect.objectContaining({
          shell: true
        })
      )
    } finally {
      if (platformDescriptor) {
        Object.defineProperty(process, 'platform', platformDescriptor)
      }
    }
  })
})

describe('launchOrcaApp', () => {
  beforeEach(() => {
    spawnMock.mockReset()
  })

  afterEach(() => {
    delete process.env.ORCA_OPEN_COMMAND
    delete process.env.ORCA_APP_EXECUTABLE
    delete process.env.ORCA_APP_EXECUTABLE_NEEDS_APP_ROOT
  })

  it('handles asynchronous detached spawn errors without throwing', async () => {
    process.env.ORCA_APP_EXECUTABLE = '/missing/Orca'
    const child = new FakeChildProcess()
    spawnMock.mockReturnValue(child)

    launchOrcaApp()
    child.emit('error', new Error('ENOENT'))
    await Promise.resolve()

    expect(child.unref).toHaveBeenCalled()
  })
})
