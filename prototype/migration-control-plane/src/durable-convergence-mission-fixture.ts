import { canonicalJson, sha256Text } from './canonical-json.js'
import {
  MissionCommandEnvelopeV1Schema,
  MissionEventEnvelopeV1Schema,
  MissionRecordV1Schema,
  type MissionCommandEnvelopeV1,
  type MissionRecordV1
} from './domain/mission-contracts.js'
import type {
  DurableMissionFixture,
  DurableTransitionFixture
} from './durable-convergence-types.js'

export const DURABLE_FIXTURE_DIGEST = 'd'.repeat(64)
export const DURABLE_FIXTURE_ACTOR = { kind: 'system' as const, id: 'durable-convergence' }
export const DURABLE_FIXTURE_BUDGET = {
  tokenLimit: 1_000,
  timeLimitMs: 60_000,
  toolCallLimit: 10,
  outputByteLimit: 1_000_000,
  costLimitUsd: 1
}

function payloadDigest(payload: unknown): string {
  return sha256Text(canonicalJson(payload))
}

function command(input: {
  id: string
  tenantId: string
  missionId: string
  expectedRevision: number | null
  commandType: 'create-mission' | 'change-mission-state'
  payload: unknown
  issuedAt: string
}): MissionCommandEnvelopeV1 {
  return MissionCommandEnvelopeV1Schema.parse({
    schemaVersion: 1,
    kind: 'mission-command',
    id: input.id,
    tenantId: input.tenantId,
    missionId: input.missionId,
    expectedRevision: input.expectedRevision,
    commandType: input.commandType,
    payload: input.payload,
    payloadSchema: {
      name: 'mission-transition.v1',
      version: 1,
      digest: DURABLE_FIXTURE_DIGEST
    },
    payloadDigest: payloadDigest(input.payload),
    actor: DURABLE_FIXTURE_ACTOR,
    correlationId: `correlation_${input.id}`,
    issuedAt: input.issuedAt
  })
}

function event(input: {
  id: string
  command: MissionCommandEnvelopeV1
  revision: number
  eventType: 'mission-created' | 'mission-state-changed'
  change: unknown
  mission: MissionRecordV1
  recordedAt: string
}) {
  const payload = { change: input.change, mission: input.mission }
  return MissionEventEnvelopeV1Schema.parse({
    schemaVersion: 1,
    kind: 'mission-event',
    id: input.id,
    tenantId: input.command.tenantId,
    missionId: input.command.missionId,
    aggregateRevision: input.revision,
    eventType: input.eventType,
    payload,
    payloadSchema: {
      name: 'mission-projection.v1',
      version: 1,
      digest: DURABLE_FIXTURE_DIGEST
    },
    payloadDigest: payloadDigest(payload),
    actor: DURABLE_FIXTURE_ACTOR,
    causationCommandId: input.command.id,
    correlationId: input.command.correlationId,
    recordedAt: input.recordedAt
  })
}

function transition(input: {
  command: MissionCommandEnvelopeV1
  mission: MissionRecordV1
  eventId: string
  eventType: 'mission-created' | 'mission-state-changed'
  change: unknown
  messageId: string
  recordedAt: string
}): DurableTransitionFixture {
  return {
    command: input.command,
    event: event({
      id: input.eventId,
      command: input.command,
      revision: input.mission.revision,
      eventType: input.eventType,
      change: input.change,
      mission: input.mission,
      recordedAt: input.recordedAt
    }),
    mission: input.mission,
    outbox: {
      id: input.messageId,
      topic: 'mission.events',
      key: input.mission.id,
      payload: { eventId: input.eventId },
      availableAt: input.recordedAt
    }
  }
}

export function buildDurableMissionFixture(seed: number): DurableMissionFixture {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new TypeError('Durable convergence seed must be a nonnegative safe integer')
  }
  const suffix = `s${seed}`
  const tenantId = `tenant_dur_${suffix}`
  const missionId = `mission_dur_${suffix}`
  const planId = `plan_dur_${suffix}`
  const createdAt = '2026-01-01T00:00:00.000Z'
  const changedAt = '2026-01-01T00:01:00.000Z'
  const completedAt = '2026-01-01T00:02:00.000Z'
  const leaseExpiresAt = '2026-01-01T00:10:00.000Z'
  const createMission = MissionRecordV1Schema.parse({
    schemaVersion: 1,
    kind: 'mission',
    id: missionId,
    tenantId,
    missionId,
    revision: 1,
    objective: 'Prove durable convergence under duplicate, crash, stale, and restart paths.',
    priorities: ['correctness', 'recovery'],
    dataClass: 'synthetic',
    state: { status: 'created', enteredAt: createdAt },
    currentPlanRevisionId: null,
    labels: { experiment: 'dur-exp-01', seed: String(seed) },
    createdAt,
    updatedAt: createdAt
  })
  const completeMission = MissionRecordV1Schema.parse({
    ...createMission,
    revision: 2,
    state: {
      status: 'completed',
      enteredAt: changedAt,
      completedAt,
      reason: 'Durable convergence predicates passed.'
    },
    currentPlanRevisionId: planId,
    updatedAt: completedAt
  })
  const createChange = { objective: createMission.objective }
  const createCommand = command({
    id: `command_create_${suffix}`,
    tenantId,
    missionId,
    expectedRevision: null,
    commandType: 'create-mission',
    payload: createChange,
    issuedAt: createdAt
  })
  const completeChange = { status: 'completed' }
  const completeCommand = command({
    id: `command_complete_${suffix}`,
    tenantId,
    missionId,
    expectedRevision: 1,
    commandType: 'change-mission-state',
    payload: completeChange,
    issuedAt: completedAt
  })
  return {
    suffix,
    tenantId,
    missionId,
    planId,
    createdAt,
    changedAt,
    completedAt,
    leaseExpiresAt,
    create: transition({
      command: createCommand,
      mission: createMission,
      eventId: `event_create_${suffix}`,
      eventType: 'mission-created',
      change: createChange,
      messageId: `message_create_${suffix}`,
      recordedAt: createdAt
    }),
    complete: transition({
      command: completeCommand,
      mission: completeMission,
      eventId: `event_complete_${suffix}`,
      eventType: 'mission-state-changed',
      change: completeChange,
      messageId: `message_complete_${suffix}`,
      recordedAt: completedAt
    })
  }
}
