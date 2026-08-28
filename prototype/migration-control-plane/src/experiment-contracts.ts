import { canonicalizeJson, type JsonValue } from './canonical-json.js'

export type ExperimentArm = 'baseline' | 'candidate'
export type ExperimentStatus = 'passed' | 'failed' | 'inconclusive'
export type MeasureStatus = 'pass' | 'fail' | 'unknown'

export type EnvironmentManifest = {
  node: string
  platform: NodeJS.Platform
  arch: string
  prototypeRevision: string
}

export type RunManifest = {
  schemaVersion: 1
  runId: string
  experimentId: string
  seed: number
  arm: ExperimentArm
  fault: string | null
  createdAt: string
  fixtureId: string
  fixtureDigest: string
  environment: EnvironmentManifest
}

export type EvaluationMeasure = {
  name: string
  status: MeasureStatus
  value: JsonValue
  threshold: string
  evidence: string[]
}

export type ExperimentResult = {
  status: ExperimentStatus
  summary: string
  measures: EvaluationMeasure[]
  outputs: Record<string, JsonValue>
  limitations: string[]
}

export type RunCompletion = {
  schemaVersion: 1
  status: ExperimentStatus
  finalizedAt: string
}

export function createEvaluationMeasure(
  name: string,
  status: MeasureStatus,
  value: unknown,
  threshold: string,
  evidence: string[]
): EvaluationMeasure {
  return { name, status, value: canonicalizeJson(value), threshold, evidence }
}
