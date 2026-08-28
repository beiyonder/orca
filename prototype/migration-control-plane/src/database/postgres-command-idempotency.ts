import type { Pool, PoolClient } from 'pg'
import { canonicalJson, sha256Text, type JsonValue } from '../canonical-json.js'
import { JsonValueSchema } from '../domain/common-contracts.js'
import {
  MissionCommandEnvelopeV1Schema,
  type MissionCommandEnvelopeV1
} from '../domain/mission-contracts.js'
import { withPostgresTransaction } from './postgres-transaction.js'

type CommandRow = {
  command_sha256: string
  status: 'received' | 'committed' | 'rejected'
  result: JsonValue | null
  result_sha256: string | null
  error_code: string | null
}

export type MissionCommandOutcome =
  | { status: 'committed'; result: JsonValue }
  | { status: 'rejected'; errorCode: string; result: JsonValue }

export type MissionCommandExecution = {
  disposition: 'executed' | 'replayed'
  outcome: MissionCommandOutcome
}

export class CommandPayloadDigestMismatchError extends Error {
  constructor() {
    super('Mission command payload does not match payloadDigest')
    this.name = 'CommandPayloadDigestMismatchError'
  }
}

export class CommandIdentityMismatchError extends Error {
  constructor(commandId: string) {
    super(`Mission command ${commandId} was already used with different input`)
    this.name = 'CommandIdentityMismatchError'
  }
}

export class CommandResultIntegrityError extends Error {
  constructor(commandId: string) {
    super(`Stored mission command result failed its digest check: ${commandId}`)
    this.name = 'CommandResultIntegrityError'
  }
}

export class CommandIndeterminateError extends Error {
  constructor(commandId: string) {
    super(`Mission command remains received without a durable outcome: ${commandId}`)
    this.name = 'CommandIndeterminateError'
  }
}

export class CommandRejectedError extends Error {
  readonly code: string
  readonly details: JsonValue

  constructor(code: string, message: string, details: JsonValue = null) {
    if (!/^[a-z][a-z0-9_]{0,127}$/.test(code)) {
      throw new TypeError('Command rejection code must be lower snake case')
    }
    super(message)
    this.name = 'CommandRejectedError'
    this.code = code
    this.details = details
  }
}

function checkedJson(value: unknown): { value: JsonValue; json: string; sha256: string } {
  const parsed = JsonValueSchema.parse(value) as JsonValue
  const json = canonicalJson(parsed)
  return { value: parsed, json, sha256: sha256Text(json) }
}

function replayOutcome(commandId: string, row: CommandRow): MissionCommandOutcome {
  if (row.status === 'received') {
    throw new CommandIndeterminateError(commandId)
  }
  if (row.result === null || row.result_sha256 === null) {
    throw new CommandResultIntegrityError(commandId)
  }
  const result = checkedJson(row.result)
  if (result.sha256 !== row.result_sha256.trim()) {
    throw new CommandResultIntegrityError(commandId)
  }
  if (row.status === 'rejected') {
    if (!row.error_code) {
      throw new CommandResultIntegrityError(commandId)
    }
    return { status: 'rejected', errorCode: row.error_code, result: result.value }
  }
  return { status: 'committed', result: result.value }
}

async function readCommandRow(
  client: PoolClient,
  tenantId: string,
  commandId: string
): Promise<CommandRow> {
  const result = await client.query<CommandRow>(
    `SELECT trim(command_sha256) AS command_sha256,
            status,
            result,
            trim(result_sha256) AS result_sha256,
            error_code
     FROM control_plane.mission_commands
     WHERE tenant_id = $1 AND command_id = $2
     FOR SHARE`,
    [tenantId, commandId]
  )
  const row = result.rows[0]
  if (!row) {
    throw new Error(`Mission command disappeared after conflict: ${commandId}`)
  }
  return row
}

export async function executeIdempotentMissionCommand(
  pool: Pool,
  input: unknown,
  handler: (client: PoolClient, command: MissionCommandEnvelopeV1) => Promise<unknown>
): Promise<MissionCommandExecution> {
  const command = MissionCommandEnvelopeV1Schema.parse(input)
  const payload = checkedJson(command.payload)
  if (payload.sha256 !== command.payloadDigest) {
    throw new CommandPayloadDigestMismatchError()
  }
  const commandJson = canonicalJson(command)
  const commandSha256 = sha256Text(commandJson)

  return withPostgresTransaction(pool, async (client) => {
    const inserted = await client.query<{ command_id: string }>(
      `INSERT INTO control_plane.mission_commands (
         tenant_id, command_id, mission_id, expected_revision, command_type,
         payload_sha256, command_sha256, command, status, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'received', $9)
       ON CONFLICT (tenant_id, command_id) DO NOTHING
       RETURNING command_id`,
      [
        command.tenantId,
        command.id,
        command.missionId,
        command.expectedRevision,
        command.commandType,
        command.payloadDigest,
        commandSha256,
        commandJson,
        command.issuedAt
      ]
    )

    if (inserted.rowCount === 0) {
      const existing = await readCommandRow(client, command.tenantId, command.id)
      if (existing.command_sha256 !== commandSha256) {
        throw new CommandIdentityMismatchError(command.id)
      }
      return { disposition: 'replayed', outcome: replayOutcome(command.id, existing) }
    }

    await client.query('SAVEPOINT mission_command_handler')
    try {
      const result = checkedJson(await handler(client, command))
      const updated = await client.query(
        `UPDATE control_plane.mission_commands
         SET status = 'committed', result = $3::jsonb, result_sha256 = $4,
             completed_at = transaction_timestamp()
         WHERE tenant_id = $1 AND command_id = $2 AND status = 'received'`,
        [command.tenantId, command.id, result.json, result.sha256]
      )
      if (updated.rowCount !== 1) {
        throw new CommandIndeterminateError(command.id)
      }
      return {
        disposition: 'executed',
        outcome: { status: 'committed', result: result.value }
      }
    } catch (error) {
      if (!(error instanceof CommandRejectedError)) {
        throw error
      }
      await client.query('ROLLBACK TO SAVEPOINT mission_command_handler')
      const rejection = checkedJson({
        code: error.code,
        message: error.message,
        details: error.details
      })
      const updated = await client.query(
        `UPDATE control_plane.mission_commands
         SET status = 'rejected', result = $3::jsonb, result_sha256 = $4,
             error_code = $5, completed_at = transaction_timestamp()
         WHERE tenant_id = $1 AND command_id = $2 AND status = 'received'`,
        [command.tenantId, command.id, rejection.json, rejection.sha256, error.code]
      )
      if (updated.rowCount !== 1) {
        throw new CommandIndeterminateError(command.id)
      }
      return {
        disposition: 'executed',
        outcome: { status: 'rejected', errorCode: error.code, result: rejection.value }
      }
    }
  })
}
