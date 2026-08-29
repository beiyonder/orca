import { canonicalizeJson } from './canonical-json.js'
import { analyzeCdcBehavior } from './cdc-behavior-analyzer.js'
import {
  createEvaluationMeasure as measure,
  type ExperimentResult
} from './experiment-contracts.js'
import { loadDiscoveryQualificationFixture } from './discovery-qualification-fixture.js'
import { runPagilaDiscoveryPipeline } from './pagila-discovery-pipeline.js'

export async function runContradictionExperiment(
  connectionString: string,
  labRoot: string
): Promise<ExperimentResult> {
  const pipeline = await runPagilaDiscoveryPipeline({ connectionString, labRoot })
  const expected = pipeline.cases.claims.claims.filter(
    (claim) => claim.material && claim.expectedStatus === 'refuted'
  )
  const actualById = new Map(pipeline.comparison.results.map((result) => [result.claimId, result]))
  const detected = expected.filter((claim) => actualById.get(claim.id)?.status === 'refuted')
  const cited = pipeline.comparison.results.filter((result) => result.evidenceIds.length > 0)
  const falsePromotions = expected.filter(
    (claim) => actualById.get(claim.id)?.status === 'supported'
  )
  const deniedAsAbsence = pipeline.comparison.results.filter(
    (result) => result.status === 'denied' && result.absenceConclusion
  )
  const passed =
    detected.length === 8 &&
    cited.length === pipeline.comparison.results.length &&
    falsePromotions.length === 0 &&
    deniedAsAbsence.length === 0
  return {
    status: passed ? 'passed' : 'failed',
    summary: `${detected.length}/8 material contradictions detected; ${cited.length}/${pipeline.comparison.results.length} claims cited; ${falsePromotions.length} false promotions.`,
    measures: [
      measure(
        'material_contradictions',
        detected.length === 8 ? 'pass' : 'fail',
        { detected: detected.length, total: 8 },
        '8/8 material contradictions detected',
        detected.map((claim) => claim.id)
      ),
      measure(
        'claim_citations',
        cited.length === pipeline.comparison.results.length ? 'pass' : 'fail',
        { cited: cited.length, total: pipeline.comparison.results.length },
        'every comparison cites source evidence',
        cited.map((claim) => claim.claimId)
      ),
      measure(
        'unsupported_promotion',
        falsePromotions.length === 0 ? 'pass' : 'fail',
        falsePromotions.length,
        'zero contradicted claims promoted',
        []
      ),
      measure(
        'denial_not_absence',
        deniedAsAbsence.length === 0 ? 'pass' : 'fail',
        deniedAsAbsence.length,
        'zero denials interpreted as absence',
        []
      )
    ],
    outputs: {
      comparison: canonicalizeJson(pipeline.comparison),
      ranking: canonicalizeJson(pipeline.ranking),
      probePlan: canonicalizeJson(pipeline.plan)
    },
    limitations: pipeline.cases.manifest.limitations
  }
}

export async function runHiddenEstateExperiment(
  connectionString: string,
  labRoot: string
): Promise<ExperimentResult> {
  const pipeline = await runPagilaDiscoveryPipeline({ connectionString, labRoot })
  const nodes = new Set(pipeline.lineage.nodes.map((node) => node.id))
  const planted = pipeline.cases.hiddenEstate.planted
  const found = planted.filter((item) =>
    item.kind === 'asset'
      ? item.evidenceKey !== undefined && nodes.has(item.evidenceKey)
      : dependencyFound(item.id, pipeline.lineage.edges)
  )
  const fabricated = pipeline.lineage.nodes.filter(
    (node) => node.qualifiedName === pipeline.cases.hiddenEstate.decoy.identity
  )
  const denials = pipeline.cases.hiddenEstate.denials.length
  const thresholds = pipeline.cases.hiddenEstate.thresholds
  const passed =
    found.length >= thresholds.minimumPlantedRecall &&
    fabricated.length <= thresholds.maximumFabricatedAccepted &&
    denials >= thresholds.requiredExplicitDenials
  return {
    status: passed ? 'passed' : 'failed',
    summary: `${found.length}/10 planted assets/dependencies found; ${fabricated.length} fabricated accepted; ${denials}/2 denials explicit.`,
    measures: [
      measure(
        'hidden_estate_recall',
        found.length >= thresholds.minimumPlantedRecall ? 'pass' : 'fail',
        { found: found.length, total: planted.length },
        'at least 9/10 planted items',
        found.map((item) => item.id)
      ),
      measure(
        'fabricated_assets',
        fabricated.length === 0 ? 'pass' : 'fail',
        fabricated.length,
        'zero fabricated accepted assets',
        []
      ),
      measure(
        'explicit_denials',
        denials >= thresholds.requiredExplicitDenials ? 'pass' : 'fail',
        { denials, required: thresholds.requiredExplicitDenials },
        'both access denials explicit',
        pipeline.cases.hiddenEstate.denials.map((denial) => denial.scope)
      ),
      measure(
        'proposal_authority',
        pipeline.proposal.authority === 'proposal-only' ? 'pass' : 'fail',
        pipeline.proposal.authority,
        'generated migration output remains proposal-only',
        [pipeline.proposal.id]
      )
    ],
    outputs: {
      systemInventory: canonicalizeJson(pipeline.inventories.system),
      schemaInventory: canonicalizeJson(pipeline.inventories.schema),
      lineage: canonicalizeJson(pipeline.lineage),
      proposal: canonicalizeJson(pipeline.proposal)
    },
    limitations: pipeline.cases.manifest.limitations
  }
}

export async function runCdcInferenceExperiment(labRoot: string): Promise<ExperimentResult> {
  const fixture = await loadDiscoveryQualificationFixture(
    `${labRoot}/fixtures/p6-discovery-cases-v1`
  )
  const analysis = analyzeCdcBehavior(fixture.cdcTrace, {
    analysisId: 'source_cdc_analysis_pagila_experiment',
    analyzedAt: '2026-01-01T00:12:00.000Z',
    analyzedBy: { kind: 'system', id: 'cdc-experiment', version: '1' }
  })
  const exact = analysis.finalStateDigest === fixture.cdcTrace.expectedFinalStateDigest
  const disposed = analysis.eventDispositions.length === fixture.cdcTrace.events.length
  const valid = analysis.eventDispositions.every((event) => event.disposition !== 'invalid')
  const semantics = Object.values(analysis.semantics).every(
    (value) => value !== 'unknown' && value !== 'inconsistent' && value !== 'regressed'
  )
  return {
    status: exact && disposed && valid && semantics ? 'passed' : 'failed',
    summary: `${analysis.eventDispositions.length}/${fixture.cdcTrace.events.length} events disposed; final state ${exact ? 'exact' : 'mismatched'}; ${analysis.gaps.length} gaps.`,
    measures: [
      measure(
        'cdc_final_state',
        exact ? 'pass' : 'fail',
        analysis.finalStateDigest,
        'exact expected target state',
        [analysis.traceId]
      ),
      measure(
        'cdc_event_disposition',
        disposed && valid ? 'pass' : 'fail',
        { disposed: analysis.eventDispositions.length, total: fixture.cdcTrace.events.length },
        'every event explicitly and validly disposed',
        analysis.eventDispositions.map((event) => String(event.sequence))
      ),
      measure(
        'cdc_semantics',
        semantics ? 'pass' : 'fail',
        analysis.semantics,
        'snapshot/order/transaction/delete/amendment/DDL/restart/checkpoint/late semantics explicit',
        []
      )
    ],
    outputs: { analysis: canonicalizeJson(analysis) },
    limitations: fixture.manifest.limitations
  }
}

function dependencyFound(
  id: string,
  edges: readonly { fromNodeId: string; kind: string; toNodeId: string }[]
): boolean {
  if (id === 'hidden_inventory_film_fk') {
    return edges.some(
      (edge) =>
        edge.kind === 'foreign-key' &&
        edge.fromNodeId === 'relation:public.inventory' &&
        edge.toNodeId === 'relation:public.film'
    )
  }
  if (id === 'hidden_film_trigger_function') {
    return edges.some(
      (edge) =>
        edge.kind === 'trigger-invokes' &&
        edge.fromNodeId === 'trigger:public.film.last_updated' &&
        edge.toNodeId.startsWith('routine:public.last_updated(')
    )
  }
  if (id === 'hidden_actor_view_dependency') {
    return edges.some(
      (edge) =>
        edge.kind === 'view-depends-on' &&
        edge.fromNodeId === 'relation:public.actor_info' &&
        edge.toNodeId === 'relation:public.actor'
    )
  }
  return false
}
