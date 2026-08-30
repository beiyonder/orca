import { canonicalJson, sha256Text } from './canonical-json.js'
import {
  SkillActivePointerV1Schema,
  SkillCertificationV1Schema,
  SkillRegressionV1Schema,
  type SkillCertificationV1
} from './domain/skill-certification-contracts.js'
import { SkillLifecycleEventV1Schema, type SkillVersionV1 } from './domain/skill-contracts.js'
import { pointerId } from './skill-certification-registry.js'

export function certifySkill(
  input: Omit<SkillCertificationV1, 'schemaVersion' | 'kind' | 'id' | 'tenantId' | 'createdAt'> & {
    tenantId: string
    createdAt: string
  }
): SkillCertificationV1 {
  const identity = {
    skillVersionId: input.skillVersionId,
    baselineSkillVersionId: input.baselineSkillVersionId,
    heldOut: input.corpora.heldOut.sha256,
    results: input.evaluationResultIds.toSorted()
  }
  return SkillCertificationV1Schema.parse({
    ...input,
    schemaVersion: 1,
    kind: 'skill-certification',
    id: `certification_${sha256Text(canonicalJson(identity)).slice(0, 32)}`,
    tenantId: input.tenantId,
    createdAt: input.createdAt
  })
}

export function initializeSkillPointer(input: { baseline: SkillVersionV1; changedAt: string }) {
  return SkillActivePointerV1Schema.parse({
    schemaVersion: 1,
    kind: 'skill-active-pointer',
    id: pointerId(input.baseline.skillId, 0),
    tenantId: input.baseline.tenantId,
    createdAt: input.changedAt,
    skillId: input.baseline.skillId,
    revision: 0,
    activeSkillVersionId: input.baseline.id,
    predecessorPointerId: null,
    certificationId: null,
    status: 'active',
    changedAt: input.changedAt,
    reason: 'Frozen baseline is active before candidate certification.',
    changedBy: { kind: 'system', id: 'skill-registry', version: '1' }
  })
}

export function promoteCertifiedSkill(input: {
  current: ReturnType<typeof SkillActivePointerV1Schema.parse>
  candidate: SkillVersionV1
  certification: SkillCertificationV1
  changedAt: string
}) {
  return SkillActivePointerV1Schema.parse({
    schemaVersion: 1,
    kind: 'skill-active-pointer',
    id: pointerId(input.candidate.skillId, input.current.revision + 1),
    tenantId: input.candidate.tenantId,
    createdAt: input.changedAt,
    skillId: input.candidate.skillId,
    revision: input.current.revision + 1,
    activeSkillVersionId: input.candidate.id,
    predecessorPointerId: input.current.id,
    certificationId: input.certification.id,
    status: 'active',
    changedAt: input.changedAt,
    reason: 'Held-out certification passed within envelope.',
    changedBy: { kind: 'system', id: 'skill-registry', version: '1' }
  })
}

export function demoteRegressedSkill(input: {
  current: ReturnType<typeof SkillActivePointerV1Schema.parse>
  certification: SkillCertificationV1
  failedMetrics: string[]
  affectedUseIds: string[]
  affectedOutputIds: string[]
  reEvaluationResultIds: string[]
  detectedAt: string
}) {
  const stableId = input.certification.rollbackSkillVersionId
  const regression = SkillRegressionV1Schema.parse({
    schemaVersion: 1,
    kind: 'skill-regression',
    id: `skill_regression_${sha256Text(canonicalJson({ pointer: input.current.id, metrics: input.failedMetrics })).slice(0, 32)}`,
    tenantId: input.current.tenantId,
    createdAt: input.detectedAt,
    skillId: input.current.skillId,
    regressedSkillVersionId: input.current.activeSkillVersionId,
    priorStableSkillVersionId: stableId,
    certificationId: input.certification.id,
    failedMetrics: input.failedMetrics,
    affectedUseIds: input.affectedUseIds,
    affectedOutputIds: input.affectedOutputIds,
    action: 'revoke',
    inFlightDisposition: 'quarantine-output',
    restoredSkillVersionId: stableId,
    reEvaluationResultIds: input.reEvaluationResultIds,
    detectedAt: input.detectedAt,
    detectedBy: { kind: 'system', id: 'skill-drift-reconciler', version: '1' },
    applied: true
  })
  const pointer = SkillActivePointerV1Schema.parse({
    ...input.current,
    id: pointerId(input.current.skillId, input.current.revision + 1),
    createdAt: input.detectedAt,
    revision: input.current.revision + 1,
    activeSkillVersionId: stableId,
    predecessorPointerId: input.current.id,
    certificationId: null,
    status: 'active',
    changedAt: input.detectedAt,
    reason: 'Regression revoked candidate and restored stable predecessor.'
  })
  const lifecycleEvent = SkillLifecycleEventV1Schema.parse({
    schemaVersion: 1,
    kind: 'skill-lifecycle-event',
    id: `skill_lifecycle_${sha256Text(canonicalJson({ regression: regression.id })).slice(0, 32)}`,
    tenantId: input.current.tenantId,
    createdAt: input.detectedAt,
    skillId: input.current.skillId,
    skillVersionId: input.current.activeSkillVersionId,
    sequence: input.current.revision + 2,
    fromStatus: 'active',
    toStatus: 'revoked',
    certificationId: input.certification.id,
    evidenceIds: [regression.id, ...input.reEvaluationResultIds],
    reason: 'Critical held-out regression detected.',
    transitionedBy: { kind: 'system', id: 'skill-drift-reconciler', version: '1' }
  })
  return { regression, pointer, lifecycleEvent }
}
