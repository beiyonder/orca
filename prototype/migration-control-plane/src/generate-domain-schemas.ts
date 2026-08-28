import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { format } from 'oxfmt'
import { canonicalJson, sha256Text } from './canonical-json.js'
import {
  DOMAIN_SCHEMA_NAMES,
  domainSchemaFileName,
  exportDomainJsonSchema
} from './domain/domain-contract-registry.js'

const labRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = resolve(labRoot, 'schemas', 'v1')
const MANIFEST_FILE = 'manifest.json'

export type GeneratedDomainSchemaFiles = Record<string, string>

async function formatJson(file: string, value: unknown): Promise<string> {
  const result = await format(file, canonicalJson(value), {
    singleQuote: true,
    semi: false,
    printWidth: 100,
    trailingComma: 'none'
  })
  if (result.errors.length > 0) {
    throw new Error(`Oxfmt failed for ${file}: ${result.errors.length} error(s)`)
  }
  return result.code
}

export async function buildDomainSchemaFiles(): Promise<GeneratedDomainSchemaFiles> {
  const files: GeneratedDomainSchemaFiles = {}
  const manifestEntries = await Promise.all(
    DOMAIN_SCHEMA_NAMES.map(async (name) => {
      const file = domainSchemaFileName(name)
      const body = await formatJson(file, exportDomainJsonSchema(name))
      files[file] = body
      return { name, file, sha256: sha256Text(body), bytes: Buffer.byteLength(body, 'utf8') }
    })
  )
  const registryDigest = sha256Text(
    canonicalJson(manifestEntries.map((entry) => ({ name: entry.name, sha256: entry.sha256 })))
  )
  files[MANIFEST_FILE] = await formatJson(MANIFEST_FILE, {
    schemaVersion: 1,
    registryVersion: 1,
    registryDigest,
    schemas: manifestEntries
  })
  return files
}

export async function writeDomainSchemaFiles(
  directory = outputDirectory
): Promise<GeneratedDomainSchemaFiles> {
  const files = await buildDomainSchemaFiles()
  await mkdir(directory, { recursive: true })
  const expected = new Set(Object.keys(files))
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile()) throw new Error(`Schema output contains non-file entry: ${entry.name}`)
    if (!expected.has(entry.name)) await unlink(resolve(directory, entry.name))
  }
  await Promise.all(
    Object.entries(files).map(([file, body]) => writeFile(resolve(directory, file), body, 'utf8'))
  )
  return files
}

export async function checkDomainSchemaFiles(directory = outputDirectory): Promise<void> {
  const expected = await buildDomainSchemaFiles()
  const actualNames = (await readdir(directory)).sort()
  const expectedNames = Object.keys(expected).sort()
  if (canonicalJson(actualNames) !== canonicalJson(expectedNames)) {
    throw new Error('Generated domain schema file set is stale')
  }
  const stale: string[] = []
  for (const file of expectedNames) {
    const actual = await readFile(resolve(directory, file), 'utf8')
    if (actual !== expected[file]) stale.push(file)
  }
  if (stale.length > 0) throw new Error(`Generated domain schemas are stale: ${stale.join(', ')}`)
}

async function main(): Promise<void> {
  const mode = process.argv[2]
  if (mode === '--write') {
    const files = await writeDomainSchemaFiles()
    process.stdout.write(`Generated ${Object.keys(files).length - 1} domain schemas.\n`)
    return
  }
  if (mode === '--check') {
    await checkDomainSchemaFiles()
    process.stdout.write(`Verified ${DOMAIN_SCHEMA_NAMES.length} generated domain schemas.\n`)
    return
  }
  throw new TypeError('Usage: generate-domain-schemas --write|--check')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
