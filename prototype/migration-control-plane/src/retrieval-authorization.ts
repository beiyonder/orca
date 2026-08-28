import type { CorpusChunkRecord } from './corpus-catalog.js'
import type { RetrievalExclusionReason, RetrievalQueryV1 } from './domain/retrieval-contracts.js'

export type RetrievalEligibilityInput = {
  query: RetrievalQueryV1
  record: CorpusChunkRecord
  isCurrent: boolean
  digestValid: boolean
}

export type RetrievalEligibilityDecision = {
  eligible: boolean
  reason: RetrievalExclusionReason | null
  warnings: readonly string[]
}

function scopeMatches(query: RetrievalQueryV1, record: CorpusChunkRecord): boolean {
  const actual = record.chunk.applicability.scope
  return query.scopes.some(
    (allowed) =>
      allowed.environment === actual.environment &&
      allowed.system === actual.system &&
      (allowed.entity === undefined || allowed.entity === actual.entity) &&
      (allowed.attributes === undefined ||
        Object.entries(allowed.attributes).every(
          ([key, value]) => actual.attributes?.[key] === value
        ))
  )
}

function isStale(query: RetrievalQueryV1, record: CorpusChunkRecord): boolean {
  const source = record.source
  const asOf = Date.parse(query.asOf)
  const policy = source.freshness
  if (policy.kind === 'expires-at' && asOf >= Date.parse(policy.expiresAt)) {
    return true
  }
  const policyAge = policy.kind === 'refresh-after' ? policy.maxAgeDays : null
  const maximumAge = query.maximumAgeDays
  const ageLimit =
    policyAge === null
      ? maximumAge
      : maximumAge === null
        ? policyAge
        : Math.min(policyAge, maximumAge)
  if (ageLimit !== null) {
    const ageMs = asOf - Date.parse(source.observedAt)
    if (ageMs > ageLimit * 24 * 60 * 60 * 1000) {
      return true
    }
  }
  const { effectiveFrom, effectiveUntil } = record.chunk.applicability
  return (
    (effectiveFrom !== null && asOf < Date.parse(effectiveFrom)) ||
    (effectiveUntil !== null && asOf >= Date.parse(effectiveUntil))
  )
}

export function evaluateRetrievalEligibility(
  input: RetrievalEligibilityInput
): RetrievalEligibilityDecision {
  const { query, record } = input
  if (record.source.tenantId !== query.tenantId && record.source.visibility !== 'global-public') {
    return { eligible: false, reason: 'tenant-mismatch', warnings: [] }
  }
  if (!query.allowedSourceClasses.includes(record.source.sourceClass)) {
    return { eligible: false, reason: 'source-class-denied', warnings: [] }
  }
  if (!query.allowedDataClasses.includes(record.chunk.dataClass)) {
    return { eligible: false, reason: 'data-class-denied', warnings: [] }
  }
  if (!scopeMatches(query, record)) {
    return { eligible: false, reason: 'scope-mismatch', warnings: [] }
  }
  if (
    query.allowedSourceIds.length > 0 &&
    !query.allowedSourceIds.includes(record.source.sourceId)
  ) {
    return { eligible: false, reason: 'source-not-allowed', warnings: [] }
  }
  if (!record.source.permission.renderAllowed) {
    return { eligible: false, reason: 'render-forbidden', warnings: [] }
  }
  if (!input.digestValid) {
    return { eligible: false, reason: 'digest-invalid', warnings: [] }
  }
  if (query.currentOnly && !input.isCurrent) {
    return { eligible: false, reason: 'superseded', warnings: [] }
  }
  if (isStale(query, record)) {
    const disposition = record.source.freshness.staleDisposition
    if (disposition === 'warn') {
      return { eligible: true, reason: null, warnings: ['stale-source'] }
    }
    if (disposition === 'comparison-only' && query.purpose === 'comparison') {
      return { eligible: true, reason: null, warnings: ['comparison-only-source'] }
    }
    return { eligible: false, reason: 'stale', warnings: [] }
  }
  return { eligible: true, reason: null, warnings: [] }
}
