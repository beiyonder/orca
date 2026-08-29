import { z } from 'zod'
import { sha256Text } from '../canonical-json.js'
import {
  ActorSchema,
  ArtifactBuildBundleIdSchema,
  ArtifactBuildReportIdSchema,
  EvidenceIdSchema,
  IsoDateTimeSchema,
  Sha256Schema,
  ShortTextSchema,
  missionRecordFields,
  uniqueIdArray
} from './common-contracts.js'

const ArtifactBuildFileSchema = z
  .strictObject({
    path: z
      .string()
      .min(1)
      .max(512)
      .regex(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-zA-Z0-9._/-]+$/),
    mediaType: z.enum(['application/typescript', 'application/json']),
    content: z.string().max(1_048_576),
    sha256: Sha256Schema
  })
  .superRefine((file, context) => {
    if (sha256Text(file.content) !== file.sha256) {
      context.addIssue({ code: 'custom', message: 'Artifact file digest differs' })
    }
  })

export const ArtifactBuildBundleV1Schema = z
  .strictObject({
    ...missionRecordFields('artifact-build-bundle', ArtifactBuildBundleIdSchema),
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    predecessorBundleId: ArtifactBuildBundleIdSchema.nullable(),
    entrypoint: z.string().min(1).max(512),
    files: z.array(ArtifactBuildFileSchema).min(1).max(256),
    compiler: z.strictObject({
      name: z.literal('typescript'),
      version: z.string().min(1).max(128),
      optionsDigest: Sha256Schema
    }),
    provenanceEvidenceIds: uniqueIdArray(EvidenceIdSchema, {
      min: 1,
      max: 10_000,
      label: 'provenanceEvidenceIds'
    }),
    generatedBy: ActorSchema,
    authority: z.literal('proposal-only')
  })
  .superRefine((bundle, context) => {
    const paths = bundle.files.map((file) => file.path)
    if (new Set(paths).size !== paths.length) {
      context.addIssue({ code: 'custom', message: 'Artifact bundle paths must be unique' })
    }
    if (!paths.includes(bundle.entrypoint)) {
      context.addIssue({ code: 'custom', message: 'Artifact entrypoint must exist in bundle' })
    }
    if ((bundle.version === 1) !== (bundle.predecessorBundleId === null)) {
      context.addIssue({ code: 'custom', message: 'Artifact predecessor lineage disagrees' })
    }
    const bytes = bundle.files.reduce((total, file) => total + Buffer.byteLength(file.content), 0)
    if (bytes > 8 * 1024 * 1024) {
      context.addIssue({ code: 'custom', message: 'Artifact bundle exceeds byte limit' })
    }
  })

export const ArtifactBuildEvaluationReportV1Schema = z
  .strictObject({
    ...missionRecordFields('artifact-build-evaluation-report', ArtifactBuildReportIdSchema),
    bundleId: ArtifactBuildBundleIdSchema,
    bundleDigest: Sha256Schema,
    checks: z.strictObject({
      manifestValid: z.boolean(),
      digestsExact: z.boolean(),
      provenanceComplete: z.boolean(),
      cleanBuildPassed: z.boolean(),
      rebuildDigestExact: z.boolean()
    }),
    diagnostics: z
      .array(
        z.strictObject({
          code: z.string().min(1).max(128),
          file: z.string().max(512).nullable(),
          line: z.number().int().positive().nullable(),
          message: ShortTextSchema
        })
      )
      .max(1_000),
    emittedDigest: Sha256Schema.nullable(),
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
      context.addIssue({ code: 'custom', message: 'Artifact build status disagrees with checks' })
    }
    if (report.checks.cleanBuildPassed !== (report.emittedDigest !== null)) {
      context.addIssue({
        code: 'custom',
        message: 'Build output digest disagrees with build status'
      })
    }
  })

export type ArtifactBuildBundleV1 = z.infer<typeof ArtifactBuildBundleV1Schema>
export type ArtifactBuildEvaluationReportV1 = z.infer<typeof ArtifactBuildEvaluationReportV1Schema>
