import { lstat } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import { sha256File } from './canonical-json.js'

export type FixtureFileDigest = {
  path: string
  sha256: string
  bytes: number
}

export async function verifyFixtureFiles(
  root: string,
  files: readonly FixtureFileDigest[],
  expectedPaths: readonly string[]
): Promise<void> {
  const listed = new Set(files.map((entry) => entry.path))
  if (listed.size !== files.length) {
    throw new Error('Fixture manifest contains duplicate paths')
  }
  const expected = new Set(expectedPaths)
  if (
    listed.size !== expected.size ||
    [...expected].some((path) => !listed.has(path)) ||
    [...listed].some((path) => !expected.has(path))
  ) {
    throw new Error('Fixture manifest file set is incomplete')
  }
  const resolvedRoot = resolve(root)
  await Promise.all(
    files.map(async (entry) => {
      if (isAbsolute(entry.path)) {
        throw new Error(`Fixture path must be relative: ${entry.path}`)
      }
      const target = resolve(resolvedRoot, entry.path)
      const fromRoot = relative(resolvedRoot, target)
      if (
        fromRoot === '..' ||
        fromRoot.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
      ) {
        throw new Error(`Fixture path escapes root: ${entry.path}`)
      }
      const fileStat = await lstat(target)
      if (!fileStat.isFile() || fileStat.isSymbolicLink() || fileStat.nlink !== 1) {
        throw new Error(`Fixture path is not an independent regular file: ${entry.path}`)
      }
      if (fileStat.size !== entry.bytes) {
        throw new Error(`Fixture byte size mismatch: ${entry.path}`)
      }
      if ((await sha256File(target)) !== entry.sha256) {
        throw new Error(`Fixture digest mismatch: ${entry.path}`)
      }
    })
  )
}
