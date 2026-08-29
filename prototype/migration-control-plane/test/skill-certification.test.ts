import { describe, expect, it } from 'vitest'
import { SkillCertificationV1Schema } from '../src/domain/skill-certification-contracts.js'
import { SkillVersionV1Schema } from '../src/domain/skill-contracts.js'
import { SkillCertificationRegistry } from '../src/skill-certification-registry.js'
import {
  BASELINE_POINTER,
  BASELINE_SKILL,
  CANDIDATE_POINTER,
  CANDIDATE_SKILL,
  REGRESSION,
  SKILL_CERTIFICATION
} from './skill-certification-fixture.js'

describe('held-out skill certification and rollback', () => {
  it('certifies only an improved bounded candidate and activates transactionally', () => {
    const registry = new SkillCertificationRegistry()
    registry.registerVersion(BASELINE_SKILL)
    registry.registerVersion(CANDIDATE_SKILL)
    registry.registerCertification(SKILL_CERTIFICATION)
    registry.recordPointer(BASELINE_POINTER)
    registry.recordPointer(CANDIDATE_POINTER)
    expect(registry.resolveActive(BASELINE_SKILL.skillId)).toEqual(CANDIDATE_SKILL)
    expect(SKILL_CERTIFICATION).toMatchObject({
      status: 'passed',
      rollbackSkillVersionId: BASELINE_SKILL.id,
      repetitions: 3,
      protectedSlices: { adversarial: 'pass', cross_tenant: 'pass' }
    })
  })

  it('rejects held-out, safety, performance, and authority failures', () => {
    const weak = structuredClone(SKILL_CERTIFICATION)
    weak.metrics[0]!.candidate = 0.85
    weak.metrics[0]!.status = 'fail'
    weak.status = 'failed'
    expect(SkillCertificationV1Schema.parse(weak).status).toBe('failed')

    const unsafe = structuredClone(SKILL_CERTIFICATION)
    unsafe.safetyGates[0]!.passed = false
    unsafe.status = 'failed'
    expect(SkillCertificationV1Schema.parse(unsafe).status).toBe('failed')

    const slow = structuredClone(SKILL_CERTIFICATION)
    slow.performance.candidateLatencyMs = 200
    slow.status = 'failed'
    expect(SkillCertificationV1Schema.parse(slow).status).toBe('failed')

    const repeatedSeed = structuredClone(SKILL_CERTIFICATION)
    repeatedSeed.seeds[1] = repeatedSeed.seeds[0]!
    expect(() => SkillCertificationV1Schema.parse(repeatedSeed)).toThrow()

    const noProtectedSlices = structuredClone(SKILL_CERTIFICATION)
    noProtectedSlices.protectedSlices = {}
    expect(() => SkillCertificationV1Schema.parse(noProtectedSlices)).toThrow()

    const expanded = SkillVersionV1Schema.parse({
      ...structuredClone(CANDIDATE_SKILL),
      authorityEnvelope: {
        ...CANDIDATE_SKILL.authorityEnvelope,
        networkDestinations: ['https://example.invalid']
      }
    })
    const registry = new SkillCertificationRegistry()
    registry.registerVersion(BASELINE_SKILL)
    registry.registerVersion(expanded)
    expect(() => registry.registerCertification(SKILL_CERTIFICATION)).toThrow(
      expect.objectContaining({ code: 'skill_certification_lineage' })
    )
  })

  it('revokes a regressed candidate, restores baseline, and blocks new candidate use', () => {
    const registry = new SkillCertificationRegistry()
    registry.registerVersion(BASELINE_SKILL)
    registry.registerVersion(CANDIDATE_SKILL)
    registry.registerCertification(SKILL_CERTIFICATION)
    registry.recordPointer(BASELINE_POINTER)
    registry.recordPointer(CANDIDATE_POINTER)
    const invalidLifecycle = structuredClone(REGRESSION)
    invalidLifecycle.lifecycleEvent.toStatus = 'deprecated'
    expect(() => registry.recordRegression(invalidLifecycle)).toThrow(
      expect.objectContaining({ code: 'skill_regression_lifecycle' })
    )
    expect(registry.resolveActive(BASELINE_SKILL.skillId)).toEqual(CANDIDATE_SKILL)
    expect(() => registry.recordPointer(REGRESSION.pointer)).toThrow(
      expect.objectContaining({ code: 'skill_pointer_authority' })
    )
    expect(registry.resolveActive(BASELINE_SKILL.skillId)).toEqual(CANDIDATE_SKILL)
    const applied = registry.recordRegression(REGRESSION)
    expect(applied.regression).toMatchObject({
      action: 'revoke',
      applied: true,
      affectedUseIds: ['capability_use_skill_s2'],
      affectedOutputIds: ['artifact_output_skill_s2']
    })
    expect(applied.lifecycleEvent).toMatchObject({ fromStatus: 'active', toStatus: 'revoked' })
    expect(registry.resolveActive(BASELINE_SKILL.skillId)).toEqual(BASELINE_SKILL)
    expect(() => registry.resolveActive(BASELINE_SKILL.skillId, CANDIDATE_SKILL.id)).toThrow(
      expect.objectContaining({ code: 'skill_version_not_active' })
    )
  })
})
