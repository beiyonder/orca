import { z } from 'zod'
import { canonicalJson, sha256Text } from '../canonical-json.js'
import {
  ActorSchema,
  ContentReferenceSchema,
  DataClassSchema,
  EvidenceIdSchema,
  IsoDateTimeSchema,
  ProbeIdSchema,
  Sha256Schema,
  ShortTextSchema,
  tenantRecordFields
} from './common-contracts.js'
import {
  SourceAccessEnvelopeIdSchema,
  SourceAdapterDefinitionIdSchema,
  SourceAdapterErrorCodeSchema,
  SourceBindingSchema,
  SourceOperationSchema,
  SourceReadLimitsSchema
} from './source-adapter-contracts.js'

const sourceId = (prefix: string) =>
  z
    .string()
    .min(prefix.length + 2)
    .max(128)
    .regex(new RegExp(`^${prefix}_[a-z0-9][a-z0-9_-]{0,111}$`))

export const SourceRequestIdSchema = sourceId('source_request').brand<'SourceRequestId'>()
export const SourceObservationIdSchema =
  sourceId('source_observation').brand<'SourceObservationId'>()

export const SourceRequestV1Schema = z
  .strictObject({
    ...tenantRecordFields('source-request', SourceRequestIdSchema),
    adapterDefinitionId: SourceAdapterDefinitionIdSchema,
    accessEnvelopeId: SourceAccessEnvelopeIdSchema,
    operation: SourceOperationSchema,
    source: SourceBindingSchema,
    parameters: z.json(),
    parameterDigest: Sha256Schema,
    limits: SourceReadLimitsSchema,
    expectedSnapshotToken: z.string().min(1).max(512).nullable(),
    probeRequestId: ProbeIdSchema.nullable(),
    dataClass: DataClassSchema,
    requestedBy: ActorSchema
  })
  .superRefine((request, context) => {
    if (sha256Text(canonicalJson(request.parameters)) !== request.parameterDigest) {
      context.addIssue({ code: 'custom', message: 'Source request parameter digest differs' })
    }
  })

const ObservationEvidenceSchema = z.strictObject({
  evidenceId: EvidenceIdSchema,
  artifact: ContentReferenceSchema,
  role: z.enum([
    'system-inventory',
    'schema-inventory',
    'data-profile',
    'code-extract',
    'lineage-edge',
    'cdc-trace',
    'probe-result',
    'capability-observation',
    'denial'
  ]),
  dataClass: DataClassSchema,
  rowCount: z.number().int().nonnegative().nullable(),
  complete: z.boolean(),
  limitations: z.array(ShortTextSchema).max(64)
})

const CoverageSchema = z.strictObject({
  requested: z.array(z.string().min(1).max(256)).max(10_000),
  observed: z.array(z.string().min(1).max(256)).max(10_000),
  denied: z.array(z.string().min(1).max(256)).max(10_000),
  unavailable: z.array(z.string().min(1).max(256)).max(10_000),
  complete: z.boolean()
})

const SuccessfulOutcomeSchema = z.strictObject({
  status: z.enum(['succeeded', 'partial']),
  evidence: z.array(ObservationEvidenceSchema).min(1).max(10_000),
  coverage: CoverageSchema,
  warnings: z.array(ShortTextSchema).max(256)
})

const DeniedOutcomeSchema = z.strictObject({
  status: z.literal('denied'),
  code: z.literal('access-denied'),
  denialEvidenceId: EvidenceIdSchema,
  scope: z.string().min(1).max(512),
  reason: ShortTextSchema,
  absenceConclusion: z.literal(false),
  retry: z.enum(['never', 'after-permission-change'])
})

const FailedOutcomeSchema = z.strictObject({
  status: z.literal('failed'),
  code: SourceAdapterErrorCodeSchema.exclude(['access-denied', 'cancelled']),
  reason: ShortTextSchema,
  retry: z.enum(['never', 'same-snapshot', 'after-reconnect', 'after-permission-change']),
  partialEvidence: z.array(ObservationEvidenceSchema).max(10_000)
})

const CancelledOutcomeSchema = z.strictObject({
  status: z.literal('cancelled'),
  code: z.literal('cancelled'),
  reason: ShortTextSchema,
  partialEvidence: z.array(ObservationEvidenceSchema).max(10_000)
})

export const SourceObservationV1Schema = z
  .strictObject({
    ...tenantRecordFields('source-observation', SourceObservationIdSchema),
    requestId: SourceRequestIdSchema,
    adapterDefinitionId: SourceAdapterDefinitionIdSchema,
    accessEnvelopeId: SourceAccessEnvelopeIdSchema,
    operation: SourceOperationSchema,
    source: SourceBindingSchema,
    observedSnapshotToken: z.string().min(1).max(512).nullable(),
    outcome: z.discriminatedUnion('status', [
      SuccessfulOutcomeSchema,
      DeniedOutcomeSchema,
      FailedOutcomeSchema,
      CancelledOutcomeSchema
    ]),
    usage: z.strictObject({
      queryCount: z.number().int().nonnegative(),
      rowCount: z.number().int().nonnegative(),
      byteCount: z.number().int().nonnegative(),
      wallTimeMs: z.number().int().nonnegative()
    }),
    startedAt: IsoDateTimeSchema,
    completedAt: IsoDateTimeSchema,
    observedBy: ActorSchema
  })
  .superRefine((observation, context) => {
    if (Date.parse(observation.completedAt) < Date.parse(observation.startedAt)) {
      context.addIssue({ code: 'custom', message: 'Source observation completes before start' })
    }
    if (observation.outcome.status === 'succeeded' && !observation.outcome.coverage.complete) {
      context.addIssue({ code: 'custom', message: 'Successful observation requires full coverage' })
    }
  })

export type SourceRequestV1 = z.infer<typeof SourceRequestV1Schema>
export type SourceObservationV1 = z.infer<typeof SourceObservationV1Schema>
