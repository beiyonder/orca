export type ProcessCompletenessCaseResult = {
  name: string
  passed: boolean
  signals: string[]
}

export type ProcessCompletenessCampaign = {
  cases: ProcessCompletenessCaseResult[]
  crossTenantEffects: number
  unauthorizedWaivers: number
  duplicateBreaches: number
  exactRebuild: boolean
  boundedDetection: boolean
  genericRetries: number
}
