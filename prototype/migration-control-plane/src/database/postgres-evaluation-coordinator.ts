import type { Pool, PoolClient } from 'pg'
import { canonicalJson } from '../canonical-json.js'
import {
  EvaluationCoordinationV1Schema,
  type EvaluationCoordinationV1
} from '../domain/evaluation-coordination-contracts.js'
import { evaluationCoordinationFailure } from '../evaluation-coordination-registry.js'
import {
  coordinateEvaluationDispatch,
  type EvaluationDispatchPlan
} from '../evaluation-dispatch-coordinator.js'
import { evaluationRecordDigest } from '../evaluation-contract-registry.js'
import { reconcileEvaluationCoordination } from '../evaluation-result-coordinator.js'
import { insertPostgresDomainRecords } from './postgres-domain-record-store.js'
import { withPostgresTransaction } from './postgres-transaction.js'

async function lockCoordination(
  client: PoolClient,
  input: { tenantId: string; missionId: string; coordinationKey: string }
): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
    `evaluation:${input.tenantId}:${input.missionId}:${input.coordinationKey}`
  ])
}

async function assertStoredAuthority(
  client: PoolClient,
  plan: EvaluationDispatchPlan
): Promise<void> {
  const references = [
    { ...plan.coordination.contract, schemaName: 'evaluation-contract.v2' },
    ...plan.coordination.entries.map((entry) => ({
      ...entry.evaluatorDefinition,
      schemaName: 'evaluator-definition.v2'
    }))
  ]
  const rows = await client.query<{
    record_id: string
    schema_name: string
    payload_sha256: string
  }>(
    `SELECT record_id, schema_name, trim(payload_sha256) AS payload_sha256
     FROM control_plane.domain_records
     WHERE tenant_id = $1 AND record_id = ANY($2::text[])`,
    [plan.coordination.tenantId, references.map((reference) => reference.id)]
  )
  const stored = new Map(rows.rows.map((row) => [row.record_id, row]))
  if (
    references.some((reference) => {
      const row = stored.get(reference.id)
      return (
        !row || row.schema_name !== reference.schemaName || row.payload_sha256 !== reference.digest
      )
    })
  ) {
    throw evaluationCoordinationFailure(
      'authority_not_persisted',
      'Evaluation contract or evaluator definition is not durably authoritative'
    )
  }
}

async function assertStoredDispatch(
  client: PoolClient,
  plan: EvaluationDispatchPlan
): Promise<void> {
  const records = [plan.coordination, ...plan.assignments]
  const storedRecords = await client.query<{
    record_id: string
    payload_sha256: string
  }>(
    `SELECT record_id, trim(payload_sha256) AS payload_sha256
     FROM control_plane.domain_records
     WHERE tenant_id = $1 AND record_id = ANY($2::text[])`,
    [plan.coordination.tenantId, records.map((record) => record.id)]
  )
  const recordDigests = new Map(
    storedRecords.rows.map((row) => [row.record_id, row.payload_sha256])
  )
  const storedMessages = await client.query<{
    message_id: string
    topic: string
    message_key: string
    payload_sha256: string
  }>(
    `SELECT message_id, topic, message_key, trim(payload_sha256) AS payload_sha256
     FROM control_plane.outbox_messages
     WHERE tenant_id = $1 AND message_id = ANY($2::text[])`,
    [plan.coordination.tenantId, plan.messages.map((message) => message.messageId)]
  )
  const messages = new Map(storedMessages.rows.map((row) => [row.message_id, row]))
  if (
    records.some((record) => recordDigests.get(record.id) !== evaluationRecordDigest(record)) ||
    plan.messages.some((message) => {
      const stored = messages.get(message.messageId)
      return (
        !stored ||
        stored.topic !== message.topic ||
        stored.message_key !== message.messageKey ||
        stored.payload_sha256 !== evaluationRecordDigest(message.payload)
      )
    })
  ) {
    throw evaluationCoordinationFailure(
      'dispatch_integrity_mismatch',
      'Persisted evaluation dispatch differs from the deterministic plan'
    )
  }
}

async function insertDispatch(client: PoolClient, plan: EvaluationDispatchPlan): Promise<void> {
  await insertPostgresDomainRecords(client, [
    ...plan.assignments.map((assignment) => ({
      tenantId: assignment.tenantId,
      recordId: assignment.id,
      missionId: assignment.missionId,
      schemaName: 'evaluation-assignment.v2',
      recordKind: assignment.kind,
      recordState: 'assigned',
      payload: assignment,
      createdAt: assignment.createdAt
    })),
    {
      tenantId: plan.coordination.tenantId,
      recordId: plan.coordination.id,
      missionId: plan.coordination.missionId,
      schemaName: 'evaluation-coordination.v1',
      recordKind: plan.coordination.kind,
      recordState: plan.coordination.outcome,
      payload: plan.coordination,
      createdAt: plan.coordination.createdAt
    }
  ])
  const rows = plan.messages.map((message) => ({
    tenant_id: plan.coordination.tenantId,
    message_id: message.messageId,
    mission_id: plan.coordination.missionId,
    topic: message.topic,
    message_key: message.messageKey,
    payload: message.payload,
    payload_sha256: evaluationRecordDigest(message.payload),
    available_at: plan.coordination.createdAt,
    created_at: plan.coordination.createdAt
  }))
  await client.query(
    `INSERT INTO control_plane.outbox_messages (
       tenant_id, message_id, mission_id, event_id, topic, message_key,
       payload, payload_sha256, available_at, created_at
     )
     SELECT tenant_id, message_id, mission_id, NULL, topic, message_key,
            payload, payload_sha256, available_at, created_at
     FROM jsonb_to_recordset($1::jsonb) AS message(
       tenant_id text,
       message_id text,
       mission_id text,
       topic text,
       message_key text,
       payload jsonb,
       payload_sha256 text,
       available_at timestamptz,
       created_at timestamptz
     )`,
    [canonicalJson(rows)]
  )
}

export async function dispatchPostgresEvaluation(
  pool: Pool,
  input: unknown
): Promise<EvaluationDispatchPlan & { disposition: 'inserted' | 'replayed' }> {
  const plan = coordinateEvaluationDispatch(input)
  return withPostgresTransaction(pool, async (client) => {
    await lockCoordination(client, plan.coordination)
    await assertStoredAuthority(client, plan)
    const existing = await client.query<{ payload: unknown }>(
      `SELECT payload
       FROM control_plane.domain_records
       WHERE tenant_id = $1 AND record_id = $2 AND schema_name = 'evaluation-coordination.v1'`,
      [plan.coordination.tenantId, plan.coordination.id]
    )
    if (existing.rows[0]) {
      const coordination = EvaluationCoordinationV1Schema.parse(existing.rows[0].payload)
      if (canonicalJson(coordination) !== canonicalJson(plan.coordination)) {
        throw evaluationCoordinationFailure(
          'immutable_conflict',
          'Stored evaluation coordination differs from replay'
        )
      }
      await assertStoredDispatch(client, plan)
      return { ...plan, coordination, disposition: 'replayed' as const }
    }
    await insertDispatch(client, plan)
    return { ...plan, disposition: 'inserted' as const }
  })
}

export async function reconcilePostgresEvaluation(
  pool: Pool,
  input: {
    tenantId: string
    missionId: string
    coordinationKey: string
    observedAt: string
    observedBy: unknown
  }
): Promise<{ coordination: EvaluationCoordinationV1; disposition: 'inserted' | 'replayed' }> {
  return withPostgresTransaction(pool, async (client) => {
    await lockCoordination(client, input)
    const snapshots = await client.query<{ payload: unknown }>(
      `SELECT payload
       FROM control_plane.domain_records
       WHERE tenant_id = $1
         AND mission_id = $2
         AND schema_name = 'evaluation-coordination.v1'
         AND payload ->> 'coordinationKey' = $3
       ORDER BY (payload ->> 'version')::integer`,
      [input.tenantId, input.missionId, input.coordinationKey]
    )
    if (snapshots.rows.length === 0) {
      throw evaluationCoordinationFailure('coordination_not_found', 'Coordination is unavailable')
    }
    const latest = EvaluationCoordinationV1Schema.parse(snapshots.rows.at(-1)!.payload)
    const assignmentIds = latest.entries.map((entry) => entry.assignmentId)
    const definitionIds = latest.entries.map((entry) => entry.evaluatorDefinition.id)
    const records = await client.query<{ schema_name: string; payload: unknown }>(
      `SELECT schema_name, payload
       FROM control_plane.domain_records
       WHERE tenant_id = $1
         AND (
           record_id = $2
           OR record_id = ANY($3::text[])
           OR record_id = ANY($4::text[])
           OR (schema_name = 'evaluation-result.v2' AND payload #>> '{assignment,id}' = ANY($3::text[]))
         )`,
      [input.tenantId, latest.contract.id, assignmentIds, definitionIds]
    )
    const bySchema = new Map<string, unknown[]>()
    for (const row of records.rows) {
      const payloads = bySchema.get(row.schema_name) ?? []
      payloads.push(row.payload)
      bySchema.set(row.schema_name, payloads)
    }
    const definitions = bySchema.get('evaluator-definition.v2') ?? []
    const contracts = bySchema.get('evaluation-contract.v2') ?? []
    const assignments = bySchema.get('evaluation-assignment.v2') ?? []
    const results = bySchema.get('evaluation-result.v2') ?? []
    if (
      definitions.length !== definitionIds.length ||
      contracts.length !== 1 ||
      assignments.length !== assignmentIds.length
    ) {
      throw evaluationCoordinationFailure(
        'record_set_mismatch',
        'Durable evaluation coordination authority is incomplete'
      )
    }
    const coordination = reconcileEvaluationCoordination({
      snapshots: snapshots.rows.map((row) => row.payload),
      definitions,
      contract: contracts[0],
      assignments,
      results,
      observedAt: input.observedAt,
      observedBy: input.observedBy
    })
    if (coordination.id === latest.id) {
      return { coordination, disposition: 'replayed' as const }
    }
    await insertPostgresDomainRecords(client, [
      {
        tenantId: coordination.tenantId,
        recordId: coordination.id,
        missionId: coordination.missionId,
        schemaName: 'evaluation-coordination.v1',
        recordKind: coordination.kind,
        recordState: coordination.outcome,
        payload: coordination,
        createdAt: coordination.createdAt
      }
    ])
    return { coordination, disposition: 'inserted' as const }
  })
}
