import { z } from 'zod'
import {
  ActorSchema,
  EventIdSchema,
  EvidenceIdSchema,
  FenceSchema,
  IsoDateTimeSchema,
  ProcessObligationBreachIdSchema,
  ProcessObligationIdSchema,
  ProcessObligationTransitionIdSchema,
  ProcessObligationWaiverIdSchema,
  ShortTextSchema,
  missionRecordFields,
  uniqueIdArray
} from './common-contracts.js'
import {
  ProcessObligationDefinitionReferenceSchema,
  ProcessObligationScopeSchema
} from './process-obligation-contracts.js'

export const ProcessObligationTransitionV1Schema = z
  .strictObject({
    ...missionRecordFields('process-obligation-transition', ProcessObligationTransitionIdSchema),
    obligationId: ProcessObligationIdSchema,
    definition: ProcessObligationDefinitionReferenceSchema,
    scope: ProcessObligationScopeSchema,
    transition: z.enum(['satisfy', 'fail', 'waive', 'cancel', 'breach']),
    fromState: z.literal('pending'),
    toState: z.enum(['pending', 'satisfied', 'failed', 'waived', 'cancelled']),
    proofRecordIds: z.array(z.string().min(1).max(256)).max(1_000),
    evidenceIds: uniqueIdArray(EvidenceIdSchema, {
      max: 1_000,
      label: 'evidenceIds'
    }),
    failureCode: z.string().min(1).max(128).nullable(),
    waiverId: ProcessObligationWaiverIdSchema.nullable(),
    breachId: ProcessObligationBreachIdSchema.nullable(),
    supersedingEventId: EventIdSchema.nullable(),
    rationale: ShortTextSchema,
    fence: FenceSchema,
    transitionedAt: IsoDateTimeSchema,
    transitionedBy: ActorSchema
  })
  .superRefine((record, context) => {
    const exact = (
      transition: typeof record.transition,
      toState: typeof record.toState,
      path: string
    ) => {
      if (record.transition === transition && record.toState !== toState) {
        context.addIssue({
          code: 'custom',
          message: `${transition} transition must end in ${toState}`,
          path: [path]
        })
      }
    }
    exact('satisfy', 'satisfied', 'toState')
    exact('fail', 'failed', 'toState')
    exact('waive', 'waived', 'toState')
    exact('cancel', 'cancelled', 'toState')
    exact('breach', 'pending', 'toState')
    if (record.transition === 'satisfy' && record.proofRecordIds.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'Satisfaction transition requires proof records',
        path: ['proofRecordIds']
      })
    }
    if (record.transition === 'fail' && record.evidenceIds.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'Failure transition requires evidence',
        path: ['evidenceIds']
      })
    }
    if ((record.transition === 'fail') !== (record.failureCode !== null)) {
      context.addIssue({
        code: 'custom',
        message: 'Only failure transition carries failure code',
        path: ['failureCode']
      })
    }
    if ((record.transition === 'waive') !== (record.waiverId !== null)) {
      context.addIssue({
        code: 'custom',
        message: 'Only waiver transition carries waiver identity',
        path: ['waiverId']
      })
    }
    if ((record.transition === 'breach') !== (record.breachId !== null)) {
      context.addIssue({
        code: 'custom',
        message: 'Only breach transition carries breach identity',
        path: ['breachId']
      })
    }
    if ((record.transition === 'cancel') !== (record.supersedingEventId !== null)) {
      context.addIssue({
        code: 'custom',
        message: 'Only cancellation transition carries superseding event identity',
        path: ['supersedingEventId']
      })
    }
  })

export type ProcessObligationTransitionV1 = z.infer<typeof ProcessObligationTransitionV1Schema>
