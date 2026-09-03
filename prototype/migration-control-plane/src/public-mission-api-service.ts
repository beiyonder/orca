import type { Pool } from 'pg'
import { executeIdempotentMissionCommand } from './database/postgres-command-idempotency.js'
import { commitMissionTransitionWithApplicableMissionObligations } from './database/postgres-process-obligation-instantiation.js'
import {
  listPublicMissionObligations,
  listPublicMissions,
  readPublicMission
} from './database/postgres-public-mission-query.js'
import type { MissionRecordV1 } from './domain/mission-contracts.js'
import {
  ChangeMissionStateRequestV1Schema,
  CreateMissionRequestV1Schema,
  MissionApiPageQuerySchema,
  type MissionApiPageQuery,
  type MissionApiPrincipal
} from './public-mission-api-contracts.js'
import { decodeMissionApiCursor, encodeMissionApiCursor } from './public-mission-api-identity.js'
import {
  buildPublicMissionCreateTransition,
  buildPublicMissionStateTransition
} from './public-mission-api-transition.js'

export class PublicMissionNotFoundError extends Error {
  constructor() {
    super('Mission not found')
    this.name = 'PublicMissionNotFoundError'
  }
}

export type PublicMissionCommandResult = {
  disposition: 'executed' | 'replayed'
  outcome: 'committed' | 'rejected'
  errorCode: string | null
  mission: MissionRecordV1 | null
  obligationIds: string[]
}

export class PublicMissionApiService {
  readonly #pool: Pool
  readonly #cursorSecret: string | Buffer

  constructor(pool: Pool, cursorSecret: string | Buffer) {
    if (Buffer.byteLength(cursorSecret) < 32) {
      throw new TypeError('Mission API cursor secret must contain at least 32 bytes')
    }
    this.#pool = pool
    this.#cursorSecret = cursorSecret
  }

  async createMission(
    principal: MissionApiPrincipal,
    idempotencyKey: string,
    rawInput: unknown
  ): Promise<PublicMissionCommandResult> {
    const input = CreateMissionRequestV1Schema.parse(rawInput)
    const transition = buildPublicMissionCreateTransition(principal, idempotencyKey, input)
    const execution = await executeIdempotentMissionCommand(
      this.#pool,
      transition.command,
      async (client, command) =>
        commitMissionTransitionWithApplicableMissionObligations(client, command, transition)
    )
    return this.#commandResult(principal, transition.mission.id, execution)
  }

  async changeMissionState(
    principal: MissionApiPrincipal,
    missionId: string,
    idempotencyKey: string,
    rawInput: unknown
  ): Promise<PublicMissionCommandResult> {
    const input = ChangeMissionStateRequestV1Schema.parse(rawInput)
    const current = await readPublicMission(this.#pool, principal.tenantId, missionId)
    if (!current) {
      throw new PublicMissionNotFoundError()
    }
    const transition = buildPublicMissionStateTransition(principal, current, idempotencyKey, input)
    const execution = await executeIdempotentMissionCommand(
      this.#pool,
      transition.command,
      async (client, command) =>
        commitMissionTransitionWithApplicableMissionObligations(client, command, transition)
    )
    return this.#commandResult(principal, missionId, execution)
  }

  async readMission(principal: MissionApiPrincipal, missionId: string) {
    const mission = await readPublicMission(this.#pool, principal.tenantId, missionId)
    if (!mission) {
      throw new PublicMissionNotFoundError()
    }
    return mission
  }

  async listMissions(principal: MissionApiPrincipal, rawQuery: unknown) {
    const query = MissionApiPageQuerySchema.parse(rawQuery)
    const lastId = this.#lastId(query, 'missions', principal.tenantId, null)
    const page = await listPublicMissions(this.#pool, principal.tenantId, query.limit, lastId)
    return {
      items: page.items,
      nextCursor:
        page.nextLastId === null
          ? null
          : encodeMissionApiCursor(this.#cursorSecret, {
              version: 1,
              kind: 'missions',
              tenantId: principal.tenantId,
              missionId: null,
              lastId: page.nextLastId
            })
    }
  }

  async listMissionObligations(
    principal: MissionApiPrincipal,
    missionId: string,
    rawQuery: unknown
  ) {
    await this.readMission(principal, missionId)
    const query = MissionApiPageQuerySchema.parse(rawQuery)
    const lastId = this.#lastId(query, 'obligations', principal.tenantId, missionId)
    const page = await listPublicMissionObligations(
      this.#pool,
      principal.tenantId,
      missionId,
      query.limit,
      lastId
    )
    return {
      items: page.items,
      nextCursor:
        page.nextLastId === null
          ? null
          : encodeMissionApiCursor(this.#cursorSecret, {
              version: 1,
              kind: 'obligations',
              tenantId: principal.tenantId,
              missionId,
              lastId: page.nextLastId
            })
    }
  }

  #lastId(
    query: MissionApiPageQuery,
    kind: 'missions' | 'obligations',
    tenantId: string,
    missionId: string | null
  ): string | null {
    return query.cursor
      ? decodeMissionApiCursor(this.#cursorSecret, query.cursor, { kind, tenantId, missionId })
          .lastId
      : null
  }

  async #commandResult(
    principal: MissionApiPrincipal,
    missionId: string,
    execution: Awaited<ReturnType<typeof executeIdempotentMissionCommand>>
  ): Promise<PublicMissionCommandResult> {
    const result = execution.outcome.status === 'committed' ? execution.outcome.result : null
    const obligationIds =
      result &&
      typeof result === 'object' &&
      !Array.isArray(result) &&
      Array.isArray(result.obligationIds)
        ? result.obligationIds.filter((value): value is string => typeof value === 'string')
        : []
    return {
      disposition: execution.disposition,
      outcome: execution.outcome.status,
      errorCode: execution.outcome.status === 'rejected' ? execution.outcome.errorCode : null,
      mission: await readPublicMission(this.#pool, principal.tenantId, missionId),
      obligationIds
    }
  }
}
