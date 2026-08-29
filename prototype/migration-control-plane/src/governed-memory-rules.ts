import { canonicalJson } from './canonical-json.js'
import type {
  MemoryCandidateV1,
  MemoryInvalidationV1,
  MemoryUseV1,
  MemoryVersionV1
} from './domain/memory-contracts.js'

export type MemoryRuleFailure = { code: string; message: string }

export function memoryCandidateVersionFailure(
  candidate: MemoryCandidateV1,
  version: MemoryVersionV1
): MemoryRuleFailure | null {
  if (candidate.memoryType !== version.memoryType) {
    return {
      code: 'candidate_type_mismatch',
      message: 'Memory version type differs from its candidate'
    }
  }
  if (version.contentDigest !== candidate.contentDigest) {
    return {
      code: 'candidate_content_mismatch',
      message: 'Memory version differs from its candidate'
    }
  }
  if (
    canonicalJson(version.scope) !== canonicalJson(candidate.proposedScope) ||
    canonicalJson(version.applicability) !== canonicalJson(candidate.applicability)
  ) {
    return { code: 'candidate_scope_mismatch', message: 'Memory version expands candidate scope' }
  }
  if (version.usePolicy.dataClasses.some((dataClass) => dataClass !== candidate.dataClass)) {
    return {
      code: 'candidate_data_class_mismatch',
      message: 'Memory version expands candidate data class'
    }
  }
  const sourceRecordIds = new Set(candidate.sourceRecordIds)
  const sourceEvidenceIds = new Set(candidate.sourceEvidenceIds)
  if (
    version.canonicalSourceRecordIds.some((recordId) => !sourceRecordIds.has(recordId)) ||
    version.canonicalSourceEvidenceIds.some((evidenceId) => !sourceEvidenceIds.has(evidenceId))
  ) {
    return {
      code: 'candidate_provenance_mismatch',
      message: 'Memory version expands candidate provenance'
    }
  }
  return null
}

export function memoryInvalidationFailure(
  invalidation: MemoryInvalidationV1,
  target: MemoryVersionV1,
  replacement: MemoryVersionV1,
  uses: readonly MemoryUseV1[]
): MemoryRuleFailure | null {
  if (
    target.tenantId !== invalidation.tenantId ||
    replacement.tenantId !== invalidation.tenantId ||
    replacement.memoryId !== target.memoryId ||
    replacement.supersedesVersionId !== target.id ||
    replacement.status !== invalidation.disposition ||
    invalidation.replacementVersionId !== replacement.id
  ) {
    return {
      code: 'invalidation_transition_mismatch',
      message: 'Replacement memory does not apply invalidation'
    }
  }
  const expectedUses = uses.map((use) => use.id).toSorted()
  if (canonicalJson(expectedUses) !== canonicalJson([...invalidation.impactedUseIds].toSorted())) {
    return {
      code: 'incomplete_use_impact',
      message: 'Memory invalidation must name every prior use'
    }
  }
  const invalidatedAt = Date.parse(invalidation.createdAt)
  if (
    invalidatedAt < Date.parse(target.createdAt) ||
    Date.parse(replacement.createdAt) < invalidatedAt ||
    uses.some((use) => Date.parse(use.createdAt) > invalidatedAt)
  ) {
    return {
      code: 'invalidation_timeline_mismatch',
      message: 'Memory invalidation timeline is inconsistent'
    }
  }
  return null
}

export function isMemoryVersionValidAt(
  version: MemoryVersionV1,
  candidate: MemoryCandidateV1 | undefined,
  instant: number
): boolean {
  if (!Number.isFinite(instant) || !candidate) {
    return false
  }
  if (instant < Date.parse(version.validFrom)) {
    return false
  }
  if (version.validUntil !== null && instant >= Date.parse(version.validUntil)) {
    return false
  }
  if (
    version.applicability.validFrom !== null &&
    instant < Date.parse(version.applicability.validFrom)
  ) {
    return false
  }
  if (
    version.applicability.validUntil !== null &&
    instant >= Date.parse(version.applicability.validUntil)
  ) {
    return false
  }
  return !(
    candidate.retention.expiresAt !== null && instant >= Date.parse(candidate.retention.expiresAt)
  )
}
