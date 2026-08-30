import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  DOMAIN_SCHEMA_NAMES,
  DOMAIN_SCHEMA_REGISTRY,
  domainSchemaFileName,
  domainSchemaId,
  exportDomainJsonSchema,
  parseDomainRecord
} from '../src/domain/domain-contract-registry.js'
import { validateMissionContractSet } from '../src/domain/mission-contract-set.js'
import { buildDomainSchemaFiles, checkDomainSchemaFiles } from '../src/generate-domain-schemas.js'
import { DOMAIN_CONTRACT_SAMPLES } from './domain-contract-samples.js'

const generatedRoot = fileURLToPath(new URL('../schemas/v1', import.meta.url))
const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  )
})

describe('versioned domain contract registry', () => {
  it('contains one valid canonical sample for every registered schema', () => {
    expect(Object.keys(DOMAIN_CONTRACT_SAMPLES).sort()).toEqual(DOMAIN_SCHEMA_NAMES)
    for (const name of DOMAIN_SCHEMA_NAMES) {
      expect(() => parseDomainRecord(name, DOMAIN_CONTRACT_SAMPLES[name])).not.toThrow()
    }
  })

  it('rejects unknown top-level fields and future schema versions for every record', () => {
    for (const name of DOMAIN_SCHEMA_NAMES) {
      const sample = DOMAIN_CONTRACT_SAMPLES[name] as Record<string, unknown>
      const schemaVersion = Number(/\.v([1-9][0-9]*)$/.exec(name)?.[1])
      expect(DOMAIN_SCHEMA_REGISTRY[name].safeParse({ ...sample, unexpected: true }).success).toBe(
        false
      )
      expect(
        DOMAIN_SCHEMA_REGISTRY[name].safeParse({ ...sample, schemaVersion: schemaVersion + 1 })
          .success
      ).toBe(false)
    }
  })

  it('exports strict Draft 2020-12 JSON schemas with stable IDs and version constants', () => {
    for (const name of DOMAIN_SCHEMA_NAMES) {
      const schemaVersion = Number(/\.v([1-9][0-9]*)$/.exec(name)?.[1])
      const schema = exportDomainJsonSchema(name)
      expect(z.json().parse(schema)).toEqual(schema)
      expect(schema).toMatchObject({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: domainSchemaId(name),
        title: name,
        'x-orca-contract': {
          registryVersion: 1,
          schemaName: name,
          runtimeInvariantValidationRequired: true
        },
        additionalProperties: false,
        properties: {
          schemaVersion: { const: schemaVersion }
        }
      })
    }
  })

  it('validates one tenant/mission identity boundary across the complete record set', () => {
    const inputs = DOMAIN_SCHEMA_NAMES.map((schema) => ({
      schema,
      value: DOMAIN_CONTRACT_SAMPLES[schema]
    }))
    expect(
      validateMissionContractSet(inputs, { tenantId: 'tenant_s1', missionId: 'mission_s1' })
    ).toHaveLength(DOMAIN_SCHEMA_NAMES.length)

    expect(() =>
      validateMissionContractSet([...inputs, inputs[0]!], {
        tenantId: 'tenant_s1',
        missionId: 'mission_s1'
      })
    ).toThrow('Duplicate domain record ID')

    const wrongTenant = structuredClone(inputs)
    ;(wrongTenant[0]!.value as Record<string, unknown>).tenantId = 'tenant_other'
    expect(() =>
      validateMissionContractSet(wrongTenant, {
        tenantId: 'tenant_s1',
        missionId: 'mission_s1'
      })
    ).toThrow('Tenant mismatch')

    const wrongMission = structuredClone(inputs)
    const missionScoped = wrongMission.find((input) => input.schema === 'evidence-item.v1')!
    ;(missionScoped.value as Record<string, unknown>).missionId = 'mission_other'
    expect(() =>
      validateMissionContractSet(wrongMission, {
        tenantId: 'tenant_s1',
        missionId: 'mission_s1'
      })
    ).toThrow('Mission mismatch')
  })

  it('keeps all generated schema files and their manifest byte-identical to source', async () => {
    await expect(checkDomainSchemaFiles(generatedRoot)).resolves.toBeUndefined()
    const generated = await buildDomainSchemaFiles()
    expect(Object.keys(generated)).toHaveLength(DOMAIN_SCHEMA_NAMES.length + 1)
    for (const name of DOMAIN_SCHEMA_NAMES) {
      const file = domainSchemaFileName(name)
      expect(
        await readFile(fileURLToPath(new URL(`../schemas/v1/${file}`, import.meta.url)), 'utf8')
      ).toBe(generated[file])
    }
  })

  it('detects a modified generated schema before verification can pass', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-domain-schemas-'))
    temporaryRoots.push(root)
    const copy = join(root, 'v1')
    await cp(generatedRoot, copy, { recursive: true })
    await writeFile(join(copy, domainSchemaFileName('mission-record.v1')), '{}\n')
    await expect(checkDomainSchemaFiles(copy)).rejects.toThrow(
      'Generated domain schemas are stale: mission-record.v1.schema.json'
    )
  }, 30_000)
})
