import { sha256Text } from './canonical-json.js'
import type { EffectRelayDispatch } from './effect-relay-gateway.js'
import type { MarkerEffectRequest } from './postgres-marker-target-adapter.js'

export const MARKER_RUNNER_SOURCE = `
if (
  typeof input !== "object" || input === null ||
  input.operation !== "ensure-marker" ||
  typeof input.request !== "object" || input.request === null
) {
  throw new TypeError("invalid marker runner input")
}
const request = input.request
if (
  typeof request.tenantId !== "string" ||
  typeof request.effectId !== "string" ||
  typeof request.markerKey !== "string" ||
  typeof request.subjectVersion !== "string"
) {
  throw new TypeError("invalid marker request")
}
output = JSON.parse(JSON.stringify(request))
`.trim()

export const MARKER_RUNNER_DIGEST = sha256Text(MARKER_RUNNER_SOURCE)

export function markerRequest(dispatch: EffectRelayDispatch): MarkerEffectRequest {
  const parameters = dispatch.intent.parameters
  if (typeof parameters !== 'object' || parameters === null || Array.isArray(parameters)) {
    throw new TypeError('Marker parameters must be an object')
  }
  const markerKey = parameters.markerKey
  const value = parameters.value
  if (typeof markerKey !== 'string' || value === undefined) {
    throw new TypeError('Marker parameters require markerKey and value')
  }
  return {
    tenantId: dispatch.tenantId,
    effectId: dispatch.effectId,
    markerKey,
    value,
    subjectVersion: dispatch.intent.authority.subjectVersion
  }
}
