import { z } from 'zod'

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)
const GitShaSchema = z.string().regex(/^[a-f0-9]{40}$/)
const RelativeFileSchema = z
  .string()
  .min(1)
  .max(256)
  .refine((path) => !path.startsWith('/') && !path.includes('..') && !path.includes('\\'), {
    message: 'Fixture file path must be a contained POSIX-relative path'
  })

const FixtureFileSchema = z.strictObject({
  path: RelativeFileSchema,
  sourcePath: z.string().min(1).max(256).nullable(),
  sourceUrl: z.url().nullable(),
  gitBlobSha: GitShaSchema.nullable(),
  sha256: Sha256Schema,
  bytes: z
    .number()
    .int()
    .positive()
    .max(16 * 1024 * 1024),
  role: z.enum(['license', 'schema', 'data', 'expected-estate'])
})

export const PagilaSourceFixtureManifestSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    fixtureId: z.literal('p6-pagila-v3.1.0'),
    coordinate: z.literal('P6-DISC-01'),
    selectedAt: z.iso.datetime({ offset: true }),
    source: z.strictObject({
      name: z.literal('Pagila PostgreSQL Sample Database'),
      repository: z.literal('https://github.com/devrimgunduz/pagila'),
      tag: z.literal('pagila-v3.1.0'),
      revision: z.literal('fef9675714cfba1756df4719b5e36075a7ddf90e'),
      revisionCommittedAt: z.literal('2022-12-13T10:02:13.000Z'),
      upstreamRuntimeClaim: z.literal('PostgreSQL 12 and above')
    }),
    license: z.strictObject({
      spdx: z.literal('MIT'),
      file: z.literal('UPSTREAM-LICENSE.txt'),
      redistributionAllowed: z.literal(true),
      conflictingUpstreamClaim: z.string().min(1).max(1_024),
      conflictingClaimSourceUrl: z.literal(
        'https://raw.githubusercontent.com/devrimgunduz/pagila/fef9675714cfba1756df4719b5e36075a7ddf90e/README.md'
      ),
      conflictingClaimGitBlobSha: z.literal('4069ac974cde04ba8abcda8d521611d698b068f8'),
      disposition: z.string().min(1).max(1_024)
    }),
    dataClass: z.literal('synthetic-public'),
    containsRealPersonalData: z.literal(false),
    runtime: z.strictObject({
      engine: z.literal('postgresql'),
      version: z.literal('16.15'),
      majorVersion: z.literal(16),
      encoding: z.literal('UTF8'),
      collation: z.literal('C'),
      extensions: z.tuple([]),
      loadOrder: z.tuple([z.literal('pagila-schema.sql'), z.literal('pagila-insert-data.sql')])
    }),
    files: z.array(FixtureFileSchema).length(4),
    selection: z.strictObject({
      criteria: z.array(z.string().min(1).max(512)).min(6).max(16),
      rejectedAlternatives: z
        .array(
          z.strictObject({
            candidate: z.string().min(1).max(256),
            reason: z.string().min(1).max(1_024)
          })
        )
        .min(3)
        .max(8)
    }),
    limitations: z.array(z.string().min(1).max(1_024)).min(1).max(16)
  })
  .superRefine((manifest, context) => {
    const paths = manifest.files.map((file) => file.path)
    if (new Set(paths).size !== paths.length) {
      context.addIssue({ code: 'custom', message: 'Fixture files must have unique paths' })
    }
    for (const file of manifest.files) {
      const upstream = file.role !== 'expected-estate'
      if (
        upstream !==
        (file.sourcePath !== null && file.sourceUrl !== null && file.gitBlobSha !== null)
      ) {
        context.addIssue({
          code: 'custom',
          message: `Fixture provenance is incomplete: ${file.path}`
        })
      }
    }
  })

const NamedTriggerSchema = z.strictObject({
  table: z.string().min(1).max(128),
  name: z.string().min(1).max(128)
})

export const PagilaExpectedEstateSchema = z.strictObject({
  schemaVersion: z.literal(1),
  fixtureId: z.literal('p6-pagila-v3.1.0'),
  databaseSchema: z.literal('public'),
  objectCounts: z.strictObject({
    ordinaryTables: z.number().int().nonnegative(),
    partitionedTables: z.number().int().nonnegative(),
    views: z.number().int().nonnegative(),
    materializedViews: z.number().int().nonnegative(),
    sequences: z.number().int().nonnegative(),
    indexes: z.number().int().nonnegative(),
    partitionedIndexes: z.number().int().nonnegative(),
    functions: z.number().int().nonnegative(),
    triggers: z.number().int().nonnegative(),
    primaryKeyConstraints: z.number().int().nonnegative(),
    foreignKeyConstraints: z.number().int().nonnegative(),
    checkConstraints: z.number().int().nonnegative(),
    domainTypes: z.number().int().nonnegative(),
    enumTypes: z.number().int().nonnegative()
  }),
  objects: z.strictObject({
    ordinaryTables: z.array(z.string().min(1).max(128)),
    partitionedTables: z.array(z.string().min(1).max(128)),
    views: z.array(z.string().min(1).max(128)),
    materializedViews: z.array(z.string().min(1).max(128)),
    sequences: z.array(z.string().min(1).max(128)),
    functions: z.array(z.string().min(1).max(128)),
    customTypes: z.array(
      z.strictObject({ name: z.string().min(1).max(128), kind: z.enum(['domain', 'enum']) })
    ),
    triggers: z.array(NamedTriggerSchema)
  }),
  rowCounts: z.record(z.string().min(1).max(128), z.number().int().nonnegative()),
  expectedDiscoveryFeatures: z.array(z.string().min(1).max(512)).min(1).max(32)
})

export type PagilaSourceFixtureManifest = z.infer<typeof PagilaSourceFixtureManifestSchema>
export type PagilaExpectedEstate = z.infer<typeof PagilaExpectedEstateSchema>
