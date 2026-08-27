export type FixtureManifestEntry = {
  path: string
  sha256: string
  bytes: number
}

export type FixtureManifest = {
  schemaVersion: 1
  fixtureId: string
  license: string
  dataClass: string
  createdBy: string
  files: FixtureManifestEntry[]
}

export type ProfileRow = Record<string, string | null>

export type DuplicateKey = {
  values: Array<string | null>
  rowIndexes: number[]
}

export type KeyProbeResult = {
  columns: string[]
  rowCount: number
  distinctCount: number
  nullCount: number
  unique: boolean
  duplicates: DuplicateKey[]
  evidenceDigest: string
}

export type IdentityProfile = {
  schemaVersion: 1
  fixtureId: string
  entity: string
  observedAt: string
  columns: string[]
  rows: ProfileRow[]
  candidateKeys: Array<Omit<KeyProbeResult, 'rowCount' | 'unique' | 'evidenceDigest'>>
}

export type IdentityMapping = {
  schemaVersion: 1
  sourceEntity: string
  targetEntity: string
  sourceKey: string[]
  evidenceRefs: string[]
  decisionRef: string
  description?: string
}

export type ExpectedResults = {
  schemaVersion: 1
  decision: {
    id: string
    sourceKey: string[]
    evidenceRefs: string[]
  }
  probeResults: Array<Omit<KeyProbeResult, 'evidenceDigest'>>
  acceptedMapping: IdentityMapping
}

export type MutationDefinition = {
  id: string
  class: 'critical' | 'benign'
  operation: 'drop-source-key-column' | 'add-description'
  column?: string
  description?: string
  expectedVerdict: 'passed' | 'failed'
  expectedFailedMeasures: string[]
}

export type NegativeCaseClass =
  | 'role-scope'
  | 'tenant-isolation'
  | 'stale-context'
  | 'retrieved-injection'
  | 'candidate-memory-non-use'
  | 'denied-input'

export type NegativeCase = {
  id: string
  class: NegativeCaseClass
  input: Record<string, string>
  expected: { decision: string; reason: string }
}

export type OmpWorkerContract = {
  schemaVersion: 1
  contractId: string
  requiredOmp: {
    version: string
    sourceCommit: string
    protocolVersions: number[]
    maxPhysicalFrameBytes: number
    maxReassembledFrameBytes: number
  }
  allowedHostTools: Array<{ name: string; approval: string; strict: boolean; purpose: string }>
  forbiddenTools: string[]
  output: Record<string, boolean | string>
  cancellation: Record<string, boolean | string>
  evidenceCapture: Record<string, boolean | string>
  versionSkewCases: Array<{ observedVersion: string; expected: string }>
}

export type S1IdentityFixture = {
  root: string
  manifest: FixtureManifest
  manifestDigest: string
  profile: IdentityProfile
  expected: ExpectedResults
  mutations: MutationDefinition[]
  negativeCases: NegativeCase[]
  workerContract: OmpWorkerContract
}
