import { z } from 'zod'
import {
  AssignmentIdSchema,
  AttemptIdSchema,
  BudgetSchema,
  ContextManifestIdSchema,
  ContractSchemaReferenceSchema,
  DataClassSchema,
  DomainScopeSchema,
  EvidenceIdSchema,
  FenceSchema,
  IsoDateTimeSchema,
  MissionIdSchema,
  PlanRevisionIdSchema,
  Sha256Schema,
  ShortTextSchema,
  SourceSpanSchema,
  TenantIdSchema,
  ToolReferenceSchema,
  uniqueIdArray
} from './domain/common-contracts.js'

export const SpecialistRoleSchema = z.enum([
  'source-forensics',
  'platform-architecture',
  'cdc',
  'mapping',
  'research',
  'security',
  'build',
  'evaluation',
  'recovery'
])
export type SpecialistRole = z.infer<typeof SpecialistRoleSchema>

export const AUTHORITY_EXCLUSIONS = [
  'mission-state-mutation',
  'assignment-dispatch',
  'effect-execution',
  'self-acceptance',
  'policy-mutation'
] as const
const AuthorityExclusionSchema = z.enum(AUTHORITY_EXCLUSIONS)

const StringListSchema = z.array(z.string().min(1).max(256)).min(1).max(128)
const SpecialistBriefSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('source-forensics'),
    sourceSystems: StringListSchema,
    questions: StringListSchema
  }),
  z.strictObject({
    kind: z.literal('platform-architecture'),
    candidatePlatforms: StringListSchema,
    constraints: StringListSchema
  }),
  z.strictObject({
    kind: z.literal('cdc'),
    streams: StringListSchema,
    requiredSemantics: StringListSchema
  }),
  z.strictObject({
    kind: z.literal('mapping'),
    sourceEntities: StringListSchema,
    targetEntities: StringListSchema,
    invariants: StringListSchema
  }),
  z.strictObject({
    kind: z.literal('research'),
    questions: StringListSchema,
    allowedSourceClasses: StringListSchema
  }),
  z.strictObject({
    kind: z.literal('security'),
    assets: StringListSchema,
    trustBoundaries: StringListSchema
  }),
  z.strictObject({
    kind: z.literal('build'),
    artifactKinds: StringListSchema,
    buildTargets: StringListSchema
  }),
  z.strictObject({
    kind: z.literal('evaluation'),
    subjectRefs: StringListSchema,
    measureNames: StringListSchema
  }),
  z.strictObject({
    kind: z.literal('recovery'),
    failureRefs: StringListSchema,
    recoveryObjectives: StringListSchema
  })
])

export const SpecialistAssignmentSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    type: z.literal('specialist_assignment'),
    tenantId: TenantIdSchema,
    missionId: MissionIdSchema,
    missionRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    planRevisionId: PlanRevisionIdSchema,
    assignmentId: AssignmentIdSchema,
    parentApexAssignmentId: AssignmentIdSchema,
    role: SpecialistRoleSchema,
    contractVersion: z.literal(1),
    goal: z.string().min(1).max(32_768),
    brief: SpecialistBriefSchema,
    ownedScope: z.array(DomainScopeSchema).min(1).max(128),
    readScope: z.array(DomainScopeSchema).max(128),
    dataClasses: z.array(DataClassSchema).min(1).max(6),
    contextManifestId: ContextManifestIdSchema,
    allowedTools: z.array(ToolReferenceSchema).max(16),
    budget: BudgetSchema,
    outputSchema: ContractSchemaReferenceSchema,
    evaluatorContractIds: z.array(z.string().min(1).max(128)).max(64),
    authority: z.strictObject({
      mode: z.literal('proposal-only'),
      exclusions: z.array(AuthorityExclusionSchema).length(AUTHORITY_EXCLUSIONS.length)
    }),
    expiresAt: IsoDateTimeSchema
  })
  .superRefine((assignment, context) => {
    if (assignment.role !== assignment.brief.kind) {
      context.addIssue({
        code: 'custom',
        message: 'Role must match the typed brief',
        path: ['brief', 'kind']
      })
    }
  })

const CitationSchema = z.strictObject({
  itemId: z.string().min(1).max(128),
  evidenceId: EvidenceIdSchema,
  evidenceVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  evidenceDigest: Sha256Schema,
  span: SourceSpanSchema
})
const ClaimSchema = z.strictObject({
  propositionKey: z.string().min(1).max(512),
  stance: z.enum(['supports', 'refutes', 'uncertain']),
  statement: z.string().min(1).max(32_768),
  citations: z.array(CitationSchema).min(1).max(128),
  limitations: z.array(ShortTextSchema).max(64)
})
const RoleOutputSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('source-forensics'), inventoryFindings: StringListSchema }),
  z.strictObject({
    kind: z.literal('platform-architecture'),
    architectureOptions: StringListSchema
  }),
  z.strictObject({ kind: z.literal('cdc'), semanticFindings: StringListSchema }),
  z.strictObject({ kind: z.literal('mapping'), mappingProposals: StringListSchema }),
  z.strictObject({ kind: z.literal('research'), sourcedFindings: StringListSchema }),
  z.strictObject({ kind: z.literal('security'), riskFindings: StringListSchema }),
  z.strictObject({ kind: z.literal('build'), buildOutputs: StringListSchema }),
  z.strictObject({ kind: z.literal('evaluation'), measureResults: StringListSchema }),
  z.strictObject({ kind: z.literal('recovery'), recoveryOptions: StringListSchema })
])
const YieldedOutcomeSchema = z.strictObject({
  status: z.literal('yielded'),
  roleOutput: RoleOutputSchema,
  claims: z.array(ClaimSchema).max(256),
  evidenceIds: uniqueIdArray(EvidenceIdSchema, { min: 1, max: 1_000, label: 'evidenceIds' }),
  artifactRefs: z.array(z.string().min(1).max(128)).max(1_000),
  gapProposals: z
    .array(
      z.strictObject({
        key: z.string().min(1).max(256),
        question: ShortTextSchema,
        severity: z.enum(['low', 'medium', 'high', 'blocker'])
      })
    )
    .max(128),
  proposedFollowups: z.array(ShortTextSchema).max(128)
})
const AbstainedOutcomeSchema = z.strictObject({
  status: z.literal('abstained'),
  reason: ShortTextSchema,
  missingEvidence: StringListSchema,
  evidenceIds: uniqueIdArray(EvidenceIdSchema, { max: 1_000, label: 'evidenceIds' })
})
const FailedOutcomeSchema = z.strictObject({
  status: z.literal('failed'),
  errorCode: z.string().min(1).max(128),
  message: ShortTextSchema,
  retryable: z.boolean()
})

export const SpecialistResultSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    type: z.literal('specialist_result'),
    tenantId: TenantIdSchema,
    missionId: MissionIdSchema,
    missionRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    planRevisionId: PlanRevisionIdSchema,
    assignmentId: AssignmentIdSchema,
    attemptId: AttemptIdSchema,
    fence: FenceSchema,
    role: SpecialistRoleSchema,
    contractVersion: z.literal(1),
    contextManifestId: ContextManifestIdSchema,
    outcome: z.discriminatedUnion('status', [
      YieldedOutcomeSchema,
      AbstainedOutcomeSchema,
      FailedOutcomeSchema
    ]),
    submittedAt: IsoDateTimeSchema
  })
  .superRefine((result, context) => {
    if (result.outcome.status === 'yielded' && result.role !== result.outcome.roleOutput.kind) {
      context.addIssue({
        code: 'custom',
        message: 'Role must match the typed result output',
        path: ['outcome', 'roleOutput', 'kind']
      })
    }
    if (result.outcome.status === 'yielded') {
      const evidenceIds = new Set(result.outcome.evidenceIds)
      for (const [claimIndex, claim] of result.outcome.claims.entries()) {
        for (const [citationIndex, citation] of claim.citations.entries()) {
          if (!evidenceIds.has(citation.evidenceId)) {
            context.addIssue({
              code: 'custom',
              message: 'Claim citation must be present in result evidenceIds',
              path: ['outcome', 'claims', claimIndex, 'citations', citationIndex, 'evidenceId']
            })
          }
        }
      }
    }
  })

export type SpecialistAssignment = z.infer<typeof SpecialistAssignmentSchema>
export type SpecialistResult = z.infer<typeof SpecialistResultSchema>
