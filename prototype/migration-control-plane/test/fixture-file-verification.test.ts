import { link, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { sha256Text } from '../src/canonical-json.js'
import { verifyFixtureFiles } from '../src/fixture-file-verification.js'

const roots: string[] = []

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'orca-fixture-files-'))
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => rm(root, { recursive: true, force: true })))
})

describe('fixture file verification', () => {
  it('accepts the exact independent regular-file set', async () => {
    const root = await fixtureRoot()
    await writeFile(join(root, 'source.txt'), 'fixture')
    await expect(
      verifyFixtureFiles(
        root,
        [{ path: 'source.txt', bytes: 7, sha256: sha256Text('fixture') }],
        ['source.txt']
      )
    ).resolves.toBeUndefined()
  })

  it('rejects duplicate, incomplete, escaping, and changed file identity', async () => {
    const root = await fixtureRoot()
    await writeFile(join(root, 'source.txt'), 'fixture')
    const file = { path: 'source.txt', bytes: 7, sha256: sha256Text('fixture') }
    await expect(verifyFixtureFiles(root, [file, file], ['source.txt'])).rejects.toThrow(
      'duplicate paths'
    )
    await expect(verifyFixtureFiles(root, [file], ['source.txt', 'missing.txt'])).rejects.toThrow(
      'file set is incomplete'
    )
    await expect(
      verifyFixtureFiles(root, [{ ...file, path: '../source.txt' }], ['../source.txt'])
    ).rejects.toThrow('path escapes root')
    await expect(
      verifyFixtureFiles(root, [{ ...file, sha256: '0'.repeat(64) }], ['source.txt'])
    ).rejects.toThrow('digest mismatch')
  })

  it('rejects hard links and symbolic links', async () => {
    const root = await fixtureRoot()
    const source = join(root, 'source.txt')
    await writeFile(source, 'fixture')
    await link(source, join(root, 'hard-link.txt'))
    const hardLink = { path: 'hard-link.txt', bytes: 7, sha256: sha256Text('fixture') }
    await expect(verifyFixtureFiles(root, [hardLink], ['hard-link.txt'])).rejects.toThrow(
      'not an independent regular file'
    )
    if (process.platform !== 'win32') {
      await symlink('source.txt', join(root, 'symbolic-link.txt'))
      const symbolicLink = {
        path: 'symbolic-link.txt',
        bytes: 7,
        sha256: sha256Text('fixture')
      }
      await expect(verifyFixtureFiles(root, [symbolicLink], ['symbolic-link.txt'])).rejects.toThrow(
        'not an independent regular file'
      )
    }
  })
})
