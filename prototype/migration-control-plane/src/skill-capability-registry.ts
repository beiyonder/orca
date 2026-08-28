import { canonicalJson } from './canonical-json.js'
import {
  SkillLifecycleEventV1Schema,
  SkillVersionV1Schema,
  type SkillLifecycleEventV1,
  type SkillVersionV1
} from './domain/skill-contracts.js'
import type { ModelRouteSchema } from './domain/common-contracts.js'
import type { z } from 'zod'

type ModelRoute = z.infer<typeof ModelRouteSchema>

const TRANSITIONS: Record<string, readonly string[]> = {
  quarantined: ['certified', 'revoked'],
  certified: ['active', 'revoked'],
  active: ['deprecated', 'revoked'],
  deprecated: ['revoked'],
  revoked: []
}

export class SkillCapabilityRegistryError extends Error {
  readonly code: string
  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SkillCapabilityRegistryError'
    this.code = code
  }
}

function failure(code: string, message: string, cause?: unknown): SkillCapabilityRegistryError {
  return new SkillCapabilityRegistryError(
    code,
    message,
    cause === undefined ? undefined : { cause }
  )
}

function putImmutable<T extends object>(map: Map<string, T>, id: string, value: T): T {
  const existing = map.get(id)
  if (existing) {
    if (canonicalJson(existing) !== canonicalJson(value)) {
      throw failure('immutable_conflict', `Skill record differs for reused ID: ${id}`)
    }
    return existing
  }
  map.set(id, value)
  return value
}

export class SkillCapabilityRegistry {
  readonly #versions = new Map<string, SkillVersionV1>()
  readonly #events = new Map<string, SkillLifecycleEventV1>()

  static reconstruct(input: {
    versions: readonly unknown[]
    events: readonly unknown[]
  }): SkillCapabilityRegistry {
    const registry = new SkillCapabilityRegistry()
    const pending = input.versions
      .map((version) => SkillVersionV1Schema.parse(version))
      .toSorted(
        (left, right) =>
          left.tenantId.localeCompare(right.tenantId) ||
          left.version - right.version ||
          left.id.localeCompare(right.id)
      )
    while (pending.length > 0) {
      const readyIndex = pending.findIndex(
        (version) =>
          (version.predecessorVersionId === null ||
            registry.#versions.has(version.predecessorVersionId)) &&
          version.dependencyVersionIds.every((id) => registry.#versions.has(id))
      )
      if (readyIndex < 0) {
        throw failure(
          'unresolved_skill_graph',
          'Skill reconstruction has a missing or cyclic predecessor or dependency'
        )
      }
      const [version] = pending.splice(readyIndex, 1)
      registry.registerVersion(version)
    }
    const events = input.events
      .map((event) => SkillLifecycleEventV1Schema.parse(event))
      .toSorted(
        (left, right) =>
          left.tenantId.localeCompare(right.tenantId) ||
          left.skillVersionId.localeCompare(right.skillVersionId) ||
          left.sequence - right.sequence
      )
    for (const event of events) {
      registry.recordTransition(event)
    }
    return registry
  }

  registerVersion(input: unknown): SkillVersionV1 {
    let version: SkillVersionV1
    try {
      version = SkillVersionV1Schema.parse(input)
    } catch (error) {
      throw failure('invalid_skill_version', 'Skill version is invalid', error)
    }
    const prior = this.#latestVersion(version.tenantId, version.skillId)
    if (version.version === 1) {
      if (prior) throw failure('version_conflict', 'First skill version already exists')
    } else if (
      !prior ||
      version.version !== prior.version + 1 ||
      version.predecessorVersionId !== prior.id
    ) {
      throw failure('version_lineage_mismatch', 'Skill version does not follow current lineage')
    }
    if (prior && Date.parse(version.createdAt) < Date.parse(prior.createdAt)) {
      throw failure('version_timeline_mismatch', 'Skill version predates its predecessor')
    }
    for (const dependencyId of version.dependencyVersionIds) {
      const dependency = this.#versions.get(dependencyId)
      if (!dependency || dependency.tenantId !== version.tenantId) {
        throw failure('dependency_not_found', `Skill dependency is unavailable: ${dependencyId}`)
      }
    }
    return putImmutable(this.#versions, version.id, version)
  }

  recordTransition(input: unknown): SkillLifecycleEventV1 {
    let event: SkillLifecycleEventV1
    try {
      event = SkillLifecycleEventV1Schema.parse(input)
    } catch (error) {
      throw failure('invalid_skill_transition', 'Skill lifecycle event is invalid', error)
    }
    const version = this.#versions.get(event.skillVersionId)
    if (!version || version.tenantId !== event.tenantId || version.skillId !== event.skillId) {
      throw failure('skill_version_not_found', 'Skill lifecycle version is unavailable')
    }
    const history = this.#history(event.tenantId, event.skillVersionId)
    const prior = history.at(-1)
    if (event.sequence !== history.length + 1) {
      throw failure('transition_sequence_mismatch', 'Skill lifecycle sequence is not contiguous')
    }
    if (
      Date.parse(event.createdAt) < Date.parse(version.createdAt) ||
      (prior !== undefined && Date.parse(event.createdAt) <= Date.parse(prior.createdAt))
    ) {
      throw failure('transition_timeline_mismatch', 'Skill lifecycle time is not increasing')
    }
    if (!prior) {
      if (event.fromStatus !== null || event.toStatus !== 'quarantined') {
        throw failure('invalid_initial_transition', 'Skill version must begin in quarantine')
      }
    } else {
      if (event.fromStatus !== prior.toStatus) {
        throw failure(
          'stale_skill_transition',
          'Skill transition does not start from current status'
        )
      }
      if (!TRANSITIONS[prior.toStatus]?.includes(event.toStatus)) {
        throw failure('illegal_skill_transition', 'Skill lifecycle transition is not allowed')
      }
      if (
        prior.toStatus === 'certified' &&
        event.toStatus === 'active' &&
        event.certificationId !== prior.certificationId
      ) {
        throw failure('certification_mismatch', 'Skill activation must retain certification')
      }
    }
    return putImmutable(this.#events, event.id, event)
  }

  resolveActive(input: {
    tenantId: string
    skillId: string
    modelRoute: ModelRoute
    runtime: string
    runtimeVersion: string
    harness: string
    dataClass: SkillVersionV1['dataClasses'][number]
    taskClass: string
    availableTools: readonly SkillVersionV1['requiredTools'][number][]
    authorityEnvelope: SkillVersionV1['authorityEnvelope']
  }): SkillVersionV1 | null {
    const version = this.#latestVersion(input.tenantId, input.skillId)
    if (!version || this.status(version.tenantId, version.id) !== 'active') return null
    if (!version.dataClasses.includes(input.dataClass)) return null
    if (!version.supportedTaskClasses.includes(input.taskClass)) return null
    if (version.unsupportedTaskClasses.includes(input.taskClass)) return null
    if (
      version.requiredTools.some(
        (required) =>
          !input.availableTools.some(
            (available) => canonicalJson(available) === canonicalJson(required)
          )
      )
    ) {
      return null
    }
    if (canonicalJson(version.authorityEnvelope) !== canonicalJson(input.authorityEnvelope)) {
      return null
    }
    if (
      version.dependencyVersionIds.some((dependencyId) => {
        const dependency = this.#versions.get(dependencyId)
        return !dependency || this.status(dependency.tenantId, dependency.id) !== 'active'
      })
    ) {
      return null
    }
    if (
      !version.compatibleRuntimes.some(
        (runtime) =>
          runtime.runtime === input.runtime &&
          runtime.versionConstraint === input.runtimeVersion &&
          runtime.harness === input.harness
      )
    ) {
      return null
    }
    if (
      version.compatibleModelRoutes.length > 0 &&
      !version.compatibleModelRoutes.some(
        (route) => canonicalJson(route) === canonicalJson(input.modelRoute)
      )
    ) {
      return null
    }
    return version
  }

  status(tenantId: string, skillVersionId: string): SkillLifecycleEventV1['toStatus'] | null {
    return this.#history(tenantId, skillVersionId).at(-1)?.toStatus ?? null
  }

  #history(tenantId: string, skillVersionId: string): SkillLifecycleEventV1[] {
    return [...this.#events.values()]
      .filter((event) => event.tenantId === tenantId && event.skillVersionId === skillVersionId)
      .toSorted((left, right) => left.sequence - right.sequence)
  }

  #latestVersion(tenantId: string, skillId: string): SkillVersionV1 | null {
    return (
      [...this.#versions.values()]
        .filter((version) => version.tenantId === tenantId && version.skillId === skillId)
        .toSorted((left, right) => right.version - left.version)[0] ?? null
    )
  }
}
