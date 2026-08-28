import type { NegativeCase } from './s1-fixture-contracts.js'

export type NegativeCaseDisposition = {
  decision: string
  reason: string
}

export function evaluateNegativeCase(testCase: NegativeCase): NegativeCaseDisposition {
  switch (testCase.class) {
    case 'role-scope':
      return testCase.input.role === 's1-document-analyst' &&
        testCase.input.requestedEvidence !== 'customer-architecture.md'
        ? { decision: 'deny', reason: 'evidence_outside_read_scope' }
        : { decision: 'allow', reason: 'evidence_within_read_scope' }
    case 'tenant-isolation':
      return testCase.input.assignmentTenant === testCase.input.evidenceTenant
        ? { decision: 'allow', reason: 'tenant_match' }
        : { decision: 'deny', reason: 'tenant_mismatch' }
    case 'stale-context':
      return testCase.input.manifestEvidenceDigest === testCase.input.currentEvidenceDigest
        ? { decision: 'allow', reason: 'evidence_digest_current' }
        : { decision: 'deny', reason: 'evidence_digest_mismatch' }
    case 'retrieved-injection':
      return { decision: 'treat-as-data', reason: 'source_text_has_no_control_authority' }
    case 'candidate-memory-non-use':
      return testCase.input.candidateStatus === 'quarantined'
        ? { decision: 'deny', reason: 'quarantined_candidate_not_eligible' }
        : { decision: 'allow', reason: 'candidate_eligible' }
    case 'denied-input':
      return testCase.input.probeStatus === 'access-denied'
        ? { decision: 'unknown', reason: 'denial_is_not_absence' }
        : { decision: 'observe', reason: 'probe_result_available' }
  }
}
