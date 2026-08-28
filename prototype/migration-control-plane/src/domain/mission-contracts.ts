import { z } from 'zod'
import {
  ActorSchema,
  CommandIdSchema,
  ContractSchemaReferenceSchema,
  DataClassSchema,
  DOMAIN_SCHEMA_VERSION,
  EventIdSchema,
  GapIdSchema,
  IsoDateTimeSchema,
  JsonValueSchema,
  MissionIdSchema,
  PlanRevisionIdSchema,
  RecordLabelsSchema,
  RevisionSchema,
  Sha256Schema,
  ShortTextSchema,
  TenantIdSchema,
  uniqueIdArray
} from './common-contracts.js'

const ActiveMissionStateSchema = z
  .object({
    status: z.enum(['created', 'investigating', 'planning', 'executing', 'evaluating']),
    enteredAt: IsoDateTimeSchema
  })
  .strict()

const BlockedMissionStateSchema = z
  .object({
    status: z.literal('blocked'),
    enteredAt: IsoDateTimeSchema,
    blockerGapIds: uniqueIdArray(GapIdSchema, { min: 1, max: 1_000, label: 'blockerGapIds' })
  })
  .strict()

const TerminalMissionStateSchema = z
  .object({
    status: z.enum(['completed', 'failed', 'quarantined']),
    enteredAt: IsoDateTimeSchema,
    completedAt: IsoDateTimeSchema,
    reason: ShortTextSchema
  })
  .strict()
  .refine((state) => Date.parse(state.completedAt) >= Date.parse(state.enteredAt), {
    message: 'completedAt must not precede enteredAt',
    path: ['completedAt']
  })

export const MissionStateSchema = z.discriminatedUnion('status', [
  ActiveMissionStateSchema,
  BlockedMissionStateSchema,
  TerminalMissionStateSchema
])

export const MissionRecordV1Schema = z
  .object({
    schemaVersion: z.literal(DOMAIN_SCHEMA_VERSION),
    kind: z.literal('mission'),
    id: MissionIdSchema,
    tenantId: TenantIdSchema,
    missionId: MissionIdSchema,
    revision: RevisionSchema,
    objective: z.string().min(1).max(8_192),
    priorities: z.array(ShortTextSchema).max(32),
    dataClass: DataClassSchema,
    state: MissionStateSchema,
    currentPlanRevisionId: PlanRevisionIdSchema.nullable(),
    labels: RecordLabelsSchema,
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema
  })
  .strict()
  .superRefine((mission, context) => {
    if (mission.id !== mission.missionId) {
      context.addIssue({
        code: 'custom',
        message: 'Mission id and missionId must match',
        path: ['missionId']
      })
    }
    if (Date.parse(mission.updatedAt) < Date.parse(mission.createdAt)) {
      context.addIssue({
        code: 'custom',
        message: 'updatedAt must not precede createdAt',
        path: ['updatedAt']
      })
    }
  })

export const MissionCommandTypeSchema = z.enum([
  'create-mission',
  'record-evidence',
  'commit-plan-revision',
  'create-assignment',
  'record-assignment-result',
  'request-evaluation',
  'record-evaluation-result',
  'request-correction',
  'record-learning-candidate',
  'change-mission-state'
])

export const MissionCommandEnvelopeV1Schema = z
  .object({
    schemaVersion: z.literal(DOMAIN_SCHEMA_VERSION),
    kind: z.literal('mission-command'),
    id: CommandIdSchema,
    tenantId: TenantIdSchema,
    missionId: MissionIdSchema,
    expectedRevision: RevisionSchema.nullable(),
    commandType: MissionCommandTypeSchema,
    payload: JsonValueSchema,
    payloadSchema: ContractSchemaReferenceSchema,
    payloadDigest: Sha256Schema,
    actor: ActorSchema,
    correlationId: z.string().min(1).max(128),
    issuedAt: IsoDateTimeSchema
  })
  .strict()
  .superRefine((command, context) => {
    if (command.commandType === 'create-mission' && command.expectedRevision !== null) {
      context.addIssue({
        code: 'custom',
        message: 'create-mission expectedRevision must be null',
        path: ['expectedRevision']
      })
    }
    if (command.commandType !== 'create-mission' && command.expectedRevision === null) {
      context.addIssue({
        code: 'custom',
        message: 'existing-mission commands require expectedRevision',
        path: ['expectedRevision']
      })
    }
  })

export const MissionEventTypeSchema = z.enum([
  'mission-created',
  'evidence-recorded',
  'epistemic-state-changed',
  'decision-committed',
  'plan-revision-committed',
  'task-state-changed',
  'assignment-state-changed',
  'artifact-version-recorded',
  'evaluation-state-changed',
  'correction-state-changed',
  'learning-candidate-recorded',
  'effect-state-changed',
  'mission-state-changed'
])

export const MissionEventEnvelopeV1Schema = z
  .object({
    schemaVersion: z.literal(DOMAIN_SCHEMA_VERSION),
    kind: z.literal('mission-event'),
    id: EventIdSchema,
    tenantId: TenantIdSchema,
    missionId: MissionIdSchema,
    aggregateRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    eventType: MissionEventTypeSchema,
    payload: JsonValueSchema,
    payloadSchema: ContractSchemaReferenceSchema,
    payloadDigest: Sha256Schema,
    actor: ActorSchema,
    causationCommandId: CommandIdSchema,
    correlationId: z.string().min(1).max(128),
    recordedAt: IsoDateTimeSchema
  })
  .strict()

export type MissionRecordV1 = z.infer<typeof MissionRecordV1Schema>
export type MissionCommandEnvelopeV1 = z.infer<typeof MissionCommandEnvelopeV1Schema>
export type MissionEventEnvelopeV1 = z.infer<typeof MissionEventEnvelopeV1Schema>
