import { z } from 'zod'
import { canonicalJson, sha256Text } from './canonical-json.js'
import {
  SourceCodeExtractV1Schema,
  type SourceCodeExtractV1
} from './domain/source-code-lineage-contracts.js'
import type { ContentReference } from './domain/common-contracts.js'
import type { SourceRequestV1 } from './domain/source-probe-contracts.js'
import type { PostgresSourceSandboxResult, SourceReadSession } from './postgres-source-sandbox.js'

const CodeParametersSchema = z.strictObject({
  schemas: z.array(z.string().min(1).max(256)).min(1).max(128),
  kinds: z
    .array(z.enum(['view', 'materialized-view', 'function', 'procedure', 'trigger']))
    .min(1)
    .max(5)
})

type ExtractedDefinition = {
  schema: string
  name: string
  identity: string
  kind: 'view' | 'materialized-view' | 'function' | 'procedure' | 'trigger'
  language: string
  definition: string
}

export type PostgresCodePayload = {
  artifactBody: string
  definitions: ExtractedDefinition[]
  requestedKinds: string[]
  denied: string[]
  unavailable: string[]
}

type CodeMetadata = {
  codeExtractId: string
  observationId: string
  capturedBy: SourceCodeExtractV1['lineage']['capturedBy']
  artifact: ContentReference
}

export async function collectPostgresCode(
  session: SourceReadSession,
  request: SourceRequestV1
): Promise<PostgresCodePayload> {
  const parameters = CodeParametersSchema.parse(request.parameters)
  const schemas = [...new Set(parameters.schemas)].toSorted()
  const kinds = new Set(parameters.kinds)
  const [relations, routines, triggers] = await Promise.all([
    kinds.has('view') || kinds.has('materialized-view')
      ? session.query<{
          definition: string
          kind: 'm' | 'v'
          name: string
          schema: string
        }>(
          `SELECT n.nspname AS schema, c.relname AS name, c.relkind AS kind,
                  pg_get_viewdef(c.oid, true) AS definition
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = ANY($1::text[]) AND c.relkind IN ('v', 'm')
           ORDER BY n.nspname, c.relname`,
          [schemas]
        )
      : [],
    kinds.has('function') || kinds.has('procedure')
      ? session.query<{
          definition: string
          identity_arguments: string
          kind: 'f' | 'p'
          language: string
          name: string
          schema: string
        }>(
          `SELECT n.nspname AS schema, p.proname AS name, p.prokind AS kind,
                  pg_get_function_identity_arguments(p.oid) AS identity_arguments,
                  l.lanname AS language, pg_get_functiondef(p.oid) AS definition
           FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
           JOIN pg_language l ON l.oid = p.prolang
           WHERE n.nspname = ANY($1::text[]) AND p.prokind IN ('f', 'p')
           ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)`,
          [schemas]
        )
      : [],
    kinds.has('trigger')
      ? session.query<{
          definition: string
          name: string
          relation: string
          schema: string
        }>(
          `SELECT n.nspname AS schema, c.relname AS relation, t.tgname AS name,
                  pg_get_triggerdef(t.oid, true) AS definition
           FROM pg_trigger t
           JOIN pg_class c ON c.oid = t.tgrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = ANY($1::text[]) AND NOT t.tgisinternal
           ORDER BY n.nspname, c.relname, t.tgname`,
          [schemas]
        )
      : []
  ])
  const definitions: ExtractedDefinition[] = [
    ...relations.flatMap((row) => {
      const kind: ExtractedDefinition['kind'] = row.kind === 'v' ? 'view' : 'materialized-view'
      return kinds.has(kind)
        ? [
            {
              schema: row.schema,
              name: row.name,
              identity: `${row.schema}.${row.name}`,
              kind,
              language: 'sql',
              definition: row.definition
            }
          ]
        : []
    }),
    ...routines.flatMap((row) => {
      const kind: ExtractedDefinition['kind'] = row.kind === 'p' ? 'procedure' : 'function'
      return kinds.has(kind)
        ? [
            {
              schema: row.schema,
              name: row.name,
              identity: `${row.schema}.${row.name}(${row.identity_arguments})`,
              kind,
              language: row.language,
              definition: row.definition
            }
          ]
        : []
    }),
    ...triggers.map((row) => ({
      schema: row.schema,
      name: row.name,
      identity: `${row.schema}.${row.relation}.${row.name}`,
      kind: 'trigger' as const,
      language: 'trigger',
      definition: row.definition
    }))
  ].toSorted((left, right) => left.identity.localeCompare(right.identity))
  return {
    artifactBody: canonicalJson({
      schemaVersion: 1,
      source: request.source,
      snapshotRequestId: request.id,
      definitions: definitions.map(({ identity, kind, language, definition }) => ({
        identity,
        kind,
        language,
        definition
      }))
    }),
    definitions,
    requestedKinds: [...kinds].toSorted(),
    denied: [],
    unavailable: []
  }
}

export function buildPostgresCodeExtract(
  request: SourceRequestV1,
  run: PostgresSourceSandboxResult<PostgresCodePayload>,
  metadata: CodeMetadata
): SourceCodeExtractV1 {
  const payload = run.value
  return SourceCodeExtractV1Schema.parse({
    schemaVersion: 1,
    kind: 'source-code-extract',
    id: metadata.codeExtractId,
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
    artifact: metadata.artifact,
    contentDigest: sha256Text(payload.artifactBody),
    objects: payload.definitions.map((definition, index) => ({
      object: {
        schema: definition.schema,
        name: definition.name,
        identity: definition.identity
      },
      kind: definition.kind,
      language: definition.language,
      definitionDigest: sha256Text(definition.definition),
      artifactPointer: `/definitions/${index}`,
      dependencyHints: [],
      limitations: ['Catalog lineage is resolved separately from extracted source text.']
    })),
    coverage: {
      requestedKinds: payload.requestedKinds,
      extracted: payload.definitions.length,
      denied: payload.denied,
      unavailable: payload.unavailable,
      complete: payload.denied.length === 0 && payload.unavailable.length === 0
    }
  })
}
