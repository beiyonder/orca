import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runEvaluationMutationExperiment } from '../src/evaluation-mutation-experiment.js'
import { runSkillLifecycleExperiment } from '../src/skill-lifecycle-experiment.js'

const labRoot = fileURLToPath(new URL('../', import.meta.url))

describe('Phase Seven qualification experiments', () => {
  it('kills every seeded critical evaluator mutation without rejecting benign changes', async () => {
    const result = await runEvaluationMutationExperiment(labRoot, 708)
    expect(result).toMatchObject({
      status: 'passed',
      summary: '7/7 critical mutations killed; 0/4 benign mutations falsely rejected.'
    })
    expect(result.measures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'critical_mutation_kill_rate',
          status: 'pass',
          value: { killed: 7, seeded: 7 }
        }),
        expect.objectContaining({
          name: 'benign_false_rejections',
          status: 'pass',
          value: { rejected: 0, seeded: 4 }
        }),
        expect.objectContaining({
          name: 'failure_attribution',
          status: 'pass',
          value: { attributed: 7, seeded: 7 }
        })
      ])
    )
  })

  it('promotes a certified skill then revokes and rolls it back after injected drift', () => {
    const result = runSkillLifecycleExperiment(709)
    expect(result).toMatchObject({
      status: 'passed',
      summary:
        'Certified candidate promoted; injected drift detected; candidate revoked and baseline restored.'
    })
    expect(result.measures.map((entry) => [entry.name, entry.status])).toEqual([
      ['certified_promotion', 'pass'],
      ['drift_detection', 'pass'],
      ['automatic_demotion', 'pass'],
      ['regressed_version_revocation', 'pass'],
      ['rollback_and_impact_trace', 'pass']
    ])
  })
})
