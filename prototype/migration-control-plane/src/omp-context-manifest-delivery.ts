import { chmod, mkdir, realpath, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { canonicalJson, sha256Text } from './canonical-json.js'
import { ContextManifestV1Schema, type ContextManifestV1 } from './domain/assignment-contracts.js'

type ManifestItem = {
  itemId: string
  evidenceId: string
  evidenceVersion: number
  evidenceDigest: string
  span: ContextManifestV1['items'][number]['span']
  sourceRole: string
  dataClass: ContextManifestV1['items'][number]['dataClass']
  position: number
  trust: ContextManifestV1['items'][number]['trust']
  freshness: ContextManifestV1['items'][number]['freshness']
}

export type ContextManifestSource = {
  evidenceId: string
  evidenceVersion: number
  bytes: Uint8Array
}

export type ContextManifestDeliveryAuthority = {
  tenantId: string
  missionId: string
  assignmentId: string
  attemptId: string
  baseMissionRevision: number
  role: string
  budget: ContextManifestV1['budget']
  admittedEvidenceIds: readonly string[]
  excludedEvidenceIds: readonly string[]
}

export type DeliverContextManifestInput = {
  workspaceDirectory: string
  commandId: string
  manifest: unknown
  authority: ContextManifestDeliveryAuthority
  sources: readonly ContextManifestSource[]
}

export type RenderedContextItem = {
  metadata: ManifestItem
  content: string | null
  redactionReason: string | null
}

export type OmpContextPromptCommand = { id: string; type: 'prompt'; message: string }

export type DeliveredContextManifest = {
  manifest: ContextManifestV1
  manifestDigest: string
  renderedContext: readonly RenderedContextItem[]
  renderedContextDigest: string
  deliveryDigest: string
  deliveryPath: string
  promptCommand: OmpContextPromptCommand
}

export class ContextManifestDeliveryError extends Error {
  readonly code: string

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ContextManifestDeliveryError'
    this.code = code
  }
}

function failure(code: string, message: string, cause?: unknown): ContextManifestDeliveryError {
  return new ContextManifestDeliveryError(
    code,
    message,
    cause === undefined ? undefined : { cause }
  )
}

function exactSet(actual: readonly string[], expected: readonly string[]): boolean {
  const expectedSet = new Set(expected)
  return (
    actual.length === expected.length &&
    new Set(actual).size === actual.length &&
    expectedSet.size === expected.length &&
    actual.every((value) => expectedSet.has(value))
  )
}

function assertAuthority(
  manifest: ContextManifestV1,
  authority: ContextManifestDeliveryAuthority
): void {
  for (const [name, actual, expected] of [
    ['tenantId', manifest.tenantId, authority.tenantId],
    ['missionId', manifest.missionId, authority.missionId],
    ['assignmentId', manifest.assignmentId, authority.assignmentId],
    ['attemptId', manifest.attemptId, authority.attemptId],
    ['role', manifest.role, authority.role]
  ] as const) {
    if (actual !== expected) {
      throw failure('authority_mismatch', `${name} is not current`)
    }
  }
  if (manifest.baseMissionRevision !== authority.baseMissionRevision) {
    throw failure('authority_mismatch', 'baseMissionRevision is not current')
  }
  if (canonicalJson(manifest.budget) !== canonicalJson(authority.budget)) {
    throw failure('authority_mismatch', 'budget is not current')
  }
  const admitted = [...new Set(manifest.items.map((item) => item.evidenceId))]
  const excluded = manifest.excludedEvidence.map((entry) => entry.evidenceId)
  if (!exactSet(admitted, authority.admittedEvidenceIds)) {
    throw failure('evidence_scope_mismatch', 'Manifest items do not match admitted evidence')
  }
  if (!exactSet(excluded, authority.excludedEvidenceIds)) {
    throw failure('evidence_scope_mismatch', 'Manifest exclusions do not match authority')
  }
  const excludedSet = new Set(excluded)
  if (admitted.some((evidenceId) => excludedSet.has(evidenceId))) {
    throw failure('evidence_scope_mismatch', 'Evidence cannot be both admitted and excluded')
  }
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch (error) {
    throw failure('invalid_source_encoding', 'Context source is not valid UTF-8', error)
  }
}

function resolveJsonPointer(value: unknown, pointer: string): unknown {
  let current = value
  for (const encoded of pointer.split('/').slice(1)) {
    const token = encoded.replaceAll('~1', '/').replaceAll('~0', '~')
    if (Array.isArray(current)) {
      if (!/^(?:0|[1-9][0-9]*)$/.test(token) || Number(token) >= current.length) {
        throw failure('invalid_source_span', `JSON pointer does not resolve: ${pointer}`)
      }
      current = current[Number(token)]
      continue
    }
    if (current === null || typeof current !== 'object' || !(token in current)) {
      throw failure('invalid_source_span', `JSON pointer does not resolve: ${pointer}`)
    }
    current = (current as Record<string, unknown>)[token]
  }
  return current
}

function selectSpan(item: ManifestItem, bytes: Uint8Array): string {
  const source = decodeUtf8(bytes)
  if (item.span.kind === 'whole') {
    return source
  }
  if (item.span.kind === 'text-lines') {
    const lines = source.split('\n')
    if (item.span.endLine > lines.length) {
      throw failure('invalid_source_span', `Text span exceeds source: ${item.itemId}`)
    }
    return lines.slice(item.span.startLine - 1, item.span.endLine).join('\n')
  }
  try {
    return canonicalJson(resolveJsonPointer(JSON.parse(source) as unknown, item.span.pointer))
  } catch (error) {
    if (error instanceof ContextManifestDeliveryError) {
      throw error
    }
    throw failure('invalid_source_span', `JSON source is invalid: ${item.itemId}`, error)
  }
}

function renderContext(
  manifest: ContextManifestV1,
  sources: readonly ContextManifestSource[]
): readonly RenderedContextItem[] {
  const sourceByEvidence = new Map<string, ContextManifestSource>()
  for (const source of sources) {
    if (sourceByEvidence.has(source.evidenceId)) {
      throw failure('duplicate_source', `Duplicate source: ${source.evidenceId}`)
    }
    sourceByEvidence.set(source.evidenceId, source)
  }
  if (
    !exactSet(
      [...sourceByEvidence.keys()],
      [...new Set(manifest.items.map((item) => item.evidenceId))]
    )
  ) {
    throw failure('source_set_mismatch', 'Sources must exactly match manifest evidence')
  }
  const redactionByItem = new Map(
    manifest.redactions.map((redaction) => [redaction.itemId, redaction.reason])
  )
  return manifest.items.map((item) => {
    const source = sourceByEvidence.get(item.evidenceId)!
    if (source.evidenceVersion !== item.evidenceVersion) {
      throw failure('source_version_mismatch', `Source version differs: ${item.evidenceId}`)
    }
    if (sha256Text(source.bytes) !== item.evidenceDigest) {
      throw failure('source_digest_mismatch', `Source digest differs: ${item.evidenceId}`)
    }
    const redactionReason = redactionByItem.get(item.itemId) ?? null
    return {
      metadata: item,
      content: redactionReason === null ? selectSpan(item, source.bytes) : null,
      redactionReason
    }
  })
}

export async function deliverContextManifest(
  input: DeliverContextManifestInput
): Promise<DeliveredContextManifest> {
  let manifest: ContextManifestV1
  try {
    manifest = ContextManifestV1Schema.parse(input.manifest)
  } catch (error) {
    throw failure('invalid_manifest', 'Context manifest is invalid', error)
  }
  assertAuthority(manifest, input.authority)
  const renderedContext = renderContext(manifest, input.sources)
  const renderedContextDigest = sha256Text(canonicalJson(renderedContext))
  if (manifest.renderedContextDigest !== renderedContextDigest) {
    throw failure('rendered_digest_mismatch', 'Rendered context digest differs from manifest')
  }
  const manifestDigest = sha256Text(canonicalJson(manifest))
  const message = canonicalJson({ deliveryVersion: 1, manifest, renderedContext })
  const deliveryDigest = sha256Text(message)
  const workspace = await realpath(input.workspaceDirectory)
  const deliveryDirectory = join(workspace, 'context')
  const deliveryPath = join(deliveryDirectory, 'context-delivery.json')
  try {
    await mkdir(deliveryDirectory, { mode: 0o700 })
    await writeFile(deliveryPath, message, { encoding: 'utf8', flag: 'wx', mode: 0o400 })
    if (process.platform !== 'win32') {
      await chmod(deliveryPath, 0o400)
    }
  } catch (error) {
    throw failure('delivery_write_failed', 'Context delivery must use a new private path', error)
  }
  return {
    manifest,
    manifestDigest,
    renderedContext,
    renderedContextDigest,
    deliveryDigest,
    deliveryPath,
    promptCommand: { id: input.commandId, type: 'prompt', message }
  }
}
