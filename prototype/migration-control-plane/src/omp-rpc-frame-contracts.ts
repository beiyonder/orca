import { z } from 'zod'
import { JsonValueSchema } from './domain/common-contracts.js'

const FrameIdSchema = z.string().min(1).max(256)
const FrameTypeSchema = z.looseObject({ type: z.string().min(1).max(128) })

export const OmpRpcChunkSchema = z.strictObject({
  type: z.literal('rpc_chunk'),
  chunkId: z.string().min(1).max(128),
  index: z.number().int().nonnegative(),
  count: z.number().int().min(2).max(256),
  byteLength: z
    .number()
    .int()
    .positive()
    .max(64 * 1024 * 1024),
  data: z
    .string()
    .min(1)
    .max(512 * 1024)
})

const ReadyFrameSchema = z.strictObject({
  type: z.literal('ready'),
  protocolVersion: z.literal(1),
  supportedProtocolVersions: z.tuple([z.literal(1), z.literal(2)]),
  maxFrameBytes: z.literal(1024 * 1024),
  maxReassembledFrameBytes: z.literal(64 * 1024 * 1024)
})

const SuccessResponseSchema = z.strictObject({
  id: FrameIdSchema.optional(),
  type: z.literal('response'),
  command: z.string().min(1).max(128),
  success: z.literal(true),
  data: JsonValueSchema.optional()
})

const FailureResponseSchema = z.strictObject({
  id: FrameIdSchema.optional(),
  type: z.literal('response'),
  command: z.string().min(1).max(128),
  success: z.literal(false),
  error: z.string().min(1).max(32_768),
  code: z.string().min(1).max(128).optional()
})

const HostToolCallSchema = z.strictObject({
  type: z.literal('host_tool_call'),
  id: FrameIdSchema,
  toolCallId: FrameIdSchema,
  toolName: z.string().min(1).max(128),
  arguments: z.record(z.string().min(1).max(128), JsonValueSchema)
})

const HostToolCancelSchema = z.strictObject({
  type: z.literal('host_tool_cancel'),
  id: FrameIdSchema,
  targetId: FrameIdSchema
})

const RpcFrameErrorSchema = z.strictObject({
  type: z.literal('rpc_frame_error'),
  originalType: z.string().min(1).max(1_024).optional(),
  error: z.string().min(1).max(32_768)
})

const ExtensionErrorSchema = z.strictObject({
  type: z.literal('extension_error'),
  extensionPath: z.string().min(1).max(4_096),
  event: z.string().min(1).max(256),
  error: z.string().min(1).max(32_768)
})

const EVENT_TYPES = [
  'agent_start',
  'agent_end',
  'turn_start',
  'turn_end',
  'message_start',
  'message_update',
  'message_end',
  'tool_execution_start',
  'tool_execution_update',
  'tool_execution_end',
  'auto_compaction_start',
  'auto_compaction_end',
  'auto_retry_start',
  'auto_retry_end',
  'retry_fallback_applied',
  'retry_fallback_succeeded',
  'model_changed',
  'advisor_cost_changed',
  'ttsr_triggered',
  'todo_reminder',
  'todo_auto_clear',
  'irc_message',
  'notice',
  'thinking_level_changed',
  'goal_updated',
  'subagent_lifecycle',
  'subagent_progress',
  'subagent_event',
  'extension_ui_request',
  'available_commands_update',
  'prompt_result'
] as const

const EventFrameSchema = z.object({ type: z.enum(EVENT_TYPES) }).catchall(JsonValueSchema)

export type OmpRpcChunk = z.infer<typeof OmpRpcChunkSchema>
export type OmpRpcFrame =
  | { category: 'ready'; value: z.infer<typeof ReadyFrameSchema> }
  | { category: 'response'; value: z.infer<typeof SuccessResponseSchema> }
  | { category: 'error'; value: z.infer<typeof FailureResponseSchema> }
  | { category: 'event'; value: z.infer<typeof EventFrameSchema> }
  | { category: 'host-tool-call'; value: z.infer<typeof HostToolCallSchema> }
  | { category: 'host-tool-cancel'; value: z.infer<typeof HostToolCancelSchema> }
  | {
      category: 'error'
      value: z.infer<typeof RpcFrameErrorSchema> | z.infer<typeof ExtensionErrorSchema>
    }

export function classifyOmpRpcFrame(input: unknown): OmpRpcFrame {
  const type = FrameTypeSchema.parse(input).type
  if (type === 'ready') {
    return { category: 'ready', value: ReadyFrameSchema.parse(input) }
  }
  if (type === 'response') {
    const response = z
      .discriminatedUnion('success', [SuccessResponseSchema, FailureResponseSchema])
      .parse(input)
    return response.success
      ? { category: 'response', value: response }
      : { category: 'error', value: response }
  }
  if (type === 'host_tool_call') {
    return { category: 'host-tool-call', value: HostToolCallSchema.parse(input) }
  }
  if (type === 'host_tool_cancel') {
    return { category: 'host-tool-cancel', value: HostToolCancelSchema.parse(input) }
  }
  if (type === 'rpc_frame_error') {
    return { category: 'error', value: RpcFrameErrorSchema.parse(input) }
  }
  if (type === 'extension_error') {
    return { category: 'error', value: ExtensionErrorSchema.parse(input) }
  }
  return { category: 'event', value: EventFrameSchema.parse(input) }
}
