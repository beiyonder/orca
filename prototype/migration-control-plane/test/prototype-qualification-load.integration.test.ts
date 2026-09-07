import { afterEach, describe, expect, it } from 'vitest'
import { runPrototypeQualificationLoad } from '../src/prototype-qualification-load.js'
import { loadPrototypeQualificationProfile } from '../src/prototype-qualification-profile.js'
import {
  createPostgresKernelTestContext,
  type PostgresKernelTestContext
} from './postgres-kernel-test-context.js'
import { fileURLToPath } from 'node:url'

const labRoot = fileURLToPath(new URL('..', import.meta.url))
const contexts: PostgresKernelTestContext[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map((context) => context.close()))
})

describe('P10 planning envelope', () => {
  it('persists fifty missions and one hundred bounded assignment records', async () => {
    const context = await createPostgresKernelTestContext()
    contexts.push(context)
    const { profile } = await loadPrototypeQualificationProfile(
      labRoot,
      'qualification/p10-profile.v1.json'
    )
    const result = await runPrototypeQualificationLoad(context.pool, profile)
    expect(result).toMatchObject({
      missions: 50,
      assignmentRecords: 100,
      controlEvents: 50
    })
    expect(result.elapsedMs).toBeGreaterThan(0)
    expect(result.missionEventBytes).toBeGreaterThan(0)
    expect(result.bottlenecks).toHaveLength(3)
  }, 30_000)
})
