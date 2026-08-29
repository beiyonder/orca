import { canonicalJson, sha256Text } from '../src/canonical-json.js'

const createdAt = '2026-01-01T00:02:00.000Z'
const digestA = 'a'.repeat(64)
const actorValue = { actor_id: 1, first_name: 'PENELOPE', last_name: 'GUINESS' }
const source = {
  sourceSystemId: 'source_system_pagila',
  engine: 'postgresql',
  engineVersion: '16.15',
  databaseName: 'pagila',
  endpointDigest: 'b'.repeat(64),
  fixtureDigest: 'c22e7c170feafc06e70bee21771181e1880b5ef9c8ccc8567b093eeaf4fe025d'
}
const lineage = {
  source,
  requestId: 'source_request_pagila_cdc',
  observationId: 'source_observation_pagila_cdc',
  snapshotToken: 'fixture-cdc-snapshot',
  capturedAt: createdAt,
  capturedBy: { kind: 'system', id: 'source-adapter-postgres', version: '1' }
}
const limits = {
  timeLimitMs: 60_000,
  statementTimeoutMs: 10_000,
  queryLimit: 20,
  rowLimit: 100_000,
  byteLimit: 16_777_216,
  concurrencyLimit: 1
}

export const CDC_REASONING_CONTRACT_SAMPLES = {
  'source-cdc-trace.v1': {
    schemaVersion: 1,
    kind: 'source-cdc-trace',
    id: 'source_cdc_trace_pagila',
    tenantId: 'tenant_s1',
    createdAt,
    lineage,
    traceVersion: 'fixture-v1',
    initialState: [
      {
        entity: 'public.actor',
        key: { actor_id: 1 },
        value: actorValue,
        valueDigest: sha256Text(canonicalJson(actorValue))
      }
    ],
    events: [
      {
        sequence: 1,
        position: '0001',
        transactionId: null,
        restartEpoch: 0,
        operation: 'snapshot-complete',
        entity: null,
        key: null,
        beforeDigest: null,
        after: null,
        afterDigest: null,
        schemaVersion: '1',
        occurredAt: createdAt,
        capturedAt: createdAt,
        resumeToken: 'checkpoint-1'
      }
    ],
    expectedFinalStateDigest: digestA,
    limitations: ['Synthetic trace sample.']
  },
  'source-cdc-analysis.v1': {
    schemaVersion: 1,
    kind: 'source-cdc-analysis',
    id: 'source_cdc_analysis_pagila',
    tenantId: 'tenant_s1',
    createdAt,
    traceId: 'source_cdc_trace_pagila',
    lineage,
    semantics: {
      snapshot: 'consistent-boundary',
      ordering: 'source-position-total',
      transactions: 'not-observed',
      deletes: 'not-observed',
      amendments: 'not-observed',
      ddl: 'not-observed',
      restart: 'not-observed',
      checkpoint: 'not-observed',
      lateEvents: 'not-observed'
    },
    eventDispositions: [
      {
        sequence: 1,
        position: '0001',
        disposition: 'applied',
        reason: 'Snapshot boundary recorded.'
      }
    ],
    finalStateDigest: digestA,
    finalRecordCount: 1,
    gaps: [],
    analyzedAt: createdAt,
    analyzedBy: { kind: 'system', id: 'cdc-analyzer', version: '1' }
  },
  'source-claim-comparison.v1': {
    schemaVersion: 1,
    kind: 'source-claim-comparison',
    id: 'source_claim_comparison_pagila',
    tenantId: 'tenant_s1',
    createdAt,
    lineage,
    results: [
      {
        claimId: 'claim_actor_count',
        statement: 'The actor table has 199 rows.',
        scope: 'public.actor',
        material: true,
        observationIds: ['source_observation_pagila_profile'],
        evidenceIds: ['evidence_pagila_profile'],
        status: 'refuted',
        suppliedDigest: digestA,
        observedDigest: 'b'.repeat(64),
        reason: 'Observed count is 200.',
        absenceConclusion: false
      }
    ],
    summary: {
      supported: 0,
      refuted: 1,
      unresolved: 0,
      denied: 0,
      stale: 0,
      materialContradictions: 1
    },
    comparedAt: createdAt,
    comparedBy: { kind: 'system', id: 'claim-comparator', version: '1' }
  },
  'discovery-gap-ranking.v1': {
    schemaVersion: 1,
    kind: 'discovery-gap-ranking',
    id: 'discovery_gap_ranking_pagila',
    tenantId: 'tenant_s1',
    createdAt,
    comparisonId: 'source_claim_comparison_pagila',
    gaps: [
      {
        gapId: 'gap_discovery_claim_actor_count',
        claimIds: ['claim_actor_count'],
        question: 'Which current row count should drive planning?',
        impact: 'critical',
        evidenceIds: ['evidence_pagila_profile'],
        cheapestProbeId: 'probe_actor_count',
        exceptionOnly: false,
        score: { impact: 5, uncertainty: 2, blocking: 5, probeCost: 1, probeRisk: 0, total: 11 },
        rank: 1,
        rationale: 'Refuted count blocks reconciliation.'
      }
    ],
    rankedAt: createdAt,
    rankedBy: { kind: 'system', id: 'gap-ranker', version: '1' }
  },
  'safe-probe-plan.v1': {
    schemaVersion: 1,
    kind: 'safe-probe-plan',
    id: 'safe_probe_plan_pagila',
    tenantId: 'tenant_s1',
    createdAt,
    rankingId: 'discovery_gap_ranking_pagila',
    candidates: [
      {
        id: 'probe_actor_count',
        gapIds: ['gap_discovery_claim_actor_count'],
        operation: 'run-safe-probe',
        parameters: { relation: 'public.actor', measure: 'row-count' },
        parameterDigest: sha256Text(
          canonicalJson({ relation: 'public.actor', measure: 'row-count' })
        ),
        requiredScope: 'public.actor',
        limits,
        predictedOutcomes: [{ count: 199 }, { count: 200 }],
        informationGain: 5,
        risk: 0,
        cost: 1,
        executable: true,
        blockers: []
      }
    ],
    selectedCandidateId: 'probe_actor_count',
    humanException: null,
    plannedAt: createdAt,
    plannedBy: { kind: 'system', id: 'probe-planner', version: '1' }
  }
}
