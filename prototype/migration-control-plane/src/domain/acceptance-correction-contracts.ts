import { z } from 'zod'
import {
  ActorSchema,
  CorrectionCycleIdSchema,
  EvaluationCoordinationIdSchema,
  EvaluationDiagnosisIdSchema,
  EvaluationResultIdSchema,
  EvidenceIdSchema,
  GapIdSchema,
  IsoDateTimeSchema,
  PositiveVersionSchema,
  Sha256Schema,
  ShortTextSchema,
  SubjectAcceptanceIdSchema,
  UsageSchema,
  missionRecordFields,
  uniqueIdArray
} from './common-contracts.js'
import { EvaluationSubjectReferenceV2Schema } from './evaluation-assignment-contracts-v2.js'
import { EvaluationContractReferenceV2Schema } from './evaluation-definition-contracts-v2.js'

export const SubjectAcceptanceStatusSchema = z.enum([
  'unknown',
  'hypothesis',
  'supported',
  'accepted',
  'rejected',
  'quarantined'
])

const AcceptancePredecessorSchema = z.strictObject({
  id: SubjectAcceptanceIdSchema,
  version: PositiveVersionSchema,
  digest: Sha256Schema
})

export const SubjectAcceptanceV1Schema = z
  .strictObject({
    ...missionRecordFields('subject-acceptance', SubjectAcceptanceIdSchema),
    acceptanceKey: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[a-z0-9][a-z0-9_-]*$/),
    version: PositiveVersionSchema,
    predecessor: AcceptancePredecessorSchema.nullable(),
    subject: EvaluationSubjectReferenceV2Schema,
    contract: EvaluationContractReferenceV2Schema,
    status: SubjectAcceptanceStatusSchema,
    coordinationIds: uniqueIdArray(EvaluationCoordinationIdSchema, {
      max: 1_000,
      label: 'coordinationIds'
    }),
    evaluationResultIds: uniqueIdArray(EvaluationResultIdSchema, {
      max: 10_000,
      label: 'evaluationResultIds'
    }),
    satisfiedPredicates: z.array(z.string().min(1).max(256)).max(1_000),
    unsatisfiedPredicates: z.array(z.string().min(1).max(256)).max(1_000),
    evidenceIds: uniqueIdArray(EvidenceIdSchema, { max: 10_000, label: 'evidenceIds' }),
    reason: ShortTextSchema,
    transitionedAt: IsoDateTimeSchema,
    transitionedBy: ActorSchema,
    acceptanceAuthority: z.literal('product-reconciler')
  })
  .superRefine((acceptance, context) => {
    if ((acceptance.version === 1) !== (acceptance.predecessor === null)) {
      context.addIssue({ code: 'custom', message: 'Acceptance predecessor lineage disagrees' })
    }
    if (
      acceptance.predecessor !== null &&
      acceptance.predecessor.version !== acceptance.version - 1
    ) {
      context.addIssue({ code: 'custom', message: 'Acceptance predecessor must be immediate' })
    }
    const satisfied = new Set(acceptance.satisfiedPredicates)
    if (
      satisfied.size !== acceptance.satisfiedPredicates.length ||
      new Set(acceptance.unsatisfiedPredicates).size !== acceptance.unsatisfiedPredicates.length ||
      acceptance.unsatisfiedPredicates.some((predicate) => satisfied.has(predicate))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Acceptance predicates must be unique and disjoint'
      })
    }
    if (
      acceptance.status === 'accepted' &&
      (acceptance.evaluationResultIds.length === 0 ||
        acceptance.satisfiedPredicates.length === 0 ||
        acceptance.unsatisfiedPredicates.length !== 0)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Accepted subject requires fully satisfied evaluation'
      })
    }
    if (
      ['rejected', 'quarantined'].includes(acceptance.status) &&
      acceptance.unsatisfiedPredicates.length === 0
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Rejected or quarantined subject requires cause'
      })
    }
  })

export const EvaluationFailureCauseSchema = z.enum([
  'wrong-or-stale-input',
  'invalid-decision',
  'missing-capability',
  'artifact-defect',
  'environment-change',
  'evaluator-defect',
  'semantic-assumption',
  'infrastructure-failure',
  'authority-or-budget'
])

export const EvaluationDiagnosisV1Schema = z.strictObject({
  ...missionRecordFields('evaluation-diagnosis', EvaluationDiagnosisIdSchema),
  acceptanceId: SubjectAcceptanceIdSchema,
  subject: EvaluationSubjectReferenceV2Schema,
  contract: EvaluationContractReferenceV2Schema,
  evaluationResultIds: uniqueIdArray(EvaluationResultIdSchema, {
    min: 1,
    max: 10_000,
    label: 'evaluationResultIds'
  }),
  failedMeasures: z
    .array(
      z.strictObject({
        name: z.string().min(1).max(128),
        failureCode: z.string().min(1).max(128),
        cause: EvaluationFailureCauseSchema,
        componentPath: z.string().min(1).max(1_024),
        evidenceIds: uniqueIdArray(EvidenceIdSchema, {
          min: 1,
          max: 10_000,
          label: 'failedMeasureEvidenceIds'
        })
      })
    )
    .min(1)
    .max(256),
  gapIds: uniqueIdArray(GapIdSchema, { min: 1, max: 1_000, label: 'gapIds' }),
  allowedMutationPaths: z.array(z.string().min(1).max(1_024)).min(1).max(256),
  recommendedAction: z.enum([
    'correct-subject',
    'investigate-evaluator',
    'acquire-evidence',
    'quarantine',
    'external-exception'
  ]),
  genericRetryAllowed: z.literal(false),
  diagnosedAt: IsoDateTimeSchema,
  diagnosedBy: ActorSchema,
  acceptanceAuthority: z.literal('none')
})

const CorrectionPredecessorSchema = z.strictObject({
  id: CorrectionCycleIdSchema,
  version: PositiveVersionSchema,
  digest: Sha256Schema
})

export const CorrectionCycleV1Schema = z
  .strictObject({
    ...missionRecordFields('correction-cycle', CorrectionCycleIdSchema),
    correctionKey: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[a-z0-9][a-z0-9_-]*$/),
    version: PositiveVersionSchema,
    predecessor: CorrectionPredecessorSchema.nullable(),
    failedAcceptanceId: SubjectAcceptanceIdSchema,
    diagnosisId: EvaluationDiagnosisIdSchema,
    originalSubject: EvaluationSubjectReferenceV2Schema,
    correctedSubject: EvaluationSubjectReferenceV2Schema.nullable(),
    fixedContract: EvaluationContractReferenceV2Schema,
    attempt: z.number().int().positive().max(100),
    maxAttempts: z.number().int().positive().max(100),
    allowedMutationPaths: z.array(z.string().min(1).max(1_024)).min(1).max(256),
    changedPaths: z.array(z.string().min(1).max(1_024)).max(256),
    addedEvidenceIds: uniqueIdArray(EvidenceIdSchema, {
      max: 10_000,
      label: 'addedEvidenceIds'
    }),
    evaluationResultIds: uniqueIdArray(EvaluationResultIdSchema, {
      max: 10_000,
      label: 'evaluationResultIds'
    }),
    evaluatorChanged: z.literal(false),
    thresholdChanged: z.literal(false),
    status: z.enum(['requested', 'produced', 'evaluating', 'passed', 'failed', 'quarantined']),
    usage: UsageSchema,
    recordedAt: IsoDateTimeSchema,
    recordedBy: ActorSchema,
    acceptanceAuthority: z.literal('none')
  })
  .superRefine((cycle, context) => {
    if ((cycle.version === 1) !== (cycle.predecessor === null)) {
      context.addIssue({ code: 'custom', message: 'Correction predecessor lineage disagrees' })
    }
    if (cycle.attempt > cycle.maxAttempts) {
      context.addIssue({ code: 'custom', message: 'Correction attempt exceeds budget' })
    }
    if (cycle.correctedSubject !== null) {
      if (
        cycle.correctedSubject.kind !== cycle.originalSubject.kind ||
        cycle.correctedSubject.schema.name !== cycle.originalSubject.schema.name ||
        cycle.correctedSubject.schema.version !== cycle.originalSubject.schema.version ||
        cycle.correctedSubject.version !== cycle.originalSubject.version + 1 ||
        cycle.correctedSubject.digest === cycle.originalSubject.digest
      ) {
        context.addIssue({ code: 'custom', message: 'Corrected subject lineage is invalid' })
      }
    }
    if (
      ['produced', 'evaluating', 'passed', 'failed'].includes(cycle.status) &&
      cycle.correctedSubject === null
    ) {
      context.addIssue({ code: 'custom', message: 'Correction status requires a new subject' })
    }
    if (cycle.status === 'passed' && cycle.evaluationResultIds.length === 0) {
      context.addIssue({ code: 'custom', message: 'Passing correction requires evaluation result' })
    }
    const allowed = new Set(cycle.allowedMutationPaths)
    if (cycle.changedPaths.some((path) => !allowed.has(path))) {
      context.addIssue({ code: 'custom', message: 'Correction changed path outside allowed scope' })
    }
  })

export type SubjectAcceptanceV1 = z.infer<typeof SubjectAcceptanceV1Schema>
export type EvaluationDiagnosisV1 = z.infer<typeof EvaluationDiagnosisV1Schema>
export type CorrectionCycleV1 = z.infer<typeof CorrectionCycleV1Schema>
