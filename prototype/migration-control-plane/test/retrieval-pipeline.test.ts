import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CorpusCatalog } from '../src/corpus-catalog.js'
import { RetrievalQueryV1Schema } from '../src/domain/retrieval-contracts.js'
import { assembleKnowledgeContext } from '../src/knowledge-context-assembler.js'
import { retrieveKnowledge, type KnowledgeRetrievalResult } from '../src/knowledge-retriever.js'
import {
  createRetrievalFixture,
  retrievalQuery,
  retrievalSemanticConfig
} from './retrieval-pipeline-fixture.js'

const roots: string[] = []
let catalog: CorpusCatalog

beforeEach(async () => {
  const root = await mkdtemp(join(tmpdir(), 'orca-retrieval-pipeline-'))
  roots.push(root)
  catalog = (await createRetrievalFixture(root)).catalog
})

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => rm(root, { recursive: true, force: true })))
})

function retrieve(overrides: Record<string, unknown> = {}): KnowledgeRetrievalResult {
  return retrieveKnowledge({
    catalog,
    query: retrievalQuery(overrides),
    semanticConfig: retrievalSemanticConfig,
    policyVersion: 'retrieval-policy-v1'
  })
}

function candidate(result: KnowledgeRetrievalResult, chunkId: string) {
  const found = result.trace.candidates.find((entry) => entry.chunkId === chunkId)
  if (!found) {
    throw new Error(`Missing retrieval candidate for ${chunkId}`)
  }
  return found
}

describe('governed corpus retrieval pipeline', () => {
  it('returns current cited chunks with transparent exact, lexical, and fusion ranks', () => {
    const result = retrieve()
    const composite = candidate(result, 'corpus_chunk_composite_key')
    expect(composite).toMatchObject({
      sourceManifestId: 'corpus_manifest_identity_profile',
      sourceVersion: 1,
      sourceSpan: { kind: 'text-lines', startLine: 2, endLine: 2 },
      channels: expect.arrayContaining(['structured', 'lexical']),
      channelRanks: expect.objectContaining({ lexical: expect.any(Number) }),
      scores: { fused: expect.any(Number) }
    })
    expect(result.trace.includedCandidateIds).toContain(composite.id)
    expect(result.trace.coverage).toEqual({
      required: ['identity-key'],
      covered: ['identity-key'],
      missing: []
    })
  })

  it('uses an optional governed semantic projection to recover a lexical paraphrase miss', () => {
    const lexical = retrieve({
      question: 'Find duplicate identities at facilities.',
      lexicalTerms: ['duplicate'],
      channels: { structured: false, lexical: true, semantic: false, graph: false },
      requiredCoverage: [{ key: 'paraphrase', evidenceTerms: ['Repeated patient records'] }]
    })
    expect(candidate(lexical, 'corpus_chunk_semantic_identity').eligible).toBe(false)

    const semantic = retrieve({
      question: 'Find duplicate identities at facilities.',
      lexicalTerms: ['duplicate'],
      semanticQuery: 'duplicate identity records at facilities',
      channels: { structured: false, lexical: true, semantic: true, graph: false },
      requiredCoverage: [{ key: 'paraphrase', evidenceTerms: ['Repeated patient records'] }]
    })
    expect(candidate(semantic, 'corpus_chunk_semantic_identity')).toMatchObject({
      eligible: true,
      channels: expect.arrayContaining(['semantic']),
      scores: { semantic: expect.any(Number), fused: expect.any(Number) }
    })
    expect(semantic.trace.coverage.missing).toEqual([])
  })

  it('expands only bounded tenant-local graph neighbors and retains edge provenance', () => {
    const result = retrieve({
      question: 'Follow the observed composite-key relation.',
      lexicalTerms: ['unmatched-term'],
      channels: { structured: false, lexical: true, semantic: false, graph: true },
      graphSeedEntityIds: ['corpus_entity_patient_num'],
      maxGraphDepth: 1,
      requiredCoverage: [{ key: 'graph-key', evidenceTerms: ['facility_id'] }]
    })
    expect(candidate(result, 'corpus_chunk_composite_key')).toMatchObject({
      eligible: true,
      channels: ['graph'],
      channelRanks: { graph: 1 }
    })
    expect(result.trace.channelVersions.graph).toBe('relational-bfs-v1')
    expect(result.trace.coverage.covered).toEqual(['graph-key'])
  })

  it('attributes tenant, data-class, render, stale, and superseded denials before ranking', () => {
    const result = retrieve({
      question: 'patient identity delete credential guidance',
      lexicalTerms: ['patient', 'delete', 'Credential'],
      maxCandidates: 100
    })
    expect(candidate(result, 'corpus_chunk_other_tenant')).toMatchObject({
      eligible: false,
      exclusionReason: 'tenant-mismatch',
      channels: [],
      scores: { exact: 0, lexical: 0, semantic: 0, graph: 0, fused: 0 }
    })
    expect(candidate(result, 'corpus_chunk_confidential_token')).toMatchObject({
      eligible: false,
      exclusionReason: 'data-class-denied',
      channels: []
    })
    expect(candidate(result, 'corpus_chunk_render_forbidden')).toMatchObject({
      eligible: false,
      exclusionReason: 'render-forbidden'
    })
    expect(candidate(result, 'corpus_chunk_stale_identity')).toMatchObject({
      eligible: false,
      exclusionReason: 'stale'
    })
    expect(candidate(result, 'corpus_chunk_delete_v1')).toMatchObject({
      eligible: false,
      exclusionReason: 'superseded'
    })
    expect(candidate(result, 'corpus_chunk_delete_v2')?.eligible).toBe(true)
  })

  it('applies source allowlists before lexical scoring', () => {
    const result = retrieve({
      lexicalTerms: ['patient_num', 'facility_id'],
      allowedSourceIds: ['corpus_source_identity_profile'],
      maxCandidates: 100
    })
    expect(candidate(result, 'corpus_chunk_composite_key')?.eligible).toBe(true)
    expect(candidate(result, 'corpus_chunk_semantic_identity')).toMatchObject({
      eligible: false,
      exclusionReason: 'source-not-allowed',
      channels: []
    })
  })

  it('assembles byte-identical cited context with deterministic redaction and deduplication', () => {
    const retrieval = retrieve({
      question: 'Credential TOKEN-123 and repeated patient identity records.',
      lexicalTerms: ['TOKEN-123', 'repeated', 'patient'],
      semanticQuery: 'duplicate patient records and credentials',
      allowedDataClasses: ['synthetic', 'confidential'],
      channels: { structured: false, lexical: true, semantic: true, graph: false },
      requiredCoverage: [
        { key: 'credential', evidenceTerms: ['TOKEN-123'] },
        { key: 'identity', evidenceTerms: ['Repeated patient records'] }
      ]
    })
    const options = {
      retrieval,
      compilerVersion: 'knowledge-context-v1',
      redactionRules: [{ label: 'fixture-token', literal: 'TOKEN-123', replacement: '[REDACTED]' }]
    }
    const first = assembleKnowledgeContext(options)
    const second = assembleKnowledgeContext(options)
    expect(second).toEqual(first)
    expect(first.renderedContext).not.toContain('TOKEN-123')
    expect(first.renderedContext).toContain('[REDACTED]')
    expect(first.manifest.items.every((item, index) => item.position === index)).toBe(true)
    expect(
      first.manifest.items.every(
        (item) => item.sourceDigest.length === 64 && item.renderedDigest.length === 64
      )
    ).toBe(true)
    expect(first.manifest.excluded).toContainEqual(expect.objectContaining({ reason: 'duplicate' }))
  })

  it('records token-budget exclusions without changing the retrieval trace', () => {
    const retrieval = retrieve({ tokenBudget: 5, maxCandidates: 100 })
    const before = structuredClone(retrieval.trace)
    const assembled = assembleKnowledgeContext({
      retrieval,
      compilerVersion: 'knowledge-context-v1'
    })
    expect(assembled.manifest.tokenAllocation).toBeLessThanOrEqual(5)
    expect(assembled.manifest.excluded).toContainEqual(
      expect.objectContaining({ reason: 'token-budget' })
    )
    expect(retrieval.trace).toEqual(before)
  })

  it('rejects semantic and graph configuration that does not match enabled channels', () => {
    expect(() =>
      RetrievalQueryV1Schema.parse(
        retrievalQuery({
          semanticQuery: 'query',
          channels: { structured: true, lexical: true, semantic: false, graph: false }
        })
      )
    ).toThrow()
    expect(() =>
      RetrievalQueryV1Schema.parse(
        retrievalQuery({
          channels: { structured: true, lexical: true, semantic: false, graph: true },
          maxGraphDepth: 0
        })
      )
    ).toThrow()
  })
})
