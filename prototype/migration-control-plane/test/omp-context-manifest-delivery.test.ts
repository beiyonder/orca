import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { canonicalJson, sha256Text } from '../src/canonical-json.js'
import {
  ContextManifestDeliveryError,
  deliverContextManifest,
  type ContextManifestDeliveryAuthority,
  type ContextManifestSource,
  type RenderedContextItem
} from '../src/omp-context-manifest-delivery.js'
import { prepareIsolatedOmpEnvironment } from '../src/omp-isolated-environment.js'

const createdAt = '2026-01-01T00:00:00.000Z'
const budget = {
  tokenLimit: 4_000,
  timeLimitMs: 30_000,
  toolCallLimit: 4,
  outputByteLimit: 100_000,
  costLimitUsd: 2
}
const textSource = Buffer.from(
  'heading\npatient_num is declared global\nclaim needs a probe\nsecret note'
)
const jsonSource = Buffer.from('{"profile":{"columns":["patient_num","facility_id"]}}')
const sources: readonly ContextManifestSource[] = [
  { evidenceId: 'evidence_document', evidenceVersion: 3, bytes: textSource },
  { evidenceId: 'evidence_profile', evidenceVersion: 5, bytes: jsonSource }
]
const items = [
  {
    itemId: 'document_claim',
    evidenceId: 'evidence_document',
    evidenceVersion: 3,
    evidenceDigest: sha256Text(textSource),
    span: { kind: 'text-lines' as const, startLine: 2, endLine: 3 },
    sourceRole: 'customer-claim',
    dataClass: 'synthetic' as const,
    position: 0,
    trust: 'unverified' as const,
    freshness: 'current' as const
  },
  {
    itemId: 'profile_columns',
    evidenceId: 'evidence_profile',
    evidenceVersion: 5,
    evidenceDigest: sha256Text(jsonSource),
    span: { kind: 'json-pointer' as const, pointer: '/profile/columns' },
    sourceRole: 'direct-observation',
    dataClass: 'synthetic' as const,
    position: 1,
    trust: 'direct' as const,
    freshness: 'current' as const
  },
  {
    itemId: 'redacted_note',
    evidenceId: 'evidence_document',
    evidenceVersion: 3,
    evidenceDigest: sha256Text(textSource),
    span: { kind: 'text-lines' as const, startLine: 4, endLine: 4 },
    sourceRole: 'customer-claim',
    dataClass: 'confidential' as const,
    position: 2,
    trust: 'unverified' as const,
    freshness: 'current' as const
  }
]
const renderedContext: readonly RenderedContextItem[] = [
  {
    metadata: items[0]!,
    content: 'patient_num is declared global\nclaim needs a probe',
    redactionReason: null
  },
  {
    metadata: items[1]!,
    content: canonicalJson(['patient_num', 'facility_id']),
    redactionReason: null
  },
  { metadata: items[2]!, content: null, redactionReason: 'Not admitted for this role.' }
]

function manifest(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    kind: 'context-manifest',
    id: 'context_s1',
    tenantId: 'tenant_s1',
    missionId: 'mission_s1',
    createdAt,
    assignmentId: 'assignment_s1',
    attemptId: 'attempt_s1',
    baseMissionRevision: 7,
    role: 'mapping-specialist',
    strategyVersion: 'exact-lexical-v1',
    modelRoute: {
      provider: 'test',
      model: 'deterministic',
      revision: '1',
      effort: 'med',
      dataClasses: ['synthetic', 'confidential']
    },
    budget,
    items,
    excludedEvidence: [
      { evidenceId: 'evidence_learning_candidate', reason: 'Quarantined learning is ineligible.' }
    ],
    redactions: [{ itemId: 'redacted_note', reason: 'Not admitted for this role.' }],
    systemPromptDigest: '1'.repeat(64),
    toolSetDigest: '2'.repeat(64),
    outputSchemaDigest: '3'.repeat(64),
    renderedContextDigest: sha256Text(canonicalJson(renderedContext)),
    compiledBy: { kind: 'system', id: 'context-compiler', version: '1' }
  }
}

function authority(
  overrides: Partial<ContextManifestDeliveryAuthority> = {}
): ContextManifestDeliveryAuthority {
  return {
    tenantId: 'tenant_s1',
    missionId: 'mission_s1',
    assignmentId: 'assignment_s1',
    attemptId: 'attempt_s1',
    baseMissionRevision: 7,
    role: 'mapping-specialist',
    budget,
    admittedEvidenceIds: ['evidence_document', 'evidence_profile'],
    excludedEvidenceIds: ['evidence_learning_candidate'],
    ...overrides
  }
}

const roots: string[] = []

async function isolated(incarnation: string) {
  const root = await mkdtemp(join(tmpdir(), 'orca-context-delivery-'))
  roots.push(root)
  return prepareIsolatedOmpEnvironment({
    baseDirectory: root,
    incarnationId: incarnation,
    parentEnv: { PATH: process.env.PATH }
  })
}

async function expectDeliveryError(operation: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await operation()
    throw new Error('Expected context manifest delivery error')
  } catch (error) {
    if (!(error instanceof ContextManifestDeliveryError)) {
      throw error
    }
    expect(error.code).toBe(code)
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('OMP context manifest delivery', () => {
  it('reconstructs byte-identical manifest-bound prompts in fresh isolated workspaces', async () => {
    const firstEnvironment = await isolated('context-first')
    const secondEnvironment = await isolated('context-second')
    const first = await deliverContextManifest({
      workspaceDirectory: firstEnvironment.directories.workspace,
      commandId: 'prompt-context-1',
      manifest: manifest(),
      authority: authority(),
      sources
    })
    const second = await deliverContextManifest({
      workspaceDirectory: secondEnvironment.directories.workspace,
      commandId: 'prompt-context-2',
      manifest: manifest(),
      authority: authority(),
      sources
    })

    expect(first.deliveryDigest).toBe(second.deliveryDigest)
    expect(first.promptCommand.message).toBe(second.promptCommand.message)
    expect(first.promptCommand).toMatchObject({ type: 'prompt', id: 'prompt-context-1' })
    expect(first.renderedContext).toEqual(renderedContext)
    expect(await readFile(first.deliveryPath, 'utf8')).toBe(first.promptCommand.message)
    expect(first.manifestDigest).toBe(sha256Text(canonicalJson(first.manifest)))
    expect(first.renderedContextDigest).toBe(first.manifest.renderedContextDigest)
  })

  it('materializes one read-only delivery and never reveals a redacted source span', async () => {
    const environment = await isolated('context-private')
    const delivery = await deliverContextManifest({
      workspaceDirectory: environment.directories.workspace,
      commandId: 'prompt-context-private',
      manifest: manifest(),
      authority: authority(),
      sources
    })
    const bytes = await readFile(delivery.deliveryPath, 'utf8')
    expect(bytes).not.toContain('secret note')
    expect(bytes).toContain('Not admitted for this role.')
    if (process.platform !== 'win32') {
      expect((await stat(delivery.deliveryPath)).mode & 0o777).toBe(0o400)
    }
    await expectDeliveryError(
      () =>
        deliverContextManifest({
          workspaceDirectory: environment.directories.workspace,
          commandId: 'prompt-context-duplicate',
          manifest: manifest(),
          authority: authority(),
          sources
        }),
      'delivery_write_failed'
    )
  })

  it('rejects stale identity, budget, admitted scope, and exclusion authority', async () => {
    const environment = await isolated('context-authority')
    for (const changedAuthority of [
      authority({ attemptId: 'attempt_stale' }),
      authority({ budget: { ...budget, tokenLimit: 4_001 } }),
      authority({ admittedEvidenceIds: ['evidence_document'] }),
      authority({ excludedEvidenceIds: [] })
    ]) {
      await expectDeliveryError(
        () =>
          deliverContextManifest({
            workspaceDirectory: environment.directories.workspace,
            commandId: 'prompt-context-denied',
            manifest: manifest(),
            authority: changedAuthority,
            sources
          }),
        changedAuthority.attemptId === 'attempt_stale' ||
          changedAuthority.budget.tokenLimit === 4_001
          ? 'authority_mismatch'
          : 'evidence_scope_mismatch'
      )
    }
  })

  it('rejects source set, version, digest, span, and rendered digest drift', async () => {
    const environment = await isolated('context-integrity')
    const cases: {
      manifest: Record<string, unknown>
      sources: readonly ContextManifestSource[]
      code: string
    }[] = [
      { manifest: manifest(), sources: sources.slice(0, 1), code: 'source_set_mismatch' },
      {
        manifest: manifest(),
        sources: [{ ...sources[0]!, evidenceVersion: 4 }, sources[1]!],
        code: 'source_version_mismatch'
      },
      {
        manifest: manifest(),
        sources: [{ ...sources[0]!, bytes: Buffer.from('tampered') }, sources[1]!],
        code: 'source_digest_mismatch'
      },
      {
        manifest: { ...manifest(), renderedContextDigest: 'f'.repeat(64) },
        sources,
        code: 'rendered_digest_mismatch'
      }
    ]
    for (const testCase of cases) {
      await expectDeliveryError(
        () =>
          deliverContextManifest({
            workspaceDirectory: environment.directories.workspace,
            commandId: 'prompt-context-invalid',
            manifest: testCase.manifest,
            authority: authority(),
            sources: testCase.sources
          }),
        testCase.code
      )
    }
  })
})
