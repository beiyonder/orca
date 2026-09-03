import { afterEach, describe, expect, it } from 'vitest'
import { canonicalJson, sha256Text } from '../src/canonical-json.js'
import {
  ProcessObligationDefinitionV1Schema,
  ProcessObligationV1Schema
} from '../src/domain/process-obligation-contracts.js'
import {
  createPostgresKernelTestContext,
  type PostgresKernelTestContext
} from './postgres-kernel-test-context.js'
import { PROCESS_OBLIGATION_CONTRACT_SAMPLES } from './process-obligation-contract-samples.js'
import { seedRunnableTaskFixture } from './postgres-task-test-fixture.js'

const contexts: PostgresKernelTestContext[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map((context) => context.close()))
})

async function obligationContext(): Promise<PostgresKernelTestContext> {
  const context = await createPostgresKernelTestContext()
  contexts.push(context)
  await seedRunnableTaskFixture(context.pool)
  return context
}

async function insertDefinition(context: PostgresKernelTestContext): Promise<void> {
  const definition = ProcessObligationDefinitionV1Schema.parse(
    PROCESS_OBLIGATION_CONTRACT_SAMPLES['process-obligation-definition.v1']
  )
  const definitionJson = canonicalJson(definition)
  await context.pool.query(
    `INSERT INTO control_plane.process_obligation_definitions (
       tenant_id, definition_id, definition_key, definition_version,
       trigger_event_kind, activated_at, revoked_at, definition,
       definition_sha256, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)`,
    [
      definition.tenantId,
      definition.id,
      definition.definitionKey,
      definition.version,
      definition.trigger.eventKind,
      definition.activatedAt,
      definition.revokedAt,
      definitionJson,
      sha256Text(definitionJson),
      definition.createdAt
    ]
  )
}

async function insertObligation(context: PostgresKernelTestContext): Promise<void> {
  const obligation = ProcessObligationV1Schema.parse(
    PROCESS_OBLIGATION_CONTRACT_SAMPLES['process-obligation.v1']
  )
  const obligationJson = canonicalJson(obligation)
  await context.pool.query(
    `INSERT INTO control_plane.process_obligations (
       tenant_id, mission_id, obligation_id, definition_id, definition_version,
       definition_digest, scope_kind, scope_id, subject_version, trigger_event_id,
       trigger_event_position, obligation_state, opened_at, due_at, grace_until,
       proof_record_ids, breach_id, current_fence, obligation, obligation_sha256,
       terminal_at, created_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
       $16::jsonb, $17, $18, $19::jsonb, $20, $21, $22
     )`,
    [
      obligation.tenantId,
      obligation.missionId,
      obligation.id,
      obligation.definition.id,
      obligation.definition.version,
      obligation.definition.digest,
      obligation.scope.kind,
      obligation.scope.id,
      obligation.scope.subjectVersion,
      obligation.trigger.eventId,
      obligation.trigger.eventPosition,
      obligation.state.status,
      obligation.openedAt,
      obligation.dueAt,
      obligation.graceUntil,
      canonicalJson([]),
      obligation.breachId,
      obligation.currentFence,
      obligationJson,
      sha256Text(obligationJson),
      null,
      obligation.createdAt
    ]
  )
}

describe('PostgreSQL process obligation schema', () => {
  it('stores one exact pending obligation and indexes its durable definition', async () => {
    const context = await obligationContext()
    await insertDefinition(context)
    await insertObligation(context)

    const result = await context.pool.query<{
      obligation_state: string
      definition_version: string
      grace_until: Date
    }>(
      `SELECT obligation_state, definition_version::text, grace_until
       FROM control_plane.process_obligations
       WHERE tenant_id = 'tenant_s1' AND obligation_id = 'obligation_context_delivery_s1'`
    )
    expect(result.rows[0]).toMatchObject({
      obligation_state: 'pending',
      definition_version: '1'
    })
  })

  it('makes obligation definitions immutable', async () => {
    const context = await obligationContext()
    await insertDefinition(context)
    await expect(
      context.pool.query(
        `UPDATE control_plane.process_obligation_definitions
         SET trigger_event_kind = 'changed'
         WHERE tenant_id = 'tenant_s1'
           AND definition_id = 'obligation_definition_context_delivery_v1'`
      )
    ).rejects.toThrow('is immutable')
  })

  it('rejects duplicate trigger scope and incoherent terminal state', async () => {
    const context = await obligationContext()
    await insertDefinition(context)
    await insertObligation(context)
    await expect(insertObligation(context)).rejects.toThrow()
    await expect(
      context.pool.query(
        `UPDATE control_plane.process_obligations
         SET obligation_state = 'satisfied'
         WHERE tenant_id = 'tenant_s1'
           AND obligation_id = 'obligation_context_delivery_s1'`
      )
    ).rejects.toThrow()
  })
})
