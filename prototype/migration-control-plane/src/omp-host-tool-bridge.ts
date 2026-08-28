import type { z } from 'zod'
import { canonicalJson, sha256Text, type JsonValue } from './canonical-json.js'
import { JsonValueSchema } from './domain/common-contracts.js'
import {
  HostToolAuthorityError,
  type OmpHostToolAuthority,
  type HostToolReference,
  type HostToolReservation
} from './omp-host-tool-authority.js'
import type { OmpHostToolCall, OmpHostToolCancel } from './omp-rpc-frame-contracts.js'

export type OmpHostToolDefinition = {
  reference: HostToolReference
  label?: string
  description: string
  parameters: Record<string, unknown>
  parameterSchema: z.ZodType
  execute: (
    argumentsValue: unknown,
    context: { signal: AbortSignal; reservation: HostToolReservation; toolCallId: string }
  ) => unknown
}

export type OmpRpcHostToolDefinition = {
  name: string
  label?: string
  description: string
  parameters: Record<string, unknown>
}

export type OmpHostToolResultFrame = {
  type: 'host_tool_result'
  id: string
  result: {
    content: readonly [{ type: 'text'; text: string }]
    details?: JsonValue
    isError?: boolean
  }
  isError?: boolean
}

export type OmpHostToolBridgeOptions = {
  authority: OmpHostToolAuthority
  tools: readonly OmpHostToolDefinition[]
  maxResultBytes?: number
}

function errorFrame(id: string, code: string, message: string): OmpHostToolResultFrame {
  return {
    type: 'host_tool_result',
    id,
    result: {
      content: [{ type: 'text', text: canonicalJson({ code, message }) }],
      details: { code, message },
      isError: true
    },
    isError: true
  }
}

function successFrame(id: string, value: JsonValue): OmpHostToolResultFrame {
  return {
    type: 'host_tool_result',
    id,
    result: {
      content: [{ type: 'text', text: canonicalJson(value) }],
      details: value
    }
  }
}

export class OmpHostToolBridge {
  readonly #authority: OmpHostToolAuthority
  readonly #tools = new Map<string, OmpHostToolDefinition>()
  readonly #seenCallIds = new Set<string>()
  readonly #active = new Map<string, AbortController>()
  readonly #maxResultBytes: number
  #stoppedReason: 'attempt_cancelled' | 'capability_revoked' | null = null

  constructor(options: OmpHostToolBridgeOptions) {
    this.#authority = options.authority
    this.#maxResultBytes = options.maxResultBytes ?? 1024 * 1024
    if (!Number.isSafeInteger(this.#maxResultBytes) || this.#maxResultBytes <= 0) {
      throw new RangeError('maxResultBytes must be a positive safe integer')
    }
    for (const tool of options.tools) {
      const { name, schemaDigest } = tool.reference
      if (this.#tools.has(name)) {
        throw new TypeError(`Duplicate host tool: ${name}`)
      }
      if (sha256Text(canonicalJson(tool.parameters)) !== schemaDigest) {
        throw new TypeError(`Host tool schema digest differs: ${name}`)
      }
      this.#tools.set(name, tool)
    }
  }

  definitions(): readonly OmpRpcHostToolDefinition[] {
    return [...this.#tools.values()].map((tool) => ({
      name: tool.reference.name,
      ...(tool.label === undefined ? {} : { label: tool.label }),
      description: tool.description,
      parameters: tool.parameters
    }))
  }

  async handleCall(call: OmpHostToolCall, now: string): Promise<OmpHostToolResultFrame> {
    if (this.#seenCallIds.has(call.id)) {
      return errorFrame(call.id, 'duplicate_call', 'Host tool call ID was already observed')
    }
    this.#seenCallIds.add(call.id)
    if (this.#stoppedReason !== null) {
      return errorFrame(call.id, this.#stoppedReason, 'Host tool bridge is stopped')
    }
    const tool = this.#tools.get(call.toolName)
    if (tool === undefined) {
      return errorFrame(call.id, 'unknown_tool', 'Host tool is not registered')
    }
    let parsedArguments: unknown
    try {
      parsedArguments = tool.parameterSchema.parse(call.arguments)
    } catch {
      return errorFrame(call.id, 'invalid_arguments', 'Host tool arguments do not match the schema')
    }
    let reservation: HostToolReservation
    try {
      reservation = this.#authority.reserve({
        now,
        tool: tool.reference,
        parameterDigest: sha256Text(canonicalJson(parsedArguments))
      })
    } catch (error) {
      if (error instanceof HostToolAuthorityError) {
        return errorFrame(call.id, error.code, error.message)
      }
      throw error
    }
    const controller = new AbortController()
    this.#active.set(call.id, controller)
    try {
      const rawResult = await tool.execute(parsedArguments, {
        signal: controller.signal,
        reservation,
        toolCallId: call.toolCallId
      })
      if (controller.signal.aborted) {
        return errorFrame(call.id, 'tool_cancelled', 'Host tool call was cancelled')
      }
      let result: JsonValue
      try {
        result = JsonValueSchema.parse(rawResult)
      } catch {
        return errorFrame(call.id, 'invalid_tool_result', 'Host tool returned a non-JSON result')
      }
      if (Buffer.byteLength(canonicalJson(result)) > this.#maxResultBytes) {
        return errorFrame(
          call.id,
          'tool_result_too_large',
          'Host tool result exceeds the bridge limit'
        )
      }
      return successFrame(call.id, result)
    } catch (error) {
      if (controller.signal.aborted) {
        return errorFrame(call.id, 'tool_cancelled', 'Host tool call was cancelled')
      }
      return errorFrame(
        call.id,
        'tool_failed',
        error instanceof Error ? error.message : 'Host tool failed'
      )
    } finally {
      this.#active.delete(call.id)
    }
  }

  handleCancel(frame: OmpHostToolCancel): boolean {
    const controller = this.#active.get(frame.targetId)
    if (controller === undefined || controller.signal.aborted) {
      return false
    }
    controller.abort(new Error(`OMP cancelled host tool through ${frame.id}`))
    return true
  }

  acknowledgeCancellation(at: string): boolean {
    if (this.#stoppedReason === null) {
      this.#stoppedReason = 'attempt_cancelled'
    }
    const acknowledged = this.#authority.acknowledgeCancellation(at)
    this.#abortActive('Attempt cancellation acknowledged')
    return acknowledged
  }

  revoke(at: string): boolean {
    if (this.#stoppedReason === null) {
      this.#stoppedReason = 'capability_revoked'
    }
    const acknowledged = this.#authority.revoke(at)
    this.#abortActive('Capability revocation acknowledged')
    return acknowledged
  }

  #abortActive(message: string): void {
    for (const controller of this.#active.values()) {
      if (!controller.signal.aborted) {
        controller.abort(new Error(message))
      }
    }
  }
}
