import { canonicalJson, sha256Text } from './canonical-json.js'
import {
  SourceClaimComparisonV1Schema,
  type SourceClaimComparisonV1
} from './domain/discovery-reasoning-contracts.js'
import type { SourceDiscoveryLineageSchema } from './domain/source-inventory-contracts.js'
import type { z } from 'zod'

type DiscoveryLineage = z.infer<typeof SourceDiscoveryLineageSchema>

export type SuppliedSourceClaim = {
  id: string
  statement: string
  scope: string
  material: boolean
  value: unknown
  observedKey: string
}

export type SourceClaimObservation = {
  key: string
  status: 'observed' | 'denied' | 'unavailable'
  value: unknown
  observationIds: string[]
  evidenceIds: SourceClaimComparisonV1['results'][number]['evidenceIds']
  observedAt: string
  staleAfter: string | null
  reason: string
}

export function compareSourceClaims(
  claims: readonly SuppliedSourceClaim[],
  observations: readonly SourceClaimObservation[],
  metadata: {
    comparisonId: string
    tenantId: string
    createdAt: string
    lineage: DiscoveryLineage
    comparedBy: SourceClaimComparisonV1['comparedBy']
  }
): SourceClaimComparisonV1 {
  const byKey = new Map(observations.map((observation) => [observation.key, observation]))
  const comparedAt = Date.parse(metadata.createdAt)
  const results: SourceClaimComparisonV1['results'] = claims.map((claim) => {
    const observation = byKey.get(claim.observedKey)
    const suppliedDigest = sha256Text(canonicalJson(claim.value))
    if (!observation || observation.status === 'unavailable') {
      return {
        claimId: claim.id,
        statement: claim.statement,
        scope: claim.scope,
        material: claim.material,
        observationIds: observation?.observationIds ?? [],
        evidenceIds: observation?.evidenceIds ?? [],
        status: 'unresolved',
        suppliedDigest,
        observedDigest: null,
        reason: observation?.reason ?? 'No observation covers the supplied claim.',
        absenceConclusion: false
      }
    }
    if (observation.status === 'denied') {
      return {
        claimId: claim.id,
        statement: claim.statement,
        scope: claim.scope,
        material: claim.material,
        observationIds: observation.observationIds,
        evidenceIds: observation.evidenceIds,
        status: 'denied',
        suppliedDigest,
        observedDigest: null,
        reason: observation.reason,
        absenceConclusion: false
      }
    }
    const observedDigest = sha256Text(canonicalJson(observation.value))
    if (observation.staleAfter !== null && comparedAt >= Date.parse(observation.staleAfter)) {
      return {
        claimId: claim.id,
        statement: claim.statement,
        scope: claim.scope,
        material: claim.material,
        observationIds: observation.observationIds,
        evidenceIds: observation.evidenceIds,
        status: 'stale',
        suppliedDigest,
        observedDigest,
        reason: 'The matching observation expired before comparison.',
        absenceConclusion: false
      }
    }
    const supported = suppliedDigest === observedDigest
    return {
      claimId: claim.id,
      statement: claim.statement,
      scope: claim.scope,
      material: claim.material,
      observationIds: observation.observationIds,
      evidenceIds: observation.evidenceIds,
      status: supported ? 'supported' : 'refuted',
      suppliedDigest,
      observedDigest,
      reason: supported
        ? 'Current source observation matches the supplied claim.'
        : 'Current source observation contradicts the supplied claim.',
      absenceConclusion: supported && claim.value === false
    }
  })
  const count = (status: SourceClaimComparisonV1['results'][number]['status']) =>
    results.filter((result) => result.status === status).length
  return SourceClaimComparisonV1Schema.parse({
    schemaVersion: 1,
    kind: 'source-claim-comparison',
    id: metadata.comparisonId,
    tenantId: metadata.tenantId,
    createdAt: metadata.createdAt,
    lineage: metadata.lineage,
    results,
    summary: {
      supported: count('supported'),
      refuted: count('refuted'),
      unresolved: count('unresolved'),
      denied: count('denied'),
      stale: count('stale'),
      materialContradictions: results.filter(
        (result) => result.material && result.status === 'refuted'
      ).length
    },
    comparedAt: metadata.createdAt,
    comparedBy: metadata.comparedBy
  })
}
