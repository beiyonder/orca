import { z } from 'zod'
import {
  ActorSchema,
  AssertionIdSchema,
  ContentReferenceSchema,
  ContradictionIdSchema,
  DecisionIdSchema,
  DataClassSchema,
  DomainScopeSchema,
  EvidenceIdSchema,
  FindingIdSchema,
  GapIdSchema,
  ImpactReviewIdSchema,
  IsoDateTimeSchema,
  JsonValueSchema,
  NonEmptyTextSchema,
  ProbeIdSchema,
  ProbeResultIdSchema,
  PropositionIdSchema,
  RevisionSchema,
  ShortTextSchema,
  missionRecordFields,
  uniqueIdArray
} from './common-contracts.js'

export const EvidenceSourceRoleSchema = z.enum([
  'customer-claim',
  'direct-observation',
  'generated-artifact',
  'evaluator-result',
  'operator-statement',
  'external-reference'
])

export const EvidenceItemV1Schema = z
  .object({
    ...missionRecordFields('evidence-item', EvidenceIdSchema),
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    sourceRole: EvidenceSourceRoleSchema,
    sourceName: ShortTextSchema,
    sourceVersion: z.string().min(1).max(512),
    content: ContentReferenceSchema,
    scope: DomainScopeSchema,
    dataClass: DataClassSchema,
    observedAt: IsoDateTimeSchema,
    effectiveFrom: IsoDateTimeSchema.nullable(),
    effectiveUntil: IsoDateTimeSchema.nullable(),
    supersedesEvidenceId: EvidenceIdSchema.nullable(),
    limitations: z.array(ShortTextSchema).max(64)
  })
  .strict()
  .superRefine((evidence, context) => {
    if (
      evidence.effectiveFrom !== null &&
      evidence.effectiveUntil !== null &&
      Date.parse(evidence.effectiveUntil) < Date.parse(evidence.effectiveFrom)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'effectiveUntil must not precede effectiveFrom',
        path: ['effectiveUntil']
      })
    }
  })

export const PropositionV1Schema = z
  .object({
    ...missionRecordFields('proposition', PropositionIdSchema),
    revision: RevisionSchema,
    subject: z.string().min(1).max(1_024),
    predicate: z.string().min(1).max(256),
    object: JsonValueSchema,
    normalizedStatement: NonEmptyTextSchema,
    scope: DomainScopeSchema,
    effectiveFrom: IsoDateTimeSchema.nullable(),
    effectiveUntil: IsoDateTimeSchema.nullable(),
    supersedesPropositionId: PropositionIdSchema.nullable()
  })
  .strict()
  .superRefine((proposition, context) => {
    if (
      proposition.effectiveFrom !== null &&
      proposition.effectiveUntil !== null &&
      Date.parse(proposition.effectiveUntil) < Date.parse(proposition.effectiveFrom)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'effectiveUntil must not precede effectiveFrom',
        path: ['effectiveUntil']
      })
    }
    if (proposition.supersedesPropositionId === proposition.id) {
      context.addIssue({
        code: 'custom',
        message: 'Proposition cannot supersede itself',
        path: ['supersedesPropositionId']
      })
    }
  })

export const AssertionV1Schema = z
  .object({
    ...missionRecordFields('assertion', AssertionIdSchema),
    propositionId: PropositionIdSchema,
    evidenceId: EvidenceIdSchema,
    polarity: z.enum(['supports', 'refutes']),
    directness: z.enum(['direct', 'derived']),
    applicability: z.enum(['in-scope', 'out-of-scope', 'partial', 'unknown']),
    derivationAssertionIds: uniqueIdArray(AssertionIdSchema, {
      max: 1_000,
      label: 'derivationAssertionIds'
    }),
    rationale: z.string().max(8_192),
    assertedBy: ActorSchema
  })
  .strict()
  .superRefine((assertion, context) => {
    if (assertion.directness === 'direct' && assertion.derivationAssertionIds.length > 0) {
      context.addIssue({
        code: 'custom',
        message: 'Direct assertions cannot cite derivation assertions',
        path: ['derivationAssertionIds']
      })
    }
    if (assertion.directness === 'derived' && assertion.derivationAssertionIds.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'Derived assertions require derivation assertions',
        path: ['derivationAssertionIds']
      })
    }
  })

const OpenContradictionStateSchema = z.object({ status: z.literal('open') }).strict()
const ResolvedContradictionStateSchema = z
  .object({
    status: z.literal('resolved'),
    acceptedFindingId: FindingIdSchema,
    resolvedAt: IsoDateTimeSchema
  })
  .strict()
const SupersededContradictionStateSchema = z
  .object({
    status: z.literal('superseded'),
    supersededByContradictionId: ContradictionIdSchema,
    supersededAt: IsoDateTimeSchema
  })
  .strict()

export const ContradictionStateSchema = z.discriminatedUnion('status', [
  OpenContradictionStateSchema,
  ResolvedContradictionStateSchema,
  SupersededContradictionStateSchema
])

export const ContradictionSetV1Schema = z
  .object({
    ...missionRecordFields('contradiction-set', ContradictionIdSchema),
    propositionIds: uniqueIdArray(PropositionIdSchema, {
      min: 1,
      max: 128,
      label: 'propositionIds'
    }),
    assertionIds: uniqueIdArray(AssertionIdSchema, {
      min: 2,
      max: 1_000,
      label: 'assertionIds'
    }),
    blockingGapIds: uniqueIdArray(GapIdSchema, { max: 1_000, label: 'blockingGapIds' }),
    state: ContradictionStateSchema
  })
  .strict()

const ActiveGapStateSchema = z
  .object({
    status: z.enum(['open', 'investigating']),
    reason: ShortTextSchema
  })
  .strict()
const BlockedGapStateSchema = z
  .object({
    status: z.literal('blocked'),
    reason: ShortTextSchema,
    blockerIds: z.array(z.string().min(1).max(128)).min(1).max(1_000)
  })
  .strict()
const ResolvedGapStateSchema = z
  .object({
    status: z.literal('resolved'),
    acceptedFindingId: FindingIdSchema,
    resolvedAt: IsoDateTimeSchema
  })
  .strict()
const QuarantinedGapStateSchema = z
  .object({
    status: z.literal('quarantined'),
    reason: ShortTextSchema,
    quarantinedAt: IsoDateTimeSchema
  })
  .strict()

export const GapStateSchema = z.discriminatedUnion('status', [
  ActiveGapStateSchema,
  BlockedGapStateSchema,
  ResolvedGapStateSchema,
  QuarantinedGapStateSchema
])

export const GapV1Schema = z
  .object({
    ...missionRecordFields('gap', GapIdSchema),
    revision: RevisionSchema,
    question: NonEmptyTextSchema,
    impact: z.enum(['low', 'medium', 'high', 'critical']),
    propositionIds: uniqueIdArray(PropositionIdSchema, {
      max: 1_000,
      label: 'propositionIds'
    }),
    hypothesisIds: uniqueIdArray(PropositionIdSchema, {
      max: 1_000,
      label: 'hypothesisIds'
    }),
    contradictionIds: uniqueIdArray(ContradictionIdSchema, {
      max: 1_000,
      label: 'contradictionIds'
    }),
    probeCandidateIds: uniqueIdArray(ProbeIdSchema, {
      max: 1_000,
      label: 'probeCandidateIds'
    }),
    blockedDecisionIds: uniqueIdArray(DecisionIdSchema, {
      max: 1_000,
      label: 'blockedDecisionIds'
    }),
    state: GapStateSchema
  })
  .strict()

export const ProbeRequestV1Schema = z
  .object({
    ...missionRecordFields('probe-request', ProbeIdSchema),
    gapId: GapIdSchema,
    method: z.string().min(1).max(128),
    question: NonEmptyTextSchema,
    parameters: JsonValueSchema,
    expectedEvidenceDigest: z.string().regex(/^[a-f0-9]{64}$/),
    predictedOutcomes: z.array(JsonValueSchema).min(2).max(32),
    budget: z
      .object({
        timeLimitMs: z.number().int().positive().max(86_400_000),
        rowLimit: z.number().int().positive().max(1_000_000),
        byteLimit: z
          .number()
          .int()
          .positive()
          .max(64 * 1024 * 1024)
      })
      .strict(),
    requestedBy: ActorSchema
  })
  .strict()

const SucceededProbeOutcomeSchema = z
  .object({
    status: z.literal('succeeded'),
    observations: z.array(JsonValueSchema).min(1).max(10_000),
    evidenceId: EvidenceIdSchema
  })
  .strict()
const NonSuccessProbeOutcomeSchema = z
  .object({
    status: z.enum(['denied', 'unavailable', 'error']),
    reason: ShortTextSchema
  })
  .strict()

export const ProbeResultV1Schema = z
  .object({
    ...missionRecordFields('probe-result', ProbeResultIdSchema),
    requestId: ProbeIdSchema,
    inputDigest: z.string().regex(/^[a-f0-9]{64}$/),
    outcome: z.discriminatedUnion('status', [
      SucceededProbeOutcomeSchema,
      NonSuccessProbeOutcomeSchema
    ]),
    startedAt: IsoDateTimeSchema,
    completedAt: IsoDateTimeSchema,
    executedBy: ActorSchema
  })
  .strict()
  .refine((result) => Date.parse(result.completedAt) >= Date.parse(result.startedAt), {
    message: 'completedAt must not precede startedAt',
    path: ['completedAt']
  })

export const AcceptedFindingV1Schema = z
  .object({
    ...missionRecordFields('accepted-finding', FindingIdSchema),
    revision: RevisionSchema,
    propositionId: PropositionIdSchema,
    assertionIds: uniqueIdArray(AssertionIdSchema, {
      min: 1,
      max: 1_000,
      label: 'assertionIds'
    }),
    evidenceIds: uniqueIdArray(EvidenceIdSchema, {
      min: 1,
      max: 1_000,
      label: 'evidenceIds'
    }),
    probeResultIds: uniqueIdArray(ProbeResultIdSchema, {
      max: 1_000,
      label: 'probeResultIds'
    }),
    scope: DomainScopeSchema,
    conclusion: NonEmptyTextSchema,
    limitations: z.array(ShortTextSchema).max(64),
    reversalConditions: z.array(ShortTextSchema).min(1).max(64),
    validFrom: IsoDateTimeSchema,
    supersedesFindingId: FindingIdSchema.nullable(),
    acceptedBy: ActorSchema
  })
  .strict()

export const ImpactReviewV1Schema = z
  .object({
    ...missionRecordFields('impact-review', ImpactReviewIdSchema),
    triggerEvidenceIds: uniqueIdArray(EvidenceIdSchema, {
      max: 1_000,
      label: 'triggerEvidenceIds'
    }),
    triggerFindingIds: uniqueIdArray(FindingIdSchema, {
      max: 1_000,
      label: 'triggerFindingIds'
    }),
    affectedRecordIds: z.array(z.string().min(1).max(128)).min(1).max(10_000),
    disposition: z.enum(['no-change', 'replan', 'reevaluate', 'quarantine']),
    rationale: NonEmptyTextSchema,
    reviewedBy: ActorSchema
  })
  .strict()
  .superRefine((review, context) => {
    if (review.triggerEvidenceIds.length === 0 && review.triggerFindingIds.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'Impact review requires an evidence or finding trigger',
        path: ['triggerEvidenceIds']
      })
    }
  })

export type EvidenceItemV1 = z.infer<typeof EvidenceItemV1Schema>
export type PropositionV1 = z.infer<typeof PropositionV1Schema>
export type AssertionV1 = z.infer<typeof AssertionV1Schema>
export type ContradictionSetV1 = z.infer<typeof ContradictionSetV1Schema>
export type GapV1 = z.infer<typeof GapV1Schema>
export type ProbeRequestV1 = z.infer<typeof ProbeRequestV1Schema>
export type ProbeResultV1 = z.infer<typeof ProbeResultV1Schema>
export type AcceptedFindingV1 = z.infer<typeof AcceptedFindingV1Schema>
export type ImpactReviewV1 = z.infer<typeof ImpactReviewV1Schema>
