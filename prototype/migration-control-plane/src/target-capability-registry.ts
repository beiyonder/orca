import { canonicalJson } from './canonical-json.js'
import {
  TargetCapabilitySnapshotV1Schema,
  type TargetCapabilitySnapshotV1
} from './domain/migration-proposal-contracts.js'

export class TargetCapabilityRegistryError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'TargetCapabilityRegistryError'
    this.code = code
  }
}

const failure = (code: string, message: string) => new TargetCapabilityRegistryError(code, message)

export class TargetCapabilityRegistry {
  readonly #snapshots = new Map<string, TargetCapabilitySnapshotV1>()

  register(input: unknown): TargetCapabilitySnapshotV1 {
    let snapshot: TargetCapabilitySnapshotV1
    try {
      snapshot = TargetCapabilitySnapshotV1Schema.parse(input)
    } catch (error) {
      throw new TargetCapabilityRegistryError(
        'invalid_target_snapshot',
        error instanceof Error ? error.message : 'Target capability snapshot is invalid'
      )
    }
    const existing = this.#snapshots.get(snapshot.id)
    if (existing) {
      if (canonicalJson(existing) !== canonicalJson(snapshot)) {
        throw failure('immutable_conflict', 'Target snapshot differs for reused ID')
      }
      return existing
    }
    const prior = this.#latest(snapshot.tenantId, snapshot.targetId)
    if (snapshot.version === 1) {
      if (prior) {
        throw failure('version_conflict', 'First target snapshot already exists')
      }
    } else if (
      !prior ||
      snapshot.version !== prior.version + 1 ||
      snapshot.predecessorSnapshotId !== prior.id
    ) {
      throw failure('version_lineage_mismatch', 'Target snapshot lineage is invalid')
    }
    this.#snapshots.set(snapshot.id, snapshot)
    return snapshot
  }

  resolve(input: {
    tenantId: string
    targetId: string
    sourceEngine: string
    dataClass: TargetCapabilitySnapshotV1['dataClasses'][number]
    requiredOperations: readonly string[]
  }): TargetCapabilitySnapshotV1 | null {
    const snapshot = this.#latest(input.tenantId, input.targetId)
    if (!snapshot || snapshot.status !== 'observed' || !snapshot.coverage.complete) {
      return null
    }
    if (!snapshot.dataClasses.includes(input.dataClass)) {
      return null
    }
    if (!snapshot.compatibility.sourceEngines.includes(input.sourceEngine)) {
      return null
    }
    const supported = new Set(
      snapshot.operations
        .filter((operation) => operation.supported)
        .map((operation) => operation.name)
    )
    return input.requiredOperations.every((operation) => supported.has(operation)) ? snapshot : null
  }

  #latest(tenantId: string, targetId: string): TargetCapabilitySnapshotV1 | null {
    return (
      [...this.#snapshots.values()]
        .filter((snapshot) => snapshot.tenantId === tenantId && snapshot.targetId === targetId)
        .toSorted((left, right) => right.version - left.version)[0] ?? null
    )
  }
}
