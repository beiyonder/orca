import { canonicalJson, sha256Text } from './canonical-json.js'
import {
  MissionCommandEnvelopeV1Schema,
  MissionEventEnvelopeV1Schema,
  MissionRecordV1Schema,
  type MissionCommandEnvelopeV1,
  type MissionEventEnvelopeV1,
  type MissionRecordV1
} from './domain/mission-contracts.js'
import type {
  ChangeMissionStateRequestV1,
  CreateMissionRequestV1,
  MissionApiPrincipal
} from './public-mission-api-contracts.js'
import { stablePublicMissionApiId } from './public-mission-api-identity.js'

const CREATE_SCHEMA_DIGEST = sha256Text('public-mission-api.create.v1')
const CHANGE_STATE_SCHEMA_DIGEST = sha256Text('public-mission-api.change-state.v1')

type PublicMissionTransition = {
  mission: MissionRecordV1
  command: MissionCommandEnvelopeV1
  event: MissionEventEnvelopeV1
  outbox: {
    id: string
    topic: 'mission.events'
    key: string
    payload: { eventId: string }
    availableAt: string
  }
}

function createPayload(input: CreateMissionRequestV1) {
  return {
    objective: input.objective,
    priorities: input.priorities,
    dataClass: input.dataClass,
    labels: input.labels
  }
}

function stateFromIntent(input: ChangeMissionStateRequestV1) {
  if (input.state.status === 'blocked') {
    return { ...input.state, enteredAt: input.issuedAt }
  }
  if (['completed', 'failed', 'quarantined'].includes(input.state.status)) {
    return { ...input.state, enteredAt: input.issuedAt, completedAt: input.issuedAt }
  }
  return { status: input.state.status, enteredAt: input.issuedAt }
}

export function buildPublicMissionCreateTransition(
  principal: MissionApiPrincipal,
  idempotencyKey: string,
  input: CreateMissionRequestV1
): PublicMissionTransition {
  const identity = { tenantId: principal.tenantId, route: 'create-mission', idempotencyKey }
  const missionId = stablePublicMissionApiId('mission', identity)
  const commandId = stablePublicMissionApiId('command', identity)
  const eventId = stablePublicMissionApiId('event', { commandId })
  const correlationId = stablePublicMissionApiId('correlation', identity)
  const mission = MissionRecordV1Schema.parse({
    schemaVersion: 1,
    kind: 'mission',
    id: missionId,
    tenantId: principal.tenantId,
    missionId,
    revision: 1,
    objective: input.objective,
    priorities: input.priorities,
    dataClass: input.dataClass,
    state: { status: 'created', enteredAt: input.issuedAt },
    currentPlanRevisionId: null,
    labels: input.labels,
    createdAt: input.issuedAt,
    updatedAt: input.issuedAt
  })
  const payload = createPayload(input)
  const command = MissionCommandEnvelopeV1Schema.parse({
    schemaVersion: 1,
    kind: 'mission-command',
    id: commandId,
    tenantId: principal.tenantId,
    missionId,
    expectedRevision: null,
    commandType: 'create-mission',
    payload,
    payloadSchema: { name: 'mission-api-create.v1', version: 1, digest: CREATE_SCHEMA_DIGEST },
    payloadDigest: sha256Text(canonicalJson(payload)),
    actor: principal.actor,
    correlationId,
    issuedAt: input.issuedAt
  })
  const eventPayload = { change: payload, mission }
  const event = MissionEventEnvelopeV1Schema.parse({
    schemaVersion: 1,
    kind: 'mission-event',
    id: eventId,
    tenantId: principal.tenantId,
    missionId,
    aggregateRevision: 1,
    eventType: 'mission-created',
    payload: eventPayload,
    payloadSchema: { name: 'mission-projection.v1', version: 1, digest: CREATE_SCHEMA_DIGEST },
    payloadDigest: sha256Text(canonicalJson(eventPayload)),
    actor: principal.actor,
    causationCommandId: commandId,
    correlationId,
    recordedAt: input.issuedAt
  })
  return {
    mission,
    command,
    event,
    outbox: {
      id: stablePublicMissionApiId('message', { eventId }),
      topic: 'mission.events',
      key: missionId,
      payload: { eventId },
      availableAt: input.issuedAt
    }
  }
}

export function buildPublicMissionStateTransition(
  principal: MissionApiPrincipal,
  current: MissionRecordV1,
  idempotencyKey: string,
  input: ChangeMissionStateRequestV1
): PublicMissionTransition {
  const identity = {
    tenantId: principal.tenantId,
    missionId: current.id,
    route: 'change-mission-state',
    idempotencyKey
  }
  const commandId = stablePublicMissionApiId('command', identity)
  const eventId = stablePublicMissionApiId('event', { commandId })
  const correlationId = stablePublicMissionApiId('correlation', identity)
  const mission = MissionRecordV1Schema.parse({
    ...current,
    revision: input.expectedRevision + 1,
    state: stateFromIntent(input),
    updatedAt: input.issuedAt
  })
  const payload = { command: input.command, state: input.state }
  const command = MissionCommandEnvelopeV1Schema.parse({
    schemaVersion: 1,
    kind: 'mission-command',
    id: commandId,
    tenantId: principal.tenantId,
    missionId: current.id,
    expectedRevision: input.expectedRevision,
    commandType: 'change-mission-state',
    payload,
    payloadSchema: {
      name: 'mission-api-change-state.v1',
      version: 1,
      digest: CHANGE_STATE_SCHEMA_DIGEST
    },
    payloadDigest: sha256Text(canonicalJson(payload)),
    actor: principal.actor,
    correlationId,
    issuedAt: input.issuedAt
  })
  const eventPayload = { change: payload, mission }
  const event = MissionEventEnvelopeV1Schema.parse({
    schemaVersion: 1,
    kind: 'mission-event',
    id: eventId,
    tenantId: principal.tenantId,
    missionId: current.id,
    aggregateRevision: input.expectedRevision + 1,
    eventType: 'mission-state-changed',
    payload: eventPayload,
    payloadSchema: {
      name: 'mission-projection.v1',
      version: 1,
      digest: CHANGE_STATE_SCHEMA_DIGEST
    },
    payloadDigest: sha256Text(canonicalJson(eventPayload)),
    actor: principal.actor,
    causationCommandId: commandId,
    correlationId,
    recordedAt: input.issuedAt
  })
  return {
    mission,
    command,
    event,
    outbox: {
      id: stablePublicMissionApiId('message', { eventId }),
      topic: 'mission.events',
      key: current.id,
      payload: { eventId },
      availableAt: input.issuedAt
    }
  }
}
