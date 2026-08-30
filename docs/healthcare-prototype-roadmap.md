# Autonomous Migration Prototype Roadmap

## Current coordinate

Live status is generated from [`agentic-substrate-project-state.json`](./agentic-substrate-project-state.json). Read [`agentic-substrate-current-handoff.md`](./agentic-substrate-current-handoff.md) before acting; historical status text below is not delivery authority.

Current artifacts already exist:

- `docs/healthcare-autonomous-migration-research-plan.md`
- `docs/healthcare-system-design-mvp.html`
- `docs/agentic-substrate-codebase-study.md`
- `docs/agentic-substrate-durable-state-research.md`
- `docs/agentic-substrate-epistemic-state-research.md`
- `docs/agentic-substrate-orchestration-research.md`
- `docs/agentic-substrate-context-research.md`
- `docs/agentic-substrate-memory-research.md`
- `docs/agentic-substrate-evaluation-research.md`
- `docs/agentic-substrate-self-improvement-research.md`
- `docs/agentic-substrate-bounded-action-research.md`
- `docs/agentic-substrate-omp-audit.md`
- `docs/agentic-substrate-orca-audit.md`
- `docs/agentic-substrate-capability-code-map.md`
- `docs/agentic-substrate-maturity-placement.md`
- `docs/agentic-substrate-gap-filler-decisions.md`
- `docs/agentic-substrate-s1-implementation-plan.md`
- `docs/agentic-substrate-experiment-queue.md`
- `docs/agentic-substrate-lab-location.md`
- `docs/agentic-substrate-runtime-cut.md`
- `docs/agentic-substrate-lab-handoff.md`
- `docs/agentic-substrate-kernel-contracts.md`
- `docs/agentic-substrate-s1-deferred-register.md`

Phase 6 and `G6-DISC` are complete. `P6-DISC-01`–`07` provide the frozen Pagila estate, immutable read-only adapter authority, mutation-proof bounded PostgreSQL observation, exact inventory, digest-only profile, code artifact and provenance-separated lineage. `P6-DISC-08`–`13` add a ten-event CDC state machine covering snapshot, transactions, delete, DDL, checkpoint, restart duplicate and late update; cited claim comparison where denial never proves absence; deterministic gap arithmetic; mixed safe-probe plus human-exception planning; versioned target capability resolution; and a five-task, 22-mapping, proposal-only migration design over all 30 observed assets. The synthetic overlay fixture is checksum-bound at `828ffc6c…9eb995d`. Sealed `EXP-02` seed 602 detects 8/8 material contradictions with 10/10 citations and zero false promotions. Sealed `EXP-03` seed 603 finds 9/10 planted assets/dependencies, accepts zero decoys, retains 2/2 denials and emits the cited proposal. Sealed `EXP-04` seed 604 disposes 10/10 events, reaches the exact final state and reports zero gaps. All run indexes verify. Migration 011 binds 71 schemas; 11 migrations / 17 tables fingerprint `7acfcb43…8769156`. Verification passes 33 unit files / 176 tests and 18 PostgreSQL files / 53 tests.

`P7-EVAL-01` is complete. Four immutable V2 records freeze evaluator implementation/version/limits, contract subject/input/measure/threshold/evidence requirements, an independently attributed assignment, and a non-authoritative result. Runtime registry validation rejects definition/contract lineage drift, unsupported subjects, stale or under-evidenced inputs, producer self-evaluation, budget/independence expansion, threshold drift, stale assignment/result digests and duplicate results. PostgreSQL task completion now reconstructs the exact V2 bundle and verifies referenced evidence bytes before reconciliation. Migration 012 raises the registry to 75 schemas without rewriting frozen V1 history; 12 migrations / 17 tables fingerprint `c82229f9…1d9e782d`. Verification passes 35 unit files / 188 tests and 19 PostgreSQL files / 54 tests.

`P7-EVAL-02` is complete. The product coordinator derives observed independence, creates one exact V2 assignment and durable outbox dispatch per required evaluator, and records immutable versioned coordination snapshots with no acceptance authority. Result reconciliation preserves pending, missing, partial, unavailable, contradictory, error, stale, failed and passing dispositions; pass/fail disagreement is explicit unresolved state rather than majority vote. Missing becomes attributable only at deadline, complete passing work becomes merely eligible for product reconciliation, and every outcome leaves unrelated work runnable. PostgreSQL advisory locking makes concurrent dispatch one insert plus one exact replay; restart-only reconstruction resolves one branch missing while an unrelated branch advances. Migration 013 raises the registry to 76 schemas; 13 migrations / 17 tables fingerprint `cd7f8c60…d612e3a8`. Verification passes 36 unit files / 194 tests and 20 PostgreSQL files / 55 tests.

`P7-EVAL-03` is complete. A versioned side-effect-free suite maps five hard boolean measures to structural, runtime type, contract/evidence lineage, schema compatibility and authority-policy checks over the migration proposal. Every run emits an immutable typed report, report evidence and V2 result; critical structure/type/evidence/version/tenant/authority mutations fail exact measures, property-order changes remain byte-identical, and late otherwise-passing work is stale. Claimed outbox work persists report/evidence/result atomically, survives redelivery as one exact replay, acknowledges only the current fence, and advances coordination only to reconciliation eligibility. Review tightened exact suite pinning, rejected duplicate/excess evidence, required JSON serialization, enforced non-effect authority and improved coordinator record-set validation. Migration 014 raises the registry to 78 schemas; 14 migrations / 17 tables fingerprint `5561a9ce…1c3e5fe`. Verification passes 37 unit files / 201 tests and 21 PostgreSQL files / 56 tests.

`P7-EVAL-04` through `P7-EVAL-06` are complete. CDC evaluation now checks exact final counts and key digests, applied deletes, source ordering, checkpoint watermark, replay equality and one disposition per event. Artifact evaluation reconstructs a private clean TypeScript project twice under a pinned compiler/options digest, rejects path/provenance/compiler/build defects and records an emitted digest without package installation or network. A ten-group held-out semantic corpus keeps labels hidden from producers, scores exact predictions, fails false accepts and leaves abstention or evaluator disagreement inconclusive. Five immutable bundle/corpus/report contracts persist under migration 015; registry 83, 15 migrations / 17 tables fingerprint `8681ec82…0864993a`. Verification passes 38 unit files / 207 tests and 22 PostgreSQL files / 57 tests.

`P7-EVAL-07` through `P7-EVAL-10` are complete. Product-owned immutable acceptance now enforces unknown→hypothesis→supported→accepted and rejected/quarantined paths; evaluator or producer records cannot accept. Failed measures become attributed typed gaps with no generic retry. A failed effect-capable proposal is corrected into a new V2 subject under the unchanged evaluator and thresholds, independently passes, and preserves failed history/delta/usage. Success and failure lessons create only no-use quarantined learning candidates. Migration 016 raises the registry to 86 schemas; 16 migrations / 17 tables fingerprint `e1ef3246…d783ba38`. Verification passes 39 unit files / 212 tests and 23 PostgreSQL files / 58 tests.

`P7-EVAL-11` through `P7-EVAL-14` and `G7-EVAL` are implemented and verified on the current delivery branch. Frozen held-out certification, product-owned activation, atomic regression revocation/rollback, sealed `EXP-08`/`EXP-09`, registry 89, migration 017 and the closed correction gate pass. The canonical handoff records the separate merge state.

## How to use coordinates

Format:

```text
P<phase>-<track>-<task>
```

Example:

```text
P7-EVAL-01
```

Means:

- Phase 7
- Evaluation, self-correction, and skill lifecycle track
- Task 1

Gate format:

```text
G<phase>-<track>
```

Loop format:

```text
L-<track>-<number>
```

When discussing work, always name the coordinate:

> “The canonical handoff names the exact current coordinate and delivery state.”

Do not say only “we are working on evaluation.”

## Status vocabulary

| Status | Meaning |
| --- | --- |
| `DONE` | Exit evidence exists and was checked. |
| `CURRENT` | The single task being decided or executed now. |
| `READY` | Dependencies are complete; work may start. |
| `WAIT` | Future task whose dependency is not complete. |
| `BLOCKED` | Requires an external fact, access, or decision. |
| `REWORK` | A later experiment invalidated earlier work. Follow the named loop. |

Rules:

1. Keep exactly one `CURRENT` coordinate.
2. A task is not `DONE` because code exists. Its exit evidence must pass.
3. A phase gate means “safe to learn at the next layer,” not “final specification complete.” Later evidence may reopen it.
4. Keep only the current wave and the next wave granular. Later phases are directional backlog until evidence pulls them closer.
5. If an experiment breaks an assumption, move to the corresponding loop coordinate before continuing.
6. At every phase gate, review `docs/agentic-substrate-s1-deferred-register.md`; promote only items whose evidence trigger fired, and record newly deferred capabilities.
7. At the end of every work session, report:
   - current coordinate;
   - coordinates completed;
   - failed gate or active loop;
   - next dependency-ready coordinate.


## Adaptive project model

The project evolves through three coupled layers:

1. **Agentic substrate** — durable state, evidence-seeking reasoning, orchestration, tools, evaluation, correction, memory, learning, and recovery.
2. **Migration capability pack** — source discovery, data engineering, platform knowledge, CDC, mappings, target adapters, and migration evaluators.
3. **Mission product** — customer intake, operator surface, security, policy, execution, evidence, and deployment.

The substrate comes first, but it must be pressure-tested with migration-shaped fixtures early. Building a completely generic “super agent” without a concrete environment creates vague goals, weak evaluators, and architecture bloat. Building migration automation without the substrate creates brittle scripted demos. The two layers co-evolve.

### Rolling-wave planning

- The current wave has executable tasks and thresholds.
- The next wave has research-backed candidate tasks.
- Later waves retain coordinates and outcomes but may be rewritten as earlier experiments teach us.
- New evidence creates a discovery record, names impacted coordinates/ADRs, and either:
  - leaves the path unchanged;
  - adds a task;
  - moves a task;
  - enters a rework loop;
  - invalidates a hypothesis.
- Roadmap edits are expected. Silent scope drift is not.

### Capability maturity levels

| Level | Meaning | Required evidence |
| --- | --- | --- |
| `M0 — Named` | Capability is described. | Responsibility and failure consequence. |
| `M1 — Researched` | Credible implementation approaches are understood. | Primary sources, alternatives, known failures, cheapest experiment. |
| `M2 — Isolated proof` | One component works in a controlled fixture. | Repeatable experiment and threshold. |
| `M3 — Integrated proof` | Capability works with adjacent state/tools/agents. | Cross-component test and failure recovery. |
| `M4 — Domain pressure` | Capability survives migration-shaped cases. | Seeded legacy/data/platform fixtures and independent evaluation. |
| `M5 — Prototype ready` | Capability is safe and observable in the complete POC. | End-to-end evidence, faults, repeatability, and rollback. |

Every major capability should carry both a roadmap coordinate and a maturity level.

## Agentic substrate progression line

| Level | System characteristic | Current Orca / OMP position |
| --- | --- | --- |
| `A0 — Tool agent` | Model can reason, call tools, observe results, and return structured output. | **Strong:** OMP already provides the core model/tool loop and coding tools. |
| `A1 — Stateful worker` | Sessions, context compaction, resumable working history, scoped memory. | **Strong mechanics plus isolated governance proof:** OMP sessions/compaction and product-owned memory candidate/version/use/invalidation pass synthetic scope, harm and replay tests; integrated mission recall remains unproven. |
| `A2 — Durable mission agent` | Goal, world model, tasks, attempts, decisions, and recovery survive any worker. | **M2/M3 kernel proof:** product PostgreSQL commands/events/projections/plans/attempts/effects/replay/restart converge under faults; the complete mission/world-model loop is not assembled. |
| `A3 — Orchestrated specialists` | Apex agent decomposes, delegates, compares disagreement, and changes plan from evidence. | **M2 isolated proof:** typed proposal-only specialists, one-action apex, evidence-seeking disagreement, context authority, process replacement, and real OMP containment pass; full mission integration remains ahead. |
| `A4 — Evidence-seeking intelligence` | Distinguishes facts/claims/gaps, researches, probes, cites, and abstains. | **M3 discovery proof:** bounded source observations feed claim comparison, contradiction preservation, ranked gaps, safe probes and explicit human exceptions; EXP-02/03 pass without treating denial as absence. |
| `A5 — Self-correcting system` | Independent evaluation detects failure, diagnoses cause, revises work, and re-tests. | **Closed synthetic correction proof:** product acceptance, exact failed-measure diagnosis and new-version correction under an unchanged contract pass; mutation/overfit experiments and broader integration remain. |
| `A6 — Self-improving system` | Accepted outcomes create candidate memory/skills/routes that are held-out tested, promoted, monitored, and demoted. | **Synthetic governed lifecycle M2:** candidates remain quarantined; held-out certification, product-owned activation, regression revocation and predecessor rollback pass. Optimizer-generated candidates and production canary traffic remain deferred. |
| `A7 — Bounded autonomous executor` | Performs real actions with identity, policy, idempotency, receipts, reconciliation, and rollback/repair. | **State-semantics proof plus Orca patterns:** capability/effect/fence/unknown/recovery contracts pass without granting an external target effect; real adapters/relay/sandbox remain Phase 8 work. |
| `A8 — Integrated agentic substrate` | A0–A7 operate as one replayable, observable, secure system. | **Not assembled.** |
| `A9 — Migration capability pack` | Substrate gains discovery, CDC, mapping, platform, semantic, and migration-evaluation skills. | **Discovery/evaluation proof:** Pagila discovery, exact CDC replay, cited proposal, data/artifact/semantic evaluators and mutation qualification pass; executable target effects remain Phase 8. |
| `A10 — Working migration prototype` | One loose goal becomes a discovered, built, evaluated, executed, recovered, evidenced migration POC. | **Not started.** |

### Honest current position

The latest capability and delivery state lives only in the [generated current handoff](./agentic-substrate-current-handoff.md). The current branch proves independent correction and synthetic skill rollback; fork `main` remains at the merged coordinate named there. Do not infer delivery state from historical phase prose.

```text
A0 Tool agent                 strong
A1 Stateful worker            strong mechanics; governed memory M2
A2 Durable mission            durable kernel M2/M3
A3 Specialist orchestration   isolated typed/contained proof M2
A4 Evidence seeking           integrated discovery proof M3
A5 Self-correction            independent fixed-contract correction passes
A6 Self-improvement           synthetic certification/revocation/rollback M2
A7 Bounded execution          state semantics only; no target effect
A8 Integrated substrate       not assembled
A9 Migration capability       discovery and independent evaluation pass
A10 Working prototype         not assembled
```

## Working prototype definition

The prototype is complete only when one reproducible, non-production scenario demonstrates all of the following:

1. Accepts a loose migration goal and unreliable supplied artifacts.
2. Discovers one licensed sample source estate using read-only access.
3. Builds a cited estate model containing assets, dependencies, claims, gaps, and contradictions.
4. Uses an apex controller to assign bounded work to OMP specialist agents.
5. Retrieves cited platform knowledge and records exactly what entered each agent context.
6. Generates a versioned migration design, mapping, pipeline artifact, and evaluation plan.
7. Detects seeded critical defects with an independent evaluator.
8. Corrects at least one failed artifact and passes re-evaluation.
9. Performs one bounded, idempotent non-production target operation.
10. Reconciles a deliberately lost target response without duplicating the effect.
11. Survives control-process and OMP-worker restarts without losing or double-advancing mission state.
12. Produces a complete evidence packet and operator view showing facts, gaps, decisions, effects, evaluations, failures, and recovery.
13. Prevents every seeded cross-tenant and secret-leak case.
14. Repeats the complete scenario from a clean environment with materially equivalent accepted output.

The working prototype does **not** require:

- production PHI;
- production mutation;
- broad connector coverage;
- multiple clouds or targets;
- production HA certification;
- disconnected production operation;
- autonomous model fine-tuning;
- a dedicated graph database;
- a production customer deployment.

---

# Phase 0 — Architecture and prototype boundary

**Goal:** turn the current product thesis and technical architecture into an agreed, falsifiable prototype boundary.

| Status | Coordinate | Task | Exit evidence |
| --- | --- | --- | --- |
| `DONE` | `P0-ARCH-01` | Align customer and system responsibility model. | Product accepts loose goals; system owns engineering discovery and decisions; human exception boundary recorded. |
| `DONE` | `P0-ARCH-02` | Write research and build plan. | Tracked research plan names atomic capabilities and phased approach. |
| `DONE` | `P0-ARCH-03` | Produce six-part architecture MVP atlas. | Component, reuse, research, corpus, experiment, and decision registers exist. |
| `DONE` | `P0-ARCH-04` | Add first-principles technical baseline. | Load model, deployables, stores, protocols, consistency, security, scaling, and recovery documented. |
| `DONE` | `P0-ARCH-05` | Accept the technical baseline as a provisional POC pressure map. | User direction confirms that the POC may proceed without an exhaustive final-product specification. |
| `READY` | `P0-ARCH-06` | Resolve architecture questions as experiments expose them. | Raw-data path, load envelope, deployable cuts, protocols, and RTO/RPO stay versioned hypotheses. |
| `DONE` | `P0-ARCH-07` | Define provisional prototype capabilities and non-goals. | Working prototype criteria and exclusions are explicit and may mature through experiments. |
| `DONE` | `P0-ARCH-08` | Prioritize architecture risks. | Durable state, apex orchestration, memory, evaluation, OMP containment, and unknown effects are named first risks. |
| `DONE` | `P0-ARCH-09` | Record technical architecture hypotheses. | Baseline choices have status, evidence need, and reversal condition. |

### `G0-ARCH` — Safe-to-learn architecture gate

**Status: passed provisionally.** It authorizes research and POC learning, not production implementation.

Pass condition:

- the product direction is understandable;
- the agentic substrate, migration capability pack, and mission product are separated;
- required behaviors have provisional owners;
- obvious safety/authority boundaries exist;
- architecture assumptions are labeled and reversible;
- experiments are allowed to rewrite the design.

Failure route: `L-ARCH-01`.

---

# Phase 1 — Agentic substrate research and Orca/OMP placement

**Goal:** define the characteristics of a top-tier stateful agentic system, understand credible implementations, then map exact Orca/OMP code and tests onto that progression before selecting the first integrated build slice.

| Status | Coordinate | Task | Exit evidence |
| --- | --- | --- | --- |
| `DONE` | `P1-RSCH-01` | Define agentic substrate capability contracts. | A0–A7 responsibilities, inputs/outputs, state, authority, failures, evaluation, isolation, maturity, and next experiments are recorded in the codebase study. |
| `DONE` | `P1-RSCH-02` | Research durable state and workflow implementations. | Product-owned PostgreSQL state machine selected as S1 baseline; DBOS selected challenger; Temporal, Restate, Hatchet, River, LangGraph, and Inngest dispositions recorded. |
| `DONE` | `P1-RSCH-03` | Research epistemic world models and gap resolution. | Event-sourced epistemic ledger, justification graph, evidence vector, contradiction/invalidation rules, probe ranking, abstention, reuse map, and seven experiments recorded. |
| `DONE` | `P1-RSCH-04` | Research apex and specialist orchestration. | Durable typed blackboard, replaceable apex, product-owned assignments, deterministic reconciler, pattern comparison, OMP/Orca reuse map, and eight orchestration experiments recorded. |
| `DONE` | `P1-RSCH-05` | Research context, retrieval, and live research. | Deterministic context compiler, manifest/trace/citation/live-research contracts, eligibility/ranking/packing/refresh rules, reuse map, and ten experiments recorded. |
| `DONE` | `P1-RSCH-06` | Research long-term agent memory. | Governed memory registry, canonical-owner taxonomy, candidate/version/use/consolidation/invalidation contracts, security model, OMP/Mnemopi/Hindsight reuse map, and ten experiments recorded. |
| `DONE` | `P1-RSCH-07` | Research evaluation and self-correction. | Product-owned evaluator registry/coordinator, evaluator independence, typed measures/verdicts, fixed-contract correction, OMP/Orca reuse map, and ten experiments recorded. |
| `DONE` | `P1-RSCH-08` | Research self-improvement and skill learning. | Product-owned improvement lab/registry, least-powerful-change ladder, quarantine/certification/shadow/canary/demotion contracts, OMP/Orca reuse map, external optimizer challengers, and ten experiments recorded. |
| `DONE` | `P1-RSCH-09` | Research bounded action and recovery. | Product-owned effect protocol, capability/policy/identity/secret/sandbox contracts, explicit unknown reconciliation/compensation, OMP/Orca reuse map, and ten kill-point/security experiments recorded. |
| `DONE` | `P1-RSCH-10` | Audit OMP code against A0–A7. | Pinned `v18.0.6` package/symbol/protocol/test map verifies A0–A7 maturity, limitations, product dispositions, extension seams, and installed `18.0.4` skew risk. |
| `DONE` | `P1-RSCH-11` | Audit Orca code against A0–A7. | Current-source symbol/protocol/test map verifies durable terminal orchestration, capability/receipt/unknown/recovery, AI Vault/output archives, skill/artifact transactions, UI surfaces, and product-domain limits. |
| `DONE` | `P1-RSCH-12` | Build combined capability-to-code map. | Verified A0–A7 map classifies each OMP/Orca component as reuse, adapt, pattern, replace, missing, or deferred and fixes final product ownership/dependency direction. |
| `DONE` | `P1-RSCH-13` | Place Orca/OMP on maturity progression. | A0–A8 matrix separates high-maturity OMP/Orca edge mechanics from `M1` product-center capabilities, records proven/missing behavior, and names each next promotion experiment. |
| `DONE` | `P1-RSCH-14` | Research strongest open-source gap fillers. | Product authority remains custom; DBOS and Inspect are Phase 2 challengers; memory/optimizer/policy/identity/sandbox candidates have explicit triggers; duplicate/maintenance-mode frameworks are not selected. |
| `DONE` | `P1-RSCH-15` | Select first integrated substrate slice. | Slice S1 is scope-frozen around a six-row synthetic identity-key contradiction, two specialist assignments, deterministic critical/benign mutations, six hard evaluator measures, fixed-contract correction, 21 acceptance predicates, and crash/replay. |
| `DONE` | `P1-RSCH-16` | Update ADRs and executable experiment queue. | Atlas ADR-H-024/025 record S1 and challenger posture; all 70 research experiments plus six lab/integration contracts are dependency-ordered; 52 deferrals were gate-reviewed without silent promotion. |

### `G1-RSCH` — Substrate understanding gate

Pass when:

- A0–A7 capability contracts exist;
- primary-source implementation research covers every capability;
- exact Orca and OMP symbols/tests are mapped;
- current maturity and gaps are explicit;
- strongest reuse/adapt/build alternatives are named;
- the first integrated substrate POC slice and its evaluator are selected.

**Gate status: `DONE`.** Every predicate above is evidenced by the linked research cards, exact OMP/Orca audits, combined code/maturity maps, gap-filler decisions, frozen S1 contract, deferred-register gate review, ADR register, and experiment queue. This closes understanding—not implementation proof.

Failure route: `L-RSCH-01`.

---

# Phase 2 — Prototype lab, fixtures, and benchmark infrastructure

**Goal:** build the laboratory in which architecture claims can fail cheaply and reproducibly.

| Status | Coordinate | Task | Exit evidence |
| --- | --- | --- | --- |
| `DONE` | `P2-LAB-01` | Select prototype implementation location. | `prototype/migration-control-plane/` is selected as an independent nested build/dependency boundary; root production workspace/lock/build remain untouched; stable setup/build/typecheck/test/verify/experiment command semantics are fixed. |
| `DONE` | `P2-LAB-02` | Select prototype language/runtime cuts. | Node 24+ with strict TypeScript is selected for the lab/control baseline; OMP remains an external Bun process; Go/Python remain measured service/challenger options. |
| `DONE` | `P2-LAB-03` | Create deterministic test clock and IDs. | Seeded SHA-256 IDs, explicit clock/tick/event ordering, golden replay, distinct-seed and invalid-input tests pass. |
| `DONE` | `P2-LAB-04` | Create fault-injection framework. | Fourteen named points cover database, process, network, object, evaluator, target, memory, and mission; every point produces inspectable failure artifacts. |
| `DONE` | `P2-LAB-05` | Create run artifact format. | Pending-to-final publication, exclusive/path-contained writes, canonical JSON, environment/config/events/metrics/verdict/usage, SHA-256 index, and tamper detection pass. |
| `DONE` | `P2-LAB-06` | Create frozen S1 synthetic identity-key fixture. | MIT/no-PHI provenance, exact eight-file byte/SHA-256 manifest, six rows, schema, expected results, and deterministic IDs validate. |
| `DONE` | `P2-LAB-07` | Create contradictory evidence and probe oracle. | Stale customer claim, observed duplicate refutation, and deterministic single/composite key probes reproduce `5/6` and `6/6` outcomes. |
| `DONE` | `P2-LAB-08` | Create S1 critical and benign mutations. | Dropped facility scope fails `decision_alignment`/`source_key_unique`; optional description mutation passes all six measures. |
| `DONE` | `P2-LAB-09` | Create S1 isolation and injection negatives. | Six role/tenant/stale/injection/quarantined-memory/denied-input cases produce exact deterministic dispositions. |
| `DONE` | `P2-LAB-10` | Create pinned OMP worker-contract fixture. | OMP 18.0.6/source commit/RPC/frame/tool/schema/cancel/archive/skew contract validates; real binary exercise remains explicitly inconclusive. |
| `DONE` | `P2-LAB-11` | Create baseline non-agent implementation. | Deterministic baseline selects the smallest observed unique composite key with zero model/effect calls and passes six hard evaluator measures. |
| `DONE` | `P2-LAB-12` | Implement experiment runner. | Stable setup/build/typecheck/test/verify/experiment command validates strict CLI inputs and writes sealed reproducible pass/fail/inconclusive runs. |

### `G2-LAB` — Reproducible laboratory gate

Pass when:

- a clean machine can install and run the lab;
- licenses and checksums are recorded;
- the same seed produces the same non-model state transitions;
- every fault point produces an inspectable artifact;
- baselines exist before agent optimization begins.

**Gate status: `DONE`.** Frozen setup succeeds; fixture licenses/checksums validate; same-seed non-model artifacts replay byte-for-byte; all 14 fault points preserve sealed inspectable failures; the non-agent baseline passes before agent optimization. Verification: 6 test files / 22 tests, formatting, lint, strict typecheck, build, and sealed `LAB-EXP-01`, `S1-FIXTURE-EXP-01`, and `BASELINE-EXP-01` runs.

Failure route: `L-LAB-01`.

---

# Phase 3 — Durable control kernel

**Goal:** prove that mission state survives crashes, retries, duplicates, and stale workers before adding intelligent behavior.

| Status | Coordinate | Task | Exit evidence |
| --- | --- | --- | --- |
| `DONE` | `P3-KERN-01` | Define versioned domain contracts. | Forty-one strict V1 Zod/runtime and deterministic Draft 2020-12 schemas compile; prefixed IDs, tenant/mission admission, authority/lineage invariants, 41 canonical samples, JSON registry digest, and 46-test verification pass. |
| `DONE` | `P3-KERN-02` | Implement database migrations. | Three transactional checksum-locked migrations create 16 PostgreSQL 16 tables; empty and staged-upgrade paths converge to fingerprint `48406f18…8d82b74b`, concurrent runners serialize, reapply is inert, and altered or gapped history is rejected in four real-server tests. |
| `DONE` | `P3-KERN-03` | Implement command idempotency. | Full canonical command identity is reserved transactionally; identical and concurrent retries execute once and replay committed/rejected results, while payload/full-input mismatch fails and indeterminate failures roll back in six tests. |
| `DONE` | `P3-KERN-04` | Implement aggregate event append. | Per-mission advisory/row locking and expected revision admit one concurrent winner; stale rivals become durable deterministic rejections without duplicate events. |
| `DONE` | `P3-KERN-05` | Implement transactional projections. | Command outcome, aggregate, append-only event, current projection, and outbox commit together; injected outbox/projection failures prove no partial state in four transition tests. |
| `DONE` | `P3-KERN-06` | Implement outbox and inbox. | `SKIP LOCKED` claims, expiring leases/fences, stale-ack rejection, delayed retry, idempotent ack, advisory-locked inbox import, mismatch rejection, and handler rollback pass five delivery tests. |
| `DONE` | `P3-KERN-07` | Implement plan DAG validation. | Seven tests admit complete acyclic graphs and reject stale bases, missing tasks/dependencies, cycles, duplicate additions, operation drift, incompatible output contracts, and missing edge recovery rules. |
| `DONE` | `P3-KERN-08` | Implement task and attempt lifecycle. | Four tests guard pending/runnable/leased/running/evaluating/blocked/quarantined/terminal task transitions and claimed/running/result/evaluating/terminal attempt transitions, immutable fields, revisions, and authority. |
| `DONE` | `P3-KERN-09` | Implement leases and fencing. | Concurrent claims admit one attempt; task and attempt update together under one monotonic fence; rival/expired output is rejected without advancing state in two real-server tests. |
| `DONE` | `P3-KERN-10` | Implement effect state machine. | Migration 004 adds effect-attempt authority; prepared/issued/applied/absent/unknown/reconciling/failed/evaluating/accepted/rejected transitions, receipt/observation identity, parameter digest, and stale fences pass four real-server tests. |
| `DONE` | `P3-KERN-11` | Implement replay and projection rebuild. | Migration 005 makes mission events append-only; four tests verify contiguous positions/full event and payload digests, exact dropped/corrupted projection rebuild, and tamper/gap rejection. |
| `DONE` | `P3-KERN-12` | Implement restart reconciliation. | Every nonterminal task, attempt, effect, and outbox row receives one deterministic persisted disposition; rerun is idempotent and active leases defer rather than imply death in two tests. |
| `DONE` | `P3-KERN-13` | Run durable-convergence experiment. | `DUR-EXP-01` passes three real-server seeds plus sealed CLI seed 103 for duplicate safety, precommit crash rollback/retry, stale-fence rejection, atomic counts, evaluation-gated terminal state, exact replay, and restart coverage. |

### `G3-KERN` — Durable kernel gate

Pass when:

- no injected crash loses accepted state;
- no duplicate/stale message advances state twice;
- projections rebuild exactly;
- every nonterminal record has a recovery path;
- task completion is impossible without the current attempt and required evaluation.

**Gate status: `DONE`.** Five migrations / 17 tables, 10 unit files / 57 tests, 9 PostgreSQL files / 33 tests, and sealed `DUR-EXP-01` evidence prove every predicate above locally. Transport delivery remains non-authoritative; no model or external target effect was invoked.

Failure route: `L-KERN-01`.

---

# Phase 4 — OMP agent runtime and apex orchestration

**Goal:** run replaceable intelligence workers without giving them state authority or ambient customer access.

| Status | Coordinate | Task | Exit evidence |
| --- | --- | --- | --- |
| `DONE` | `P4-AGNT-01` | Implement agent-gateway process supervisor. | Eight real-child tests prove start/observe/natural failure, duplicate-start rejection, spawn failure, bounded flood output, runtime timeout, idempotent cancellation, graceful/forced termination, descendant cleanup, and safe Windows command resolution with no leaked fixture process. |
| `DONE` | `P4-AGNT-02` | Generate isolated OMP environment. | Four tests prove exclusive private roots, empty workspace, 0700/0600 permissions, value-digest manifest, hostile parent credential/profile/config/hook omission, explicit runtime allowlist, cleanup/reuse, and real-child cwd/environment isolation. |
| `DONE` | `P4-AGNT-03` | Implement OMP RPC frame handling. | Seven tests prove ready-first v1/v2 negotiation, fragmented JSONL, bounded chunk reassembly, typed response/event/host-tool/cancel/error frames, and fail-closed handling of overflow, UTF-8, JSON, schema, order, base64, interruption, and trailing data. |
| `DONE` | `P4-AGNT-04` | Implement context-manifest delivery. | Four tests prove exact source/version/digest/span/order, exclusion/redaction, tenant/mission/assignment/attempt/budget binding, byte-identical reconstruction, private read-only materialization, and prompt delivery. |
| `DONE` | `P4-AGNT-05` | Implement typed assignment result. | Five tests reject prose-only/omitted/extra/stale/oversized/over-budget/out-of-scope output and admit only current strict proposal records with host-observed digest and usage. |
| `DONE` | `P4-AGNT-06` | Implement host-tool capability bridge. | Six tests require active attempt, exact registered schema/arguments, allow policy, bound capability, and minimum use budget before execution; duplicate IDs and invalid results fail closed. |
| `DONE` | `P4-AGNT-07` | Implement cancellation and revocation. | Per-call OMP cancellation aborts the active signal; attempt cancellation and capability revocation close the synchronous start gate before acknowledgement and remain idempotent. |
| `DONE` | `P4-AGNT-08` | Define specialist-agent contracts. | Six tests prove nine role-specific typed briefs/results with exact scope, tools, output schema, budget, claim citations, abstention, and complete proposal-only authority exclusions. |
| `DONE` | `P4-AGNT-09` | Implement apex next-action loop. | Six tests prove digest-bound durable snapshots, exactly one evidence-backed action, current-revision/gap/evidence/role/budget validation, specialist dispatch, and proposed-only decision records without snapshot mutation. |
| `DONE` | `P4-AGNT-10` | Implement disagreement-resolution loop. | Six tests preserve all cited conflicting results, reject cross-state/duplicate/non-conflicting inputs, choose the cheapest admissible discriminating probe, and retain majority or unprobeable cases as explicit ties. |
| `DONE` | `P4-AGNT-11` | Test process reconstruction. | Four tests force-kill and replace a real child from persisted assignment/context/ledger/executable digests, reconstruct identical logical invocation bytes in a fresh root, reject drift, and observe no hidden worker state. |
| `DONE` | `P4-AGNT-12` | Run OMP containment experiment. | Real pinned OMP 18.0.6 `EXP-10` passes v2 negotiation, subagent query, strict host schema, context→artifact, active cancellation, zero post-cancel starts, flood/overflow, malformed frame, crash replacement, and bounded-frame measures. |
| `DONE` | `P4-AGNT-13` | Run specialist disagreement experiment. | Sealed `EXP-05` seed 413 passes 15/15 resolvable choices, 20/20 citation coverage, and 5/5 explicit true ties; no majority silently selects a stance. |

### `G4-AGNT` — Bounded intelligence gate

Pass when:

- an OMP worker can be killed and replaced safely;
- ambient state is absent;
- host tools are revocable;
- every assignment has a reproducible context manifest;
- apex and specialists cannot directly advance authoritative state;
- disagreement triggers evidence gathering rather than voting or bluffing.

**Gate status: `DONE`.** Every bounded-intelligence predicate passes with 21 test files / 118 tests, sealed `EXP-10`, passing real-binary `WORKER-EXP-01`, sealed `EXP-05`, and no leaked OMP or fixture process. OMP output, apex action, specialist result, and tool correlation remain proposals/observations until product-owned validation and reconciliation.

Failure route: `L-AGNT-01`.

---

# Phase 5 — Knowledge, memory, and capability substrate

**Goal:** provide cited, scoped knowledge and useful memory without letting retrieval become authority.

| Status | Coordinate | Task | Exit evidence |
| --- | --- | --- | --- |
| `DONE` | `P5-KNOW-01` | Implement corpus manifest model. | Five strict contracts bind every source to tenant, owner, permission/license, exact version, content-addressed checksum/bytes, data class, applicability, freshness, retention, and predecessor lineage. |
| `DONE` | `P5-KNOW-02` | Implement immutable source ingestion. | Seven tests prove content-addressed original/parse bytes, 64 MiB bounds, private 0400 storage, idempotent replay, restart reconstruction, exact digest/byte checks, path/symlink defense, and immutable version identity. |
| `DONE` | `P5-KNOW-03` | Implement chunks and relational metadata. | Parsed chunks/entities/relations preserve exact source/parse/span/digest/applicability provenance; deterministic catalog queries and PostgreSQL migration 006 persist 46 contracts and reject corpus update/delete. |
| `DONE` | `P5-KNOW-04` | Implement lexical retrieval baseline. | Eight tests prove transparent structured/BM25-simple ranks, exact current source/version/digest/span citations, RRF fusion, coverage reporting, and explicit below-score results without vector dependence. |
| `DONE` | `P5-KNOW-05` | Add optional semantic retrieval. | A versioned/configuration-digested sparse semantic projection recovers a governed-concept paraphrase missed by lexical-only search; it operates only on pre-authorized chunks. |
| `DONE` | `P5-KNOW-06` | Implement bounded graph expansion. | Tenant-local relational BFS enforces depth/candidate bounds, records visited entities/edges, and contributes only exact provenance chunks; graph score never changes eligibility. |
| `DONE` | `P5-KNOW-07` | Implement retrieval authorization. | Tenant, class, scope, source, render, digest, current-version, applicability, and freshness denials occur before scoring with attributable reasons and zero channel scores. |
| `DONE` | `P5-KNOW-08` | Implement context assembler. | Repeated compilation is byte-identical; cited items are ordered, deduplicated, literal-redacted, token-bounded, digest-bound, and every excluded candidate retains its reason. |
| `DONE` | `P5-KNOW-09` | Implement memory candidate model. | All five memory classes require canonical record/evidence provenance, digest-bound content, scope/applicability/retention/validation metadata, no authority delta, and exact quarantined/no-use/not-run state. |
| `DONE` | `P5-KNOW-10` | Implement memory validation/invalidation. | Ordered immutable versions, exact recall boundaries, downstream use attribution, complete-use impact review, and stale/deprecated/revoked/forgotten replacement states survive PostgreSQL reconstruction. |
| `DONE` | `P5-KNOW-11` | Implement skill registry skeleton. | Typed versioned artifacts/contracts, evaluators, authority, dependencies, model/runtime/tool/data/task compatibility, and quarantine/certification/activation/deprecation/revocation lifecycle are persisted immutably. |
| `DONE` | `P5-KNOW-12` | Run retrieval benchmark. | Sealed `EXP-06` seed 506 retrieves 20/20 known answers from 55 conflict/stale/cross-tenant/distractor documents, cites 20/20, uses zero denied items, and records all query traces. |
| `DONE` | `P5-KNOW-13` | Run memory help/harm benchmark. | Sealed `EXP-07` seed 507 moves held-out accuracy from 10/20 to 20/20, rejects all seeded wrong/stale memory, leaks zero cross-tenant memory, revokes future recall, and retains 20 use traces. |

### `G5-KNOW` — Knowledge and memory gate

Pass when:

- every used claim cites an allowed source/version;
- known stale and unauthorized sources are rejected;
- memory use is measurable and reversible;
- poisoned memory cannot become mission fact;
- the same context manifest can be reconstructed;
- graph/vector machinery remains derived and replaceable.

**Gate status: `DONE`.** All predicates pass with exact source/version citations, pre-ranking stale/tenant exclusion, reversible use-traced memory, quarantine-first skill lifecycle, sealed `EXP-06`/`EXP-07`, 55 schemas, 8 migrations / 17 tables, 25 unit files / 152 tests, 12 PostgreSQL files / 36 tests, and schema fingerprint `2ade23da…b4bf5e`.

Failure route: `L-KNOW-01`.

---

# Phase 6 — Source discovery and gap resolution

**Goal:** prove the system can learn an ugly source estate rather than merely summarize supplied documentation.

| Status | Coordinate | Task | Exit evidence |
| --- | --- | --- | --- |
| `DONE` | `P6-DISC-01` | Select first source fixture and version. | Pagila `pagila-v3.1.0` / `fef96757…ddf90e` is frozen with retained permissive license bytes, PostgreSQL 16.15 UTF8/C runtime, four exact file hashes, fixture digest `c22e7c17…f4fe025d`, and a PostgreSQL-qualified expected estate. |
| `DONE` | `P6-DISC-02` | Define source-adapter contract. | Four strict contracts plus immutable registry/persistence bind adapter/source/runtime/workload authority, semantic read operations, permission evidence, endpoint/data scope, limits, outcomes, denials, errors and recovery. |
| `DONE` | `P6-DISC-03` | Implement read-only source sandbox. | PostgreSQL repeatable-read/read-only transactions reject mutation; endpoint/database/version, query/row/byte/time/concurrency bounds and no-filesystem authority pass five real-server tests. |
| `DONE` | `P6-DISC-04` | Implement system and schema inventory. | Pagila inventory captures database/server/schema/extension coverage plus 30 relations, columns, 58 relation constraints, 56 indexes, 10 routines, 15 triggers, three types, 13 sequences and grants with explicit unavailable scope. |
| `DONE` | `P6-DISC-05` | Implement data profiler. | Bounded profiles record exact row/null/distinct counts and only value digests; missing/denied relations remain explicit and raw sample values are absent. |
| `DONE` | `P6-DISC-06` | Implement code/transform extraction. | Views, materialized views, functions, procedures and triggers are extracted into one checksum-bound artifact with per-object identity/digest and coverage. |
| `DONE` | `P6-DISC-07` | Implement lineage/dependency inference. | Catalog/static/query-log/runtime methods remain distinguished; Pagila yields 36 foreign-key, seven partition, view, trigger, sequence and routine edges with unresolved references retained. |
| `DONE` | `P6-DISC-08` | Implement CDC behavior analysis. | Ten-event trace analysis records snapshot, source-position order, atomic transaction, explicit delete, ordered amendment, DDL, resume checkpoint, duplicate restart and late-event semantics with exact final state. |
| `DONE` | `P6-DISC-09` | Implement claim/observation comparison. | Supported/refuted/unresolved/denied/stale results retain supplied/observed digests and citations; denial cannot prove absence. |
| `DONE` | `P6-DISC-10` | Implement gap ranking. | Impact, uncertainty, blocking, probe cost and risk produce checked deterministic scores/ranks with cheapest probes and exception-only gaps. |
| `DONE` | `P6-DISC-11` | Implement safe-probe planner. | Planner selects the highest-value executable bounded read while retaining unrelated denied scope as an accountable human exception. |
| `DONE` | `P6-DISC-12` | Implement target capability model. | Immutable target versions bind resources, identity/secret refs, operations, idempotency, data class, compatibility, coverage and predecessor; only complete observed capability resolves. |
| `DONE` | `P6-DISC-13` | Generate first estate and migration proposal. | Full Pagila pipeline emits cited estate, gaps, three decisions, observed target, 22 proposed mappings and five dependency/proof/recovery tasks with proposal-only authority. |
| `DONE` | `P6-DISC-14` | Run contradiction experiment. | Sealed `EXP-02` seed 602 detects 8/8 material contradictions, cites 10/10 comparisons, promotes zero false claims and never treats denial as absence. |
| `DONE` | `P6-DISC-15` | Run hidden-estate experiment. | Sealed `EXP-03` seed 603 finds 9/10 planted items, accepts zero decoys, records 2/2 denials and retains proposal-only output. |
| `DONE` | `P6-DISC-16` | Run CDC inference experiment. | Sealed `EXP-04` seed 604 disposes 10/10 events, reaches the exact target state and records explicit semantics with zero gaps. |

### `G6-DISC` — Source understanding gate

Pass when:

- hidden assets and contradictions are detected;
- access denial is not interpreted as absence;
- CDC replay reaches exact expected state;
- every material claim is observed, cited, unresolved, or disproven;
- the system proposes the next evidence action before asking a human;
- generated target design references exact source evidence.

**Gate status: `DONE`.** Hidden assets and contradictions meet threshold; both denials remain evidence rather than absence; CDC replay is exact; all material claims are cited/refuted/denied; a bounded next probe and human exception coexist; and the generated target design/proposal resolves to exact source, target and reasoning records. Evidence: 71 schemas, 11 migrations / 17 tables, fingerprint `7acfcb43…8769156`, 33 unit files / 176 tests, 18 PostgreSQL files / 53 tests, and verified sealed `EXP-02`/`03`/`04`.

Failure route: `L-DISC-01`.

---

# Phase 7 — Evaluation, self-correction, and skill lifecycle

**Goal:** prove that the system catches and repairs bad work instead of grading its own prose.

| Status | Coordinate | Task | Exit evidence |
| --- | --- | --- | --- |
| `DONE` | `P7-EVAL-01` | Implement evaluation contracts. | Four immutable V2 records pin definition/contract lineage, subject and input schema/version/digest, evaluator execution and independence, measures/thresholds, exact evidence, budgets and non-authority; 75 schemas, migration 012, registry reconstruction, task-gate evidence readback, 35 unit files / 188 tests and 19 PostgreSQL files / 54 tests pass. |
| `DONE` | `P7-EVAL-02` | Implement evaluation coordinator. | Product-owned deterministic dispatch creates one independent V2 assignment/outbox message per required evaluator; immutable snapshots preserve missing/contradictory/stale/failure/disagreement as unaccepted, restart reconstruction and unrelated progress pass; registry 76, migration 013, 36 unit files / 194 tests and 20 PostgreSQL files / 55 tests. |
| `DONE` | `P7-EVAL-03` | Implement deterministic schema evaluators. | A pinned no-network/no-filesystem/no-model suite emits immutable report/evidence/result for five hard structural/type/lineage/compatibility/policy checks; critical/benign mutations, stale handling, claim-fenced persistence and redelivery replay pass; registry 78, migration 014, 37 unit files / 201 tests and 21 PostgreSQL files / 56 tests. |
| `DONE` | `P7-EVAL-04` | Implement data movement evaluators. | Exact counts/keys/deletes/order/watermark/replay/dispositions pass the ten-event CDC oracle and localized mutation cases. |
| `DONE` | `P7-EVAL-05` | Implement artifact build evaluators. | Private clean TypeScript builds run twice under pinned compiler/options, prove output digest/provenance and reject compiler, path, manifest and type defects. |
| `DONE` | `P7-EVAL-06` | Implement semantic labeled-case evaluator. | Ten isolated held-out groups score exactly; false accepts fail and abstention/disagreement remain inconclusive. Registry 83, migration 015, 38 unit files / 207 tests and 22 PostgreSQL files / 57 tests pass. |
| `DONE` | `P7-EVAL-07` | Implement acceptance state machine. | Product-only unknown/hypothesis/supported/accepted/rejected/quarantined transitions are immutable and evaluator records cannot self-accept. |
| `DONE` | `P7-EVAL-08` | Implement failed-result diagnosis. | Failed measures map to typed causes, component paths, evidence and open gaps; generic retry is forbidden. |
| `DONE` | `P7-EVAL-09` | Implement correction loop. | A new V2 proposal fixes the attributed scope, preserves the exact evaluator/thresholds and independently passes with delta/usage/history. |
| `DONE` | `P7-EVAL-10` | Implement learning-candidate creation. | Success and failure create only attributable quarantined/no-use candidates. Registry 86, migration 016, 39 unit files / 212 tests and 23 PostgreSQL files / 58 tests pass. |
| `DONE` | `P7-EVAL-11` | Implement skill certification. | Immutable certification pins baseline/candidate artifacts, distinct selection/held-out/adversarial corpora, exact evaluator results, hard improvement, protected/safety slices, cost/latency envelope, repetitions/seeds, unchanged authority, and rollback. |
| `DONE` | `P7-EVAL-12` | Implement skill demotion/revocation. | Product-owned active-pointer lineage promotes only passed certification; an attributed regression atomically revokes the candidate, blocks new resolution, records affected uses/outputs, and restores the certified predecessor. Registry 89, migration 017, 41 unit files / 217 tests and 24 PostgreSQL files / 59 tests pass. |
| `DONE` | `P7-EVAL-13` | Run mutation evaluator experiment. | Sealed `EXP-08` seed 708 kills all 7 schema/mapping/delete/precision/identity/security/recovery defects with exact measure/evidence attribution and rejects 0/4 benign mutations. |
| `DONE` | `P7-EVAL-14` | Run skill lifecycle experiment. | Sealed `EXP-09` seed 709 proves certification, promotion, injected drift detection, automatic demotion, revocation, impact trace, assignment blocking, and rollback. |

### `G7-EVAL` — Independent correction gate

Pass when:

- producer self-review cannot accept work;
- critical seeded defects are detected;
- evaluator failure blocks acceptance but not unrelated work;
- a failed artifact is diagnosed, changed, and independently re-evaluated;
- a regressed skill is automatically stopped and rolled back;
- learning candidates remain quarantined until measured improvement.

**Gate status: `DONE`.** Product-only acceptance and independent coordination prevent producer self-review; evaluator failure remains unaccepted while unrelated work continues; typed diagnosis drives a scoped V2 correction under the unchanged contract; learning candidates remain quarantined/no-use; `EXP-08` kills 7/7 critical mutations with zero benign false rejection; and `EXP-09` revokes the regressed skill and restores its predecessor. Evidence: 89 schemas, 17 migrations / 17 tables, fingerprint `49954cda…1fa28125`, 41 unit files / 217 tests, 24 PostgreSQL files / 59 tests, and verified sealed `EXP-08`/`09`.

Failure route: `L-EVAL-01`.

---

# Phase 8 — Bounded execution, relay, and unknown-effect recovery

**Goal:** perform one real non-production target operation without allowing network uncertainty to create duplicate or unsupported effects.

| Status | Coordinate | Task | Exit evidence |
| --- | --- | --- | --- |
| `DONE` | `P8-EXEC-01` | Implement effect-intent contract. | Immutable V1 remains readable; V2 binds plan/task/attempt/fence, workload/skill identity, exact target/parameters/state, blast radius, expiry, evidence, and recovery. |
| `DONE` | `P8-EXEC-02` | Implement policy/effect gate. | Typed in-process policy checks tenant, attempt, skill, tool, destination/scope, budget, expiry, expected state, data class, idempotency, and recovery before authority exists. |
| `DONE` | `P8-EXEC-03` | Implement capability envelope. | Ed25519-signed V2 capability binds effect/intent/policy, workload/fence, target, adapter/runner, parameters/pre-state, scope, budget, expiry, use limit, and secret lease; modification and unknown keys fail. |
| `DONE` | `P8-EXEC-04` | Implement relay-gateway skeleton. | Signed relay sessions, bounded signed dispatch frames, monotonic sequence/dedup, durable accept acknowledgment, reconnect reconstruction, and fail-closed spool capacity pass. |
| `DONE` | `P8-EXEC-05` | Implement execution-relay skeleton. | Durable local dispatch/request journals, capability/fence/expiry and signed secret-lease checks, sandboxed request preparation, receipt persistence, and restart replay pass. |
| `DONE` | `P8-EXEC-06` | Implement runner sandbox. | Fixed digest-pinned runner code executes in a no-code-generation VM context with no filesystem/process/network globals plus CPU-time, input, output, and retained-memory bounds. |
| `DONE` | `P8-EXEC-07` | Select one target operation. | Disposable PostgreSQL `ensure-marker` is non-production, natural-keyed, idempotent, independently SELECT-observable, and cleanup-safe. |
| `DONE` | `P8-EXEC-08` | Implement target adapter. | Versioned adapter implements typed prepare/apply/inspect/reconcile/cleanup; same-key mismatch and changed-by-other cleanup fail closed. |
| `DONE` | `P8-EXEC-09` | Implement evidence object upload. | Signed time-bound tenant upload grants enforce exact digest, size, type, key, verification, idempotent replay, and orphan cleanup. |
| `DONE` | `P8-EXEC-10` | Implement signed effect receipt. | Ed25519-signed receipts record status, exact target IDs, before/after evidence, adapter/runner/request/idempotency identities, residuals, and observation time. |
| `DONE` | `P8-EXEC-11` | Implement target reconciliation. | Restart reads the immutable pre-request journal and exact target identity; applied/absent/changed/inaccessible states never trigger blind retry. |
| `DONE` | `P8-EXEC-12` | Run kill-point effect experiment. | Sealed `EXP-11` seed 811 passes 50/50 capability/prepare/send/receipt/evidence/ack kill cases, 50 signed receipts, 50 durable evidence pairs, and 50 distinct effects. |
| `DONE` | `P8-EXEC-13` | Run tenant and secret isolation experiment. | Sealed `EXP-12` seed 812 denies 100/100 attributable attacks with zero cross-tenant effects and zero durable raw secrets. |

### `G8-EXEC` — Safe effect gate

Pass when:

- no effect executes outside an active capability envelope;
- no duplicate target mutation occurs under retry or replay;
- a lost response becomes explicit unknown and is reconciled;
- required evidence survives relay/control restarts;
- expired or revoked work cannot mutate the target;
- every seeded tenant/secret attack is denied and attributable.

**Gate status: `DONE`.** V2 effect/policy/capability contracts preserve immutable V1 history; one disposable PostgreSQL marker effect runs only under exact signed authority; 50 kill/restart cases converge without duplicate effects and retain signed evidence; 100 seeded policy/tenant/secret/relay/sandbox/supply-chain attacks are denied. Evidence: 92 schemas, 18 migrations / 17 tables, fingerprint `3686f99d…dd1dd8f`, 42 unit files / 221 tests, 25 PostgreSQL files / 61 tests, and sealed `EXP-11`/`12`. The fixed-code VM sandbox and logical single-database tenancy prove the lab contract, not production hostile-code isolation or enterprise multi-tenancy.

Failure route: `L-EXEC-01`.

---

# Phase 9 — Operator surface and end-to-end integration

**Goal:** connect the proven pieces into one understandable mission flow without making the UI authoritative.

| Status | Coordinate | Task | Exit evidence |
| --- | --- | --- | --- |
| `WAIT` | `P9-INTEG-01` | Implement public mission API. | Create/read/command endpoints are versioned, authenticated, idempotent, and paginated. |
| `WAIT` | `P9-INTEG-02` | Implement durable activity stream. | SSE reconnects from cursor without losing or duplicating logical events. |
| `WAIT` | `P9-INTEG-03` | Implement loose-goal intake view. | User submits outcome, access, priorities, artifacts, and known exceptions without technical design. |
| `WAIT` | `P9-INTEG-04` | Implement estate and evidence view. | Assets, relationships, coverage, provenance, and freshness are navigable. |
| `WAIT` | `P9-INTEG-05` | Implement gap and hypothesis view. | Claims, contradictions, competing hypotheses, tests, and unresolved exceptions are visible. |
| `WAIT` | `P9-INTEG-06` | Implement decision and plan view. | Rationale, alternatives, evidence, reversal condition, tasks, proof, and recovery are shown. |
| `WAIT` | `P9-INTEG-07` | Implement agent and task activity view. | Apex/specialist assignments, budgets, status, outputs, and failures are inspectable. |
| `WAIT` | `P9-INTEG-08` | Implement evaluation and evidence view. | Measures, thresholds, evaluator versions, verdicts, receipts, and artifacts are linked. |
| `WAIT` | `P9-INTEG-09` | Implement exception channel. | Only irreducible questions block dependent work; unrelated work continues. |
| `WAIT` | `P9-INTEG-10` | Implement restart/resume behavior. | Closing UI and restarting services preserves mission and current coordinate. |
| `WAIT` | `P9-INTEG-11` | Assemble first end-to-end scenario. | Loose brief flows through discovery, gap resolution, build, evaluation, effect, reconciliation, and evidence. |

### `G9-INTEG` — Integrated mission gate

Pass when:

- a user can understand what the system knows, decided, did, proved, and still cannot resolve;
- UI disconnect does not stop mission execution;
- every displayed fact resolves to evidence;
- current mission state survives complete service restart;
- all earlier experiment gates still pass through integrated interfaces.

Failure route: `L-INTEG-01`.

---

# Phase 10 — Prototype qualification and review

**Goal:** prove the prototype works from a clean environment, under faults, with repeatable evidence.

| Status | Coordinate | Task | Exit evidence |
| --- | --- | --- | --- |
| `WAIT` | `P10-QUAL-01` | Create clean installation profile. | New machine/environment starts required services and fixtures using documented commands. |
| `WAIT` | `P10-QUAL-02` | Freeze prototype versions and seeds. | Code, model, prompt, skill, corpus, fixture, schema, and configuration versions recorded. |
| `WAIT` | `P10-QUAL-03` | Run golden end-to-end mission. | All working-prototype criteria pass with a complete evidence packet. |
| `WAIT` | `P10-QUAL-04` | Run integrated fault campaign. | Process, database, object, relay, model, evaluator, target, and restart faults preserve invariants. |
| `WAIT` | `P10-QUAL-05` | Run repeatability campaign. | Ten clean runs produce equivalent accepted target state and no unexplained divergence. |
| `WAIT` | `P10-QUAL-06` | Run planning-envelope load test. | 50 missions/100 agents/control-event assumptions measured or revised with bottlenecks named. |
| `WAIT` | `P10-QUAL-07` | Run security/isolation campaign. | Cross-tenant, secret, prompt-injection, artifact, tool, and model-route cases pass. |
| `WAIT` | `P10-QUAL-08` | Audit evidence reconstruction. | Cold reviewer reconstructs who/what/why/when for the complete mission. |
| `WAIT` | `P10-QUAL-09` | Measure baseline comparison. | Prototype compared with scripts/manual baseline on correctness, questions, time, cost, and recovery. |
| `WAIT` | `P10-QUAL-10` | Document capability envelope and gaps. | Supported fixture/versions/actions and explicit unsupported claims published. |
| `WAIT` | `P10-QUAL-11` | Create prototype runbook and demo. | One operator can reproduce normal and failure scenarios without hidden setup. |
| `WAIT` | `P10-QUAL-12` | Conduct prototype review. | Accept, rework, or stop decision recorded with next investment loop. |

### `G10-PROTOTYPE` — Working prototype gate

Pass only when all 14 working-prototype criteria at the top of this document pass.

Failure route: `L-PROT-01`.

---

# Iteration loops

## Standard loop

Every loop follows the same sequence:

```text
Observe failure
→ classify failed invariant or metric
→ identify owning coordinate
→ preserve failing seed and artifact
→ make the smallest change
→ rerun local experiment
→ rerun dependent phase gate
→ update ADR / corpus / memory / threshold
→ return to the blocked coordinate
```

Never fix a failure by weakening its evaluator unless the evaluator itself is proven wrong against independent labels.

## Loop coordinates

| Coordinate | Trigger | Return point | Exit condition |
| --- | --- | --- | --- |
| `L-ARCH-01` | Review or experiment invalidates architecture assumption. | `P0-ARCH-06` or owning ADR task. | Architecture and downstream coordinates updated; invalid assumption removed. |
| `L-RSCH-01` | No candidate has enough evidence or all approaches fail constraints. | Relevant `P1-RSCH-*`. | New alternative or explicit build decision with experiment. |
| `L-LAB-01` | Fixture, license, seed, or experiment is not reproducible. | Owning `P2-LAB-*`. | Clean rerun reproduces expected baseline and fault artifact. |
| `L-KERN-01` | Lost/duplicate state, replay mismatch, stale acceptance, or unrecoverable nonterminal row. | Owning `P3-KERN-*`. | EXP-01 and `G3-KERN` pass from failing seed. |
| `L-AGNT-01` | Ambient leak, post-cancel effect, unbounded process, unsupported result, or apex bluff. | Owning `P4-AGNT-*`. | Containment and disagreement tests pass. |
| `L-KNOW-01` | Wrong/stale/unauthorized recall, poison adoption, unexplained retrieval, or negative task delta. | Owning `P5-KNOW-*`. | Known-answer, isolation, and help/harm benchmarks pass. |
| `L-DISC-01` | Hidden asset missed, false asset accepted, contradiction missed, or CDC state mismatch. | Owning `P6-DISC-*`. | Failing source seed passes and coverage remains explicit. |
| `L-EVAL-01` | Critical defect missed, benign case rejected excessively, evaluator contradiction, or self-correction fails. | Owning `P7-EVAL-*`. | Mutation/calibration gate passes before generator work resumes. |
| `L-EXEC-01` | Duplicate effect, false success/absence, stale authority, missing receipt, or secret leak. | Owning `P8-EXEC-*`. | Failing kill point and full EXP-11/12 suites pass. |
| `L-INTEG-01` | Integrated interface changes semantics or hides evidence/state. | Owning `P9-INTEG-*` and source phase. | Integrated gate plus affected earlier gates pass. |
| `L-PROT-01` | Any working-prototype criterion fails. | Earliest owning phase. | Full clean qualification campaign passes again. |

## Cross-phase regression rule

A later phase may invalidate an earlier gate.

Examples:

- If relay fault injection exposes a ledger race, return to `L-KERN-01`.
- If discovery reveals retrieval poisoning, return to `L-KNOW-01`.
- If the evaluator cannot distinguish a critical semantic defect, stop self-correction work and enter `L-EVAL-01`.
- If load testing breaks the Postgres-first assumption, enter `L-ARCH-01`, update the ADR, then repeat affected kernel and integration gates.

A completed coordinate remains historically completed, but its phase gate becomes `REWORK` until the regression is resolved.

---

# Progress snapshot

| Phase | Gate | Current state |
| --- | --- | --- |
| Phase 0 — Architecture | `G0-ARCH` | `DONE` provisionally; reopens through `L-ARCH-01` |
| Phase 1 — Substrate research and codebase placement | `G1-RSCH` | `DONE`; reopens through `L-RSCH-01` |
| Phase 2 — Lab | `G2-LAB` | `DONE`; reopens through `L-LAB-01` |
| Phase 3 — Kernel | `G3-KERN` | `DONE`; reopens through `L-KERN-01` |
| Phase 4 — Agents | `G4-AGNT` | `DONE`; reopens through `L-AGNT-01` |
| Phase 5 — Knowledge | `G5-KNOW` | `DONE`; reopens through `L-KNOW-01` |
| Phase 6 — Discovery | `G6-DISC` | `DONE`; reopens through `L-DISC-01` |
| Phase 7 — Evaluation | `G7-EVAL` | `DONE` on the current branch; fork delivery pending |
| Phase 8 — Execution | `G8-EXEC` | `WAIT` until the Phase 7 branch merges |
| Phase 9 — Integration | `G9-INTEG` | `WAIT` |
| Phase 10 — Qualification | `G10-PROTOTYPE` | `WAIT` |

## Next roadmap coordinates after current delivery

The [canonical handoff](./agentic-substrate-current-handoff.md) owns the immediate action. After Phase 7 merges:

1. **`P8-EXEC-01`** — Implement effect-intent contract.
2. **`P8-EXEC-02`** — Implement policy/effect gate.
3. **`P8-EXEC-03`** — Implement capability envelope.
