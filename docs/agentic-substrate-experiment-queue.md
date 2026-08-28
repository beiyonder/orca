# Agentic-Substrate Executable Experiment Queue

## Coordinate

`P1-RSCH-16` — consolidate research experiments into one dependency-ordered execution contract.

## Current state

- Queue schema and runner contract: `IMPLEMENTED` for the Phase 2 baseline.
- Experiment runner: `prototype/migration-control-plane/scripts/migration-control-plane-lab.mjs`, implemented by `P2-LAB-12`.
- Runtime: Node 24+ with strict TypeScript; OMP/DBOS/Inspect remain process-isolated worker/challenger runtimes.
- First dependency-ready roadmap coordinate: `P3-KERN-11`.
- `G2-LAB` and `P3-KERN-01` through `P3-KERN-10` verification are complete; replay/restart/convergence and all later experiments remain specified/deferred.
- Source research cards remain the authoritative fixture and pass/fail specifications.

This queue contains all 70 experiments defined by the eight Phase 1 research cards plus six integration/harness experiments introduced by the code audits, gap decisions and S1 contract.

## `G2-LAB` execution evidence

Local sealed runs under ignored `.runs/`:

| Experiment | Seed | Status | Run ID |
| --- | ---: | --- | --- |
| `BASELINE-EXP-01` | 204 | `passed` | `baseline-exp-01-204-baseline-none-run_000000_fac5e8ac236c1090` |
| `LAB-EXP-01` | 205 | `passed` | `lab-exp-01-205-baseline-none-run_000000_121b6d9ce7649417` |
| `S1-FIXTURE-EXP-01` | 206 | `passed` | `s1-fixture-exp-01-206-baseline-none-run_000000_bc28d1ef6d576c92` |
| `WORKER-EXP-01` | 207 | `inconclusive` | `worker-exp-01-207-baseline-none-run_000000_980daf1e78f39ccb` |

`WORKER-EXP-01` remains inconclusive by design: its P2 fixture is valid, but the real pinned OMP binary RPC/schema/cancel/artifact path has not run.

Gate verification:

- frozen setup passed;
- formatting, lint, strict typecheck and build passed;
- 6 test files / 22 tests passed;
- same-seed outputs replay byte-for-byte;
- all 14 named fault points preserve sealed inspectable failed runs;
- artifact SHA-256 indexes detect modification;
- non-agent baseline passes six hard mapping measures with zero model calls/effects.

## `P3-KERN-01` contract evidence

- exact `zod 4.4.3` runtime dependency isolated in the lab;
- 41 strict V1 runtime schemas and 41 deterministic Draft 2020-12 files;
- registry digest `c625dd7c6ea4d45dfb98d477959681f85bea23c314ef23e2237ce615c3948164`;
- 41 canonical samples parse;
- all 41 reject unknown top-level fields and schema version 2;
- full record-set admission rejects duplicate IDs, tenant mismatch, and mission mismatch;
- 18 targeted tests cover authority, lineage, time, verdict, correction, learning, idempotency, capability, receipt, recovery, and compensation invariants;
- complete lab verification passes 8 test files / 46 tests plus generated-schema drift check.

## `P3-KERN-02` migration evidence

- exact `pg 8.23.0` runtime dependency and direct SQL transaction boundary;
- PostgreSQL 16 baseline with three contiguous checksum-locked migrations;
- 16 tables covering schema/contract metadata, domain records, mission authority, events/projections, delivery, plans/tasks/attempts/effects, and recovery;
- empty and migration-001 upgrade paths converge to fingerprint `48406f183d566eeb66ec2f21d7ba1009d8a89e203be20c0ea6d614918d82b74b`;
- concurrent migrators serialize, reapplication is inert, and changed applied bytes fail;
- real PostgreSQL integration verification passes 1 file / 4 tests.

## `P3-KERN-03` through `P3-KERN-06` atomic persistence evidence

- canonical full-command identity, sequential/concurrent replay, mismatch rejection, durable deterministic rejection, and retry after unknown failure;
- advisory/row-locked expected-version append with one winner under contention;
- one transaction owns command result, aggregate, event, projection, and outbox;
- outbox/projection failure paths prove no partial authoritative transition;
- `SKIP LOCKED` outbox claims, expiring leases/fences, stale acknowledgement rejection, delayed retry, and acknowledgement replay;
- tenant/consumer/message inbox serialization with one handler outcome, payload mismatch rejection, and handler rollback;
- real PostgreSQL verification passes 4 files / 19 tests.

## `P3-KERN-07` through `P3-KERN-10` lifecycle authority evidence

- complete materialized DAG admission rejects missing/cyclic/incompatible/unrecoverable task edges and stale plan bases;
- task and assignment-attempt state transitions preserve immutable identity, revision order, and active authority;
- concurrent task claim admits one attempt/fence; rival and expired output cannot advance state;
- migration 004 adds the dedicated effect-attempt table and `reconciling` state;
- effect parameter, attempt/fence, receipt, observation, and evaluation lineage gates explicit prepared-to-terminal transitions;
- schema v4: 17 tables and fingerprint `97a92746b9eb9b4fa014436c8829b4c0f4081ef2496c29ed00bf225d2a1efd4b`;
- verification passes 10 unit files / 57 tests and 6 PostgreSQL files / 25 tests.

## Queue classes

| Class | Meaning |
| --- | --- |
| `S1-GATE` | Must pass before Slice S1 is accepted. |
| `CHALLENGER` | Runs only against a completed baseline; cannot authorize dependency adoption by itself. |
| `POST-S1` | Important next capability proof but not required for S1. |
| `TRIGGERED` | Runs only when its documented deferred-register trigger fires. |
| `PRE-EFFECT` | Must pass before the first non-production external target effect. |

## Execution contract

The stable runner uses:

```text
node prototype/migration-control-plane/scripts/migration-control-plane-lab.mjs experiment run \
  --experiment <ID> \
  --seed <integer> \
  --arm <baseline|candidate> \
  --fault <none|named-kill-point> \
  --output <run-directory>
```

The stable Node entry delegates to the compiled TypeScript runner; future OMP/DBOS/Inspect arms remain separate processes and must preserve the semantic arguments.

Contract generation and drift verification use:

```text
node prototype/migration-control-plane/scripts/migration-control-plane-lab.mjs contracts generate
node prototype/migration-control-plane/scripts/migration-control-plane-lab.mjs contracts check
node prototype/migration-control-plane/scripts/migration-control-plane-lab.mjs database migrate
node prototype/migration-control-plane/scripts/migration-control-plane-lab.mjs database fingerprint
node prototype/migration-control-plane/scripts/migration-control-plane-lab.mjs database verify
```

Every run directory must contain:

```text
manifest.json              experiment/spec/seed/arm/fault/environment versions
evidence/                  pinned fixture/source artifacts and checksums
inputs/                    canonical commands/contexts/contracts
outputs/                   subject artifacts, receipts and projections
events.jsonl               authoritative events or normalized transition trace
worker/                    OMP protocol/session/transcript/artifact refs
metrics.json               named measures, units, samples and uncertainty
verdict.json               every hard predicate and final pass/fail/inconclusive
faults.jsonl               injected kill/failure and recovery dispositions
usage.json                 time/model/tool/token/cost/resource attribution
```

Rules:

- one run ID and immutable manifest;
- deterministic clock/IDs/fault schedule from seed for non-model state;
- exact fixture/license/version/checksum;
- exact source commit, OMP executable/protocol, model, tool, skill and evaluator versions;
- no overwritten output across arms/seeds;
- hard-predicate failure cannot be averaged away;
- unavailable/inconclusive is not pass;
- challenger and baseline use the same product contract/fixture/evaluator;
- secrets and real customer data are prohibited in Phase 2/S1 artifacts;
- clean-machine rerun command is recorded.

## Dependency waves

### Wave 0 — Lab boundary and fixed S1 fixture

| ID | Experiment | Queue class | Depends on | Source contract |
| --- | --- | --- | --- | --- |
| `LAB-EXP-01` | Deterministic runner and artifact contract | `S1-GATE` | `P2-LAB-01/02/03/05/12` | `docs/healthcare-prototype-roadmap.md` |
| `WORKER-EXP-01` | Pinned OMP worker contract probe | `S1-GATE` | `LAB-EXP-01` | `docs/agentic-substrate-omp-audit.md` |
| `S1-FIXTURE-EXP-01` | Identity-key fixture and evaluator calibration | `S1-GATE` | `LAB-EXP-01` | `docs/agentic-substrate-s1-implementation-plan.md` |
| `BASELINE-EXP-01` | Non-agent identity-mapping baseline | `S1-GATE` | `S1-FIXTURE-EXP-01` | `docs/agentic-substrate-s1-implementation-plan.md` |

### Wave 1 — Durable authority

| ID | Experiment | Queue class | Depends on | Source contract |
| --- | --- | --- | --- | --- |
| `DUR-EXP-01` | Explicit PostgreSQL state machine | `S1-GATE` | `LAB-EXP-01` | `docs/agentic-substrate-durable-state-research.md` |
| `DUR-EXP-02` | DBOS challenger | `CHALLENGER` | `DUR-EXP-01` | `docs/agentic-substrate-durable-state-research.md` |
| `DUR-EXP-03` | Temporal reference spike only if needed | `TRIGGERED` | `DUR-EXP-01` failure/trigger | `docs/agentic-substrate-durable-state-research.md` |
| `DUR-EXP-04` | External unknown effect | `PRE-EFFECT` | effect adapter + `ACT-EXP-01` | `docs/agentic-substrate-durable-state-research.md` |
| `DUR-EXP-05` | Adaptive replan across crash | `S1-GATE` | `DUR-EXP-01` | `docs/agentic-substrate-durable-state-research.md` |

### Wave 2 — Epistemic state

| ID | Experiment | Queue class | Depends on | Source contract |
| --- | --- | --- | --- | --- |
| `EPI-EXP-01` | Contradictory estate understanding | `S1-GATE` | `DUR-EXP-01` | `docs/agentic-substrate-epistemic-state-research.md` |
| `EPI-EXP-02` | Stale evidence invalidation | `S1-GATE` | `EPI-EXP-01` | `docs/agentic-substrate-epistemic-state-research.md` |
| `EPI-EXP-03` | Access denial is not absence | `POST-S1` | `EPI-EXP-01` | `docs/agentic-substrate-epistemic-state-research.md` |
| `EPI-EXP-04` | Untrusted source injection | `S1-GATE` | `EPI-EXP-01` | `docs/agentic-substrate-epistemic-state-research.md` |
| `EPI-EXP-05` | Probe choice quality | `S1-GATE` | `EPI-EXP-01` | `docs/agentic-substrate-epistemic-state-research.md` |
| `EPI-EXP-06` | Uncertainty and abstention | `POST-S1` | `EPI-EXP-01` | `docs/agentic-substrate-epistemic-state-research.md` |
| `EPI-EXP-07` | Tenant and scope isolation | `S1-GATE` | `EPI-EXP-01` | `docs/agentic-substrate-epistemic-state-research.md` |

### Wave 3 — Context compiler

| ID | Experiment | Queue class | Depends on | Source contract |
| --- | --- | --- | --- | --- |
| `CTX-EXP-01` | Manifest reproducibility | `S1-GATE` | `EPI-EXP-01` | `docs/agentic-substrate-context-research.md` |
| `CTX-EXP-02` | Tenant, scope, and data-class isolation | `S1-GATE` | `CTX-EXP-01` | `docs/agentic-substrate-context-research.md` |
| `CTX-EXP-03` | Known-answer retrieval and coverage | `S1-GATE` | `CTX-EXP-01` | `docs/agentic-substrate-context-research.md` |
| `CTX-EXP-04` | Citation validity, correctness, and completeness | `S1-GATE` | `CTX-EXP-01` | `docs/agentic-substrate-context-research.md` |
| `CTX-EXP-05` | Stale mission context | `S1-GATE` | `CTX-EXP-01` | `docs/agentic-substrate-context-research.md` |
| `CTX-EXP-06` | Retrieved prompt injection | `S1-GATE` | `CTX-EXP-01` | `docs/agentic-substrate-context-research.md` |
| `CTX-EXP-07` | Compaction preservation | `S1-GATE` | `WORKER-EXP-01` + `CTX-EXP-01` | `docs/agentic-substrate-context-research.md` |
| `CTX-EXP-08` | Live research provenance | `POST-S1` | `CTX-EXP-01` | `docs/agentic-substrate-context-research.md` |
| `CTX-EXP-09` | Packing order and context ablation | `POST-S1` | `CTX-EXP-03` | `docs/agentic-substrate-context-research.md` |
| `CTX-EXP-10` | Retrieval backend substitution | `TRIGGERED` | `CTX-EXP-03` baseline failure | `docs/agentic-substrate-context-research.md` |

### Wave 4 — Specialist orchestration

| ID | Experiment | Queue class | Depends on | Source contract |
| --- | --- | --- | --- | --- |
| `ORCH-EXP-01` | Apex crash and replacement | `S1-GATE` | `WORKER-EXP-01` + `DUR-EXP-01` + `CTX-EXP-01` | `docs/agentic-substrate-orchestration-research.md` |
| `ORCH-EXP-02` | Specialist disagreement | `S1-GATE` | `EPI-EXP-01` + `ORCH-EXP-01` | `docs/agentic-substrate-orchestration-research.md` |
| `ORCH-EXP-03` | Duplicate and stale specialist result | `S1-GATE` | `ORCH-EXP-01` | `docs/agentic-substrate-orchestration-research.md` |
| `ORCH-EXP-04` | Parallel ownership | `S1-GATE` | `ORCH-EXP-01` | `docs/agentic-substrate-orchestration-research.md` |
| `ORCH-EXP-05` | Stall, livelock, and budget | `S1-GATE` | `ORCH-EXP-01` | `docs/agentic-substrate-orchestration-research.md` |
| `ORCH-EXP-06` | Model and worker substitution | `POST-S1` | `ORCH-EXP-01` | `docs/agentic-substrate-orchestration-research.md` |
| `ORCH-EXP-07` | Nested spawn containment | `POST-S1` | `ORCH-EXP-01` | `docs/agentic-substrate-orchestration-research.md` |
| `ORCH-EXP-08` | False completion | `S1-GATE` | `ORCH-EXP-01` + evaluator gate | `docs/agentic-substrate-orchestration-research.md` |

### Wave 5 — Evaluation and correction

| ID | Experiment | Queue class | Depends on | Source contract |
| --- | --- | --- | --- | --- |
| `EVAL-EXP-01` | Critical and benign mutations | `S1-GATE` | `DUR-EXP-01` + `S1-FIXTURE-EXP-01` | `docs/agentic-substrate-evaluation-research.md` |
| `EVAL-EXP-02` | Evaluator outage and disagreement | `S1-GATE` | `EVAL-EXP-01` | `docs/agentic-substrate-evaluation-research.md` |
| `EVAL-EXP-03` | Producer/evaluator separation | `S1-GATE` | `EVAL-EXP-01` + `WORKER-EXP-01` | `docs/agentic-substrate-evaluation-research.md` |
| `EVAL-EXP-04` | Closed correction with fixed contract | `S1-GATE` | `EVAL-EXP-01` + `ORCH-EXP-02` | `docs/agentic-substrate-evaluation-research.md` |
| `EVAL-EXP-05` | Correction overfitting | `S1-GATE` | `EVAL-EXP-04` | `docs/agentic-substrate-evaluation-research.md` |
| `EVAL-EXP-06` | Model-judge bias | `POST-S1` | labeled semantic corpus | `docs/agentic-substrate-evaluation-research.md` |
| `EVAL-EXP-07` | Evaluator regression and revocation | `POST-S1` | two evaluator versions + accepted subjects | `docs/agentic-substrate-evaluation-research.md` |
| `EVAL-EXP-08` | Composite acceptance | `S1-GATE` | `EVAL-EXP-01` | `docs/agentic-substrate-evaluation-research.md` |
| `EVAL-EXP-09` | Process versus outcome | `POST-S1` | observable process fixture | `docs/agentic-substrate-evaluation-research.md` |
| `EVAL-EXP-10` | Correction budget and quarantine | `S1-GATE` | `EVAL-EXP-04` | `docs/agentic-substrate-evaluation-research.md` |
| `EVAL-HARNESS-EXP-01` | Native evaluator versus Inspect challenger | `CHALLENGER` | native `EVAL-EXP-01/02` baseline | `docs/agentic-substrate-gap-filler-decisions.md` |

### Wave 6 — Memory candidate and later memory lifecycle

| ID | Experiment | Queue class | Depends on | Source contract |
| --- | --- | --- | --- | --- |
| `MEM-EXP-01` | Candidate provenance and quarantine | `S1-GATE` | `EVAL-EXP-04` | `docs/agentic-substrate-memory-research.md` |
| `MEM-EXP-02` | Helpful versus harmful memory ablation | `POST-S1` | active certified memory baseline | `docs/agentic-substrate-memory-research.md` |
| `MEM-EXP-03` | Knowledge update and stale memory | `POST-S1` | `MEM-EXP-02` | `docs/agentic-substrate-memory-research.md` |
| `MEM-EXP-04` | Memory poisoning channels | `S1-GATE` | `MEM-EXP-01` | `docs/agentic-substrate-memory-research.md` |
| `MEM-EXP-05` | Tenant and global isolation | `S1-GATE` | `MEM-EXP-01` | `docs/agentic-substrate-memory-research.md` |
| `MEM-EXP-06` | Consolidation with contradiction | `POST-S1` | `MEM-EXP-02/03` | `docs/agentic-substrate-memory-research.md` |
| `MEM-EXP-07` | Recall use trace and revocation impact | `S1-GATE` for replay/candidate durability; full test `POST-S1` | `MEM-EXP-01` | `docs/agentic-substrate-memory-research.md` |
| `MEM-EXP-08` | Forgetting and retention | `POST-S1` | non-synthetic retention policy | `docs/agentic-substrate-memory-research.md` |
| `MEM-EXP-09` | Backend substitution | `TRIGGERED` | stable help/harm benchmark | `docs/agentic-substrate-memory-research.md` |
| `MEM-EXP-10` | Long-horizon benchmark | `POST-S1` | repeated mission corpus | `docs/agentic-substrate-memory-research.md` |

### Wave 7 — S1 integration

| ID | Experiment | Queue class | Depends on | Source contract |
| --- | --- | --- | --- | --- |
| `IMPR-EXP-01` | Quarantine and same-run non-use | `S1-GATE` | `MEM-EXP-01` + `EVAL-EXP-04` | `docs/agentic-substrate-self-improvement-research.md` |
| `S1-E2E-01` | Complete evidence-correcting mission loop | `S1-GATE` | every preceding `S1-GATE` row | `docs/agentic-substrate-s1-implementation-plan.md` |

`S1-E2E-01` executes all 21 S1 acceptance predicates and every named S1 kill point. It is not replaced by passing component tests independently.

### Wave 8 — Post-S1 improvement lifecycle

| ID | Experiment | Queue class | Depends on | Source contract |
| --- | --- | --- | --- | --- |
| `IMPR-EXP-02` | Bounded text-space optimization | `TRIGGERED` | S1 + repeated capability gap | `docs/agentic-substrate-self-improvement-research.md` |
| `IMPR-EXP-03` | Held-out and distributional overfit | `TRIGGERED` | `IMPR-EXP-02` | `docs/agentic-substrate-self-improvement-research.md` |
| `IMPR-EXP-04` | Authority and security non-escalation | `TRIGGERED` | `IMPR-EXP-02` | `docs/agentic-substrate-self-improvement-research.md` |
| `IMPR-EXP-05` | Certification, promotion and rollback | `TRIGGERED` | `IMPR-EXP-02/03/04` | `docs/agentic-substrate-self-improvement-research.md` |
| `IMPR-EXP-06` | Target-specific negative transfer | `TRIGGERED` | multiple model/harness targets | `docs/agentic-substrate-self-improvement-research.md` |
| `IMPR-EXP-07` | Causal attribution | `TRIGGERED` | multi-component candidate | `docs/agentic-substrate-self-improvement-research.md` |
| `IMPR-EXP-08` | Shadow/canary drift and demotion | `TRIGGERED` | certified candidate + eligible traffic | `docs/agentic-substrate-self-improvement-research.md` |
| `IMPR-EXP-09` | Curriculum/corpus poisoning | `TRIGGERED` | generated curriculum proposal | `docs/agentic-substrate-self-improvement-research.md` |
| `IMPR-EXP-10` | Long-horizon feedback loop | `TRIGGERED` | repeated missions + delayed outcomes | `docs/agentic-substrate-self-improvement-research.md` |

### Wave 9 — Before any external target effect

| ID | Experiment | Queue class | Depends on | Source contract |
| --- | --- | --- | --- | --- |
| `ACT-EXP-01` | Capability least authority and revocation | `PRE-EFFECT` | A2–A6 `M2` + effect adapter | `docs/agentic-substrate-bounded-action-research.md` |
| `ACT-EXP-02` | Prompt injection and data-flow exfiltration | `PRE-EFFECT` | `ACT-EXP-01` | `docs/agentic-substrate-bounded-action-research.md` |
| `ACT-EXP-03` | Kill-point effect protocol | `PRE-EFFECT` | `ACT-EXP-01` + durable request journal | `docs/agentic-substrate-bounded-action-research.md` |
| `ACT-EXP-04` | Idempotency identity and retention | `PRE-EFFECT` | provider adapter contract | `docs/agentic-substrate-bounded-action-research.md` |
| `ACT-EXP-05` | Unknown target response reconciliation | `PRE-EFFECT` | `ACT-EXP-03/04` | `docs/agentic-substrate-bounded-action-research.md` |
| `ACT-EXP-06` | Concurrent/stale attempt fencing | `PRE-EFFECT` | `ACT-EXP-01/03` | `docs/agentic-substrate-bounded-action-research.md` |
| `ACT-EXP-07` | Sandbox, secret and resource containment | `PRE-EFFECT` | concrete runner/sandbox candidate | `docs/agentic-substrate-bounded-action-research.md` |
| `ACT-EXP-08` | Relay partition, spool and replay | `PRE-EFFECT` | customer-zone relay candidate | `docs/agentic-substrate-bounded-action-research.md` |
| `ACT-EXP-09` | Compensation and irreversibility | `PRE-EFFECT` | reversible adapter/runbook | `docs/agentic-substrate-bounded-action-research.md` |
| `ACT-EXP-10` | Identity, tenant and supply-chain isolation | `PRE-EFFECT` | workload identity + signed runner candidate | `docs/agentic-substrate-bounded-action-research.md` |

## S1 gate closure order

The dependency-respecting critical path is:

```text
LAB-EXP-01
├─ WORKER-EXP-01
├─ S1-FIXTURE-EXP-01 → BASELINE-EXP-01
└─ DUR-EXP-01 → DUR-EXP-05
   ├─ EPI-EXP-01 → EPI/CTX S1 gates
   ├─ ORCH-EXP-01 → ORCH S1 gates
   └─ EVAL-EXP-01 → EVAL S1 gates
      └─ EVAL-EXP-04 → MEM-EXP-01 → IMPR-EXP-01

all S1-GATE rows → S1-E2E-01
```

Independent rows within a wave may run in parallel after dependencies exist.

## Challenger rule

- `DUR-EXP-02` compares DBOS against completed `DUR-EXP-01` baseline.
- `EVAL-HARNESS-EXP-01` compares Inspect against completed native evaluation baseline.
- Mnemopi/Hindsight and DSPy/GEPA/SkillOpt remain triggered post-S1 experiments under their existing IDs/decisions.
- No challenger changes product schemas, thresholds, fixture splits or authority.

## Queue state transitions

```text
specified
→ dependency-ready
→ running
→ passed | failed | inconclusive | invalidated
→ rerun-required when fixture/evaluator/implementation contract changes
```

`deferred`/`triggered` is an admission state before `dependency-ready`, not a pass/fail result.

Every state change records:

- evidence/reason;
- implementation/fixture/evaluator versions;
- run IDs;
- affected ADR/deferred item;
- next action.

## Phase-gate use

- `G2-LAB`: `LAB-EXP-01`, fixture and baseline reproducibility.
- `G3-KERN`: durable experiments.
- `G4-AGNT`: worker/orchestration experiments.
- `G5-KNOW`: epistemic/context/memory-candidate experiments.
- `G7-EVAL`: evaluation/correction/improvement experiments.
- `G8-EXEC`: all `PRE-EFFECT` experiments.
- `G9-INTEG`: `S1-E2E-01` plus expanded integrated scenario.
- `G10-PROTOTYPE`: domain pressure, complete dry run and production qualification experiments.

## Next queue action

Implement `P3-KERN-11` exact event-ledger projection rebuild before restart reconciliation or `DUR-EXP-01`; DBOS remains blocked on the complete native durable-kernel baseline.
