import { z } from 'zod'
import {
  ActorSchema,
  DataClassSchema,
  GapIdSchema,
  IsoDateTimeSchema,
  PositiveVersionSchema,
  RecordLabelsSchema,
  ShortTextSchema,
  TenantIdSchema,
  uniqueIdArray
} from './domain/common-contracts.js'

export const MissionApiPermissionSchema = z.enum(['mission:read', 'mission:write'])

export const MissionApiPrincipalSchema = z.strictObject({
  tenantId: TenantIdSchema,
  actor: ActorSchema,
  permissions: z.array(MissionApiPermissionSchema).min(1).max(2)
})

export type MissionApiPrincipal = z.infer<typeof MissionApiPrincipalSchema>
export type MissionApiPermission = z.infer<typeof MissionApiPermissionSchema>
export type MissionApiAuthenticator = (bearerToken: string) => Promise<unknown>

export const CreateMissionRequestV1Schema = z.strictObject({
  objective: z.string().min(1).max(8_192),
  priorities: z.array(ShortTextSchema).max(32),
  dataClass: DataClassSchema,
  labels: RecordLabelsSchema,
  issuedAt: IsoDateTimeSchema
})

const ActiveStateIntentSchema = z.strictObject({
  status: z.enum(['investigating', 'planning', 'executing', 'evaluating'])
})

const BlockedStateIntentSchema = z.strictObject({
  status: z.literal('blocked'),
  blockerGapIds: uniqueIdArray(GapIdSchema, { min: 1, max: 1_000, label: 'blockerGapIds' })
})

const TerminalStateIntentSchema = z.strictObject({
  status: z.enum(['completed', 'failed', 'quarantined']),
  reason: ShortTextSchema
})

export const ChangeMissionStateRequestV1Schema = z.strictObject({
  command: z.literal('change-state'),
  expectedRevision: PositiveVersionSchema,
  state: z.discriminatedUnion('status', [
    ActiveStateIntentSchema,
    BlockedStateIntentSchema,
    TerminalStateIntentSchema
  ]),
  issuedAt: IsoDateTimeSchema
})

export const MissionApiPageQuerySchema = z.strictObject({
  limit: z.coerce.number().int().positive().max(100).default(25),
  cursor: z.string().min(1).max(2_048).optional()
})

export type CreateMissionRequestV1 = z.infer<typeof CreateMissionRequestV1Schema>
export type ChangeMissionStateRequestV1 = z.infer<typeof ChangeMissionStateRequestV1Schema>
export type MissionApiPageQuery = z.infer<typeof MissionApiPageQuerySchema>
