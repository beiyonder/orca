import type { Pool } from 'pg'
import { canonicalJson, sha256Text } from '../src/canonical-json.js'
import { executeIdempotentMissionCommand } from '../src/database/postgres-command-idempotency.js'
import { commitMissionTransition } from '../src/database/postgres-mission-transition.js'
import { DOMAIN_CONTRACT_SAMPLES } from './domain-contract-samples.js'

const createdAt = '2026-01-01T00:00:00.000Z'

function timestampForRevision(revision: number): string {
  return new Date(Date.parse(createdAt) + Math.max(0, revision - 1) * 1_000).toISOString()
}

function command(options: {
  id: string
  type: 'create-mission' | 'record-evidence'
  expectedRevision: number | null
  payload: unknown
  issuedAt: string
}): Record<string, unknown> {
  const value = structuredClone(DOMAIN_CONTRACT_SAMPLES['mission-command.v1']) as Record<
    string,
    unknown
  >
  value.id = options.id
  value.commandType = options.type
  value.expectedRevision = options.expectedRevision
  value.payload = options.payload
  value.payloadDigest = sha256Text(canonicalJson(options.payload))
  value.issuedAt = options.issuedAt
  return value
}

function mission(revision: number): Record<string, unknown> {
  const value = structuredClone(DOMAIN_CONTRACT_SAMPLES['mission-record.v1']) as Record<
    string,
    unknown
  >
  value.revision = revision
  value.updatedAt = timestampForRevision(revision)
  return value
}

function event(options: {
  id: string
  commandId: string
  revision: number
  type: 'mission-created' | 'evidence-recorded'
  payload: unknown
}): Record<string, unknown> {
  const value = structuredClone(DOMAIN_CONTRACT_SAMPLES['mission-event.v1']) as Record<
    string,
    unknown
  >
  value.id = options.id
  value.causationCommandId = options.commandId
  value.aggregateRevision = options.revision
  value.eventType = options.type
  value.payload = options.payload
  value.payloadDigest = sha256Text(canonicalJson(options.payload))
  value.recordedAt = timestampForRevision(options.revision)
  return value
}

function outbox(id: string, eventId: string, revision: number): Record<string, unknown> {
  return {
    id,
    topic: 'mission.events',
    key: 'mission_s1',
    payload: { eventId },
    availableAt: timestampForRevision(revision)
  }
}

export async function createMissionFixture(pool: Pool): Promise<void> {
  const payload = { objective: 'Create the S1 mission.' }
  const nextMission = mission(1)
  const input = command({
    id: 'command_create_mission',
    type: 'create-mission',
    expectedRevision: null,
    payload,
    issuedAt: createdAt
  })
  await executeIdempotentMissionCommand(pool, input, async (client, parsed) =>
    commitMissionTransition(client, parsed, {
      mission: nextMission,
      event: event({
        id: 'event_mission_created',
        commandId: parsed.id,
        revision: 1,
        type: 'mission-created',
        payload: { change: payload, mission: nextMission }
      }),
      outbox: outbox('message_mission_created', 'event_mission_created', 1)
    })
  )
}

export type MissionAdvanceFixtureOptions = {
  suffix: string
  expectedRevision?: number
  nextRevision?: number
  outboxId?: string
}

export function buildMissionAdvanceFixture(options: MissionAdvanceFixtureOptions) {
  const expectedRevision = options.expectedRevision ?? 1
  const nextRevision = options.nextRevision ?? expectedRevision + 1
  const payload = { evidenceId: `evidence_${options.suffix}` }
  const nextMission = mission(nextRevision)
  const commandInput = command({
    id: `command_${options.suffix}`,
    type: 'record-evidence',
    expectedRevision,
    payload,
    issuedAt: timestampForRevision(nextRevision)
  })
  return {
    command: commandInput,
    transition: {
      mission: nextMission,
      event: event({
        id: `event_${options.suffix}`,
        commandId: commandInput.id as string,
        revision: nextRevision,
        type: 'evidence-recorded',
        payload: { change: payload, mission: nextMission }
      }),
      outbox: outbox(
        options.outboxId ?? `message_${options.suffix}`,
        `event_${options.suffix}`,
        nextRevision
      )
    }
  }
}

export async function advanceMissionFixture(pool: Pool, options: MissionAdvanceFixtureOptions) {
  const fixture = buildMissionAdvanceFixture(options)
  return executeIdempotentMissionCommand(pool, fixture.command, async (client, parsed) =>
    commitMissionTransition(client, parsed, fixture.transition)
  )
}
