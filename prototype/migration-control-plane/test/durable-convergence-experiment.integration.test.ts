import { afterEach, describe, expect, it } from 'vitest'
import { runDurableConvergenceExperiment } from '../src/durable-convergence-experiment.js'
import { createPostgresTestDatabase, type PostgresTestDatabase } from './postgres-test-databases.js'

const databases: PostgresTestDatabase[] = []

async function experimentDatabase(): Promise<PostgresTestDatabase> {
  const database = await createPostgresTestDatabase()
  databases.push(database)
  return database
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (database) => database.drop()))
})

describe.sequential('DUR-EXP-01 durable convergence', () => {
  it('passes duplicate, crash, stale, replay, restart, and terminal predicates across seeds', async () => {
    const seeds = [11, 29, 47]
    const results = await Promise.all(
      seeds.map(async (seed) => {
        const database = await experimentDatabase()
        return runDurableConvergenceExperiment(database.connectionString, seed)
      })
    )
    for (const [index, result] of results.entries()) {
      expect(result.status).toBe('passed')
      expect(result.measures.every((item) => item.status === 'pass')).toBe(true)
      expect(result.outputs.tenantId).toBe(`tenant_dur_s${seeds[index]}`)
      expect(result.outputs.state).toMatchObject({
        mission_state: 'completed',
        revision: '2',
        task_state: 'completed',
        attempt_state: 'succeeded',
        commands: '2',
        events: '2',
        outbox: '2',
        recovery: '2'
      })
    }
  })
})
