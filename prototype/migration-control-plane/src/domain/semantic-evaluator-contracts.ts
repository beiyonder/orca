import { z } from 'zod'
import {
  ActorSchema,
  IsoDateTimeSchema,
  SemanticCorpusIdSchema,
  SemanticReportIdSchema,
  Sha256Schema,
  ShortTextSchema,
  tenantRecordFields
} from './common-contracts.js'

const SemanticLabelSchema = z.enum(['accept', 'reject'])

export const SemanticLabeledCorpusV1Schema = z
  .strictObject({
    ...tenantRecordFields('semantic-labeled-corpus', SemanticCorpusIdSchema),
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    predecessorCorpusId: SemanticCorpusIdSchema.nullable(),
    split: z.literal('held-out'),
    labelsVisibleToProducer: z.literal(false),
    cases: z
      .array(
        z.strictObject({
          id: z.string().min(1).max(128),
          groupId: z.string().min(1).max(128),
          claimClass: z.string().min(1).max(128),
          inputDigest: Sha256Schema,
          label: SemanticLabelSchema,
          rationale: ShortTextSchema
        })
      )
      .min(10)
      .max(10_000),
    minimumAccuracy: z.number().min(0).max(1),
    maximumFalseAccepts: z.number().int().nonnegative().max(10_000),
    maximumDisagreements: z.number().int().nonnegative().max(10_000),
    labeledBy: ActorSchema,
    limitations: z.array(ShortTextSchema).max(64)
  })
  .superRefine((corpus, context) => {
    const ids = corpus.cases.map((item) => item.id)
    const groups = corpus.cases.map((item) => item.groupId)
    if (new Set(ids).size !== ids.length || new Set(groups).size !== groups.length) {
      context.addIssue({ code: 'custom', message: 'Semantic cases and groups must be unique' })
    }
    if ((corpus.version === 1) !== (corpus.predecessorCorpusId === null)) {
      context.addIssue({ code: 'custom', message: 'Semantic corpus predecessor lineage disagrees' })
    }
  })

export const SemanticEvaluationReportV1Schema = z
  .strictObject({
    ...tenantRecordFields('semantic-evaluation-report', SemanticReportIdSchema),
    corpusId: SemanticCorpusIdSchema,
    corpusDigest: Sha256Schema,
    evaluatorVersion: z.string().min(1).max(128),
    cases: z.array(
      z.strictObject({
        id: z.string().min(1).max(128),
        expected: SemanticLabelSchema,
        primary: SemanticLabelSchema.nullable(),
        secondary: SemanticLabelSchema.nullable(),
        disposition: z.enum(['correct', 'incorrect', 'abstained', 'disagreement'])
      })
    ),
    totals: z.strictObject({
      cases: z.number().int().nonnegative(),
      correct: z.number().int().nonnegative(),
      incorrect: z.number().int().nonnegative(),
      abstained: z.number().int().nonnegative(),
      disagreements: z.number().int().nonnegative(),
      falseAccepts: z.number().int().nonnegative(),
      accuracy: z.number().min(0).max(1)
    }),
    thresholds: z.strictObject({
      minimumAccuracy: z.number().min(0).max(1),
      maximumFalseAccepts: z.number().int().nonnegative(),
      maximumDisagreements: z.number().int().nonnegative()
    }),
    status: z.enum(['passed', 'failed', 'inconclusive']),
    evaluatedAt: IsoDateTimeSchema,
    evaluatedBy: ActorSchema,
    limitations: z.array(ShortTextSchema).max(64),
    acceptanceAuthority: z.literal('none')
  })
  .superRefine((report, context) => {
    const totals = {
      cases: report.cases.length,
      correct: report.cases.filter((item) => item.disposition === 'correct').length,
      incorrect: report.cases.filter((item) => item.disposition === 'incorrect').length,
      abstained: report.cases.filter((item) => item.disposition === 'abstained').length,
      disagreements: report.cases.filter((item) => item.disposition === 'disagreement').length,
      falseAccepts: report.cases.filter(
        (item) => item.expected === 'reject' && item.primary === 'accept'
      ).length
    }
    const accuracy = totals.cases === 0 ? 0 : totals.correct / totals.cases
    if (
      report.totals.cases !== totals.cases ||
      report.totals.correct !== totals.correct ||
      report.totals.incorrect !== totals.incorrect ||
      report.totals.abstained !== totals.abstained ||
      report.totals.disagreements !== totals.disagreements ||
      report.totals.falseAccepts !== totals.falseAccepts ||
      report.totals.accuracy !== accuracy
    ) {
      context.addIssue({ code: 'custom', message: 'Semantic report totals disagree with cases' })
    }
    const decisive = totals.abstained === 0 && totals.disagreements === 0
    const passed =
      decisive &&
      accuracy >= report.thresholds.minimumAccuracy &&
      totals.falseAccepts <= report.thresholds.maximumFalseAccepts
    const status = passed ? 'passed' : decisive ? 'failed' : 'inconclusive'
    if (report.status !== status) {
      context.addIssue({ code: 'custom', message: 'Semantic report status disagrees' })
    }
  })

export type SemanticLabeledCorpusV1 = z.infer<typeof SemanticLabeledCorpusV1Schema>
export type SemanticEvaluationReportV1 = z.infer<typeof SemanticEvaluationReportV1Schema>
