import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { sha256Text } from '../canonical-json.js'

const MIGRATION_FILE_PATTERN = /^(\d{3})-([a-z][a-z0-9-]*)\.sql$/
const labRoot = resolve(import.meta.dirname, '..', '..')

export const POSTGRES_MIGRATIONS_DIRECTORY = resolve(labRoot, 'migrations')

export type PostgresMigration = {
  version: number
  name: string
  file: string
  sha256: string
  sql: string
}

export async function loadPostgresMigrationCatalog(
  directory = POSTGRES_MIGRATIONS_DIRECTORY
): Promise<readonly PostgresMigration[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const descriptors = entries.map((entry) => {
    if (!entry.isFile()) {
      throw new Error(`Migration directory contains non-file entry: ${entry.name}`)
    }
    const match = MIGRATION_FILE_PATTERN.exec(entry.name)
    if (!match) {
      throw new Error(`Invalid PostgreSQL migration filename: ${entry.name}`)
    }
    return { file: entry.name, version: Number(match[1]), name: match[2]! }
  })
  const migrations = await Promise.all(
    descriptors.map(async (descriptor) => {
      const sql = await readFile(resolve(directory, descriptor.file), 'utf8')
      if (!sql.endsWith('\n') || sql.includes('\r')) {
        throw new Error(
          `PostgreSQL migration must use LF and end with a newline: ${descriptor.file}`
        )
      }
      return { ...descriptor, sha256: sha256Text(sql), sql }
    })
  )
  migrations.sort((left, right) => left.version - right.version)
  for (const [index, migration] of migrations.entries()) {
    const expectedVersion = index + 1
    if (migration.version !== expectedVersion) {
      throw new Error(
        `PostgreSQL migrations must be contiguous from 001: expected ${expectedVersion}, found ${migration.version}`
      )
    }
  }
  if (migrations.length === 0) {
    throw new Error('No PostgreSQL migrations found')
  }
  return migrations
}
