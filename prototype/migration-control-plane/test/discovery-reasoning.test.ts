import { describe, expect, it } from 'vitest'
import { analyzeCdcBehavior } from '../src/cdc-behavior-analyzer.js'
import { parseDomainRecord } from '../src/domain/domain-contract-registry.js'
import { buildMigrationProposal } from '../src/migration-proposal-builder.js'
import { TargetCapabilityRegistry } from '../src/target-capability-registry.js'
import {
  discoveryActor as actor,
  discoveryAt as at,
  discoveryCdcTrace as cdcTrace,
  discoveryEvidenceId as evidenceId,
  discoveryReasoning as reasoning
} from './discovery-reasoning-fixture.js'
import { DOMAIN_CONTRACT_SAMPLES } from './domain-contract-samples.js'
import { MIGRATION_PROPOSAL_CONTRACT_SAMPLES } from './migration-proposal-contract-samples.js'

describe('discovery reasoning pipeline', () => {
  it('infers exact CDC semantics and final state across duplicate restart and late event', () => {
    const analysis = analyzeCdcBehavior(cdcTrace(), {
      analysisId: 'source_cdc_analysis_pagila_full',
      analyzedAt: at,
      analyzedBy: actor
    })
    expect(analysis.gaps).toEqual([])
    expect(analysis.finalRecordCount).toBe(2)
    expect(analysis.eventDispositions).toHaveLength(10)
    expect(analysis.eventDispositions[8]).toMatchObject({ disposition: 'duplicate' })
    expect(analysis.semantics).toMatchObject({
      snapshot: 'consistent-boundary',
      ordering: 'source-position-total',
      transactions: 'atomic',
      deletes: 'explicit',
      amendments: 'ordered-update',
      ddl: 'versioned-event',
      restart: 'resume-token',
      checkpoint: 'monotonic',
      lateEvents: 'ordered-by-position'
    })
  })

  it('preserves refutation and denial as ranked gaps, then selects only a safe probe', () => {
    const { comparison, ranking, plan } = reasoning()
    expect(comparison.summary).toMatchObject({ refuted: 1, denied: 1, materialContradictions: 1 })
    expect(comparison.results.find((result) => result.status === 'denied')).toMatchObject({
      absenceConclusion: false
    })
    expect(ranking.gaps.map((gap) => gap.rank)).toEqual([1, 2])
    expect(plan.selectedCandidateId).toBe('probe_actor_count')
    expect(plan.candidates[0]).toMatchObject({ executable: true, blockers: [] })
  })

  it('resolves only complete compatible target capability and builds proposal-only output', () => {
    const target = parseDomainRecord(
      'target-capability-snapshot.v1',
      MIGRATION_PROPOSAL_CONTRACT_SAMPLES['target-capability-snapshot.v1']
    )
    const registry = new TargetCapabilityRegistry()
    registry.register(target)
    expect(
      registry.resolve({
        tenantId: 'tenant_s1',
        targetId: target.targetId,
        sourceEngine: 'postgresql',
        dataClass: 'synthetic',
        requiredOperations: ['inspect-schema']
      })
    ).toMatchObject({ id: target.id })
    expect(
      registry.resolve({
        tenantId: 'tenant_s1',
        targetId: target.targetId,
        sourceEngine: 'oracle',
        dataClass: 'synthetic',
        requiredOperations: ['inspect-schema']
      })
    ).toBeNull()
    expect(() => registry.register(target)).not.toThrow()
    expect(() => registry.register({ ...target, provider: 'changed' })).toThrow(
      'Target snapshot differs for reused ID'
    )
    registry.register({
      ...target,
      id: 'target_capability_snapshot_fixture_v2',
      version: 2,
      predecessorSnapshotId: target.id,
      status: 'partial'
    })
    expect(
      registry.resolve({
        tenantId: 'tenant_s1',
        targetId: target.targetId,
        sourceEngine: 'postgresql',
        dataClass: 'synthetic',
        requiredOperations: ['inspect-schema']
      })
    ).toBeNull()

    const { comparison, ranking, plan } = reasoning()
    const proposal = buildMigrationProposal({
      systemInventory: parseDomainRecord(
        'source-system-inventory.v1',
        DOMAIN_CONTRACT_SAMPLES['source-system-inventory.v1']
      ),
      schemaInventory: parseDomainRecord(
        'source-schema-inventory.v1',
        DOMAIN_CONTRACT_SAMPLES['source-schema-inventory.v1']
      ),
      profiles: [
        parseDomainRecord(
          'source-data-profile.v1',
          DOMAIN_CONTRACT_SAMPLES['source-data-profile.v1']
        )
      ],
      codeExtract: parseDomainRecord(
        'source-code-extract.v1',
        DOMAIN_CONTRACT_SAMPLES['source-code-extract.v1']
      ),
      lineage: parseDomainRecord(
        'source-lineage-snapshot.v1',
        DOMAIN_CONTRACT_SAMPLES['source-lineage-snapshot.v1']
      ),
      cdc: analyzeCdcBehavior(cdcTrace(), {
        analysisId: 'source_cdc_analysis_pagila_full',
        analyzedAt: at,
        analyzedBy: actor
      }),
      comparison,
      ranking,
      probePlan: plan,
      target,
      metadata: {
        proposalId: 'migration_proposal_pagila_full_v1',
        createdAt: at,
        targetSchema: 'raw',
        evidenceIds: [evidenceId],
        proposedBy: actor
      }
    })
    expect(proposal).toMatchObject({ authority: 'proposal-only', state: 'reconciler-required' })
    expect(proposal.tasks).toHaveLength(5)
    expect(proposal.mappings).toHaveLength(1)
  })
})
