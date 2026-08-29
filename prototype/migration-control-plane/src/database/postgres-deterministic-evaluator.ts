import type { Pool, PoolClient } from 'pg'
import { canonicalJson } from '../canonical-json.js'
import {
  evaluateDeterministicAssignment,
  type DeterministicEvaluationOutput
} from '../deterministic-contract-evaluator.js'
import { DeterministicEvaluatorSuiteRegistry } from '../deterministic-evaluator-registry.js'
import { IsoDateTimeSchema } from '../domain/common-contracts.js'
import { DeterministicEvaluatorSuiteV1Schema } from '../domain/deterministic-evaluator-contracts.js'
import { EvaluationAssignmentV2Schema } from '../domain/evaluation-assignment-contracts-v2.js'
import { EvaluationContractV2Schema } from '../domain/evaluation-contracts-v2.js'
import { EvaluatorDefinitionV2Schema } from '../domain/evaluation-definition-contracts-v2.js'
import { EvidenceItemV1Schema } from '../domain/epistemic-contracts.js'
import { reconstructEvaluationContractRegistry } from '../evaluation-contract-reconstruction.js'
import { evaluationRecordDigest } from '../evaluation-contract-registry.js'
import { evaluationRegistryFailure } from '../evaluation-contract-registry-errors.js'
import { loadPostgresDeterministicResultReplay } from './postgres-deterministic-result-replay.js'
import { insertPostgresDomainRecords } from './postgres-domain-record-store.js'
import {
  MessageIdentityMismatchError,
  MessageIntegrityError,
  StaleDeliveryClaimError,
  type OutboxClaim
} from './postgres-message-delivery.js'
import { withPostgresTransaction } from './postgres-transaction.js'

type AuthorityBundle = {
  assignment: ReturnType<typeof EvaluationAssignmentV2Schema.parse>
  contract: ReturnType<typeof EvaluationContractV2Schema.parse>
  definition: ReturnType<typeof EvaluatorDefinitionV2Schema.parse>
  suite: ReturnType<typeof DeterministicEvaluatorSuiteV1Schema.parse>
  subject: unknown
  inputEvidence: unknown[]
}

type OutboxRow = {
  mission_id: string
  topic: string
  message_key: string
  payload: unknown
  payload_sha256: string
  attempt_count: number
  lease_owner: string | null
  lease_expires_at: Date | null
  fence: string
  delivered_at: Date | null
}

async function lockAndLoadClaim(
  client: PoolClient,
  claim: OutboxClaim,
  observedAt: string
): Promise<ReturnType<typeof EvaluationAssignmentV2Schema.parse>> {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
    `deterministic-evaluation:${claim.tenantId}:${claim.key}`
  ])
  const outbox = await client.query<OutboxRow>(
    `SELECT mission_id, topic, message_key, payload,
            trim(payload_sha256) AS payload_sha256, attempt_count,
            lease_owner, lease_expires_at, fence::text AS fence, delivered_at
     FROM control_plane.outbox_messages
     WHERE tenant_id = $1 AND message_id = $2
     FOR UPDATE`,
    [claim.tenantId, claim.messageId]
  )
  const row = outbox.rows[0]
  if (
    !row ||
    row.mission_id !== claim.missionId ||
    row.topic !== 'evaluation.assignment.v2' ||
    row.topic !== claim.topic ||
    row.message_key !== claim.key
  ) {
    throw new MessageIdentityMismatchError(claim.messageId)
  }
  if (
    row.payload_sha256 !== evaluationRecordDigest(row.payload) ||
    canonicalJson(row.payload) !== canonicalJson(claim.payload)
  ) {
    throw new MessageIntegrityError(claim.messageId)
  }
  if (
    row.delivered_at !== null ||
    row.lease_owner !== claim.leaseOwner ||
    Number(row.fence) !== claim.fence ||
    row.attempt_count !== claim.attemptCount ||
    row.lease_expires_at === null ||
    row.lease_expires_at.toISOString() !== claim.leaseExpiresAt ||
    Date.parse(observedAt) >= row.lease_expires_at.getTime()
  ) {
    throw new StaleDeliveryClaimError(claim.messageId)
  }
  const assignment = EvaluationAssignmentV2Schema.parse(row.payload)
  const stored = await client.query<{ payload: unknown; payload_sha256: string }>(
    `SELECT payload, trim(payload_sha256) AS payload_sha256
     FROM control_plane.domain_records
     WHERE tenant_id = $1 AND record_id = $2 AND schema_name = 'evaluation-assignment.v2'`,
    [claim.tenantId, assignment.id]
  )
  if (
    !stored.rows[0] ||
    stored.rows[0].payload_sha256 !== evaluationRecordDigest(assignment) ||
    canonicalJson(stored.rows[0].payload) !== canonicalJson(assignment)
  ) {
    throw evaluationRegistryFailure(
      'assignment_not_persisted',
      'Claimed deterministic assignment is not the authoritative stored assignment'
    )
  }
  return assignment
}

async function loadAuthority(
  client: PoolClient,
  assignment: AuthorityBundle['assignment'],
  suiteId: string
): Promise<AuthorityBundle> {
  const evidenceIds = [
    ...new Set(
      assignment.inputs.flatMap((assignmentInput) =>
        assignmentInput.evidence.map((reference) => reference.id)
      )
    )
  ]
  const records = await client.query<{
    record_id: string
    schema_name: string
    payload: unknown
    payload_sha256: string
  }>(
    `SELECT record_id, schema_name, payload, trim(payload_sha256) AS payload_sha256
     FROM control_plane.domain_records
     WHERE tenant_id = $1
       AND (
         record_id = ANY($2::text[])
         OR record_id = ANY($3::text[])
       )`,
    [
      assignment.tenantId,
      [assignment.contract.id, assignment.evaluatorDefinition.id, assignment.subject.id, suiteId],
      evidenceIds
    ]
  )
  const byId = new Map(records.rows.map((row) => [row.record_id, row]))
  const parsed = <T>(id: string, schemaName: string, parse: (value: unknown) => T): T => {
    const row = byId.get(id)
    if (
      !row ||
      row.schema_name !== schemaName ||
      row.payload_sha256 !== evaluationRecordDigest(row.payload)
    ) {
      throw evaluationRegistryFailure(
        'deterministic_authority_missing',
        `Deterministic evaluator authority is missing: ${schemaName}/${id}`
      )
    }
    return parse(row.payload)
  }
  const contract = parsed(
    assignment.contract.id,
    'evaluation-contract.v2',
    EvaluationContractV2Schema.parse
  )
  const definition = parsed(
    assignment.evaluatorDefinition.id,
    'evaluator-definition.v2',
    EvaluatorDefinitionV2Schema.parse
  )
  const suite = parsed(
    suiteId,
    'deterministic-evaluator-suite.v1',
    DeterministicEvaluatorSuiteV1Schema.parse
  )
  const subject = parsed(assignment.subject.id, assignment.subject.schema.name, (value) => value)
  const inputEvidence = evidenceIds.map((id) =>
    parsed(id, 'evidence-item.v1', EvidenceItemV1Schema.parse)
  )
  reconstructEvaluationContractRegistry({
    definitions: [definition],
    contracts: [contract],
    assignments: [assignment],
    results: []
  })
  DeterministicEvaluatorSuiteRegistry.reconstruct({ definitions: [definition], suites: [suite] })
  return { assignment, contract, definition, suite, subject, inputEvidence }
}

export async function executePostgresDeterministicAssignment(
  pool: Pool,
  input: {
    claim: OutboxClaim
    suiteId: string
    dataClass: unknown
    observedAt: string
  }
): Promise<DeterministicEvaluationOutput & { disposition: 'inserted' | 'replayed' }> {
  const observedAt = IsoDateTimeSchema.parse(input.observedAt)
  return withPostgresTransaction(pool, async (client) => {
    const assignment = await lockAndLoadClaim(client, input.claim, observedAt)
    const authority = await loadAuthority(client, assignment, input.suiteId)
    const existing = await loadPostgresDeterministicResultReplay(client, authority)
    if (existing) {
      return { ...existing, disposition: 'replayed' as const }
    }
    const output = evaluateDeterministicAssignment({
      assignment: authority.assignment,
      contract: authority.contract,
      evaluatorDefinition: authority.definition,
      suite: authority.suite,
      subject: authority.subject,
      inputEvidence: authority.inputEvidence,
      dataClass: input.dataClass,
      observedAt
    })
    await insertPostgresDomainRecords(client, [
      {
        tenantId: output.report.tenantId,
        recordId: output.report.id,
        missionId: output.report.missionId,
        schemaName: 'evaluation-deterministic-report.v1',
        recordKind: output.report.kind,
        recordState: output.report.status,
        payload: output.report,
        createdAt: output.report.createdAt
      },
      {
        tenantId: output.evidence.tenantId,
        recordId: output.evidence.id,
        missionId: output.evidence.missionId,
        schemaName: 'evidence-item.v1',
        recordKind: output.evidence.kind,
        recordState: 'current',
        payload: output.evidence,
        createdAt: output.evidence.createdAt
      },
      {
        tenantId: output.result.tenantId,
        recordId: output.result.id,
        missionId: output.result.missionId,
        schemaName: 'evaluation-result.v2',
        recordKind: output.result.kind,
        recordState: output.result.status,
        payload: output.result,
        createdAt: output.result.createdAt
      }
    ])
    return { ...output, disposition: 'inserted' as const }
  })
}
