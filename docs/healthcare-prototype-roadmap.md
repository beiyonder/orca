# Autonomous Migration Prototype Roadmap

## Current coordinate

**`P1-RSCH-02` — Research durable state and workflow implementations.**

Current artifacts already exist:

- `docs/healthcare-autonomous-migration-research-plan.md`
- `docs/healthcare-system-design-mvp.html`
- `docs/agentic-substrate-codebase-study.md`

The product and technical architecture are provisional pressure maps, not final specifications. The current move is to define what a top-tier stateful, evidence-seeking, self-correcting, self-improving agentic system must do; research how those capabilities are implemented; then audit Orca and OMP against that progression line before choosing the first substrate build slice.

## How to use coordinates

Format:

```text
P<phase>-<track>-<task>
```

Example:

```text
P4-AGNT-08
```

Means:

- Phase 4
- Agent runtime and orchestration track
- Task 8

Gate format:

```text
G<phase>-<track>
```

Loop format:

```text
L-<track>-<number>
```

When discussing work, always name the coordinate:

> “We are at `P4-AGNT-08`: implement the apex next-action loop.”

Do not say only “we are working on orchestration.”

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
6. At the end of every work session, report:
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
| `A1 — Stateful worker` | Sessions, context compaction, resumable working history, scoped memory. | **Partial/strong mechanics:** OMP sessions, compaction, Mnemopi, recall/retain/reflect. Memory quality and authority separation are not product-proven. |
| `A2 — Durable mission agent` | Goal, world model, tasks, attempts, decisions, and recovery survive any worker. | **Patterns only:** Orca has durable task/dispatch/run semantics; no migration mission kernel or evidence-backed world model exists. |
| `A3 — Orchestrated specialists` | Apex agent decomposes, delegates, compares disagreement, and changes plan from evidence. | **Partial primitives:** OMP subagents and Orca orchestration exist; no proven apex controller or evidence-based disagreement loop. |
| `A4 — Evidence-seeking intelligence` | Distinguishes facts/claims/gaps, researches, probes, cites, and abstains. | **Mostly missing:** tools exist, but no durable epistemic state, gap engine, or retrieval acceptance contract. |
| `A5 — Self-correcting system` | Independent evaluation detects failure, diagnoses cause, revises work, and re-tests. | **Missing as a system:** tests/tools exist; no product evaluation coordinator or closed correction loop. |
| `A6 — Self-improving system` | Accepted outcomes create candidate memory/skills/routes that are held-out tested, promoted, monitored, and demoted. | **Primitive only:** OMP memory/skills exist; certification, promotion, drift, demotion, and harm tracing are missing. |
| `A7 — Bounded autonomous executor` | Performs real actions with identity, policy, idempotency, receipts, reconciliation, and rollback/repair. | **Patterns only:** Orca has capabilities, receipts, relay, stale-attempt rejection, and recovery patterns; no migration effect protocol exists. |
| `A8 — Integrated agentic substrate` | A0–A7 operate as one replayable, observable, secure system. | **Not assembled.** |
| `A9 — Migration capability pack` | Substrate gains discovery, CDC, mapping, platform, semantic, and migration-evaluation skills. | **Not started beyond architecture/research inventory.** |
| `A10 — Working migration prototype` | One loose goal becomes a discovered, built, evaluated, executed, recovered, evidenced migration POC. | **Not started.** |

### Honest current position

We are not at zero, and we are not yet at a durable intelligent system.

```text
A0 Tool agent                 OMP: strong
A1 Stateful worker            OMP: partial/strong mechanics
A2 Durable mission            Orca: useful patterns, product layer missing
A3 Specialist orchestration   OMP + Orca: partial primitives
A4–A6 Intelligence loops      mostly missing
A7 Bounded execution          Orca patterns only
A8–A10 Integrated product     not built
```

The next research wave must turn A0–A7 into a capability contract, then map exact Orca/OMP symbols and tests onto it. Only then do we pick the smallest A2–A6 integration slice to build.

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
| `CURRENT` | `P1-RSCH-02` | Research durable state and workflow implementations. | Mission identity, replay, timers, attempts, effects, and crash recovery approaches compared. |
| `WAIT` | `P1-RSCH-03` | Research epistemic world models and gap resolution. | Fact/claim/hypothesis/unknown state, active information gathering, uncertainty, and abstention approaches compared. |
| `WAIT` | `P1-RSCH-04` | Research apex and specialist orchestration. | Hierarchical, graph, blackboard, planner/executor, debate, and state-machine approaches compared. |
| `WAIT` | `P1-RSCH-05` | Research context, retrieval, and live research. | Context assembly, provenance, freshness, tool research, GraphRAG/hybrid retrieval, and citation evaluation compared. |
| `WAIT` | `P1-RSCH-06` | Research long-term agent memory. | Working, episodic, semantic, procedural, failure, and evaluation memory implementations compared on help/harm and invalidation. |
| `WAIT` | `P1-RSCH-07` | Research evaluation and self-correction. | Verifiers, process supervision, mutation tests, critics, search/refinement, external feedback, and closed correction loops compared. |
| `WAIT` | `P1-RSCH-08` | Research self-improvement and skill learning. | Skill libraries, curriculum, prompt/tool/model optimization, held-out promotion, drift, demotion, and rollback compared. |
| `WAIT` | `P1-RSCH-09` | Research bounded action and recovery. | Capability security, sandboxing, idempotency, receipts, external-effect reconciliation, and fault containment compared. |
| `WAIT` | `P1-RSCH-10` | Audit OMP code against A0–A7. | Exact packages, symbols, protocols, tests, limitations, and extension points mapped to each capability. |
| `WAIT` | `P1-RSCH-11` | Audit Orca code against A0–A7. | Exact orchestration, task/attempt, relay, artifact, process, recovery, and UI code mapped to each capability. |
| `WAIT` | `P1-RSCH-12` | Build combined capability-to-code map. | Each capability is classified reuse, adapt, pattern, replace, or missing with evidence. |
| `WAIT` | `P1-RSCH-13` | Place Orca/OMP on maturity progression. | A0–A7 carry M0–M5 maturity, proven behavior, missing behavior, and next experiment. |
| `WAIT` | `P1-RSCH-14` | Research strongest open-source gap fillers. | Missing capabilities have credible external candidates or explicit build rationale. |
| `WAIT` | `P1-RSCH-15` | Select first integrated substrate slice. | Smallest slice exercises durable state + OMP worker + evidence + evaluator + correction under one repeatable fixture. |
| `WAIT` | `P1-RSCH-16` | Update ADRs and executable experiment queue. | Research/code-audit findings change the roadmap without locking untested architecture. |

### `G1-RSCH` — Substrate understanding gate

Pass when:

- A0–A7 capability contracts exist;
- primary-source implementation research covers every capability;
- exact Orca and OMP symbols/tests are mapped;
- current maturity and gaps are explicit;
- strongest reuse/adapt/build alternatives are named;
- the first integrated substrate POC slice and its evaluator are selected.

Failure route: `L-RSCH-01`.

---

# Phase 2 — Prototype lab, fixtures, and benchmark infrastructure

**Goal:** build the laboratory in which architecture claims can fail cheaply and reproducibly.

| Status | Coordinate | Task | Exit evidence |
| --- | --- | --- | --- |
| `WAIT` | `P2-LAB-01` | Select prototype implementation location. | Repo/package boundaries and build commands chosen without disturbing Orca production code. |
| `WAIT` | `P2-LAB-02` | Select prototype language/runtime cuts. | Go/Bun/polyglot baseline accepted or revised after research. |
| `WAIT` | `P2-LAB-03` | Create deterministic test clock and IDs. | Replays produce stable ordering, leases, and fault timing. |
| `WAIT` | `P2-LAB-04` | Create fault-injection framework. | Named kill points cover database, process, network, object, evaluator, and target boundaries. |
| `WAIT` | `P2-LAB-05` | Create run artifact format. | Every experiment writes config, seed, inputs, outputs, traces, metrics, verdict, and environment versions. |
| `WAIT` | `P2-LAB-06` | Acquire licensed relational source fixture. | Exact revision, license, checksum, schema, and expected baseline recorded. |
| `WAIT` | `P2-LAB-07` | Create CDC and schema-drift traces. | Snapshot, update, delete, late, amendment, DDL, restart, and checkpoint-loss cases exist. |
| `WAIT` | `P2-LAB-08` | Create misleading customer artifacts. | Diagrams/docs contain known omissions and contradictions against fixture reality. |
| `WAIT` | `P2-LAB-09` | Create seeded defect corpus. | Critical and benign schema, mapping, precision, identity, delete, and semantic mutations labeled. |
| `WAIT` | `P2-LAB-10` | Create cross-tenant negative fixtures. | Context, memory, cache, artifact, tool, relay, and log leakage attempts exist. |
| `WAIT` | `P2-LAB-11` | Create baseline non-agent implementation. | Simple scripts/manual baseline measure discovery, mapping, execution, and evaluation without apex intelligence. |
| `WAIT` | `P2-LAB-12` | Implement experiment runner. | One command executes a fixture/seed, captures artifacts, and reports pass/fail thresholds. |

### `G2-LAB` — Reproducible laboratory gate

Pass when:

- a clean machine can install and run the lab;
- licenses and checksums are recorded;
- the same seed produces the same non-model state transitions;
- every fault point produces an inspectable artifact;
- baselines exist before agent optimization begins.

Failure route: `L-LAB-01`.

---

# Phase 3 — Durable control kernel

**Goal:** prove that mission state survives crashes, retries, duplicates, and stale workers before adding intelligent behavior.

| Status | Coordinate | Task | Exit evidence |
| --- | --- | --- | --- |
| `WAIT` | `P3-KERN-01` | Define versioned domain contracts. | Mission, evidence, gap, decision, plan, task, attempt, effect, evaluation, and learning schemas compile. |
| `WAIT` | `P3-KERN-02` | Implement database migrations. | Empty and upgraded databases converge to the same schema with checksums. |
| `WAIT` | `P3-KERN-03` | Implement command idempotency. | Duplicate identical commands replay result; mismatched payload reuse is rejected. |
| `WAIT` | `P3-KERN-04` | Implement aggregate event append. | Expected-version transaction rejects concurrent conflicting updates. |
| `WAIT` | `P3-KERN-05` | Implement transactional projections. | Event, current projection, and outbox update atomically. |
| `WAIT` | `P3-KERN-06` | Implement outbox and inbox. | At-least-once delivery and duplicate import preserve one logical outcome. |
| `WAIT` | `P3-KERN-07` | Implement plan DAG validation. | Cycles, missing dependencies, incompatible contracts, and missing recovery rules are rejected. |
| `WAIT` | `P3-KERN-08` | Implement task and attempt lifecycle. | Pending, runnable, leased, running, evaluating, terminal, blocked, and quarantined transitions are guarded. |
| `WAIT` | `P3-KERN-09` | Implement leases and fencing. | One authoritative attempt exists; stale attempt output cannot advance the task. |
| `WAIT` | `P3-KERN-10` | Implement effect state machine. | Prepared, issued, applied, absent, unknown, failed, evaluating, accepted, and rejected states are explicit. |
| `WAIT` | `P3-KERN-11` | Implement replay and projection rebuild. | Dropped projections rebuild exactly from verified event position. |
| `WAIT` | `P3-KERN-12` | Implement restart reconciliation. | Nonterminal tasks and attempts receive deterministic recovery dispositions. |
| `WAIT` | `P3-KERN-13` | Run durable-convergence experiment. | EXP-01 passes all crash, duplicate, stale, and restart seeds. |

### `G3-KERN` — Durable kernel gate

Pass when:

- no injected crash loses accepted state;
- no duplicate/stale message advances state twice;
- projections rebuild exactly;
- every nonterminal record has a recovery path;
- task completion is impossible without the current attempt and required evaluation.

Failure route: `L-KERN-01`.

---

# Phase 4 — OMP agent runtime and apex orchestration

**Goal:** run replaceable intelligence workers without giving them state authority or ambient customer access.

| Status | Coordinate | Task | Exit evidence |
| --- | --- | --- | --- |
| `WAIT` | `P4-AGNT-01` | Implement agent-gateway process supervisor. | Gateway starts, observes, cancels, and cleans one child without leaking resources. |
| `WAIT` | `P4-AGNT-02` | Generate isolated OMP environment. | No user home, credentials, hooks, MCP servers, skills, or config leak into assignment. |
| `WAIT` | `P4-AGNT-03` | Implement OMP RPC frame handling. | Ready, negotiate, chunk, response, event, host-tool, cancel, and error frames are bounded and validated. |
| `WAIT` | `P4-AGNT-04` | Implement context-manifest delivery. | Exact sources, versions, exclusions, redactions, tenant, and budget are recorded. |
| `WAIT` | `P4-AGNT-05` | Implement typed assignment result. | Unsupported prose-only completion is rejected; gaps and evidence refs are required. |
| `WAIT` | `P4-AGNT-06` | Implement host-tool capability bridge. | Tool call requires active attempt, capability, schema, budget, and policy. |
| `WAIT` | `P4-AGNT-07` | Implement cancellation and revocation. | No tool effect starts after cancellation/revocation acknowledgement. |
| `WAIT` | `P4-AGNT-08` | Define specialist-agent contracts. | Source, architecture, CDC, mapping, research, security, build, evaluation, and recovery roles have typed contracts. |
| `WAIT` | `P4-AGNT-09` | Implement apex next-action loop. | Apex reads durable mission state, chooses one action, dispatches, and records proposed decision without owning state. |
| `WAIT` | `P4-AGNT-10` | Implement disagreement-resolution loop. | Competing specialist results create a discriminating evidence request or explicit unresolved tie. |
| `WAIT` | `P4-AGNT-11` | Test process reconstruction. | Killed worker restarts from assignment/context/ledger without hidden live state. |
| `WAIT` | `P4-AGNT-12` | Run OMP containment experiment. | EXP-10 passes malformed frame, flood, cancellation, context, subagent, and crash cases. |
| `WAIT` | `P4-AGNT-13` | Run specialist disagreement experiment. | EXP-05 meets supported-choice, citation, and abstention thresholds. |

### `G4-AGNT` — Bounded intelligence gate

Pass when:

- an OMP worker can be killed and replaced safely;
- ambient state is absent;
- host tools are revocable;
- every assignment has a reproducible context manifest;
- apex and specialists cannot directly advance authoritative state;
- disagreement triggers evidence gathering rather than voting or bluffing.

Failure route: `L-AGNT-01`.

---

# Phase 5 — Knowledge, memory, and capability substrate

**Goal:** provide cited, scoped knowledge and useful memory without letting retrieval become authority.

| Status | Coordinate | Task | Exit evidence |
| --- | --- | --- | --- |
| `WAIT` | `P5-KNOW-01` | Implement corpus manifest model. | Every source has owner, license, version, checksum, data class, scope, and freshness policy. |
| `WAIT` | `P5-KNOW-02` | Implement immutable source ingestion. | Original objects and parse versions are preserved and addressable. |
| `WAIT` | `P5-KNOW-03` | Implement chunks and relational metadata. | Documents, schemas, code, entities, edges, and applicability are queryable with provenance. |
| `WAIT` | `P5-KNOW-04` | Implement lexical retrieval baseline. | Known-answer benchmark returns cited current sources without vector search. |
| `WAIT` | `P5-KNOW-05` | Add optional semantic retrieval. | Vector path improves measured coverage without violating scope or citation requirements. |
| `WAIT` | `P5-KNOW-06` | Implement bounded graph expansion. | Multi-hop retrieval uses typed edges and remains traceable to source evidence. |
| `WAIT` | `P5-KNOW-07` | Implement retrieval authorization. | Tenant, data class, purpose, source, and version filters reject unauthorized candidates before ranking. |
| `WAIT` | `P5-KNOW-08` | Implement context assembler. | Selected and excluded items, scores, redactions, and token budget form a reproducible manifest. |
| `WAIT` | `P5-KNOW-09` | Implement memory candidate model. | Mission, episodic, procedural, failure, and evaluator memories enter quarantine with provenance. |
| `WAIT` | `P5-KNOW-10` | Implement memory validation/invalidation. | Memory can be promoted, expired, deprecated, revoked, and traced to every downstream use. |
| `WAIT` | `P5-KNOW-11` | Implement skill registry skeleton. | Typed skill versions, tools, evaluators, envelope, compatibility, and lifecycle are persisted. |
| `WAIT` | `P5-KNOW-12` | Run retrieval benchmark. | EXP-06 meets coverage, citation, freshness, and authorization thresholds. |
| `WAIT` | `P5-KNOW-13` | Run memory help/harm benchmark. | EXP-07 proves positive task effect, poison rejection, invalidation, and zero cross-tenant recall. |

### `G5-KNOW` — Knowledge and memory gate

Pass when:

- every used claim cites an allowed source/version;
- known stale and unauthorized sources are rejected;
- memory use is measurable and reversible;
- poisoned memory cannot become mission fact;
- the same context manifest can be reconstructed;
- graph/vector machinery remains derived and replaceable.

Failure route: `L-KNOW-01`.

---

# Phase 6 — Source discovery and gap resolution

**Goal:** prove the system can learn an ugly source estate rather than merely summarize supplied documentation.

| Status | Coordinate | Task | Exit evidence |
| --- | --- | --- | --- |
| `WAIT` | `P6-DISC-01` | Select first source fixture and version. | Licensed fixture, exact revision, runtime, checksum, and expected estate documented. |
| `WAIT` | `P6-DISC-02` | Define source-adapter contract. | Capabilities, versions, permissions, evidence, limits, errors, and recovery are typed. |
| `WAIT` | `P6-DISC-03` | Implement read-only source sandbox. | Adapter cannot write source; network/filesystem/time/data limits are enforced. |
| `WAIT` | `P6-DISC-04` | Implement system and schema inventory. | Catalogs, objects, columns, keys, indexes, views, routines, and grants are captured. |
| `WAIT` | `P6-DISC-05` | Implement data profiler. | Counts, nulls, uniqueness, distributions, anomalies, samples, and explicit coverage are recorded. |
| `WAIT` | `P6-DISC-06` | Implement code/transform extraction. | Stored procedures, queries, ETL definitions, schedules, and source references are linked. |
| `WAIT` | `P6-DISC-07` | Implement lineage/dependency inference. | Static, runtime, query-log, and declared edges remain distinguished by provenance. |
| `WAIT` | `P6-DISC-08` | Implement CDC behavior analysis. | Snapshot boundary, ordering, transaction, delete, amendment, DDL, restart, and checkpoint behavior are inferred/tested. |
| `WAIT` | `P6-DISC-09` | Implement claim/observation comparison. | Supplied artifacts are compared with discovered reality; contradictions become gaps. |
| `WAIT` | `P6-DISC-10` | Implement gap ranking. | Gaps carry impact, hypotheses, evidence, cheapest test, and exception conditions. |
| `WAIT` | `P6-DISC-11` | Implement safe-probe planner. | System selects bounded evidence-gathering actions before escalating. |
| `WAIT` | `P6-DISC-12` | Implement target capability model. | Available target resources, identity, limits, versions, and operations are discovered. |
| `WAIT` | `P6-DISC-13` | Generate first estate and migration proposal. | Cited estate model, gaps, decisions, target design, mappings, and build plan produced. |
| `WAIT` | `P6-DISC-14` | Run contradiction experiment. | EXP-02 detects all material seeded false claims without unsupported promotion. |
| `WAIT` | `P6-DISC-15` | Run hidden-estate experiment. | EXP-03 meets planted asset/dependency and denial thresholds. |
| `WAIT` | `P6-DISC-16` | Run CDC inference experiment. | EXP-04 reaches exact target state and explicit event disposition after replay. |

### `G6-DISC` — Source understanding gate

Pass when:

- hidden assets and contradictions are detected;
- access denial is not interpreted as absence;
- CDC replay reaches exact expected state;
- every material claim is observed, cited, unresolved, or disproven;
- the system proposes the next evidence action before asking a human;
- generated target design references exact source evidence.

Failure route: `L-DISC-01`.

---

# Phase 7 — Evaluation, self-correction, and skill lifecycle

**Goal:** prove that the system catches and repairs bad work instead of grading its own prose.

| Status | Coordinate | Task | Exit evidence |
| --- | --- | --- | --- |
| `WAIT` | `P7-EVAL-01` | Implement evaluation contracts. | Assignment/result schemas pin subject, inputs, evaluator, metrics, thresholds, and evidence. |
| `WAIT` | `P7-EVAL-02` | Implement evaluation coordinator. | Independent runners are assigned; missing/contradictory evaluation remains unresolved. |
| `WAIT` | `P7-EVAL-03` | Implement deterministic schema evaluators. | Structural, type, contract, compatibility, and policy defects are reproducibly detected. |
| `WAIT` | `P7-EVAL-04` | Implement data movement evaluators. | Counts, keys, deletes, ordering, watermarks, replay, and explicit disposition are checked. |
| `WAIT` | `P7-EVAL-05` | Implement artifact build evaluators. | Generated code/config builds from clean inputs and records provenance/digests. |
| `WAIT` | `P7-EVAL-06` | Implement semantic labeled-case evaluator. | Small held-out domain corpus has labels, scorer, disagreement, and abstention behavior. |
| `WAIT` | `P7-EVAL-07` | Implement acceptance state machine. | Unknown, hypothesis, supported, accepted, rejected, and quarantined transitions are enforced. |
| `WAIT` | `P7-EVAL-08` | Implement failed-result diagnosis. | Failed measures create attributed gaps instead of generic retry prompts. |
| `WAIT` | `P7-EVAL-09` | Implement correction loop. | Apex revises decision/artifact/skill, reruns independent evaluation, and records the delta. |
| `WAIT` | `P7-EVAL-10` | Implement learning-candidate creation. | Accepted results and diagnosed failures create quarantined memory/skill candidates. |
| `WAIT` | `P7-EVAL-11` | Implement skill certification. | Frozen baseline, held-out corpus, safety, cost, latency, envelope, and rollback are required. |
| `WAIT` | `P7-EVAL-12` | Implement skill demotion/revocation. | Injected regression prevents new assignment and restores prior version. |
| `WAIT` | `P7-EVAL-13` | Run mutation evaluator experiment. | EXP-08 catches every seeded critical defect within false-rejection limit. |
| `WAIT` | `P7-EVAL-14` | Run skill lifecycle experiment. | EXP-09 proves promotion, drift detection, demotion, revocation, and rollback. |

### `G7-EVAL` — Independent correction gate

Pass when:

- producer self-review cannot accept work;
- critical seeded defects are detected;
- evaluator failure blocks acceptance but not unrelated work;
- a failed artifact is diagnosed, changed, and independently re-evaluated;
- a regressed skill is automatically stopped and rolled back;
- learning candidates remain quarantined until measured improvement.

Failure route: `L-EVAL-01`.

---

# Phase 8 — Bounded execution, relay, and unknown-effect recovery

**Goal:** perform one real non-production target operation without allowing network uncertainty to create duplicate or unsupported effects.

| Status | Coordinate | Task | Exit evidence |
| --- | --- | --- | --- |
| `WAIT` | `P8-EXEC-01` | Implement effect-intent contract. | Tool, target, parameters, expected state, proof, identity, and recovery are explicit. |
| `WAIT` | `P8-EXEC-02` | Implement policy/effect gate. | Tenant, attempt, skill, tool, scope, budget, expiry, and expected state are checked. |
| `WAIT` | `P8-EXEC-03` | Implement capability envelope. | Immutable effect identity, fence, expiry, digests, and authority scope are signed/verified. |
| `WAIT` | `P8-EXEC-04` | Implement relay-gateway skeleton. | Outbound relay authenticates, reconnects, receives bounded sequenced work, and returns acknowledgments. |
| `WAIT` | `P8-EXEC-05` | Implement execution-relay skeleton. | Local spool, fence/expiry check, secret lease, sandbox launch, and receipt persistence work. |
| `WAIT` | `P8-EXEC-06` | Implement runner sandbox. | CPU, memory, time, filesystem, process, and network limits are enforced. |
| `WAIT` | `P8-EXEC-07` | Select one target operation. | Operation is non-production, stable-keyed, idempotent or read-reconcilable, and independently observable. |
| `WAIT` | `P8-EXEC-08` | Implement target adapter. | Prepare, apply, inspect, reconcile, and cleanup behavior are typed and versioned. |
| `WAIT` | `P8-EXEC-09` | Implement evidence object upload. | Time-bound tenant key, checksum, size/type limit, verification, and orphan cleanup work. |
| `WAIT` | `P8-EXEC-10` | Implement signed effect receipt. | Applied/absent/unknown/failed, target IDs, before/after evidence, and runner identity recorded. |
| `WAIT` | `P8-EXEC-11` | Implement target reconciliation. | Unknown effect is read and classified without blind retry. |
| `WAIT` | `P8-EXEC-12` | Run kill-point effect experiment. | EXP-11 passes every request/commit/receipt/evaluation/acknowledgment kill point. |
| `WAIT` | `P8-EXEC-13` | Run tenant and secret isolation experiment. | EXP-12 reports zero cross-tenant disclosures/effects and zero durable raw secrets. |

### `G8-EXEC` — Safe effect gate

Pass when:

- no effect executes outside an active capability envelope;
- no duplicate target mutation occurs under retry or replay;
- a lost response becomes explicit unknown and is reconciled;
- required evidence survives relay/control restarts;
- expired or revoked work cannot mutate the target;
- every seeded tenant/secret attack is denied and attributable.

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
| Phase 1 — Substrate research and codebase placement | `G1-RSCH` | `CURRENT` at `P1-RSCH-02` |
| Phase 2 — Lab | `G2-LAB` | `WAIT` |
| Phase 3 — Kernel | `G3-KERN` | `WAIT` |
| Phase 4 — Agents | `G4-AGNT` | `WAIT` |
| Phase 5 — Knowledge | `G5-KNOW` | `WAIT` |
| Phase 6 — Discovery | `G6-DISC` | `WAIT` |
| Phase 7 — Evaluation | `G7-EVAL` | `WAIT` |
| Phase 8 — Execution | `G8-EXEC` | `WAIT` |
| Phase 9 — Integration | `G9-INTEG` | `WAIT` |
| Phase 10 — Qualification | `G10-PROTOTYPE` | `WAIT` |

## Immediate next three coordinates

1. **`P1-RSCH-02`** — Research durable state and workflow implementations.
2. **`P1-RSCH-03`** — Research epistemic world models, active gap resolution, uncertainty, and abstention.
3. **`P1-RSCH-04`** — Research apex and specialist orchestration.
