import type { PoolClient } from 'pg'
import { canonicalJson, sha256Text } from '../canonical-json.js'
import {
  ProcessObligationDefinitionV1Schema,
  ProcessObligationScopeSchema,
  ProcessObligationV1Schema,
  type ProcessObligationDefinitionV1,
  type ProcessObligationScope
} from '../domain/process-obligation-contracts.js'
import {
  MissionEventEnvelopeV1Schema,
  type MissionCommandEnvelopeV1
} from '../domain/mission-contracts.js'
import { insertPostgresDomainRecords } from './postgres-domain-record-store.js'
import {
  commitMissionTransition,
  type MissionTransitionInput,
  type MissionTransitionResult
} from './postgres-mission-transition.js'

export type ProcessObligationInstantiation = {
  obligationId: string
  definitionId: string
  scope: unknown
  currentFence: number
}

export type MissionTransitionWithObligationsInput = MissionTransitionInput & {
  obligations: ProcessObligationInstantiation[]
}

export type MissionTransitionWithObligationsResult = MissionTransitionResult & {
  obligationIds: string[]
}

type DefinitionRow = {
  definition_id: string
  definition: unknown
  definition_sha256: string
}

type ValidatedInstantiation = {
  obligationId: string
  definition: ProcessObligationDefinitionV1
  definitionDigest: string
  scope: ProcessObligationScope
  currentFence: number
}

function millisecondsFromIso(value: string): number {
  const milliseconds = Date.parse(value)
  if (!Number.isFinite(milliseconds)) {
    throw new TypeError(`Invalid obligation time: ${value}`)
  }
  return milliseconds
}

async function applicableDefinitions(
  client: PoolClient,
  tenantId: string,
  eventType: string
): Promise<DefinitionRow[]> {
  const result = await client.query<DefinitionRow>(
    `SELECT definition_id, definition, definition_sha256
     FROM control_plane.process_obligation_definitions
     WHERE tenant_id = $1 AND trigger_event_kind = $2
       AND activated_at <= transaction_timestamp()
       AND (revoked_at IS NULL OR revoked_at > transaction_timestamp())
     ORDER BY definition_id
     FOR SHARE`,
    [tenantId, eventType]
  )
  return result.rows
}

function validateInstantiations(
  rows: DefinitionRow[],
  inputs: ProcessObligationInstantiation[]
): ValidatedInstantiation[] {
  const byDefinition = new Map(inputs.map((input) => [input.definitionId, input]))
  if (byDefinition.size !== inputs.length) {
    throw new TypeError('Obligation instantiation definitions must be unique')
  }
  if (rows.length !== inputs.length) {
    throw new TypeError('Every applicable obligation definition must be instantiated exactly once')
  }
  return rows.map((row) => {
    const input = byDefinition.get(row.definition_id)
    if (!input) {
      throw new TypeError(`Applicable obligation definition was omitted: ${row.definition_id}`)
    }
    const definition = ProcessObligationDefinitionV1Schema.parse(row.definition)
    if (sha256Text(canonicalJson(definition)) !== row.definition_sha256) {
      throw new TypeError(`Obligation definition digest mismatch: ${row.definition_id}`)
    }
    const scope = ProcessObligationScopeSchema.parse(input.scope)
    if (!definition.scopeKinds.includes(scope.kind)) {
      throw new TypeError(`Obligation definition does not allow scope kind ${scope.kind}`)
    }
    if (!Number.isSafeInteger(input.currentFence) || input.currentFence < 1) {
      throw new TypeError('Obligation fence must be a positive safe integer')
    }
    return {
      obligationId: input.obligationId,
      definition,
      definitionDigest: row.definition_sha256,
      scope,
      currentFence: input.currentFence
    }
  })
}

export async function commitMissionTransitionWithApplicableMissionObligations(
  client: PoolClient,
  command: MissionCommandEnvelopeV1,
  input: MissionTransitionInput
): Promise<MissionTransitionWithObligationsResult> {
  const event = MissionEventEnvelopeV1Schema.parse(input.event)
  const rows = await applicableDefinitions(client, command.tenantId, event.eventType)
  return commitMissionTransitionWithObligations(client, command, {
    ...input,
    obligations: rows.map((row) => ({
      obligationId: `obligation_${sha256Text(
        canonicalJson({
          tenantId: command.tenantId,
          missionId: command.missionId,
          eventId: event.id,
          definitionId: row.definition_id
        })
      ).slice(0, 32)}`,
      definitionId: row.definition_id,
      scope: {
        kind: 'mission',
        id: command.missionId,
        subjectVersion: String(event.aggregateRevision)
      },
      currentFence: 1
    }))
  })
}

export async function commitMissionTransitionWithObligations(
  client: PoolClient,
  command: MissionCommandEnvelopeV1,
  input: MissionTransitionWithObligationsInput
): Promise<MissionTransitionWithObligationsResult> {
  const event = MissionEventEnvelopeV1Schema.parse(input.event)
  const rows = await applicableDefinitions(client, command.tenantId, event.eventType)
  const instantiations = validateInstantiations(rows, input.obligations)
  const transition = await commitMissionTransition(client, command, input)
  const clock = await client.query<{ opened_at: Date }>(
    'SELECT transaction_timestamp() AS opened_at'
  )
  const openedAt = clock.rows[0]!.opened_at.toISOString()
  const obligations = instantiations.map((item) => {
    const openedMilliseconds = millisecondsFromIso(openedAt)
    const dueAt = new Date(
      openedMilliseconds + item.definition.timing.deadlineOffsetMs
    ).toISOString()
    const graceUntil = new Date(
      millisecondsFromIso(dueAt) + item.definition.timing.graceMs
    ).toISOString()
    return ProcessObligationV1Schema.parse({
      schemaVersion: 1,
      kind: 'process-obligation',
      id: item.obligationId,
      tenantId: command.tenantId,
      missionId: command.missionId,
      createdAt: openedAt,
      definition: {
        id: item.definition.id,
        version: item.definition.version,
        digest: item.definitionDigest
      },
      scope: item.scope,
      trigger: {
        eventId: transition.eventId,
        eventPosition: transition.revision,
        occurredAt: event.recordedAt
      },
      openedAt,
      dueAt,
      graceUntil,
      state: { status: 'pending' },
      breachId: null,
      currentFence: item.currentFence
    })
  })
  await insertPostgresDomainRecords(
    client,
    obligations.map((obligation) => ({
      tenantId: obligation.tenantId,
      recordId: obligation.id,
      missionId: obligation.missionId,
      schemaName: 'process-obligation.v1',
      recordKind: 'process-obligation',
      recordState: obligation.state.status,
      payload: obligation,
      createdAt: obligation.createdAt
    }))
  )
  for (const obligation of obligations) {
    const obligationJson = canonicalJson(obligation)
    await client.query(
      `INSERT INTO control_plane.process_obligations (
         tenant_id, mission_id, obligation_id, definition_id, definition_version,
         definition_digest, scope_kind, scope_id, subject_version, trigger_event_id,
         trigger_event_position, obligation_state, opened_at, due_at, grace_until,
         proof_record_ids, breach_id, current_fence, obligation, obligation_sha256,
         terminal_at, created_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12, $13, $14,
         '[]'::jsonb, NULL, $15, $16::jsonb, $17, NULL, $18
       )`,
      [
        obligation.tenantId,
        obligation.missionId,
        obligation.id,
        obligation.definition.id,
        obligation.definition.version,
        obligation.definition.digest,
        obligation.scope.kind,
        obligation.scope.id,
        obligation.scope.subjectVersion,
        obligation.trigger.eventId,
        obligation.trigger.eventPosition,
        obligation.openedAt,
        obligation.dueAt,
        obligation.graceUntil,
        obligation.currentFence,
        obligationJson,
        sha256Text(obligationJson),
        obligation.createdAt
      ]
    )
  }
  return { ...transition, obligationIds: obligations.map((obligation) => obligation.id) }
}
