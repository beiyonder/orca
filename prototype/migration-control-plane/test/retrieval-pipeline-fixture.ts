import { sha256Text } from '../src/canonical-json.js'
import { CorpusCatalog } from '../src/corpus-catalog.js'
import { ImmutableCorpusStore } from '../src/immutable-corpus-store.js'
import {
  corpusManifest as identityManifest,
  corpusParseBundle as identityParseBundle,
  corpusSourceBytes
} from './corpus-foundation-fixture.js'

const createdAt = '2026-01-01T00:00:00.000Z'
const defaultScope = { environment: 'synthetic', system: 'legacy-ehr', entity: 'legacy_patient' }

export const retrievalSemanticConfig = {
  version: 'governed-concepts-v1',
  conceptGroups: {
    duplication: ['duplicate', 'duplicates', 'repeated', 'non unique'],
    identity: ['identifier', 'identity', 'key'],
    facility: ['facility', 'site'],
    deletion: ['delete', 'deletion', 'tombstone', 'remove']
  }
}

async function addDocument(
  store: ImmutableCorpusStore,
  input: {
    key: string
    content: string
    tenantId?: string
    dataClass?: 'synthetic' | 'public' | 'internal' | 'confidential'
    sourceClass?: 'reference' | 'environment-evidence' | 'customer-artifact'
    renderAllowed?: boolean
    freshness?:
      | { kind: 'immutable'; staleDisposition: 'never-stale' }
      | { kind: 'expires-at'; expiresAt: string; staleDisposition: 'exclude' }
    sourceId?: string
    version?: number
    supersedesManifestId?: string | null
    scope?: typeof defaultScope
  }
): Promise<void> {
  const tenantId = input.tenantId ?? 'tenant_s1'
  const dataClass = input.dataClass ?? 'synthetic'
  const sourceId = input.sourceId ?? `corpus_source_${input.key}`
  const version = input.version ?? 1
  const manifestId = `corpus_manifest_${input.key}`
  const parseId = `corpus_parse_${input.key}`
  const chunkId = `corpus_chunk_${input.key}`
  const bytes = Buffer.from(`${input.content}\n`)
  const digest = sha256Text(bytes)
  await store.ingestSource(
    {
      schemaVersion: 1,
      kind: 'corpus-source-manifest',
      id: manifestId,
      tenantId,
      createdAt,
      sourceId,
      version,
      sourceVersion: `fixture-v${version}`,
      sourceClass: input.sourceClass ?? 'reference',
      visibility: 'tenant',
      owner: { kind: 'system', id: 'retrieval-fixture', name: 'Retrieval Fixture' },
      permission: {
        basis: 'internal',
        licenseId: 'MIT',
        termsUri: null,
        ingestAllowed: true,
        renderAllowed: input.renderAllowed ?? true,
        derivativeAllowed: true
      },
      canonicalUri: `fixture://retrieval/${input.key}`,
      title: input.key,
      publisher: 'Orca Lab',
      content: {
        uri: `corpus-object://sha256/${digest}`,
        sha256: digest,
        mediaType: 'text/plain',
        bytes: bytes.byteLength,
        span: { kind: 'whole' }
      },
      dataClass,
      applicability: {
        scope: input.scope ?? defaultScope,
        product: 'legacy-ehr',
        versionConstraint: `fixture-v${version}`,
        effectiveFrom: createdAt,
        effectiveUntil: null
      },
      observedAt: createdAt,
      sourcePublishedAt: null,
      freshness: input.freshness ?? { kind: 'immutable', staleDisposition: 'never-stale' },
      retention: { retainUntil: null, deletionMode: 'retain', policyId: 'retrieval-fixture' },
      supersedesManifestId: input.supersedesManifestId ?? null,
      limitations: ['Synthetic retrieval fixture.'],
      registeredBy: { kind: 'system', id: 'retrieval-fixture', version: '1' }
    },
    bytes
  )
  await store.storeParse({
    parse: {
      schemaVersion: 1,
      kind: 'corpus-parse-version',
      id: parseId,
      tenantId,
      createdAt,
      sourceManifestId: manifestId,
      sourceId,
      sourceVersion: version,
      sourceDigest: digest,
      parser: { name: 'fixture-line', version: '1', implementationDigest: 'c'.repeat(64) },
      output: {
        uri: `corpus-parse://sha256/${digest}`,
        sha256: digest,
        mediaType: 'text/plain',
        bytes: bytes.byteLength,
        span: { kind: 'whole' }
      },
      warnings: [],
      parsedBy: { kind: 'system', id: 'retrieval-fixture', version: '1' }
    },
    chunks: [
      {
        schemaVersion: 1,
        kind: 'corpus-chunk',
        id: chunkId,
        tenantId,
        createdAt,
        sourceManifestId: manifestId,
        parseVersionId: parseId,
        ordinal: 0,
        chunkType: 'document',
        content: input.content,
        contentDigest: sha256Text(input.content),
        sourceSpan: { kind: 'text-lines', startLine: 1, endLine: 1 },
        mediaType: 'text/plain',
        tokenEstimate: Math.max(1, input.content.split(/\s+/).length),
        sourceRole: 'external-reference',
        dataClass,
        applicability: {
          scope: input.scope ?? defaultScope,
          product: 'legacy-ehr',
          versionConstraint: `fixture-v${version}`,
          effectiveFrom: createdAt,
          effectiveUntil: null
        },
        entityKeys: []
      }
    ],
    entities: [],
    relations: [],
    parsedBytes: bytes
  })
}

export async function createRetrievalFixture(root: string): Promise<{
  store: ImmutableCorpusStore
  catalog: CorpusCatalog
}> {
  const store = await ImmutableCorpusStore.open(root)
  await store.ingestSource(identityManifest(), corpusSourceBytes)
  await store.storeParse(identityParseBundle())
  await addDocument(store, {
    key: 'semantic_identity',
    content: 'Repeated patient records across sites require a compound identifier.'
  })
  await addDocument(store, {
    key: 'semantic_identity_copy',
    content: 'Repeated patient records across sites require a compound identifier.'
  })
  await addDocument(store, {
    key: 'stale_identity',
    content: 'patient_num is globally unique.',
    freshness: {
      kind: 'expires-at',
      expiresAt: '2026-01-05T00:00:00.000Z',
      staleDisposition: 'exclude'
    }
  })
  await addDocument(store, {
    key: 'other_tenant',
    content: 'Other tenant secret patient mapping.',
    tenantId: 'tenant_other'
  })
  await addDocument(store, {
    key: 'render_forbidden',
    content: 'Forbidden patient identifier guidance.',
    renderAllowed: false
  })
  await addDocument(store, {
    key: 'confidential_token',
    content: 'Credential TOKEN-123 must never appear unredacted.',
    dataClass: 'confidential'
  })
  await addDocument(store, {
    key: 'distractor',
    content: 'Billing color preferences and cafeteria opening hours.'
  })
  await addDocument(store, {
    key: 'delete_v1',
    content: 'Old delete semantics use tombstones.',
    sourceId: 'corpus_source_delete_semantics'
  })
  await addDocument(store, {
    key: 'delete_v2',
    content: 'Current deletion semantics emit explicit delete events.',
    sourceId: 'corpus_source_delete_semantics',
    version: 2,
    supersedesManifestId: 'corpus_manifest_delete_v1'
  })
  return { store, catalog: await CorpusCatalog.load(store) }
}

export function retrievalQuery(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    kind: 'retrieval-query',
    id: 'retrieval_query_fixture',
    tenantId: 'tenant_s1',
    createdAt: '2026-01-15T00:00:00.000Z',
    purpose: 'specialist-assignment',
    role: 'mapping',
    question: 'Which patient identity columns form a unique source key?',
    lexicalTerms: ['legacy_patient.patient_num', 'facility_id', 'unique'],
    semanticQuery: null,
    scopes: [defaultScope],
    allowedSourceClasses: ['reference', 'environment-evidence', 'customer-artifact'],
    allowedDataClasses: ['synthetic', 'public'],
    requiredCoverage: [
      { key: 'identity-key', evidenceTerms: ['facility_id', 'compound identifier'] }
    ],
    allowedSourceIds: [],
    currentOnly: true,
    asOf: '2026-01-15T00:00:00.000Z',
    maximumAgeDays: 60,
    channels: { structured: true, lexical: true, semantic: false, graph: false },
    graphSeedEntityIds: [],
    maxGraphDepth: 0,
    maxCandidates: 10,
    tokenBudget: 1_000,
    requestedBy: { kind: 'system', id: 'retrieval-test', version: '1' },
    ...overrides
  }
}
