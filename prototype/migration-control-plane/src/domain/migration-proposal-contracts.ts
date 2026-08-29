import { z } from 'zod'
import {
  ActorSchema,
  DataClassSchema,
  EvidenceIdSchema,
  IsoDateTimeSchema,
  Sha256Schema,
  ShortTextSchema,
  tenantRecordFields
} from './common-contracts.js'
import {
  DiscoveryGapRankingIdSchema,
  SafeProbePlanIdSchema
} from './discovery-reasoning-contracts.js'
import {
  SourceCodeExtractIdSchema,
  SourceLineageSnapshotIdSchema
} from './source-code-lineage-contracts.js'
import { SourceCdcAnalysisIdSchema } from './source-cdc-contracts.js'
import {
  SourceSchemaInventoryIdSchema,
  SourceSystemInventoryIdSchema
} from './source-inventory-contracts.js'
import { SourceDataProfileIdSchema } from './source-profile-contracts.js'

const migrationId = (prefix: string) =>
  z
    .string()
    .min(prefix.length + 2)
    .max(128)
    .regex(new RegExp(`^${prefix}_[a-z0-9][a-z0-9_-]{0,111}$`))

export const TargetCapabilitySnapshotIdSchema = migrationId(
  'target_capability_snapshot'
).brand<'TargetCapabilitySnapshotId'>()
export const MigrationProposalIdSchema =
  migrationId('migration_proposal').brand<'MigrationProposalId'>()

const TargetResourceSchema = z.strictObject({
  id: z.string().min(1).max(256),
  kind: z.string().min(1).max(128),
  version: z.string().min(1).max(128),
  region: z.string().min(1).max(128).nullable(),
  limits: z.record(z.string().min(1).max(128), z.union([z.string(), z.number(), z.boolean()])),
  evidenceIds: z.array(EvidenceIdSchema).min(1).max(1_000)
})

export const TargetCapabilitySnapshotV1Schema = z
  .strictObject({
    ...tenantRecordFields('target-capability-snapshot', TargetCapabilitySnapshotIdSchema),
    targetId: z.string().min(1).max(256),
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    predecessorSnapshotId: TargetCapabilitySnapshotIdSchema.nullable(),
    provider: z.string().min(1).max(128),
    platform: z.string().min(1).max(128),
    platformVersion: z.string().min(1).max(128),
    resources: z.array(TargetResourceSchema).min(1).max(10_000),
    identity: z.strictObject({
      principalReference: z.string().min(1).max(1_024).startsWith('principal://'),
      roles: z.array(z.string().min(1).max(256)).max(1_000),
      secretReferences: z.array(z.string().min(1).max(1_024).startsWith('secret://')).max(1_000)
    }),
    operations: z.array(
      z.strictObject({
        name: z.string().min(1).max(128),
        class: z.enum(['read', 'declarative-write', 'data-write', 'administrative']),
        idempotency: z.enum(['native', 'caller-key', 'read-reconcile', 'none']),
        supported: z.boolean(),
        evidenceIds: z.array(EvidenceIdSchema).min(1).max(1_000)
      })
    ),
    dataClasses: z.array(DataClassSchema).min(1).max(6),
    compatibility: z.strictObject({
      sourceEngines: z.array(z.string().min(1).max(128)),
      requiredFormats: z.array(z.string().min(1).max(128)),
      unsupportedFeatures: z.array(z.string().min(1).max(256))
    }),
    status: z.enum(['observed', 'declared', 'partial', 'denied']),
    coverage: z.strictObject({
      requested: z.array(z.string().min(1).max(256)),
      observed: z.array(z.string().min(1).max(256)),
      denied: z.array(z.string().min(1).max(256)),
      complete: z.boolean()
    }),
    observedAt: IsoDateTimeSchema,
    observedBy: ActorSchema
  })
  .superRefine((snapshot, context) => {
    if (snapshot.version === 1 && snapshot.predecessorSnapshotId !== null) {
      context.addIssue({
        code: 'custom',
        message: 'First target snapshot cannot have a predecessor'
      })
    }
    if (snapshot.version > 1 && snapshot.predecessorSnapshotId === null) {
      context.addIssue({ code: 'custom', message: 'Later target snapshot requires a predecessor' })
    }
    if (
      new Set(snapshot.resources.map((resource) => resource.id)).size !== snapshot.resources.length
    ) {
      context.addIssue({ code: 'custom', message: 'Target resource identities must be unique' })
    }
    if (
      new Set(snapshot.operations.map((operation) => operation.name)).size !==
      snapshot.operations.length
    ) {
      context.addIssue({ code: 'custom', message: 'Target operation identities must be unique' })
    }
    const observed = new Set(snapshot.coverage.observed)
    const complete =
      snapshot.coverage.denied.length === 0 &&
      snapshot.coverage.requested.every((item) => observed.has(item))
    if (snapshot.coverage.complete !== complete) {
      context.addIssue({ code: 'custom', message: 'Target capability coverage disagrees' })
    }
  })

const ProposalDecisionSchema = z.strictObject({
  id: z.string().min(1).max(128),
  question: z.string().min(1).max(8_192),
  selected: z.string().min(1).max(1_024),
  alternatives: z.array(z.string().min(1).max(1_024)).min(1).max(128),
  evidenceIds: z.array(EvidenceIdSchema).min(1).max(10_000),
  rationale: ShortTextSchema,
  reversalConditions: z.array(ShortTextSchema).min(1).max(128)
})

const ProposalTaskSchema = z.strictObject({
  id: z.string().min(1).max(128),
  title: z.string().min(1).max(1_024),
  capability: z.string().min(1).max(128),
  dependencyIds: z.array(z.string().min(1).max(128)).max(1_000),
  evidenceIds: z.array(EvidenceIdSchema).min(1).max(10_000),
  proofObligations: z.array(ShortTextSchema).min(1).max(128),
  recovery: ShortTextSchema
})

export const MigrationProposalV1Schema = z
  .strictObject({
    ...tenantRecordFields('migration-proposal', MigrationProposalIdSchema),
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    baseProposalId: MigrationProposalIdSchema.nullable(),
    source: z.strictObject({
      systemInventoryId: SourceSystemInventoryIdSchema,
      schemaInventoryId: SourceSchemaInventoryIdSchema,
      profileIds: z.array(SourceDataProfileIdSchema).max(1_000),
      codeExtractId: SourceCodeExtractIdSchema,
      lineageSnapshotId: SourceLineageSnapshotIdSchema,
      cdcAnalysisId: SourceCdcAnalysisIdSchema
    }),
    reasoning: z.strictObject({
      claimComparisonId: z.string().min(1).max(128),
      gapRankingId: DiscoveryGapRankingIdSchema,
      probePlanId: SafeProbePlanIdSchema
    }),
    targetCapabilityId: TargetCapabilitySnapshotIdSchema,
    estate: z.strictObject({
      assetCount: z.number().int().nonnegative(),
      dependencyCount: z.number().int().nonnegative(),
      sourceDigest: Sha256Schema,
      coverageComplete: z.boolean(),
      limitations: z.array(ShortTextSchema).max(128)
    }),
    decisions: z.array(ProposalDecisionSchema).min(1).max(1_000),
    mappings: z.array(
      z.strictObject({
        source: z.string().min(1).max(1_024),
        target: z.string().min(1).max(1_024),
        transformation: z.string().min(1).max(8_192),
        evidenceIds: z.array(EvidenceIdSchema).min(1).max(10_000),
        status: z.enum(['proposed', 'blocked', 'unsupported'])
      })
    ),
    tasks: z.array(ProposalTaskSchema).min(1).max(10_000),
    unresolvedGapIds: z.array(z.string().min(1).max(128)).max(10_000),
    authority: z.literal('proposal-only'),
    state: z.literal('reconciler-required'),
    proposedAt: IsoDateTimeSchema,
    proposedBy: ActorSchema
  })
  .superRefine((proposal, context) => {
    if (proposal.version === 1 && proposal.baseProposalId !== null) {
      context.addIssue({ code: 'custom', message: 'First migration proposal cannot have a base' })
    }
    if (proposal.version > 1 && proposal.baseProposalId === null) {
      context.addIssue({ code: 'custom', message: 'Later migration proposal requires a base' })
    }
    const taskIds = new Set(proposal.tasks.map((task) => task.id))
    if (
      proposal.tasks.some((task) =>
        task.dependencyIds.some((dependency) => !taskIds.has(dependency))
      )
    ) {
      context.addIssue({ code: 'custom', message: 'Migration proposal task dependency is missing' })
    }
  })

export type TargetCapabilitySnapshotV1 = z.infer<typeof TargetCapabilitySnapshotV1Schema>
export type MigrationProposalV1 = z.infer<typeof MigrationProposalV1Schema>
