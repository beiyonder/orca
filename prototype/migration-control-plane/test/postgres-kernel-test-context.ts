import { Pool } from 'pg'
import { migratePostgresSchema } from '../src/database/postgres-schema-migrator.js'
import { createPostgresTestDatabase } from './postgres-test-databases.js'

export type PostgresKernelTestContext = {
  pool: Pool
  connectionString: string
  close: () => Promise<void>
}

export async function createPostgresKernelTestContext(): Promise<PostgresKernelTestContext> {
  const database = await createPostgresTestDatabase()
  await migratePostgresSchema({ connectionString: database.connectionString })
  const pool = new Pool({ connectionString: database.connectionString, max: 8 })
  let closed = false
  return {
    pool,
    connectionString: database.connectionString,
    close: async () => {
      if (closed) {
        return
      }
      closed = true
      await pool.end()
      await database.drop()
    }
  }
}
