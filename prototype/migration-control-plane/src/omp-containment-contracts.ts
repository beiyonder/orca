import type {
  ContextManifestDeliveryAuthority,
  ContextManifestSource
} from './omp-context-manifest-delivery.js'

export type OmpContainmentExperimentInput = {
  executable: string
  requiredVersion: string
  requiredExecutableDigest: string
  baseDirectory: string
  parentEnv?: NodeJS.ProcessEnv
  contextManifest: unknown
  contextAuthority: ContextManifestDeliveryAuthority
  contextSources: readonly ContextManifestSource[]
  startedAt: string
}

export type OmpContainmentMeasure = {
  name: string
  passed: boolean
  evidence: string
}

export type OmpContainmentReport = {
  schemaVersion: 1
  experimentId: 'EXP-10'
  runId: string
  status: 'passed' | 'failed'
  ompVersion: string
  executableDigest: string
  protocolVersion: 2
  maxPhysicalFrameBytes: number
  maxReassembledFrameBytes: number
  contextDeliveryDigest: string
  measures: readonly OmpContainmentMeasure[]
  protocolFrameCategories: readonly string[]
  startedAt: string
  completedAt: string
  reportDigest: string
}
