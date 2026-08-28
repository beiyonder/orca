import { chmod, lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { sha256Text } from './canonical-json.js'

const MAX_CORPUS_OBJECT_BYTES = 64 * 1024 * 1024

export class ImmutableCorpusStoreError extends Error {
  readonly code: string
  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ImmutableCorpusStoreError'
    this.code = code
  }
}

export function corpusFailure(
  code: string,
  message: string,
  cause?: unknown
): ImmutableCorpusStoreError {
  return new ImmutableCorpusStoreError(code, message, cause === undefined ? undefined : { cause })
}

function errnoCode(error: unknown): string | undefined {
  return error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined
}

async function privateDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 })
  const metadata = await lstat(path)
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw corpusFailure('unsafe_storage_path', `Corpus directory is not private storage: ${path}`)
  }
  if (process.platform !== 'win32') {
    await chmod(path, 0o700)
  }
}

export async function openCorpusRoot(
  root: string,
  directories: readonly string[]
): Promise<string> {
  await privateDirectory(resolve(root))
  const canonicalRoot = await realpath(resolve(root))
  await Promise.all(
    directories.map(async (directory) => {
      const path = join(canonicalRoot, directory)
      await privateDirectory(path)
      if ((await realpath(path)) !== path) {
        throw corpusFailure('unsafe_storage_path', `Corpus directory escapes its root: ${path}`)
      }
    })
  )
  return canonicalRoot
}

export async function writeImmutableCorpusFile(path: string, bytes: Uint8Array): Promise<void> {
  await privateDirectory(dirname(path))
  try {
    await writeFile(path, bytes, { flag: 'wx', mode: 0o400 })
    if (process.platform !== 'win32') {
      await chmod(path, 0o400)
    }
  } catch (error) {
    if (errnoCode(error) !== 'EEXIST') {
      throw error
    }
    const existing = await readImmutableCorpusFile(path)
    if (!existing.equals(Buffer.from(bytes))) {
      throw corpusFailure('immutable_conflict', `Immutable corpus record differs: ${path}`)
    }
  }
}

export async function readImmutableCorpusFile(path: string): Promise<Buffer> {
  const metadata = await lstat(path)
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1) {
    throw corpusFailure(
      'unsafe_storage_path',
      `Corpus record is not a private regular file: ${path}`
    )
  }
  return readFile(path)
}

export function verifyCorpusBytes(
  bytes: Uint8Array,
  expected: { sha256: string; bytes: number },
  label: string
): void {
  if (bytes.byteLength > MAX_CORPUS_OBJECT_BYTES) {
    throw corpusFailure('object_too_large', `${label} exceeds the 64 MiB corpus object limit`)
  }
  if (sha256Text(bytes) !== expected.sha256) {
    throw corpusFailure('digest_mismatch', `${label} digest differs`)
  }
  if (bytes.byteLength !== expected.bytes) {
    throw corpusFailure('byte_count_mismatch', `${label} byte count differs`)
  }
}
