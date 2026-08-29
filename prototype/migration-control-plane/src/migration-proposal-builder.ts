import { canonicalJson, sha256Text } from './canonical-json.js'
import type {
  SourceCodeExtractV1,
  SourceLineageSnapshotV1
} from './domain/source-code-lineage-contracts.js'
import type { SourceCdcAnalysisV1 } from './domain/source-cdc-contracts.js'
import type {
  DiscoveryGapRankingV1,
  SafeProbePlanV1,
  SourceClaimComparisonV1
} from './domain/discovery-reasoning-contracts.js'
import type {
  SourceSchemaInventoryV1,
  SourceSystemInventoryV1
} from './domain/source-inventory-contracts.js'
import {
  MigrationProposalV1Schema,
  type MigrationProposalV1,
  type TargetCapabilitySnapshotV1
} from './domain/migration-proposal-contracts.js'
import type { SourceDataProfileV1 } from './domain/source-profile-contracts.js'

export function buildMigrationProposal(input: {
  systemInventory: SourceSystemInventoryV1
  schemaInventory: SourceSchemaInventoryV1
  profiles: readonly SourceDataProfileV1[]
  codeExtract: SourceCodeExtractV1
  lineage: SourceLineageSnapshotV1
  cdc: SourceCdcAnalysisV1
  comparison: SourceClaimComparisonV1
  ranking: DiscoveryGapRankingV1
  probePlan: SafeProbePlanV1
  target: TargetCapabilitySnapshotV1
  metadata: {
    proposalId: string
    createdAt: string
    targetSchema: string
    evidenceIds: [
      MigrationProposalV1['decisions'][number]['evidenceIds'][number],
      ...MigrationProposalV1['decisions'][number]['evidenceIds'][number][]
    ]
    proposedBy: MigrationProposalV1['proposedBy']
  }
}): MigrationProposalV1 {
  const tenantId = input.systemInventory.tenantId
  const records = [
    input.schemaInventory,
    ...input.profiles,
    input.codeExtract,
    input.lineage,
    input.cdc,
    input.comparison,
    input.ranking,
    input.probePlan,
    input.target
  ]
  if (records.some((record) => record.tenantId !== tenantId)) {
    throw new TypeError('Migration proposal inputs cross tenant boundaries')
  }
  if (
    input.ranking.comparisonId !== input.comparison.id ||
    input.probePlan.rankingId !== input.ranking.id
  ) {
    throw new TypeError('Migration proposal reasoning lineage is inconsistent')
  }
  const sourceEvidence = input.metadata.evidenceIds
  const sourceRelations = input.schemaInventory.relations.filter((relation) =>
    ['table', 'partitioned-table'].includes(relation.kind)
  )
  const mappings = sourceRelations.map((relation) => ({
    source: `${relation.schema}.${relation.name}`,
    target: `${input.metadata.targetSchema}.${relation.name}`,
    transformation: 'Preserve typed columns and source key evidence in the initial raw layer.',
    evidenceIds: sourceEvidence,
    status: 'proposed' as const
  }))
  const decisions: MigrationProposalV1['decisions'] = [
    {
      id: 'decision_preserve_source_shape',
      question: 'How should the first target layer represent the observed source estate?',
      selected: 'Preserve source relation and key shape in a raw target layer.',
      alternatives: ['Normalize during initial load.', 'Map directly to a semantic target model.'],
      evidenceIds: sourceEvidence,
      rationale:
        'A lossless raw layer keeps source evidence reconstructable before semantic decisions.',
      reversalConditions: ['A target limitation prevents lossless typed representation.']
    },
    {
      id: 'decision_cdc_application',
      question: 'How should post-snapshot changes be applied?',
      selected: `${input.cdc.semantics.ordering}; ${input.cdc.semantics.transactions}; ${input.cdc.semantics.deletes}.`,
      alternatives: ['Periodic full snapshots only.', 'Unordered best-effort event application.'],
      evidenceIds: sourceEvidence,
      rationale: 'Only observed CDC semantics may define replay and delete behavior.',
      reversalConditions: [
        'A later trace changes ordering, transaction, delete or checkpoint evidence.'
      ]
    },
    {
      id: 'decision_target_capability',
      question: 'Which observed target capability bounds the proposed build?',
      selected: `${input.target.provider}/${input.target.platform}@${input.target.platformVersion}`,
      alternatives: ['Defer target selection.', 'Assume an unobserved platform capability.'],
      evidenceIds: sourceEvidence,
      rationale: 'The proposal must stay inside versioned target resources and operations.',
      reversalConditions: ['Target capability coverage becomes partial, denied or stale.']
    }
  ]
  const tasks: MigrationProposalV1['tasks'] = [
    {
      id: 'proposal_task_validate_source_snapshot',
      title: 'Validate source snapshot and evidence coverage.',
      capability: 'source-validation',
      dependencyIds: [],
      evidenceIds: sourceEvidence,
      proofObligations: ['Exact source asset and row-count oracle passes.'],
      recovery: 'Re-run read-only observation from the same snapshot or open a source-changed gap.'
    },
    {
      id: 'proposal_task_create_raw_target',
      title: 'Create the proposed raw target schema.',
      capability: 'target-design',
      dependencyIds: ['proposal_task_validate_source_snapshot'],
      evidenceIds: sourceEvidence,
      proofObligations: ['Target contract represents every proposed source mapping without loss.'],
      recovery: 'Discard the proposed artifact; no target effect is authorized by this proposal.'
    },
    {
      id: 'proposal_task_build_snapshot_load',
      title: 'Build deterministic initial snapshot loading artifacts.',
      capability: 'snapshot-build',
      dependencyIds: ['proposal_task_create_raw_target'],
      evidenceIds: sourceEvidence,
      proofObligations: ['Counts, keys, nulls and source digests reconcile exactly.'],
      recovery: 'Rebuild immutable artifacts from pinned source and target contracts.'
    },
    {
      id: 'proposal_task_build_cdc_replay',
      title: 'Build CDC replay using only observed semantics.',
      capability: 'cdc-build',
      dependencyIds: ['proposal_task_build_snapshot_load'],
      evidenceIds: sourceEvidence,
      proofObligations: ['Every trace event has one disposition and final target state is exact.'],
      recovery: 'Resume from the last proven checkpoint or quarantine an unknown interval.'
    },
    {
      id: 'proposal_task_evaluate_migration',
      title: 'Evaluate snapshot and CDC artifacts independently.',
      capability: 'migration-evaluation',
      dependencyIds: ['proposal_task_build_snapshot_load', 'proposal_task_build_cdc_replay'],
      evidenceIds: sourceEvidence,
      proofObligations: ['All hard source, target, mapping and replay measures pass.'],
      recovery: 'Reject the artifact and create attributed correction gaps.'
    }
  ]
  return MigrationProposalV1Schema.parse({
    schemaVersion: 1,
    kind: 'migration-proposal',
    id: input.metadata.proposalId,
    tenantId,
    createdAt: input.metadata.createdAt,
    version: 1,
    baseProposalId: null,
    source: {
      systemInventoryId: input.systemInventory.id,
      schemaInventoryId: input.schemaInventory.id,
      profileIds: input.profiles.map((profile) => profile.id),
      codeExtractId: input.codeExtract.id,
      lineageSnapshotId: input.lineage.id,
      cdcAnalysisId: input.cdc.id
    },
    reasoning: {
      claimComparisonId: input.comparison.id,
      gapRankingId: input.ranking.id,
      probePlanId: input.probePlan.id
    },
    targetCapabilityId: input.target.id,
    estate: {
      assetCount: input.schemaInventory.relations.length,
      dependencyCount: input.lineage.edges.length,
      sourceDigest: sha256Text(
        canonicalJson({
          system: input.systemInventory.id,
          schema: input.schemaInventory.id,
          profiles: input.profiles.map((profile) => profile.id),
          code: input.codeExtract.contentDigest,
          lineage: input.lineage.id,
          cdc: input.cdc.finalStateDigest
        })
      ),
      coverageComplete: input.systemInventory.coverage.complete && input.cdc.gaps.length === 0,
      limitations: [
        'Proposal is qualified only for the frozen fixture and observed target capability.'
      ]
    },
    decisions,
    mappings,
    tasks,
    unresolvedGapIds: input.ranking.gaps.map((gap) => gap.gapId),
    authority: 'proposal-only',
    state: 'reconciler-required',
    proposedAt: input.metadata.createdAt,
    proposedBy: input.metadata.proposedBy
  })
}
