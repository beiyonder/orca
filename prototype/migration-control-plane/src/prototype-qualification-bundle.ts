import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { canonicalJson, sha256Text, type JsonValue } from './canonical-json.js'
import { createRunArtifactIndex } from './run-artifact-integrity.js'

export type QualificationBundleIndexEntry = {
  path: string
  bytes: number
  sha256: string
}

export type QualificationBundleIndex = {
  schemaVersion: 1
  bundleId: string
  files: QualificationBundleIndexEntry[]
}

export class PrototypeQualificationBundle {
  readonly #root: string
  readonly #bundleId: string

  private constructor(root: string, bundleId: string) {
    this.#root = root
    this.#bundleId = bundleId
  }

  static async create(root: string, bundleId: string): Promise<PrototypeQualificationBundle> {
    try {
      await stat(root)
      throw new Error(`Qualification bundle already exists: ${root}`)
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
        throw error
      }
    }
    await mkdir(root, { recursive: true })
    return new PrototypeQualificationBundle(resolve(root), bundleId)
  }

  async writeJson(relativePath: string, value: JsonValue): Promise<void> {
    if (!/^[a-z0-9][a-z0-9._/-]*\.json$/.test(relativePath) || relativePath.includes('..')) {
      throw new TypeError(`Invalid qualification evidence path: ${relativePath}`)
    }
    const body = `${canonicalJson(value)}\n`
    const path = join(this.#root, relativePath)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, body, { encoding: 'utf8', flag: 'wx' })
  }
  async finalize(): Promise<QualificationBundleIndex> {
    const index: QualificationBundleIndex = {
      schemaVersion: 1,
      bundleId: this.#bundleId,
      files: (await createRunArtifactIndex(this.#root)).files
    }
    await writeFile(join(this.#root, 'artifact-index.json'), `${canonicalJson(index)}\n`, {
      encoding: 'utf8',
      flag: 'wx'
    })
    return index
  }
}

export async function verifyPrototypeQualificationBundle(
  root: string
): Promise<QualificationBundleIndex> {
  const index = JSON.parse(await readFile(join(root, 'artifact-index.json'), 'utf8')) as
    | QualificationBundleIndex
    | undefined
  if (!index || index.schemaVersion !== 1 || !Array.isArray(index.files)) {
    throw new Error('Qualification artifact index is invalid')
  }
  for (const entry of index.files) {
    const body = await readFile(join(root, entry.path))
    if (body.byteLength !== entry.bytes || sha256Text(body.toString('utf8')) !== entry.sha256) {
      throw new Error(`Qualification evidence integrity failed: ${entry.path}`)
    }
  }
  return index
}
