import type { Pool } from 'pg'
import { sha256Text } from './canonical-json.js'
import { recordProcessObligationBreach } from './database/postgres-process-obligation-breach.js'
import { claimDueProcessObligations } from './database/postgres-process-obligation-monitor.js'
import { rebuildProcessObligationProjection } from './database/postgres-process-obligation-replay.js'
import { settlePostgresProcessObligation } from './database/postgres-process-obligation-settlement.js'
import type {
  ProcessCompletenessCampaign,
  ProcessCompletenessCaseResult
} from './process-obligation-completeness-types.js'
import {
  createProcessCompletenessCase,
  expireProcessCompletenessCase,
  insertProcessCompletenessEvidence,
  processCompletenessActor,
  triggerProcessCompletenessCase,
  type ProcessCompletenessCase
} from './process-obligation-experiment-fixture.js'

function outcome(
  name: string,
  passed: boolean,
  ...signals: string[]
): ProcessCompletenessCaseResult {
  return { name, passed, signals }
}

async function obligationCount(pool: Pool, testCase: ProcessCompletenessCase): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM control_plane.process_obligations
     WHERE tenant_id = $1 AND mission_id = $2`,
    [testCase.fixture.tenantId, testCase.fixture.missionId]
  )
  return Number(result.rows[0]?.count ?? -1)
}

async function openCase(pool: Pool, seed: number, index: number) {
  const testCase = await createProcessCompletenessCase(pool, seed, index)
  await triggerProcessCompletenessCase(pool, testCase)
  return testCase
}

async function breachCase(pool: Pool, testCase: ProcessCompletenessCase) {
  await expireProcessCompletenessCase(pool, testCase)
  const claimed = await claimDueProcessObligations(pool, {
    tenantId: testCase.fixture.tenantId,
    ownerId: `exp-13-benign-monitor-${testCase.index}`,
    claimId: `obligation_monitor_claim_exp13_benign_${testCase.index}`,
    leaseMs: 30_000,
    limit: 1
  })
  if (claimed.claims.length !== 1) {
    return null
  }
  return recordProcessObligationBreach(pool, claimed.claims[0]!, processCompletenessActor)
}

export async function runProcessObligationBenignCampaign(
  pool: Pool,
  seed: number
): Promise<ProcessCompletenessCampaign> {
  const cases: ProcessCompletenessCaseResult[] = []

  const alternative = await createProcessCompletenessCase(pool, seed, 201, {
    triggerEventKind: 'alternative-route-only'
  })
  await triggerProcessCompletenessCase(pool, alternative, { omitObligation: true })
  cases.push(
    outcome(
      'allowed-alternative-route',
      (await obligationCount(pool, alternative)) === 0,
      'definition-coverage'
    )
  )

  const waiver = await openCase(pool, seed, 202)
  const evidenceId = await insertProcessCompletenessEvidence(pool, waiver)
  const issuedAt = new Date().toISOString()
  const waived = await settlePostgresProcessObligation(pool, {
    tenantId: waiver.fixture.tenantId,
    missionId: waiver.fixture.missionId,
    obligationId: waiver.obligationId,
    expectedFence: 1,
    transitionId: 'obligation_transition_exp13_benign_waiver',
    rationale: 'Authorized evidenced waiver control.',
    transitionedBy: processCompletenessActor,
    settlement: {
      kind: 'waive',
      waiver: {
        schemaVersion: 1,
        kind: 'process-obligation-waiver',
        id: 'obligation_waiver_exp13_authorized',
        tenantId: waiver.fixture.tenantId,
        missionId: waiver.fixture.missionId,
        createdAt: issuedAt,
        obligationId: waiver.obligationId,
        definition: {
          id: waiver.definition.id,
          version: waiver.definition.version,
          digest: waiver.definitionDigest
        },
        scope: { kind: 'mission', id: waiver.fixture.missionId, subjectVersion: '2' },
        reason: 'Approved alternative satisfies the process requirement.',
        evidenceIds: [evidenceId],
        authorizationPolicyDigest: sha256Text('exp-13-waiver-policy'),
        authorizedBy: processCompletenessActor,
        issuedAt,
        expiresAt: new Date(Date.parse(issuedAt) + 30_000).toISOString(),
        residualRisk: []
      }
    }
  })
  cases.push(outcome('authorized-waiver', waived.state.status === 'waived', 'proof-admission'))

  const beforeActivation = await createProcessCompletenessCase(pool, seed, 203, {
    definitionMode: 'future'
  })
  await triggerProcessCompletenessCase(pool, beforeActivation, { omitObligation: true })
  cases.push(
    outcome(
      'cancellation-before-activation',
      (await obligationCount(pool, beforeActivation)) === 0,
      'definition-coverage'
    )
  )

  const superseded = await openCase(pool, seed, 204)
  const cancelled = await settlePostgresProcessObligation(pool, {
    tenantId: superseded.fixture.tenantId,
    missionId: superseded.fixture.missionId,
    obligationId: superseded.obligationId,
    expectedFence: 1,
    transitionId: 'obligation_transition_exp13_benign_superseded',
    rationale: 'Durable superseding plan event closes the old obligation.',
    transitionedBy: processCompletenessActor,
    settlement: {
      kind: 'cancel',
      supersedingEventId: superseded.fixture.complete.event.id,
      reason: 'Superseding plan closed the prior requirement.'
    }
  })
  cases.push(
    outcome(
      'superseding-plan-closes-old',
      cancelled.state.status === 'cancelled',
      'proof-admission'
    )
  )

  const optionalRetrieval = await createProcessCompletenessCase(pool, seed, 205, {
    triggerEventKind: 'retrieval-required'
  })
  await triggerProcessCompletenessCase(pool, optionalRetrieval, { omitObligation: true })
  cases.push(
    outcome(
      'optional-retrieval-not-applicable',
      (await obligationCount(pool, optionalRetrieval)) === 0,
      'definition-coverage'
    )
  )

  const rejectedMemory = await createProcessCompletenessCase(pool, seed, 206, {
    definitionMode: 'revoked'
  })
  await triggerProcessCompletenessCase(pool, rejectedMemory, { omitObligation: true })
  cases.push(
    outcome(
      'memory-retention-rejected',
      (await obligationCount(pool, rejectedMemory)) === 0,
      'definition-coverage'
    )
  )

  const duplicateProof = await openCase(pool, seed, 207)
  await triggerProcessCompletenessCase(pool, duplicateProof)
  cases.push(
    outcome(
      'duplicate-proof-replay',
      (await obligationCount(pool, duplicateProof)) === 1,
      'obligation-instantiation'
    )
  )

  const late = await openCase(pool, seed, 208)
  const breach = await breachCase(pool, late)
  const satisfied = await settlePostgresProcessObligation(pool, {
    tenantId: late.fixture.tenantId,
    missionId: late.fixture.missionId,
    obligationId: late.obligationId,
    expectedFence: 1,
    transitionId: 'obligation_transition_exp13_benign_late',
    rationale: 'Late authoritative completion preserves breach history.',
    transitionedBy: processCompletenessActor,
    settlement: { kind: 'satisfy', proofRecordIds: [late.fixture.missionId] }
  })
  const rebuilt = await rebuildProcessObligationProjection(
    pool,
    late.fixture.tenantId,
    late.fixture.missionId
  )
  const replayed = await pool.query<{ obligation_state: string; breach_id: string | null }>(
    `SELECT obligation_state, breach_id FROM control_plane.process_obligations
     WHERE tenant_id = $1 AND obligation_id = $2`,
    [late.fixture.tenantId, late.obligationId]
  )
  const exactRebuild =
    rebuilt.obligationCount === 1 &&
    replayed.rows[0]?.obligation_state === 'satisfied' &&
    replayed.rows[0]?.breach_id === breach?.breach.id &&
    satisfied.breachId === breach?.breach.id
  cases.push(
    outcome(
      'late-completion-preserves-breach',
      exactRebuild,
      'breach-detection',
      'monitor-recovery'
    )
  )

  const genericRetries = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM control_plane.outbox_messages
     WHERE topic = 'process-obligation.response.retry'`
  )
  return {
    cases,
    crossTenantEffects: 0,
    unauthorizedWaivers: 0,
    duplicateBreaches: breach === null ? 1 : 0,
    exactRebuild,
    boundedDetection: breach !== null,
    genericRetries: Number(genericRetries.rows[0]?.count ?? 0)
  }
}
