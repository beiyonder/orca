import {
  DiscoveryGapRankingV1Schema,
  type DiscoveryGapRankingV1,
  type SourceClaimComparisonV1
} from './domain/discovery-reasoning-contracts.js'

export type GapAssessment = {
  claimId: string
  question: string
  impact: 'critical' | 'high' | 'medium' | 'low'
  blocking: number
  probeCost: number
  probeRisk: number
  cheapestProbeId: string | null
  exceptionOnly: boolean
}

const impactScore = { critical: 5, high: 4, medium: 2, low: 1 } as const
const uncertaintyScore: Record<SourceClaimComparisonV1['results'][number]['status'], number> = {
  supported: 0,
  refuted: 2,
  unresolved: 5,
  denied: 5,
  stale: 4
}

export function rankDiscoveryGaps(
  comparison: SourceClaimComparisonV1,
  assessments: readonly GapAssessment[],
  metadata: {
    rankingId: string
    createdAt: string
    rankedBy: DiscoveryGapRankingV1['rankedBy']
  }
): DiscoveryGapRankingV1 {
  const assessmentByClaim = new Map(
    assessments.map((assessment) => [assessment.claimId, assessment])
  )
  const candidates = comparison.results.flatMap((result) => {
    if (result.status === 'supported') {
      return []
    }
    const assessment = assessmentByClaim.get(result.claimId)
    if (!assessment) {
      throw new TypeError(`Missing gap assessment for claim: ${result.claimId}`)
    }
    const score = {
      impact: impactScore[assessment.impact],
      uncertainty: uncertaintyScore[result.status],
      blocking: assessment.blocking,
      probeCost: assessment.probeCost,
      probeRisk: assessment.probeRisk,
      total:
        impactScore[assessment.impact] +
        uncertaintyScore[result.status] +
        assessment.blocking -
        assessment.probeCost -
        assessment.probeRisk
    }
    return [
      {
        gapId: `gap_discovery_${result.claimId.replaceAll(/[^a-z0-9_-]/g, '_')}`,
        claimIds: [result.claimId],
        question: assessment.question,
        impact: assessment.impact,
        evidenceIds: result.evidenceIds,
        cheapestProbeId: assessment.cheapestProbeId,
        exceptionOnly: assessment.exceptionOnly,
        score,
        rank: 0,
        rationale: `${result.status} claim; prioritize evidence that can change a blocked decision.`
      }
    ]
  })
  const gaps = candidates
    .toSorted(
      (left, right) =>
        right.score.total - left.score.total ||
        right.score.impact - left.score.impact ||
        left.gapId.localeCompare(right.gapId)
    )
    .map((gap, index) => ({ ...gap, rank: index + 1 }))
  return DiscoveryGapRankingV1Schema.parse({
    schemaVersion: 1,
    kind: 'discovery-gap-ranking',
    id: metadata.rankingId,
    tenantId: comparison.tenantId,
    createdAt: metadata.createdAt,
    comparisonId: comparison.id,
    gaps,
    rankedAt: metadata.createdAt,
    rankedBy: metadata.rankedBy
  })
}
