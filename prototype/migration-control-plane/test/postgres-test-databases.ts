import { randomUUID } from 'node:crypto'
import { Client } from 'pg'

export type PostgresTestDatabase = {
  connectionString: string
  drop: () => Promise<void>
}

function requiredAdministrativeUrl(): URL {
  const value = process.env.MIGRATION_CONTROL_DATABASE_URL
  if (!value) {
    throw new Error(
      'MIGRATION_CONTROL_DATABASE_URL is required for real PostgreSQL integration tests'
    )
  }
  const url = new URL(value)
  url.pathname = '/postgres'
  return url
}

export async function createPostgresTestDatabase(options?: {
  encoding: 'UTF8'
  collation: 'C'
}): Promise<PostgresTestDatabase> {
  const administrativeUrl = requiredAdministrativeUrl()
  const databaseName = `mcp_test_${randomUUID().replaceAll('-', '')}`
  const administrativeClient = new Client({ connectionString: administrativeUrl.toString() })
  await administrativeClient.connect()
  try {
    await administrativeClient.query(
      options
        ? `CREATE DATABASE ${databaseName} TEMPLATE template0 ENCODING '${options.encoding}' LC_COLLATE '${options.collation}' LC_CTYPE '${options.collation}'`
        : `CREATE DATABASE ${databaseName}`
    )
  } finally {
    await administrativeClient.end()
  }

  const databaseUrl = new URL(administrativeUrl)
  databaseUrl.pathname = `/${databaseName}`
  let dropped = false
  return {
    connectionString: databaseUrl.toString(),
    drop: async () => {
      if (dropped) {
        return
      }
      dropped = true
      const client = new Client({ connectionString: administrativeUrl.toString() })
      await client.connect()
      try {
        await client.query(`DROP DATABASE ${databaseName} WITH (FORCE)`)
      } finally {
        await client.end()
      }
    }
  }
}
