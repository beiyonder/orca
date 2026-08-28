import type {
  CorpusChunkV1,
  CorpusEntityV1,
  CorpusParseVersionV1,
  CorpusRelationV1,
  CorpusSourceManifestV1
} from './domain/knowledge-contracts.js'
import type { CorpusParseBundle, ImmutableCorpusStore } from './immutable-corpus-store.js'

export type CorpusChunkFilter = {
  tenantId: string
  sourceClasses?: readonly CorpusSourceManifestV1['sourceClass'][]
  chunkTypes?: readonly CorpusChunkV1['chunkType'][]
  system?: string
  entity?: string
  product?: string
  sourceIds?: readonly string[]
  currentOnly?: boolean
}

export type CorpusChunkRecord = {
  chunk: CorpusChunkV1
  parse: CorpusParseVersionV1
  source: CorpusSourceManifestV1
}

export type CorpusEntityRecord = {
  entity: CorpusEntityV1
  provenance: readonly CorpusChunkRecord[]
}

export type CorpusRelationRecord = {
  relation: CorpusRelationV1
  from: CorpusEntityV1
  to: CorpusEntityV1
  provenance: readonly CorpusChunkRecord[]
}

export class CorpusCatalogError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'CorpusCatalogError'
    this.code = code
  }
}

export class CorpusCatalog {
  readonly #sources = new Map<string, CorpusSourceManifestV1>()
  readonly #parses = new Map<string, CorpusParseVersionV1>()
  readonly #chunks = new Map<string, CorpusChunkV1>()
  readonly #entities = new Map<string, CorpusEntityV1>()
  readonly #relations = new Map<string, CorpusRelationV1>()

  private constructor() {}

  static fromRecords(
    sources: readonly CorpusSourceManifestV1[],
    bundles: readonly CorpusParseBundle[]
  ): CorpusCatalog {
    const catalog = new CorpusCatalog()
    for (const source of sources) {
      catalog.#insert(catalog.#sources, source.id, source, 'source')
    }
    for (const bundle of bundles) {
      catalog.#addBundle(bundle)
    }
    return catalog
  }

  static async load(store: ImmutableCorpusStore): Promise<CorpusCatalog> {
    const catalog = new CorpusCatalog()
    const [manifestIds, parseIds] = await Promise.all([
      store.listSourceManifestIds(),
      store.listParseIds()
    ])
    const [sources, bundles] = await Promise.all([
      Promise.all(manifestIds.map(async (manifestId) => store.readSource(manifestId))),
      Promise.all(parseIds.map(async (parseId) => store.readParse(parseId)))
    ])
    for (const { manifest } of sources) {
      catalog.#insert(catalog.#sources, manifest.id, manifest, 'source')
    }
    for (const bundle of bundles) {
      catalog.#addBundle(bundle)
    }
    return catalog
  }

  allChunkRecords(): readonly CorpusChunkRecord[] {
    return [...this.#chunks.keys()].toSorted().map((chunkId) => this.#chunkRecord(chunkId))
  }

  isCurrentSource(manifestId: string): boolean {
    return this.#currentManifestIds().has(manifestId)
  }

  queryChunks(filter: CorpusChunkFilter): readonly CorpusChunkRecord[] {
    const currentVersions = filter.currentOnly ? this.#currentManifestIds() : null
    const sourceClasses = filter.sourceClasses && new Set(filter.sourceClasses)
    const chunkTypes = filter.chunkTypes && new Set(filter.chunkTypes)
    const sourceIds = filter.sourceIds && new Set(filter.sourceIds)
    const records: CorpusChunkRecord[] = []
    for (const chunk of this.#chunks.values()) {
      const parse = this.#parses.get(chunk.parseVersionId)
      const source = this.#sources.get(chunk.sourceManifestId)
      if (!parse || !source) {
        throw new CorpusCatalogError(
          'broken_provenance',
          `Chunk provenance is missing: ${chunk.id}`
        )
      }
      if (source.tenantId !== filter.tenantId && source.visibility !== 'global-public') {
        continue
      }
      if (currentVersions && !currentVersions.has(source.id)) {
        continue
      }
      if (sourceClasses && !sourceClasses.has(source.sourceClass)) {
        continue
      }
      if (chunkTypes && !chunkTypes.has(chunk.chunkType)) {
        continue
      }
      if (sourceIds && !sourceIds.has(source.sourceId)) {
        continue
      }
      if (filter.system && chunk.applicability.scope.system !== filter.system) {
        continue
      }
      if (filter.entity && chunk.applicability.scope.entity !== filter.entity) {
        continue
      }
      if (filter.product && chunk.applicability.product !== filter.product) {
        continue
      }
      records.push({ chunk, parse, source })
    }
    return records.toSorted((left, right) => left.chunk.id.localeCompare(right.chunk.id))
  }

  entityById(tenantId: string, entityId: string): CorpusEntityRecord | null {
    const entity = this.#entities.get(entityId)
    if (!entity || entity.tenantId !== tenantId) {
      return null
    }
    return {
      entity,
      provenance: entity.provenanceChunkIds.map((chunkId) => this.#chunkRecord(chunkId))
    }
  }

  queryEntities(input: {
    tenantId: string
    entityType?: string
    canonicalKey?: string
  }): readonly CorpusEntityRecord[] {
    const records: CorpusEntityRecord[] = []
    for (const entity of this.#entities.values()) {
      if (entity.tenantId !== input.tenantId) {
        continue
      }
      if (input.entityType && entity.entityType !== input.entityType) {
        continue
      }
      if (input.canonicalKey && entity.canonicalKey !== input.canonicalKey) {
        continue
      }
      records.push({
        entity,
        provenance: entity.provenanceChunkIds.map((chunkId) => this.#chunkRecord(chunkId))
      })
    }
    return records.toSorted((left, right) => left.entity.id.localeCompare(right.entity.id))
  }

  relationsFor(input: {
    tenantId: string
    entityId: string
    direction?: 'from' | 'to' | 'either'
    relationTypes?: readonly string[]
  }): readonly CorpusRelationRecord[] {
    const direction = input.direction ?? 'either'
    const relationTypes = input.relationTypes && new Set(input.relationTypes)
    const records: CorpusRelationRecord[] = []
    for (const relation of this.#relations.values()) {
      if (relation.tenantId !== input.tenantId) {
        continue
      }
      if (relationTypes && !relationTypes.has(relation.relationType)) {
        continue
      }
      const matches =
        (direction !== 'to' && relation.fromEntityId === input.entityId) ||
        (direction !== 'from' && relation.toEntityId === input.entityId)
      if (!matches) {
        continue
      }
      const from = this.#entities.get(relation.fromEntityId)
      const to = this.#entities.get(relation.toEntityId)
      if (!from || !to) {
        throw new CorpusCatalogError(
          'broken_relation',
          `Relation endpoint is missing: ${relation.id}`
        )
      }
      records.push({
        relation,
        from,
        to,
        provenance: relation.provenanceChunkIds.map((chunkId) => this.#chunkRecord(chunkId))
      })
    }
    return records.toSorted((left, right) => left.relation.id.localeCompare(right.relation.id))
  }

  #addBundle(bundle: CorpusParseBundle): void {
    if (!this.#sources.has(bundle.parse.sourceManifestId)) {
      throw new CorpusCatalogError(
        'missing_source',
        `Parse source manifest is missing: ${bundle.parse.id}`
      )
    }
    this.#insert(this.#parses, bundle.parse.id, bundle.parse, 'parse')
    for (const chunk of bundle.chunks) {
      this.#insert(this.#chunks, chunk.id, chunk, 'chunk')
    }
    for (const entity of bundle.entities) {
      this.#insert(this.#entities, entity.id, entity, 'entity')
    }
    for (const relation of bundle.relations) {
      this.#insert(this.#relations, relation.id, relation, 'relation')
    }
  }

  #chunkRecord(chunkId: string): CorpusChunkRecord {
    const chunk = this.#chunks.get(chunkId)
    if (!chunk) {
      throw new CorpusCatalogError('missing_chunk', `Chunk is missing: ${chunkId}`)
    }
    const parse = this.#parses.get(chunk.parseVersionId)
    const source = this.#sources.get(chunk.sourceManifestId)
    if (!parse || !source) {
      throw new CorpusCatalogError('broken_provenance', `Chunk provenance is missing: ${chunkId}`)
    }
    return { chunk, parse, source }
  }

  #currentManifestIds(): ReadonlySet<string> {
    const latest = new Map<string, CorpusSourceManifestV1>()
    for (const source of this.#sources.values()) {
      const current = latest.get(`${source.tenantId}:${source.sourceId}`)
      if (!current || source.version > current.version) {
        latest.set(`${source.tenantId}:${source.sourceId}`, source)
      }
    }
    return new Set([...latest.values()].map((source) => source.id))
  }

  #insert<T>(map: Map<string, T>, id: string, value: T, label: string): void {
    if (map.has(id)) {
      throw new CorpusCatalogError('duplicate_id', `Duplicate ${label} ID: ${id}`)
    }
    map.set(id, value)
  }
}
