import { canonicalJson } from './canonical-json.js'
import {
  SourceAccessEnvelopeV1Schema,
  SourceAdapterDefinitionV1Schema,
  type SourceAccessEnvelopeV1,
  type SourceAdapterDefinitionV1,
  type SourceReadLimits
} from './domain/source-adapter-contracts.js'
import {
  SourceObservationV1Schema,
  SourceRequestV1Schema,
  type SourceObservationV1,
  type SourceRequestV1
} from './domain/source-probe-contracts.js'

export class SourceAdapterRegistryError extends Error {
  readonly code: string
  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SourceAdapterRegistryError'
    this.code = code
  }
}

function failure(code: string, message: string, cause?: unknown): SourceAdapterRegistryError {
  return new SourceAdapterRegistryError(code, message, cause === undefined ? undefined : { cause })
}

function putImmutable<T extends object>(map: Map<string, T>, id: string, value: T): T {
  const existing = map.get(id)
  if (existing) {
    if (canonicalJson(existing) !== canonicalJson(value)) {
      throw failure('immutable_conflict', `Source adapter record differs for reused ID: ${id}`)
    }
    return existing
  }
  map.set(id, value)
  return value
}

function withinLimits(requested: SourceReadLimits, allowed: SourceReadLimits): boolean {
  return (Object.keys(requested) as (keyof SourceReadLimits)[]).every(
    (key) => requested[key] <= allowed[key]
  )
}

function versionParts(value: string): number[] | null {
  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(value)
  return match ? [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)] : null
}

function compareVersion(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < 3; index += 1) {
    const difference = left[index]! - right[index]!
    if (difference !== 0) {
      return difference
    }
  }
  return 0
}

function matchesVersion(version: string, constraint: string): boolean {
  const parsed = versionParts(version)
  if (!parsed) {
    return false
  }
  return constraint.split(/\s+/).every((part) => {
    const match = /^(>=|<=|>|<|=)?(\d+(?:\.\d+){0,2})$/.exec(part)
    if (!match) {
      return false
    }
    const target = versionParts(match[2]!)!
    const comparison = compareVersion(parsed, target)
    switch (match[1] ?? '=') {
      case '>=':
        return comparison >= 0
      case '<=':
        return comparison <= 0
      case '>':
        return comparison > 0
      case '<':
        return comparison < 0
      default:
        return comparison === 0
    }
  })
}

export class SourceAdapterRegistry {
  readonly #definitions = new Map<string, SourceAdapterDefinitionV1>()
  readonly #access = new Map<string, SourceAccessEnvelopeV1>()
  readonly #requests = new Map<string, SourceRequestV1>()
  readonly #observations = new Map<string, SourceObservationV1>()

  static reconstruct(input: {
    definitions: readonly unknown[]
    accessEnvelopes: readonly unknown[]
    requests: readonly unknown[]
    observations: readonly unknown[]
  }): SourceAdapterRegistry {
    const registry = new SourceAdapterRegistry()
    const definitions = input.definitions
      .map((definition) => SourceAdapterDefinitionV1Schema.parse(definition))
      .toSorted(
        (left, right) =>
          left.tenantId.localeCompare(right.tenantId) ||
          left.adapterId.localeCompare(right.adapterId) ||
          left.version - right.version
      )
    for (const definition of definitions) {
      registry.registerDefinition(definition)
    }
    for (const envelope of input.accessEnvelopes) {
      registry.issueAccess(envelope)
    }
    for (const request of input.requests) {
      registry.admitRequest(request)
    }
    for (const observation of input.observations) {
      registry.recordObservation(observation)
    }
    return registry
  }

  registerDefinition(input: unknown): SourceAdapterDefinitionV1 {
    let definition: SourceAdapterDefinitionV1
    try {
      definition = SourceAdapterDefinitionV1Schema.parse(input)
    } catch (error) {
      throw failure('invalid_definition', 'Source adapter definition is invalid', error)
    }
    const existing = this.#definitions.get(definition.id)
    if (existing) {
      return putImmutable(this.#definitions, definition.id, definition)
    }
    const prior = this.#latestDefinition(definition.tenantId, definition.adapterId)
    if (definition.version === 1) {
      if (prior) {
        throw failure('version_conflict', 'First source adapter version already exists')
      }
    } else if (
      !prior ||
      definition.version !== prior.version + 1 ||
      definition.predecessorDefinitionId !== prior.id
    ) {
      throw failure('version_lineage_mismatch', 'Source adapter definition lineage is invalid')
    }
    return putImmutable(this.#definitions, definition.id, definition)
  }

  issueAccess(input: unknown): SourceAccessEnvelopeV1 {
    let envelope: SourceAccessEnvelopeV1
    try {
      envelope = SourceAccessEnvelopeV1Schema.parse(input)
    } catch (error) {
      throw failure('invalid_access', 'Source access envelope is invalid', error)
    }
    const existing = this.#access.get(envelope.id)
    if (existing) {
      return putImmutable(this.#access, envelope.id, envelope)
    }
    const definition = this.#definitions.get(envelope.adapterDefinitionId)
    if (!definition || definition.tenantId !== envelope.tenantId) {
      throw failure('definition_not_found', 'Source access references an unavailable definition')
    }
    const operationSet = new Set(definition.operations)
    const dataClassSet = new Set(definition.dataClasses)
    if (envelope.allowedOperations.some((operation) => !operationSet.has(operation))) {
      throw failure('operation_not_supported', 'Source access expands adapter operations')
    }
    if (envelope.dataClasses.some((dataClass) => !dataClassSet.has(dataClass))) {
      throw failure('data_class_not_supported', 'Source access expands adapter data classes')
    }
    if (!withinLimits(envelope.limits, definition.defaultLimits)) {
      throw failure('limit_expansion', 'Source access expands adapter limits')
    }
    if (!envelope.networkEndpointDigests.includes(envelope.source.endpointDigest)) {
      throw failure('endpoint_not_allowed', 'Source endpoint is outside the access envelope')
    }
    if (
      !definition.supportedSources.some(
        (supported) =>
          supported.engine === envelope.source.engine &&
          matchesVersion(envelope.source.engineVersion, supported.versionConstraint)
      )
    ) {
      throw failure('source_not_supported', 'Source engine or version is unsupported')
    }
    return putImmutable(this.#access, envelope.id, envelope)
  }

  admitRequest(input: unknown): SourceRequestV1 {
    let request: SourceRequestV1
    try {
      request = SourceRequestV1Schema.parse(input)
    } catch (error) {
      throw failure('invalid_request', 'Source request is invalid', error)
    }
    const existing = this.#requests.get(request.id)
    if (existing) {
      return putImmutable(this.#requests, request.id, request)
    }
    const access = this.#access.get(request.accessEnvelopeId)
    const definition = this.#definitions.get(request.adapterDefinitionId)
    if (!access || !definition || access.adapterDefinitionId !== definition.id) {
      throw failure('authority_not_found', 'Source request authority is unavailable')
    }
    const requestedAt = Date.parse(request.createdAt)
    if (
      request.tenantId !== access.tenantId ||
      canonicalJson(request.source) !== canonicalJson(access.source) ||
      !access.allowedOperations.includes(request.operation) ||
      !access.dataClasses.includes(request.dataClass) ||
      !withinLimits(request.limits, access.limits) ||
      requestedAt < Date.parse(access.issuedAt) ||
      requestedAt >= Date.parse(access.expiresAt) ||
      (access.revokedAt !== null && requestedAt >= Date.parse(access.revokedAt))
    ) {
      throw failure('request_not_authorized', 'Source request exceeds its access envelope')
    }
    const uses = [...this.#requests.values()].filter(
      (existing) => existing.accessEnvelopeId === access.id
    ).length
    if (uses >= access.maxUses) {
      throw failure('access_exhausted', 'Source access use limit is exhausted')
    }
    return putImmutable(this.#requests, request.id, request)
  }

  recordObservation(input: unknown): SourceObservationV1 {
    let observation: SourceObservationV1
    try {
      observation = SourceObservationV1Schema.parse(input)
    } catch (error) {
      throw failure('invalid_observation', 'Source observation is invalid', error)
    }
    const existing = this.#observations.get(observation.id)
    if (existing) {
      return putImmutable(this.#observations, observation.id, observation)
    }
    const request = this.#requests.get(observation.requestId)
    if (
      !request ||
      request.tenantId !== observation.tenantId ||
      request.adapterDefinitionId !== observation.adapterDefinitionId ||
      request.accessEnvelopeId !== observation.accessEnvelopeId ||
      request.operation !== observation.operation ||
      canonicalJson(request.source) !== canonicalJson(observation.source)
    ) {
      throw failure('request_mismatch', 'Source observation differs from its request')
    }
    if (
      observation.usage.queryCount > request.limits.queryLimit ||
      observation.usage.rowCount > request.limits.rowLimit ||
      observation.usage.byteCount > request.limits.byteLimit ||
      observation.usage.wallTimeMs > request.limits.timeLimitMs
    ) {
      throw failure('observation_limit_exceeded', 'Source observation exceeds request limits')
    }
    if ([...this.#observations.values()].some((recorded) => recorded.requestId === request.id)) {
      throw failure('observation_exists', 'Source request already has an observation')
    }
    return putImmutable(this.#observations, observation.id, observation)
  }

  #latestDefinition(tenantId: string, adapterId: string): SourceAdapterDefinitionV1 | null {
    return (
      [...this.#definitions.values()]
        .filter(
          (definition) => definition.tenantId === tenantId && definition.adapterId === adapterId
        )
        .toSorted((left, right) => right.version - left.version)[0] ?? null
    )
  }
}
