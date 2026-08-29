import { z } from 'zod'
import { canonicalJson, sha256Text } from '../canonical-json.js'
import {
  ActorSchema,
  EvidenceIdSchema,
  GapIdSchema,
  IsoDateTimeSchema,
  Sha256Schema,
  ShortTextSchema,
  tenantRecordFields
} from './common-contracts.js'
import { SourceOperationSchema, SourceReadLimitsSchema } from './source-adapter-contracts.js'
import { SourceDiscoveryLineageSchema } from './source-inventory-contracts.js'

const discoveryId = (prefix: string) =>
  z
    .string()
    .min(prefix.length + 2)
    .max(128)
    .regex(new RegExp(`^${prefix}_[a-z0-9][a-z0-9_-]{0,111}$`))

export const SourceClaimComparisonIdSchema =
  discoveryId('source_claim_comparison').brand<'SourceClaimComparisonId'>()
export const DiscoveryGapRankingIdSchema =
  discoveryId('discovery_gap_ranking').brand<'DiscoveryGapRankingId'>()
export const SafeProbePlanIdSchema = discoveryId('safe_probe_plan').brand<'SafeProbePlanId'>()

const ClaimResultSchema = z.strictObject({
  claimId: z.string().min(1).max(128),
  statement: z.string().min(1).max(8_192),
  scope: z.string().min(1).max(1_024),
  material: z.boolean(),
  observationIds: z.array(z.string().min(1).max(128)).max(10_000),
  evidenceIds: z.array(EvidenceIdSchema).max(10_000),
  status: z.enum(['supported', 'refuted', 'unresolved', 'denied', 'stale']),
  suppliedDigest: Sha256Schema,
  observedDigest: Sha256Schema.nullable(),
  reason: ShortTextSchema,
  absenceConclusion: z.boolean()
})

export const SourceClaimComparisonV1Schema = z
  .strictObject({
    ...tenantRecordFields('source-claim-comparison', SourceClaimComparisonIdSchema),
    lineage: SourceDiscoveryLineageSchema,
    results: z.array(ClaimResultSchema).min(1).max(10_000),
    summary: z.strictObject({
      supported: z.number().int().nonnegative(),
      refuted: z.number().int().nonnegative(),
      unresolved: z.number().int().nonnegative(),
      denied: z.number().int().nonnegative(),
      stale: z.number().int().nonnegative(),
      materialContradictions: z.number().int().nonnegative()
    }),
    comparedAt: IsoDateTimeSchema,
    comparedBy: ActorSchema
  })
  .superRefine((comparison, context) => {
    const counts = Object.fromEntries(
      ['supported', 'refuted', 'unresolved', 'denied', 'stale'].map((status) => [
        status,
        comparison.results.filter((result) => result.status === status).length
      ])
    )
    for (const status of ['supported', 'refuted', 'unresolved', 'denied', 'stale'] as const) {
      if (comparison.summary[status] !== counts[status]) {
        context.addIssue({ code: 'custom', message: 'Claim comparison summary disagrees' })
      }
    }
    const materialContradictions = comparison.results.filter(
      (result) => result.material && result.status === 'refuted'
    ).length
    if (comparison.summary.materialContradictions !== materialContradictions) {
      context.addIssue({ code: 'custom', message: 'Material contradiction count disagrees' })
    }
    if (
      comparison.results.some((result) => result.absenceConclusion && result.status !== 'supported')
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Unresolved or denied claim cannot prove absence'
      })
    }
  })

const GapScoreSchema = z.strictObject({
  impact: z.number().int().min(0).max(5),
  uncertainty: z.number().int().min(0).max(5),
  blocking: z.number().int().min(0).max(5),
  probeCost: z.number().int().min(0).max(5),
  probeRisk: z.number().int().min(0).max(5),
  total: z.number().int().min(-10).max(15)
})

export const DiscoveryGapRankingV1Schema = z
  .strictObject({
    ...tenantRecordFields('discovery-gap-ranking', DiscoveryGapRankingIdSchema),
    comparisonId: SourceClaimComparisonIdSchema,
    gaps: z.array(
      z.strictObject({
        gapId: GapIdSchema,
        claimIds: z.array(z.string().min(1).max(128)).min(1).max(10_000),
        question: z.string().min(1).max(8_192),
        impact: z.enum(['critical', 'high', 'medium', 'low']),
        evidenceIds: z.array(EvidenceIdSchema).max(10_000),
        cheapestProbeId: z.string().min(1).max(128).nullable(),
        exceptionOnly: z.boolean(),
        score: GapScoreSchema,
        rank: z.number().int().positive(),
        rationale: ShortTextSchema
      })
    ),
    rankedAt: IsoDateTimeSchema,
    rankedBy: ActorSchema
  })
  .superRefine((ranking, context) => {
    if (new Set(ranking.gaps.map((gap) => gap.gapId)).size !== ranking.gaps.length) {
      context.addIssue({ code: 'custom', message: 'Discovery gap identities must be unique' })
    }
    ranking.gaps.forEach((gap, index) => {
      if (gap.rank !== index + 1) {
        context.addIssue({ code: 'custom', message: 'Discovery gap ranks must be contiguous' })
      }
      const total =
        gap.score.impact +
        gap.score.uncertainty +
        gap.score.blocking -
        gap.score.probeCost -
        gap.score.probeRisk
      if (gap.score.total !== total) {
        context.addIssue({ code: 'custom', message: 'Discovery gap score arithmetic differs' })
      }
    })
  })

const ProbeCandidateSchema = z.strictObject({
  id: z.string().min(1).max(128),
  gapIds: z.array(GapIdSchema).min(1).max(1_000),
  operation: SourceOperationSchema,
  parameters: z.json(),
  parameterDigest: Sha256Schema,
  requiredScope: z.string().min(1).max(1_024),
  limits: SourceReadLimitsSchema,
  predictedOutcomes: z.array(z.json()).min(2).max(32),
  informationGain: z.number().int().min(0).max(5),
  risk: z.number().int().min(0).max(5),
  cost: z.number().int().min(0).max(5),
  executable: z.boolean(),
  blockers: z.array(ShortTextSchema).max(64)
})

export const SafeProbePlanV1Schema = z
  .strictObject({
    ...tenantRecordFields('safe-probe-plan', SafeProbePlanIdSchema),
    rankingId: DiscoveryGapRankingIdSchema,
    candidates: z.array(ProbeCandidateSchema).max(1_000),
    selectedCandidateId: z.string().min(1).max(128).nullable(),
    humanException: z
      .strictObject({ gapIds: z.array(GapIdSchema).min(1), question: ShortTextSchema })
      .nullable(),
    plannedAt: IsoDateTimeSchema,
    plannedBy: ActorSchema
  })
  .superRefine((plan, context) => {
    if (new Set(plan.candidates.map((candidate) => candidate.id)).size !== plan.candidates.length) {
      context.addIssue({ code: 'custom', message: 'Probe candidate identities must be unique' })
    }
    if (
      plan.candidates.some(
        (candidate) => sha256Text(canonicalJson(candidate.parameters)) !== candidate.parameterDigest
      )
    ) {
      context.addIssue({ code: 'custom', message: 'Probe candidate parameter digest differs' })
    }
    const selected = plan.candidates.find((candidate) => candidate.id === plan.selectedCandidateId)
    if (plan.selectedCandidateId !== null && (!selected || !selected.executable)) {
      context.addIssue({ code: 'custom', message: 'Selected probe must be executable' })
    }
    if (plan.selectedCandidateId === null && plan.humanException === null) {
      context.addIssue({
        code: 'custom',
        message: 'Probe plan requires an executable action or human exception'
      })
    }
  })

export type SourceClaimComparisonV1 = z.infer<typeof SourceClaimComparisonV1Schema>
export type DiscoveryGapRankingV1 = z.infer<typeof DiscoveryGapRankingV1Schema>
export type SafeProbePlanV1 = z.infer<typeof SafeProbePlanV1Schema>
