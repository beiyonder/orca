import type { Pool } from 'pg'
import { sha256Text } from './canonical-json.js'
import {
  recordProcessObligationBreach,
  runProcessObligationMonitorSweep
} from './database/postgres-process-obligation-breach.js'
import { claimDueProcessObligations } from './database/postgres-process-obligation-monitor.js'
import { settlePostgresProcessObligation } from './database/postgres-process-obligation-settlement.js'
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
  expireProcessCompletenessCase,
  insertProcessCompletenessEvidence,
  processCompletenessActor,
  triggerProcessCompletenessCase
} from './process-obligation-experiment-fixture.js'

export async function runProcessObligationCriticalRecoveryCampaign(
  pool: Pool,
  seed: number
): Promise<{
  cases: ProcessCompletenessCaseResult[]
  crossTenantEffects: number
  unauthorizedWaivers: number
  duplicateBreaches: number
  genericRetries: number
}> {
  const cases: ProcessCompletenessCaseResult[] = []
  const duplicate = await openProcessCompletenessCase(pool, seed, 9)
  await satisfyProcessCompletenessCase(pool, duplicate, 'duplicate_first')
  const duplicateRejected = await rejects(() =>
    satisfyProcessCompletenessCase(pool, duplicate, 'duplicate_second')
  )
  const duplicateTransitions = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM control_plane.domain_records
     WHERE tenant_id = $1 AND mission_id = $2
       AND schema_name = 'process-obligation-transition.v1'`,
    [duplicate.fixture.tenantId, duplicate.fixture.missionId]
  )
  cases.push(
    outcome(
      'duplicate-completion',
      duplicateRejected && duplicateTransitions.rows[0]?.count === '1',
      'proof-admission'
    )
  )

  const crashBefore = await openProcessCompletenessCase(pool, seed, 10)
  await expireProcessCompletenessCase(pool, crashBefore)
  const firstClaim = await claimDueProcessObligations(pool, {
    tenantId: crashBefore.fixture.tenantId,
    ownerId: 'exp-13-crashed-monitor',
    claimId: 'obligation_monitor_claim_exp13_crashed',
    leaseMs: 30_000,
    limit: 1
  })
  await pool.query(
    `UPDATE control_plane.process_obligations
     SET monitor_claim_expires_at = transaction_timestamp() - interval '1 millisecond'
     WHERE tenant_id = $1 AND obligation_id = $2`,
    [crashBefore.fixture.tenantId, crashBefore.obligationId]
  )
  const recoveryClaim = await claimDueProcessObligations(pool, {
    tenantId: crashBefore.fixture.tenantId,
    ownerId: 'exp-13-recovery-monitor',
    claimId: 'obligation_monitor_claim_exp13_recovery',
    leaseMs: 30_000,
    limit: 1
  })
  const oldRejected = await rejects(() =>
    recordProcessObligationBreach(pool, firstClaim.claims[0]!, processCompletenessActor)
  )
  const recovered = await recordProcessObligationBreach(
    pool,
    recoveryClaim.claims[0]!,
    processCompletenessActor
  )
  cases.push(
    outcome('monitor-crash-before-breach', oldRejected && recovered.committed, 'monitor-recovery')
  )

  const crashAfter = await openProcessCompletenessCase(pool, seed, 11)
  const firstCommit = await breachProcessCompletenessCase(pool, crashAfter)
  const acknowledged =
    firstCommit === null
      ? null
      : await recordProcessObligationBreach(pool, firstCommit.claim, processCompletenessActor)
  const breachCount = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM control_plane.domain_records
     WHERE tenant_id = $1 AND mission_id = $2
       AND schema_name = 'process-obligation-breach.v1'`,
    [crashAfter.fixture.tenantId, crashAfter.fixture.missionId]
  )
  cases.push(
    outcome(
      'monitor-crash-after-breach',
      firstCommit !== null &&
        acknowledged?.committed === false &&
        breachCount.rows[0]?.count === '1',
      'monitor-recovery'
    )
  )

  const unauthorized = await openProcessCompletenessCase(pool, seed, 12)
  const waiverEvidence = await insertProcessCompletenessEvidence(pool, unauthorized)
  const issuedAt = new Date().toISOString()
  const unauthorizedRejected = await rejects(() =>
    settlePostgresProcessObligation(pool, {
      tenantId: unauthorized.fixture.tenantId,
      missionId: unauthorized.fixture.missionId,
      obligationId: unauthorized.obligationId,
      expectedFence: 1,
      transitionId: 'obligation_transition_exp13_unauthorized_waiver',
      rationale: 'Injected unauthorized waiver.',
      transitionedBy: processCompletenessActor,
      settlement: {
        kind: 'waive',
        waiver: {
          schemaVersion: 1,
          kind: 'process-obligation-waiver',
          id: 'obligation_waiver_exp13_unauthorized',
          tenantId: unauthorized.fixture.tenantId,
          missionId: unauthorized.fixture.missionId,
          createdAt: issuedAt,
          obligationId: unauthorized.obligationId,
          definition: {
            id: unauthorized.definition.id,
            version: unauthorized.definition.version,
            digest: unauthorized.definitionDigest
          },
          scope: { kind: 'mission', id: unauthorized.fixture.missionId, subjectVersion: '2' },
          reason: 'Injected unauthorized operator.',
          evidenceIds: [waiverEvidence],
          authorizationPolicyDigest: sha256Text('exp-13-waiver-policy'),
          authorizedBy: { kind: 'operator', id: 'unauthorized-operator', version: '1' },
          issuedAt,
          expiresAt: new Date(Date.parse(issuedAt) + 30_000).toISOString(),
          residualRisk: []
        }
      }
    })
  )
  cases.push(outcome('unauthorized-waiver', unauthorizedRejected, 'proof-admission'))

  const superseded = await openProcessCompletenessCase(pool, seed, 13)
  const supersededBreach = await breachProcessCompletenessCase(pool, superseded)
  cases.push(
    outcome('supersede-without-cancellation', supersededBreach !== null, 'breach-detection')
  )

  const newRequirement = await createProcessCompletenessCase(pool, seed, 14)
  cases.push(
    outcome(
      'new-requirement-without-obligation',
      await rejects(() =>
        triggerProcessCompletenessCase(pool, newRequirement, { omitObligation: true })
      ),
      'definition-coverage',
      'obligation-instantiation'
    )
  )

  const crossTenant = await openProcessCompletenessCase(pool, seed, 15)
  await expireProcessCompletenessCase(pool, crossTenant)
  const crossTenantClaims = await claimDueProcessObligations(pool, {
    tenantId: 'tenant_exp13_other',
    ownerId: 'exp-13-cross-tenant-monitor',
    claimId: 'obligation_monitor_claim_exp13_cross_tenant',
    leaseMs: 30_000,
    limit: 10
  })
  cases.push(
    outcome('cross-tenant-claim', crossTenantClaims.claims.length === 0, 'tenant-isolation')
  )

  const unknownEffect = await openProcessCompletenessCase(pool, seed, 16, 'reconcile')
  await expireProcessCompletenessCase(pool, unknownEffect)
  const unknownSweep = await runProcessObligationMonitorSweep(pool, {
    tenantId: unknownEffect.fixture.tenantId,
    ownerId: 'exp-13-reconcile-monitor',
    claimId: 'obligation_monitor_claim_exp13_reconcile',
    leaseMs: 30_000,
    limit: 1,
    selectedBy: processCompletenessActor
  })
  const genericRetries = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM control_plane.outbox_messages
     WHERE tenant_id = $1 AND topic = 'process-obligation.response.retry'`,
    [unknownEffect.fixture.tenantId]
  )
  cases.push(
    outcome(
      'blind-retry-unknown-effect',
      unknownSweep.breaches[0]?.responseTopic === 'process-obligation.response.reconcile' &&
        genericRetries.rows[0]?.count === '0',
      'response-selection'
    )
  )

  const crossTenantEffects = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM control_plane.outbox_messages
     WHERE tenant_id = 'tenant_exp13_other'
       AND topic LIKE 'process-obligation.response.%'`
  )
  const unauthorizedWaivers = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM control_plane.domain_records
     WHERE tenant_id = $1 AND schema_name = 'process-obligation-waiver.v1'`,
    [unauthorized.fixture.tenantId]
  )
  return {
    cases,
    crossTenantEffects: Number(crossTenantEffects.rows[0]?.count ?? -1),
    unauthorizedWaivers: Number(unauthorizedWaivers.rows[0]?.count ?? -1),
    duplicateBreaches: breachCount.rows[0]?.count === '1' ? 0 : 1,
    genericRetries: Number(genericRetries.rows[0]?.count ?? -1)
  }
}
