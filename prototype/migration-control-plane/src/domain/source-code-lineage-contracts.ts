import { z } from 'zod'
import {
  ContentReferenceSchema,
  Sha256Schema,
  ShortTextSchema,
  tenantRecordFields
} from './common-contracts.js'
import { SourceDiscoveryLineageSchema } from './source-inventory-contracts.js'

const sourceId = (prefix: string) =>
  z
    .string()
    .min(prefix.length + 2)
    .max(128)
    .regex(new RegExp(`^${prefix}_[a-z0-9][a-z0-9_-]{0,111}$`))

export const SourceCodeExtractIdSchema =
  sourceId('source_code_extract').brand<'SourceCodeExtractId'>()
export const SourceLineageSnapshotIdSchema =
  sourceId('source_lineage_snapshot').brand<'SourceLineageSnapshotId'>()

const QualifiedObjectSchema = z.strictObject({
  schema: z.string().min(1).max(256),
  name: z.string().min(1).max(256),
  identity: z.string().min(1).max(1_024)
})

export const SourceCodeExtractV1Schema = z
  .strictObject({
    ...tenantRecordFields('source-code-extract', SourceCodeExtractIdSchema),
    lineage: SourceDiscoveryLineageSchema,
    artifact: ContentReferenceSchema,
    contentDigest: Sha256Schema,
    objects: z.array(
      z.strictObject({
        object: QualifiedObjectSchema,
        kind: z.enum(['view', 'materialized-view', 'function', 'procedure', 'trigger']),
        language: z.string().min(1).max(128),
        definitionDigest: Sha256Schema,
        artifactPointer: z.string().min(1).max(1_024),
        dependencyHints: z.array(z.string().min(1).max(512)).max(10_000),
        limitations: z.array(ShortTextSchema).max(64)
      })
    ),
    coverage: z.strictObject({
      requestedKinds: z.array(z.string().min(1).max(128)),
      extracted: z.number().int().nonnegative(),
      denied: z.array(z.string().min(1).max(512)),
      unavailable: z.array(z.string().min(1).max(512)),
      complete: z.boolean()
    })
  })
  .superRefine((extract, context) => {
    if (extract.artifact.sha256 !== extract.contentDigest) {
      context.addIssue({ code: 'custom', message: 'Source code artifact digest differs' })
    }
    if (extract.coverage.extracted !== extract.objects.length) {
      context.addIssue({ code: 'custom', message: 'Source code coverage count disagrees' })
    }
  })

const LineageNodeSchema = z.strictObject({
  id: z.string().min(1).max(512),
  kind: z.enum(['relation', 'column', 'routine', 'trigger', 'sequence', 'type', 'external']),
  qualifiedName: z.string().min(1).max(1_024),
  definitionDigest: Sha256Schema.nullable()
})

const LineageEdgeSchema = z.strictObject({
  id: z.string().min(1).max(512),
  fromNodeId: z.string().min(1).max(512),
  toNodeId: z.string().min(1).max(512),
  kind: z.enum([
    'foreign-key',
    'partition-of',
    'view-depends-on',
    'routine-depends-on',
    'trigger-invokes',
    'sequence-owned-by',
    'declared',
    'query-log',
    'runtime-observed'
  ]),
  method: z.enum(['catalog-declared', 'static-analysis', 'query-log', 'runtime-trace']),
  confidence: z.enum(['observed', 'inferred']),
  evidenceIds: z.array(z.string().min(1).max(128)).min(1).max(1_000),
  limitations: z.array(ShortTextSchema).max(64)
})

export const SourceLineageSnapshotV1Schema = z
  .strictObject({
    ...tenantRecordFields('source-lineage-snapshot', SourceLineageSnapshotIdSchema),
    lineage: SourceDiscoveryLineageSchema,
    nodes: z.array(LineageNodeSchema).max(100_000),
    edges: z.array(LineageEdgeSchema).max(500_000),
    methodsAttempted: z.array(
      z.strictObject({
        method: z.enum(['catalog-declared', 'static-analysis', 'query-log', 'runtime-trace']),
        status: z.enum(['complete', 'partial', 'denied', 'unavailable']),
        evidenceId: z.string().min(1).max(128),
        reason: ShortTextSchema.nullable()
      })
    ),
    unresolvedReferences: z.array(
      z.strictObject({
        fromNodeId: z.string().min(1).max(512),
        reference: z.string().min(1).max(1_024)
      })
    )
  })
  .superRefine((snapshot, context) => {
    const nodes = new Set(snapshot.nodes.map((node) => node.id))
    if (nodes.size !== snapshot.nodes.length) {
      context.addIssue({ code: 'custom', message: 'Lineage node identities must be unique' })
    }
    if (snapshot.edges.some((edge) => !nodes.has(edge.fromNodeId) || !nodes.has(edge.toNodeId))) {
      context.addIssue({ code: 'custom', message: 'Lineage edge endpoint is missing' })
    }
    if (new Set(snapshot.edges.map((edge) => edge.id)).size !== snapshot.edges.length) {
      context.addIssue({ code: 'custom', message: 'Lineage edge identities must be unique' })
    }
  })

export type SourceCodeExtractV1 = z.infer<typeof SourceCodeExtractV1Schema>
export type SourceLineageSnapshotV1 = z.infer<typeof SourceLineageSnapshotV1Schema>
