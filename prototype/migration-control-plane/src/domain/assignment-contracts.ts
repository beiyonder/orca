import { z } from 'zod'
import {
  ActorSchema,
  ArtifactVersionIdSchema,
  AssignmentIdSchema,
  AssignmentResultIdSchema,
  AttemptIdSchema,
  BudgetSchema,
  ContextManifestIdSchema,
  ContractSchemaReferenceSchema,
  DataClassSchema,
  DomainScopeSchema,
  EvaluationAssignmentIdSchema,
  EvaluationContractIdSchema,
  EvidenceIdSchema,
  FenceSchema,
  GapIdSchema,
  IsoDateTimeSchema,
  ModelRouteSchema,
  PlanRevisionIdSchema,
  RevisionSchema,
  Sha256Schema,
  ShortTextSchema,
  SourceSpanSchema,
  TaskIdSchema,
  ToolReferenceSchema,
  UsageSchema,
  missionRecordFields,
  uniqueIdArray
} from './common-contracts.js'
import { TaskRecoveryPolicySchema } from './planning-contracts.js'

const IdleTaskStateSchema = z.object({ status: z.enum(['pending', 'runnable']) }).strict()

const ActiveTaskStateSchema = z
  .object({
    status: z.enum(['leased', 'running']),
    attemptId: AttemptIdSchema,
    fence: FenceSchema,
    leaseExpiresAt: IsoDateTimeSchema
  })
  .strict()

const EvaluatingTaskStateSchema = z
  .object({
    status: z.literal('evaluating'),
    attemptId: AttemptIdSchema,
    fence: FenceSchema,
    evaluationAssignmentIds: uniqueIdArray(EvaluationAssignmentIdSchema, {
      min: 1,
      max: 128,
      label: 'evaluationAssignmentIds'
    })
  })
  .strict()

const BlockedTaskStateSchema = z
  .object({
    status: z.literal('blocked'),
    gapIds: uniqueIdArray(GapIdSchema, { min: 1, max: 1_000, label: 'gapIds' })
  })
  .strict()

const QuarantinedTaskStateSchema = z
  .object({
    status: z.literal('quarantined'),
    reason: ShortTextSchema,
    quarantinedAt: IsoDateTimeSchema
  })
  .strict()

const TerminalTaskStateSchema = z
  .object({
    status: z.enum(['completed', 'failed', 'cancelled']),
    reason: ShortTextSchema,
    completedAt: IsoDateTimeSchema,
    acceptedAssignmentResultIds: uniqueIdArray(AssignmentResultIdSchema, {
      max: 1_000,
      label: 'acceptedAssignmentResultIds'
    }),
    acceptedArtifactVersionIds: uniqueIdArray(ArtifactVersionIdSchema, {
      max: 1_000,
      label: 'acceptedArtifactVersionIds'
    })
  })
  .strict()

export const TaskStateSchema = z.discriminatedUnion('status', [
  IdleTaskStateSchema,
  ActiveTaskStateSchema,
  EvaluatingTaskStateSchema,
  BlockedTaskStateSchema,
  QuarantinedTaskStateSchema,
  TerminalTaskStateSchema
])

export const TaskRecordV1Schema = z
  .object({
    ...missionRecordFields('task', TaskIdSchema),
    revision: RevisionSchema,
    planRevisionId: PlanRevisionIdSchema,
    title: ShortTextSchema,
    capability: z.string().min(1).max(128),
    dependencyTaskIds: uniqueIdArray(TaskIdSchema, {
      max: 1_000,
      label: 'dependencyTaskIds'
    }),
    proofObligations: z.array(ShortTextSchema).min(1).max(128),
    requiredEvaluationContractIds: uniqueIdArray(EvaluationContractIdSchema, {
      max: 128,
      label: 'requiredEvaluationContractIds'
    }),
    ownedScope: z.array(DomainScopeSchema).min(1).max(128),
    readScope: z.array(DomainScopeSchema).max(1_000),
    budget: BudgetSchema,
    recoveryPolicy: TaskRecoveryPolicySchema,
    state: TaskStateSchema
  })
  .strict()
  .superRefine((task, context) => {
    if (task.dependencyTaskIds.includes(task.id)) {
      context.addIssue({
        code: 'custom',
        message: 'Task cannot depend on itself',
        path: ['dependencyTaskIds']
      })
    }
    if (task.state.status === 'completed' && task.state.acceptedAssignmentResultIds.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'Completed task requires an accepted assignment result',
        path: ['state', 'acceptedAssignmentResultIds']
      })
    }
  })

export const ContextManifestItemSchema = z
  .object({
    itemId: z.string().min(1).max(128),
    evidenceId: EvidenceIdSchema,
    evidenceVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    evidenceDigest: Sha256Schema,
    span: SourceSpanSchema,
    sourceRole: z.string().min(1).max(128),
    dataClass: DataClassSchema,
    position: z.number().int().nonnegative().max(100_000),
    trust: z.enum(['direct', 'derived', 'unverified']),
    freshness: z.enum(['current', 'stale', 'unknown'])
  })
  .strict()

export const ContextManifestV1Schema = z
  .object({
    ...missionRecordFields('context-manifest', ContextManifestIdSchema),
    assignmentId: AssignmentIdSchema,
    attemptId: AttemptIdSchema,
    baseMissionRevision: RevisionSchema,
    role: z.string().min(1).max(128),
    strategyVersion: z.string().min(1).max(128),
    modelRoute: ModelRouteSchema,
    budget: BudgetSchema,
    items: z.array(ContextManifestItemSchema).max(10_000),
    excludedEvidence: z
      .array(z.object({ evidenceId: EvidenceIdSchema, reason: ShortTextSchema }).strict())
      .max(10_000),
    redactions: z
      .array(z.object({ itemId: z.string().min(1).max(128), reason: ShortTextSchema }).strict())
      .max(10_000),
    systemPromptDigest: Sha256Schema,
    toolSetDigest: Sha256Schema,
    outputSchemaDigest: Sha256Schema,
    renderedContextDigest: Sha256Schema,
    compiledBy: ActorSchema
  })
  .strict()
  .superRefine((manifest, context) => {
    const itemIds = manifest.items.map((item) => item.itemId)
    if (new Set(itemIds).size !== itemIds.length) {
      context.addIssue({
        code: 'custom',
        message: 'Context item IDs must be unique',
        path: ['items']
      })
    }
    if (manifest.items.some((item, index) => item.position !== index)) {
      context.addIssue({
        code: 'custom',
        message: 'Context item positions must be contiguous and match array order',
        path: ['items']
      })
    }
    const knownItems = new Set(itemIds)
    for (const [index, redaction] of manifest.redactions.entries()) {
      if (!knownItems.has(redaction.itemId)) {
        context.addIssue({
          code: 'custom',
          message: 'Redaction must reference a context item',
          path: ['redactions', index, 'itemId']
        })
      }
    }
  })

const AssignmentSpawnPolicySchema = z
  .object({
    enabled: z.boolean(),
    maxDepth: z.number().int().nonnegative().max(8),
    allowedRoles: z.array(z.string().min(1).max(128)).max(64)
  })
  .strict()
  .superRefine((policy, context) => {
    if (!policy.enabled && (policy.maxDepth !== 0 || policy.allowedRoles.length > 0)) {
      context.addIssue({
        code: 'custom',
        message: 'Disabled spawn policy must have zero depth and no roles'
      })
    }
  })

const ActiveAssignmentStateSchema = z
  .object({ status: z.enum(['created', 'dispatching', 'active', 'correcting']) })
  .strict()
const TerminalAssignmentStateSchema = z
  .object({
    status: z.enum(['completed', 'failed', 'cancelled', 'quarantined']),
    reason: ShortTextSchema,
    completedAt: IsoDateTimeSchema
  })
  .strict()

export const AssignmentRecordV1Schema = z
  .object({
    ...missionRecordFields('assignment', AssignmentIdSchema),
    revision: RevisionSchema,
    taskId: TaskIdSchema,
    role: z.string().min(1).max(128),
    contractVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    contextManifestId: ContextManifestIdSchema,
    tools: z.array(ToolReferenceSchema).max(128),
    outputSchema: ContractSchemaReferenceSchema.extend({ mode: z.literal('strict') }).strict(),
    modelRoute: ModelRouteSchema,
    budget: BudgetSchema,
    spawnPolicy: AssignmentSpawnPolicySchema,
    requiredEvaluationContractIds: uniqueIdArray(EvaluationContractIdSchema, {
      max: 128,
      label: 'requiredEvaluationContractIds'
    }),
    state: z.discriminatedUnion('status', [
      ActiveAssignmentStateSchema,
      TerminalAssignmentStateSchema
    ]),
    assignedBy: ActorSchema
  })
  .strict()

export const WorkerInvocationSchema = z
  .object({
    runtime: z.enum(['omp-rpc', 'deterministic-runner', 'external-evaluator']),
    runtimeVersion: z.string().min(1).max(128),
    protocolVersion: z.string().min(1).max(128),
    processIncarnation: z.string().min(1).max(256),
    sessionRef: z.string().min(1).max(4_096).nullable()
  })
  .strict()

const ClaimedAttemptStateSchema = z
  .object({
    status: z.enum(['claimed', 'running']),
    leaseExpiresAt: IsoDateTimeSchema
  })
  .strict()
const ResultAttemptStateSchema = z
  .object({
    status: z.literal('result-submitted'),
    resultId: AssignmentResultIdSchema,
    submittedAt: IsoDateTimeSchema
  })
  .strict()
const EvaluatingAttemptStateSchema = z
  .object({
    status: z.literal('evaluating'),
    resultId: AssignmentResultIdSchema,
    evaluationAssignmentIds: uniqueIdArray(EvaluationAssignmentIdSchema, {
      min: 1,
      max: 128,
      label: 'evaluationAssignmentIds'
    })
  })
  .strict()
const TerminalAttemptStateSchema = z
  .object({
    status: z.enum(['succeeded', 'failed', 'cancelled', 'stale']),
    reason: ShortTextSchema,
    completedAt: IsoDateTimeSchema
  })
  .strict()

export const AssignmentAttemptV1Schema = z
  .object({
    ...missionRecordFields('assignment-attempt', AttemptIdSchema),
    assignmentId: AssignmentIdSchema,
    attemptNumber: z.number().int().positive().max(100),
    fence: FenceSchema,
    worker: WorkerInvocationSchema,
    contextManifestId: ContextManifestIdSchema,
    state: z.discriminatedUnion('status', [
      ClaimedAttemptStateSchema,
      ResultAttemptStateSchema,
      EvaluatingAttemptStateSchema,
      TerminalAttemptStateSchema
    ]),
    startedAt: IsoDateTimeSchema
  })
  .strict()
  .superRefine((attempt, context) => {
    if (Date.parse(attempt.startedAt) < Date.parse(attempt.createdAt)) {
      context.addIssue({
        code: 'custom',
        message: 'Attempt cannot start before creation',
        path: ['startedAt']
      })
    }
    if (
      'leaseExpiresAt' in attempt.state &&
      Date.parse(attempt.state.leaseExpiresAt) <= Date.parse(attempt.startedAt)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Attempt lease must expire after start',
        path: ['state', 'leaseExpiresAt']
      })
    }
    if (
      'submittedAt' in attempt.state &&
      Date.parse(attempt.state.submittedAt) < Date.parse(attempt.startedAt)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Attempt result cannot precede start',
        path: ['state', 'submittedAt']
      })
    }
    if (
      'completedAt' in attempt.state &&
      Date.parse(attempt.state.completedAt) < Date.parse(attempt.startedAt)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Attempt completion cannot precede start',
        path: ['state', 'completedAt']
      })
    }
  })

const SucceededAssignmentOutcomeSchema = z
  .object({
    status: z.literal('succeeded'),
    artifactVersionIds: uniqueIdArray(ArtifactVersionIdSchema, {
      max: 1_000,
      label: 'artifactVersionIds'
    }),
    evidenceIds: uniqueIdArray(EvidenceIdSchema, { max: 1_000, label: 'evidenceIds' }),
    gapIds: uniqueIdArray(GapIdSchema, { max: 1_000, label: 'gapIds' }),
    planRevisionIds: uniqueIdArray(PlanRevisionIdSchema, {
      max: 128,
      label: 'planRevisionIds'
    })
  })
  .strict()
const FailedAssignmentOutcomeSchema = z
  .object({
    status: z.literal('failed'),
    errorCode: z.string().min(1).max(128),
    message: ShortTextSchema,
    retryable: z.boolean()
  })
  .strict()

export const AssignmentResultV1Schema = z
  .object({
    ...missionRecordFields('assignment-result', AssignmentResultIdSchema),
    assignmentId: AssignmentIdSchema,
    attemptId: AttemptIdSchema,
    fence: FenceSchema,
    outputDigest: Sha256Schema,
    outcome: z.discriminatedUnion('status', [
      SucceededAssignmentOutcomeSchema,
      FailedAssignmentOutcomeSchema
    ]),
    usage: UsageSchema,
    limitations: z.array(ShortTextSchema).max(64),
    submittedAt: IsoDateTimeSchema,
    submittedBy: ActorSchema
  })
  .strict()

export type TaskRecordV1 = z.infer<typeof TaskRecordV1Schema>
export type ContextManifestV1 = z.infer<typeof ContextManifestV1Schema>
export type AssignmentRecordV1 = z.infer<typeof AssignmentRecordV1Schema>
export type AssignmentAttemptV1 = z.infer<typeof AssignmentAttemptV1Schema>
export type AssignmentResultV1 = z.infer<typeof AssignmentResultV1Schema>
