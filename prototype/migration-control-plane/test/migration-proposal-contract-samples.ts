const createdAt = '2026-01-01T00:03:00.000Z'
const digestA = 'a'.repeat(64)

export const MIGRATION_PROPOSAL_CONTRACT_SAMPLES = {
  'target-capability-snapshot.v1': {
    schemaVersion: 1,
    kind: 'target-capability-snapshot',
    id: 'target_capability_snapshot_fixture_v1',
    tenantId: 'tenant_s1',
    createdAt,
    targetId: 'target_fixture_warehouse',
    version: 1,
    predecessorSnapshotId: null,
    provider: 'fixture',
    platform: 'postgresql-warehouse',
    platformVersion: '16.15',
    resources: [
      {
        id: 'resource_target_database',
        kind: 'database',
        version: '16.15',
        region: null,
        limits: { storageBytes: 1073741824, schemas: 10 },
        evidenceIds: ['evidence_target_capability']
      }
    ],
    identity: {
      principalReference: 'principal://fixture/migration-builder',
      roles: ['schema-designer'],
      secretReferences: ['secret://fixture/target-credential']
    },
    operations: [
      {
        name: 'inspect-schema',
        class: 'read',
        idempotency: 'none',
        supported: true,
        evidenceIds: ['evidence_target_capability']
      },
      {
        name: 'create-schema-artifact',
        class: 'declarative-write',
        idempotency: 'caller-key',
        supported: true,
        evidenceIds: ['evidence_target_capability']
      }
    ],
    dataClasses: ['synthetic'],
    compatibility: {
      sourceEngines: ['postgresql'],
      requiredFormats: ['sql', 'json'],
      unsupportedFeatures: ['production-cutover']
    },
    status: 'observed',
    coverage: {
      requested: ['database', 'identity', 'operations'],
      observed: ['database', 'identity', 'operations'],
      denied: [],
      complete: true
    },
    observedAt: createdAt,
    observedBy: { kind: 'system', id: 'target-capability-reader', version: '1' }
  },
  'migration-proposal.v1': {
    schemaVersion: 1,
    kind: 'migration-proposal',
    id: 'migration_proposal_pagila_v1',
    tenantId: 'tenant_s1',
    createdAt,
    version: 1,
    baseProposalId: null,
    source: {
      systemInventoryId: 'source_system_inventory_pagila',
      schemaInventoryId: 'source_schema_inventory_pagila',
      profileIds: ['source_data_profile_pagila_actor'],
      codeExtractId: 'source_code_extract_pagila',
      lineageSnapshotId: 'source_lineage_snapshot_pagila',
      cdcAnalysisId: 'source_cdc_analysis_pagila'
    },
    reasoning: {
      claimComparisonId: 'source_claim_comparison_pagila',
      gapRankingId: 'discovery_gap_ranking_pagila',
      probePlanId: 'safe_probe_plan_pagila'
    },
    targetCapabilityId: 'target_capability_snapshot_fixture_v1',
    estate: {
      assetCount: 30,
      dependencyCount: 43,
      sourceDigest: digestA,
      coverageComplete: false,
      limitations: ['Synthetic fixture only.']
    },
    decisions: [
      {
        id: 'decision_raw_layer',
        question: 'How should the source first land?',
        selected: 'Preserve a raw typed layer.',
        alternatives: ['Normalize immediately.'],
        evidenceIds: ['evidence_pagila_inventory'],
        rationale: 'Preserve source evidence before semantic changes.',
        reversalConditions: ['Target cannot represent the source types.']
      }
    ],
    mappings: [
      {
        source: 'public.actor',
        target: 'raw.actor',
        transformation: 'Preserve source columns.',
        evidenceIds: ['evidence_pagila_inventory'],
        status: 'proposed'
      }
    ],
    tasks: [
      {
        id: 'proposal_task_validate_source',
        title: 'Validate source snapshot.',
        capability: 'source-validation',
        dependencyIds: [],
        evidenceIds: ['evidence_pagila_inventory'],
        proofObligations: ['Row counts reconcile.'],
        recovery: 'Re-observe or open a source-changed gap.'
      }
    ],
    unresolvedGapIds: ['gap_discovery_claim_actor_count'],
    authority: 'proposal-only',
    state: 'reconciler-required',
    proposedAt: createdAt,
    proposedBy: { kind: 'system', id: 'migration-proposal-builder', version: '1' }
  }
}
