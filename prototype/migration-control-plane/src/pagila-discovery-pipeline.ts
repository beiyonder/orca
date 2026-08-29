import { Client } from 'pg'
import { canonicalJson, sha256Text } from './canonical-json.js'
import { analyzeCdcBehavior } from './cdc-behavior-analyzer.js'
import { rankDiscoveryGaps } from './discovery-gap-ranking.js'
import { EvidenceIdSchema } from './domain/common-contracts.js'
import { TargetCapabilitySnapshotV1Schema } from './domain/migration-proposal-contracts.js'
import type { SourceRequestV1 } from './domain/source-probe-contracts.js'
import { loadDiscoveryQualificationFixture } from './discovery-qualification-fixture.js'
import { buildMigrationProposal } from './migration-proposal-builder.js'
import { createPagilaOperationAuthority } from './pagila-operation-authority.js'
import { buildPostgresCodeExtract, collectPostgresCode } from './postgres-code-extractor.js'
import { buildPostgresDataProfile, collectPostgresDataProfile } from './postgres-data-profiler.js'
import {
  buildPostgresEstateInventories,
  collectPostgresEstateInventory
} from './postgres-estate-inventory.js'
import {
  buildPostgresLineageSnapshot,
  collectPostgresLineage
} from './postgres-lineage-inference.js'
import { PostgresSourceSandbox, type SourceReadSession } from './postgres-source-sandbox.js'
import { pagilaClaimObservations } from './pagila-claim-observations.js'
import { loadPagilaSourceFixture } from './pagila-source-fixture-loader.js'
import { planSafeProbe } from './safe-probe-planner.js'
import { compareSourceClaims } from './source-claim-comparator.js'

const at = '2026-01-01T00:10:00.000Z'
const actor = { kind: 'system' as const, id: 'discovery-qualification', version: '1' }
const inventoryEvidence = EvidenceIdSchema.parse('evidence_pagila_inventory')
const profileEvidence = EvidenceIdSchema.parse('evidence_pagila_profile')
const denialEvidence = EvidenceIdSchema.parse('evidence_pagila_denial')

export async function runPagilaDiscoveryPipeline(input: {
  connectionString: string
  labRoot: string
}) {
  const [baseFixture, cases] = await Promise.all([
    loadPagilaSourceFixture(`${input.labRoot}/fixtures/p6-pagila-v3.1.0`),
    loadDiscoveryQualificationFixture(`${input.labRoot}/fixtures/p6-discovery-cases-v1`)
  ])
  const connection = new URL(input.connectionString)
  const client = new Client({ connectionString: input.connectionString })
  await client.connect()
  let databaseName: string
  let engineVersion: string
  try {
    databaseName = (await client.query<{ name: string }>('SELECT current_database() AS name'))
      .rows[0]!.name
    engineVersion = (
      await client.query<{ server_version: string }>('SHOW server_version')
    ).rows[0]!.server_version.split(' ')[0]!
  } finally {
    await client.end()
  }
  const endpointDigest = sha256Text(
    canonicalJson({
      protocol: connection.protocol,
      hostname: connection.hostname,
      port: connection.port,
      databaseName
    })
  )
  const execute = async <T>(
    operation: Parameters<typeof createPagilaOperationAuthority>[0]['operation'],
    parameters: unknown,
    suffix: string,
    handler: (session: SourceReadSession, request: SourceRequestV1) => Promise<T>,
    limits?: Parameters<typeof createPagilaOperationAuthority>[0]['limits']
  ) => {
    const authority = createPagilaOperationAuthority({
      operation,
      parameters,
      suffix,
      databaseName,
      engineVersion,
      endpointDigest,
      fixtureDigest: baseFixture.fixtureDigest,
      ...(limits === undefined ? {} : { limits })
    })
    const run = await new PostgresSourceSandbox().run<T>(
      { ...authority, connectionString: input.connectionString, endpointDigest },
      handler
    )
    return { authority, run }
  }

  const inventoryExecution = await execute(
    'inventory-schema',
    { schemas: ['public'], includeSystemSchemas: false },
    'qualification_inventory',
    collectPostgresEstateInventory
  )
  const inventories = buildPostgresEstateInventories(
    inventoryExecution.authority.request,
    inventoryExecution.run,
    {
      systemInventoryId: 'source_system_inventory_pagila_qualification',
      schemaInventoryId: 'source_schema_inventory_pagila_qualification',
      observationId: 'source_observation_pagila_inventory_qualification',
      capturedBy: actor
    }
  )
  const profileExecution = await execute(
    'profile-data',
    {
      relations: [
        {
          schema: 'public',
          name: 'actor',
          columns: ['actor_id', 'first_name', 'last_name']
        }
      ],
      maxColumnsPerRelation: 3,
      sampleRowsPerColumn: 3
    },
    'qualification_profile',
    collectPostgresDataProfile
  )
  const profile = buildPostgresDataProfile(
    profileExecution.authority.request,
    profileExecution.run,
    {
      profileId: 'source_data_profile_pagila_qualification',
      observationId: 'source_observation_pagila_profile_qualification',
      capturedBy: actor
    }
  )
  const codeExecution = await execute(
    'extract-code',
    {
      schemas: ['public'],
      kinds: ['view', 'materialized-view', 'function', 'procedure', 'trigger']
    },
    'qualification_code',
    collectPostgresCode
  )
  const codeBody = codeExecution.run.value.artifactBody
  const codeExtract = buildPostgresCodeExtract(codeExecution.authority.request, codeExecution.run, {
    codeExtractId: 'source_code_extract_pagila_qualification',
    observationId: 'source_observation_pagila_code_qualification',
    capturedBy: actor,
    artifact: {
      uri: 'artifact://qualification/pagila-code',
      sha256: sha256Text(codeBody),
      mediaType: 'application/json',
      bytes: Buffer.byteLength(codeBody),
      span: { kind: 'whole' }
    }
  })
  const lineageExecution = await execute(
    'infer-lineage',
    { schemas: ['public'] },
    'qualification_lineage',
    collectPostgresLineage
  )
  const lineage = buildPostgresLineageSnapshot(
    lineageExecution.authority.request,
    inventories.schema,
    lineageExecution.run,
    {
      lineageSnapshotId: 'source_lineage_snapshot_pagila_qualification',
      observationId: 'source_observation_pagila_lineage_qualification',
      evidenceIds: [inventoryEvidence],
      capturedBy: actor
    }
  )
  const cdc = analyzeCdcBehavior(cases.cdcTrace, {
    analysisId: 'source_cdc_analysis_pagila_qualification',
    analyzedAt: at,
    analyzedBy: actor
  })
  const observations = pagilaClaimObservations(inventories.schema, profile, {
    observedAt: at,
    inventoryEvidence,
    profileEvidence,
    denialEvidence
  })
  const comparison = compareSourceClaims(cases.claims.claims, observations, {
    comparisonId: 'source_claim_comparison_pagila_qualification',
    tenantId: 'tenant_s1',
    createdAt: at,
    lineage: inventories.system.lineage,
    comparedBy: actor
  })
  const ranking = rankDiscoveryGaps(
    comparison,
    comparison.results
      .filter((result) => result.status !== 'supported')
      .map((result) => ({
        claimId: result.claimId,
        question: `What current evidence resolves: ${result.statement}`,
        impact: result.material ? ('critical' as const) : ('medium' as const),
        blocking: result.material ? 5 : 2,
        probeCost: result.status === 'denied' ? 3 : 1,
        probeRisk: result.status === 'denied' ? 2 : 0,
        cheapestProbeId: result.status === 'denied' ? null : 'probe_verify_pagila_claims',
        exceptionOnly: result.status === 'denied'
      })),
    { rankingId: 'discovery_gap_ranking_pagila_qualification', createdAt: at, rankedBy: actor }
  )
  const probeGapIds = ranking.gaps.filter((gap) => !gap.exceptionOnly).map((gap) => gap.gapId)
  const plan = planSafeProbe(
    ranking,
    [
      {
        id: 'probe_verify_pagila_claims',
        gapIds: probeGapIds,
        operation: 'run-safe-probe',
        parameters: { checks: ['catalog-counts', 'actor-row-count', 'film-trigger'] },
        requiredScope: 'public',
        limits: createPagilaOperationAuthority({
          operation: 'run-safe-probe',
          parameters: {},
          suffix: 'qualification_probe_limits',
          databaseName,
          engineVersion,
          endpointDigest,
          fixtureDigest: baseFixture.fixtureDigest
        }).request.limits,
        predictedOutcomes: [{ claimsMatch: true }, { claimsMatch: false }],
        informationGain: 5,
        risk: 0,
        cost: 1,
        accessAvailable: true,
        blockers: []
      }
    ],
    {
      planId: 'safe_probe_plan_pagila_qualification',
      createdAt: at,
      maximumRisk: 1,
      maximumCost: 2,
      plannedBy: actor
    }
  )
  const target = TargetCapabilitySnapshotV1Schema.parse(cases.targetCapability)
  const proposal = buildMigrationProposal({
    systemInventory: inventories.system,
    schemaInventory: inventories.schema,
    profiles: [profile],
    codeExtract,
    lineage,
    cdc,
    comparison,
    ranking,
    probePlan: plan,
    target,
    metadata: {
      proposalId: 'migration_proposal_pagila_qualification_v1',
      createdAt: at,
      targetSchema: 'raw_pagila',
      evidenceIds: [inventoryEvidence, profileEvidence],
      proposedBy: actor
    }
  })
  return {
    baseFixture,
    cases,
    inventories,
    profile,
    codeExtract,
    lineage,
    cdc,
    comparison,
    ranking,
    plan,
    target,
    proposal
  }
}
