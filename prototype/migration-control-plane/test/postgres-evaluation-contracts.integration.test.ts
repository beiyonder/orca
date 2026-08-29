import { Pool } from 'pg'
import { afterEach, describe, expect, it } from 'vitest'
import { MissingTaskEvaluationError } from '../src/attempt-authority.js'
import { insertPostgresDomainRecords } from '../src/database/postgres-domain-record-store.js'
import { migratePostgresSchema } from '../src/database/postgres-schema-migrator.js'
import { assertPostgresTaskEvaluationGate } from '../src/database/postgres-task-evaluation-gate.js'
import { TaskRecordV1Schema } from '../src/domain/assignment-contracts.js'
import { buildDurableConvergenceFixture } from '../src/durable-convergence-fixture.js'
import { reconstructEvaluationContractRegistry } from '../src/evaluation-contract-reconstruction.js'
import { createPostgresTestDatabase, type PostgresTestDatabase } from './postgres-test-databases.js'

const databases: PostgresTestDatabase[] = []

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (database) => database.drop()))
})

describe('PostgreSQL evaluation V2 contracts', () => {
  it('persists versioned immutable authority and reconstructs exact lineage', async () => {
    const database = await createPostgresTestDatabase()
    databases.push(database)
    await migratePostgresSchema({ connectionString: database.connectionString })
    const fixture = buildDurableConvergenceFixture(701)
    const records = [
      {
        schemaName: 'evaluator-definition.v2',
        payload: fixture.evaluatorDefinition,
        missionId: null,
        state: 'active'
      },
      {
        schemaName: 'evaluation-contract.v2',
        payload: fixture.evaluationContract,
        missionId: null,
        state: 'active'
      },
      {
        schemaName: 'assignment-result.v1',
        payload: fixture.assignmentResult,
        missionId: fixture.missionId,
        state: 'succeeded'
      },
      {
        schemaName: 'evidence-item.v1',
        payload: fixture.evaluationEvidence,
        missionId: fixture.missionId,
        state: 'current'
      },
      {
        schemaName: 'evaluation-assignment.v2',
        payload: fixture.evaluationAssignment,
        missionId: fixture.missionId,
        state: 'completed'
      },
      {
        schemaName: 'evaluation-result.v2',
        payload: fixture.evaluationResult,
        missionId: fixture.missionId,
        state: 'passed'
      }
    ] as const
    const pool = new Pool({ connectionString: database.connectionString, max: 1 })
    const client = await pool.connect()
    try {
      await insertPostgresDomainRecords(
        client,
        records.map((record) => ({
          tenantId: fixture.tenantId,
          recordId: record.payload.id,
          missionId: record.missionId,
          schemaName: record.schemaName,
          recordKind: record.payload.kind,
          recordState: record.state,
          payload: record.payload,
          createdAt: record.payload.createdAt
        }))
      )
      const stored = await client.query<{
        schema_name: string
        schema_version: number
        payload: unknown
      }>(
        `SELECT schema_name, schema_version, payload
         FROM control_plane.domain_records
         WHERE tenant_id = $1
           AND schema_name = ANY($2::text[])
         ORDER BY schema_name`,
        [fixture.tenantId, records.map((record) => record.schemaName)]
      )
      expect(stored.rows).toHaveLength(6)
      expect(
        stored.rows
          .filter((row) => row.schema_name.endsWith('.v2'))
          .every((row) => row.schema_version === 2)
      ).toBe(true)
      const payload = (schemaName: string) =>
        stored.rows.filter((row) => row.schema_name === schemaName).map((row) => row.payload)
      expect(() =>
        reconstructEvaluationContractRegistry({
          definitions: payload('evaluator-definition.v2'),
          contracts: payload('evaluation-contract.v2'),
          assignments: payload('evaluation-assignment.v2'),
          results: payload('evaluation-result.v2')
        })
      ).not.toThrow()
      const completedTask = TaskRecordV1Schema.parse({
        ...fixture.task,
        revision: fixture.task.revision + 1,
        state: {
          status: 'completed',
          reason: 'Evaluation contract passed.',
          completedAt: fixture.activeObservedAt,
          acceptedAssignmentResultIds: [fixture.assignmentResult.id],
          acceptedArtifactVersionIds: []
        }
      })
      await expect(
        assertPostgresTaskEvaluationGate(
          client,
          completedTask,
          fixture.attempt,
          [fixture.evaluationResult.id],
          fixture.activeObservedAt
        )
      ).resolves.toBeUndefined()
      await expect(
        assertPostgresTaskEvaluationGate(
          client,
          completedTask,
          fixture.attempt,
          [fixture.evaluationResult.id],
          '2026-01-01T00:03:00.000Z'
        )
      ).rejects.toBeInstanceOf(MissingTaskEvaluationError)
      await expect(
        client.query(
          `UPDATE control_plane.domain_records
           SET record_state = 'changed'
           WHERE tenant_id = $1 AND record_id = $2`,
          [fixture.tenantId, fixture.evaluationContract.id]
        )
      ).rejects.toSatisfy(
        (error: unknown) =>
          typeof error === 'object' && error !== null && 'code' in error && error.code === '55000'
      )
      await expect(
        client.query(
          `DELETE FROM control_plane.domain_records
           WHERE tenant_id = $1 AND record_id = $2`,
          [fixture.tenantId, fixture.evaluationResult.id]
        )
      ).rejects.toSatisfy(
        (error: unknown) =>
          typeof error === 'object' && error !== null && 'code' in error && error.code === '55000'
      )
    } finally {
      client.release()
      await pool.end()
    }
  })
})
