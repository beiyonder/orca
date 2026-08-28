import { z } from 'zod'
import {
  ArtifactIdSchema,
  ArtifactVersionIdSchema,
  AssignmentIdSchema,
  AttemptIdSchema,
  ContentReferenceSchema,
  DecisionIdSchema,
  EvaluationResultIdSchema,
  EvidenceIdSchema,
  FenceSchema,
  IsoDateTimeSchema,
  ShortTextSchema,
  missionRecordFields,
  uniqueIdArray
} from './common-contracts.js'

const ProposedArtifactStateSchema = z.object({ status: z.literal('proposed') }).strict()
const EvaluatingArtifactStateSchema = z
  .object({
    status: z.literal('evaluating'),
    evaluationResultIds: uniqueIdArray(EvaluationResultIdSchema, {
      min: 1,
      max: 128,
      label: 'evaluationResultIds'
    })
  })
  .strict()
const AcceptedArtifactStateSchema = z
  .object({
    status: z.literal('accepted'),
    evaluationResultIds: uniqueIdArray(EvaluationResultIdSchema, {
      min: 1,
      max: 128,
      label: 'evaluationResultIds'
    }),
    acceptedAt: IsoDateTimeSchema
  })
  .strict()
const RejectedArtifactStateSchema = z
  .object({
    status: z.enum(['rejected', 'quarantined']),
    evaluationResultIds: uniqueIdArray(EvaluationResultIdSchema, {
      min: 1,
      max: 128,
      label: 'evaluationResultIds'
    }),
    reason: ShortTextSchema,
    settledAt: IsoDateTimeSchema
  })
  .strict()

export const ArtifactStateSchema = z.discriminatedUnion('status', [
  ProposedArtifactStateSchema,
  EvaluatingArtifactStateSchema,
  AcceptedArtifactStateSchema,
  RejectedArtifactStateSchema
])

export const ArtifactVersionV1Schema = z
  .object({
    ...missionRecordFields('artifact-version', ArtifactVersionIdSchema),
    artifactId: ArtifactIdSchema,
    artifactType: z.enum([
      'design',
      'mapping',
      'code',
      'configuration',
      'test',
      'runbook',
      'evidence-packet'
    ]),
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    previousVersionId: ArtifactVersionIdSchema.nullable(),
    content: ContentReferenceSchema,
    producerAssignmentId: AssignmentIdSchema,
    producerAttemptId: AttemptIdSchema,
    producerFence: FenceSchema,
    decisionIds: uniqueIdArray(DecisionIdSchema, { max: 1_000, label: 'decisionIds' }),
    evidenceIds: uniqueIdArray(EvidenceIdSchema, {
      min: 1,
      max: 10_000,
      label: 'evidenceIds'
    }),
    state: ArtifactStateSchema
  })
  .strict()
  .superRefine((artifact, context) => {
    if (artifact.version === 1 && artifact.previousVersionId !== null) {
      context.addIssue({
        code: 'custom',
        message: 'First artifact version cannot have a previous version',
        path: ['previousVersionId']
      })
    }
    if (artifact.version > 1 && artifact.previousVersionId === null) {
      context.addIssue({
        code: 'custom',
        message: 'Later artifact versions require a previous version',
        path: ['previousVersionId']
      })
    }
    if (artifact.previousVersionId === artifact.id) {
      context.addIssue({
        code: 'custom',
        message: 'Artifact version cannot reference itself as previous',
        path: ['previousVersionId']
      })
    }
  })

export type ArtifactVersionV1 = z.infer<typeof ArtifactVersionV1Schema>
