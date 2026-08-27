import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { sha256File } from './canonical-json.js'
import { requireInteger, requireRecord, requireString } from './runtime-validation.js'

const INDEX_FILE = 'artifact-index.json'

export type RunArtifactIndexEntry = {
  path: string
  sha256: string
  bytes: number
}

export type RunArtifactIndex = {
  schemaVersion: 1
  files: RunArtifactIndexEntry[]
}

export type RunArtifactVerification = {
  valid: boolean
  failures: string[]
}

export async function createRunArtifactIndex(root: string): Promise<RunArtifactIndex> {
  return { schemaVersion: 1, files: await collectFiles(root) }
}

export async function verifyRunArtifact(root: string): Promise<RunArtifactVerification> {
  const failures: string[] = []
  const expected = parseRunArtifactIndex(
    JSON.parse(await readFile(join(root, INDEX_FILE), 'utf8')) as unknown
  )
  const actual = await collectFiles(root)
  const actualByPath = new Map(actual.map((entry) => [entry.path, entry]))
  const expectedPaths = new Set(expected.files.map((entry) => entry.path))

  for (const entry of expected.files) {
    const observed = actualByPath.get(entry.path)
    if (!observed) {
      failures.push(`missing:${entry.path}`)
      continue
    }
    if (observed.bytes !== entry.bytes) failures.push(`bytes:${entry.path}`)
    if (observed.sha256 !== entry.sha256) failures.push(`sha256:${entry.path}`)
  }
  for (const entry of actual) {
    if (!expectedPaths.has(entry.path)) failures.push(`unexpected:${entry.path}`)
  }
  return { valid: failures.length === 0, failures }
}

async function collectFiles(root: string): Promise<RunArtifactIndexEntry[]> {
  const paths: string[] = []
  await walk(root, paths)
  const entries = await Promise.all(
    paths
      .filter((path) => path !== INDEX_FILE)
      .sort()
      .map(async (path) => {
        const absolutePath = join(root, ...path.split('/'))
        return {
          path,
          sha256: await sha256File(absolutePath),
          bytes: (await stat(absolutePath)).size
        }
      })
  )
  return entries
}

async function walk(root: string, paths: string[], directory = root): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name)
    if (entry.isDirectory()) {
      await walk(root, paths, absolutePath)
      continue
    }
    if (!entry.isFile()) throw new Error(`Run artifact contains a non-file entry: ${absolutePath}`)
    paths.push(relative(root, absolutePath).split(sep).join('/'))
  }
}

function parseRunArtifactIndex(value: unknown): RunArtifactIndex {
  const record = requireRecord(value, 'run artifact index')
  if (record.schemaVersion !== 1 || !Array.isArray(record.files)) {
    throw new TypeError('run artifact index is invalid')
  }
  return {
    schemaVersion: 1,
    files: record.files.map((item, index) => {
      const entry = requireRecord(item, `run artifact index files[${index}]`)
      const sha256 = requireString(entry.sha256, `run artifact index files[${index}].sha256`)
      if (!/^[a-f0-9]{64}$/.test(sha256)) {
        throw new TypeError(`run artifact index files[${index}].sha256 is invalid`)
      }
      return {
        path: requireString(entry.path, `run artifact index files[${index}].path`),
        sha256,
        bytes: requireInteger(entry.bytes, `run artifact index files[${index}].bytes`)
      }
    })
  }
}
