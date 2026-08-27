import { constants } from 'node:fs'
import { access, copyFile, mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { canonicalJson } from './canonical-json.js'
import type { ExperimentStatus, RunCompletion, RunManifest } from './experiment-contracts.js'
import { createRunArtifactIndex } from './run-artifact-integrity.js'

const RUN_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,127}$/
const STANDARD_DIRECTORIES = ['evidence', 'inputs', 'outputs', 'worker'] as const

export class RunArtifactStore {
  readonly #pendingPath: string
  readonly #finalPath: string
  #open = true

  private constructor(pendingPath: string, finalPath: string) {
    this.#pendingPath = pendingPath
    this.#finalPath = finalPath
  }

  static async create(outputRoot: string, manifest: RunManifest): Promise<RunArtifactStore> {
    if (!RUN_ID_PATTERN.test(manifest.runId)) {
      throw new TypeError(`Invalid run ID: ${manifest.runId}`)
    }
    const root = resolve(outputRoot)
    await mkdir(root, { recursive: true })
    const pendingPath = resolve(root, `.pending-${manifest.runId}`)
    const finalPath = resolve(root, manifest.runId)
    let finalExists = true
    try {
      await access(finalPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      finalExists = false
    }
    if (finalExists) throw new Error(`Run artifact already exists: ${manifest.runId}`)
    const store = new RunArtifactStore(pendingPath, finalPath)
    await mkdir(pendingPath)
    for (const directory of STANDARD_DIRECTORIES) {
      await mkdir(resolve(pendingPath, directory))
    }
    await store.writeJson('manifest.json', manifest)
    return store
  }

  pendingPath(): string {
    return this.#pendingPath
  }

  finalPath(): string {
    return this.#finalPath
  }

  async writeJson(relativePath: string, value: unknown): Promise<void> {
    await this.writeText(relativePath, canonicalJson(value))
  }

  async writeJsonLines(relativePath: string, values: readonly unknown[]): Promise<void> {
    const body = values.map((value) => JSON.stringify(value)).join('\n')
    await this.writeText(relativePath, body.length === 0 ? '' : `${body}\n`)
  }

  async writeText(relativePath: string, value: string): Promise<void> {
    this.#assertOpen()
    const target = this.#resolveTarget(relativePath)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, value, { encoding: 'utf8', flag: 'wx' })
  }

  async copyEvidence(sourcePath: string, relativePath: string): Promise<void> {
    this.#assertOpen()
    const target = this.#resolveTarget(`evidence/${relativePath}`)
    await mkdir(dirname(target), { recursive: true })
    await copyFile(sourcePath, target, constants.COPYFILE_EXCL)
  }

  async finalize(status: ExperimentStatus, finalizedAt: string): Promise<string> {
    this.#assertOpen()
    const completion: RunCompletion = { schemaVersion: 1, status, finalizedAt }
    await this.writeJson('run-status.json', completion)
    await this.writeJson('artifact-index.json', await createRunArtifactIndex(this.#pendingPath))
    this.#open = false
    await rename(this.#pendingPath, this.#finalPath)
    return this.#finalPath
  }

  #assertOpen(): void {
    if (!this.#open) throw new Error('Run artifact store is finalized')
  }

  #resolveTarget(relativePath: string): string {
    if (relativePath.length === 0 || isAbsolute(relativePath)) {
      throw new TypeError(`Artifact path must be relative: ${relativePath}`)
    }
    const target = resolve(this.#pendingPath, relativePath)
    const fromRoot = relative(this.#pendingPath, target)
    if (
      fromRoot.length === 0 ||
      fromRoot === '..' ||
      fromRoot.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
    ) {
      throw new TypeError(`Artifact path escapes the run: ${relativePath}`)
    }
    return target
  }
}
