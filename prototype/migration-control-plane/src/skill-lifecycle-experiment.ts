import { canonicalizeJson } from './canonical-json.js'
import {
  createEvaluationMeasure as measure,
  type ExperimentResult
} from './experiment-contracts.js'
import { SkillCertificationRegistry } from './skill-certification-registry.js'
import { buildSkillLifecycleQualificationFixture } from './skill-lifecycle-qualification-fixture.js'

export function runSkillLifecycleExperiment(seed: number): ExperimentResult {
  const fixture = buildSkillLifecycleQualificationFixture(seed)
  const registry = new SkillCertificationRegistry()
  registry.registerVersion(fixture.baseline)
  registry.registerVersion(fixture.candidate)
  registry.recordPointer(fixture.baselinePointer)
  const baselineResolved = registry.resolveActive(fixture.baseline.skillId)

  registry.registerCertification(fixture.certification)
  registry.recordPointer(fixture.candidatePointer)
  const promoted = registry.resolveActive(fixture.baseline.skillId)

  const rollback = registry.recordRegression(fixture.regression)
  const restored = registry.resolveActive(fixture.baseline.skillId)
  let regressedVersionBlocked = false
  try {
    registry.resolveActive(fixture.baseline.skillId, fixture.candidate.id)
  } catch {
    regressedVersionBlocked = true
  }

  const promotionPassed =
    baselineResolved.id === fixture.baseline.id && promoted.id === fixture.candidate.id
  const driftDetected =
    rollback.regression.action === 'revoke' &&
    rollback.regression.failedMetrics.includes('held_out_accuracy') &&
    rollback.regression.reEvaluationResultIds.length > 0
  const demotionPassed =
    rollback.pointer.activeSkillVersionId === fixture.baseline.id &&
    rollback.pointer.reason === 'Regression revoked candidate and restored stable predecessor.'
  const revocationPassed = rollback.lifecycleEvent.toStatus === 'revoked' && regressedVersionBlocked
  const rollbackPassed =
    restored.id === fixture.baseline.id &&
    rollback.regression.restoredSkillVersionId === fixture.baseline.id &&
    rollback.regression.affectedUseIds.length > 0 &&
    rollback.regression.affectedOutputIds.length > 0
  const measures = [
    measure(
      'certified_promotion',
      promotionPassed ? 'pass' : 'fail',
      {
        baselineVersionId: baselineResolved.id,
        promotedVersionId: promoted.id,
        certificationStatus: fixture.certification.status
      },
      'only the passed held-out candidate becomes active',
      [fixture.certification.id, fixture.candidatePointer.id]
    ),
    measure(
      'drift_detection',
      driftDetected ? 'pass' : 'fail',
      {
        action: rollback.regression.action,
        failedMetrics: rollback.regression.failedMetrics,
        reEvaluationResultIds: rollback.regression.reEvaluationResultIds
      },
      'post-deployment regression names failed metrics and re-evaluation evidence',
      [rollback.regression.id, ...rollback.regression.reEvaluationResultIds]
    ),
    measure(
      'automatic_demotion',
      demotionPassed ? 'pass' : 'fail',
      {
        activeSkillVersionId: rollback.pointer.activeSkillVersionId,
        reason: rollback.pointer.reason
      },
      'regression atomically advances the pointer to the prior stable version',
      [rollback.pointer.id, rollback.regression.id]
    ),
    measure(
      'regressed_version_revocation',
      revocationPassed ? 'pass' : 'fail',
      {
        lifecycleStatus: rollback.lifecycleEvent.toStatus,
        newAssignmentBlocked: regressedVersionBlocked
      },
      'regressed candidate is revoked and cannot resolve for new assignment',
      [rollback.lifecycleEvent.id, rollback.pointer.id]
    ),
    measure(
      'rollback_and_impact_trace',
      rollbackPassed ? 'pass' : 'fail',
      {
        restoredSkillVersionId: restored.id,
        affectedUseIds: rollback.regression.affectedUseIds,
        affectedOutputIds: rollback.regression.affectedOutputIds
      },
      'baseline is restored and affected uses/outputs remain explicit',
      [rollback.regression.id, fixture.baseline.id]
    )
  ]
  const passed = measures.every((entry) => entry.status === 'pass')
  return {
    status: passed ? 'passed' : 'failed',
    summary: passed
      ? 'Certified candidate promoted; injected drift detected; candidate revoked and baseline restored.'
      : 'Skill lifecycle qualification failed one or more gates.',
    measures,
    outputs: {
      fixtureSeed: seed,
      certification: canonicalizeJson(fixture.certification),
      promotedPointer: canonicalizeJson(fixture.candidatePointer),
      regression: canonicalizeJson(rollback.regression),
      rollbackPointer: canonicalizeJson(rollback.pointer),
      revocationEvent: canonicalizeJson(rollback.lifecycleEvent)
    },
    limitations: ['Synthetic held-out performance and post-deployment drift fixture.']
  }
}
