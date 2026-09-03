import type { Pool } from 'pg'
import type { ProcessCompletenessCampaign } from './process-obligation-completeness-types.js'
import { runProcessObligationCriticalProofCampaign } from './process-obligation-critical-proof-campaign.js'
import { runProcessObligationCriticalRecoveryCampaign } from './process-obligation-critical-recovery-campaign.js'

export async function runProcessObligationCriticalCampaign(
  pool: Pool,
  seed: number
): Promise<ProcessCompletenessCampaign> {
  const proof = await runProcessObligationCriticalProofCampaign(pool, seed)
  const recovery = await runProcessObligationCriticalRecoveryCampaign(pool, seed)
  return {
    cases: [...proof.cases, ...recovery.cases],
    crossTenantEffects: recovery.crossTenantEffects,
    unauthorizedWaivers: recovery.unauthorizedWaivers,
    duplicateBreaches: recovery.duplicateBreaches,
    exactRebuild: proof.exactRebuild,
    boundedDetection: proof.boundedDetection,
    genericRetries: recovery.genericRetries
  }
}
