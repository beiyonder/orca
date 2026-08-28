import { describe, expect, it } from 'vitest'
import { canonicalJson, sha256Text } from '../src/canonical-json.js'
import {
  GovernedMemoryRegistry,
  GovernedMemoryRegistryError
} from '../src/governed-memory-registry.js'
import {
  SkillCapabilityRegistry,
  SkillCapabilityRegistryError
} from '../src/skill-capability-registry.js'
import {
  helpfulMemoryContent,
  memoryCandidate,
  memoryInvalidation,
  memoryUse,
  memoryVersion,
  revokedMemoryVersion,
  skillEvent,
  skillVersion
} from './memory-skill-fixture.js'

const recallRequest = {
  tenantId: 'tenant_s1',
  role: 'mapping',
  taskClass: 'identity-mapping',
  dataClass: 'synthetic' as const,
  scope: { environment: 'synthetic', system: 'legacy-ehr', entity: 'legacy_patient' },
  product: 'legacy-ehr',
  productVersion: 'fixture-v1',
  asOf: '2026-01-01T00:01:00.000Z'
}

const skillResolutionRequest: Parameters<SkillCapabilityRegistry['resolveActive']>[0] = {
  tenantId: 'tenant_s1',
  skillId: 'skill_identity_mapping',
  modelRoute: {
    provider: 'test',
    model: 'deterministic',
    revision: '1',
    effort: 'med',
    dataClasses: ['synthetic']
  },
  runtime: 'omp-rpc',
  runtimeVersion: '18.0.6',
  harness: 'migration-control-plane',
  dataClass: 'synthetic',
  taskClass: 'identity-mapping',
  availableTools: [
    { name: 'evidence_read', version: '1', schemaDigest: 'b'.repeat(64), approval: 'read' }
  ],
  authorityEnvelope: {
    toolNames: ['evidence_read'],
    networkDestinations: [],
    filesystemScopes: [],
    secretScopes: [],
    effectClasses: []
  }
}

function expectMemoryError(operation: () => unknown, code: string): void {
  try {
    operation()
    throw new Error('Expected governed memory registry error')
  } catch (error) {
    if (!(error instanceof GovernedMemoryRegistryError)) throw error
    expect(error.code).toBe(code)
  }
}

function expectSkillError(operation: () => unknown, code: string): void {
  try {
    operation()
    throw new Error('Expected skill capability registry error')
  } catch (error) {
    if (!(error instanceof SkillCapabilityRegistryError)) throw error
    expect(error.code).toBe(code)
  }
}

describe('governed memory registry', () => {
  it('admits every memory class only as provenance-bound non-recallable quarantine', () => {
    const registry = new GovernedMemoryRegistry()
    for (const memoryType of ['mission', 'episodic', 'procedural', 'failure', 'evaluator']) {
      const candidate = registry.admitCandidate(
        memoryCandidate({
          id: `memory_candidate_${memoryType}`,
          memoryType,
          contentDigest: sha256Text(canonicalJson(helpfulMemoryContent))
        })
      )
      expect(candidate.state).toEqual({
        status: 'quarantined',
        usePolicy: 'none',
        validationStatus: 'not-run'
      })
    }
    expect(registry.recall(recallRequest)).toEqual([])
  })

  it('rejects missing provenance, changed content, and reused immutable IDs', () => {
    const registry = new GovernedMemoryRegistry()
    expectMemoryError(
      () =>
        registry.admitCandidate(memoryCandidate({ sourceRecordIds: [], sourceEvidenceIds: [] })),
      'invalid_memory_candidate'
    )
    expectMemoryError(
      () => registry.admitCandidate(memoryCandidate({ proposedContent: { lesson: 'changed' } })),
      'invalid_memory_candidate'
    )
    registry.admitCandidate(memoryCandidate())
    expectMemoryError(
      () => registry.admitCandidate(memoryCandidate({ reasonForRetention: 'Different reuse.' })),
      'immutable_conflict'
    )
  })

  it('recalls only validated current versions inside tenant, role, task, class, scope, and time', () => {
    const registry = new GovernedMemoryRegistry()
    registry.admitCandidate(memoryCandidate())
    registry.registerVersion(memoryVersion())
    expect(registry.recall(recallRequest)).toMatchObject([
      { id: 'memory_version_helpful_v1', status: 'active' }
    ])
    for (const request of [
      { ...recallRequest, tenantId: 'tenant_other' },
      { ...recallRequest, role: 'security' },
      { ...recallRequest, taskClass: 'cdc' },
      { ...recallRequest, dataClass: 'confidential' as const },
      { ...recallRequest, productVersion: 'fixture-v2' },
      {
        ...recallRequest,
        scope: { environment: 'synthetic', system: 'other', entity: 'legacy_patient' }
      },
      { ...recallRequest, asOf: 'not-a-timestamp' },
      { ...recallRequest, asOf: '2025-01-01T00:00:00.000Z' }
    ]) {
      expect(registry.recall(request)).toEqual([])
    }
    const expired = new GovernedMemoryRegistry()
    expired.admitCandidate(
      memoryCandidate({
        retention: {
          expiresAt: '2026-01-01T00:00:30.000Z',
          deletionMode: 'retain',
          policyId: 'synthetic-memory'
        }
      })
    )
    expired.registerVersion(memoryVersion())
    expect(expired.recall(recallRequest)).toEqual([])
    expectMemoryError(() => expired.recordUse(memoryUse()), 'memory_not_recallable')
  })

  it('traces every use and removes revoked memory from new recall without rewriting history', () => {
    const registry = new GovernedMemoryRegistry()
    registry.admitCandidate(memoryCandidate())
    registry.registerVersion(memoryVersion())
    registry.recordUse(memoryUse())
    expect(registry.usesForVersion('memory_version_helpful_v1')).toMatchObject([
      { id: 'memory_use_helpful', attribution: 'helped' }
    ])
    expectMemoryError(
      () =>
        registry.applyInvalidation(
          memoryInvalidation({ impactedUseIds: [] }),
          revokedMemoryVersion()
        ),
      'incomplete_use_impact'
    )
    registry.applyInvalidation(memoryInvalidation(), revokedMemoryVersion())
    expect(registry.recall(recallRequest)).toEqual([])
    expect(registry.usesForVersion('memory_version_helpful_v1')).toHaveLength(1)

    const reconstructed = GovernedMemoryRegistry.reconstruct({
      candidates: [memoryCandidate()],
      versions: [revokedMemoryVersion(), memoryVersion()],
      uses: [memoryUse()],
      invalidations: [memoryInvalidation()]
    })
    expect(reconstructed.recall(recallRequest)).toEqual([])
    expect(reconstructed.usesForVersion('memory_version_helpful_v1')).toHaveLength(1)
    expectMemoryError(
      () =>
        GovernedMemoryRegistry.reconstruct({
          candidates: [memoryCandidate()],
          versions: [memoryVersion(), revokedMemoryVersion()],
          uses: [memoryUse()],
          invalidations: [memoryInvalidation({ impactedUseIds: [] })]
        }),
      'incomplete_use_impact'
    )
  })

  it('rejects unvalidated recall, candidate expansion, and stale use', () => {
    const registry = new GovernedMemoryRegistry()
    registry.admitCandidate(memoryCandidate())
    expectMemoryError(
      () => registry.registerVersion(memoryVersion({ validationResultIds: [] })),
      'invalid_memory_version'
    )
    expectMemoryError(
      () =>
        registry.registerVersion(
          memoryVersion({
            status: 'aging',
            validationResultIds: [],
            usePolicy: {
              allowRecall: true,
              roles: ['mapping'],
              taskClasses: ['identity-mapping'],
              dataClasses: ['synthetic']
            }
          })
        ),
      'invalid_memory_version'
    )
    expectMemoryError(
      () =>
        registry.registerVersion(
          memoryVersion({
            scope: { environment: 'synthetic', system: 'other', entity: 'legacy_patient' }
          })
        ),
      'candidate_scope_mismatch'
    )
    expectMemoryError(
      () =>
        registry.registerVersion(
          memoryVersion({
            usePolicy: {
              allowRecall: true,
              roles: ['mapping'],
              taskClasses: ['identity-mapping'],
              dataClasses: ['confidential']
            }
          })
        ),
      'candidate_data_class_mismatch'
    )
    expectMemoryError(
      () =>
        registry.registerVersion(
          memoryVersion({ canonicalSourceRecordIds: ['artifact_version_other'] })
        ),
      'candidate_provenance_mismatch'
    )
    registry.registerVersion(memoryVersion())
    registry.applyInvalidation(memoryInvalidation({ impactedUseIds: [] }), revokedMemoryVersion())
    expectMemoryError(() => registry.recordUse(memoryUse()), 'memory_not_current')
  })
})

describe('skill capability registry', () => {
  it('requires quarantine, certification, and activation before compatible resolution', () => {
    const registry = new SkillCapabilityRegistry()
    registry.registerVersion(skillVersion())
    registry.recordTransition(skillEvent(1, null, 'quarantined'))
    expect(registry.resolveActive(skillResolutionRequest)).toBeNull()
    registry.recordTransition(skillEvent(2, 'quarantined', 'certified'))
    registry.recordTransition(skillEvent(3, 'certified', 'active'))
    expect(registry.resolveActive(skillResolutionRequest)).toMatchObject({
      id: 'skill_version_identity_v1'
    })
    registry.registerVersion(
      skillVersion({
        id: 'skill_version_identity_v2',
        version: 2,
        predecessorVersionId: 'skill_version_identity_v1'
      })
    )
    registry.recordTransition(
      skillEvent(1, null, 'quarantined', {
        id: 'skill_lifecycle_identity_v2_1',
        skillVersionId: 'skill_version_identity_v2'
      })
    )
    expect(registry.resolveActive(skillResolutionRequest)).toBeNull()
  })

  it('rejects incompatible runtime, model, tool, class, and task envelopes', () => {
    const registry = SkillCapabilityRegistry.reconstruct({
      versions: [skillVersion()],
      events: [
        skillEvent(3, 'certified', 'active'),
        skillEvent(1, null, 'quarantined'),
        skillEvent(2, 'quarantined', 'certified')
      ]
    })
    const base = skillResolutionRequest
    for (const changed of [
      { ...base, runtimeVersion: '18.0.5' },
      { ...base, modelRoute: { ...base.modelRoute, model: 'other' } },
      { ...base, availableTools: [] },
      {
        ...base,
        availableTools: [{ ...base.availableTools[0]!, schemaDigest: 'c'.repeat(64) }]
      },
      {
        ...base,
        authorityEnvelope: {
          ...base.authorityEnvelope,
          networkDestinations: ['https://other.test']
        }
      },
      { ...base, dataClass: 'public' as const },
      { ...base, taskClass: 'cdc' }
    ]) {
      expect(registry.resolveActive(changed)).toBeNull()
    }
  })

  it('requires every declared dependency to be active', () => {
    const registry = new SkillCapabilityRegistry()
    registry.registerVersion(
      skillVersion({ id: 'skill_version_dependency_v1', skillId: 'skill_dependency' })
    )
    registry.recordTransition(
      skillEvent(1, null, 'quarantined', {
        id: 'skill_lifecycle_dependency_1',
        skillId: 'skill_dependency',
        skillVersionId: 'skill_version_dependency_v1'
      })
    )
    registry.registerVersion(
      skillVersion({ dependencyVersionIds: ['skill_version_dependency_v1'] })
    )
    registry.recordTransition(skillEvent(1, null, 'quarantined'))
    registry.recordTransition(skillEvent(2, 'quarantined', 'certified'))
    registry.recordTransition(skillEvent(3, 'certified', 'active'))
    expect(registry.resolveActive(skillResolutionRequest)).toBeNull()

    registry.recordTransition(
      skillEvent(2, 'quarantined', 'certified', {
        id: 'skill_lifecycle_dependency_2',
        skillId: 'skill_dependency',
        skillVersionId: 'skill_version_dependency_v1'
      })
    )
    registry.recordTransition(
      skillEvent(3, 'certified', 'active', {
        id: 'skill_lifecycle_dependency_3',
        skillId: 'skill_dependency',
        skillVersionId: 'skill_version_dependency_v1'
      })
    )
    expect(registry.resolveActive(skillResolutionRequest)).toMatchObject({
      id: 'skill_version_identity_v1'
    })
  })

  it('rejects illegal lifecycle, missing dependency, and broken version lineage', () => {
    const registry = new SkillCapabilityRegistry()
    expectSkillError(
      () =>
        registry.registerVersion(skillVersion({ dependencyVersionIds: ['skill_version_missing'] })),
      'dependency_not_found'
    )
    registry.registerVersion(skillVersion())
    expectSkillError(
      () => registry.recordTransition(skillEvent(1, null, 'active')),
      'invalid_skill_transition'
    )
    registry.recordTransition(skillEvent(1, null, 'quarantined'))
    expectSkillError(
      () => registry.recordTransition(skillEvent(3, 'quarantined', 'certified')),
      'transition_sequence_mismatch'
    )
    registry.recordTransition(skillEvent(2, 'quarantined', 'certified'))
    expectSkillError(
      () =>
        registry.recordTransition(
          skillEvent(3, 'certified', 'active', {
            certificationId: 'certification_other'
          })
        ),
      'certification_mismatch'
    )
    expectSkillError(
      () =>
        registry.recordTransition(
          skillEvent(3, 'certified', 'active', {
            createdAt: '2026-01-01T00:02:00.000Z'
          })
        ),
      'transition_timeline_mismatch'
    )
    expectSkillError(
      () =>
        registry.registerVersion(
          skillVersion({ id: 'skill_version_identity_v2', version: 2, predecessorVersionId: null })
        ),
      'invalid_skill_version'
    )
  })
})
