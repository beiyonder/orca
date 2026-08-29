import { canonicalJson, sha256Text } from './canonical-json.js'
import {
  SubjectAcceptanceV1Schema,
  type SubjectAcceptanceV1
} from './domain/acceptance-correction-contracts.js'
import type { EvaluationCoordinationV1 } from './domain/evaluation-coordination-contracts.js'
import { evaluationRecordDigest } from './evaluation-contract-registry.js'
import { evaluationRegistryFailure } from './evaluation-contract-registry-errors.js'

const ALLOWED_TRANSITIONS: Record<
  SubjectAcceptanceV1['status'],
  Set<SubjectAcceptanceV1['status']>
> = {
  unknown: new Set(['hypothesis']),
  hypothesis: new Set(['supported', 'rejected', 'quarantined']),
  supported: new Set(['accepted', 'rejected', 'quarantined']),
  accepted: new Set(['quarantined']),
  rejected: new Set(),
  quarantined: new Set(['hypothesis'])
}

export class SubjectAcceptanceRegistry {
  readonly #records = new Map<string, SubjectAcceptanceV1>()
  readonly #latestByKey = new Map<string, SubjectAcceptanceV1>()

  static reconstruct(records: readonly unknown[]): SubjectAcceptanceRegistry {
    const registry = new SubjectAcceptanceRegistry()
    const parsed = records
      .map((record) => SubjectAcceptanceV1Schema.parse(record))
      .toSorted(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) ||
          left.acceptanceKey.localeCompare(right.acceptanceKey) ||
          left.version - right.version
      )
    for (const record of parsed) {
      registry.record(record)
    }
    return registry
  }

  record(input: unknown): SubjectAcceptanceV1 {
    const acceptance = SubjectAcceptanceV1Schema.parse(input)
    const existing = this.#records.get(acceptance.id)
    if (existing) {
      if (canonicalJson(existing) !== canonicalJson(acceptance)) {
        throw evaluationRegistryFailure('immutable_conflict', 'Acceptance ID was reused')
      }
      return structuredClone(existing)
    }
    const key = `${acceptance.tenantId}\u0000${acceptance.missionId}\u0000${acceptance.acceptanceKey}`
    const prior = this.#latestByKey.get(key)
    if (acceptance.version === 1) {
      if (prior || acceptance.status !== 'unknown') {
        throw evaluationRegistryFailure('acceptance_initial_state', 'Acceptance must begin unknown')
      }
    } else if (
      !prior ||
      acceptance.version !== prior.version + 1 ||
      acceptance.predecessor === null ||
      acceptance.predecessor.id !== prior.id ||
      acceptance.predecessor.version !== prior.version ||
      acceptance.predecessor.digest !== evaluationRecordDigest(prior) ||
      !ALLOWED_TRANSITIONS[prior.status].has(acceptance.status)
    ) {
      throw evaluationRegistryFailure('acceptance_transition', 'Acceptance transition is invalid')
    }
    if (
      prior &&
      (canonicalJson(prior.subject) !== canonicalJson(acceptance.subject) ||
        canonicalJson(prior.contract) !== canonicalJson(acceptance.contract) ||
        Date.parse(acceptance.transitionedAt) < Date.parse(prior.transitionedAt))
    ) {
      throw evaluationRegistryFailure('acceptance_identity_drift', 'Acceptance identity changed')
    }
    const stored = structuredClone(acceptance)
    this.#records.set(stored.id, stored)
    this.#latestByKey.set(key, stored)
    return structuredClone(stored)
  }
}

function acceptanceId(key: string, version: number): string {
  return `subject_acceptance_${sha256Text(canonicalJson({ key, version })).slice(0, 32)}`
}

export function initializeSubjectAcceptance(input: {
  tenantId: string
  missionId: string
  acceptanceKey: string
  subject: SubjectAcceptanceV1['subject']
  contract: SubjectAcceptanceV1['contract']
  createdAt: string
}): SubjectAcceptanceV1 {
  return SubjectAcceptanceV1Schema.parse({
    schemaVersion: 1,
    kind: 'subject-acceptance',
    id: acceptanceId(input.acceptanceKey, 1),
    tenantId: input.tenantId,
    missionId: input.missionId,
    createdAt: input.createdAt,
    acceptanceKey: input.acceptanceKey,
    version: 1,
    predecessor: null,
    subject: input.subject,
    contract: input.contract,
    status: 'unknown',
    coordinationIds: [],
    evaluationResultIds: [],
    satisfiedPredicates: [],
    unsatisfiedPredicates: [],
    evidenceIds: [],
    reason: 'Subject has not entered evaluation.',
    transitionedAt: input.createdAt,
    transitionedBy: { kind: 'system', id: 'acceptance-reconciler', version: '1' },
    acceptanceAuthority: 'product-reconciler'
  })
}

export function advanceAcceptanceHypothesis(
  current: SubjectAcceptanceV1,
  transitionedAt: string
): SubjectAcceptanceV1 {
  return nextAcceptance(current, {
    status: 'hypothesis',
    coordinationIds: [],
    evaluationResultIds: [],
    satisfiedPredicates: [],
    unsatisfiedPredicates: [],
    evidenceIds: [],
    reason: 'Subject is proposed for independent evaluation.',
    transitionedAt
  })
}

export function reconcileSubjectAcceptance(input: {
  current: SubjectAcceptanceV1
  coordination: EvaluationCoordinationV1
  evidenceIds: SubjectAcceptanceV1['evidenceIds']
  transitionedAt: string
}): SubjectAcceptanceV1 {
  const { current, coordination } = input
  if (
    canonicalJson(current.subject) !== canonicalJson(coordination.subject) ||
    canonicalJson(current.contract) !== canonicalJson(coordination.contract)
  ) {
    throw evaluationRegistryFailure('acceptance_coordination_mismatch', 'Coordination differs')
  }
  const passed = coordination.entries.filter((entry) => entry.disposition === 'passed')
  const unsatisfied = coordination.entries.filter((entry) => entry.disposition !== 'passed')
  const status =
    coordination.outcome === 'ready-for-reconciliation'
      ? current.status === 'hypothesis'
        ? 'supported'
        : 'accepted'
      : coordination.outcome === 'failed'
        ? 'rejected'
        : coordination.outcome === 'unresolved'
          ? 'quarantined'
          : passed.length > 0
            ? 'supported'
            : current.status
  if (status === current.status) {
    return current
  }
  return nextAcceptance(current, {
    status,
    coordinationIds: [coordination.id],
    evaluationResultIds: coordination.entries.flatMap((entry) =>
      entry.result === null ? [] : [entry.result.id]
    ),
    satisfiedPredicates: passed.map((entry) => `evaluator:${entry.evaluatorDefinition.id}:passed`),
    unsatisfiedPredicates: unsatisfied.map(
      (entry) => `evaluator:${entry.evaluatorDefinition.id}:${entry.disposition}`
    ),
    evidenceIds: input.evidenceIds,
    reason: `Coordination outcome is ${coordination.outcome}.`,
    transitionedAt: input.transitionedAt
  })
}

function nextAcceptance(
  current: SubjectAcceptanceV1,
  change: Pick<
    SubjectAcceptanceV1,
    | 'status'
    | 'coordinationIds'
    | 'evaluationResultIds'
    | 'satisfiedPredicates'
    | 'unsatisfiedPredicates'
    | 'evidenceIds'
    | 'reason'
    | 'transitionedAt'
  >
): SubjectAcceptanceV1 {
  return SubjectAcceptanceV1Schema.parse({
    ...current,
    id: acceptanceId(current.acceptanceKey, current.version + 1),
    createdAt: change.transitionedAt,
    version: current.version + 1,
    predecessor: {
      id: current.id,
      version: current.version,
      digest: evaluationRecordDigest(current)
    },
    ...change
  })
}
