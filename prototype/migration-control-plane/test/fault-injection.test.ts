import { describe, expect, it } from 'vitest'
import {
  FAULT_POINT_DEFINITIONS,
  FaultInjector,
  FaultNotReachedError,
  InjectedFaultError,
  parseFaultSelection
} from '../src/fault-injection.js'

describe('named fault injection', () => {
  it('covers every required boundary with unique named points', () => {
    const boundaries = new Set(FAULT_POINT_DEFINITIONS.map((definition) => definition.boundary))
    expect([...boundaries].sort()).toEqual([
      'database',
      'evaluator',
      'memory',
      'mission',
      'network',
      'object',
      'process',
      'target'
    ])
    expect(new Set(FAULT_POINT_DEFINITIONS.map((definition) => definition.id)).size).toBe(
      FAULT_POINT_DEFINITIONS.length
    )
  })

  it('injects only at the selected occurrence and preserves every hit', () => {
    const injector = new FaultInjector('database.after_commit', 2)
    injector.hit('database.after_commit')
    expect(() => injector.hit('database.after_commit')).toThrow(InjectedFaultError)
    expect(injector.hits()).toEqual([
      { point: 'database.after_commit', boundary: 'database', occurrence: 1 },
      { point: 'database.after_commit', boundary: 'database', occurrence: 2 }
    ])
    expect(() => injector.assertSatisfied()).not.toThrow()
  })

  it('rejects unknown points and detects a configured point that never ran', () => {
    expect(() => parseFaultSelection('unknown')).toThrow('Unknown fault point')
    expect(parseFaultSelection('none')).toBeNull()
    const injector = new FaultInjector('target.after_response')
    injector.hit('database.before_commit')
    expect(() => injector.assertSatisfied()).toThrow(FaultNotReachedError)
  })
})
