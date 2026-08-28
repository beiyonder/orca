import { canonicalJson } from './canonical-json.js'
import { fingerprintPostgresSchema } from './database/postgres-schema-fingerprint.js'
import { migratePostgresSchema } from './database/postgres-schema-migrator.js'

function databaseUrl(): string {
  const value = process.env.MIGRATION_CONTROL_DATABASE_URL
  if (!value) {
    throw new Error('MIGRATION_CONTROL_DATABASE_URL is required')
  }
  return value
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2)
  if (rest.length > 0) {
    throw new TypeError('Database commands do not accept positional arguments')
  }
  if (command === 'migrate') {
    const result = await migratePostgresSchema({ connectionString: databaseUrl() })
    process.stdout.write(canonicalJson(result))
    return
  }
  if (command === 'fingerprint') {
    const fingerprint = await fingerprintPostgresSchema(databaseUrl())
    process.stdout.write(`${fingerprint}\n`)
    return
  }
  throw new TypeError('Usage: database-cli migrate|fingerprint')
}

await main()
