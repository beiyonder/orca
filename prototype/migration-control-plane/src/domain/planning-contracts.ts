import { z } from 'zod'
import {
  ActorSchema,
  AssertionIdSchema,
  DecisionIdSchema,
  EvidenceIdSchema,
  FindingIdSchema,
  GapIdSchema,
  IsoDateTimeSchema,
  NonEmptyTextSchema,
  PlanRevisionIdSchema,
  ProbeResultIdSchema,
  RevisionSchema,
  ShortTextSchema,
  TaskIdSchema,
  missionRecordFields,
  uniqueIdArray
} from './common-contracts.js'

export const DecisionOptionSchema = z
  .object({
    id: z.string().min(1).max(128),
    label: ShortTextSchema,
    description: NonEmptyTextSchema,
    tradeoffs: z.array(ShortTextSchema).max(64)
  })
  .strict()

export const DecisionRecordV1Schema = z
  .object({
    ...missionRecordFields('decision-record', DecisionIdSchema),
    revision: RevisionSchema,
    baseMissionRevision: RevisionSchema,
    question: NonEmptyTextSchema,
    options: z.array(DecisionOptionSchema).min(2).max(64),
    selectedOptionId: z.string().min(1).max(128),
    evidenceIds: uniqueIdArray(EvidenceIdSchema, {
      min: 1,
      max: 1_000,
      label: 'evidenceIds'
    }),
    assertionIds: uniqueIdArray(AssertionIdSchema, {
      max: 1_000,
      label: 'assertionIds'
    }),
    findingIds: uniqueIdArray(FindingIdSchema, {
      max: 1_000,
      label: 'findingIds'
    }),
    probeResultIds: uniqueIdArray(ProbeResultIdSchema, {
      max: 1_000,
      label: 'probeResultIds'
    }),
    assumptions: z.array(ShortTextSchema).max(64),
    impactRecordIds: z.array(z.string().min(1).max(128)).max(10_000),
    reversalConditions: z.array(ShortTextSchema).min(1).max(64),
    rationale: NonEmptyTextSchema,
    decidedBy: ActorSchema
  })
  .strict()
  .superRefine((decision, context) => {
    const optionIds = decision.options.map((option) => option.id)
    if (new Set(optionIds).size !== optionIds.length) {
      context.addIssue({
        code: 'custom',
        message: 'Decision option IDs must be unique',
        path: ['options']
      })
    }
    if (!optionIds.includes(decision.selectedOptionId)) {
      context.addIssue({
        code: 'custom',
        message: 'selectedOptionId must reference one decision option',
        path: ['selectedOptionId']
      })
    }
  })

export const TaskRecoveryPolicySchema = z
  .object({
    onWorkerLoss: z.enum(['retry', 'reconstruct', 'quarantine', 'fail']),
    onStaleResult: z.literal('reject-authority-retain-evidence'),
    maxAttempts: z.number().int().positive().max(100),
    requiresEvaluation: z.boolean()
  })
  .strict()

const AddTaskOperationSchema = z
  .object({
    operation: z.literal('add-task'),
    taskId: TaskIdSchema,
    title: ShortTextSchema,
    capability: z.string().min(1).max(128),
    dependencyTaskIds: uniqueIdArray(TaskIdSchema, {
      max: 1_000,
      label: 'dependencyTaskIds'
    }),
    proofObligations: z.array(ShortTextSchema).min(1).max(128),
    recoveryPolicy: TaskRecoveryPolicySchema
  })
  .strict()

const SplitTaskOperationSchema = z
  .object({
    operation: z.literal('split-task'),
    taskId: TaskIdSchema,
    childTaskIds: uniqueIdArray(TaskIdSchema, {
      min: 2,
      max: 128,
      label: 'childTaskIds'
    })
  })
  .strict()
  .refine((operation) => !operation.childTaskIds.includes(operation.taskId), {
    message: 'A split task cannot be its own child',
    path: ['childTaskIds']
  })

const MergeTasksOperationSchema = z
  .object({
    operation: z.literal('merge-tasks'),
    sourceTaskIds: uniqueIdArray(TaskIdSchema, {
      min: 2,
      max: 128,
      label: 'sourceTaskIds'
    }),
    targetTaskId: TaskIdSchema
  })
  .strict()
  .refine((operation) => !operation.sourceTaskIds.includes(operation.targetTaskId), {
    message: 'Merge target cannot also be a source',
    path: ['targetTaskId']
  })

const AddDependencyOperationSchema = z
  .object({
    operation: z.literal('add-dependency'),
    taskId: TaskIdSchema,
    dependencyTaskId: TaskIdSchema
  })
  .strict()
  .refine((operation) => operation.taskId !== operation.dependencyTaskId, {
    message: 'Task cannot depend on itself',
    path: ['dependencyTaskId']
  })

const BlockTaskOperationSchema = z
  .object({
    operation: z.literal('block-task'),
    taskId: TaskIdSchema,
    gapIds: uniqueIdArray(GapIdSchema, { min: 1, max: 1_000, label: 'gapIds' })
  })
  .strict()

const UnblockTaskOperationSchema = z
  .object({
    operation: z.literal('unblock-task'),
    taskId: TaskIdSchema,
    resolvedGapIds: uniqueIdArray(GapIdSchema, {
      min: 1,
      max: 1_000,
      label: 'resolvedGapIds'
    })
  })
  .strict()

const CancelTaskOperationSchema = z
  .object({ operation: z.literal('cancel-task'), taskId: TaskIdSchema, reason: ShortTextSchema })
  .strict()

const QuarantineTaskOperationSchema = z
  .object({
    operation: z.literal('quarantine-task'),
    taskId: TaskIdSchema,
    reason: ShortTextSchema
  })
  .strict()

const SupersedeTaskOperationSchema = z
  .object({
    operation: z.literal('supersede-task'),
    taskId: TaskIdSchema,
    replacementTaskIds: uniqueIdArray(TaskIdSchema, {
      min: 1,
      max: 128,
      label: 'replacementTaskIds'
    })
  })
  .strict()
  .refine((operation) => !operation.replacementTaskIds.includes(operation.taskId), {
    message: 'A superseded task cannot replace itself',
    path: ['replacementTaskIds']
  })

export const PlanOperationSchema = z.discriminatedUnion('operation', [
  AddTaskOperationSchema,
  SplitTaskOperationSchema,
  MergeTasksOperationSchema,
  AddDependencyOperationSchema,
  BlockTaskOperationSchema,
  UnblockTaskOperationSchema,
  CancelTaskOperationSchema,
  QuarantineTaskOperationSchema,
  SupersedeTaskOperationSchema
])

export const PlanRevisionV1Schema = z
  .object({
    ...missionRecordFields('plan-revision', PlanRevisionIdSchema),
    revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    basePlanRevisionId: PlanRevisionIdSchema.nullable(),
    baseMissionRevision: RevisionSchema,
    operations: z.array(PlanOperationSchema).min(1).max(1_000),
    decisionIds: uniqueIdArray(DecisionIdSchema, {
      max: 1_000,
      label: 'decisionIds'
    }),
    evidenceIds: uniqueIdArray(EvidenceIdSchema, {
      max: 1_000,
      label: 'evidenceIds'
    }),
    findingIds: uniqueIdArray(FindingIdSchema, {
      max: 1_000,
      label: 'findingIds'
    }),
    rationale: NonEmptyTextSchema,
    createdBy: ActorSchema,
    committedAt: IsoDateTimeSchema
  })
  .strict()
  .superRefine((plan, context) => {
    if (plan.revision === 1 && plan.basePlanRevisionId !== null) {
      context.addIssue({
        code: 'custom',
        message: 'First plan revision cannot have a base plan revision',
        path: ['basePlanRevisionId']
      })
    }
    if (plan.revision > 1 && plan.basePlanRevisionId === null) {
      context.addIssue({
        code: 'custom',
        message: 'Later plan revisions require a base plan revision',
        path: ['basePlanRevisionId']
      })
    }
  })

export type DecisionRecordV1 = z.infer<typeof DecisionRecordV1Schema>
export type PlanOperation = z.infer<typeof PlanOperationSchema>
export type PlanRevisionV1 = z.infer<typeof PlanRevisionV1Schema>
