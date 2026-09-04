import { afterEach, describe, expect, it } from 'vitest'
import {
  createMissionApiTestHarness,
  createMissionBody,
  type MissionApiTestHarness,
  type MissionApiTestResponse
} from './public-mission-api-test-fixture.js'

const harnesses: MissionApiTestHarness[] = []

type ActivityFrame = {
  id: string
  event: string
  data: {
    apiVersion: string
    activity: { aggregateRevision: number; eventType: string; missionId: string }
  }
}

async function harness(): Promise<MissionApiTestHarness> {
  const created = await createMissionApiTestHarness()
  harnesses.push(created)
  return created
}

function data<T>(response: MissionApiTestResponse): T {
  return response.body.data as T
}

async function createMission(api: MissionApiTestHarness, key: string): Promise<string> {
  const response = await api.request('/api/v1/missions', {
    method: 'POST',
    token: 'writer-a',
    idempotencyKey: key,
    body: createMissionBody(`Activity mission ${key}.`)
  })
  return data<{ mission: { id: string } }>(response).mission.id
}

async function changeState(
  api: MissionApiTestHarness,
  missionId: string,
  key: string,
  expectedRevision: number,
  status: 'investigating' | 'planning' | 'executing'
): Promise<void> {
  const response = await api.request(`/api/v1/missions/${missionId}/commands`, {
    method: 'POST',
    token: 'writer-a',
    idempotencyKey: key,
    body: {
      command: 'change-state',
      expectedRevision,
      state: { status },
      issuedAt: new Date(
        Date.parse('2026-01-01T00:00:00.000Z') + expectedRevision * 60_000
      ).toISOString()
    }
  })
  expect(response.status).toBe(200)
}

async function openActivity(
  api: MissionApiTestHarness,
  missionId: string,
  options: { token?: string; lastEventId?: string } = {}
): Promise<Response> {
  const headers: Record<string, string> = {}
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }
  if (options.lastEventId) {
    headers['Last-Event-ID'] = options.lastEventId
  }
  return fetch(`${api.baseUrl}/api/v1/missions/${missionId}/activity`, {
    headers,
    signal: AbortSignal.timeout(5_000)
  })
}

async function readActivityFrames(response: Response, count: number): Promise<ActivityFrame[]> {
  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toContain('text/event-stream')
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  const frames: ActivityFrame[] = []
  let pending = ''
  while (frames.length < count) {
    const chunk = await reader.read()
    if (chunk.done) {
      throw new Error('Activity stream ended before expected events')
    }
    pending += decoder.decode(chunk.value, { stream: true })
    let boundary = pending.indexOf('\n\n')
    while (boundary >= 0) {
      const block = pending.slice(0, boundary)
      pending = pending.slice(boundary + 2)
      const fields = Object.fromEntries(
        block
          .split('\n')
          .filter((line) => line.includes(': '))
          .map((line) => {
            const separator = line.indexOf(': ')
            return [line.slice(0, separator), line.slice(separator + 2)]
          })
      )
      if (fields.id && fields.event && fields.data) {
        frames.push({
          id: fields.id,
          event: fields.event,
          data: JSON.parse(fields.data) as ActivityFrame['data']
        })
      }
      if (frames.length >= count) {
        break
      }
      boundary = pending.indexOf('\n\n')
    }
  }
  await reader.cancel()
  return frames
}

afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((created) => created.close()))
})

describe('public mission activity SSE v1', () => {
  it('requires read authentication and hides cross-tenant missions', async () => {
    const api = await harness()
    const missionId = await createMission(api, 'activity-auth')
    const unauthenticated = await openActivity(api, missionId)
    expect(unauthenticated.status).toBe(401)
    expect((await unauthenticated.json()) as unknown).toMatchObject({
      error: { code: 'unauthenticated' }
    })

    const isolated = await openActivity(api, missionId, { token: 'writer-b' })
    expect(isolated.status).toBe(404)
    expect((await isolated.json()) as unknown).toMatchObject({
      error: { code: 'mission_not_found' }
    })

    const visible = await openActivity(api, missionId, { token: 'reader-a' })
    const [frame] = await readActivityFrames(visible, 1)
    expect(frame).toMatchObject({
      event: 'mission.activity',
      data: { apiVersion: 'v1', activity: { aggregateRevision: 1, missionId } }
    })
  })

  it('replays authoritative history once in aggregate revision order', async () => {
    const api = await harness()
    const missionId = await createMission(api, 'activity-history')
    await changeState(api, missionId, 'activity-history-2', 1, 'investigating')
    await changeState(api, missionId, 'activity-history-3', 2, 'planning')

    const response = await openActivity(api, missionId, { token: 'reader-a' })
    const frames = await readActivityFrames(response, 3)
    expect(frames.map((frame) => frame.data.activity.aggregateRevision)).toEqual([1, 2, 3])
    expect(new Set(frames.map((frame) => frame.id)).size).toBe(3)
    expect(frames.map((frame) => frame.data.activity.eventType)).toEqual([
      'mission-created',
      'mission-state-changed',
      'mission-state-changed'
    ])
  })

  it('delivers newly committed events after the connection becomes live', async () => {
    const api = await harness()
    const missionId = await createMission(api, 'activity-live')
    const initial = await readActivityFrames(
      await openActivity(api, missionId, { token: 'reader-a' }),
      1
    )
    const liveResponse = await openActivity(api, missionId, {
      token: 'reader-a',
      lastEventId: initial[0]!.id
    })
    await changeState(api, missionId, 'activity-live-2', 1, 'investigating')
    const live = (await readActivityFrames(liveResponse, 1))[0]!
    expect(live.data.activity.aggregateRevision).toBe(2)
  })

  it('resumes exactly after disconnect, offline commit, and server restart', async () => {
    const api = await harness()
    const missionId = await createMission(api, 'activity-resume')
    const initial = (
      await readActivityFrames(await openActivity(api, missionId, { token: 'reader-a' }), 1)
    )[0]!
    await changeState(api, missionId, 'activity-resume-2', 1, 'investigating')
    await api.restart()

    const replayed = (
      await readActivityFrames(
        await openActivity(api, missionId, {
          token: 'reader-a',
          lastEventId: initial.id
        }),
        1
      )
    )[0]!
    expect(replayed.data.activity.aggregateRevision).toBe(2)
    await changeState(api, missionId, 'activity-resume-3', 2, 'executing')
    const next = (
      await readActivityFrames(
        await openActivity(api, missionId, {
          token: 'reader-a',
          lastEventId: replayed.id
        }),
        1
      )
    )[0]!
    expect(next.data.activity.aggregateRevision).toBe(3)
  })

  it('rejects tampered and cross-resource Last-Event-ID cursors before streaming', async () => {
    const api = await harness()
    const firstMission = await createMission(api, 'activity-cursor-a')
    const secondMission = await createMission(api, 'activity-cursor-b')
    const first = (
      await readActivityFrames(await openActivity(api, firstMission, { token: 'reader-a' }), 1)
    )[0]!

    const tampered = await openActivity(api, firstMission, {
      token: 'reader-a',
      lastEventId: `${first.id}x`
    })
    expect(tampered.status).toBe(400)
    expect((await tampered.json()) as unknown).toMatchObject({ error: { code: 'invalid_cursor' } })

    const crossResource = await openActivity(api, secondMission, {
      token: 'reader-a',
      lastEventId: first.id
    })
    expect(crossResource.status).toBe(400)
    expect((await crossResource.json()) as unknown).toMatchObject({
      error: { code: 'invalid_cursor' }
    })
  })
})
