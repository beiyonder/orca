import { canonicalJson, sha256Text } from './canonical-json.js'
import {
  CorrectionCycleV1Schema,
  type CorrectionCycleV1,
  type EvaluationDiagnosisV1,
  type SubjectAcceptanceV1
} from './domain/acceptance-correction-contracts.js'
import type { EvaluationResultV2 } from './domain/evaluation-result-contracts-v2.js'
import { evaluationRecordDigest } from './evaluation-contract-registry.js'
import { evaluationRegistryFailure } from './evaluation-contract-registry-errors.js'

const TRANSITIONS: Record<CorrectionCycleV1['status'], Set<CorrectionCycleV1['status']>> = {
  requested: new Set(['produced', 'quarantined']),
  produced: new Set(['evaluating', 'quarantined']),
  evaluating: new Set(['passed', 'failed', 'quarantined']),
  passed: new Set(),
  failed: new Set(['requested', 'quarantined']),
  quarantined: new Set()
}

export class CorrectionCycleRegistry {
  readonly #latest = new Map<string, CorrectionCycleV1>()
  readonly #records = new Map<string, CorrectionCycleV1>()

  record(input: unknown): CorrectionCycleV1 {
    const cycle = CorrectionCycleV1Schema.parse(input)
    const existing = this.#records.get(cycle.id)
    if (existing) {
      if (canonicalJson(existing) !== canonicalJson(cycle)) {
        throw evaluationRegistryFailure('immutable_conflict', 'Correction cycle ID was reused')
      }
      return structuredClone(existing)
    }
    const key = `${cycle.tenantId}\u0000${cycle.missionId}\u0000${cycle.correctionKey}`
    const prior = this.#latest.get(key)
    if (cycle.version === 1) {
      if (prior || cycle.status !== 'requested') {
        throw evaluationRegistryFailure(
          'correction_initial_state',
          'Correction must begin requested'
        )
      }
    } else if (
      !prior ||
      cycle.version !== prior.version + 1 ||
      cycle.predecessor === null ||
      cycle.predecessor.id !== prior.id ||
      cycle.predecessor.version !== prior.version ||
      cycle.predecessor.digest !== evaluationRecordDigest(prior) ||
      !TRANSITIONS[prior.status].has(cycle.status)
    ) {
      throw evaluationRegistryFailure('correction_transition', 'Correction transition is invalid')
    }
    if (
      prior &&
      (canonicalJson(prior.fixedContract) !== canonicalJson(cycle.fixedContract) ||
        canonicalJson(prior.originalSubject) !== canonicalJson(cycle.originalSubject) ||
        cycle.evaluatorChanged ||
        cycle.thresholdChanged)
    ) {
      throw evaluationRegistryFailure(
        'correction_contract_drift',
        'Correction changed acceptance contract'
      )
    }
    const stored = structuredClone(cycle)
    this.#records.set(stored.id, stored)
    this.#latest.set(key, stored)
    return structuredClone(stored)
  }
}

function cycleId(key: string, version: number): string {
  return `correction_cycle_${sha256Text(canonicalJson({ key, version })).slice(0, 32)}`
}

export function requestCorrection(input: {
  acceptance: SubjectAcceptanceV1
  diagnosis: EvaluationDiagnosisV1
  maxAttempts: number
  recordedAt: string
}): CorrectionCycleV1 {
  if (input.acceptance.id !== input.diagnosis.acceptanceId) {
    throw new TypeError('Correction diagnosis differs from failed acceptance')
  }
  const correctionKey = `correction-${input.acceptance.acceptanceKey}`
  return CorrectionCycleV1Schema.parse({
    schemaVersion: 1,
    kind: 'correction-cycle',
    id: cycleId(correctionKey, 1),
    tenantId: input.acceptance.tenantId,
    missionId: input.acceptance.missionId,
    createdAt: input.recordedAt,
    correctionKey,
    version: 1,
    predecessor: null,
    failedAcceptanceId: input.acceptance.id,
    diagnosisId: input.diagnosis.id,
    originalSubject: input.acceptance.subject,
    correctedSubject: null,
    fixedContract: input.acceptance.contract,
    attempt: 1,
    maxAttempts: input.maxAttempts,
    allowedMutationPaths: input.diagnosis.allowedMutationPaths,
    changedPaths: [],
    addedEvidenceIds: [],
    evaluationResultIds: [],
    evaluatorChanged: false,
    thresholdChanged: false,
    status: 'requested',
    usage: emptyUsage(),
    recordedAt: input.recordedAt,
    recordedBy: { kind: 'system', id: 'correction-coordinator', version: '1' },
    acceptanceAuthority: 'none'
  })
}

export function recordCorrectedSubject(input: {
  current: CorrectionCycleV1
  correctedSubject: CorrectionCycleV1['correctedSubject']
  changedPaths: string[]
  evidenceIds: CorrectionCycleV1['addedEvidenceIds']
  usage: CorrectionCycleV1['usage']
  recordedAt: string
}): CorrectionCycleV1 {
  return nextCycle(input.current, {
    correctedSubject: input.correctedSubject,
    changedPaths: input.changedPaths,
    addedEvidenceIds: input.evidenceIds,
    evaluationResultIds: [],
    status: 'produced',
    usage: input.usage,
    recordedAt: input.recordedAt
  })
}

export function markCorrectionEvaluating(
  current: CorrectionCycleV1,
  recordedAt: string
): CorrectionCycleV1 {
  return nextCycle(current, { status: 'evaluating', recordedAt })
}

export function recordCorrectionResult(input: {
  current: CorrectionCycleV1
  result: EvaluationResultV2
  recordedAt: string
}): CorrectionCycleV1 {
  if (
    input.current.correctedSubject === null ||
    canonicalJson(input.current.correctedSubject) !== canonicalJson(input.result.subject) ||
    canonicalJson(input.current.fixedContract) !== canonicalJson(input.result.contract)
  ) {
    throw evaluationRegistryFailure(
      'correction_result_mismatch',
      'Correction result lineage differs'
    )
  }
  return nextCycle(input.current, {
    status: input.result.status === 'passed' ? 'passed' : 'failed',
    evaluationResultIds: [input.result.id],
    recordedAt: input.recordedAt
  })
}

export function retryOrQuarantineCorrection(
  current: CorrectionCycleV1,
  recordedAt: string
): CorrectionCycleV1 {
  if (current.status !== 'failed') {
    throw new TypeError('Only failed correction may retry or quarantine')
  }
  if (current.attempt >= current.maxAttempts) {
    return nextCycle(current, { status: 'quarantined', recordedAt })
  }
  return nextCycle(current, {
    status: 'requested',
    correctedSubject: null,
    attempt: current.attempt + 1,
    changedPaths: [],
    addedEvidenceIds: [],
    evaluationResultIds: [],
    usage: emptyUsage(),
    recordedAt
  })
}

function nextCycle(
  current: CorrectionCycleV1,
  change: Partial<CorrectionCycleV1> & { status: CorrectionCycleV1['status']; recordedAt: string }
): CorrectionCycleV1 {
  const version = current.version + 1
  return CorrectionCycleV1Schema.parse({
    ...current,
    ...change,
    id: cycleId(current.correctionKey, version),
    createdAt: change.recordedAt,
    version,
    predecessor: {
      id: current.id,
      version: current.version,
      digest: evaluationRecordDigest(current)
    },
    recordedBy: { kind: 'system', id: 'correction-coordinator', version: '1' }
  })
}

function emptyUsage(): CorrectionCycleV1['usage'] {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    toolCalls: 0,
    wallTimeMs: 0,
    costUsd: 0
  }
}
