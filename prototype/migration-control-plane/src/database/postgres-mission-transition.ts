import type { PoolClient } from 'pg'
import { z } from 'zod'
import { canonicalJson, sha256Text, type JsonValue } from '../canonical-json.js'
import {
  IsoDateTimeSchema,
  JsonValueSchema,
  MAX_SAFE_REVISION
} from '../domain/common-contracts.js'
import {
  MissionEventEnvelopeV1Schema,
  MissionRecordV1Schema,
  type MissionCommandEnvelopeV1
} from '../domain/mission-contracts.js'
import { CommandRejectedError } from './postgres-command-idempotency.js'

const OutboxMessageSchema = z.strictObject({
  id: z
    .string()
    .min(9)
    .max(128)
    .regex(/^message_[a-z0-9][a-z0-9_-]{0,111}$/),
  topic: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-z][a-z0-9._-]{0,127}$/),
  key: z.string().min(1).max(256),
  payload: JsonValueSchema,
  availableAt: IsoDateTimeSchema
})

export type MissionTransitionResult = {
  missionId: string
  revision: number
  eventId: string
  outboxMessageId: string
  projectionSha256: string
}

function reject(code: string, message: string, details: JsonValue = null): never {
  throw new CommandRejectedError(code, message, details)
}

export async function commitMissionTransition(
  client: PoolClient,
  command: MissionCommandEnvelopeV1,
  input: { event: unknown; mission: unknown; outbox: unknown }
): Promise<MissionTransitionResult> {
  const event = MissionEventEnvelopeV1Schema.parse(input.event)
  const mission = MissionRecordV1Schema.parse(input.mission)
  const outbox = OutboxMessageSchema.parse(input.outbox)
  const eventPayloadJson = canonicalJson(event.payload)
  if (sha256Text(eventPayloadJson) !== event.payloadDigest) {
    reject('event_payload_digest_mismatch', 'Mission event payload does not match payloadDigest')
  }
  if (
    event.tenantId !== command.tenantId ||
    event.missionId !== command.missionId ||
    event.causationCommandId !== command.id ||
    event.correlationId !== command.correlationId
  ) {
    reject('event_command_mismatch', 'Mission event identity does not match its command')
  }
  if (mission.tenantId !== command.tenantId || mission.missionId !== command.missionId) {
    reject('mission_command_mismatch', 'Mission projection identity does not match its command')
  }
  if (command.expectedRevision === MAX_SAFE_REVISION) {
    reject('revision_exhausted', 'Mission aggregate revision cannot advance safely')
  }

  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
    `${command.tenantId}:${command.missionId}`
  ])
  const currentResult = await client.query<{ revision: string }>(
    `SELECT revision::text AS revision
     FROM control_plane.mission_aggregates
     WHERE tenant_id = $1 AND mission_id = $2
     FOR UPDATE`,
    [command.tenantId, command.missionId]
  )
  const currentRevision = currentResult.rows[0] ? Number(currentResult.rows[0].revision) : null
  const creating = command.commandType === 'create-mission'
  if (creating && currentRevision !== null) {
    reject('mission_exists', 'Mission already exists')
  }
  if (!creating && currentRevision === null) {
    reject('mission_not_found', 'Mission does not exist')
  }
  if (!creating && currentRevision !== command.expectedRevision) {
    reject('version_conflict', 'Expected mission revision is stale', {
      expected: command.expectedRevision,
      actual: currentRevision
    })
  }

  const nextRevision = (currentRevision ?? 0) + 1
  if (event.aggregateRevision !== nextRevision || mission.revision !== nextRevision) {
    reject('revision_mismatch', 'Event and mission projection must advance exactly one revision', {
      expected: nextRevision,
      event: event.aggregateRevision,
      mission: mission.revision
    })
  }
  if (creating && event.eventType !== 'mission-created') {
    reject('event_type_mismatch', 'create-mission must emit mission-created')
  }

  const missionJson = canonicalJson(mission)
  const missionSha256 = sha256Text(missionJson)
  const eventJson = canonicalJson(event)
  const eventSha256 = sha256Text(eventJson)
  const outboxPayload = JsonValueSchema.parse(outbox.payload) as JsonValue
  const outboxJson = canonicalJson(outboxPayload)
  const outboxSha256 = sha256Text(outboxJson)

  if (creating) {
    await client.query(
      `INSERT INTO control_plane.domain_records (
         tenant_id, record_id, mission_id, schema_name, schema_version, record_kind,
         aggregate_revision, record_state, payload, payload_sha256, created_at, updated_at
       ) VALUES ($1, $2, $2, 'mission-record.v1', 1, 'mission', $3, $4, $5::jsonb, $6, $7, $8)`,
      [
        mission.tenantId,
        mission.id,
        mission.revision,
        mission.state.status,
        missionJson,
        missionSha256,
        mission.createdAt,
        mission.updatedAt
      ]
    )
    await client.query(
      `INSERT INTO control_plane.mission_aggregates (
         tenant_id, mission_id, revision, mission_state, current_plan_revision_id,
         record, record_sha256, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)`,
      [
        mission.tenantId,
        mission.id,
        mission.revision,
        mission.state.status,
        mission.currentPlanRevisionId,
        missionJson,
        missionSha256,
        mission.createdAt,
        mission.updatedAt
      ]
    )
  } else {
    const domainUpdate = await client.query(
      `UPDATE control_plane.domain_records
       SET aggregate_revision = $3, record_state = $4, payload = $5::jsonb,
           payload_sha256 = $6, updated_at = $7
       WHERE tenant_id = $1 AND record_id = $2 AND schema_name = 'mission-record.v1'`,
      [
        mission.tenantId,
        mission.id,
        mission.revision,
        mission.state.status,
        missionJson,
        missionSha256,
        mission.updatedAt
      ]
    )
    const aggregateUpdate = await client.query(
      `UPDATE control_plane.mission_aggregates
       SET revision = $3, mission_state = $4, current_plan_revision_id = $5,
           record = $6::jsonb, record_sha256 = $7, updated_at = $8
       WHERE tenant_id = $1 AND mission_id = $2 AND revision = $9`,
      [
        mission.tenantId,
        mission.id,
        mission.revision,
        mission.state.status,
        mission.currentPlanRevisionId,
        missionJson,
        missionSha256,
        mission.updatedAt,
        currentRevision
      ]
    )
    if (domainUpdate.rowCount !== 1 || aggregateUpdate.rowCount !== 1) {
      reject('version_conflict', 'Mission changed while applying its transition')
    }
  }

  await client.query(
    `INSERT INTO control_plane.mission_events (
       tenant_id, mission_id, aggregate_revision, event_id, causation_command_id,
       event_type, payload_sha256, event_sha256, event, recorded_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)`,
    [
      event.tenantId,
      event.missionId,
      event.aggregateRevision,
      event.id,
      event.causationCommandId,
      event.eventType,
      event.payloadDigest,
      eventSha256,
      eventJson,
      event.recordedAt
    ]
  )

  if (creating) {
    await client.query(
      `INSERT INTO control_plane.mission_projections (
         tenant_id, mission_id, projection_name, event_revision,
         projection, projection_sha256, updated_at
       ) VALUES ($1, $2, 'mission', $3, $4::jsonb, $5, $6)`,
      [
        mission.tenantId,
        mission.id,
        mission.revision,
        missionJson,
        missionSha256,
        mission.updatedAt
      ]
    )
  } else {
    const projectionUpdate = await client.query(
      `UPDATE control_plane.mission_projections
       SET event_revision = $3, projection = $4::jsonb,
           projection_sha256 = $5, rebuilt_at = NULL, updated_at = $6
       WHERE tenant_id = $1 AND mission_id = $2
         AND projection_name = 'mission' AND event_revision = $7`,
      [
        mission.tenantId,
        mission.id,
        mission.revision,
        missionJson,
        missionSha256,
        mission.updatedAt,
        currentRevision
      ]
    )
    if (projectionUpdate.rowCount !== 1) {
      reject('projection_conflict', 'Mission projection is not at the expected event revision')
    }
  }

  await client.query(
    `INSERT INTO control_plane.outbox_messages (
       tenant_id, message_id, mission_id, event_id, topic, message_key,
       payload, payload_sha256, available_at, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)`,
    [
      command.tenantId,
      outbox.id,
      command.missionId,
      event.id,
      outbox.topic,
      outbox.key,
      outboxJson,
      outboxSha256,
      outbox.availableAt,
      event.recordedAt
    ]
  )

  return {
    missionId: mission.id,
    revision: mission.revision,
    eventId: event.id,
    outboxMessageId: outbox.id,
    projectionSha256: missionSha256
  }
}
