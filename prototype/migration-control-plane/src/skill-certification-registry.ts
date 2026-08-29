import { canonicalJson, sha256Text } from './canonical-json.js'
import {
  SkillActivePointerV1Schema,
  SkillCertificationV1Schema,
  SkillRegressionV1Schema,
  type SkillActivePointerV1,
  type SkillCertificationV1,
  type SkillRegressionV1
} from './domain/skill-certification-contracts.js'
import {
  SkillLifecycleEventV1Schema,
  SkillVersionV1Schema,
  type SkillLifecycleEventV1,
  type SkillVersionV1
} from './domain/skill-contracts.js'
import { evaluationRegistryFailure } from './evaluation-contract-registry-errors.js'

export class SkillCertificationRegistry {
  readonly #versions = new Map<string, SkillVersionV1>()
  readonly #certifications = new Map<string, SkillCertificationV1>()
  readonly #pointers = new Map<string, SkillActivePointerV1>()
  readonly #regressions = new Map<string, SkillRegressionV1>()

  registerVersion(input: unknown): SkillVersionV1 {
    const version = SkillVersionV1Schema.parse(input)
    const existing = this.#versions.get(version.id)
    if (existing) {
      if (canonicalJson(existing) !== canonicalJson(version)) {
        throw evaluationRegistryFailure('immutable_conflict', 'Skill version ID was reused')
      }
      return structuredClone(existing)
    }
    const coordinateConflict = [...this.#versions.values()].find(
      (registered) =>
        registered.skillId === version.skillId && registered.version === version.version
    )
    if (coordinateConflict) {
      throw evaluationRegistryFailure(
        'skill_version_coordinate',
        'Skill version coordinate was reused'
      )
    }
    if (version.version > 1) {
      const predecessor = this.#versions.get(version.predecessorVersionId!)
      if (
        !predecessor ||
        predecessor.skillId !== version.skillId ||
        version.version !== predecessor.version + 1
      ) {
        throw evaluationRegistryFailure('skill_version_lineage', 'Skill predecessor is invalid')
      }
    }
    this.#versions.set(version.id, structuredClone(version))
    return structuredClone(version)
  }

  registerCertification(input: unknown): SkillCertificationV1 {
    const certification = SkillCertificationV1Schema.parse(input)
    const candidate = this.#versions.get(certification.skillVersionId)
    const baseline = this.#versions.get(certification.baselineSkillVersionId)
    if (
      !candidate ||
      !baseline ||
      candidate.skillId !== certification.skillId ||
      baseline.skillId !== certification.skillId ||
      candidate.predecessorVersionId !== baseline.id ||
      candidate.artifactDigest !== certification.candidateArtifactDigest ||
      baseline.artifactDigest !== certification.baselineArtifactDigest ||
      canonicalJson(candidate.authorityEnvelope) !== canonicalJson(baseline.authorityEnvelope) ||
      canonicalJson(candidate.requiredTools) !== canonicalJson(baseline.requiredTools)
    ) {
      throw evaluationRegistryFailure(
        'skill_certification_lineage',
        'Skill certification candidate, baseline, or authority differs'
      )
    }
    const expectedContracts = new Set(candidate.evaluationContractIds)
    if (
      certification.evaluatorContracts.length !== expectedContracts.size ||
      certification.evaluatorContracts.some((contract) => !expectedContracts.has(contract.id))
    ) {
      throw evaluationRegistryFailure(
        'skill_certification_contracts',
        'Skill certification evaluator contract set differs'
      )
    }
    const existing = this.#certifications.get(certification.id)
    if (existing && canonicalJson(existing) !== canonicalJson(certification)) {
      throw evaluationRegistryFailure('immutable_conflict', 'Certification ID was reused')
    }
    this.#certifications.set(certification.id, structuredClone(certification))
    return structuredClone(certification)
  }

  recordPointer(input: unknown): SkillActivePointerV1 {
    return this.#recordPointer(input, null)
  }

  #recordPointer(input: unknown, rollbackVersionId: string | null): SkillActivePointerV1 {
    const pointer = SkillActivePointerV1Schema.parse(input)
    const prior = this.#pointers.get(pointer.skillId)
    if (pointer.revision === 0) {
      if (prior || pointer.predecessorPointerId !== null) {
        throw evaluationRegistryFailure('skill_pointer_initial', 'Initial pointer is invalid')
      }
    } else if (
      !prior ||
      pointer.revision !== prior.revision + 1 ||
      pointer.predecessorPointerId !== prior.id ||
      pointer.tenantId !== prior.tenantId
    ) {
      throw evaluationRegistryFailure(
        'skill_pointer_transition',
        'Skill pointer transition is invalid'
      )
    }
    if (pointer.status === 'active') {
      const version = this.#versions.get(pointer.activeSkillVersionId!)
      const certification =
        pointer.certificationId === null ? null : this.#certifications.get(pointer.certificationId)
      const frozenBaseline =
        version?.version === 1 &&
        pointer.certificationId === null &&
        (pointer.revision === 0 || rollbackVersionId === version.id)
      if (
        !version ||
        version.skillId !== pointer.skillId ||
        version.tenantId !== pointer.tenantId ||
        (!frozenBaseline &&
          (!certification ||
            certification.tenantId !== pointer.tenantId ||
            certification.skillVersionId !== version.id ||
            certification.status !== 'passed' ||
            (prior !== undefined &&
              certification.baselineSkillVersionId !== prior.activeSkillVersionId)))
      ) {
        throw evaluationRegistryFailure(
          'skill_pointer_authority',
          'Active pointer lacks certification'
        )
      }
    }
    this.#pointers.set(pointer.skillId, structuredClone(pointer))
    return structuredClone(pointer)
  }

  resolveActive(skillId: string, requestedVersionId?: string): SkillVersionV1 {
    const pointer = this.#pointers.get(skillId)
    if (!pointer || pointer.status !== 'active' || pointer.activeSkillVersionId === null) {
      throw evaluationRegistryFailure('skill_not_active', 'Skill has no active version')
    }
    if (requestedVersionId !== undefined && requestedVersionId !== pointer.activeSkillVersionId) {
      throw evaluationRegistryFailure(
        'skill_version_not_active',
        'Requested skill version is inactive'
      )
    }
    return structuredClone(this.#versions.get(pointer.activeSkillVersionId)!)
  }

  recordRegression(input: { regression: unknown; pointer: unknown; lifecycleEvent: unknown }): {
    regression: SkillRegressionV1
    pointer: SkillActivePointerV1
    lifecycleEvent: SkillLifecycleEventV1
  } {
    const regression = SkillRegressionV1Schema.parse(input.regression)
    const pointer = SkillActivePointerV1Schema.parse(input.pointer)
    const lifecycleEvent = SkillLifecycleEventV1Schema.parse(input.lifecycleEvent)
    const current = this.#pointers.get(regression.skillId)
    const certification = this.#certifications.get(regression.certificationId)
    if (
      !current ||
      !certification ||
      current.certificationId !== certification.id ||
      current.activeSkillVersionId !== regression.regressedSkillVersionId ||
      current.tenantId !== regression.tenantId ||
      certification.skillVersionId !== regression.regressedSkillVersionId ||
      certification.rollbackSkillVersionId !== regression.priorStableSkillVersionId ||
      regression.restoredSkillVersionId !== regression.priorStableSkillVersionId
    ) {
      throw evaluationRegistryFailure(
        'skill_regression_pointer',
        'Regression does not match active certification'
      )
    }
    const existing = this.#regressions.get(regression.id)
    if (existing && canonicalJson(existing) !== canonicalJson(regression)) {
      throw evaluationRegistryFailure('immutable_conflict', 'Regression ID was reused')
    }
    if (
      pointer.tenantId !== regression.tenantId ||
      pointer.skillId !== regression.skillId ||
      pointer.revision !== current.revision + 1 ||
      pointer.predecessorPointerId !== current.id ||
      pointer.activeSkillVersionId !== regression.restoredSkillVersionId ||
      pointer.certificationId !== null ||
      pointer.status !== 'active'
    ) {
      throw evaluationRegistryFailure(
        'skill_rollback_mismatch',
        'Pointer did not restore stable skill'
      )
    }
    const expectedLifecycleStatus = regression.action === 'revoke' ? 'revoked' : 'deprecated'
    const requiredEvidence = [regression.id, ...regression.reEvaluationResultIds]
    if (
      lifecycleEvent.tenantId !== regression.tenantId ||
      lifecycleEvent.skillId !== regression.skillId ||
      lifecycleEvent.skillVersionId !== regression.regressedSkillVersionId ||
      lifecycleEvent.certificationId !== regression.certificationId ||
      lifecycleEvent.fromStatus !== 'active' ||
      lifecycleEvent.toStatus !== expectedLifecycleStatus ||
      lifecycleEvent.createdAt !== regression.detectedAt ||
      requiredEvidence.some((id) => !lifecycleEvent.evidenceIds.includes(id))
    ) {
      throw evaluationRegistryFailure(
        'skill_regression_lifecycle',
        'Regression lifecycle event differs'
      )
    }
    const recordedPointer = this.#recordPointer(pointer, regression.restoredSkillVersionId)
    this.#regressions.set(regression.id, structuredClone(regression))
    return {
      regression: structuredClone(regression),
      pointer: recordedPointer,
      lifecycleEvent: structuredClone(lifecycleEvent)
    }
  }
}

export function pointerId(skillId: string, revision: number): string {
  return `skill_pointer_${sha256Text(canonicalJson({ skillId, revision })).slice(0, 32)}`
}
