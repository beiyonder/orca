import { canonicalJson, sha256Text } from './canonical-json.js'
import { analyzeCdcBehavior } from './cdc-behavior-analyzer.js'
import {
  DataMovementEvaluationReportV1Schema,
  type DataMovementEvaluationReportV1
} from './domain/data-movement-evaluator-contracts.js'
import { SourceCdcAnalysisV1Schema, SourceCdcTraceV1Schema } from './domain/source-cdc-contracts.js'
import { evaluationRecordDigest } from './evaluation-contract-registry.js'

export type DataMovementOracle = {
  expectedFinalRecordCount: number
  expectedFinalKeyDigests: string[]
  expectedDeleteSequences: number[]
  expectedFinalPosition: string
  expectedFinalResumeToken: string | null
}

function keyDigest(entity: string, key: Record<string, string | number | boolean>): string {
  return sha256Text(canonicalJson({ entity, key }))
}

export function evaluateDataMovement(input: {
  trace: unknown
  analysis: unknown
  oracle: DataMovementOracle
  evidenceIds: string[]
  evaluatedAt: string
}): DataMovementEvaluationReportV1 {
  const trace = SourceCdcTraceV1Schema.parse(input.trace)
  const analysis = SourceCdcAnalysisV1Schema.parse(input.analysis)
  const state = new Map(
    trace.initialState.map((item) => [keyDigest(item.entity, item.key), item] as const)
  )
  const dispositions = new Map(
    analysis.eventDispositions.map((item) => [item.sequence, item.disposition] as const)
  )
  const appliedDeleteSequences: number[] = []
  let finalResumeToken: string | null = null
  for (const event of trace.events) {
    const disposition = dispositions.get(event.sequence)
    if (disposition !== 'applied') {
      continue
    }
    if (event.operation === 'checkpoint') {
      finalResumeToken = event.resumeToken
    }
    if (event.operation === 'truncate') {
      for (const [digest, item] of state) {
        if (event.entity === null || item.entity === event.entity) {
          state.delete(digest)
        }
      }
      continue
    }
    if (event.entity === null || event.key === null) {
      continue
    }
    const digest = keyDigest(event.entity, event.key)
    if (event.operation === 'delete') {
      state.delete(digest)
      appliedDeleteSequences.push(event.sequence)
    } else if (
      ['snapshot-row', 'insert', 'update'].includes(event.operation) &&
      event.after !== null
    ) {
      state.set(digest, {
        entity: event.entity,
        key: event.key,
        value: event.after,
        valueDigest: event.afterDigest!
      })
    }
  }
  const finalKeyDigests = [...state.keys()].toSorted()
  const finalPosition = analysis.eventDispositions.at(-1)?.position ?? ''
  const expectedKeys = [...new Set(input.oracle.expectedFinalKeyDigests)].toSorted()
  const expectedDeletes = [...new Set(input.oracle.expectedDeleteSequences)].toSorted(
    (left, right) => left - right
  )
  const replay = analyzeCdcBehavior(trace, {
    analysisId: analysis.id,
    analyzedAt: analysis.analyzedAt,
    analyzedBy: analysis.analyzedBy
  })
  const checks = {
    countsExact: analysis.finalRecordCount === input.oracle.expectedFinalRecordCount,
    keysExact: canonicalJson(finalKeyDigests) === canonicalJson(expectedKeys),
    deletesComplete: canonicalJson(appliedDeleteSequences) === canonicalJson(expectedDeletes),
    orderingValid:
      analysis.semantics.ordering === 'source-position-total' &&
      !analysis.gaps.some((gap) => gap.includes('Position regression')),
    watermarkExact:
      finalPosition === input.oracle.expectedFinalPosition &&
      finalResumeToken === input.oracle.expectedFinalResumeToken &&
      analysis.semantics.checkpoint !== 'regressed',
    replayExact:
      replay.finalStateDigest === trace.expectedFinalStateDigest &&
      evaluationRecordDigest(replay) === evaluationRecordDigest(analysis),
    dispositionsComplete:
      analysis.eventDispositions.length === trace.events.length &&
      trace.events.every((event) => dispositions.has(event.sequence))
  }
  return DataMovementEvaluationReportV1Schema.parse({
    schemaVersion: 1,
    kind: 'data-movement-evaluation-report',
    id: `data_movement_report_${sha256Text(canonicalJson({ trace: trace.id, oracle: input.oracle })).slice(0, 32)}`,
    tenantId: trace.tenantId,
    createdAt: input.evaluatedAt,
    traceId: trace.id,
    traceDigest: evaluationRecordDigest(trace),
    analysisId: analysis.id,
    analysisDigest: evaluationRecordDigest(analysis),
    oracleDigest: sha256Text(canonicalJson(input.oracle)),
    checks,
    observed: {
      initialRecordCount: trace.initialState.length,
      finalRecordCount: analysis.finalRecordCount,
      finalKeyDigests,
      appliedDeleteSequences,
      finalPosition,
      finalResumeToken,
      dispositionCount: analysis.eventDispositions.length,
      invalidDispositionCount: analysis.eventDispositions.filter(
        (item) => item.disposition === 'invalid'
      ).length
    },
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    evidenceIds: input.evidenceIds,
    evaluatedAt: input.evaluatedAt,
    evaluatedBy: { kind: 'evaluator', id: 'data-movement', version: '1' },
    limitations: ['Synthetic CDC trace; no production target was read.'],
    acceptanceAuthority: 'none'
  })
}
