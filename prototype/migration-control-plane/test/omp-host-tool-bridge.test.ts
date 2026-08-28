import { describe, expect, it } from 'vitest'
import { HostToolAuthorityError, OmpHostToolAuthority } from '../src/omp-host-tool-authority.js'
import { OmpHostToolBridge } from '../src/omp-host-tool-bridge.js'
import {
  allowedArguments,
  authorityInput,
  budget,
  envelope,
  evidenceReadTool as tool,
  hostToolCall as call,
  now,
  parameters,
  policy
} from './omp-host-tool-fixture.js'

function resultCode(result: Awaited<ReturnType<OmpHostToolBridge['handleCall']>>): unknown {
  const details = result.result.details
  return details !== null &&
    typeof details === 'object' &&
    !Array.isArray(details) &&
    'code' in details
    ? details.code
    : undefined
}

describe('OMP host tool capability bridge', () => {
  it('exposes the digest-bound schema and executes one authorized current call', async () => {
    let starts = 0
    const authority = new OmpHostToolAuthority(authorityInput())
    const bridge = new OmpHostToolBridge({
      authority,
      tools: [
        tool((argumentsValue, context) => {
          starts += 1
          expect(context.reservation).toMatchObject({
            effectId: 'effect_s1',
            capabilityEnvelopeId: 'envelope_s1',
            policyDecisionId: 'policy_s1',
            use: 1
          })
          return argumentsValue
        })
      ]
    })

    expect(bridge.definitions()).toEqual([
      {
        name: 'evidence_read',
        label: 'Evidence read',
        description: 'Reads one admitted evidence item.',
        parameters
      }
    ])
    const result = await bridge.handleCall(call('host-1'), now)
    expect(result).toMatchObject({
      type: 'host_tool_result',
      id: 'host-1',
      result: { details: allowedArguments }
    })
    expect(result.isError).toBeUndefined()
    expect(authority.uses).toBe(1)
    expect(starts).toBe(1)
  })

  it('requires active attempt, registered tool, strict schema, capability, and allow policy', async () => {
    let starts = 0
    const inactive = new OmpHostToolBridge({
      authority: new OmpHostToolAuthority(
        authorityInput({ attempt: { ...authorityInput().attempt, status: 'terminal' } })
      ),
      tools: [tool(() => ++starts)]
    })
    expect(resultCode(await inactive.handleCall(call('inactive'), now))).toBe('attempt_not_active')

    const bridge = new OmpHostToolBridge({
      authority: new OmpHostToolAuthority(authorityInput()),
      tools: [tool(() => ++starts)]
    })
    expect(
      resultCode(await bridge.handleCall(call('unknown', allowedArguments, 'artifact_write'), now))
    ).toBe('unknown_tool')
    expect(resultCode(await bridge.handleCall(call('bad-schema', { unexpected: true }), now))).toBe(
      'invalid_arguments'
    )
    expect(starts).toBe(0)

    const deniedPolicy = policy({ decision: 'deny', grant: null })
    expect(
      () => new OmpHostToolAuthority(authorityInput({ policyDecision: deniedPolicy }))
    ).toThrowError(HostToolAuthorityError)
    const missingCapability = new OmpHostToolBridge({
      authority: new OmpHostToolAuthority(
        authorityInput({ capabilityEnvelope: envelope({ allowedTools: [] }) })
      ),
      tools: [tool(() => ++starts)]
    })
    expect(resultCode(await missingCapability.handleCall(call('not-allowed'), now))).toBe(
      'tool_not_allowed'
    )
    expect(starts).toBe(0)
  })

  it('binds exact arguments and enforces the minimum capability, policy, and budget use limit', async () => {
    let starts = 0
    const bridge = new OmpHostToolBridge({
      authority: new OmpHostToolAuthority(
        authorityInput({
          capabilityEnvelope: envelope({ budget: { ...budget, toolCallLimit: 1 } })
        })
      ),
      tools: [tool(() => ++starts)]
    })
    expect(
      resultCode(await bridge.handleCall(call('wrong-args', { evidenceId: 'evidence_other' }), now))
    ).toBe('parameter_mismatch')
    expect((await bridge.handleCall(call('first'), now)).isError).toBeUndefined()
    expect(resultCode(await bridge.handleCall(call('over-budget'), now))).toBe(
      'tool_budget_exhausted'
    )
    expect(starts).toBe(1)
  })

  it('never executes the same host correlation ID twice', async () => {
    let starts = 0
    const bridge = new OmpHostToolBridge({
      authority: new OmpHostToolAuthority(authorityInput()),
      tools: [tool(() => ++starts)]
    })
    await bridge.handleCall(call('duplicate'), now)
    expect(resultCode(await bridge.handleCall(call('duplicate'), now))).toBe('duplicate_call')
    expect(starts).toBe(1)
  })

  it('maps an OMP host_tool_cancel frame to the active call AbortSignal', async () => {
    const observedSignal = Promise.withResolvers<AbortSignal>()
    const bridge = new OmpHostToolBridge({
      authority: new OmpHostToolAuthority(authorityInput()),
      tools: [
        tool((_argumentsValue, context) => {
          observedSignal.resolve(context.signal)
          const pending = Promise.withResolvers<unknown>()
          context.signal.addEventListener('abort', () => pending.resolve({ ignored: true }), {
            once: true
          })
          return pending.promise
        })
      ]
    })
    const pendingResult = bridge.handleCall(call('cancel-target'), now)
    expect(
      bridge.handleCancel({
        type: 'host_tool_cancel',
        id: 'cancel-frame',
        targetId: 'cancel-target'
      })
    ).toBe(true)
    expect((await observedSignal.promise).aborted).toBe(true)
    expect(resultCode(await pendingResult)).toBe('tool_cancelled')
  })

  it('closes the start gate before cancellation or revocation acknowledgement returns', async () => {
    for (const mode of ['cancel', 'revoke'] as const) {
      let starts = 0
      const bridge = new OmpHostToolBridge({
        authority: new OmpHostToolAuthority(authorityInput()),
        tools: [tool(() => ++starts)]
      })
      const acknowledged =
        mode === 'cancel' ? bridge.acknowledgeCancellation(now) : bridge.revoke(now)
      expect(acknowledged).toBe(true)
      expect(mode === 'cancel' ? bridge.acknowledgeCancellation(now) : bridge.revoke(now)).toBe(
        false
      )
      expect(resultCode(await bridge.handleCall(call(`${mode}-after-ack`), now))).toBe(
        mode === 'cancel' ? 'attempt_cancelled' : 'capability_revoked'
      )
      expect(starts).toBe(0)
    }
  })
})
