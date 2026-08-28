import { describe, expect, it } from 'vitest'
import { canonicalJson, sha256Text } from '../src/canonical-json.js'
import {
  ApexNextActionError,
  ApexNextActionProposalSchema,
  createApexMissionSnapshot,
  runApexNextAction
} from '../src/apex-next-action-loop.js'
import { specialistAssignment } from './specialist-agent-fixture.js'

const createdAt = '2026-01-01T00:02:00.000Z'
const remainingBudget = {
  tokenLimit: 20_000,
  timeLimitMs: 300_000,
  toolCallLimit: 16,
  outputByteLimit: 1_000_000,
  costLimitUsd: 20
}

function snapshot(overrides: Record<string, unknown> = {}) {
  return createApexMissionSnapshot({
    schemaVersion: 1,
    tenantId: 'tenant_s1',
    missionId: 'mission_s1',
    missionRevision: 7,
    activePlanRevisionId: 'plan_s1',
    acceptedEvidenceIds: ['evidence_document', 'evidence_profile'],
    openGaps: [
      {
        gapId: 'gap_identity_key',
        question: 'Which source identity key is stable and unique?',
        severity: 'blocker',
        blocking: true
      }
    ],
    readyTaskIds: ['task_mapping'],
    activeAssignmentIds: [],
    availableSpecialistRoles: ['mapping', 'research'],
    activeEffectIds: [],
    pendingEvaluationIds: [],
    remainingBudget,
    ...overrides
  })
}

function dispatchProposal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    type: 'apex_next_action',
    baseMissionRevision: 7,
    evidenceIds: ['evidence_document', 'evidence_profile'],
    assumptions: ['The synthetic profile covers the fixture rows.'],
    unresolvedUncertainty: ['Production distribution is unknown.'],
    rationale: 'The blocker needs a bounded mapping specialist before a decision can be proposed.',
    action: {
      kind: 'dispatch-specialist',
      gapIds: ['gap_identity_key'],
      assignment: specialistAssignment('mapping')
    },
    ...overrides
  }
}

function run(snapshotInput: unknown, proposal: unknown, currentMissionRevision = 7) {
  return runApexNextAction({
    snapshot: snapshotInput,
    proposal,
    currentMissionRevision,
    recordId: 'decision_next_action',
    createdAt
  })
}

function expectApexError(operation: () => unknown, code: string): void {
  try {
    operation()
    throw new Error('Expected apex next-action error')
  } catch (error) {
    if (!(error instanceof ApexNextActionError)) {
      throw error
    }
    expect(error.code).toBe(code)
  }
}

describe('apex next-action loop', () => {
  it('creates a reproducible digest-bound mission snapshot', () => {
    const first = snapshot()
    const second = snapshot()
    expect(first).toEqual(second)
    const { snapshotDigest, ...body } = first
    expect(snapshotDigest).toBe(sha256Text(canonicalJson(body)))
  })

  it('admits exactly one bounded specialist dispatch and records only a proposal', () => {
    const current = snapshot()
    const before = canonicalJson(current)
    const output = run(current, dispatchProposal())
    expect(output.dispatch).toMatchObject({
      role: 'mapping',
      assignmentId: 'assignment_mapping',
      authority: { mode: 'proposal-only' }
    })
    expect(output.record).toMatchObject({
      id: 'decision_next_action',
      tenantId: 'tenant_s1',
      missionId: 'mission_s1',
      baseMissionRevision: 7,
      snapshotDigest: current.snapshotDigest,
      status: 'proposed',
      authority: 'reconciler-required',
      action: { kind: 'dispatch-specialist' }
    })
    expect(output.record.proposalDigest).toBe(
      sha256Text(canonicalJson(ApexNextActionProposalSchema.parse(dispatchProposal())))
    )
    expect(canonicalJson(current)).toBe(before)
  })

  it('rejects stale mission revisions and tampered snapshots', () => {
    const current = snapshot()
    expectApexError(() => run(current, dispatchProposal(), 8), 'stale_mission_revision')
    expectApexError(
      () => run({ ...current, snapshotDigest: 'f'.repeat(64) }, dispatchProposal()),
      'snapshot_digest_mismatch'
    )
  })

  it('rejects unavailable evidence and gaps before dispatch', () => {
    const current = snapshot()
    expectApexError(
      () => run(current, dispatchProposal({ evidenceIds: ['evidence_other'] })),
      'evidence_out_of_scope'
    )
    const proposal = dispatchProposal()
    const action = proposal.action as Record<string, unknown>
    expectApexError(
      () => run(current, { ...proposal, action: { ...action, gapIds: ['gap_other'] } }),
      'gap_not_open'
    )
  })

  it('rejects unavailable, duplicate, over-budget, and contract-invalid specialist dispatches', () => {
    const current = snapshot()
    const baseProposal = dispatchProposal()
    const baseAction = baseProposal.action as Record<string, unknown>
    const baseAssignment = baseAction.assignment as Record<string, unknown>
    const cases: {
      snapshot: unknown
      code: string
      changedAssignment?: Record<string, unknown>
    }[] = [
      {
        snapshot: snapshot({ availableSpecialistRoles: ['research'] }),
        code: 'specialist_unavailable'
      },
      {
        snapshot: snapshot({ activeAssignmentIds: ['assignment_mapping'] }),
        code: 'assignment_already_active'
      },
      {
        snapshot: current,
        code: 'mission_budget_exceeded',
        changedAssignment: {
          ...baseAssignment,
          budget: { ...remainingBudget, tokenLimit: 20_001 }
        }
      },
      {
        snapshot: current,
        code: 'invalid_specialist_dispatch',
        changedAssignment: { ...baseAssignment, allowedTools: [] }
      }
    ]

    for (const testCase of cases) {
      const proposal =
        testCase.changedAssignment === undefined
          ? baseProposal
          : {
              ...baseProposal,
              action: { ...baseAction, assignment: testCase.changedAssignment }
            }
      expectApexError(() => run(testCase.snapshot, proposal), testCase.code)
    }
  })

  it('records a probe request without dispatching or committing a finding', () => {
    const proposal = dispatchProposal({
      evidenceIds: ['evidence_profile'],
      action: {
        kind: 'request-probe',
        gapId: 'gap_identity_key',
        probeKey: 'candidate-key-uniqueness',
        question: 'Is patient_num unique across facilities?',
        expectedOutcomes: ['unique', 'duplicate'],
        cost: 0
      }
    })
    const output = run(snapshot(), proposal)
    expect(output.dispatch).toBeNull()
    expect(output.record).toMatchObject({
      status: 'proposed',
      authority: 'reconciler-required',
      action: { kind: 'request-probe', gapId: 'gap_identity_key' }
    })
    expect(output.record).not.toHaveProperty('acceptedFinding')
  })
})
