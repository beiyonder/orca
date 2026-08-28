import { mkdtemp, rm, stat, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CorpusCatalog } from '../src/corpus-catalog.js'
import { ImmutableCorpusStore, ImmutableCorpusStoreError } from '../src/immutable-corpus-store.js'
import { CorpusSourceManifestV1Schema } from '../src/domain/knowledge-contracts.js'
import {
  corpusManifest,
  corpusParseBundle,
  corpusSourceBytes
} from './corpus-foundation-fixture.js'

const roots: string[] = []

async function root(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'orca-corpus-foundation-'))
  roots.push(path)
  return path
}

async function expectStoreError(operation: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await operation()
    throw new Error('Expected immutable corpus store error')
  } catch (error) {
    if (!(error instanceof ImmutableCorpusStoreError)) {
      throw error
    }
    expect(error.code).toBe(code)
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (path) => rm(path, { recursive: true, force: true })))
})

describe('corpus manifest, ingestion, and provenance catalog', () => {
  it('records owner, permission, version, checksum, class, scope, freshness, and retention', () => {
    expect(CorpusSourceManifestV1Schema.parse(corpusManifest())).toMatchObject({
      sourceId: 'corpus_source_identity_profile',
      version: 1,
      sourceVersion: 'fixture-v1',
      owner: { id: 'fixture' },
      permission: { licenseId: 'MIT', ingestAllowed: true, renderAllowed: true },
      dataClass: 'synthetic',
      applicability: { scope: { environment: 'synthetic', system: 'legacy-ehr' } },
      freshness: { kind: 'refresh-after', maxAgeDays: 30, staleDisposition: 'exclude' },
      retention: { deletionMode: 'retain' }
    })
  })

  it('preserves exact original bytes and idempotently reopens their content address', async () => {
    const directory = await root()
    const store = await ImmutableCorpusStore.open(directory)
    const first = await store.ingestSource(corpusManifest(), corpusSourceBytes)
    const replay = await store.ingestSource(corpusManifest(), corpusSourceBytes)
    expect(replay).toEqual(first)
    if (process.platform !== 'win32') {
      expect((await stat(first.objectPath)).mode & 0o777).toBe(0o400)
      expect((await stat(first.manifestPath)).mode & 0o777).toBe(0o400)
    }

    const reopened = await ImmutableCorpusStore.open(directory)
    const restored = await reopened.readSource('corpus_manifest_identity_profile')
    expect(restored.manifest).toEqual(first.manifest)
    expect(restored.bytes).toEqual(corpusSourceBytes)
    expect(await reopened.listSourceManifestIds()).toEqual(['corpus_manifest_identity_profile'])
  })

  it('rejects permission, address, digest, byte-count, and immutable-ID drift', async () => {
    const directory = await root()
    const store = await ImmutableCorpusStore.open(directory)
    await expectStoreError(
      () =>
        store.ingestSource(
          corpusManifest({
            permission: {
              basis: 'internal',
              licenseId: 'MIT',
              termsUri: null,
              ingestAllowed: false,
              renderAllowed: false,
              derivativeAllowed: false
            }
          }),
          corpusSourceBytes
        ),
      'invalid_source_manifest'
    )
    const source = corpusManifest()
    const content = source.content as Record<string, unknown>
    await expectStoreError(
      () =>
        store.ingestSource(
          { ...source, content: { ...content, uri: 'corpus-object://sha256/bad' } },
          corpusSourceBytes
        ),
      'invalid_source_manifest'
    )
    await expectStoreError(
      () => store.ingestSource(corpusManifest(), Buffer.from('tampered')),
      'digest_mismatch'
    )
    await store.ingestSource(corpusManifest(), corpusSourceBytes)
    await expectStoreError(
      () =>
        store.ingestSource(
          corpusManifest({ title: 'Different immutable title' }),
          corpusSourceBytes
        ),
      'immutable_conflict'
    )
    await expectStoreError(() => store.readSource('../outside'), 'invalid_identifier')
    await expectStoreError(() => store.readParse('../outside'), 'invalid_identifier')
  })

  it('rejects a pre-existing symlink in the corpus storage layout', async () => {
    if (process.platform === 'win32') {
      return
    }
    const directory = await root()
    const outside = await root()
    await symlink(outside, join(directory, 'objects'), 'dir')
    await expectStoreError(() => ImmutableCorpusStore.open(directory), 'unsafe_storage_path')
  })

  it('requires each later source version to point to the immediate predecessor', async () => {
    const store = await ImmutableCorpusStore.open(await root())
    await store.ingestSource(corpusManifest(), corpusSourceBytes)
    const second = corpusManifest({
      id: 'corpus_manifest_identity_profile_v2',
      version: 2,
      sourceVersion: 'fixture-v2',
      supersedesManifestId: 'corpus_manifest_identity_profile'
    })
    expect((await store.ingestSource(second, corpusSourceBytes)).manifest.version).toBe(2)
    await expectStoreError(
      () =>
        store.ingestSource(
          corpusManifest({
            id: 'corpus_manifest_identity_profile_v3',
            version: 3,
            sourceVersion: 'fixture-v3',
            supersedesManifestId: 'corpus_manifest_identity_profile'
          }),
          corpusSourceBytes
        ),
      'invalid_source_lineage'
    )
  })

  it('persists parsed chunks, entities, edges, applicability, and complete provenance', async () => {
    const directory = await root()
    const store = await ImmutableCorpusStore.open(directory)
    await store.ingestSource(corpusManifest(), corpusSourceBytes)
    await store.storeParse(corpusParseBundle())

    const reopened = await ImmutableCorpusStore.open(directory)
    expect(await reopened.listParseIds()).toEqual(['corpus_parse_identity_profile'])
    const catalog = await CorpusCatalog.load(reopened)
    const chunks = catalog.queryChunks({
      tenantId: 'tenant_s1',
      chunkTypes: ['data-profile'],
      system: 'legacy-ehr',
      entity: 'legacy_patient',
      product: 'legacy-ehr',
      currentOnly: true
    })
    expect(chunks).toHaveLength(2)
    expect(chunks.every((record) => record.source.id === 'corpus_manifest_identity_profile')).toBe(
      true
    )
    const entities = catalog.queryEntities({
      tenantId: 'tenant_s1',
      canonicalKey: 'legacy_patient.patient_num'
    })
    expect(entities).toMatchObject([
      {
        entity: { id: 'corpus_entity_patient_num' },
        provenance: [{ chunk: { id: 'corpus_chunk_patient_num' } }]
      }
    ])
    expect(
      catalog.relationsFor({
        tenantId: 'tenant_s1',
        entityId: 'corpus_entity_patient_num'
      })
    ).toMatchObject([
      {
        relation: { id: 'corpus_relation_composite_key', relationType: 'composes-key-with' },
        provenance: [{ chunk: { id: 'corpus_chunk_composite_key' } }]
      }
    ])
  })

  it('rejects chunk order, content digest, entity provenance, and missing relation endpoints', async () => {
    const store = await ImmutableCorpusStore.open(await root())
    await store.ingestSource(corpusManifest(), corpusSourceBytes)
    const base = corpusParseBundle()
    const firstChunk = base.chunks[0]!
    const firstEntity = base.entities[0]!
    const firstRelation = base.relations[0]!
    const cases = [
      { ...base, chunks: [{ ...firstChunk, ordinal: 1 }, ...base.chunks.slice(1)] },
      {
        ...base,
        chunks: [{ ...firstChunk, contentDigest: 'f'.repeat(64) }, ...base.chunks.slice(1)]
      },
      {
        ...base,
        entities: [
          { ...firstEntity, provenanceChunkIds: ['corpus_chunk_missing'] },
          ...base.entities.slice(1)
        ]
      },
      {
        ...base,
        relations: [{ ...firstRelation, toEntityId: 'corpus_entity_missing' }]
      }
    ]
    for (const testCase of cases) {
      await expectStoreError(
        () => store.storeParse(testCase),
        testCase === cases[2]
          ? 'invalid_entity_provenance'
          : testCase === cases[3]
            ? 'invalid_relation_provenance'
            : 'invalid_chunk_provenance'
      )
    }
  })
})
