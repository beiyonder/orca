import type { Pool, PoolClient } from 'pg'

export async function withPostgresTransaction<T>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await operation(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    let failure = error
    try {
      await client.query('ROLLBACK')
    } catch (rollbackError) {
      failure = new AggregateError(
        [error, rollbackError],
        'PostgreSQL transaction and rollback failed'
      )
    }
    throw failure
  } finally {
    client.release()
  }
}
