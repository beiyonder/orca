import { describe, expect, it } from 'vitest'
import type { DomainSchemaName } from '../src/domain/domain-contract-registry.js'
import { DOMAIN_SCHEMA_REGISTRY } from '../src/domain/domain-contract-registry.js'
import { DOMAIN_CONTRACT_SAMPLES } from './domain-contract-samples.js'

function sample(name: DomainSchemaName): Record<string, unknown> {
  return structuredClone(DOMAIN_CONTRACT_SAMPLES[name]) as Record<string, unknown>
}

function expectInvalid(name: DomainSchemaName, value: unknown, message?: string): void {
  const result = DOMAIN_SCHEMA_REGISTRY[name].safeParse(value)
  expect(result.success).toBe(false)
  if (!result.success && message) {
    expect(result.error.issues.map((issue) => issue.message)).toContain(message)
  }
}

describe('CDC and discovery reasoning contract invariants', () => {
  it('binds CDC state digests, row shape, and contiguous disposition evidence', () => {
    const digest = sample('source-cdc-trace.v1')
    const state = digest.initialState as Record<string, unknown>[]
    state[0]!.value = { changed: true }
    expectInvalid('source-cdc-trace.v1', digest, 'CDC state value digest differs')

    const sequence = sample('source-cdc-trace.v1')
    const events = sequence.events as Record<string, unknown>[]
    events[0]!.sequence = 2
    expectInvalid('source-cdc-trace.v1', sequence, 'CDC event sequence must be contiguous')
  })

  it('keeps claim, gap, and probe summaries arithmetically exact', () => {
    const comparison = sample('source-claim-comparison.v1')
    const summary = comparison.summary as Record<string, unknown>
    summary.refuted = 0
    expectInvalid('source-claim-comparison.v1', comparison, 'Claim comparison summary disagrees')

    const ranking = sample('discovery-gap-ranking.v1')
    const gaps = ranking.gaps as Record<string, unknown>[]
    const score = gaps[0]!.score as Record<string, unknown>
    score.total = 0
    expectInvalid('discovery-gap-ranking.v1', ranking, 'Discovery gap score arithmetic differs')

    const plan = sample('safe-probe-plan.v1')
    const candidates = plan.candidates as Record<string, unknown>[]
    candidates[0]!.parameters = { changed: true }
    expectInvalid('safe-probe-plan.v1', plan, 'Probe candidate parameter digest differs')
  })

  it('requires versioned target coverage and proposal-only complete task lineage', () => {
    const target = sample('target-capability-snapshot.v1')
    const coverage = target.coverage as Record<string, unknown>
    coverage.complete = false
    expectInvalid('target-capability-snapshot.v1', target, 'Target capability coverage disagrees')

    const proposal = sample('migration-proposal.v1')
    const tasks = proposal.tasks as Record<string, unknown>[]
    tasks[0]!.dependencyIds = ['proposal_task_missing']
    expectInvalid(
      'migration-proposal.v1',
      proposal,
      'Migration proposal task dependency is missing'
    )
  })
})
