import { z } from 'zod'
import { canonicalJson, sha256Text } from '../canonical-json.js'
import {
  ActorSchema,
  IsoDateTimeSchema,
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

export const SourceCdcTraceIdSchema = sourceId('source_cdc_trace').brand<'SourceCdcTraceId'>()
export const SourceCdcAnalysisIdSchema =
  sourceId('source_cdc_analysis').brand<'SourceCdcAnalysisId'>()

const ROW_OPERATIONS = new Set(['snapshot-row', 'insert', 'update'])
const KEYED_OPERATIONS = new Set(['snapshot-row', 'insert', 'update', 'delete'])

const StateRecordSchema = z
  .strictObject({
    entity: z.string().min(1).max(512),
    key: z.record(z.string().min(1).max(128), z.union([z.string(), z.number(), z.boolean()])),
    value: z.json(),
    valueDigest: Sha256Schema
  })
  .superRefine((record, context) => {
    if (sha256Text(canonicalJson(record.value)) !== record.valueDigest) {
      context.addIssue({ code: 'custom', message: 'CDC state value digest differs' })
    }
  })

const CdcEventSchema = z
  .strictObject({
    sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    position: z.string().min(1).max(512),
    transactionId: z.string().min(1).max(256).nullable(),
    restartEpoch: z.number().int().nonnegative().max(1_000_000),
    operation: z.enum([
      'snapshot-row',
      'snapshot-complete',
      'insert',
      'update',
      'delete',
      'truncate',
      'ddl',
      'heartbeat',
      'checkpoint'
    ]),
    entity: z.string().min(1).max(512).nullable(),
    key: z
      .record(z.string().min(1).max(128), z.union([z.string(), z.number(), z.boolean()]))
      .nullable(),
    beforeDigest: Sha256Schema.nullable(),
    after: z.json().nullable(),
    afterDigest: Sha256Schema.nullable(),
    schemaVersion: z.string().min(1).max(128),
    occurredAt: IsoDateTimeSchema,
    capturedAt: IsoDateTimeSchema,
    resumeToken: z.string().min(1).max(512).nullable()
  })
  .superRefine((event, context) => {
    const rowOperation = ROW_OPERATIONS.has(event.operation)
    if (rowOperation !== (event.after !== null && event.afterDigest !== null)) {
      context.addIssue({ code: 'custom', message: 'CDC row operation and after state disagree' })
    }
    if (event.after !== null && sha256Text(canonicalJson(event.after)) !== event.afterDigest) {
      context.addIssue({ code: 'custom', message: 'CDC event after digest differs' })
    }
    const keyed = KEYED_OPERATIONS.has(event.operation)
    if (keyed !== (event.entity !== null && event.key !== null)) {
      context.addIssue({ code: 'custom', message: 'CDC keyed operation identity disagrees' })
    }
  })

export const SourceCdcTraceV1Schema = z
  .strictObject({
    ...tenantRecordFields('source-cdc-trace', SourceCdcTraceIdSchema),
    lineage: SourceDiscoveryLineageSchema,
    traceVersion: z.string().min(1).max(128),
    initialState: z.array(StateRecordSchema).max(1_000_000),
    events: z.array(CdcEventSchema).min(1).max(1_000_000),
    expectedFinalStateDigest: Sha256Schema,
    limitations: z.array(ShortTextSchema).max(64)
  })
  .superRefine((trace, context) => {
    trace.events.forEach((event, index) => {
      if (event.sequence !== index + 1) {
        context.addIssue({ code: 'custom', message: 'CDC event sequence must be contiguous' })
      }
    })
  })

export const SourceCdcAnalysisV1Schema = z
  .strictObject({
    ...tenantRecordFields('source-cdc-analysis', SourceCdcAnalysisIdSchema),
    traceId: SourceCdcTraceIdSchema,
    lineage: SourceDiscoveryLineageSchema,
    semantics: z.strictObject({
      snapshot: z.enum(['consistent-boundary', 'inconsistent', 'not-observed']),
      ordering: z.enum(['source-position-total', 'per-key', 'unordered', 'unknown']),
      transactions: z.enum(['atomic', 'partial', 'not-observed', 'unknown']),
      deletes: z.enum(['explicit', 'tombstone', 'not-observed', 'unknown']),
      amendments: z.enum(['ordered-update', 'append-correction', 'not-observed', 'unknown']),
      ddl: z.enum(['versioned-event', 'out-of-band', 'not-observed', 'unknown']),
      restart: z.enum(['resume-token', 'snapshot-restart', 'not-observed', 'unknown']),
      checkpoint: z.enum(['monotonic', 'regressed', 'not-observed', 'unknown']),
      lateEvents: z.enum(['ordered-by-position', 'discarded', 'not-observed', 'unknown'])
    }),
    eventDispositions: z.array(
      z.strictObject({
        sequence: z.number().int().positive(),
        position: z.string().min(1).max(512),
        disposition: z.enum(['applied', 'duplicate', 'ignored', 'invalid']),
        reason: ShortTextSchema
      })
    ),
    finalStateDigest: Sha256Schema,
    finalRecordCount: z.number().int().nonnegative(),
    gaps: z.array(ShortTextSchema).max(128),
    analyzedAt: IsoDateTimeSchema,
    analyzedBy: ActorSchema
  })
  .superRefine((analysis, context) => {
    if (analysis.eventDispositions.length === 0) {
      context.addIssue({ code: 'custom', message: 'CDC analysis requires event dispositions' })
    }
  })

export type SourceCdcTraceV1 = z.infer<typeof SourceCdcTraceV1Schema>
export type SourceCdcAnalysisV1 = z.infer<typeof SourceCdcAnalysisV1Schema>
