import type { Pool } from 'pg'
import { afterEach, describe, expect, it } from 'vitest'
import { canonicalJson, sha256Text } from '../src/canonical-json.js'
import { executeIdempotentMissionCommand } from '../src/database/postgres-command-idempotency.js'
import { insertPostgresDomainRecords } from '../src/database/postgres-domain-record-store.js'
import { registerProcessObligationDefinition } from '../src/database/postgres-process-obligation-definition.js'
import {
  commitMissionTransitionWithObligations,
  type ProcessObligationInstantiation
} from '../src/database/postgres-process-obligation-instantiation.js'
import {
  rebuildProcessObligationProjection,
  reconcileProcessObligationsOnRestart
} from '../src/database/postgres-process-obligation-replay.js'
import { PostgresProcessObligationError } from '../src/database/postgres-process-obligation-errors.js'
import { settlePostgresProcessObligation } from '../src/database/postgres-process-obligation-settlement.js'
import { withPostgresTransaction } from '../src/database/postgres-transaction.js'
import type { ProcessObligationDefinitionV1 } from '../src/domain/process-obligation-contracts.js'
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

const contexts: PostgresKernelTestContext[] = []
type MutableDefinitionFixture = {
  trigger: { eventKind: string }
  scopeKinds: string[]
  proof: { schemas: { digest: string }[]; maxAgeMs: number | null }
}

const systemActor = { kind: 'system', id: 'obligation-lifecycle', version: '1' }

afterEach(async () => {
  await Promise.all(contexts.splice(0).map((context) => context.close()))
})

async function lifecycleContext(): Promise<PostgresKernelTestContext> {
  const context = await createPostgresKernelTestContext()
  contexts.push(context)
  await createMissionFixture(context.pool)
  return context
}

async function registerDefinition(
  context: PostgresKernelTestContext
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
  return registerProcessObligationDefinition(context.pool, sample)
}

async function instantiateObligation(
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

async function insertProofRecord(
  pool: Pool,
  schemaName: 'context-manifest.v1' | 'evidence-item.v1'
) {
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

describe('PostgreSQL process obligation lifecycle', () => {
  it('commits trigger and every applicable obligation atomically', async () => {
    const context = await lifecycleContext()
    await registerDefinition(context)
    const result = await instantiateObligation(context, { suffix: 'obligation_atomic' })
    expect(result.outcome).toMatchObject({
      status: 'committed',
      result: { obligationIds: ['obligation_obligation_atomic'] }
    })
    const state = await context.pool.query<{ revisions: string; obligations: string }>(
      `SELECT
         (SELECT revision::text FROM control_plane.mission_aggregates
          WHERE tenant_id = 'tenant_s1' AND mission_id = 'mission_s1') AS revisions,
         (SELECT count(*)::text FROM control_plane.process_obligations) AS obligations`
    )
    expect(state.rows[0]).toEqual({ revisions: '2', obligations: '1' })
  })

  it('rolls back the mission transition when an applicable definition is omitted', async () => {
    const context = await lifecycleContext()
    await registerDefinition(context)
    await expect(
      instantiateObligation(context, { suffix: 'obligation_omitted', obligations: [] })
    ).rejects.toThrow('must be instantiated exactly once')
    const state = await context.pool.query<{
      revision: string
      events: string
      obligations: string
    }>(
      `SELECT
         (SELECT revision::text FROM control_plane.mission_aggregates
          WHERE tenant_id = 'tenant_s1' AND mission_id = 'mission_s1') AS revision,
         (SELECT count(*)::text FROM control_plane.mission_events) AS events,
         (SELECT count(*)::text FROM control_plane.process_obligations) AS obligations`
    )
    expect(state.rows[0]).toEqual({ revision: '1', events: '1', obligations: '0' })
  })

  it('admits exact proof, rejects stale fences, and preserves immutable transition history', async () => {
    const context = await lifecycleContext()
    await registerDefinition(context)
    await instantiateObligation(context, { suffix: 'obligation_proof' })
    await insertProofRecord(context.pool, 'context-manifest.v1')
    const settled = await settlePostgresProcessObligation(context.pool, {
      tenantId: 'tenant_s1',
      missionId: 'mission_s1',
      obligationId: 'obligation_obligation_proof',
      expectedFence: 1,
      transitionId: 'obligation_transition_proof_s1',
      rationale: 'Exact admitted context proves completion.',
      transitionedBy: systemActor,
      settlement: { kind: 'satisfy', proofRecordIds: ['context_s1'] }
    })
    expect(settled.state.status).toBe('satisfied')
    await expect(
      settlePostgresProcessObligation(context.pool, {
        tenantId: 'tenant_s1',
        missionId: 'mission_s1',
        obligationId: 'obligation_obligation_proof',
        expectedFence: 2,
        transitionId: 'obligation_transition_stale_s1',
        rationale: 'Stale attempt.',
        transitionedBy: systemActor,
        settlement: { kind: 'satisfy', proofRecordIds: ['context_s1'] }
      })
    ).rejects.toBeInstanceOf(PostgresProcessObligationError)
    const transitions = await context.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM control_plane.domain_records
       WHERE schema_name = 'process-obligation-transition.v1'`
    )
    expect(transitions.rows[0]?.count).toBe('1')
  })

  it('admits only an evidenced currently authorized waiver', async () => {
    const context = await lifecycleContext()
    const registered = await registerDefinition(context)
    await instantiateObligation(context, { suffix: 'obligation_waiver' })
    await insertProofRecord(context.pool, 'evidence-item.v1')
    const issuedAt = new Date().toISOString()
    const waiver = {
      ...structuredClone(PROCESS_OBLIGATION_CONTRACT_SAMPLES['process-obligation-waiver.v1']),
      obligationId: 'obligation_obligation_waiver',
      definition: {
        id: registered.definition.id,
        version: registered.definition.version,
        digest: registered.digest
      },
      scope: { kind: 'mission', id: 'mission_s1', subjectVersion: '2' },
      evidenceIds: ['evidence_s1'],
      createdAt: issuedAt,
      issuedAt,
      expiresAt: new Date(Date.parse(issuedAt) + 60_000).toISOString()
    }
    const settled = await settlePostgresProcessObligation(context.pool, {
      tenantId: 'tenant_s1',
      missionId: 'mission_s1',
      obligationId: 'obligation_obligation_waiver',
      expectedFence: 1,
      transitionId: 'obligation_transition_waiver_s1',
      rationale: 'Authorized fixture waiver.',
      transitionedBy: systemActor,
      settlement: { kind: 'waive', waiver }
    })
    expect(settled.state.status).toBe('waived')
  })

  it('requires a durable superseding event for cancellation', async () => {
    const context = await lifecycleContext()
    await registerDefinition(context)
    await instantiateObligation(context, { suffix: 'obligation_cancel' })
    const settled = await settlePostgresProcessObligation(context.pool, {
      tenantId: 'tenant_s1',
      missionId: 'mission_s1',
      obligationId: 'obligation_obligation_cancel',
      expectedFence: 1,
      transitionId: 'obligation_transition_cancel_s1',
      rationale: 'Plan revision removed the requirement.',
      transitionedBy: systemActor,
      settlement: {
        kind: 'cancel',
        supersedingEventId: 'event_obligation_cancel',
        reason: 'Plan revision removed the requirement.'
      }
    })
    expect(settled.state.status).toBe('cancelled')
  })

  it('rebuilds the projection from immutable transitions and clears expired claims on restart', async () => {
    const context = await lifecycleContext()
    await registerDefinition(context)
    await instantiateObligation(context, { suffix: 'obligation_replay' })
    await insertProofRecord(context.pool, 'context-manifest.v1')
    const settled = await settlePostgresProcessObligation(context.pool, {
      tenantId: 'tenant_s1',
      missionId: 'mission_s1',
      obligationId: 'obligation_obligation_replay',
      expectedFence: 1,
      transitionId: 'obligation_transition_replay_s1',
      rationale: 'Exact admitted context proves completion.',
      transitionedBy: systemActor,
      settlement: { kind: 'satisfy', proofRecordIds: ['context_s1'] }
    })
    await context.pool.query(
      `UPDATE control_plane.process_obligations
       SET obligation_state = 'pending', proof_record_ids = '[]'::jsonb,
           obligation = $1::jsonb, obligation_sha256 = $2,
           terminal_at = NULL,
           monitor_claimed_by = 'dead-monitor', monitor_claim_id = 'dead-claim',
           monitor_claim_expires_at = transaction_timestamp() - interval '1 second'
       WHERE tenant_id = 'tenant_s1' AND obligation_id = 'obligation_obligation_replay'`,
      [
        canonicalJson({ ...settled, state: { status: 'pending' } }),
        sha256Text(canonicalJson({ ...settled, state: { status: 'pending' } }))
      ]
    )
    const rebuilt = await rebuildProcessObligationProjection(
      context.pool,
      'tenant_s1',
      'mission_s1'
    )
    expect(rebuilt.obligationCount).toBe(1)
    const restart = await reconcileProcessObligationsOnRestart(
      context.pool,
      'tenant_s1',
      'mission_s1'
    )
    expect(restart).toEqual({
      expiredClaimsCleared: 0,
      overduePending: 0,
      activePending: 0,
      terminal: 1
    })
    const projection = await context.pool.query<{ obligation_state: string }>(
      `SELECT obligation_state FROM control_plane.process_obligations
       WHERE tenant_id = 'tenant_s1' AND obligation_id = 'obligation_obligation_replay'`
    )
    expect(projection.rows[0]?.obligation_state).toBe('satisfied')
  })
})
