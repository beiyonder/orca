import { afterEach, describe, expect, it } from 'vitest'
import {
  createMissionApiTestHarness,
  createMissionBody,
  registerApiObligationDefinitions,
  type MissionApiTestHarness,
  type MissionApiTestResponse
} from './public-mission-api-test-fixture.js'

const harnesses: MissionApiTestHarness[] = []

async function harness(maxBodyBytes?: number): Promise<MissionApiTestHarness> {
  const created = await createMissionApiTestHarness(maxBodyBytes)
  harnesses.push(created)
  return created
}

function data<T>(response: MissionApiTestResponse): T {
  return response.body.data as T
}

function errorCode(response: MissionApiTestResponse): string | undefined {
  return (response.body.error as { code?: string } | undefined)?.code
}

afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((created) => created.close()))
})

describe('public mission API v1', () => {
  it('requires bearer permissions and uses tenant-scoped not-found responses', async () => {
    const api = await harness()
    const unauthenticated = await api.request('/api/v1/missions')
    expect(unauthenticated.status).toBe(401)
    expect(unauthenticated.headers.get('www-authenticate')).toContain('Bearer')

    const forbidden = await api.request('/api/v1/missions', {
      method: 'POST',
      token: 'reader-a',
      body: createMissionBody('Forbidden mission.'),
      idempotencyKey: 'forbidden'
    })
    expect(forbidden.status).toBe(403)

    const created = await api.request('/api/v1/missions', {
      method: 'POST',
      token: 'writer-a',
      body: createMissionBody('Tenant A mission.'),
      idempotencyKey: 'tenant-a-create'
    })
    expect(created.status).toBe(201)
    expect(created.headers.get('access-control-allow-origin')).toBeNull()
    expect(created.headers.get('set-cookie')).toBeNull()
    const missionId = data<{ mission: { id: string } }>(created).mission.id
    const visible = await api.request(`/api/v1/missions/${missionId}`, { token: 'reader-a' })
    expect(visible).toMatchObject({ status: 200, body: { apiVersion: 'v1' } })

    const isolated = await api.request(`/api/v1/missions/${missionId}`, { token: 'writer-b' })
    expect(isolated.status).toBe(404)
    expect(errorCode(isolated)).toBe('mission_not_found')
    const malformedPath = await api.request('/api/v1/missions/%ZZ', { token: 'reader-a' })
    expect(malformedPath.status).toBe(404)
  })

  it('paginates opaque tenant-bound mission cursors and survives server restart', async () => {
    const api = await harness()
    const missionIds: string[] = []
    for (let index = 1; index <= 3; index += 1) {
      const created = await api.request('/api/v1/missions', {
        method: 'POST',
        token: 'writer-a',
        body: createMissionBody(`Paginated mission ${index}.`),
        idempotencyKey: `pagination-${index}`
      })
      missionIds.push(data<{ mission: { id: string } }>(created).mission.id)
    }

    const first = await api.request('/api/v1/missions?limit=2', { token: 'reader-a' })
    const firstPage = data<{ items: { id: string }[]; nextCursor: string }>(first)
    expect(first.status).toBe(200)
    expect(firstPage.items).toHaveLength(2)
    expect(firstPage.nextCursor).toBeTypeOf('string')

    const second = await api.request(
      `/api/v1/missions?limit=2&cursor=${encodeURIComponent(firstPage.nextCursor)}`,
      { token: 'reader-a' }
    )
    expect(data<{ items: unknown[]; nextCursor: null }>(second)).toMatchObject({
      items: expect.any(Array),
      nextCursor: null
    })
    expect(data<{ items: unknown[] }>(second).items).toHaveLength(1)

    const tampered = await api.request(
      `/api/v1/missions?cursor=${encodeURIComponent(`${firstPage.nextCursor}x`)}`,
      { token: 'reader-a' }
    )
    expect(tampered.status).toBe(400)
    expect(errorCode(tampered)).toBe('invalid_cursor')
    const crossTenantCursor = await api.request(
      `/api/v1/missions?cursor=${encodeURIComponent(firstPage.nextCursor)}`,
      { token: 'writer-b' }
    )
    expect(crossTenantCursor.status).toBe(400)
    expect(errorCode(crossTenantCursor)).toBe('invalid_cursor')

    await api.restart()
    const restarted = await api.request(`/api/v1/missions/${missionIds[0]}`, {
      token: 'reader-a'
    })
    expect(restarted.status).toBe(200)
  })

  it('replays exact create and command requests while rejecting changed or stale input', async () => {
    const api = await harness()
    const body = createMissionBody('Idempotent mission.')
    const first = await api.request('/api/v1/missions', {
      method: 'POST',
      token: 'writer-a',
      body,
      idempotencyKey: 'idempotent-create'
    })
    const replay = await api.request('/api/v1/missions', {
      method: 'POST',
      token: 'writer-a',
      body,
      idempotencyKey: 'idempotent-create'
    })
    expect(first.status).toBe(201)
    expect(replay.status).toBe(200)
    expect(data<{ disposition: string }>(replay).disposition).toBe('replayed')
    const missionId = data<{ mission: { id: string } }>(first).mission.id

    const mismatch = await api.request('/api/v1/missions', {
      method: 'POST',
      token: 'writer-a',
      body: createMissionBody('Changed mission.'),
      idempotencyKey: 'idempotent-create'
    })
    expect(mismatch.status).toBe(409)
    expect(errorCode(mismatch)).toBe('idempotency_conflict')

    const concurrentBody = createMissionBody('Concurrent replay mission.')
    const concurrent = await Promise.all([
      api.request('/api/v1/missions', {
        method: 'POST',
        token: 'writer-a',
        body: concurrentBody,
        idempotencyKey: 'concurrent-create'
      }),
      api.request('/api/v1/missions', {
        method: 'POST',
        token: 'writer-a',
        body: concurrentBody,
        idempotencyKey: 'concurrent-create'
      })
    ])
    expect(concurrent.map((response) => response.status).sort()).toEqual([200, 201])

    const commandBody = {
      command: 'change-state',
      expectedRevision: 1,
      state: { status: 'investigating' },
      issuedAt: '2026-01-01T00:01:00.000Z'
    }
    const command = await api.request(`/api/v1/missions/${missionId}/commands`, {
      method: 'POST',
      token: 'writer-a',
      body: commandBody,
      idempotencyKey: 'state-one'
    })
    const commandReplay = await api.request(`/api/v1/missions/${missionId}/commands`, {
      method: 'POST',
      token: 'writer-a',
      body: commandBody,
      idempotencyKey: 'state-one'
    })
    expect(data<{ mission: { revision: number } }>(command).mission.revision).toBe(2)
    expect(data<{ disposition: string }>(commandReplay).disposition).toBe('replayed')

    const stale = await api.request(`/api/v1/missions/${missionId}/commands`, {
      method: 'POST',
      token: 'writer-a',
      body: {
        ...commandBody,
        state: { status: 'planning' },
        issuedAt: '2026-01-01T00:02:00.000Z'
      },
      idempotencyKey: 'stale-state'
    })
    expect(stale.status).toBe(409)
    expect(errorCode(stale)).toBe('version_conflict')
  })

  it('instantiates every server-selected obligation and paginates qualified state', async () => {
    const api = await harness()
    await registerApiObligationDefinitions(api.context, 2)
    const created = await api.request('/api/v1/missions', {
      method: 'POST',
      token: 'writer-a',
      body: createMissionBody('Obligation API mission.'),
      idempotencyKey: 'obligation-create'
    })
    const missionId = data<{ mission: { id: string } }>(created).mission.id
    const changed = await api.request(`/api/v1/missions/${missionId}/commands`, {
      method: 'POST',
      token: 'writer-a',
      idempotencyKey: 'obligation-state',
      body: {
        command: 'change-state',
        expectedRevision: 1,
        state: { status: 'planning' },
        issuedAt: '2026-01-01T00:01:00.000Z'
      }
    })
    expect(changed.status).toBe(200)
    expect(data<{ obligationIds: string[] }>(changed).obligationIds).toHaveLength(2)

    const first = await api.request(`/api/v1/missions/${missionId}/obligations?limit=1`, {
      token: 'reader-a'
    })
    const firstPage = data<{
      items: { state: { status: string }; currentFence: number }[]
      nextCursor: string
    }>(first)
    expect(firstPage.items).toEqual([
      expect.objectContaining({ state: { status: 'pending' }, currentFence: 1 })
    ])
    const second = await api.request(
      `/api/v1/missions/${missionId}/obligations?limit=1&cursor=${encodeURIComponent(firstPage.nextCursor)}`,
      { token: 'reader-a' }
    )
    expect(data<{ items: unknown[]; nextCursor: null }>(second)).toMatchObject({
      items: [expect.any(Object)],
      nextCursor: null
    })

    const clientAuthority = await api.request(`/api/v1/missions/${missionId}/commands`, {
      method: 'POST',
      token: 'writer-a',
      idempotencyKey: 'client-obligations',
      body: {
        command: 'change-state',
        expectedRevision: 2,
        state: { status: 'executing' },
        issuedAt: '2026-01-01T00:02:00.000Z',
        obligations: []
      }
    })
    expect(clientAuthority.status).toBe(400)
    expect(errorCode(clientAuthority)).toBe('invalid_request')
  })

  it('rejects malformed, oversized, and unknown request input', async () => {
    const api = await harness(256)
    const malformed = await api.request('/api/v1/missions', {
      method: 'POST',
      token: 'writer-a',
      rawBody: '{',
      idempotencyKey: 'malformed'
    })
    expect(malformed.status).toBe(400)
    expect(errorCode(malformed)).toBe('invalid_json')

    const oversized = await api.request('/api/v1/missions', {
      method: 'POST',
      token: 'writer-a',
      rawBody: JSON.stringify({ objective: 'x'.repeat(300) }),
      idempotencyKey: 'oversized'
    })
    expect(oversized.status).toBe(413)
    expect(errorCode(oversized)).toBe('payload_too_large')

    const unknownQuery = await api.request('/api/v1/missions?unexpected=true', {
      token: 'reader-a'
    })
    expect(unknownQuery.status).toBe(400)
    expect(errorCode(unknownQuery)).toBe('invalid_request')
  })
})
