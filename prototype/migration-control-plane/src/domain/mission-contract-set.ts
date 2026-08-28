import { requireRecord } from '../runtime-validation.js'
import { parseDomainRecord, type DomainSchemaName } from './domain-contract-registry.js'

export type MissionContractInput = {
  schema: DomainSchemaName
  value: unknown
}

export type ValidatedMissionContract = {
  schema: DomainSchemaName
  record: Record<string, unknown>
}

export function validateMissionContractSet(
  inputs: readonly MissionContractInput[],
  expected: { tenantId: string; missionId: string }
): ValidatedMissionContract[] {
  const validated: ValidatedMissionContract[] = []
  const ids = new Set<string>()
  for (const [index, input] of inputs.entries()) {
    const record = requireRecord(parseDomainRecord(input.schema, input.value), input.schema)
    const id = record.id
    const tenantId = record.tenantId
    if (typeof id !== 'string') throw new TypeError(`${input.schema} has no string id`)
    if (ids.has(id)) throw new Error(`Duplicate domain record ID at index ${index}: ${id}`)
    ids.add(id)
    if (tenantId !== expected.tenantId) {
      throw new Error(`Tenant mismatch for ${id}: ${String(tenantId)}`)
    }
    if (Object.hasOwn(record, 'missionId') && record.missionId !== expected.missionId) {
      throw new Error(`Mission mismatch for ${id}: ${String(record.missionId)}`)
    }
    validated.push({ schema: input.schema, record })
  }
  return validated
}
