import { z } from 'zod'
import {
  DataClassSchema,
  Sha256Schema,
  ShortTextSchema,
  tenantRecordFields
} from './common-contracts.js'
import { SourceDiscoveryLineageSchema } from './source-inventory-contracts.js'

const profileId = z
  .string()
  .min(21)
  .max(128)
  .regex(/^source_data_profile_[a-z0-9][a-z0-9_-]{0,106}$/)
  .brand<'SourceDataProfileId'>()

const RelationKeySchema = z.strictObject({
  schema: z.string().min(1).max(256),
  name: z.string().min(1).max(256)
})

export const SourceDataProfileV1Schema = z
  .strictObject({
    ...tenantRecordFields('source-data-profile', profileId),
    lineage: SourceDiscoveryLineageSchema,
    dataClass: DataClassSchema,
    requestedRelations: z.array(RelationKeySchema).min(1).max(128),
    profiles: z.array(
      z.strictObject({
        relation: RelationKeySchema,
        rowCount: z.number().int().nonnegative(),
        rowCountKind: z.enum(['exact', 'bounded', 'estimated']),
        rowsScanned: z.number().int().nonnegative(),
        scanPredicateDigest: Sha256Schema.nullable(),
        columns: z.array(
          z.strictObject({
            name: z.string().min(1).max(256),
            dataType: z.string().min(1).max(1_024),
            rowsObserved: z.number().int().nonnegative(),
            nullCount: z.number().int().nonnegative(),
            distinctCount: z.number().int().nonnegative(),
            minimumDigest: Sha256Schema.nullable(),
            maximumDigest: Sha256Schema.nullable(),
            sampleValueDigests: z.array(Sha256Schema).max(256),
            limitations: z.array(ShortTextSchema).max(32)
          })
        ),
        limitations: z.array(ShortTextSchema).max(32)
      })
    ),
    denials: z.array(
      z.strictObject({
        relation: RelationKeySchema,
        reason: ShortTextSchema,
        absenceConclusion: z.literal(false)
      })
    ),
    unavailableRelations: z.array(
      z.strictObject({ relation: RelationKeySchema, reason: ShortTextSchema })
    ),
    coverage: z.strictObject({
      requested: z.number().int().nonnegative(),
      profiled: z.number().int().nonnegative(),
      denied: z.number().int().nonnegative(),
      unavailable: z.number().int().nonnegative(),
      complete: z.boolean()
    })
  })
  .superRefine((profile, context) => {
    if (
      profile.coverage.requested !== profile.requestedRelations.length ||
      profile.coverage.profiled !== profile.profiles.length ||
      profile.coverage.denied !== profile.denials.length ||
      profile.coverage.unavailable !== profile.unavailableRelations.length
    ) {
      context.addIssue({ code: 'custom', message: 'Source profile coverage counts disagree' })
    }
    const complete =
      profile.coverage.profiled === profile.coverage.requested &&
      profile.coverage.denied === 0 &&
      profile.coverage.unavailable === 0
    if (profile.coverage.complete !== complete) {
      context.addIssue({ code: 'custom', message: 'Source profile completeness disagrees' })
    }
    if (
      profile.profiles.some((relation) =>
        relation.columns.some(
          (column) =>
            column.nullCount > column.rowsObserved || column.distinctCount > column.rowsObserved
        )
      )
    ) {
      context.addIssue({ code: 'custom', message: 'Source profile column counts exceed rows' })
    }
  })

export type SourceDataProfileV1 = z.infer<typeof SourceDataProfileV1Schema>
