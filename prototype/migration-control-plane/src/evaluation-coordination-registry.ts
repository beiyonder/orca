import { canonicalJson } from './canonical-json.js'
import {
  EvaluationCoordinationV1Schema,
  type EvaluationCoordinationV1
} from './domain/evaluation-coordination-contracts.js'
import { evaluationRecordDigest } from './evaluation-contract-validation.js'

export class EvaluationCoordinationError extends Error {
  readonly code: string
  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'EvaluationCoordinationError'
    this.code = code
  }
}

export function evaluationCoordinationFailure(
  code: string,
  message: string,
  cause?: unknown
): EvaluationCoordinationError {
  return new EvaluationCoordinationError(code, message, cause === undefined ? undefined : { cause })
}

function immutableEntryIdentity(coordination: EvaluationCoordinationV1): unknown {
  return coordination.entries.map((entry) => ({
    evaluatorDefinition: entry.evaluatorDefinition,
    assignmentId: entry.assignmentId,
    assignmentDigest: entry.assignmentDigest,
    dispatchMessageId: entry.dispatchMessageId
  }))
}

export class EvaluationCoordinationRegistry {
  readonly #records = new Map<string, EvaluationCoordinationV1>()
  readonly #latestByKey = new Map<string, EvaluationCoordinationV1>()

  static reconstruct(records: readonly unknown[]): EvaluationCoordinationRegistry {
    const registry = new EvaluationCoordinationRegistry()
    const parsed = records
      .map((record) => EvaluationCoordinationV1Schema.parse(record))
      .toSorted(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) ||
          left.coordinationKey.localeCompare(right.coordinationKey) ||
          left.version - right.version
      )
    for (const record of parsed) {
      registry.record(record)
    }
    return registry
  }

  record(input: unknown): EvaluationCoordinationV1 {
    let coordination: EvaluationCoordinationV1
    try {
      coordination = EvaluationCoordinationV1Schema.parse(input)
    } catch (error) {
      throw evaluationCoordinationFailure(
        'invalid_coordination',
        'Evaluation coordination snapshot is invalid',
        error
      )
    }
    const existing = this.#records.get(coordination.id)
    if (existing) {
      if (canonicalJson(existing) !== canonicalJson(coordination)) {
        throw evaluationCoordinationFailure(
          'immutable_conflict',
          `Evaluation coordination differs for reused ID: ${coordination.id}`
        )
      }
      return structuredClone(existing)
    }
    const key = this.#key(coordination)
    const prior = this.#latestByKey.get(key)
    if (coordination.version === 1) {
      if (prior) {
        throw evaluationCoordinationFailure(
          'version_conflict',
          'First evaluation coordination version already exists'
        )
      }
    } else if (
      !prior ||
      coordination.version !== prior.version + 1 ||
      coordination.predecessor === null ||
      coordination.predecessor.id !== prior.id ||
      coordination.predecessor.version !== prior.version ||
      coordination.predecessor.digest !== evaluationRecordDigest(prior)
    ) {
      throw evaluationCoordinationFailure(
        'version_lineage_mismatch',
        'Evaluation coordination version lineage is invalid'
      )
    }
    if (
      prior &&
      (canonicalJson(coordination.contract) !== canonicalJson(prior.contract) ||
        canonicalJson(coordination.subject) !== canonicalJson(prior.subject) ||
        coordination.resultDeadlineAt !== prior.resultDeadlineAt ||
        canonicalJson(immutableEntryIdentity(coordination)) !==
          canonicalJson(immutableEntryIdentity(prior)) ||
        Date.parse(coordination.observedAt) < Date.parse(prior.observedAt))
    ) {
      throw evaluationCoordinationFailure(
        'coordination_identity_drift',
        'Evaluation coordination changed immutable identity or moved backward'
      )
    }
    if (prior) {
      const previousByAssignment = new Map(
        prior.entries.map((entry) => [entry.assignmentId, entry])
      )
      for (const entry of coordination.entries) {
        const previous = previousByAssignment.get(entry.assignmentId)!
        if (
          previous.result !== null &&
          canonicalJson(previous.result) !== canonicalJson(entry.result)
        ) {
          throw evaluationCoordinationFailure(
            'result_rewrite',
            'Evaluation coordination cannot replace an observed result'
          )
        }
      }
    }
    const stored = structuredClone(coordination)
    this.#records.set(coordination.id, stored)
    this.#latestByKey.set(key, stored)
    return structuredClone(stored)
  }

  latest(input: {
    tenantId: string
    missionId: string
    coordinationKey: string
  }): EvaluationCoordinationV1 | null {
    const record = this.#latestByKey.get(
      `${input.tenantId}\u0000${input.missionId}\u0000${input.coordinationKey}`
    )
    return record ? structuredClone(record) : null
  }

  #key(coordination: EvaluationCoordinationV1): string {
    return `${coordination.tenantId}\u0000${coordination.missionId}\u0000${coordination.coordinationKey}`
  }
}
