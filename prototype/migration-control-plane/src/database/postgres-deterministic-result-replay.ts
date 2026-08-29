import type { PoolClient } from 'pg'
import { canonicalJson } from '../canonical-json.js'
import type { DeterministicEvaluationOutput } from '../deterministic-contract-evaluator.js'
import { DeterministicEvaluationReportV1Schema } from '../domain/deterministic-evaluator-contracts.js'
import type { EvaluationAssignmentV2 } from '../domain/evaluation-assignment-contracts-v2.js'
import type { EvaluationContractV2 } from '../domain/evaluation-contracts-v2.js'
import type { EvaluatorDefinitionV2 } from '../domain/evaluation-definition-contracts-v2.js'
import { EvidenceItemV1Schema } from '../domain/epistemic-contracts.js'
import { EvaluationResultV2Schema } from '../domain/evaluation-result-contracts-v2.js'
import { reconstructEvaluationContractRegistry } from '../evaluation-contract-reconstruction.js'
import { evaluationRecordDigest } from '../evaluation-contract-registry.js'
import { evaluationRegistryFailure } from '../evaluation-contract-registry-errors.js'
import type { DeterministicEvaluatorSuiteV1 } from '../domain/deterministic-evaluator-contracts.js'

export async function loadPostgresDeterministicResultReplay(
  client: PoolClient,
  authority: {
    assignment: EvaluationAssignmentV2
    contract: EvaluationContractV2
    definition: EvaluatorDefinitionV2
    suite: DeterministicEvaluatorSuiteV1
  }
): Promise<DeterministicEvaluationOutput | null> {
  const storedResult = await client.query<{ payload: unknown }>(
    `SELECT payload
     FROM control_plane.domain_records
     WHERE tenant_id = $1
       AND schema_name = 'evaluation-result.v2'
       AND payload #>> '{assignment,id}' = $2`,
    [authority.assignment.tenantId, authority.assignment.id]
  )
  if (storedResult.rows.length === 0) {
    return null
  }
  if (storedResult.rows.length !== 1) {
    throw evaluationRegistryFailure(
      'duplicate_deterministic_result',
      'Deterministic assignment has more than one result'
    )
  }
  const result = EvaluationResultV2Schema.parse(storedResult.rows[0]!.payload)
  if (result.evidence.length !== 1) {
    throw evaluationRegistryFailure(
      'deterministic_result_evidence_mismatch',
      'Deterministic result must reference exactly one report evidence item'
    )
  }
  const evidenceReference = result.evidence[0]!
  const evidenceRow = await client.query<{ payload: unknown }>(
    `SELECT payload
     FROM control_plane.domain_records
     WHERE tenant_id = $1 AND record_id = $2 AND schema_name = 'evidence-item.v1'`,
    [result.tenantId, evidenceReference.id]
  )
  const evidence = EvidenceItemV1Schema.parse(evidenceRow.rows[0]?.payload)
  const reportId = evidence.content.uri.startsWith('domain://evaluation-report/')
    ? evidence.content.uri.slice('domain://evaluation-report/'.length)
    : ''
  const reportRow = await client.query<{ payload: unknown }>(
    `SELECT payload
     FROM control_plane.domain_records
     WHERE tenant_id = $1 AND record_id = $2
       AND schema_name = 'evaluation-deterministic-report.v1'`,
    [result.tenantId, reportId]
  )
  const report = DeterministicEvaluationReportV1Schema.parse(reportRow.rows[0]?.payload)
  if (
    evidenceReference.version !== evidence.version ||
    evidenceReference.digest !== evaluationRecordDigest(evidence) ||
    evidence.content.sha256 !== evaluationRecordDigest(report) ||
    evidence.content.bytes !== Buffer.byteLength(canonicalJson(report), 'utf8') ||
    report.assignmentId !== authority.assignment.id ||
    report.suite.id !== authority.suite.id ||
    report.status !== result.status
  ) {
    throw evaluationRegistryFailure(
      'deterministic_replay_mismatch',
      'Stored deterministic report, evidence, and result lineage differs'
    )
  }
  reconstructEvaluationContractRegistry({
    definitions: [authority.definition],
    contracts: [authority.contract],
    assignments: [authority.assignment],
    results: [result]
  })
  return { report, evidence, result }
}
