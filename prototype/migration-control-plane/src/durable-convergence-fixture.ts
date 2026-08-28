import { buildDurableMissionFixture } from './durable-convergence-mission-fixture.js'
import { buildDurableTaskFixture } from './durable-convergence-task-fixture.js'
import type { DurableConvergenceFixture } from './durable-convergence-types.js'

export function buildDurableConvergenceFixture(seed: number): DurableConvergenceFixture {
  const mission = buildDurableMissionFixture(seed)
  return { ...mission, ...buildDurableTaskFixture(mission) }
}
