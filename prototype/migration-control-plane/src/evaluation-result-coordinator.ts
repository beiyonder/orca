import { canonicalJson } from './canonical-json.js'
import { ActorSchema, IsoDateTimeSchema } from './domain/common-contracts.js'
import { EvaluationAssignmentV2Schema } from './domain/evaluation-assignment-contracts-v2.js'
import {
  EvaluationCoordinationV1Schema,
  evaluationCoordinationOutcome,
  evaluationCoordinationUnresolvedReasons,
  type EvaluationCoordinationV1
} from './domain/evaluation-coordination-contracts.js'
import { EvaluationContractV2Schema } from './domain/evaluation-contracts-v2.js'
import { EvaluationResultV2Schema } from './domain/evaluation-result-contracts-v2.js'
import { stableEvaluationCoordinatorId } from './evaluation-coordinator-identities.js'
import {
  EvaluationCoordinationRegistry,
  evaluationCoordinationFailure
} from './evaluation-coordination-registry.js'
import { reconstructEvaluationContractRegistry } from './evaluation-contract-reconstruction.js'
import { evaluationRecordDigest } from './evaluation-contract-registry.js'

export function reconcileEvaluationCoordination(input: {
  snapshots: readonly unknown[]
  definitions: readonly unknown[]
  contract: unknown
  assignments: readonly unknown[]
  results: readonly unknown[]
  observedAt: string
  observedBy: unknown
}): EvaluationCoordinationV1 {
  const observedAt = IsoDateTimeSchema.parse(input.observedAt)
  const observedBy = ActorSchema.parse(input.observedBy)
  if (observedBy.kind !== 'system') {
    throw evaluationCoordinationFailure('invalid_reconciler', 'Only product system may reconcile')
  }
  if (input.snapshots.length === 0) {
    throw evaluationCoordinationFailure(
      'coordination_not_found',
      'Coordination snapshot is unavailable'
    )
  }
  const coordinationRegistry = EvaluationCoordinationRegistry.reconstruct(input.snapshots)
  const first = EvaluationCoordinationV1Schema.parse(input.snapshots[0])
  const latest = coordinationRegistry.latest(first)
  if (!latest) {
    throw evaluationCoordinationFailure(
      'coordination_not_found',
      'Coordination snapshot is unavailable'
    )
  }
  const contract = EvaluationContractV2Schema.parse(input.contract)
  if (
    latest.contract.id !== contract.id ||
    latest.contract.version !== contract.version ||
    latest.contract.digest !== evaluationRecordDigest(contract)
  ) {
    throw evaluationCoordinationFailure('contract_mismatch', 'Coordination contract differs')
  }
  reconstructEvaluationContractRegistry({
    definitions: input.definitions,
    contracts: [contract],
    assignments: input.assignments,
    results: input.results
  })
  const assignments = input.assignments.map((assignment) =>
    EvaluationAssignmentV2Schema.parse(assignment)
  )
  const results = input.results.map((result) => EvaluationResultV2Schema.parse(result))
  const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]))
  const resultByAssignment = new Map(results.map((result) => [result.assignment.id, result]))
  const coordinatedAssignments = new Set(latest.entries.map((entry) => entry.assignmentId))
  if (
    assignments.length !== latest.entries.length ||
    results.some((result) => !coordinatedAssignments.has(result.assignment.id)) ||
    results.some((result) => Date.parse(result.completedAt) > Date.parse(observedAt))
  ) {
    throw evaluationCoordinationFailure(
      'record_set_mismatch',
      'Coordination record set is incomplete'
    )
  }
  const afterDeadline = Date.parse(observedAt) >= Date.parse(latest.resultDeadlineAt)
  const entries = latest.entries.map((entry) => {
    const assignment = assignmentById.get(entry.assignmentId)
    if (!assignment || evaluationRecordDigest(assignment) !== entry.assignmentDigest) {
      throw evaluationCoordinationFailure('assignment_mismatch', 'Coordination assignment differs')
    }
    const result = resultByAssignment.get(entry.assignmentId)
    if (!result) {
      return {
        ...entry,
        disposition: afterDeadline ? ('missing' as const) : ('assigned' as const),
        result: null,
        reason: afterDeadline ? 'Required evaluator result missing at deadline.' : null
      }
    }
    return {
      ...entry,
      disposition: result.status,
      result: { id: result.id, status: result.status, digest: evaluationRecordDigest(result) },
      reason: result.status === 'passed' ? null : `Evaluator result is ${result.status}.`
    }
  })
  if (canonicalJson(entries) === canonicalJson(latest.entries)) {
    return latest
  }
  const outcome = evaluationCoordinationOutcome(entries)
  const version = latest.version + 1
  const next = EvaluationCoordinationV1Schema.parse({
    ...latest,
    id: stableEvaluationCoordinatorId('evaluation_coordination', {
      tenantId: latest.tenantId,
      missionId: latest.missionId,
      coordinationKey: latest.coordinationKey,
      version
    }),
    createdAt: observedAt,
    version,
    predecessor: { id: latest.id, version: latest.version, digest: evaluationRecordDigest(latest) },
    entries,
    outcome,
    unresolvedReasons: evaluationCoordinationUnresolvedReasons(entries),
    acceptanceDisposition:
      outcome === 'ready-for-reconciliation' ? 'eligible-for-reconciliation' : 'unaccepted',
    observedAt,
    createdBy: observedBy
  })
  return coordinationRegistry.record(next)
}
