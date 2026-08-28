import { canonicalJson, sha256Text } from './canonical-json.js'
import {
  KnowledgeContextManifestV1Schema,
  type KnowledgeContextManifestV1,
  type RetrievalExclusionReason
} from './domain/retrieval-contracts.js'
import type { KnowledgeRetrievalResult } from './knowledge-retriever.js'

export type KnowledgeRedactionRule = {
  label: string
  literal: string
  replacement: string
}

export type KnowledgeContextAssembly = {
  manifest: KnowledgeContextManifestV1
  renderedContext: string
}

function manifestId(queryId: string, traceId: string): string {
  return `knowledge_context_${sha256Text(`${queryId}:${traceId}`).slice(0, 24)}`
}

function redact(
  content: string,
  rules: readonly KnowledgeRedactionRule[]
): { content: string; labels: string[] } {
  let rendered = content
  const labels: string[] = []
  for (const rule of rules) {
    if (rule.literal.length === 0 || !rendered.includes(rule.literal)) {
      continue
    }
    rendered = rendered.replaceAll(rule.literal, rule.replacement)
    labels.push(rule.label)
  }
  return { content: rendered, labels }
}

export function assembleKnowledgeContext(input: {
  retrieval: KnowledgeRetrievalResult
  compilerVersion: string
  redactionRules?: readonly KnowledgeRedactionRule[]
}): KnowledgeContextAssembly {
  const { query, trace, recordsByCandidateId } = input.retrieval
  const redactionRules = input.redactionRules ?? []
  const candidateById = new Map(trace.candidates.map((candidate) => [candidate.id, candidate]))
  const seenDigests = new Set<string>()
  const items: KnowledgeContextManifestV1['items'][number][] = []
  const additionalExclusions: { candidateId: string; reason: RetrievalExclusionReason }[] = []
  let tokenAllocation = 0
  for (const candidateId of trace.includedCandidateIds) {
    const candidate = candidateById.get(candidateId)
    const record = recordsByCandidateId.get(candidateId)
    if (!candidate || !record || !candidate.eligible) {
      throw new Error(`Retrieval trace cannot reconstruct candidate: ${candidateId}`)
    }
    if (seenDigests.has(candidate.contentDigest)) {
      additionalExclusions.push({ candidateId, reason: 'duplicate' })
      continue
    }
    if (tokenAllocation + candidate.tokenEstimate > query.tokenBudget) {
      additionalExclusions.push({ candidateId, reason: 'token-budget' })
      continue
    }
    const redacted = redact(record.chunk.content, redactionRules)
    if (redacted.content.length === 0) {
      additionalExclusions.push({ candidateId, reason: 'token-budget' })
      continue
    }
    seenDigests.add(candidate.contentDigest)
    tokenAllocation += candidate.tokenEstimate
    items.push({
      candidateId,
      chunkId: candidate.chunkId,
      sourceManifestId: candidate.sourceManifestId,
      sourceVersion: candidate.sourceVersion,
      sourceDigest: candidate.sourceDigest,
      sourceSpan: candidate.sourceSpan,
      renderedContent: redacted.content,
      renderedDigest: sha256Text(redacted.content),
      tokenEstimate: candidate.tokenEstimate,
      position: items.length,
      channels: candidate.channels,
      fusedScore: candidate.scores.fused,
      redactions: redacted.labels,
      inclusionReason: `Eligible rank ${items.length + 1} for ${query.purpose}`
    })
  }
  const renderedContext = canonicalJson(
    items.map((item) => ({
      citation: {
        candidateId: item.candidateId,
        chunkId: item.chunkId,
        sourceManifestId: item.sourceManifestId,
        sourceVersion: item.sourceVersion,
        sourceDigest: item.sourceDigest,
        sourceSpan: item.sourceSpan
      },
      content: item.renderedContent
    }))
  )
  const exclusions = [...trace.excluded, ...additionalExclusions].toSorted((left, right) =>
    left.candidateId.localeCompare(right.candidateId)
  )
  const manifest = KnowledgeContextManifestV1Schema.parse({
    schemaVersion: 1,
    kind: 'knowledge-context-manifest',
    id: manifestId(query.id, trace.id),
    tenantId: query.tenantId,
    createdAt: query.asOf,
    queryId: query.id,
    traceId: trace.id,
    compilerVersion: input.compilerVersion,
    policyVersion: trace.policyVersion,
    tokenBudget: query.tokenBudget,
    tokenAllocation,
    items,
    excluded: exclusions,
    renderedContextDigest: sha256Text(renderedContext),
    compiledBy: { kind: 'system', id: 'knowledge-context-compiler', version: input.compilerVersion }
  })
  return { manifest, renderedContext }
}
