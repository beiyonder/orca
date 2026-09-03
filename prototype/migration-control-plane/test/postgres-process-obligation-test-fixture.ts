import type { Pool } from 'pg'
import { canonicalJson, sha256Text } from '../src/canonical-json.js'
import { executeIdempotentMissionCommand } from '../src/database/postgres-command-idempotency.js'
import { insertPostgresDomainRecords } from '../src/database/postgres-domain-record-store.js'
import { registerProcessObligationDefinition } from '../src/database/postgres-process-obligation-definition.js'
import {
  commitMissionTransitionWithObligations,
  type ProcessObligationInstantiation
} from '../src/database/postgres-process-obligation-instantiation.js'
import { withPostgresTransaction } from '../src/database/postgres-transaction.js'
import {
  ProcessObligationV1Schema,
  type ProcessObligationDefinitionV1
} from '../src/domain/process-obligation-contracts.js'
import { DOMAIN_CONTRACT_SAMPLES } from './domain-contract-samples.js'
import {
  buildMissionAdvanceFixture,
  createMissionFixture
} from './postgres-mission-test-fixture.js'
import {
  createPostgresKernelTestContext,
  type PostgresKernelTestContext
} from './postgres-kernel-test-context.js'
import { PROCESS_OBLIGATION_CONTRACT_SAMPLES } from './process-obligation-contract-samples.js'

type MutableDefinitionFixture = {
  trigger: { eventKind: string }
  scopeKinds: string[]
  proof: { schemas: { digest: string }[]; maxAgeMs: number | null }
  timing: { deadlineOffsetMs: number; graceMs: number }
  breachAction: ProcessObligationDefinitionV1['breachAction']
}

export const processObligationSystemActor = {
  kind: 'system',
  id: 'obligation-lifecycle',
  version: '1'
}

export async function createProcessObligationTestContext(): Promise<PostgresKernelTestContext> {
  const context = await createPostgresKernelTestContext()
  await createMissionFixture(context.pool)
  return context
}

export async function registerProcessObligationTestDefinition(
  context: PostgresKernelTestContext,
  options: {
    deadlineOffsetMs?: number
    graceMs?: number
    breachAction?: ProcessObligationDefinitionV1['breachAction']
  } = {}
): Promise<{ definition: ProcessObligationDefinitionV1; digest: string }> {
  const contract = await context.pool.query<{ schema_sha256: string }>(
    `SELECT schema_sha256 FROM control_plane.contract_schemas
     WHERE schema_name = 'context-manifest.v1'`
  )
  const sample = structuredClone(
    PROCESS_OBLIGATION_CONTRACT_SAMPLES['process-obligation-definition.v1']
  ) as MutableDefinitionFixture
  sample.trigger.eventKind = 'evidence-recorded'
  sample.scopeKinds = ['mission']
  sample.proof.schemas[0]!.digest = contract.rows[0]!.schema_sha256
  sample.proof.maxAgeMs = null
  sample.timing.deadlineOffsetMs = options.deadlineOffsetMs ?? sample.timing.deadlineOffsetMs
  sample.timing.graceMs = options.graceMs ?? sample.timing.graceMs
  sample.breachAction = options.breachAction ?? sample.breachAction
  return registerProcessObligationDefinition(context.pool, sample)
}

export async function instantiateProcessObligation(
  context: PostgresKernelTestContext,
  options: {
    suffix: string
    obligationId?: string
    obligations?: ProcessObligationInstantiation[]
  }
) {
  const fixture = buildMissionAdvanceFixture({ suffix: options.suffix })
  const obligationId = options.obligationId ?? `obligation_${options.suffix}`
  return executeIdempotentMissionCommand(context.pool, fixture.command, async (client, command) =>
    commitMissionTransitionWithObligations(client, command, {
      ...fixture.transition,
      obligations: options.obligations ?? [
        {
          obligationId,
          definitionId: 'obligation_definition_context_delivery_v1',
          scope: { kind: 'mission', id: 'mission_s1', subjectVersion: '2' },
          currentFence: 1
        }
      ]
    })
  )
}

export async function insertProcessObligationProofRecord(
  pool: Pool,
  schemaName: 'context-manifest.v1' | 'evidence-item.v1'
): Promise<void> {
  const sample = structuredClone(DOMAIN_CONTRACT_SAMPLES[schemaName]) as Record<string, unknown>
  await withPostgresTransaction(pool, async (client) => {
    await insertPostgresDomainRecords(client, [
      {
        tenantId: sample.tenantId as string,
        recordId: sample.id as string,
        missionId: sample.missionId as string,
        schemaName,
        recordKind: schemaName === 'context-manifest.v1' ? 'context-manifest' : 'evidence-item',
        recordState: 'admitted',
        payload: sample,
        createdAt: sample.createdAt as string
      }
    ])
  })
}

export async function expireProcessObligationTestFixture(
  pool: Pool,
  obligationId: string
): Promise<void> {
  await withPostgresTransaction(pool, async (client) => {
    const clock = await client.query<{ now: Date }>('SELECT transaction_timestamp() AS now')
    const result = await client.query<{ obligation: unknown }>(
      `SELECT obligation FROM control_plane.process_obligations
       WHERE tenant_id = 'tenant_s1' AND obligation_id = $1
       FOR UPDATE`,
      [obligationId]
    )
    const obligation = ProcessObligationV1Schema.parse(result.rows[0]!.obligation)
    const now = clock.rows[0]!.now.getTime()
    const expired = ProcessObligationV1Schema.parse({
      ...obligation,
      openedAt: new Date(now - 3_000).toISOString(),
      dueAt: new Date(now - 2_000).toISOString(),
      graceUntil: new Date(now - 1_000).toISOString()
    })
    const payload = canonicalJson(expired)
    const digest = sha256Text(payload)
    await client.query(
      `UPDATE control_plane.process_obligations
       SET opened_at = $2, due_at = $3, grace_until = $4,
           obligation = $5::jsonb, obligation_sha256 = $6,
           updated_at = transaction_timestamp()
       WHERE tenant_id = 'tenant_s1' AND obligation_id = $1`,
      [obligationId, expired.openedAt, expired.dueAt, expired.graceUntil, payload, digest]
    )
    await client.query(
      `UPDATE control_plane.domain_records
       SET payload = $2::jsonb, payload_sha256 = $3,
           updated_at = transaction_timestamp()
       WHERE tenant_id = 'tenant_s1' AND record_id = $1
         AND schema_name = 'process-obligation.v1'`,
      [obligationId, payload, digest]
    )
  })
}
