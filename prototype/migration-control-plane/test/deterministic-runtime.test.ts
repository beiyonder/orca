import { describe, expect, it } from 'vitest'
import {
  DeterministicClock,
  DeterministicIdFactory,
  DeterministicRuntime
} from '../src/deterministic-runtime.js'

describe('deterministic runtime', () => {
  it('replays exact IDs, sequence, and timestamps for the same seed', () => {
    const first = new DeterministicRuntime({ seed: 7, tickMs: 500 })
    const second = new DeterministicRuntime({ seed: 7, tickMs: 500 })
    const firstEvents = [first.event('evt'), first.event('evt')]
    const secondEvents = [second.event('evt'), second.event('evt')]

    expect(firstEvents).toEqual(secondEvents)
    expect(firstEvents).toEqual([
      { id: 'evt_000000_a93a9395983a61df', at: '2026-01-01T00:00:00.000Z', sequence: 0 },
      { id: 'evt_000001_5c78c1b9e043934f', at: '2026-01-01T00:00:00.500Z', sequence: 1 }
    ])
  })

  it('separates seeds and validates ID and clock inputs', () => {
    const first = new DeterministicIdFactory(1)
    const second = new DeterministicIdFactory(2)
    expect(first.next('run')).not.toBe(second.next('run'))
    expect(() => first.next('../bad')).toThrow('Invalid deterministic ID prefix')
    expect(() => new DeterministicIdFactory(-1)).toThrow('Seed must be an integer')

    const clock = new DeterministicClock('2026-01-01T00:00:00.000Z')
    expect(clock.advance(1_000).toISOString()).toBe('2026-01-01T00:00:01.000Z')
    expect(() => clock.advance(-1)).toThrow('Clock advance must be a non-negative safe integer')
  })
})
