import { canonicalJson } from '../canonical-json.js'
import { z } from 'zod'
import {
  ActorSchema,
  EvaluationAssignmentIdSchema,
  EvaluationCoordinationIdSchema,
  EvaluationResultIdSchema,
  IsoDateTimeSchema,
  MissionIdSchema,
  PositiveVersionSchema,
  Sha256Schema,
  ShortTextSchema,
  TenantIdSchema
} from './common-contracts.js'
import { EvaluationSubjectReferenceV2Schema } from './evaluation-assignment-contracts-v2.js'
import {
  EvaluationContractReferenceV2Schema,
  EvaluatorDefinitionReferenceV2Schema
} from './evaluation-definition-contracts-v2.js'

const CoordinationPredecessorSchema = z.strictObject({
  id: EvaluationCoordinationIdSchema,
  version: PositiveVersionSchema,
  digest: Sha256Schema
})

const EvaluationResultStatusSchema = z.enum([
  'passed',
  'failed',
  'partial',
  'unavailable',
  'contradictory',
  'error',
  'stale'
])

const CoordinationResultReferenceSchema = z.strictObject({
  id: EvaluationResultIdSchema,
  status: EvaluationResultStatusSchema,
  digest: Sha256Schema
})

export const EvaluationCoordinationEntrySchema = z
  .strictObject({
    evaluatorDefinition: EvaluatorDefinitionReferenceV2Schema,
    assignmentId: EvaluationAssignmentIdSchema,
    assignmentDigest: Sha256Schema,
    dispatchMessageId: z
      .string()
      .min(1)
      .max(256)
      .regex(/^[a-z0-9][a-z0-9._-]*$/),
    disposition: z.enum([
      'assigned',
      'missing',
      'passed',
      'failed',
      'partial',
      'unavailable',
      'contradictory',
      'error',
      'stale'
    ]),
    result: CoordinationResultReferenceSchema.nullable(),
    reason: ShortTextSchema.nullable()
  })
  .superRefine((entry, context) => {
    if (entry.result === null) {
      if (!['assigned', 'missing'].includes(entry.disposition)) {
        context.addIssue({
          code: 'custom',
          message: 'Result-free entry must be assigned or missing'
        })
      }
      return
    }
    if (entry.disposition !== entry.result.status) {
      context.addIssue({ code: 'custom', message: 'Result status and disposition must agree' })
    }
    if (entry.disposition === 'passed' && entry.reason !== null) {
      context.addIssue({
        code: 'custom',
        message: 'Passing coordination entry has no failure reason'
      })
    }
  })

export const EvaluationCoordinationUnresolvedReasonSchema = z.enum([
  'missing-result',
  'evaluator-unavailable',
  'evaluator-contradiction',
  'partial-result',
  'evaluator-error',
  'stale-result',
  'evaluator-disagreement'
])

export type EvaluationCoordinationOutcome =
  | 'pending'
  | 'unresolved'
  | 'failed'
  | 'ready-for-reconciliation'

export function evaluationCoordinationUnresolvedReasons(
  entries: readonly z.infer<typeof EvaluationCoordinationEntrySchema>[]
): z.infer<typeof EvaluationCoordinationUnresolvedReasonSchema>[] {
  const dispositions = new Set(entries.map((entry) => entry.disposition))
  const reasons: z.infer<typeof EvaluationCoordinationUnresolvedReasonSchema>[] = []
  if (dispositions.has('missing')) {
    reasons.push('missing-result')
  }
  if (dispositions.has('unavailable')) {
    reasons.push('evaluator-unavailable')
  }
  if (dispositions.has('contradictory')) {
    reasons.push('evaluator-contradiction')
  }
  if (dispositions.has('partial')) {
    reasons.push('partial-result')
  }
  if (dispositions.has('error')) {
    reasons.push('evaluator-error')
  }
  if (dispositions.has('stale')) {
    reasons.push('stale-result')
  }
  if (dispositions.has('passed') && dispositions.has('failed')) {
    reasons.push('evaluator-disagreement')
  }
  return reasons
}

export function evaluationCoordinationOutcome(
  entries: readonly z.infer<typeof EvaluationCoordinationEntrySchema>[]
): EvaluationCoordinationOutcome {
  const dispositions = new Set(entries.map((entry) => entry.disposition))
  if (evaluationCoordinationUnresolvedReasons(entries).length > 0) {
    return 'unresolved'
  }
  if (dispositions.has('assigned')) {
    return 'pending'
  }
  if (dispositions.has('failed')) {
    return 'failed'
  }
  return 'ready-for-reconciliation'
}

export const EvaluationCoordinationV1Schema = z
  .strictObject({
    schemaVersion: z.literal(1),
    kind: z.literal('evaluation-coordination'),
    id: EvaluationCoordinationIdSchema,
    tenantId: TenantIdSchema,
    missionId: MissionIdSchema,
    createdAt: IsoDateTimeSchema,
    coordinationKey: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[a-z0-9][a-z0-9_-]*$/),
    version: PositiveVersionSchema,
    predecessor: CoordinationPredecessorSchema.nullable(),
    contract: EvaluationContractReferenceV2Schema,
    subject: EvaluationSubjectReferenceV2Schema,
    resultDeadlineAt: IsoDateTimeSchema,
    entries: z.array(EvaluationCoordinationEntrySchema).min(1).max(64),
    outcome: z.enum(['pending', 'unresolved', 'failed', 'ready-for-reconciliation']),
    unresolvedReasons: z.array(EvaluationCoordinationUnresolvedReasonSchema).max(7),
    acceptanceDisposition: z.enum(['unaccepted', 'eligible-for-reconciliation']),
    unrelatedWorkDisposition: z.literal('continue'),
    observedAt: IsoDateTimeSchema,
    createdBy: ActorSchema,
    limitations: z.array(ShortTextSchema).max(64),
    acceptanceAuthority: z.literal('none')
  })
  .superRefine((coordination, context) => {
    if ((coordination.version === 1) !== (coordination.predecessor === null)) {
      context.addIssue({
        code: 'custom',
        message: 'Only the first coordination version may omit a predecessor'
      })
    }
    if (
      coordination.predecessor !== null &&
      coordination.predecessor.version !== coordination.version - 1
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Coordination predecessor must be the immediately prior version'
      })
    }
    const evaluatorKeys = coordination.entries.map(
      (entry) => `${entry.evaluatorDefinition.id}\u0000${entry.evaluatorDefinition.version}`
    )
    const assignmentIds = coordination.entries.map((entry) => entry.assignmentId)
    const messageIds = coordination.entries.map((entry) => entry.dispatchMessageId)
    if (
      new Set(evaluatorKeys).size !== evaluatorKeys.length ||
      new Set(assignmentIds).size !== assignmentIds.length ||
      new Set(messageIds).size !== messageIds.length
    ) {
      context.addIssue({ code: 'custom', message: 'Coordination entries must be unique' })
    }
    const outcome = evaluationCoordinationOutcome(coordination.entries)
    if (coordination.outcome !== outcome) {
      context.addIssue({ code: 'custom', message: 'Coordination outcome disagrees with entries' })
    }
    const unresolvedReasons = evaluationCoordinationUnresolvedReasons(coordination.entries)
    if (canonicalJson(coordination.unresolvedReasons) !== canonicalJson(unresolvedReasons)) {
      context.addIssue({
        code: 'custom',
        message: 'Coordination unresolved reasons disagree with entries'
      })
    }
    const acceptanceDisposition =
      outcome === 'ready-for-reconciliation' ? 'eligible-for-reconciliation' : 'unaccepted'
    if (coordination.acceptanceDisposition !== acceptanceDisposition) {
      context.addIssue({
        code: 'custom',
        message: 'Coordination acceptance disposition disagrees with outcome'
      })
    }
    if (
      coordination.entries.some((entry) => entry.disposition === 'missing') &&
      Date.parse(coordination.observedAt) < Date.parse(coordination.resultDeadlineAt)
    ) {
      context.addIssue({ code: 'custom', message: 'Evaluation cannot be missing before deadline' })
    }
    if (
      coordination.version === 1 &&
      Date.parse(coordination.resultDeadlineAt) <= Date.parse(coordination.createdAt)
    ) {
      context.addIssue({ code: 'custom', message: 'Coordination deadline must follow dispatch' })
    }
  })

export type EvaluationCoordinationV1 = z.infer<typeof EvaluationCoordinationV1Schema>
