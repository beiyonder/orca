import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { canonicalJson, sha256Text } from './canonical-json.js'
import {
  CorpusChunkV1Schema,
  CorpusEntityV1Schema,
  CorpusManifestIdSchema,
  CorpusParseIdSchema,
  CorpusParseVersionV1Schema,
  CorpusRelationV1Schema,
  CorpusSourceManifestV1Schema,
  type CorpusChunkV1,
  type CorpusEntityV1,
  type CorpusParseVersionV1,
  type CorpusRelationV1,
  type CorpusSourceManifestV1
} from './domain/knowledge-contracts.js'
import {
  corpusFailure,
  openCorpusRoot,
  readImmutableCorpusFile,
  verifyCorpusBytes,
  writeImmutableCorpusFile
} from './immutable-corpus-files.js'

export { ImmutableCorpusStoreError } from './immutable-corpus-files.js'

export type CorpusParseBundle = {
  parse: CorpusParseVersionV1
  chunks: readonly CorpusChunkV1[]
  entities: readonly CorpusEntityV1[]
  relations: readonly CorpusRelationV1[]
}

export type StoredCorpusSource = {
  manifest: CorpusSourceManifestV1
  objectPath: string
  manifestPath: string
}

export type StoreCorpusParseInput = {
  parse: unknown
  chunks: readonly unknown[]
  entities: readonly unknown[]
  relations: readonly unknown[]
  parsedBytes: Uint8Array
}

export class ImmutableCorpusStore {
  readonly #root: string

  private constructor(root: string) {
    this.#root = root
  }

  static async open(root: string): Promise<ImmutableCorpusStore> {
    return new ImmutableCorpusStore(
      await openCorpusRoot(root, [
        'objects',
        'manifests',
        'sources',
        'parse-objects',
        'parse-bundles'
      ])
    )
  }

  async ingestSource(manifestInput: unknown, bytes: Uint8Array): Promise<StoredCorpusSource> {
    let manifest: CorpusSourceManifestV1
    try {
      manifest = CorpusSourceManifestV1Schema.parse(manifestInput)
    } catch (error) {
      throw corpusFailure('invalid_source_manifest', 'Corpus source manifest is invalid', error)
    }
    verifyCorpusBytes(bytes, manifest.content, 'Source object')
    await this.#verifyPredecessor(manifest)
    const objectPath = this.#objectPath('objects', manifest.content.sha256)
    const manifestPath = this.#manifestPath(manifest.id)
    const sourceVersionPath = this.#sourceVersionPath(manifest.sourceId, manifest.version)
    await writeImmutableCorpusFile(objectPath, bytes)
    await writeImmutableCorpusFile(manifestPath, Buffer.from(canonicalJson(manifest)))
    await writeImmutableCorpusFile(sourceVersionPath, Buffer.from(`${manifest.id}\n`))
    return { manifest, objectPath, manifestPath }
  }

  async readSource(
    manifestId: string
  ): Promise<{ manifest: CorpusSourceManifestV1; bytes: Buffer }> {
    const parsedManifestId = CorpusManifestIdSchema.safeParse(manifestId)
    if (!parsedManifestId.success) {
      throw corpusFailure('invalid_identifier', `Corpus manifest ID is invalid: ${manifestId}`)
    }
    let manifest: CorpusSourceManifestV1
    try {
      const manifestBytes = await readImmutableCorpusFile(this.#manifestPath(parsedManifestId.data))
      manifest = CorpusSourceManifestV1Schema.parse(
        JSON.parse(manifestBytes.toString('utf8')) as unknown
      )
    } catch (error) {
      throw corpusFailure(
        'source_not_readable',
        `Corpus source is not readable: ${manifestId}`,
        error
      )
    }
    const bytes = await readImmutableCorpusFile(
      this.#objectPath('objects', manifest.content.sha256)
    )
    verifyCorpusBytes(bytes, manifest.content, 'Stored source object')
    return { manifest, bytes }
  }

  async storeParse(input: StoreCorpusParseInput): Promise<CorpusParseBundle> {
    let bundle: CorpusParseBundle
    try {
      bundle = {
        parse: CorpusParseVersionV1Schema.parse(input.parse),
        chunks: input.chunks.map((chunk) => CorpusChunkV1Schema.parse(chunk)),
        entities: input.entities.map((entity) => CorpusEntityV1Schema.parse(entity)),
        relations: input.relations.map((relation) => CorpusRelationV1Schema.parse(relation))
      }
    } catch (error) {
      throw corpusFailure('invalid_parse_bundle', 'Corpus parse bundle is invalid', error)
    }
    verifyCorpusBytes(input.parsedBytes, bundle.parse.output, 'Parsed object')
    await this.#validateBundle(bundle, input.parsedBytes)
    await writeImmutableCorpusFile(
      this.#objectPath('parse-objects', bundle.parse.output.sha256),
      input.parsedBytes
    )
    await writeImmutableCorpusFile(
      this.#parseBundlePath(bundle.parse.id),
      Buffer.from(canonicalJson(bundle))
    )
    return bundle
  }

  async readParse(parseId: string): Promise<CorpusParseBundle & { parsedBytes: Buffer }> {
    const parsedParseId = CorpusParseIdSchema.safeParse(parseId)
    if (!parsedParseId.success) {
      throw corpusFailure('invalid_identifier', `Corpus parse ID is invalid: ${parseId}`)
    }
    let bundle: CorpusParseBundle
    try {
      const bundleBytes = await readImmutableCorpusFile(this.#parseBundlePath(parsedParseId.data))
      const input = JSON.parse(bundleBytes.toString('utf8')) as {
        parse: unknown
        chunks: unknown[]
        entities: unknown[]
        relations: unknown[]
      }
      bundle = {
        parse: CorpusParseVersionV1Schema.parse(input.parse),
        chunks: input.chunks.map((chunk) => CorpusChunkV1Schema.parse(chunk)),
        entities: input.entities.map((entity) => CorpusEntityV1Schema.parse(entity)),
        relations: input.relations.map((relation) => CorpusRelationV1Schema.parse(relation))
      }
    } catch (error) {
      throw corpusFailure('parse_not_readable', `Corpus parse is not readable: ${parseId}`, error)
    }
    const parsedBytes = await readImmutableCorpusFile(
      this.#objectPath('parse-objects', bundle.parse.output.sha256)
    )
    verifyCorpusBytes(parsedBytes, bundle.parse.output, 'Stored parsed object')
    await this.#validateBundle(bundle, parsedBytes)
    return { ...bundle, parsedBytes }
  }

  async listSourceManifestIds(): Promise<readonly string[]> {
    return (await readdir(join(this.#root, 'manifests')))
      .filter(
        (name) =>
          name.endsWith('.json') &&
          CorpusManifestIdSchema.safeParse(name.slice(0, -'.json'.length)).success
      )
      .map((name) => name.slice(0, -'.json'.length))
      .toSorted()
  }

  async listParseIds(): Promise<readonly string[]> {
    return (await readdir(join(this.#root, 'parse-bundles')))
      .filter(
        (name) =>
          name.endsWith('.json') &&
          CorpusParseIdSchema.safeParse(name.slice(0, -'.json'.length)).success
      )
      .map((name) => name.slice(0, -'.json'.length))
      .toSorted()
  }

  async #verifyPredecessor(manifest: CorpusSourceManifestV1): Promise<void> {
    if (manifest.version === 1) {
      return
    }
    const predecessorId = manifest.supersedesManifestId
    if (predecessorId === null) {
      throw corpusFailure('invalid_source_lineage', 'Corpus predecessor is missing')
    }
    const predecessor = await this.readSource(predecessorId)
    if (
      predecessor.manifest.sourceId !== manifest.sourceId ||
      predecessor.manifest.version + 1 !== manifest.version
    ) {
      throw corpusFailure(
        'invalid_source_lineage',
        'Corpus predecessor is not the prior source version'
      )
    }
  }

  async #validateBundle(bundle: CorpusParseBundle, parsedBytes: Uint8Array): Promise<void> {
    const source = await this.readSource(bundle.parse.sourceManifestId)
    if (
      source.manifest.tenantId !== bundle.parse.tenantId ||
      source.manifest.sourceId !== bundle.parse.sourceId ||
      source.manifest.version !== bundle.parse.sourceVersion ||
      source.manifest.content.sha256 !== bundle.parse.sourceDigest
    ) {
      throw corpusFailure('parse_source_mismatch', 'Parse version differs from its source manifest')
    }
    const chunkIds = new Set(bundle.chunks.map((chunk) => chunk.id))
    const parsedText = new TextDecoder('utf-8', { fatal: true }).decode(parsedBytes)
    for (const [index, chunk] of bundle.chunks.entries()) {
      if (
        chunk.tenantId !== bundle.parse.tenantId ||
        chunk.sourceManifestId !== bundle.parse.sourceManifestId ||
        chunk.parseVersionId !== bundle.parse.id ||
        chunk.ordinal !== index ||
        sha256Text(chunk.content) !== chunk.contentDigest ||
        !parsedText.includes(chunk.content)
      ) {
        throw corpusFailure(
          'invalid_chunk_provenance',
          `Chunk provenance differs at ordinal ${index}`
        )
      }
    }
    const entityIds = new Set(bundle.entities.map((entity) => entity.id))
    for (const entity of bundle.entities) {
      if (
        entity.tenantId !== bundle.parse.tenantId ||
        entity.provenanceChunkIds.some((chunkId) => !chunkIds.has(chunkId))
      ) {
        throw corpusFailure('invalid_entity_provenance', `Entity provenance differs: ${entity.id}`)
      }
    }
    for (const relation of bundle.relations) {
      if (
        relation.tenantId !== bundle.parse.tenantId ||
        !entityIds.has(relation.fromEntityId) ||
        !entityIds.has(relation.toEntityId) ||
        relation.provenanceChunkIds.some((chunkId) => !chunkIds.has(chunkId))
      ) {
        throw corpusFailure(
          'invalid_relation_provenance',
          `Relation provenance differs: ${relation.id}`
        )
      }
    }
  }

  #objectPath(kind: 'objects' | 'parse-objects', digest: string): string {
    return join(this.#root, kind, digest.slice(0, 2), digest)
  }

  #manifestPath(manifestId: string): string {
    return join(this.#root, 'manifests', `${manifestId}.json`)
  }

  #sourceVersionPath(sourceId: string, version: number): string {
    return join(this.#root, 'sources', sourceId, `${version}.txt`)
  }

  #parseBundlePath(parseId: string): string {
    return join(this.#root, 'parse-bundles', `${parseId}.json`)
  }
}
