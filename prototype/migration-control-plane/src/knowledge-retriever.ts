import { sha256Text } from './canonical-json.js'
import { expandCorpusGraph } from './bounded-corpus-graph-retrieval.js'
import type { CorpusCatalog, CorpusChunkRecord } from './corpus-catalog.js'
import {
  RetrievalCandidateSchema,
  RetrievalQueryV1Schema,
  RetrievalTraceV1Schema,
  type RetrievalCandidate,
  type RetrievalExclusionReason,
  type RetrievalQueryV1,
  type RetrievalTraceV1
} from './domain/retrieval-contracts.js'
import { LEXICAL_RETRIEVAL_VERSION, scoreLexicalCorpus } from './lexical-corpus-retrieval.js'
import { scoreSemanticCorpus, type SemanticProjectionConfig } from './semantic-corpus-retrieval.js'
import { evaluateRetrievalEligibility } from './retrieval-authorization.js'

const FUSION_VERSION = 'rrf-k60-v1'

export type KnowledgeRetrievalResult = {
  query: RetrievalQueryV1
  trace: RetrievalTraceV1
  recordsByCandidateId: ReadonlyMap<string, CorpusChunkRecord>
}

function channelRanks(scores: ReadonlyMap<string, number>): Map<string, number> {
  return new Map(
    [...scores]
      .filter((entry) => entry[1] > 0)
      .toSorted((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([chunkId], index) => [chunkId, index + 1])
  )
}

function structuredScores(
  query: RetrievalQueryV1,
  records: readonly CorpusChunkRecord[]
): Map<string, number> {
  const scores = new Map<string, number>()
  for (const record of records) {
    let score = 0
    for (const term of query.lexicalTerms) {
      if (record.chunk.entityKeys.includes(term)) {
        score += 2
      }
      if (
        record.source.sourceId === term ||
        record.source.id === term ||
        record.chunk.id === term
      ) {
        score += 4
      }
    }
    if (query.scopes.some((scope) => scope.entity === record.chunk.applicability.scope.entity)) {
      score += 1
    }
    scores.set(record.chunk.id, score)
  }
  return scores
}

function candidateId(queryId: string, chunkId: string): string {
  return `retrieval_candidate_${sha256Text(`${queryId}:${chunkId}`).slice(0, 24)}`
}

function traceId(queryId: string): string {
  return `retrieval_trace_${sha256Text(queryId).slice(0, 24)}`
}

function fusedScore(ranks: readonly (number | undefined)[]): number {
  let score = 0
  for (const rank of ranks) {
    if (rank !== undefined) {
      score += 1 / (60 + rank)
    }
  }
  return score
}

export function retrieveKnowledge(input: {
  catalog: CorpusCatalog
  query: unknown
  semanticConfig: SemanticProjectionConfig
  policyVersion: string
}): KnowledgeRetrievalResult {
  const query = RetrievalQueryV1Schema.parse(input.query)
  const allRecords = input.catalog.allChunkRecords()
  const decisions = new Map<
    string,
    { eligible: boolean; reason: RetrievalExclusionReason | null; warnings: readonly string[] }
  >()
  for (const record of allRecords) {
    decisions.set(
      record.chunk.id,
      evaluateRetrievalEligibility({
        query,
        record,
        isCurrent: input.catalog.isCurrentSource(record.source.id),
        digestValid: sha256Text(record.chunk.content) === record.chunk.contentDigest
      })
    )
  }
  const eligibleRecords = allRecords.filter((record) => decisions.get(record.chunk.id)?.eligible)
  const structured = query.channels.structured
    ? structuredScores(query, eligibleRecords)
    : new Map<string, number>()
  const lexical = query.channels.lexical
    ? new Map(
        [...scoreLexicalCorpus(query, eligibleRecords)].map(([id, score]) => [
          id,
          score.lexical + score.exact
        ])
      )
    : new Map<string, number>()
  const semanticResult = scoreSemanticCorpus(query, eligibleRecords, input.semanticConfig)
  const semantic = new Map([...semanticResult.scores].filter((entry) => entry[1] >= 0.05))
  const graphResult = expandCorpusGraph(input.catalog, query)
  const graph = new Map(
    [...graphResult.chunkScores].filter(([chunkId]) => decisions.get(chunkId)?.eligible)
  )
  const ranks = {
    structured: channelRanks(structured),
    lexical: channelRanks(lexical),
    semantic: channelRanks(semantic),
    graph: channelRanks(graph)
  }
  const candidates: RetrievalCandidate[] = []
  const recordsByCandidateId = new Map<string, CorpusChunkRecord>()
  for (const record of allRecords) {
    const chunkId = record.chunk.id
    const decision = decisions.get(chunkId)
    if (!decision) {
      throw new Error(`Missing retrieval eligibility decision for ${chunkId}`)
    }
    const score = {
      exact: structured.get(chunkId) ?? 0,
      lexical: lexical.get(chunkId) ?? 0,
      semantic: semantic.get(chunkId) ?? 0,
      graph: graph.get(chunkId) ?? 0,
      fused: fusedScore([
        ranks.structured.get(chunkId),
        ranks.lexical.get(chunkId),
        ranks.semantic.get(chunkId),
        ranks.graph.get(chunkId)
      ])
    }
    const channelRanks = {
      ...(ranks.structured.has(chunkId) ? { structured: ranks.structured.get(chunkId)! } : {}),
      ...(ranks.lexical.has(chunkId) ? { lexical: ranks.lexical.get(chunkId)! } : {}),
      ...(ranks.semantic.has(chunkId) ? { semantic: ranks.semantic.get(chunkId)! } : {}),
      ...(ranks.graph.has(chunkId) ? { graph: ranks.graph.get(chunkId)! } : {})
    }
    const channels = Object.keys(channelRanks).toSorted()
    const scored = score.fused > 0
    const eligible = decision.eligible && scored
    const id = candidateId(query.id, chunkId)
    const candidate = RetrievalCandidateSchema.parse({
      id,
      chunkId,
      sourceManifestId: record.source.id,
      sourceId: record.source.sourceId,
      sourceVersion: record.source.version,
      sourceDigest: record.source.content.sha256,
      parseVersionId: record.parse.id,
      sourceSpan: record.chunk.sourceSpan,
      contentDigest: record.chunk.contentDigest,
      tokenEstimate: record.chunk.tokenEstimate,
      dataClass: record.chunk.dataClass,
      sourceClass: record.source.sourceClass,
      channels,
      channelRanks,
      scores: score,
      eligible,
      exclusionReason: decision.reason ?? (scored ? null : 'below-score')
    })
    candidates.push(candidate)
    recordsByCandidateId.set(candidate.id, record)
  }
  const ranked = candidates
    .filter((candidate) => candidate.eligible)
    .toSorted(
      (left, right) => right.scores.fused - left.scores.fused || left.id.localeCompare(right.id)
    )
  const included = ranked.slice(0, query.maxCandidates)
  const includedIds = new Set(included.map((candidate) => candidate.id))
  const finalizedCandidates = candidates.map((candidate) =>
    candidate.eligible && !includedIds.has(candidate.id)
      ? RetrievalCandidateSchema.parse({
          ...candidate,
          eligible: false,
          exclusionReason: 'below-score'
        })
      : candidate
  )
  const covered = query.requiredCoverage
    .filter((requirement) =>
      included.some((candidate) => {
        const content = recordsByCandidateId
          .get(candidate.id)!
          .chunk.content.toLocaleLowerCase('en-US')
        return requirement.evidenceTerms.some((term) =>
          content.includes(term.toLocaleLowerCase('en-US'))
        )
      })
    )
    .map((requirement) => requirement.key)
  const coveredSet = new Set(covered)
  const trace = RetrievalTraceV1Schema.parse({
    schemaVersion: 1,
    kind: 'retrieval-trace',
    id: traceId(query.id),
    tenantId: query.tenantId,
    createdAt: query.createdAt,
    queryId: query.id,
    policyVersion: input.policyVersion,
    channelVersions: {
      structured: 'exact-entity-v1',
      lexical: LEXICAL_RETRIEVAL_VERSION,
      semantic: `${semanticResult.version}:${semanticResult.configurationDigest}`,
      graph: graphResult.version,
      fusion: FUSION_VERSION
    },
    candidates: finalizedCandidates.toSorted((left, right) => left.id.localeCompare(right.id)),
    includedCandidateIds: included.map((candidate) => candidate.id),
    excluded: finalizedCandidates
      .filter((candidate) => !candidate.eligible)
      .map((candidate) => ({ candidateId: candidate.id, reason: candidate.exclusionReason! })),
    coverage: {
      required: query.requiredCoverage.map((requirement) => requirement.key),
      covered,
      missing: query.requiredCoverage
        .map((requirement) => requirement.key)
        .filter((key) => !coveredSet.has(key))
    },
    warnings: [
      ...new Set([
        ...graphResult.warnings,
        ...[...decisions.values()].flatMap((decision) => decision.warnings)
      ])
    ].toSorted(),
    completedAt: query.asOf
  })
  return { query, trace, recordsByCandidateId }
}
