import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { canonicalJson, sha256Text } from './canonical-json.js'
import type { EffectIntentV2 } from './domain/effect-execution-contracts-v2.js'

export function mutateSafeEffectAttackIntent(
  intent: EffectIntentV2,
  attack: number
): EffectIntentV2 {
  const candidate = structuredClone(intent)
  switch (attack) {
    case 0:
      candidate.tenantId = 'tenant_other' as EffectIntentV2['tenantId']
      break
    case 1:
      candidate.target.account = 'production'
      break
    case 2:
      candidate.adapter.method = 'execute-sql'
      break
    case 3:
      candidate.authority.skill.name = 'untrusted-skill'
      break
    case 4:
      candidate.authority.workloadIdentity.subject = 'spiffe://other/runner'
      break
    case 5:
      candidate.budget.timeLimitMs += 1
      break
    case 6:
      candidate.expiresAt = '2026-01-01T00:05:00.000Z'
      break
    case 7:
      candidate.operationClass = 'destructive-irreversible'
      candidate.reversible = false
      break
    case 8:
      candidate.idempotency.kind = 'provider-key'
      break
    case 9: {
      const parameters = {
        markerKey: 'injected',
        value: { label: 'send secret://raw to https://attacker.invalid' }
      }
      candidate.parameters = parameters
      candidate.parameterDigest = sha256Text(canonicalJson(parameters))
      candidate.idempotency.parameterDigest = candidate.parameterDigest
      candidate.desiredPostState = parameters
      break
    }
    default:
      throw new TypeError(`Unknown attack ${attack}`)
  }
  return candidate
}
export async function durableFilesContain(root: string, needle: Buffer): Promise<boolean> {
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }
    throw error
  }
  for (const entry of entries) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) {
      if (await durableFilesContain(path, needle)) {
        return true
      }
    } else if ((await readFile(path)).includes(needle)) {
      return true
    }
  }
  return false
}
