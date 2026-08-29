import { z } from 'zod'
import { sha256Text } from './canonical-json.js'
import {
  SourceDataProfileV1Schema,
  type SourceDataProfileV1
} from './domain/source-profile-contracts.js'
import type { SourceRequestV1 } from './domain/source-probe-contracts.js'
import type { PostgresSourceSandboxResult, SourceReadSession } from './postgres-source-sandbox.js'

const RelationKeySchema = z.strictObject({
  schema: z.string().min(1).max(256),
  name: z.string().min(1).max(256),
  columns: z.array(z.string().min(1).max(256)).max(64).optional()
})
const ProfileParametersSchema = z.strictObject({
  relations: z.array(RelationKeySchema).min(1).max(32),
  maxColumnsPerRelation: z.number().int().positive().max(64),
  sampleRowsPerColumn: z.number().int().nonnegative().max(256)
})

type ProfilePayload = {
  requestedRelations: { schema: string; name: string }[]
  profiles: SourceDataProfileV1['profiles']
  denials: SourceDataProfileV1['denials']
  unavailableRelations: SourceDataProfileV1['unavailableRelations']
}

type ProfileMetadata = {
  profileId: string
  observationId: string
  capturedBy: SourceDataProfileV1['lineage']['capturedBy']
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

export async function collectPostgresDataProfile(
  session: SourceReadSession,
  request: SourceRequestV1
): Promise<ProfilePayload> {
  const parameters = ProfileParametersSchema.parse(request.parameters)
  const requestedRelations = parameters.relations.map(({ schema, name }) => ({ schema, name }))
  const results = await Promise.all(
    parameters.relations.map(async (relation) => {
      const identity = await session.query<{
        allowed: boolean
        qualified_name: string | null
      }>(
        `SELECT to_regclass(format('%I.%I', $1::text, $2::text))::text AS qualified_name,
                CASE WHEN to_regclass(format('%I.%I', $1::text, $2::text)) IS NULL THEN false
                     ELSE has_table_privilege(current_user, to_regclass(format('%I.%I', $1::text, $2::text)), 'SELECT')
                END AS allowed`,
        [relation.schema, relation.name]
      )
      if (identity[0]?.qualified_name === null) {
        return {
          kind: 'unavailable' as const,
          relation: { schema: relation.schema, name: relation.name },
          reason: 'Relation was not present in the observed snapshot.'
        }
      }
      if (!identity[0]?.allowed) {
        return {
          kind: 'denied' as const,
          relation: { schema: relation.schema, name: relation.name },
          reason: 'Current source identity lacks SELECT permission.',
          absenceConclusion: false as const
        }
      }
      const availableColumns = await session.query<{ data_type: string; name: string }>(
        `SELECT column_name AS name, data_type
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2
         ORDER BY ordinal_position`,
        [relation.schema, relation.name]
      )
      const requested =
        relation.columns && relation.columns.length > 0 ? new Set(relation.columns) : null
      const columns = availableColumns
        .filter((column) => requested === null || requested.has(column.name))
        .slice(0, parameters.maxColumnsPerRelation)
      const qualified = `${quoteIdentifier(relation.schema)}.${quoteIdentifier(relation.name)}`
      const countRows = await session.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM ${qualified}`
      )
      const rowCount = countRows[0]?.count ?? 0
      const columnProfiles = await Promise.all(
        columns.map(async (column) => {
          const quotedColumn = quoteIdentifier(column.name)
          const [statsRows, sampleRows] = await Promise.all([
            session.query<{
              distinct_count: number
              maximum: string | null
              minimum: string | null
              non_null_count: number
              total_count: number
            }>(
              `SELECT count(*)::int AS total_count,
                      count(${quotedColumn})::int AS non_null_count,
                      count(DISTINCT ${quotedColumn}::text)::int AS distinct_count,
                      min(${quotedColumn}::text) AS minimum,
                      max(${quotedColumn}::text) AS maximum
               FROM ${qualified}`
            ),
            session.query<{ value: string }>(
              `SELECT ${quotedColumn}::text AS value
               FROM ${qualified}
               WHERE ${quotedColumn} IS NOT NULL
               ORDER BY ${quotedColumn}::text
               LIMIT $1`,
              [parameters.sampleRowsPerColumn]
            )
          ])
          const stats = statsRows[0]!
          return {
            name: column.name,
            dataType: column.data_type,
            rowsObserved: stats.total_count,
            nullCount: stats.total_count - stats.non_null_count,
            distinctCount: stats.distinct_count,
            minimumDigest: stats.minimum === null ? null : sha256Text(stats.minimum),
            maximumDigest: stats.maximum === null ? null : sha256Text(stats.maximum),
            sampleValueDigests: sampleRows.map((sample) => sha256Text(sample.value)),
            limitations: ['Minimum and maximum use deterministic text ordering.']
          }
        })
      )
      return {
        kind: 'profile' as const,
        profile: {
          relation: { schema: relation.schema, name: relation.name },
          rowCount,
          rowCountKind: 'exact' as const,
          rowsScanned: rowCount,
          scanPredicateDigest: null,
          columns: columnProfiles,
          limitations:
            requested !== null && columns.length < requested.size
              ? ['One or more requested columns were unavailable.']
              : []
        }
      }
    })
  )
  return {
    requestedRelations,
    profiles: results.flatMap((result) => (result.kind === 'profile' ? [result.profile] : [])),
    denials: results.flatMap((result) =>
      result.kind === 'denied'
        ? [
            {
              relation: result.relation,
              reason: result.reason,
              absenceConclusion: result.absenceConclusion
            }
          ]
        : []
    ),
    unavailableRelations: results.flatMap((result) =>
      result.kind === 'unavailable' ? [{ relation: result.relation, reason: result.reason }] : []
    )
  }
}

export function buildPostgresDataProfile(
  request: SourceRequestV1,
  run: PostgresSourceSandboxResult<ProfilePayload>,
  metadata: ProfileMetadata
): SourceDataProfileV1 {
  const payload = run.value
  return SourceDataProfileV1Schema.parse({
    schemaVersion: 1,
    kind: 'source-data-profile',
    id: metadata.profileId,
    tenantId: request.tenantId,
    createdAt: run.completedAt,
    lineage: {
      source: request.source,
      requestId: request.id,
      observationId: metadata.observationId,
      snapshotToken: run.snapshotToken,
      capturedAt: run.completedAt,
      capturedBy: metadata.capturedBy
    },
    dataClass: request.dataClass,
    requestedRelations: payload.requestedRelations,
    profiles: payload.profiles,
    denials: payload.denials,
    unavailableRelations: payload.unavailableRelations,
    coverage: {
      requested: payload.requestedRelations.length,
      profiled: payload.profiles.length,
      denied: payload.denials.length,
      unavailable: payload.unavailableRelations.length,
      complete:
        payload.profiles.length === payload.requestedRelations.length &&
        payload.denials.length === 0 &&
        payload.unavailableRelations.length === 0
    }
  })
}
