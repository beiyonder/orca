import type { CorpusChunkRecord } from './corpus-catalog.js'
import type { RetrievalQueryV1 } from './domain/retrieval-contracts.js'

export type LexicalScore = {
  exact: number
  lexical: number
}

export const LEXICAL_RETRIEVAL_VERSION = 'bm25-simple-v1'

export function tokenizeCorpusText(value: string): readonly string[] {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .split(/[^\p{L}\p{N}_.-]+/u)
    .filter((token) => token.length > 0)
}

function frequencies(tokens: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1)
  }
  return counts
}

export function scoreLexicalCorpus(
  query: RetrievalQueryV1,
  records: readonly CorpusChunkRecord[]
): ReadonlyMap<string, LexicalScore> {
  const queryTokens = [
    ...new Set(tokenizeCorpusText(`${query.question} ${query.lexicalTerms.join(' ')}`))
  ]
  const documents = records.map((record) => {
    const tokens = tokenizeCorpusText(record.chunk.content)
    return { record, tokens, frequencies: frequencies(tokens) }
  })
  const averageLength =
    documents.length === 0
      ? 1
      : documents.reduce((sum, document) => sum + document.tokens.length, 0) / documents.length
  const documentFrequency = new Map<string, number>()
  for (const token of queryTokens) {
    documentFrequency.set(
      token,
      documents.filter((document) => document.frequencies.has(token)).length
    )
  }
  const scores = new Map<string, LexicalScore>()
  for (const document of documents) {
    let lexical = 0
    for (const token of queryTokens) {
      const frequency = document.frequencies.get(token) ?? 0
      if (frequency === 0) {
        continue
      }
      const presentDocuments = documentFrequency.get(token) ?? 0
      const inverseDocumentFrequency = Math.log(
        1 + (documents.length - presentDocuments + 0.5) / (presentDocuments + 0.5)
      )
      const lengthNormalization = 1.2 * (0.25 + 0.75 * (document.tokens.length / averageLength))
      lexical += inverseDocumentFrequency * ((frequency * 2.2) / (frequency + lengthNormalization))
    }
    const normalizedContent = document.record.chunk.content
      .normalize('NFKC')
      .toLocaleLowerCase('en-US')
    const exact = query.lexicalTerms.reduce(
      (count, term) =>
        count +
        (normalizedContent.includes(term.normalize('NFKC').toLocaleLowerCase('en-US')) ||
        document.record.chunk.entityKeys.includes(term)
          ? 1
          : 0),
      0
    )
    scores.set(document.record.chunk.id, { exact, lexical })
  }
  return scores
}
