import type { PoolClient } from 'pg'
import { MissingTaskEvaluationError } from '../attempt-authority.js'
import {
  AssignmentResultV1Schema,
  type AssignmentAttemptV1,
  type TaskRecordV1
} from '../domain/assignment-contracts.js'
import { EvaluationAssignmentV2Schema } from '../domain/evaluation-assignment-contracts-v2.js'
import { EvaluationContractV2Schema } from '../domain/evaluation-contracts-v2.js'
import { EvidenceItemV1Schema } from '../domain/epistemic-contracts.js'
import { EvaluationResultV2Schema } from '../domain/evaluation-result-contracts-v2.js'
import { reconstructEvaluationContractRegistry } from '../evaluation-contract-reconstruction.js'

export async function assertPostgresTaskEvaluationGate(
  client: PoolClient,
  task: TaskRecordV1,
  attempt: AssignmentAttemptV1,
  evaluationResultIds: readonly string[] | undefined,
  observedAt: string
): Promise<void> {
  if (task.state.status !== 'completed' || !task.recoveryPolicy.requiresEvaluation) {
    return
  }
  const requiredContracts = new Set(task.requiredEvaluationContractIds)
  const resultIds = [...new Set(evaluationResultIds ?? [])]
  if (requiredContracts.size === 0 || resultIds.length === 0) {
    throw new MissingTaskEvaluationError(task.id)
  }
  const rows = await client.query<{
    result: unknown
    assignment: unknown
    subject: unknown
    contract: unknown
    definition: unknown
  }>(
    `SELECT result.payload AS result,
            assignment.payload AS assignment,
            subject.payload AS subject,
            contract.payload AS contract,
            definition.payload AS definition
     FROM control_plane.domain_records AS result
     JOIN control_plane.domain_records AS assignment
       ON assignment.tenant_id = result.tenant_id
       AND assignment.record_id = result.payload #>> '{assignment,id}'
       AND assignment.schema_name = 'evaluation-assignment.v2'
     JOIN control_plane.domain_records AS subject
       ON subject.tenant_id = assignment.tenant_id
       AND subject.record_id = assignment.payload #>> '{subject,id}'
       AND subject.schema_name = 'assignment-result.v1'
     JOIN control_plane.domain_records AS contract
       ON contract.tenant_id = result.tenant_id
       AND contract.record_id = result.payload #>> '{contract,id}'
       AND contract.schema_name = 'evaluation-contract.v2'
     JOIN control_plane.domain_records AS definition
       ON definition.tenant_id = result.tenant_id
       AND definition.record_id = result.payload #>> '{evaluatorDefinition,id}'
       AND definition.schema_name = 'evaluator-definition.v2'
     WHERE result.tenant_id = $1
       AND result.schema_name = 'evaluation-result.v2'
       AND result.record_id = ANY($2::text[])`,
    [task.tenantId, resultIds]
  )
  if (rows.rows.length !== resultIds.length) {
    throw new MissingTaskEvaluationError(task.id)
  }
  const passedContracts = new Set<string>()
  const acceptedResultIds = new Set<string>(task.state.acceptedAssignmentResultIds)
  const evidenceReferences = new Map<string, { version: number; digest: string }>()
  for (const row of rows.rows) {
    let result: ReturnType<typeof EvaluationResultV2Schema.parse>
    let assignment: ReturnType<typeof EvaluationAssignmentV2Schema.parse>
    let subject: ReturnType<typeof AssignmentResultV1Schema.parse>
    let contract: ReturnType<typeof EvaluationContractV2Schema.parse>
    try {
      result = EvaluationResultV2Schema.parse(row.result)
      assignment = EvaluationAssignmentV2Schema.parse(row.assignment)
      subject = AssignmentResultV1Schema.parse(row.subject)
      contract = EvaluationContractV2Schema.parse(row.contract)
      reconstructEvaluationContractRegistry({
        definitions: [row.definition],
        contracts: [contract],
        assignments: [assignment],
        results: [result]
      })
    } catch {
      throw new MissingTaskEvaluationError(task.id)
    }
    if (
      result.status !== 'passed' ||
      assignment.producer.assignmentId !== attempt.assignmentId ||
      assignment.producer.attemptId !== attempt.id ||
      assignment.producer.fence !== attempt.fence ||
      result.subject.id !== subject.id ||
      assignment.subject.id !== subject.id ||
      assignment.subject.digest !== subject.outputDigest ||
      subject.attemptId !== attempt.id ||
      subject.fence !== attempt.fence ||
      subject.outcome.status !== 'succeeded' ||
      !acceptedResultIds.has(subject.id) ||
      Date.parse(observedAt) < Date.parse(result.completedAt) ||
      Date.parse(observedAt) - Date.parse(result.completedAt) > contract.maxAgeMs
    ) {
      throw new MissingTaskEvaluationError(task.id)
    }
    for (const reference of [
      ...assignment.inputs.flatMap((inputReference) => inputReference.evidence),
      ...result.evidence
    ]) {
      const existing = evidenceReferences.get(reference.id)
      if (
        existing &&
        (existing.version !== reference.version || existing.digest !== reference.digest)
      ) {
        throw new MissingTaskEvaluationError(task.id)
      }
      evidenceReferences.set(reference.id, {
        version: reference.version,
        digest: reference.digest
      })
    }
    passedContracts.add(result.contract.id)
  }
  const evidenceRows = await client.query<{
    record_id: string
    payload: unknown
    payload_sha256: string
  }>(
    `SELECT record_id, payload, payload_sha256
     FROM control_plane.domain_records
     WHERE tenant_id = $1
       AND schema_name = 'evidence-item.v1'
       AND record_id = ANY($2::text[])`,
    [task.tenantId, [...evidenceReferences.keys()]]
  )
  if (evidenceRows.rows.length !== evidenceReferences.size) {
    throw new MissingTaskEvaluationError(task.id)
  }
  for (const row of evidenceRows.rows) {
    const evidence = EvidenceItemV1Schema.parse(row.payload)
    const reference = evidenceReferences.get(row.record_id)
    if (
      !reference ||
      evidence.version !== reference.version ||
      row.payload_sha256 !== reference.digest
    ) {
      throw new MissingTaskEvaluationError(task.id)
    }
  }
  for (const contractId of requiredContracts) {
    if (!passedContracts.has(contractId)) {
      throw new MissingTaskEvaluationError(task.id)
    }
  }
}
