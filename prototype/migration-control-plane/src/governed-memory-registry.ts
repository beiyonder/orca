import { canonicalJson } from './canonical-json.js'
import type { DomainScope } from './domain/common-contracts.js'
import {
  MemoryCandidateV1Schema,
  MemoryInvalidationV1Schema,
  MemoryUseV1Schema,
  MemoryVersionV1Schema,
  type MemoryCandidateV1,
  type MemoryInvalidationV1,
  type MemoryUseV1,
  type MemoryVersionV1
} from './domain/memory-contracts.js'
import {
  isMemoryVersionValidAt,
  memoryCandidateVersionFailure,
  memoryInvalidationFailure
} from './governed-memory-rules.js'

export type MemoryRecallRequest = {
  tenantId: string
  role: string
  taskClass: string
  dataClass: MemoryVersionV1['usePolicy']['dataClasses'][number]
  scope: DomainScope
  product: string | null
  productVersion: string | null
  asOf: string
}

export class GovernedMemoryRegistryError extends Error {
  readonly code: string
  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'GovernedMemoryRegistryError'
    this.code = code
  }
}

function failure(code: string, message: string, cause?: unknown): GovernedMemoryRegistryError {
  return new GovernedMemoryRegistryError(code, message, cause === undefined ? undefined : { cause })
}

function putImmutable<T extends object>(map: Map<string, T>, id: string, value: T): T {
  const existing = map.get(id)
  if (existing) {
    if (canonicalJson(existing) !== canonicalJson(value)) {
      throw failure('immutable_conflict', `Memory record differs for reused ID: ${id}`)
    }
    return existing
  }
  map.set(id, value)
  return value
}

export class GovernedMemoryRegistry {
  readonly #candidates = new Map<string, MemoryCandidateV1>()
  readonly #versions = new Map<string, MemoryVersionV1>()
  readonly #uses = new Map<string, MemoryUseV1>()
  readonly #invalidations = new Map<string, MemoryInvalidationV1>()

  static reconstruct(input: {
    candidates: readonly unknown[]
    versions: readonly unknown[]
    uses: readonly unknown[]
    invalidations: readonly unknown[]
  }): GovernedMemoryRegistry {
    const registry = new GovernedMemoryRegistry()
    const candidates = input.candidates
      .map((candidate) => MemoryCandidateV1Schema.parse(candidate))
      .toSorted((left, right) => left.id.localeCompare(right.id))
    for (const candidate of candidates) {
      registry.admitCandidate(candidate)
    }
    const versions = input.versions
      .map((version) => MemoryVersionV1Schema.parse(version))
      .toSorted(
        (left, right) =>
          left.tenantId.localeCompare(right.tenantId) ||
          left.memoryId.localeCompare(right.memoryId) ||
          left.version - right.version
      )
    for (const version of versions) {
      registry.registerVersion(version)
    }
    const uses = input.uses
      .map((use) => MemoryUseV1Schema.parse(use))
      .toSorted((left, right) => left.id.localeCompare(right.id))
    for (const use of uses) {
      const version = registry.#versions.get(use.memoryVersionId)
      if (!version || version.tenantId !== use.tenantId) {
        throw failure('memory_not_found', 'Historical memory use references a missing version')
      }
      putImmutable(registry.#uses, use.id, use)
    }
    const invalidations = input.invalidations
      .map((invalidation) => MemoryInvalidationV1Schema.parse(invalidation))
      .toSorted((left, right) => left.id.localeCompare(right.id))
    for (const invalidation of invalidations) {
      const target = registry.#versions.get(invalidation.memoryVersionId)
      const replacement = registry.#versions.get(invalidation.replacementVersionId)
      if (!target || !replacement) {
        throw failure('memory_not_found', 'Historical invalidation references a missing version')
      }
      registry.#assertInvalidation(invalidation, target, replacement)
      putImmutable(registry.#invalidations, invalidation.id, invalidation)
    }
    return registry
  }

  admitCandidate(input: unknown): MemoryCandidateV1 {
    let candidate: MemoryCandidateV1
    try {
      candidate = MemoryCandidateV1Schema.parse(input)
    } catch (error) {
      throw failure('invalid_memory_candidate', 'Memory candidate is invalid', error)
    }
    return putImmutable(this.#candidates, candidate.id, candidate)
  }

  registerVersion(input: unknown): MemoryVersionV1 {
    let version: MemoryVersionV1
    try {
      version = MemoryVersionV1Schema.parse(input)
    } catch (error) {
      throw failure('invalid_memory_version', 'Memory version is invalid', error)
    }
    const candidate = this.#candidates.get(version.candidateId)
    if (!candidate || candidate.tenantId !== version.tenantId) {
      throw failure('candidate_not_found', 'Memory version candidate is unavailable')
    }
    const candidateFailure = memoryCandidateVersionFailure(candidate, version)
    if (candidateFailure) {
      throw failure(candidateFailure.code, candidateFailure.message)
    }
    const prior = this.#latestVersion(version.tenantId, version.memoryId)
    if (version.version === 1) {
      if (prior) {
        throw failure('version_conflict', 'First memory version already exists')
      }
    } else if (
      !prior ||
      version.version !== prior.version + 1 ||
      version.supersedesVersionId !== prior.id
    ) {
      throw failure('version_lineage_mismatch', 'Memory version does not follow current lineage')
    }
    if (prior && Date.parse(version.createdAt) < Date.parse(prior.createdAt)) {
      throw failure('version_timeline_mismatch', 'Memory version predates its predecessor')
    }
    return putImmutable(this.#versions, version.id, version)
  }

  recall(request: MemoryRecallRequest): readonly MemoryVersionV1[] {
    const asOf = Date.parse(request.asOf)
    if (!Number.isFinite(asOf)) {
      return []
    }
    const latest = new Map<string, MemoryVersionV1>()
    for (const version of this.#versions.values()) {
      if (version.tenantId !== request.tenantId) {
        continue
      }
      const current = latest.get(version.memoryId)
      if (!current || version.version > current.version) {
        latest.set(version.memoryId, version)
      }
    }
    return [...latest.values()]
      .filter((version) => {
        if (!version.usePolicy.allowRecall) {
          return false
        }
        if (!version.usePolicy.roles.includes(request.role)) {
          return false
        }
        if (!version.usePolicy.taskClasses.includes(request.taskClass)) {
          return false
        }
        if (!version.usePolicy.dataClasses.includes(request.dataClass)) {
          return false
        }
        if (canonicalJson(version.scope) !== canonicalJson(request.scope)) {
          return false
        }
        if (version.applicability.environment !== request.scope.environment) {
          return false
        }
        if (
          version.applicability.product !== null &&
          version.applicability.product !== request.product
        ) {
          return false
        }
        if (
          version.applicability.versionConstraint !== null &&
          version.applicability.versionConstraint !== request.productVersion
        ) {
          return false
        }
        return this.#validAt(version, asOf)
      })
      .toSorted((left, right) => left.id.localeCompare(right.id))
  }

  recordUse(input: unknown): MemoryUseV1 {
    let use: MemoryUseV1
    try {
      use = MemoryUseV1Schema.parse(input)
    } catch (error) {
      throw failure('invalid_memory_use', 'Memory use is invalid', error)
    }
    const version = this.#versions.get(use.memoryVersionId)
    if (!version || version.tenantId !== use.tenantId || !version.usePolicy.allowRecall) {
      throw failure('memory_not_recallable', 'Memory version cannot be used')
    }
    if (this.#latestVersion(version.tenantId, version.memoryId)?.id !== version.id) {
      throw failure('memory_not_current', 'Memory use references a superseded version')
    }
    if (!this.#validAt(version, Date.parse(use.createdAt))) {
      throw failure('memory_not_recallable', 'Memory version was not valid when used')
    }
    return putImmutable(this.#uses, use.id, use)
  }

  applyInvalidation(input: unknown, replacementInput: unknown): MemoryVersionV1 {
    let invalidation: MemoryInvalidationV1
    try {
      invalidation = MemoryInvalidationV1Schema.parse(input)
    } catch (error) {
      throw failure('invalid_memory_invalidation', 'Memory invalidation is invalid', error)
    }
    const target = this.#versions.get(invalidation.memoryVersionId)
    if (!target || target.tenantId !== invalidation.tenantId) {
      throw failure('memory_not_found', 'Invalidated memory version is unavailable')
    }
    if (this.#latestVersion(target.tenantId, target.memoryId)?.id !== target.id) {
      throw failure('memory_not_current', 'Only the current memory version can be invalidated')
    }
    const replacement = MemoryVersionV1Schema.parse(replacementInput)
    this.#assertInvalidation(invalidation, target, replacement)
    const existing = this.#invalidations.get(invalidation.id)
    if (existing && canonicalJson(existing) !== canonicalJson(invalidation)) {
      throw failure('immutable_conflict', `Memory record differs for reused ID: ${invalidation.id}`)
    }
    const registered = this.registerVersion(replacement)
    putImmutable(this.#invalidations, invalidation.id, invalidation)
    return registered
  }

  usesForVersion(memoryVersionId: string): readonly MemoryUseV1[] {
    return [...this.#uses.values()]
      .filter((use) => use.memoryVersionId === memoryVersionId)
      .toSorted((left, right) => left.id.localeCompare(right.id))
  }

  #assertInvalidation(
    invalidation: MemoryInvalidationV1,
    target: MemoryVersionV1,
    replacement: MemoryVersionV1
  ): void {
    const uses = [...this.#uses.values()].filter((use) => use.memoryVersionId === target.id)
    const invalidationFailure = memoryInvalidationFailure(invalidation, target, replacement, uses)
    if (invalidationFailure) {
      throw failure(invalidationFailure.code, invalidationFailure.message)
    }
  }

  #validAt(version: MemoryVersionV1, instant: number): boolean {
    return isMemoryVersionValidAt(version, this.#candidates.get(version.candidateId), instant)
  }
  #latestVersion(tenantId: string, memoryId: string): MemoryVersionV1 | null {
    return (
      [...this.#versions.values()]
        .filter((version) => version.tenantId === tenantId && version.memoryId === memoryId)
        .toSorted((left, right) => right.version - left.version)[0] ?? null
    )
  }
}
