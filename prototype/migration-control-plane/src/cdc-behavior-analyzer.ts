import { canonicalJson, sha256Text } from './canonical-json.js'
import {
  SourceCdcAnalysisV1Schema,
  SourceCdcTraceV1Schema,
  type SourceCdcAnalysisV1,
  type SourceCdcTraceV1
} from './domain/source-cdc-contracts.js'

const stateId = (entity: string, key: Record<string, string | number | boolean>) =>
  `${entity}:${canonicalJson(key)}`

export function analyzeCdcBehavior(
  input: unknown,
  metadata: {
    analysisId: string
    analyzedAt: string
    analyzedBy: SourceCdcAnalysisV1['analyzedBy']
  }
): SourceCdcAnalysisV1 {
  const trace = SourceCdcTraceV1Schema.parse(input)
  const state = new Map(
    trace.initialState.map((record) => [stateId(record.entity, record.key), record] as const)
  )
  const positions = new Set<string>()
  const checkpoints: string[] = []
  const transactionRuns = new Map<string, { first: number; last: number; count: number }>()
  const eventDispositions: SourceCdcAnalysisV1['eventDispositions'] = []
  const gaps: string[] = []
  let lastPosition: string | null = null
  let lastOccurredAt = Number.NEGATIVE_INFINITY
  let sawSnapshotRow = false
  let sawSnapshotComplete = false
  let sawDelete = false
  let sawUpdate = false
  let sawDdl = false
  let sawLate = false
  let sawRestart = false
  let transactionPartial = false

  for (const event of trace.events) {
    const occurredAt = Date.parse(event.occurredAt)
    if (occurredAt < lastOccurredAt) {
      sawLate = true
    }
    lastOccurredAt = Math.max(lastOccurredAt, occurredAt)
    if (event.restartEpoch > 0) {
      sawRestart = true
    }
    if (positions.has(event.position)) {
      eventDispositions.push({
        sequence: event.sequence,
        position: event.position,
        disposition: 'duplicate',
        reason: 'Source position was already applied.'
      })
      continue
    }
    if (lastPosition !== null && event.position < lastPosition) {
      eventDispositions.push({
        sequence: event.sequence,
        position: event.position,
        disposition: 'invalid',
        reason: 'Source position regressed without matching an applied duplicate.'
      })
      gaps.push(`Position regression at ${event.position}.`)
      continue
    }
    positions.add(event.position)
    lastPosition = event.position
    if (event.transactionId !== null) {
      const prior = transactionRuns.get(event.transactionId)
      if (prior && prior.last !== event.sequence - 1) {
        transactionPartial = true
      }
      transactionRuns.set(event.transactionId, {
        first: prior?.first ?? event.sequence,
        last: event.sequence,
        count: (prior?.count ?? 0) + 1
      })
    }
    const disposition = applyEvent(trace, event, state, gaps)
    eventDispositions.push({
      sequence: event.sequence,
      position: event.position,
      disposition,
      reason: dispositionReason(event.operation, disposition)
    })
    sawSnapshotRow ||= event.operation === 'snapshot-row'
    sawSnapshotComplete ||= event.operation === 'snapshot-complete'
    sawDelete ||= event.operation === 'delete'
    sawUpdate ||= event.operation === 'update'
    sawDdl ||= event.operation === 'ddl'
    if (event.operation === 'checkpoint' && event.resumeToken !== null) {
      checkpoints.push(event.resumeToken)
    }
  }

  const finalRecords = [...state.values()].toSorted((left, right) =>
    stateId(left.entity, left.key).localeCompare(stateId(right.entity, right.key))
  )
  const finalStateDigest = sha256Text(canonicalJson(finalRecords))
  if (finalStateDigest !== trace.expectedFinalStateDigest) {
    gaps.push('Observed replay state differs from the expected target-state oracle.')
  }
  const transactionObserved = [...transactionRuns.values()].some((run) => run.count > 1)
  const invalidCount = eventDispositions.filter((event) => event.disposition === 'invalid').length
  return SourceCdcAnalysisV1Schema.parse({
    schemaVersion: 1,
    kind: 'source-cdc-analysis',
    id: metadata.analysisId,
    tenantId: trace.tenantId,
    createdAt: metadata.analyzedAt,
    traceId: trace.id,
    lineage: trace.lineage,
    semantics: {
      snapshot:
        sawSnapshotRow && sawSnapshotComplete && invalidCount === 0
          ? 'consistent-boundary'
          : sawSnapshotRow
            ? 'inconsistent'
            : 'not-observed',
      ordering: invalidCount === 0 ? 'source-position-total' : 'unordered',
      transactions: transactionObserved
        ? transactionPartial
          ? 'partial'
          : 'atomic'
        : 'not-observed',
      deletes: sawDelete ? 'explicit' : 'not-observed',
      amendments: sawUpdate ? 'ordered-update' : 'not-observed',
      ddl: sawDdl ? 'versioned-event' : 'not-observed',
      restart: sawRestart
        ? checkpoints.length > 0
          ? 'resume-token'
          : 'snapshot-restart'
        : 'not-observed',
      checkpoint:
        checkpoints.length === 0
          ? 'not-observed'
          : new Set(checkpoints).size === checkpoints.length
            ? 'monotonic'
            : 'regressed',
      lateEvents: sawLate ? 'ordered-by-position' : 'not-observed'
    },
    eventDispositions,
    finalStateDigest,
    finalRecordCount: finalRecords.length,
    gaps: [...new Set(gaps)].toSorted(),
    analyzedAt: metadata.analyzedAt,
    analyzedBy: metadata.analyzedBy
  })
}

function applyEvent(
  _trace: SourceCdcTraceV1,
  event: SourceCdcTraceV1['events'][number],
  state: Map<string, SourceCdcTraceV1['initialState'][number]>,
  gaps: string[]
): SourceCdcAnalysisV1['eventDispositions'][number]['disposition'] {
  if (event.operation === 'heartbeat') {
    return 'ignored'
  }
  if (
    event.operation === 'snapshot-complete' ||
    event.operation === 'checkpoint' ||
    event.operation === 'ddl'
  ) {
    return 'applied'
  }
  if (event.operation === 'truncate') {
    for (const [id, record] of state) {
      if (event.entity === null || record.entity === event.entity) {
        state.delete(id)
      }
    }
    return 'applied'
  }
  const id = stateId(event.entity!, event.key!)
  const prior = state.get(id)
  if (event.beforeDigest !== null && prior?.valueDigest !== event.beforeDigest) {
    gaps.push(`Before-image mismatch for ${id} at ${event.position}.`)
    return 'invalid'
  }
  if (event.operation === 'delete') {
    if (!prior) {
      gaps.push(`Delete referenced absent record ${id}.`)
      return 'invalid'
    }
    state.delete(id)
    return 'applied'
  }
  if (event.after === null || event.afterDigest === null) {
    gaps.push(`Row operation omitted after state for ${id}.`)
    return 'invalid'
  }
  state.set(id, {
    entity: event.entity!,
    key: event.key!,
    value: event.after,
    valueDigest: event.afterDigest
  })
  return 'applied'
}

function dispositionReason(
  operation: SourceCdcTraceV1['events'][number]['operation'],
  disposition: SourceCdcAnalysisV1['eventDispositions'][number]['disposition']
): string {
  if (disposition === 'invalid') {
    return `${operation} failed source-state preconditions.`
  }
  if (disposition === 'ignored') {
    return `${operation} carries liveness but no target-state mutation.`
  }
  return `${operation} was applied exactly once by source position.`
}
