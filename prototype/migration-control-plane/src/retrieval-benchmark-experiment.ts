import { canonicalJson, canonicalizeJson } from './canonical-json.js'
import {
  createEvaluationMeasure as measure,
  type ExperimentResult
} from './experiment-contracts.js'
import { retrieveKnowledge } from './knowledge-retriever.js'
import {
  createRetrievalBenchmarkCorpus,
  RETRIEVAL_BENCHMARK_AS_OF,
  RETRIEVAL_BENCHMARK_CREATED_AT,
  RETRIEVAL_BENCHMARK_SCOPE
} from './retrieval-benchmark-corpus.js'

export function runRetrievalBenchmarkExperiment(seed: number): ExperimentResult {
  const { catalog, semanticConfig } = createRetrievalBenchmarkCorpus(seed)
  const cases = Array.from({ length: 20 }, (_, offset) => {
    const index = offset + 1
    const key = String(index).padStart(2, '0')
    const queryPhrase = index <= 15 ? `migration_topic_${key}` : `query_phrase_${key}`
    const expectedChunkId = `corpus_chunk_relevant_${key}`
    const base = {
      schemaVersion: 1,
      kind: 'retrieval-query',
      id: `retrieval_query_benchmark_${key}`,
      tenantId: 'tenant_benchmark',
      createdAt: RETRIEVAL_BENCHMARK_CREATED_AT,
      purpose: 'research',
      role: 'research',
      question: queryPhrase,
      lexicalTerms: [queryPhrase],
      scopes: [RETRIEVAL_BENCHMARK_SCOPE],
      allowedSourceClasses: ['reference'],
      allowedDataClasses: ['synthetic'],
      requiredCoverage: [{ key: `answer-${key}`, evidenceTerms: [`answer_${key}`] }],
      allowedSourceIds: [],
      currentOnly: true,
      asOf: RETRIEVAL_BENCHMARK_AS_OF,
      maximumAgeDays: 30,
      graphSeedEntityIds: [],
      maxGraphDepth: 0,
      maxCandidates: 3,
      tokenBudget: 100,
      requestedBy: { kind: 'system', id: 'benchmark', version: '1' }
    }
    const lexical = retrieveKnowledge({
      catalog,
      query: {
        ...base,
        semanticQuery: null,
        channels: { structured: false, lexical: true, semantic: false, graph: false }
      },
      semanticConfig,
      policyVersion: 'benchmark-v1'
    })
    const semantic = retrieveKnowledge({
      catalog,
      query: {
        ...base,
        id: `retrieval_query_benchmark_semantic_${key}`,
        semanticQuery: queryPhrase,
        channels: { structured: false, lexical: true, semantic: true, graph: false }
      },
      semanticConfig,
      policyVersion: 'benchmark-v1'
    })
    const lexicalHit = lexical.trace.includedCandidateIds.some(
      (id) =>
        lexical.trace.candidates.find((candidate) => candidate.id === id)?.chunkId ===
        expectedChunkId
    )
    const semanticCandidate = semantic.trace.candidates.find(
      (candidate) => candidate.chunkId === expectedChunkId
    )
    const semanticRecord =
      semanticCandidate === undefined
        ? undefined
        : semantic.recordsByCandidateId.get(semanticCandidate.id)
    const semanticHit =
      semanticCandidate !== undefined &&
      semantic.trace.includedCandidateIds.includes(semanticCandidate.id)
    const citationsValid =
      semanticHit &&
      semanticCandidate !== undefined &&
      semanticRecord !== undefined &&
      semanticCandidate.sourceManifestId === semanticRecord.source.id &&
      semanticCandidate.sourceId === semanticRecord.source.sourceId &&
      semanticCandidate.sourceVersion === semanticRecord.source.version &&
      semanticCandidate.sourceDigest === semanticRecord.source.content.sha256 &&
      semanticCandidate.parseVersionId === semanticRecord.parse.id &&
      semanticCandidate.contentDigest === semanticRecord.chunk.contentDigest &&
      canonicalJson(semanticCandidate.sourceSpan) === canonicalJson(semanticRecord.chunk.sourceSpan)
    const unauthorizedIncluded = semantic.trace.includedCandidateIds.filter((id) => {
      const candidate = semantic.trace.candidates.find((entry) => entry.id === id)
      const record = semantic.recordsByCandidateId.get(id)
      return (
        !candidate ||
        !record ||
        candidate.exclusionReason !== null ||
        record.source.tenantId !== 'tenant_benchmark' ||
        !catalog.isCurrentSource(record.source.id) ||
        record.source.freshness.kind === 'expires-at'
      )
    }).length
    const lexicalTrace = lexical.trace
    const semanticTrace = semantic.trace
    return {
      key,
      lexicalHit,
      semanticHit,
      citationsValid,
      unauthorizedIncluded,
      lexicalTrace,
      semanticTrace
    }
  })
  const lexicalHits = cases.filter((testCase) => testCase.lexicalHit).length
  const semanticHits = cases.filter((testCase) => testCase.semanticHit).length
  const cited = cases.filter((testCase) => testCase.citationsValid).length
  const unauthorized = cases.reduce((sum, testCase) => sum + testCase.unauthorizedIncluded, 0)
  const status = semanticHits >= 18 && cited === 20 && unauthorized === 0 ? 'passed' : 'failed'
  return {
    status,
    summary: `${semanticHits}/20 known answers retrieved; ${cited}/20 cited; ${unauthorized} unauthorized; semantic delta +${semanticHits - lexicalHits}.`,
    measures: [
      measure(
        'known_answer_coverage',
        semanticHits >= 18 ? 'pass' : 'fail',
        { hits: semanticHits, total: 20 },
        'at least 90% known-answer coverage',
        cases.filter((testCase) => testCase.semanticHit).map((testCase) => testCase.key)
      ),
      measure(
        'citation_completeness',
        cited === 20 ? 'pass' : 'fail',
        { cited, total: 20 },
        '100% used answers carry exact source/version/digest/span citations',
        cases.filter((testCase) => testCase.citationsValid).map((testCase) => testCase.key)
      ),
      measure(
        'authorization_isolation',
        unauthorized === 0 ? 'pass' : 'fail',
        unauthorized,
        'zero unauthorized or stale chunks included',
        []
      ),
      measure(
        'semantic_coverage_delta',
        semanticHits - lexicalHits >= 2 ? 'pass' : 'fail',
        { lexicalHits, semanticHits },
        'optional semantic channel materially improves held-out coverage',
        []
      )
    ],
    outputs: { cases: canonicalizeJson(cases) },
    limitations: ['Synthetic 55-document benchmark with a governed concept projection.']
  }
}
