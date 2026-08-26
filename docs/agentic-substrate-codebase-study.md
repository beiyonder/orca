# Agentic Substrate Codebase Study

## Study coordinates

- Roadmap coordinate: `P1-RSCH-01` through `P1-RSCH-16`
- OMP repository: `https://github.com/can1357/oh-my-pi.git`
- Audited OMP revision: `b4e8e856ad40294167679a3f88417c07429fe59b` (`v18.0.6`)
- Local research checkout: ignored `tmp/upstream/oh-my-pi`
- Installed OMP executable observed earlier: `18.0.4`
- Audited Orca revision before this study artifact: `1c8cffdc984a496ea168aa028f08fe8134b917de`
- Licenses: OMP MIT; Orca repository license remains governed by its own root license.
- Completed research card: `docs/agentic-substrate-durable-state-research.md`

The source checkout is intentionally not vendored or committed inside Orca. Only analysis and prototype code that we author belong in the tracked branch.

## Purpose

Answer four questions:

1. What must a stateful, evidence-seeking, self-correcting, self-improving agentic substrate do?
2. Which required mechanics already exist in OMP or Orca?
3. Which mechanics are useful patterns but unsafe or incomplete for the product boundary?
4. What is the smallest integrated slice that closes a meaningful part of the gap and produces hard evidence?

## Audit method

For each capability A0–A7, inspect:

| Audit field | Question |
| --- | --- |
| Responsibility | What observable contract must this capability provide? |
| Inputs/outputs | What typed records cross its boundary? |
| State | What persists, who owns it, and how is it reconstructed? |
| Authority | What can it decide or mutate? |
| Failure | What happens on crash, timeout, duplicate, stale result, malformed input, or cancellation? |
| Evaluation | Which test or external signal proves the capability works? |
| Isolation | How are tenant, process, tool, secret, and context boundaries enforced? |
| Maturity | Is it named, researched, isolated, integrated, domain-tested, or prototype-ready? |
| Reuse disposition | Reuse, adapt, pattern, replace, or missing? |
| Next experiment | What is the cheapest test that could invalidate the disposition? |

Maturity levels:

- `M0` named only;
- `M1` research/source evidence;
- `M2` isolated implementation proof;
- `M3` integrated proof in its current product;
- `M4` migration-shaped pressure proof;
- `M5` complete prototype proof.

## A0–A7 capability contracts

### A0 — Tool agent

Observable contract:

- invoke a model with a bounded context and tool schema;
- stream immutable events;
- validate tool arguments;
- execute tools with cancellation and bounded results;
- return structured output or explicit failure;
- retain enough trace to reconstruct what happened.

Minimum failure cases:

- malformed tool arguments;
- provider interruption after partial output;
- tool timeout/cancellation;
- parallel tool partial failure;
- model refusal;
- context overflow;
- malformed result.

### A1 — Stateful worker

Observable contract:

- preserve session identity and append-only working history;
- compact without losing required commitments/tool results;
- resume or reconstruct after restart;
- recall scoped memory with provenance;
- invalidate harmful or stale memory;
- keep worker memory separate from product truth.

Minimum failure cases:

- partial persistence;
- compaction drops required state;
- stale memory wins over current evidence;
- cross-project/tenant memory leak;
- corrupted session journal;
- resume against changed tools/model/config.

### A2 — Durable mission agent

Observable contract:

- own a long-lived objective outside any worker;
- persist facts, claims, gaps, decisions, plans, tasks, attempts, and evidence references;
- version state transitions;
- reject stale/duplicate completion;
- replay and recover every nonterminal item;
- preserve current mission coordinate across process/UI loss.

Minimum failure cases:

- duplicate command;
- concurrent decision;
- worker dies after effect but before report;
- scheduler dies while work is leased;
- projection corruption;
- unknown external outcome.

### A3 — Orchestrated specialists

Observable contract:

- apex reads durable mission state and chooses the next action;
- specialist roles have typed inputs/outputs/tools/budgets;
- parallel work has explicit ownership and dependencies;
- conflicting results create discriminating evidence work;
- child failure is contained and recoverable;
- orchestration state survives the apex worker.

Minimum failure cases:

- duplicate assignment;
- conflicting specialist answers;
- child exits without structured result;
- budget exhaustion;
- recursive spawn explosion;
- shared-file or shared-effect race;
- apex crash.

### A4 — Evidence-seeking intelligence

Observable contract:

- type information as observation, sourced fact, claim, hypothesis, contradiction, unknown, or disproven claim;
- attach provenance, applicability, tenant, version, and freshness;
- rank gaps by impact and information value;
- retrieve current primary evidence;
- plan bounded probes and experiments;
- abstain or ask the smallest irreducible question.

Minimum failure cases:

- stale source outranks current observation;
- retrieval has no citation;
- denied access becomes assumed absence;
- contradictory facts are silently merged;
- agent reports confidence without discriminating evidence;
- prompt-injected source changes tool authority.

### A5 — Self-correcting system

Observable contract:

- independent evaluator receives exact subject/input/evaluator versions;
- evaluator produces measures, evidence, disagreement, and verdict;
- failed measures create attributed gaps;
- apex revises the responsible decision/artifact/tool/skill;
- re-evaluation uses the same or explicitly revised acceptance contract;
- repeated failure quarantines scope rather than creating endless retries.

Minimum failure cases:

- producer grades itself;
- evaluator is unavailable or contradictory;
- critical defect is missed;
- benign case is falsely rejected;
- correction overfits the visible case;
- retry changes evaluator threshold to pass.

### A6 — Self-improving system

Observable contract:

- accepted outcomes and diagnosed failures create quarantined learning candidates;
- candidate memory/skill/tool/prompt/model-route retains provenance;
- baseline and held-out corpus freeze before optimization;
- promotion requires measured gain without safety/leakage regression;
- every use is traceable;
- drift triggers demotion/revocation and rollback.

Minimum failure cases:

- one success auto-promotes a skill;
- training/evaluation leakage;
- memory feedback amplifies a wrong belief;
- candidate expands authority;
- production drift goes undetected;
- revoked capability still starts new work.

### A7 — Bounded autonomous executor

Observable contract:

- proposed effect carries identity, target, expected state, proof, and recovery obligations;
- policy binds tenant, workload, tool, scope, budget, expiry, and fence;
- external execution returns receipt and target identifiers;
- timeout creates explicit unknown state;
- reconciler reads target reality before retry;
- every effect is auditable and recoverable or quarantined.

Minimum failure cases:

- duplicate delivery;
- stale envelope;
- target applies but receipt is lost;
- relay partitions;
- secret manager fails;
- target read remains ambiguous;
- worker reports success without target proof.

---

# OMP implementation map

## OMP package shape

Primary packages relevant to the substrate:

- `packages/ai` — provider normalization and streaming;
- `packages/agent` — model/tool loop, events, context, compaction;
- `packages/coding-agent` — sessions, RPC, tasks, tools, extensions, memory, advisor, autoresearch;
- `packages/mnemopi` — local working/episodic/fact/graph memory and recall;
- `packages/metaharness` — experiment/run aggregation;
- `packages/wire` and `packages/omptype` — wire/schema machinery;
- Rust/native crates — execution/search/parsing performance, not mission authority.

## OMP capability evidence

| Capability | Exact implementation evidence | What is genuinely present | Maturity in OMP | Product disposition |
| --- | --- | --- | --- | --- |
| `A0` Tool agent | [`Agent`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/agent/src/agent.ts), [`agentLoop`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/agent/src/agent-loop.ts), `packages/coding-agent/src/tools/*` | Provider streaming, tool schema/argument validation, immutable events, cancellation, parallel tools, steering, structured tool results. | `M3` for coding-agent work. | **Reuse** core loop behind product worker contract. |
| `A1` Stateful worker | [`SessionManager`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/session/session-manager.ts), [`AgentSession`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/session/agent-session.ts), [`AppendOnlyContextManager`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/agent/src/append-only-context.ts), compaction, Mnemopi | Append-only session journal, branch/tree/fork, fail-closed indeterminate persistence, compaction, memory backends, resume/recovery. | `M3` for one coding session; product memory quality only `M1`. | **Reuse/adapt** session mechanics; **replace as mission truth**. |
| `A2` Durable mission | `goals/runtime.ts`, `autoresearch/storage.ts`, session todos/goals | Session-scoped goals/budgets; durable autoresearch sessions/runs; session journal. No general mission world model or authoritative long-running workflow. | `M1` patterns. | **Pattern only**; build product mission kernel. |
| `A3` Specialists | [`runStructuredSubagent`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/task/structured-subagent.ts), `task/executor.ts`, [`AgentRegistry`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/registry/agent-registry.ts) | Typed agent definitions/output schemas, spawn/depth policy, worktree isolation, budgets, retries, progress, IRC, registry/status/history. Subagents run inside a parent session and task executor. | `M3` for bounded coding fan-out; apex/durable mission `M1`. | **Reuse/adapt** specialist runner; build apex and durable orchestration. |
| `A4` Evidence seeking | Web search/read/browser tools; `autoresearch` hypothesis/experiment notes; source citations are tool output rather than durable epistemic records. | Strong evidence-gathering tools and a specialized experiment loop. No general fact/claim/gap/contradiction state machine. | `M1`. | **Reuse tools**; build epistemic state/gap engine/context manifest. |
| `A5` Self-correction | [`AdvisorRuntime`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/advisor/runtime.ts), TTSR, `cleanse`, security coordinator, tests/eval tools | Second-model advice, hazardous-output quarantine, rule-triggered stream correction, specialized security/cleanse workflows. No general independent acceptance coordinator tied to exact mission subjects. | `M2` primitives. | **Adapt patterns**; build evaluator and correction state machine. |
| `A6` Self-improvement | [`AutoLearnController`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/autolearn/controller.ts), `managed-skills.ts`, [`Mnemopi`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/mnemopi/src/core/memory.ts), polyphonic recall, episodic graph, `autoresearch`, metaharness | Explicit/automatic lesson capture, editable memories, generated skills, experiments, baseline/kept metrics, recall voices and graph/fact projections. No general held-out certification/promotion/demotion tied to production assignments. | `M2` primitives. | **Reuse/adapt memory and experiment machinery**; build governed learning lifecycle. |
| `A7` Bounded action | [`RpcHostToolBridge`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/modes/rpc/host-tools.ts), RPC mode, approval/tool policies, subprocess/worktree isolation | Host-provided tools, call correlation, updates, cancellation, schemas, process isolation and configurable approvals. Host remains responsible for actual authority and external-effect recovery. | `M2` worker boundary. | **Reuse RPC/host-tool boundary**; build product effect gate, receipts, and reconciler. |

## OMP facts that change the plan

1. OMP is more than a basic tool loop. It already includes:
   - append-only context support;
   - session persistence with indeterminate-write failure handling;
   - structured subagent execution;
   - advisor quarantine;
   - goals and budgets;
   - autoresearch experiment storage;
   - sophisticated local memory and managed skills.
2. These capabilities are optimized for coding sessions and project-local autonomy, not tenant-scoped migration missions.
3. OMP should remain the replaceable worker runtime. Importing its session/task/memory state as product authority would fuse the product to coding-agent assumptions.
4. Audited source is `18.0.6`; the installed executable was `18.0.4`. Prototype work must either align versions or test the skew explicitly.

---

# Orca implementation map

## Orca capability evidence

| Capability | Exact implementation evidence | What is genuinely present | Maturity in Orca | Product disposition |
| --- | --- | --- | --- | --- |
| `A0` Tool agent | `src/shared/tui-agent-config.ts`, PTY/process launch and agent-specific integration | Detects and launches external coding agents; does not implement the model/tool loop. | `M1` integration. | **Keep as optional operator/authoring adapter**, not substrate core. |
| `A1` Stateful worker | `src/main/ai-vault/session-scanner-source-discovery.ts`, worker provider-session pinning, transcript archive | Discovers provider transcripts, pins exact provider sessions/process incarnations, preserves bounded/redacted output. No internal semantic memory or context manager. | `M2` visibility/recovery patterns. | **Adapt evidence capture patterns**; OMP owns worker-session mechanics. |
| `A2` Durable mission | `src/main/runtime/orchestration/types.ts`, `db/schema/create-core-tables-sql.ts`, `db/tasks/task-store.ts`, run/delivery stores | Durable runs, tasks, dependencies, messages, dispatch contexts, worker states, deliveries, mutation receipts, questions, coordinator state. | `M2/M3` for Orca orchestration. | **Adapt semantics**, but build a product-owned domain ledger rather than extending terminal orchestration into migration truth. |
| `A3` Specialists | Orchestration task/dispatch APIs, group addressing, worker terminal ownership, federation, decision gates | Coordinates external terminal agents, broadcasts to groups, promotes dependent tasks, tracks worker reports. Identity and lifecycle remain coupled to terminal handles/panes/process incarnations. | `M2`. | **Adapt task/attempt/message concepts**; replace terminal identity and human-gate assumptions. |
| `A4` Evidence seeking | AI Vault/session visibility, source-control/artifact/search tooling | Good operator visibility and code/search surfaces. No persistent fact/claim/hypothesis/gap model. | `M0/M1`. | **Reuse UI patterns**, build epistemic system. |
| `A5` Self-correction | AI recovery features and product-specific checks exist, but orchestration completion trusts bounded worker lifecycle plus caller logic rather than general independent evaluation. | Recovery/help patterns, not a universal evaluator/correction loop. | `M0/M1`. | **Build** evaluation coordinator and correction loop. |
| `A6` Self-improvement | Skill install/share surfaces and agent-session history exist; no certified learning lifecycle. | Distribution/visibility mechanics only. | `M0/M1`. | **Reuse operator/registry surfaces**, build promotion/demotion and measured learning. |
| `A7` Bounded action | `worker-dispatch-authority.ts`, `lifecycle-reconciliation.ts`, mutation receipts, federation relay, `relay-transport.ts`, `relay-session-broker.ts`, artifacts RPC | Transactional worker capability hashes, stale/unauthorized completion rejection, idempotent mutation receipts, unknown start/stop states, sequence/ack/replay, bounded WebSocket transport, reconnect, output archive. | `M2/M3` for terminal/mobile control. | **Adapt strongly** for workload identity, capability envelopes, effect receipts, target reconciliation, and customer-zone relays. |

## Orca facts that change the plan

1. Orca already contains more durable distributed-control semantics than a normal desktop agent UI:
   - task versus dispatch identity;
   - dependency promotion;
   - process incarnation and capability checks;
   - stale completion rejection;
   - idempotent mutation receipts;
   - unknown worker start/stop states;
   - replayable federated delivery;
   - bounded relay transport;
   - evidence capture before terminal release.
2. These semantics are valuable, but their concrete identities are terminal/worktree/runtime concepts.
3. Reusing the semantics is safer than embedding the current orchestration database as the migration ledger.
4. Orca is the likely operator/authoring shell and a source of tested control patterns, not the product authority kernel.

---

# Superimposed maturity map

| Level | OMP contribution | Orca contribution | Combined maturity | Missing delta |
| --- | --- | --- | --- | --- |
| `A0` Tool agent | Full worker loop and tools. | Launch/integration shell. | `M3` | Product-specific tool schemas and isolation profile. |
| `A1` Stateful worker | Session, context, compaction, memory. | Session discovery and output archive. | `M2/M3` | Tenant-scoped context manifest; memory validation/harm measurement; version alignment. |
| `A2` Durable mission | Goals/autoresearch patterns only. | Durable task/dispatch/run patterns. | `M2` patterns, `M0` product | New mission/evidence/gap/decision/plan ledger independent of terminals and OMP sessions. |
| `A3` Specialists | Strong bounded subagent executor. | Durable external-worker coordination. | `M2` | Apex next-action policy; evidence-based disagreement; durable specialist assignments not tied to panes. |
| `A4` Evidence seeking | Strong tools; narrow autoresearch loop. | Visibility/search surfaces. | `M1` | Epistemic record types, gap ranking, active probe planner, citations/freshness/context manifest. |
| `A5` Self-correction | Advisor/TTSR/cleanse/security primitives. | Narrow recovery patterns. | `M1/M2` primitives | Independent evaluator coordinator, exact subject versioning, diagnosis, revise/retest/quarantine loop. |
| `A6` Self-improvement | Memory, managed skills, experiments. | Skill/operator surfaces. | `M1/M2` primitives | Quarantine, held-out certification, promotion envelope, usage trace, drift, demotion, rollback. |
| `A7` Bounded execution | RPC host-tool boundary. | Capability, receipt, stale-rejection, relay patterns. | `M2` | Tenant/workload effect envelope, secret lease, target adapter, signed receipt, unknown-effect read reconciliation. |
| `A8` Integrated substrate | Not present. | Not present. | `M0` | Assemble A2–A7 around one authority and evidence model. |

## Net assessment

We are ahead on mechanics and behind on intelligence governance.

Strong starting assets:

- model/tool runtime;
- worker sessions and compaction;
- bounded subagents;
- memory primitives;
- experiments and advisor patterns;
- durable task/attempt semantics;
- stale-authority rejection;
- relay/reconnect and artifact patterns.

Largest gaps:

1. durable evidence-backed mission/world state;
2. fact/claim/gap/hypothesis representation;
3. apex next-action and disagreement-resolution policy;
4. independent evaluation and correction lifecycle;
5. governed memory/skill promotion and demotion;
6. product effect envelope and target reconciliation;
7. tenant/data-class isolation across every layer.

---

# Delta-to-experiment map

| Delta | First experiment | Pass signal | Build/reuse starting point |
| --- | --- | --- | --- |
| Durable mission state | Crash/replay a goal, assignment, result, evaluation, and correction. | No lost/double transition; identical projection after restart. | Adapt Orca task/dispatch invariants; new product schema. |
| Epistemic world model | Feed conflicting docs and observations. | All contradictions explicit; no unsupported fact promoted. | New component using OMP research tools. |
| Apex orchestration | Give two specialists conflicting evidence. | Apex requests a discriminating test or preserves a true tie. | OMP structured subagents + product mission state. |
| Context provenance | Re-run exact assignment from manifest. | Same sources/exclusions/redactions; every used claim cited. | OMP session/RPC + new context assembler. |
| Independent evaluator | Seed one critical and one benign defect. | Critical defect rejected; benign case accepted; evidence reproducible. | OMP eval/subagent primitives + new evaluation records. |
| Correction loop | Fail artifact, diagnose, revise, re-evaluate. | Second version passes without changing threshold; delta recorded. | Apex + evaluator + durable gaps/decisions. |
| Validated memory | Seed helpful and poisoned lessons. | Helpful memory improves result; poison is rejected/invalidated. | Mnemopi + product validation/use trace. |
| Skill lifecycle | Promote then inject regression. | New assignments stop; prior version restores. | OMP managed skills + new certification registry. |
| Bounded effect | Lose target response after commit. | No duplicate; target read resolves applied/absent/unknown. | OMP host tool + Orca capability/receipt/relay patterns. |
| Tenant isolation | Seed cross-tenant context/memory/artifact/tool IDs. | Zero disclosure/effect; every denial attributable. | New tenant envelope around every reused component. |

---

# Selected first integrated substrate slice

## Slice S1 — Evidence-correcting mission loop

Purpose: close a meaningful A2–A6 gap without pretending to migrate data yet.

Flow:

```text
1. Create durable mission with one loose technical objective.
2. Store two conflicting source artifacts as claims/evidence.
3. Apex creates a gap and assigns two OMP specialists.
4. Specialists return typed answers and citations.
5. Apex requests one deterministic discriminating check.
6. Mission records a versioned decision and artifact proposal.
7. Independent evaluator rejects a seeded critical defect.
8. Failure becomes an attributed gap.
9. Apex revises the artifact without changing the evaluator threshold.
10. Evaluator accepts version two.
11. System creates a quarantined memory candidate describing the diagnosed failure.
12. Kill and restart the control process and OMP worker at seeded points.
13. Replay produces one accepted decision/artifact and no duplicate transition.
```

### What S1 intentionally excludes

- source connector;
- CDC;
- cloud account;
- Databricks mutation;
- remote relay;
- production PHI;
- autonomous skill promotion.

Those arrive only after the core correction loop is real.

### S1 required components

- small product-owned mission/event store;
- gap/hypothesis records;
- assignment and context-manifest records;
- OMP RPC gateway using pinned version;
- two typed specialist definitions;
- deterministic evaluator;
- correction coordinator;
- candidate-memory quarantine;
- replay/fault test harness;
- CLI or minimal inspection page for evidence.

### S1 success criteria

1. Every used claim cites one of the two source artifacts.
2. Conflicting evidence cannot silently become one fact.
3. Seeded critical defect is rejected on first attempt.
4. Second artifact passes the unchanged evaluator.
5. Process/worker restarts do not lose or duplicate accepted state.
6. Memory candidate is quarantined and never influences the same run.
7. Complete state/evidence trace is inspectable from one run ID.

## Next execution coordinates

1. `P1-RSCH-01` — complete: A0–A7 contracts and initial maturity rubric are recorded here.
2. `P1-RSCH-02` through `P1-RSCH-09` — deepen implementation research where this first audit is shallow.
3. `P1-RSCH-10` — finish symbol/test-level OMP audit at pinned `v18.0.6` and compare installed `18.0.4`.
4. `P1-RSCH-11` — finish symbol/test-level Orca audit at current branch.
5. `P1-RSCH-12`/`13` — turn this preliminary map into a verified code/maturity graph.
6. `P1-RSCH-14` — examine external projects only for confirmed gaps.
7. `P1-RSCH-15` — approve or revise Slice S1, then implement it in the isolated prototype lab.
8. `P1-RSCH-16` — update ADRs and executable experiment queue from the completed study.
