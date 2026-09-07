import { afterEach, describe, expect, it } from 'vitest'
import {
  createMissionApiTestHarness,
  createMissionBody,
  type MissionApiTestHarness,
  type MissionApiTestResponse
} from './public-mission-api-test-fixture.js'
import { insertMissionWorkspaceFixture } from './public-mission-workspace-test-fixture.js'

const harnesses: MissionApiTestHarness[] = []

async function harness(): Promise<MissionApiTestHarness> {
  const created = await createMissionApiTestHarness()
  harnesses.push(created)
  return created
}

function data<T>(response: MissionApiTestResponse): T {
  return response.body.data as T
}

async function createWorkspaceMission(
  api: MissionApiTestHarness,
  key: string,
  intake?: Record<string, unknown>
): Promise<string> {
  const response = await api.request('/api/v1/missions', {
    method: 'POST',
    token: 'writer-a',
    idempotencyKey: key,
    body: {
      ...createMissionBody(`Migrate the ${key} estate without data loss.`),
      ...intake
    }
  })
  expect(response.status).toBe(201)
  return data<{ mission: { id: string } }>(response).mission.id
}

async function view(
  api: MissionApiTestHarness,
  missionId: string,
  section: string,
  query = ''
): Promise<MissionApiTestResponse> {
  return api.request(`/api/v1/missions/${missionId}/views/${section}${query}`, {
    token: 'reader-a'
  })
}

function schemaNames(response: MissionApiTestResponse): string[] {
  if (response.status !== 200) {
    throw new Error(`Workspace view failed: ${JSON.stringify(response.body)}`)
  }
  return data<{ items: { schemaName: string }[] }>(response).items.map((item) => item.schemaName)
}

afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((created) => created.close()))
})

describe('integrated public mission workspace', () => {
  it('captures loose outcome, access, priorities, artifacts, and known exceptions', async () => {
    const api = await harness()
    const intake = {
      priorities: ['preserve identifiers', 'prove reconciliation'],
      access: [
        { system: 'legacy-postgres', level: 'read', reference: 'secret://legacy/read-only' }
      ],
      artifacts: [{ name: 'mapping workbook', reference: 'artifact://mapping-v3' }],
      knownExceptions: [
        { summary: 'Two archived facilities have missing owners.', impact: 'high', blocking: false }
      ]
    }
    const missionId = await createWorkspaceMission(api, 'loose-goal', intake)
    const response = await view(api, missionId, 'intake')
    expect(response.status).toBe(200)
    expect(data<{ section: string; intake: unknown }>(response)).toEqual({
      section: 'intake',
      intake: expect.objectContaining({
        objective: 'Migrate the loose-goal estate without data loss.',
        ...intake
      })
    })
  })

  it('reconstructs the first end-to-end mission through every evidence-backed view', async () => {
    const api = await harness()
    const missionId = await createWorkspaceMission(api, 'integrated-scenario')
    await insertMissionWorkspaceFixture(api.context, missionId)

    const estate = await view(api, missionId, 'estate')
    expect(schemaNames(estate)).toEqual(
      expect.arrayContaining(['source-system-inventory.v1', 'evidence-item.v1'])
    )
    const gaps = await view(api, missionId, 'gaps')
    expect(schemaNames(gaps)).toEqual(expect.arrayContaining(['proposition.v1', 'gap.v1']))
    const decisions = await view(api, missionId, 'decisions')
    expect(schemaNames(decisions)).toEqual(
      expect.arrayContaining(['decision-record.v1', 'plan-revision.v1'])
    )
    const agents = await view(api, missionId, 'agents')
    expect(schemaNames(agents)).toEqual(
      expect.arrayContaining(['task-record.v1', 'assignment-record.v1', 'assignment-result.v1'])
    )
    const evaluation = await view(api, missionId, 'evaluation')
    expect(schemaNames(evaluation)).toEqual(
      expect.arrayContaining([
        'artifact-version.v1',
        'evaluation-result.v1',
        'effect-intent.v1',
        'effect-receipt.v1',
        'correction-request.v1',
        'correction-result.v1',
        'learning-candidate.v1',
        'recovery-disposition.v1'
      ])
    )
  })

  it('exposes only unresolved exception scope and preserves unrelated work', async () => {
    const api = await harness()
    const missionId = await createWorkspaceMission(api, 'exception-channel')
    await insertMissionWorkspaceFixture(api.context, missionId)
    const response = await view(api, missionId, 'exceptions')
    const exceptions = data<{
      items: {
        id: string
        state: { status: string }
        blockedDecisionIds: string[]
        blockedTaskIds: string[]
      }[]
    }>(response).items
    expect(exceptions).toEqual([
      expect.objectContaining({
        state: expect.objectContaining({ status: 'blocked' }),
        blockedDecisionIds: ['decision_s1'],
        blockedTaskIds: ['task_s1']
      })
    ])
    const agentView = await view(api, missionId, 'agents')
    expect(schemaNames(agentView)).toContain('assignment-record.v1')

    const isolated = await api.request(`/api/v1/missions/${missionId}/views/exceptions`, {
      token: 'writer-b'
    })
    expect(isolated.status).toBe(404)
    const writeAttempt = await api.request(`/api/v1/missions/${missionId}/views/exceptions`, {
      method: 'POST',
      token: 'writer-a',
      body: {},
      idempotencyKey: 'exception-write'
    })
    expect(writeAttempt.status).toBe(404)
  })

  it('restores signed view pagination across server restart without duplicate records', async () => {
    const api = await harness()
    const missionId = await createWorkspaceMission(api, 'workspace-resume')
    await insertMissionWorkspaceFixture(api.context, missionId)
    const first = await view(api, missionId, 'gaps', '?limit=1')
    const firstPage = data<{ items: { id: string }[]; nextCursor: string }>(first)
    expect(firstPage.items).toHaveLength(1)
    await api.restart()
    const second = await view(
      api,
      missionId,
      'gaps',
      `?limit=100&cursor=${encodeURIComponent(firstPage.nextCursor)}`
    )
    const secondPage = data<{ items: { id: string }[]; nextCursor: null }>(second)
    expect(secondPage.nextCursor).toBeNull()
    expect(secondPage.items.map((item) => item.id)).not.toContain(firstPage.items[0]!.id)

    const wrongSection = await view(
      api,
      missionId,
      'estate',
      `?cursor=${encodeURIComponent(firstPage.nextCursor)}`
    )
    expect(wrongSection.status).toBe(400)
    expect(wrongSection.body).toMatchObject({ error: { code: 'invalid_cursor' } })
  })
})
