import type { Pool } from 'pg'
import { canonicalJson, sha256Text } from './canonical-json.js'
import { executeIdempotentMissionCommand } from './database/postgres-command-idempotency.js'
import { insertPostgresDomainRecords } from './database/postgres-domain-record-store.js'
import { commitMissionTransition } from './database/postgres-mission-transition.js'
import { registerProcessObligationDefinition } from './database/postgres-process-obligation-definition.js'
import {
  commitMissionTransitionWithObligations,
  type ProcessObligationInstantiation
} from './database/postgres-process-obligation-instantiation.js'
import { withPostgresTransaction } from './database/postgres-transaction.js'
import { EvidenceItemV1Schema } from './domain/epistemic-contracts.js'
import { MissionRecordV1Schema } from './domain/mission-contracts.js'
import {
  ProcessObligationDefinitionV1Schema,
  ProcessObligationV1Schema,
  type ProcessObligationDefinitionV1
} from './domain/process-obligation-contracts.js'
import { buildDurableMissionFixture } from './durable-convergence-mission-fixture.js'
import type { DurableMissionFixture } from './durable-convergence-types.js'

export const processCompletenessActor = {
  kind: 'system' as const,
  id: 'process-completeness-experiment',
  version: '1'
}

export type ProcessCompletenessCase = {
  index: number
  fixture: DurableMissionFixture
  obligationId: string
  definition: ProcessObligationDefinitionV1
  definitionDigest: string
}

type DefinitionMode = 'active' | 'future' | 'revoked'

export async function createProcessCompletenessCase(
  pool: Pool,
  seed: number,
  index: number,
  options: {
    definitionMode?: DefinitionMode
    triggerEventKind?: string
    breachAction?: ProcessObligationDefinitionV1['breachAction']
  } = {}
): Promise<ProcessCompletenessCase> {
  const fixture = buildDurableMissionFixture(seed * 100 + index)
  await executeIdempotentMissionCommand(pool, fixture.create.command, async (client, command) =>
    commitMissionTransition(client, command, fixture.create)
  )
  const contract = await pool.query<{ schema_sha256: string }>(
    `SELECT trim(schema_sha256) AS schema_sha256
     FROM control_plane.contract_schemas
     WHERE schema_name = 'mission-record.v1'`
  )
  const mode = options.definitionMode ?? 'active'
  const definition = ProcessObligationDefinitionV1Schema.parse({
    schemaVersion: 1,
    kind: 'process-obligation-definition',
    id: 'obligation_definition_completeness_v1',
    tenantId: fixture.tenantId,
    createdAt: fixture.createdAt,
    definitionKey: `exp-13-case-${index}`,
    version: 1,
    predecessorDefinitionId: null,
    scopeKinds: ['mission'],
    trigger: {
      eventKind: options.triggerEventKind ?? 'mission-state-changed',
      applicabilityPolicyVersion: 'exp-13-v1',
      applicabilityPolicyDigest: sha256Text(`exp-13-applicability-${index}`)
    },
    timing: { deadlineOffsetMs: 60_000, graceMs: 60_000, clock: 'database' },
    proof: {
      recordKinds: ['mission'],
      schemas: [{ name: 'mission-record.v1', version: 1, digest: contract.rows[0]!.schema_sha256 }],
      minimumCount: 1,
      authority: 'product',
      maxAgeMs: null
    },
    severity: 'blocking',
    breachAction: options.breachAction ?? 'block',
    waiver: {
      allowed: true,
      authorizedActorKinds: ['system'],
      evidenceRequired: true,
      maximumDurationMs: 60_000
    },
    supersession: 'cancel',
    activatedAt: mode === 'future' ? '2099-01-01T00:00:00.000Z' : fixture.createdAt,
    revokedAt: mode === 'revoked' ? '2026-01-02T00:00:00.000Z' : null
  })
  const registered = await registerProcessObligationDefinition(pool, definition)
  return {
    index,
    fixture,
    obligationId: `obligation_exp13_${seed}_${index}`,
    definition: registered.definition,
    definitionDigest: registered.digest
  }
}

function obligationInstantiation(
  testCase: ProcessCompletenessCase
): ProcessObligationInstantiation {
  return {
    obligationId: testCase.obligationId,
    definitionId: testCase.definition.id,
    scope: {
      kind: 'mission',
      id: testCase.fixture.missionId,
      subjectVersion: '2'
    },
    currentFence: 1
  }
}

export async function triggerProcessCompletenessCase(
  pool: Pool,
  testCase: ProcessCompletenessCase,
  options: { omitObligation?: boolean; plainTransition?: boolean } = {}
) {
  return executeIdempotentMissionCommand(
    pool,
    testCase.fixture.complete.command,
    async (client, command) => {
      if (options.plainTransition) {
        return commitMissionTransition(client, command, testCase.fixture.complete)
      }
      return commitMissionTransitionWithObligations(client, command, {
        ...testCase.fixture.complete,
        obligations: options.omitObligation ? [] : [obligationInstantiation(testCase)]
      })
    }
  )
}

export async function expireProcessCompletenessCase(
  pool: Pool,
  testCase: ProcessCompletenessCase
): Promise<void> {
  await withPostgresTransaction(pool, async (client) => {
    const clock = await client.query<{ now: Date }>('SELECT transaction_timestamp() AS now')
    const result = await client.query<{ obligation: unknown }>(
      `SELECT obligation FROM control_plane.process_obligations
       WHERE tenant_id = $1 AND obligation_id = $2 FOR UPDATE`,
      [testCase.fixture.tenantId, testCase.obligationId]
    )
    const current = ProcessObligationV1Schema.parse(result.rows[0]!.obligation)
    const now = clock.rows[0]!.now.getTime()
    const expired = ProcessObligationV1Schema.parse({
      ...current,
      openedAt: new Date(now - 3_000).toISOString(),
      dueAt: new Date(now - 2_000).toISOString(),
      graceUntil: new Date(now - 1_000).toISOString()
    })
    const payload = canonicalJson(expired)
    const digest = sha256Text(payload)
    await client.query(
      `UPDATE control_plane.process_obligations
       SET opened_at = $3, due_at = $4, grace_until = $5,
           obligation = $6::jsonb, obligation_sha256 = $7,
           updated_at = transaction_timestamp()
       WHERE tenant_id = $1 AND obligation_id = $2`,
      [
        testCase.fixture.tenantId,
        testCase.obligationId,
        expired.openedAt,
        expired.dueAt,
        expired.graceUntil,
        payload,
        digest
      ]
    )
    await client.query(
      `UPDATE control_plane.domain_records
       SET payload = $3::jsonb, payload_sha256 = $4,
           updated_at = transaction_timestamp()
       WHERE tenant_id = $1 AND record_id = $2
         AND schema_name = 'process-obligation.v1'`,
      [testCase.fixture.tenantId, testCase.obligationId, payload, digest]
    )
  })
}

export async function insertWrongMissionProof(
  pool: Pool,
  testCase: ProcessCompletenessCase
): Promise<string> {
  const record = MissionRecordV1Schema.parse({
    ...testCase.fixture.complete.mission,
    id: `mission_wrong_${testCase.index}`,
    missionId: `mission_wrong_${testCase.index}`
  })
  await withPostgresTransaction(pool, async (client) =>
    insertPostgresDomainRecords(client, [
      {
        tenantId: record.tenantId,
        recordId: record.id,
        missionId: record.missionId,
        schemaName: 'mission-record.v1',
        recordKind: 'mission',
        recordState: record.state.status,
        payload: record,
        createdAt: record.createdAt
      }
    ])
  )
  return record.id
}

export async function insertProcessCompletenessEvidence(
  pool: Pool,
  testCase: ProcessCompletenessCase
): Promise<string> {
  const evidence = EvidenceItemV1Schema.parse({
    schemaVersion: 1,
    kind: 'evidence-item',
    id: `evidence_exp13_${testCase.index}`,
    tenantId: testCase.fixture.tenantId,
    missionId: testCase.fixture.missionId,
    createdAt: testCase.fixture.completedAt,
    version: 1,
    sourceRole: 'operator-statement',
    sourceName: 'EXP-13 qualification',
    sourceVersion: '1',
    content: {
      uri: `memory://exp-13/${testCase.index}`,
      sha256: sha256Text(`exp-13-evidence-${testCase.index}`),
      mediaType: 'text/plain',
      bytes: 1,
      span: { kind: 'whole' }
    },
    scope: { environment: 'lab', system: 'process-completeness' },
    dataClass: 'synthetic',
    observedAt: testCase.fixture.completedAt,
    effectiveFrom: null,
    effectiveUntil: null,
    supersedesEvidenceId: null,
    limitations: []
  })
  await withPostgresTransaction(pool, async (client) =>
    insertPostgresDomainRecords(client, [
      {
        tenantId: evidence.tenantId,
        recordId: evidence.id,
        missionId: evidence.missionId,
        schemaName: 'evidence-item.v1',
        recordKind: 'evidence-item',
        recordState: 'admitted',
        payload: evidence,
        createdAt: evidence.createdAt
      }
    ])
  )
  return evidence.id
}
