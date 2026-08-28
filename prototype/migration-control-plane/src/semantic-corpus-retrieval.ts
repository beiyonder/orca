import { canonicalJson, sha256Text } from './canonical-json.js'
import type { CorpusChunkRecord } from './corpus-catalog.js'
import type { RetrievalQueryV1 } from './domain/retrieval-contracts.js'
import { tokenizeCorpusText } from './lexical-corpus-retrieval.js'

export type SemanticProjectionConfig = {
  version: string
  conceptGroups: Readonly<Record<string, readonly string[]>>
}

export type SemanticCorpusScores = {
  version: string
  configurationDigest: string
  scores: ReadonlyMap<string, number>
}

function stem(token: string): string {
  for (const suffix of ['ing', 'ed', 'es', 's']) {
    if (token.length > suffix.length + 3 && token.endsWith(suffix)) {
      return token.slice(0, -suffix.length)
    }
  }
  return token
}

function features(value: string, config: SemanticProjectionConfig): Map<string, number> {
  const result = new Map<string, number>()
  const tokens = tokenizeCorpusText(value).map(stem)
  for (const token of tokens) {
    result.set(`token:${token}`, (result.get(`token:${token}`) ?? 0) + 1)
  }
  const tokenSet = new Set(tokens)
  for (const [concept, terms] of Object.entries(config.conceptGroups)) {
    if (
      terms.some((term) =>
        tokenizeCorpusText(term)
          .map(stem)
          .some((termToken) => tokenSet.has(termToken))
      )
    ) {
      result.set(`concept:${concept}`, 2)
    }
  }
  const compact = tokens.join(' ')
  for (let index = 0; index + 2 < compact.length; index += 1) {
    const trigram = compact.slice(index, index + 3)
    result.set(`trigram:${trigram}`, (result.get(`trigram:${trigram}`) ?? 0) + 0.05)
  }
  return result
}

function cosine(left: ReadonlyMap<string, number>, right: ReadonlyMap<string, number>): number {
  let dot = 0
  let leftMagnitude = 0
  let rightMagnitude = 0
  for (const value of left.values()) {
    leftMagnitude += value * value
  }
  for (const value of right.values()) {
    rightMagnitude += value * value
  }
  for (const [key, value] of left) {
    dot += value * (right.get(key) ?? 0)
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0
  }
  return dot / Math.sqrt(leftMagnitude * rightMagnitude)
}

export function scoreSemanticCorpus(
  query: RetrievalQueryV1,
  records: readonly CorpusChunkRecord[],
  config: SemanticProjectionConfig
): SemanticCorpusScores {
  if (!query.channels.semantic || query.semanticQuery === null) {
    return {
      version: config.version,
      configurationDigest: sha256Text(canonicalJson(config)),
      scores: new Map()
    }
  }
  const queryFeatures = features(query.semanticQuery, config)
  const scores = new Map<string, number>()
  for (const record of records) {
    scores.set(record.chunk.id, cosine(queryFeatures, features(record.chunk.content, config)))
  }
  return {
    version: config.version,
    configurationDigest: sha256Text(canonicalJson(config)),
    scores
  }
}
