import type { Pool } from 'pg'
import { canonicalJson, sha256Text } from '../canonical-json.js'
import {
  ProcessObligationDefinitionV1Schema,
  type ProcessObligationDefinitionV1
} from '../domain/process-obligation-contracts.js'
import { insertPostgresDomainRecords } from './postgres-domain-record-store.js'
import { withPostgresTransaction } from './postgres-transaction.js'

export type RegisteredProcessObligationDefinition = {
  definition: ProcessObligationDefinitionV1
  digest: string
}

export async function registerProcessObligationDefinition(
  pool: Pool,
  input: unknown
): Promise<RegisteredProcessObligationDefinition> {
  const definition = ProcessObligationDefinitionV1Schema.parse(input)
  const definitionJson = canonicalJson(definition)
  const digest = sha256Text(definitionJson)
  await withPostgresTransaction(pool, async (client) => {
    await insertPostgresDomainRecords(client, [
      {
        tenantId: definition.tenantId,
        recordId: definition.id,
        missionId: null,
        schemaName: 'process-obligation-definition.v1',
        recordKind: 'process-obligation-definition',
        recordState: 'active',
        payload: definition,
        createdAt: definition.createdAt
      }
    ])
    await client.query(
      `INSERT INTO control_plane.process_obligation_definitions (
         tenant_id, definition_id, definition_key, definition_version,
         trigger_event_kind, activated_at, revoked_at, definition,
         definition_sha256, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)`,
      [
        definition.tenantId,
        definition.id,
        definition.definitionKey,
        definition.version,
        definition.trigger.eventKind,
        definition.activatedAt,
        definition.revokedAt,
        definitionJson,
        digest,
        definition.createdAt
      ]
    )
  })
  return { definition, digest }
}
