import type { CorpusCatalog } from './corpus-catalog.js'
import type { RetrievalQueryV1 } from './domain/retrieval-contracts.js'

export type GraphRetrievalResult = {
  version: 'relational-bfs-v1'
  chunkScores: ReadonlyMap<string, number>
  visitedEntityIds: readonly string[]
  traversedRelationIds: readonly string[]
  warnings: readonly string[]
}

export function expandCorpusGraph(
  catalog: CorpusCatalog,
  query: RetrievalQueryV1
): GraphRetrievalResult {
  if (!query.channels.graph || query.maxGraphDepth === 0) {
    return {
      version: 'relational-bfs-v1',
      chunkScores: new Map(),
      visitedEntityIds: [],
      traversedRelationIds: [],
      warnings: []
    }
  }
  const chunkScores = new Map<string, number>()
  const visited = new Set<string>()
  const traversed = new Set<string>()
  const warnings: string[] = []
  let frontier: string[] = [...query.graphSeedEntityIds].toSorted()
  for (const entityId of frontier) {
    const entity = catalog.entityById(query.tenantId, entityId)
    if (!entity) {
      warnings.push(`missing-graph-seed:${entityId}`)
      continue
    }
    visited.add(entityId)
    for (const record of entity.provenance) {
      chunkScores.set(record.chunk.id, 1)
    }
  }
  for (let depth = 1; depth <= query.maxGraphDepth && frontier.length > 0; depth += 1) {
    const next = new Set<string>()
    for (const entityId of frontier) {
      for (const record of catalog.relationsFor({ tenantId: query.tenantId, entityId })) {
        if (traversed.size >= query.maxCandidates) {
          break
        }
        traversed.add(record.relation.id)
        const neighborId =
          record.relation.fromEntityId === entityId
            ? record.relation.toEntityId
            : record.relation.fromEntityId
        for (const provenance of record.provenance) {
          const score = 1 / depth
          const chunkId = provenance.chunk.id
          chunkScores.set(chunkId, Math.max(chunkScores.get(chunkId) ?? 0, score))
        }
        const neighbor = catalog.entityById(query.tenantId, neighborId)
        if (neighbor && !visited.has(neighborId)) {
          next.add(neighborId)
          for (const provenance of neighbor.provenance) {
            const score = 1 / (depth + 1)
            const chunkId = provenance.chunk.id
            chunkScores.set(chunkId, Math.max(chunkScores.get(chunkId) ?? 0, score))
          }
        }
      }
    }
    frontier = [...next].toSorted()
    for (const entityId of frontier) {
      visited.add(entityId)
    }
  }
  return {
    version: 'relational-bfs-v1',
    chunkScores,
    visitedEntityIds: [...visited].toSorted(),
    traversedRelationIds: [...traversed].toSorted(),
    warnings
  }
}
