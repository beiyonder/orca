import type { OmpWorkerContract } from './s1-fixture-contracts.js'

const REQUIRED_ALLOWED_TOOLS: Record<string, true> = {
  evidence_read: true,
  check_candidate_key: true,
  artifact_write: true
}

export function validateOmpWorkerContract(contract: OmpWorkerContract): string[] {
  const failures: string[] = []
  if (contract.requiredOmp.version !== '18.0.6') failures.push('required_version')
  if (contract.requiredOmp.sourceCommit !== 'b4e8e856ad40294167679a3f88417c07429fe59b') {
    failures.push('source_commit')
  }
  if (!contract.requiredOmp.protocolVersions.includes(2)) failures.push('protocol_v2')
  if (contract.requiredOmp.maxPhysicalFrameBytes !== 1024 * 1024) {
    failures.push('physical_frame_limit')
  }
  if (contract.requiredOmp.maxReassembledFrameBytes !== 64 * 1024 * 1024) {
    failures.push('reassembled_frame_limit')
  }

  const allowed = new Set(contract.allowedHostTools.map((tool) => tool.name))
  for (const required of Object.keys(REQUIRED_ALLOWED_TOOLS)) {
    if (!allowed.has(required)) failures.push(`allowed_tool:${required}`)
  }
  if (contract.allowedHostTools.some((tool) => !tool.strict)) failures.push('non_strict_tool')
  if (contract.forbiddenTools.some((tool) => allowed.has(tool))) {
    failures.push('allowed_forbidden_overlap')
  }
  if (contract.output.schemaMode !== 'strict') failures.push('schema_mode')
  if (contract.cancellation.processExitImpliesAcceptance !== false) {
    failures.push('process_exit_acceptance')
  }
  const skew = contract.versionSkewCases.find((entry) => entry.observedVersion === '18.0.4')
  if (skew?.expected !== 'reject-until-probed') failures.push('version_skew_guard')
  return failures
}
