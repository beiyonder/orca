import { canonicalJson, sha256Text } from './canonical-json.js'
import {
  SafeProbePlanV1Schema,
  type DiscoveryGapRankingV1,
  type SafeProbePlanV1
} from './domain/discovery-reasoning-contracts.js'
import type { SourceOperation, SourceReadLimits } from './domain/source-adapter-contracts.js'

export type ProbeCandidateInput = {
  id: string
  gapIds: DiscoveryGapRankingV1['gaps'][number]['gapId'][]
  operation: SourceOperation
  parameters: unknown
  requiredScope: string
  limits: SourceReadLimits
  predictedOutcomes: unknown[]
  informationGain: number
  risk: number
  cost: number
  accessAvailable: boolean
  blockers: string[]
}

export function planSafeProbe(
  ranking: DiscoveryGapRankingV1,
  inputs: readonly ProbeCandidateInput[],
  metadata: {
    planId: string
    createdAt: string
    maximumRisk: number
    maximumCost: number
    plannedBy: SafeProbePlanV1['plannedBy']
  }
): SafeProbePlanV1 {
  const gapById = new Map(ranking.gaps.map((gap) => [gap.gapId, gap]))
  const candidates = inputs.map((input) => {
    const gaps = input.gapIds.map((gapId) => {
      const gap = gapById.get(gapId)
      if (!gap) {
        throw new TypeError(`Probe references unknown discovery gap: ${gapId}`)
      }
      return gap
    })
    const blockers = [...input.blockers]
    if (!input.accessAvailable) {
      blockers.push('Required source access is unavailable.')
    }
    if (input.risk > metadata.maximumRisk) {
      blockers.push('Probe risk exceeds the planning envelope.')
    }
    if (input.cost > metadata.maximumCost) {
      blockers.push('Probe cost exceeds the planning envelope.')
    }
    if (gaps.some((gap) => gap.exceptionOnly)) {
      blockers.push('At least one gap requires an accountable human exception.')
    }
    return {
      id: input.id,
      gapIds: input.gapIds,
      operation: input.operation,
      parameters: input.parameters,
      parameterDigest: sha256Text(canonicalJson(input.parameters)),
      requiredScope: input.requiredScope,
      limits: input.limits,
      predictedOutcomes: input.predictedOutcomes,
      informationGain: input.informationGain,
      risk: input.risk,
      cost: input.cost,
      executable: blockers.length === 0,
      blockers: [...new Set(blockers)].toSorted(),
      priority:
        gaps.reduce((sum, gap) => sum + Math.max(1, 20 - gap.rank), 0) +
        input.informationGain * 2 -
        input.risk -
        input.cost
    }
  })
  const selected = candidates
    .filter((candidate) => candidate.executable)
    .toSorted((left, right) => right.priority - left.priority || left.id.localeCompare(right.id))[0]
  const executableGapIds = new Set(
    candidates.filter((candidate) => candidate.executable).flatMap((candidate) => candidate.gapIds)
  )
  const exceptionGaps = ranking.gaps
    .filter((gap) => gap.exceptionOnly || !executableGapIds.has(gap.gapId))
    .map((gap) => gap.gapId)
  return SafeProbePlanV1Schema.parse({
    schemaVersion: 1,
    kind: 'safe-probe-plan',
    id: metadata.planId,
    tenantId: ranking.tenantId,
    createdAt: metadata.createdAt,
    rankingId: ranking.id,
    candidates: candidates.map(({ priority: _priority, ...candidate }) => candidate),
    selectedCandidateId: selected?.id ?? null,
    humanException:
      exceptionGaps.length > 0 || selected === undefined
        ? {
            gapIds: exceptionGaps.length > 0 ? exceptionGaps : ranking.gaps.map((gap) => gap.gapId),
            question:
              selected === undefined
                ? 'No bounded executable probe can resolve the highest-priority discovery gap.'
                : 'Remaining exception-only gaps require accountable human input.'
          }
        : null,
    plannedAt: metadata.createdAt,
    plannedBy: metadata.plannedBy
  })
}
