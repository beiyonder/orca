import { z } from 'zod'
import {
  ActorSchema,
  DataMovementReportIdSchema,
  EvidenceIdSchema,
  IsoDateTimeSchema,
  Sha256Schema,
  ShortTextSchema,
  tenantRecordFields,
  uniqueIdArray
} from './common-contracts.js'
import { SourceCdcAnalysisIdSchema, SourceCdcTraceIdSchema } from './source-cdc-contracts.js'

export const DataMovementEvaluationReportV1Schema = z
  .strictObject({
    ...tenantRecordFields('data-movement-evaluation-report', DataMovementReportIdSchema),
    traceId: SourceCdcTraceIdSchema,
    traceDigest: Sha256Schema,
    analysisId: SourceCdcAnalysisIdSchema,
    analysisDigest: Sha256Schema,
    oracleDigest: Sha256Schema,
    checks: z.strictObject({
      countsExact: z.boolean(),
      keysExact: z.boolean(),
      deletesComplete: z.boolean(),
      orderingValid: z.boolean(),
      watermarkExact: z.boolean(),
      replayExact: z.boolean(),
      dispositionsComplete: z.boolean()
    }),
    observed: z.strictObject({
      initialRecordCount: z.number().int().nonnegative(),
      finalRecordCount: z.number().int().nonnegative(),
      finalKeyDigests: z.array(Sha256Schema).max(1_000_000),
      appliedDeleteSequences: z.array(z.number().int().positive()).max(1_000_000),
      finalPosition: z.string().min(1).max(512),
      finalResumeToken: z.string().min(1).max(512).nullable(),
      dispositionCount: z.number().int().nonnegative(),
      invalidDispositionCount: z.number().int().nonnegative()
    }),
    status: z.enum(['passed', 'failed']),
    evidenceIds: uniqueIdArray(EvidenceIdSchema, { min: 1, max: 10_000, label: 'evidenceIds' }),
    evaluatedAt: IsoDateTimeSchema,
    evaluatedBy: ActorSchema,
    limitations: z.array(ShortTextSchema).max(64),
    acceptanceAuthority: z.literal('none')
  })
  .superRefine((report, context) => {
    const passed = Object.values(report.checks).every(Boolean)
    if ((report.status === 'passed') !== passed) {
      context.addIssue({ code: 'custom', message: 'Data movement status disagrees with checks' })
    }
    if (new Set(report.observed.finalKeyDigests).size !== report.observed.finalKeyDigests.length) {
      context.addIssue({ code: 'custom', message: 'Observed final key digests must be unique' })
    }
  })

export type DataMovementEvaluationReportV1 = z.infer<typeof DataMovementEvaluationReportV1Schema>
