import { z } from 'zod'
import { canonicalJson, sha256Text } from './canonical-json.js'
import {
  EvidenceIdSchema,
  IsoDateTimeSchema,
  MissionIdSchema,
  ProbeIdSchema,
  Sha256Schema,
  ShortTextSchema,
  TenantIdSchema,
  uniqueIdArray
} from './domain/common-contracts.js'
import { SpecialistResultSchema } from './specialist-agent-contracts.js'

const MissionRevisionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const ProbeCandidateSchema = z.strictObject({
  probeId: ProbeIdSchema,
  probeKey: z.string().min(1).max(256),
  question: ShortTextSchema,
  predictedOutcomes: z.strictObject({
    supports: z.string().min(1).max(512),
    refutes: z.string().min(1).max(512)
  }),
  basisEvidenceIds: uniqueIdArray(EvidenceIdSchema, {
    min: 1,
    max: 1_000,
    label: 'basisEvidenceIds'
  }),
  authority: z.literal('read-only'),
  sideEffect: z.literal('none'),
  deterministic: z.boolean(),
  costUsd: z.number().nonnegative().max(1_000_000),
  timeLimitMs: z.number().int().positive().max(86_400_000),
  rowLimit: z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
})

export const SpecialistDisagreementInputSchema = z.strictObject({
  schemaVersion: z.literal(1),
  tenantId: TenantIdSchema,
  missionId: MissionIdSchema,
  missionRevision: MissionRevisionSchema,
  propositionKey: z.string().min(1).max(512),
  results: z.array(SpecialistResultSchema).min(2).max(32),
  probeCandidates: z.array(ProbeCandidateSchema).max(128),
  remainingProbeBudget: z.strictObject({
    costUsd: z.number().nonnegative().max(1_000_000),
    timeLimitMs: z.number().int().positive().max(86_400_000),
    rowLimit: z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
  })
})

const ResultReferenceSchema = z.strictObject({
  assignmentId: z.string().min(1).max(128),
  attemptId: z.string().min(1).max(128),
  fence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  stance: z.enum(['supports', 'refutes', 'uncertain'])
})
const ProbeResolutionSchema = z.strictObject({
  status: z.literal('probe-requested'),
  probe: ProbeCandidateSchema,
  reason: ShortTextSchema
})
const TieResolutionSchema = z.strictObject({
  status: z.literal('unresolved-tie'),
  reason: ShortTextSchema,
  missingDiscriminator: ShortTextSchema
})
const SpecialistDisagreementResolutionBodySchema = z.strictObject({
  schemaVersion: z.literal(1),
  type: z.literal('specialist_disagreement_resolution'),
  tenantId: TenantIdSchema,
  missionId: MissionIdSchema,
  baseMissionRevision: MissionRevisionSchema,
  propositionKey: z.string().min(1).max(512),
  contradiction: z.strictObject({
    resultRefs: z.array(ResultReferenceSchema).min(2).max(32),
    preservedStances: z
      .array(z.enum(['supports', 'refutes', 'uncertain']))
      .min(2)
      .max(3)
  }),
  gap: z.strictObject({
    key: z.string().min(1).max(256),
    question: ShortTextSchema,
    severity: z.literal('blocker')
  }),
  evidenceIds: uniqueIdArray(EvidenceIdSchema, { min: 1, max: 1_000, label: 'evidenceIds' }),
  resolution: z.discriminatedUnion('status', [ProbeResolutionSchema, TieResolutionSchema]),
  authority: z.literal('proposal-only'),
  createdAt: IsoDateTimeSchema
})
export const SpecialistDisagreementResolutionSchema =
  SpecialistDisagreementResolutionBodySchema.extend({ resolutionDigest: Sha256Schema })
export type SpecialistDisagreementResolution = z.infer<
  typeof SpecialistDisagreementResolutionSchema
>

export class SpecialistDisagreementError extends Error {
  readonly code: string
  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SpecialistDisagreementError'
    this.code = code
  }
}

function failure(code: string, message: string, cause?: unknown): SpecialistDisagreementError {
  return new SpecialistDisagreementError(code, message, cause === undefined ? undefined : { cause })
}

function compareProbe(
  left: z.infer<typeof ProbeCandidateSchema>,
  right: z.infer<typeof ProbeCandidateSchema>
): number {
  return (
    left.costUsd - right.costUsd ||
    left.timeLimitMs - right.timeLimitMs ||
    left.rowLimit - right.rowLimit ||
    left.probeId.localeCompare(right.probeId)
  )
}

export function resolveSpecialistDisagreement(
  inputValue: unknown,
  createdAt: string
): SpecialistDisagreementResolution {
  let input: z.infer<typeof SpecialistDisagreementInputSchema>
  try {
    input = SpecialistDisagreementInputSchema.parse(inputValue)
  } catch (error) {
    throw failure('invalid_disagreement_input', 'Specialist disagreement input is invalid', error)
  }
  const resultIdentity = new Set<string>()
  const resultRefs: z.infer<typeof ResultReferenceSchema>[] = []
  const evidenceIds = new Set<z.infer<typeof EvidenceIdSchema>>()
  for (const result of input.results) {
    if (
      result.tenantId !== input.tenantId ||
      result.missionId !== input.missionId ||
      result.missionRevision !== input.missionRevision
    ) {
      throw failure(
        'result_binding_mismatch',
        'Specialist result is not bound to this mission state'
      )
    }
    const identity = `${result.assignmentId}:${result.attemptId}:${result.fence}`
    if (resultIdentity.has(identity)) {
      throw failure('duplicate_result', 'Specialist result identity is duplicated')
    }
    resultIdentity.add(identity)
    if (result.outcome.status !== 'yielded') {
      throw failure('non_yielded_result', 'Disagreement requires yielded specialist results')
    }
    const claims = result.outcome.claims.filter(
      (claim) => claim.propositionKey === input.propositionKey
    )
    if (claims.length !== 1) {
      throw failure(
        'claim_cardinality',
        'Each result must make exactly one claim on the proposition'
      )
    }
    const claim = claims[0]!
    resultRefs.push({
      assignmentId: result.assignmentId,
      attemptId: result.attemptId,
      fence: result.fence,
      stance: claim.stance
    })
    for (const citation of claim.citations) {
      evidenceIds.add(citation.evidenceId)
    }
  }
  const stances = new Set(resultRefs.map((reference) => reference.stance))
  if (!stances.has('supports') || !stances.has('refutes')) {
    throw failure(
      'no_material_disagreement',
      'Results do not contain incompatible support and refutation'
    )
  }
  const admissibleEvidence = new Set<string>(evidenceIds)
  const budget = input.remainingProbeBudget
  const probe = input.probeCandidates
    .filter(
      (candidate) =>
        candidate.deterministic &&
        candidate.predictedOutcomes.supports !== candidate.predictedOutcomes.refutes &&
        candidate.basisEvidenceIds.every((evidenceId) => admissibleEvidence.has(evidenceId)) &&
        candidate.costUsd <= budget.costUsd &&
        candidate.timeLimitMs <= budget.timeLimitMs &&
        candidate.rowLimit <= budget.rowLimit
    )
    .toSorted(compareProbe)[0]
  const resolution =
    probe === undefined
      ? {
          status: 'unresolved-tie' as const,
          reason: 'No admissible bounded probe distinguishes the supported alternatives.',
          missingDiscriminator:
            'Provide a read-only probe with distinct predicted outcomes and cited basis.'
        }
      : {
          status: 'probe-requested' as const,
          probe,
          reason: 'The lowest-cost admissible probe distinguishes support from refutation.'
        }
  const body = SpecialistDisagreementResolutionBodySchema.parse({
    schemaVersion: 1,
    type: 'specialist_disagreement_resolution',
    tenantId: input.tenantId,
    missionId: input.missionId,
    baseMissionRevision: input.missionRevision,
    propositionKey: input.propositionKey,
    contradiction: {
      resultRefs: resultRefs.toSorted((left, right) =>
        `${left.assignmentId}:${left.attemptId}`.localeCompare(
          `${right.assignmentId}:${right.attemptId}`
        )
      ),
      preservedStances: [...stances].toSorted()
    },
    gap: {
      key: `disagreement:${sha256Text(input.propositionKey).slice(0, 16)}`,
      question: `Which competing claim about ${input.propositionKey} is supported?`,
      severity: 'blocker'
    },
    evidenceIds: [...evidenceIds].toSorted(),
    resolution,
    authority: 'proposal-only',
    createdAt
  })
  return SpecialistDisagreementResolutionSchema.parse({
    ...body,
    resolutionDigest: sha256Text(canonicalJson(body))
  })
}
