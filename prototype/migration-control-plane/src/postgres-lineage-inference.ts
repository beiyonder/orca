import { canonicalJson, sha256Text } from './canonical-json.js'
import {
  SourceLineageSnapshotV1Schema,
  type SourceLineageSnapshotV1
} from './domain/source-code-lineage-contracts.js'
import type { SourceSchemaInventoryV1 } from './domain/source-inventory-contracts.js'
import type { SourceRequestV1 } from './domain/source-probe-contracts.js'
import type { PostgresSourceSandboxResult, SourceReadSession } from './postgres-source-sandbox.js'

type RawEdge = {
  identity: string
  from: string
  to: string
  kind: SourceLineageSnapshotV1['edges'][number]['kind']
  method: SourceLineageSnapshotV1['edges'][number]['method']
}

export type PostgresLineagePayload = {
  catalogEdges: RawEdge[]
}

type LineageMetadata = {
  lineageSnapshotId: string
  observationId: string
  evidenceIds: [string, ...string[]]
  capturedBy: SourceLineageSnapshotV1['lineage']['capturedBy']
}

const relationId = (schema: string, name: string) => `relation:${schema}.${name}`
const columnId = (schema: string, relation: string, column: string) =>
  `column:${schema}.${relation}.${column}`
const routineId = (schema: string, name: string, identityArguments: string) =>
  `routine:${schema}.${name}(${identityArguments})`
const triggerId = (schema: string, relation: string, trigger: string) =>
  `trigger:${schema}.${relation}.${trigger}`
const sequenceId = (schema: string, name: string) => `sequence:${schema}.${name}`
const typeId = (schema: string, name: string) => `type:${schema}.${name}`

export async function collectPostgresLineage(
  session: SourceReadSession,
  request: SourceRequestV1
): Promise<PostgresLineagePayload> {
  const schemas = Array.isArray((request.parameters as Record<string, unknown>).schemas)
    ? ((request.parameters as Record<string, unknown>).schemas as unknown[]).map(String)
    : []
  const [viewRows, triggerRows, dependencyRows] = await Promise.all([
    session.query<{
      from_name: string
      from_schema: string
      to_name: string
      to_schema: string
    }>(
      `SELECT DISTINCT vn.nspname AS from_schema, v.relname AS from_name,
                       rn.nspname AS to_schema, r.relname AS to_name
       FROM pg_rewrite rw
       JOIN pg_class v ON v.oid = rw.ev_class
       JOIN pg_namespace vn ON vn.oid = v.relnamespace
       JOIN pg_depend d ON d.classid = 'pg_rewrite'::regclass AND d.objid = rw.oid
       JOIN pg_class r ON r.oid = d.refobjid
       JOIN pg_namespace rn ON rn.oid = r.relnamespace
       WHERE vn.nspname = ANY($1::text[]) AND rn.nspname = ANY($1::text[])
         AND v.relkind IN ('v', 'm') AND r.oid <> v.oid
       ORDER BY vn.nspname, v.relname, rn.nspname, r.relname`,
      [schemas]
    ),
    session.query<{
      function_arguments: string
      function_name: string
      function_schema: string
      relation_name: string
      relation_schema: string
      trigger_name: string
    }>(
      `SELECT n.nspname AS relation_schema, c.relname AS relation_name,
              t.tgname AS trigger_name, pn.nspname AS function_schema,
              p.proname AS function_name,
              pg_get_function_identity_arguments(p.oid) AS function_arguments
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_proc p ON p.oid = t.tgfoid
       JOIN pg_namespace pn ON pn.oid = p.pronamespace
       WHERE n.nspname = ANY($1::text[]) AND NOT t.tgisinternal
       ORDER BY n.nspname, c.relname, t.tgname`,
      [schemas]
    ),
    session.query<{
      column_name: string | null
      from_arguments: string | null
      from_kind: 'routine' | 'sequence'
      from_name: string
      from_schema: string
      to_name: string
      to_schema: string
    }>(
      `SELECT 'sequence'::text AS from_kind, sn.nspname AS from_schema,
              s.relname AS from_name, NULL::text AS from_arguments,
              tn.nspname AS to_schema, t.relname AS to_name, a.attname AS column_name
       FROM pg_depend d
       JOIN pg_class s ON s.oid = d.objid AND s.relkind = 'S'
       JOIN pg_namespace sn ON sn.oid = s.relnamespace
       JOIN pg_class t ON t.oid = d.refobjid
       JOIN pg_namespace tn ON tn.oid = t.relnamespace
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
       WHERE d.classid = 'pg_class'::regclass AND d.refclassid = 'pg_class'::regclass
         AND d.deptype IN ('a', 'i') AND sn.nspname = ANY($1::text[])
       UNION ALL
       SELECT 'routine', pn.nspname, p.proname,
              pg_get_function_identity_arguments(p.oid), rn.nspname, r.relname, NULL
       FROM pg_depend d
       JOIN pg_proc p ON p.oid = d.objid
       JOIN pg_namespace pn ON pn.oid = p.pronamespace
       JOIN pg_class r ON r.oid = d.refobjid
       JOIN pg_namespace rn ON rn.oid = r.relnamespace
       WHERE d.classid = 'pg_proc'::regclass AND d.refclassid = 'pg_class'::regclass
         AND pn.nspname = ANY($1::text[]) AND rn.nspname = ANY($1::text[])
       ORDER BY from_kind, from_schema, from_name, to_schema, to_name`,
      [schemas]
    )
  ])
  return {
    catalogEdges: [
      ...viewRows.map((row) => ({
        identity: `view:${row.from_schema}.${row.from_name}->${row.to_schema}.${row.to_name}`,
        from: relationId(row.from_schema, row.from_name),
        to: relationId(row.to_schema, row.to_name),
        kind: 'view-depends-on' as const,
        method: 'catalog-declared' as const
      })),
      ...triggerRows.map((row) => ({
        identity: `trigger:${row.relation_schema}.${row.relation_name}.${row.trigger_name}`,
        from: triggerId(row.relation_schema, row.relation_name, row.trigger_name),
        to: routineId(row.function_schema, row.function_name, row.function_arguments),
        kind: 'trigger-invokes' as const,
        method: 'catalog-declared' as const
      })),
      ...dependencyRows.map((row) => ({
        identity: `${row.from_kind}:${row.from_schema}.${row.from_name}->${row.to_schema}.${row.to_name}.${row.column_name ?? ''}`,
        from:
          row.from_kind === 'sequence'
            ? sequenceId(row.from_schema, row.from_name)
            : routineId(row.from_schema, row.from_name, row.from_arguments ?? ''),
        to:
          row.column_name === null
            ? relationId(row.to_schema, row.to_name)
            : columnId(row.to_schema, row.to_name, row.column_name),
        kind:
          row.from_kind === 'sequence'
            ? ('sequence-owned-by' as const)
            : ('routine-depends-on' as const),
        method: 'catalog-declared' as const
      }))
    ]
  }
}

export function buildPostgresLineageSnapshot(
  request: SourceRequestV1,
  inventory: SourceSchemaInventoryV1,
  run: PostgresSourceSandboxResult<PostgresLineagePayload>,
  metadata: LineageMetadata
): SourceLineageSnapshotV1 {
  const nodes: SourceLineageSnapshotV1['nodes'] = [
    ...inventory.relations.map((relation) => ({
      id: relationId(relation.schema, relation.name),
      kind: 'relation' as const,
      qualifiedName: `${relation.schema}.${relation.name}`,
      definitionDigest: null
    })),
    ...inventory.columns.map((column) => ({
      id: columnId(column.schema, column.name, column.column),
      kind: 'column' as const,
      qualifiedName: `${column.schema}.${column.name}.${column.column}`,
      definitionDigest: column.defaultDigest
    })),
    ...inventory.routines.map((routine) => ({
      id: routineId(routine.schema, routine.name, routine.identityArguments),
      kind: 'routine' as const,
      qualifiedName: `${routine.schema}.${routine.name}(${routine.identityArguments})`,
      definitionDigest: routine.definitionDigest
    })),
    ...inventory.triggers.map((trigger) => ({
      id: triggerId(trigger.schema, trigger.name, trigger.trigger),
      kind: 'trigger' as const,
      qualifiedName: `${trigger.schema}.${trigger.name}.${trigger.trigger}`,
      definitionDigest: trigger.definitionDigest
    })),
    ...inventory.sequences.map((sequence) => ({
      id: sequenceId(sequence.schema, sequence.name),
      kind: 'sequence' as const,
      qualifiedName: `${sequence.schema}.${sequence.name}`,
      definitionDigest: null
    })),
    ...inventory.customTypes.map((type) => ({
      id: typeId(type.schema, type.name),
      kind: 'type' as const,
      qualifiedName: `${type.schema}.${type.name}`,
      definitionDigest: type.definitionDigest
    }))
  ].toSorted((left, right) => left.id.localeCompare(right.id))
  const declared: RawEdge[] = [
    ...inventory.constraints.flatMap((constraint) =>
      constraint.kind === 'foreign-key' && constraint.referencedRelation
        ? [
            {
              identity: `constraint:${constraint.schema}.${constraint.name}.${constraint.constraint}`,
              from: relationId(constraint.schema, constraint.name),
              to: relationId(
                constraint.referencedRelation.schema,
                constraint.referencedRelation.name
              ),
              kind: 'foreign-key' as const,
              method: 'catalog-declared' as const
            }
          ]
        : []
    ),
    ...inventory.relations.flatMap((relation) =>
      relation.parent
        ? [
            {
              identity: `partition:${relation.schema}.${relation.name}`,
              from: relationId(relation.schema, relation.name),
              to: relationId(relation.parent.schema, relation.parent.name),
              kind: 'partition-of' as const,
              method: 'catalog-declared' as const
            }
          ]
        : []
    ),
    ...run.value.catalogEdges
  ]
  const uniqueDeclared = [...new Map(declared.map((edge) => [canonicalJson(edge), edge])).values()]
  const nodeIds = new Set(nodes.map((node) => node.id))
  const unresolved = uniqueDeclared.filter(
    (edge) => !nodeIds.has(edge.from) || !nodeIds.has(edge.to)
  )
  const edges = uniqueDeclared
    .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
    .map((edge) => ({
      id: `lineage_edge_${sha256Text(canonicalJson(edge)).slice(0, 24)}`,
      fromNodeId: edge.from,
      toNodeId: edge.to,
      kind: edge.kind,
      method: edge.method,
      confidence: 'observed' as const,
      evidenceIds: metadata.evidenceIds,
      limitations: []
    }))
    .toSorted((left, right) => left.id.localeCompare(right.id))
  return SourceLineageSnapshotV1Schema.parse({
    schemaVersion: 1,
    kind: 'source-lineage-snapshot',
    id: metadata.lineageSnapshotId,
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
    nodes,
    edges,
    methodsAttempted: [
      {
        method: 'catalog-declared',
        status: 'complete',
        evidenceId: metadata.evidenceIds[0],
        reason: null
      },
      {
        method: 'static-analysis',
        status: 'partial',
        evidenceId: metadata.evidenceIds[0],
        reason: 'Definitions extracted; unresolved references retained.'
      },
      {
        method: 'query-log',
        status: 'unavailable',
        evidenceId: metadata.evidenceIds[0],
        reason: 'No query log fixture is present.'
      },
      {
        method: 'runtime-trace',
        status: 'unavailable',
        evidenceId: metadata.evidenceIds[0],
        reason: 'No runtime trace fixture is present.'
      }
    ],
    unresolvedReferences: unresolved.map((edge) => ({
      fromNodeId: edge.from,
      reference: edge.to
    }))
  })
}
