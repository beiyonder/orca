import type { Pool } from 'pg'
import { settlePostgresProcessObligation } from './database/postgres-process-obligation-settlement.js'
import { rebuildProcessObligationProjection } from './database/postgres-process-obligation-replay.js'
import {
  breachProcessCompletenessCase,
  openProcessCompletenessCase,
  processCompletenessOutcome as outcome,
  processCompletenessRejects as rejects,
  satisfyProcessCompletenessCase
} from './process-obligation-campaign-scenario.js'
import type { ProcessCompletenessCaseResult } from './process-obligation-completeness-types.js'
import {
  createProcessCompletenessCase,
  insertProcessCompletenessEvidence,
  insertWrongMissionProof,
  processCompletenessActor,
  triggerProcessCompletenessCase
} from './process-obligation-experiment-fixture.js'

const PROCESS_COMPLETENESS_SWEEP_INTERVAL_MS = 30_000
export async function runProcessObligationCriticalProofCampaign(
  pool: Pool,
  seed: number
): Promise<{
  cases: ProcessCompletenessCaseResult[]
  exactRebuild: boolean
  boundedDetection: boolean
}> {
  const cases: ProcessCompletenessCaseResult[] = []
  const omitted = await createProcessCompletenessCase(pool, seed, 1)
  cases.push(
    outcome(
      'omit-obligation-instantiation',
      await rejects(() => triggerProcessCompletenessCase(pool, omitted, { omitObligation: true })),
      'obligation-instantiation'
    )
  )

  const missingCompletion = await openProcessCompletenessCase(pool, seed, 2)
  const missingBreach = await breachProcessCompletenessCase(pool, missingCompletion)
  cases.push(outcome('omit-required-completion', missingBreach !== null, 'breach-detection'))

  const heartbeat = await openProcessCompletenessCase(pool, seed, 3)
  const heartbeatBreach = await breachProcessCompletenessCase(pool, heartbeat)
  cases.push(outcome('heartbeat-without-proof', heartbeatBreach !== null, 'proof-admission'))

  const wrongTenant = await openProcessCompletenessCase(pool, seed, 4)
  const otherTenant = await createProcessCompletenessCase(pool, seed, 104)
  cases.push(
    outcome(
      'wrong-tenant-proof',
      await rejects(() =>
        settlePostgresProcessObligation(pool, {
          tenantId: wrongTenant.fixture.tenantId,
          missionId: wrongTenant.fixture.missionId,
          obligationId: wrongTenant.obligationId,
          expectedFence: 1,
          transitionId: 'obligation_transition_exp13_wrong_tenant',
          rationale: 'Injected wrong-tenant proof.',
          transitionedBy: processCompletenessActor,
          settlement: { kind: 'satisfy', proofRecordIds: [otherTenant.fixture.missionId] }
        })
      ),
      'proof-admission',
      'tenant-isolation'
    )
  )

  const wrongMission = await openProcessCompletenessCase(pool, seed, 5)
  const wrongMissionProof = await insertWrongMissionProof(pool, wrongMission)
  cases.push(
    outcome(
      'wrong-mission-proof',
      await rejects(() =>
        settlePostgresProcessObligation(pool, {
          tenantId: wrongMission.fixture.tenantId,
          missionId: wrongMission.fixture.missionId,
          obligationId: wrongMission.obligationId,
          expectedFence: 1,
          transitionId: 'obligation_transition_exp13_wrong_mission',
          rationale: 'Injected wrong-mission proof.',
          transitionedBy: processCompletenessActor,
          settlement: { kind: 'satisfy', proofRecordIds: [wrongMissionProof] }
        })
      ),
      'proof-admission'
    )
  )

  const staleFence = await openProcessCompletenessCase(pool, seed, 6)
  cases.push(
    outcome(
      'stale-fence-proof',
      await rejects(() =>
        settlePostgresProcessObligation(pool, {
          tenantId: staleFence.fixture.tenantId,
          missionId: staleFence.fixture.missionId,
          obligationId: staleFence.obligationId,
          expectedFence: 2,
          transitionId: 'obligation_transition_exp13_stale',
          rationale: 'Injected stale fence.',
          transitionedBy: processCompletenessActor,
          settlement: { kind: 'satisfy', proofRecordIds: [staleFence.fixture.missionId] }
        })
      ),
      'proof-admission'
    )
  )

  const wrongSchema = await openProcessCompletenessCase(pool, seed, 7)
  const wrongSchemaProof = await insertProcessCompletenessEvidence(pool, wrongSchema)
  cases.push(
    outcome(
      'wrong-schema-version',
      await rejects(() =>
        settlePostgresProcessObligation(pool, {
          tenantId: wrongSchema.fixture.tenantId,
          missionId: wrongSchema.fixture.missionId,
          obligationId: wrongSchema.obligationId,
          expectedFence: 1,
          transitionId: 'obligation_transition_exp13_wrong_schema',
          rationale: 'Injected wrong proof contract.',
          transitionedBy: processCompletenessActor,
          settlement: { kind: 'satisfy', proofRecordIds: [wrongSchemaProof] }
        })
      ),
      'definition-coverage',
      'proof-admission'
    )
  )

  const late = await openProcessCompletenessCase(pool, seed, 8)
  const lateBreach = await breachProcessCompletenessCase(pool, late)
  const lateSatisfied = await satisfyProcessCompletenessCase(pool, late, 'late')
  const rebuiltLate = await rebuildProcessObligationProjection(
    pool,
    late.fixture.tenantId,
    late.fixture.missionId
  )
  const replayedLate = await pool.query<{ obligation_state: string; breach_id: string | null }>(
    `SELECT obligation_state, breach_id FROM control_plane.process_obligations
     WHERE tenant_id = $1 AND obligation_id = $2`,
    [late.fixture.tenantId, late.obligationId]
  )
  const exactRebuild =
    rebuiltLate.obligationCount === 1 &&
    replayedLate.rows[0]?.obligation_state === 'satisfied' &&
    replayedLate.rows[0]?.breach_id === lateBreach?.commit.breach.id
  cases.push(
    outcome(
      'complete-after-deadline',
      exactRebuild &&
        lateSatisfied.state.status === 'satisfied' &&
        lateSatisfied.breachId === lateBreach?.commit.breach.id,
      'breach-detection',
      'proof-admission'
    )
  )

  return {
    cases,
    exactRebuild,
    boundedDetection:
      missingBreach !== null &&
      Date.parse(missingBreach.commit.breach.detectedAt) -
        Date.parse(missingBreach.commit.breach.graceUntil) <=
        2 * PROCESS_COMPLETENESS_SWEEP_INTERVAL_MS
  }
}
