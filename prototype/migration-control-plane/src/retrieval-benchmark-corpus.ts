import { sha256Text } from './canonical-json.js'
import { CorpusCatalog, type CorpusChunkRecord } from './corpus-catalog.js'
import {
  CorpusChunkV1Schema,
  CorpusParseVersionV1Schema,
  CorpusSourceManifestV1Schema,
  type CorpusSourceManifestV1
} from './domain/knowledge-contracts.js'

export const RETRIEVAL_BENCHMARK_CREATED_AT = '2026-01-01T00:00:00.000Z'
export const RETRIEVAL_BENCHMARK_AS_OF = '2026-01-15T00:00:00.000Z'
export const RETRIEVAL_BENCHMARK_SCOPE = {
  environment: 'synthetic',
  system: 'retrieval-benchmark'
}

type BenchmarkDocument = {
  source: CorpusSourceManifestV1
  record: CorpusChunkRecord
}

function document(input: {
  key: string
  tenantId: string
  content: string
  stale: boolean
  sourceId?: string
  version?: number
  supersedesManifestId?: string | null
}): BenchmarkDocument {
  const sourceBytes = Buffer.from(`${input.content}\n`)
  const sourceDigest = sha256Text(sourceBytes)
  const manifestId = `corpus_manifest_${input.key}`
  const sourceId = input.sourceId ?? `corpus_source_${input.key}`
  const version = input.version ?? 1
  const parseId = `corpus_parse_${input.key}`
  const source = CorpusSourceManifestV1Schema.parse({
    schemaVersion: 1,
    kind: 'corpus-source-manifest',
    id: manifestId,
    tenantId: input.tenantId,
    createdAt: RETRIEVAL_BENCHMARK_CREATED_AT,
    sourceId,
    version,
    sourceVersion: `benchmark-v${version}`,
    sourceClass: 'reference',
    visibility: 'tenant',
    owner: { kind: 'system', id: 'benchmark', name: 'Retrieval Benchmark' },
    permission: {
      basis: 'internal',
      licenseId: 'MIT',
      termsUri: null,
      ingestAllowed: true,
      renderAllowed: true,
      derivativeAllowed: true
    },
    canonicalUri: `fixture://retrieval-benchmark/${input.key}`,
    title: input.key,
    publisher: 'Orca Lab',
    content: {
      uri: `corpus-object://sha256/${sourceDigest}`,
      sha256: sourceDigest,
      mediaType: 'text/plain',
      bytes: sourceBytes.byteLength,
      span: { kind: 'whole' }
    },
    dataClass: 'synthetic',
    applicability: {
      scope: RETRIEVAL_BENCHMARK_SCOPE,
      product: 'benchmark',
      versionConstraint: 'v1',
      effectiveFrom: RETRIEVAL_BENCHMARK_CREATED_AT,
      effectiveUntil: null
    },
    observedAt: RETRIEVAL_BENCHMARK_CREATED_AT,
    sourcePublishedAt: null,
    freshness: input.stale
      ? { kind: 'expires-at', expiresAt: '2026-01-02T00:00:00.000Z', staleDisposition: 'exclude' }
      : { kind: 'immutable', staleDisposition: 'never-stale' },
    retention: { retainUntil: null, deletionMode: 'retain', policyId: 'benchmark' },
    supersedesManifestId: input.supersedesManifestId ?? null,
    limitations: ['Synthetic benchmark.'],
    registeredBy: { kind: 'system', id: 'benchmark', version: '1' }
  })
  const parse = CorpusParseVersionV1Schema.parse({
    schemaVersion: 1,
    kind: 'corpus-parse-version',
    id: parseId,
    tenantId: input.tenantId,
    createdAt: RETRIEVAL_BENCHMARK_CREATED_AT,
    sourceManifestId: manifestId,
    sourceId,
    sourceVersion: version,
    sourceDigest,
    parser: { name: 'benchmark', version: '1', implementationDigest: 'd'.repeat(64) },
    output: {
      uri: `corpus-parse://sha256/${sourceDigest}`,
      sha256: sourceDigest,
      mediaType: 'text/plain',
      bytes: sourceBytes.byteLength,
      span: { kind: 'whole' }
    },
    warnings: [],
    parsedBy: { kind: 'system', id: 'benchmark', version: '1' }
  })
  const chunk = CorpusChunkV1Schema.parse({
    schemaVersion: 1,
    kind: 'corpus-chunk',
    id: `corpus_chunk_${input.key}`,
    tenantId: input.tenantId,
    createdAt: RETRIEVAL_BENCHMARK_CREATED_AT,
    sourceManifestId: manifestId,
    parseVersionId: parseId,
    ordinal: 0,
    chunkType: 'document',
    content: input.content,
    contentDigest: sha256Text(input.content),
    sourceSpan: { kind: 'text-lines', startLine: 1, endLine: 1 },
    mediaType: 'text/plain',
    tokenEstimate: 8,
    sourceRole: 'external-reference',
    dataClass: 'synthetic',
    applicability: {
      scope: RETRIEVAL_BENCHMARK_SCOPE,
      product: 'benchmark',
      versionConstraint: 'v1',
      effectiveFrom: RETRIEVAL_BENCHMARK_CREATED_AT,
      effectiveUntil: null
    },
    entityKeys: []
  })
  return { source, record: { source, parse, chunk } }
}

export function createRetrievalBenchmarkCorpus(seed: number): {
  catalog: CorpusCatalog
  semanticConfig: { version: string; conceptGroups: Record<string, string[]> }
} {
  const documents: BenchmarkDocument[] = []
  const conceptGroups: Record<string, string[]> = {}
  for (let index = 1; index <= 20; index += 1) {
    const key = String(index).padStart(2, '0')
    const lexical = index <= 15
    const queryPhrase = lexical ? `migration_topic_${key}` : `query_phrase_${key}`
    const sourcePhrase = lexical ? queryPhrase : `conceptual_phrase_${key}`
    const answer = `answer_${key}`
    const conflictSourceId = `corpus_source_conflict_${key}`
    if (index <= 5) {
      documents.push(
        document({
          key: `conflict_${key}`,
          tenantId: 'tenant_benchmark',
          content: `${queryPhrase} superseded_wrong_answer_${key}.`,
          stale: false,
          sourceId: conflictSourceId
        })
      )
    }
    documents.push(
      document({
        key: `relevant_${key}`,
        tenantId: 'tenant_benchmark',
        content: `${sourcePhrase} ${answer} current primary guidance.`,
        stale: false,
        ...(index <= 5
          ? {
              sourceId: conflictSourceId,
              version: 2,
              supersedesManifestId: `corpus_manifest_conflict_${key}`
            }
          : {})
      })
    )
    documents.push(
      document({
        key: `distractor_${key}`,
        tenantId: 'tenant_benchmark',
        content: `unrelated_topic_${key} distractor material.`,
        stale: false
      })
    )
    if (index <= 10) {
      documents.push(
        document({
          key: `denied_${key}`,
          tenantId: index <= 5 ? 'tenant_other' : 'tenant_benchmark',
          content: `${queryPhrase} stale_or_cross_tenant_wrong_${key}.`,
          stale: index > 5
        })
      )
    }
    if (!lexical) conceptGroups[`concept_${key}`] = [queryPhrase, sourcePhrase]
  }
  if (seed % 2 === 1) documents.reverse()
  const sources = documents.map((entry) => entry.source)
  const bundles = documents.map((entry) => ({
    parse: entry.record.parse,
    chunks: [entry.record.chunk],
    entities: [],
    relations: []
  }))
  return {
    catalog: CorpusCatalog.fromRecords(sources, bundles),
    semanticConfig: { version: 'benchmark-concepts-v1', conceptGroups }
  }
}
