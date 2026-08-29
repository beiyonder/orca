import { canonicalJson, sha256Text } from '../src/canonical-json.js'
import { rankDiscoveryGaps } from '../src/discovery-gap-ranking.js'
import { EvidenceIdSchema } from '../src/domain/common-contracts.js'
import { SourceCdcTraceV1Schema } from '../src/domain/source-cdc-contracts.js'
import { parseDomainRecord } from '../src/domain/domain-contract-registry.js'
import { planSafeProbe } from '../src/safe-probe-planner.js'
import { compareSourceClaims } from '../src/source-claim-comparator.js'
import { CDC_REASONING_CONTRACT_SAMPLES } from './cdc-reasoning-contract-samples.js'

export const discoveryAt = '2026-01-01T00:10:00.000Z'
export const discoveryActor = { kind: 'system' as const, id: 'discovery-test', version: '1' }
export const discoveryEvidenceId = EvidenceIdSchema.parse('evidence_pagila_inventory')
const lineage = parseDomainRecord(
  'source-cdc-trace.v1',
  CDC_REASONING_CONTRACT_SAMPLES['source-cdc-trace.v1']
).lineage
const value = (id: number, name: string) => ({ actor_id: id, name })
const digest = (body: unknown) => sha256Text(canonicalJson(body))

export function discoveryCdcTrace(overrides: Record<string, unknown> = {}) {
  const actor1 = value(1, 'A')
  const actor2 = value(2, 'B')
  const actor1Updated = value(1, 'A2')
  const actor3 = value(3, 'C')
  const actor3Updated = value(3, 'C2')
  const events = [
    event(1, '001', 'snapshot-row', {
      entity: 'public.actor',
      key: { actor_id: 1 },
      after: actor1
    }),
    event(2, '002', 'snapshot-row', {
      entity: 'public.actor',
      key: { actor_id: 2 },
      after: actor2
    }),
    event(3, '003', 'snapshot-complete', { resumeToken: 'snapshot-003' }),
    event(4, '004', 'update', {
      entity: 'public.actor',
      key: { actor_id: 1 },
      beforeDigest: digest(actor1),
      after: actor1Updated,
      transactionId: 'tx-1'
    }),
    event(5, '005', 'insert', {
      entity: 'public.actor',
      key: { actor_id: 3 },
      after: actor3,
      transactionId: 'tx-1'
    }),
    event(6, '006', 'delete', {
      entity: 'public.actor',
      key: { actor_id: 2 },
      beforeDigest: digest(actor2),
      transactionId: 'tx-2'
    }),
    event(7, '007', 'ddl', { schemaVersion: '2' }),
    event(8, '008', 'checkpoint', { resumeToken: 'checkpoint-008' }),
    event(9, '008', 'checkpoint', { resumeToken: 'checkpoint-008', restartEpoch: 1 }),
    event(10, '009', 'update', {
      entity: 'public.actor',
      key: { actor_id: 3 },
      beforeDigest: digest(actor3),
      after: actor3Updated,
      restartEpoch: 1,
      occurredAt: '2026-01-01T00:00:05.000Z'
    })
  ]
  const finalState = [
    state('public.actor', { actor_id: 1 }, actor1Updated),
    state('public.actor', { actor_id: 3 }, actor3Updated)
  ]
  return SourceCdcTraceV1Schema.parse({
    schemaVersion: 1,
    kind: 'source-cdc-trace',
    id: 'source_cdc_trace_pagila_full',
    tenantId: 'tenant_s1',
    createdAt: discoveryAt,
    lineage,
    traceVersion: 'fixture-v1',
    initialState: [],
    events,
    expectedFinalStateDigest: digest(finalState),
    limitations: ['Synthetic CDC fixture.'],
    ...overrides
  })
}

function state(entity: string, key: Record<string, number>, body: unknown) {
  return { entity, key, value: body, valueDigest: digest(body) }
}

function event(
  sequence: number,
  position: string,
  operation: string,
  overrides: Record<string, unknown> = {}
) {
  const after = overrides.after ?? null
  return {
    sequence,
    position,
    transactionId: null,
    restartEpoch: 0,
    operation,
    entity: null,
    key: null,
    beforeDigest: null,
    after,
    afterDigest: after === null ? null : digest(after),
    schemaVersion: '1',
    occurredAt: `2026-01-01T00:00:${String(sequence).padStart(2, '0')}.000Z`,
    capturedAt: `2026-01-01T00:00:${String(sequence).padStart(2, '0')}.500Z`,
    resumeToken: null,
    ...overrides
  }
}

export function discoveryReasoning() {
  const comparison = compareSourceClaims(
    [
      {
        id: 'claim_actor_count',
        statement: 'Actor count is 199.',
        scope: 'public.actor',
        material: true,
        value: 199,
        observedKey: 'actor-count'
      },
      {
        id: 'claim_secret_absent',
        statement: 'Secret schema is absent.',
        scope: 'secret',
        material: true,
        value: false,
        observedKey: 'secret'
      }
    ],
    [
      {
        key: 'actor-count',
        status: 'observed',
        value: 200,
        observationIds: ['source_observation_pagila_profile'],
        evidenceIds: [discoveryEvidenceId],
        observedAt: discoveryAt,
        staleAfter: null,
        reason: 'Observed exact count.'
      },
      {
        key: 'secret',
        status: 'denied',
        value: null,
        observationIds: ['source_observation_pagila_denial'],
        evidenceIds: [discoveryEvidenceId],
        observedAt: discoveryAt,
        staleAfter: null,
        reason: 'USAGE denied.'
      }
    ],
    {
      comparisonId: 'source_claim_comparison_pagila_full',
      tenantId: 'tenant_s1',
      createdAt: discoveryAt,
      lineage,
      comparedBy: discoveryActor
    }
  )
  const ranking = rankDiscoveryGaps(
    comparison,
    [
      {
        claimId: 'claim_actor_count',
        question: 'What is the exact actor count?',
        impact: 'critical',
        blocking: 5,
        probeCost: 1,
        probeRisk: 0,
        cheapestProbeId: 'probe_actor_count',
        exceptionOnly: false
      },
      {
        claimId: 'claim_secret_absent',
        question: 'Does the denied schema exist?',
        impact: 'high',
        blocking: 4,
        probeCost: 2,
        probeRisk: 1,
        cheapestProbeId: null,
        exceptionOnly: true
      }
    ],
    {
      rankingId: 'discovery_gap_ranking_pagila_full',
      createdAt: discoveryAt,
      rankedBy: discoveryActor
    }
  )
  const actorGap = ranking.gaps.find((gap) => gap.claimIds.includes('claim_actor_count'))!
  const plan = planSafeProbe(
    ranking,
    [
      {
        id: 'probe_actor_count',
        gapIds: [actorGap.gapId],
        operation: 'run-safe-probe',
        parameters: { relation: 'public.actor', measure: 'row-count' },
        requiredScope: 'public.actor',
        limits: CDC_REASONING_CONTRACT_SAMPLES['safe-probe-plan.v1'].candidates[0]!.limits,
        predictedOutcomes: [{ count: 199 }, { count: 200 }],
        informationGain: 5,
        risk: 0,
        cost: 1,
        accessAvailable: true,
        blockers: []
      }
    ],
    {
      planId: 'safe_probe_plan_pagila_full',
      createdAt: discoveryAt,
      maximumRisk: 1,
      maximumCost: 2,
      plannedBy: discoveryActor
    }
  )
  return { comparison, ranking, plan }
}
