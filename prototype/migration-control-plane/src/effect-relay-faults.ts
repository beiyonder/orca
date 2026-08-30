export type EffectRelayFaultPoint =
  | 'before_capability'
  | 'after_capability'
  | 'before_prepare'
  | 'after_prepare'
  | 'before_send'
  | 'after_send'
  | 'before_receipt'
  | 'after_receipt'
  | 'before_ack'
  | 'after_ack'

export type EffectRelayFaultHook = (point: EffectRelayFaultPoint) => void | Promise<void>
