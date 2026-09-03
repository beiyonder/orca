import type { Pool } from 'pg'
import { settlePostgresProcessObligation } from './database/postgres-process-obligation-settlement.js'
import { recordProcessObligationBreach } from './database/postgres-process-obligation-breach.js'
import { claimDueProcessObligations } from './database/postgres-process-obligation-monitor.js'
import type { ProcessCompletenessCaseResult } from './process-obligation-completeness-types.js'
import {
  createProcessCompletenessCase,
  expireProcessCompletenessCase,
  processCompletenessActor,
  triggerProcessCompletenessCase,
  type ProcessCompletenessCase
} from './process-obligation-experiment-fixture.js'

export function processCompletenessOutcome(
  name: string,
  passed: boolean,
  ...signals: string[]
): ProcessCompletenessCaseResult {
  return { name, passed, signals }
}

export async function processCompletenessRejects(
  operation: () => Promise<unknown>
): Promise<boolean> {
  try {
    await operation()
    return false
  } catch {
    return true
  }
}

export async function openProcessCompletenessCase(
  pool: Pool,
  seed: number,
  index: number,
  breachAction: 'block' | 'reconcile' = 'block'
): Promise<ProcessCompletenessCase> {
  const testCase = await createProcessCompletenessCase(pool, seed, index, { breachAction })
  await triggerProcessCompletenessCase(pool, testCase)
  return testCase
}

export async function breachProcessCompletenessCase(pool: Pool, testCase: ProcessCompletenessCase) {
  await expireProcessCompletenessCase(pool, testCase)
  const claimed = await claimDueProcessObligations(pool, {
    tenantId: testCase.fixture.tenantId,
    ownerId: `exp-13-monitor-${testCase.index}`,
    claimId: `obligation_monitor_claim_exp13_${testCase.index}`,
    leaseMs: 30_000,
    limit: 1
  })
  if (claimed.claims.length !== 1) {
    return null
  }
  const claim = claimed.claims[0]!
  const commit = await recordProcessObligationBreach(pool, claim, processCompletenessActor)
  return { claim, commit }
}

export async function satisfyProcessCompletenessCase(
  pool: Pool,
  testCase: ProcessCompletenessCase,
  suffix: string
) {
  return settlePostgresProcessObligation(pool, {
    tenantId: testCase.fixture.tenantId,
    missionId: testCase.fixture.missionId,
    obligationId: testCase.obligationId,
    expectedFence: 1,
    transitionId: `obligation_transition_exp13_${suffix}`,
    rationale: 'Authoritative mission record proves completion.',
    transitionedBy: processCompletenessActor,
    settlement: { kind: 'satisfy', proofRecordIds: [testCase.fixture.missionId] }
  })
}
