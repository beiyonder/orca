# Durable Mission State and Workflow Research Card

## Coordinate

`P1-RSCH-02` — durable state and workflow implementations

## Decision summary

For the first integrated substrate slice, use a **product-owned explicit mission state machine backed by PostgreSQL**:

- commands with idempotency keys;
- append-only domain events;
- current relational projections;
- transactional outbox/inbox;
- explicit tasks, attempts, leases, fencing, effects, evaluations, and recovery dispositions;
- a reconciler that advances state from recorded facts rather than replaying model code.

Use **DBOS TypeScript as the first challenger experiment**, because it can store durable workflow state in PostgreSQL and can atomically commit application changes with a DBOS transaction checkpoint.

Do not select Temporal, Restate, Hatchet, LangGraph, Inngest, or River as the S1 authority layer now. They remain research-backed alternatives for specific future pressure points.

This is a prototype decision, not a final production lock.

## Why this problem is unusual

A migration mission is not a fixed order-processing workflow.

It is:

- long-running;
- partially observed;
- dynamically replanned;
- driven by nondeterministic model work;
- dependent on changing source/target reality;
- gated by evidence and independent evaluation;
- able to quarantine part of the graph while unrelated work continues;
- required to reconstruct why every decision and effect happened;
- unable to rely on exactly-once external APIs.

The durable engine must therefore preserve **domain truth and evidence**, not merely resume code at the last checkpoint.

## Adaptive reasoning, deterministic authority

The architecture is intentionally asymmetric:

| Adaptive and nondeterministic | Strict and deterministic |
| --- | --- |
| What to investigate next | Whether the caller has current authority |
| Which hypothesis best explains evidence | Whether the proposal cites admissible evidence |
| How to decompose or reorder work | Whether the proposal is based on the current mission version |
| Whether to add, remove, split, merge, or supersede tasks | Whether task/effect state transitions are legal |
| Which specialist/model/tool to try | Whether tool, budget, tenant, scope, expiry, and fence are valid |
| How to revise architecture or mappings | Whether an external effect has a stable identity and recovery contract |
| Whether a new evaluator or skill is needed | Whether required independent evaluation passed |
| How to respond to new source/target reality | Whether history, evidence, and receipts remain immutable and attributable |

The kernel does not decide the best migration plan. It decides whether a proposed change may become durable state or a real effect.

### Mission control loop

```text
read current mission/evidence state
→ run nondeterministic apex assignment
→ receive typed plan delta + rationale + evidence refs
→ deterministic validation against current version/policy
→ atomically commit accepted delta
→ dispatch bounded tasks
→ ingest observations/evaluations/effects
→ repeat from the new state
```

The apex assignment is never replayed to reconstruct state. Its exact input manifest and output are recorded. After a crash, a new apex worker reads the current durable state and may make a different—but still valid—next decision.

### Dynamic plan model

- A `PlanRevision` is immutable after commit.
- A new revision points to its base revision, reason, evidence, and authoring attempt.
- The active plan pointer advances only from the expected base version.
- A revision carries deltas: add task, split task, merge task, add/remove dependency, block, cancel, quarantine, or supersede.
- Completed/issued history is never rewritten.
- A task already producing an external effect cannot simply disappear; its effect must be reconciled and then accepted, repaired, compensated, or quarantined.
- Superseded tasks retain their attempts/results as evidence and cannot later advance the new plan.
- Unaffected runnable branches continue while one scope is replanned or quarantined.

### Where a durable workflow framework may fit

A framework may execute bounded, deterministic subflows such as:

- retry one source metadata scan;
- wait for a timer or callback;
- run a fixed evaluator fan-out;
- upload and verify evidence;
- monitor one effect reconciliation.

It must not encode the entire evolving migration mission as one replayed workflow function. Product mission state remains the input and output of those bounded subflows.

## Required contracts

| ID | Priority | Requirement | Failure if absent |
| --- | --- | --- | --- |
| `DUR-REQ-01` | MUST | Mission identity and state outlive every worker, model, UI, and deployment. | Restart loses objective, gaps, decisions, or progress. |
| `DUR-REQ-02` | MUST | Every accepted aggregate transition uses an expected version. | Concurrent controllers both advance mission truth. |
| `DUR-REQ-03` | MUST | Duplicate commands/messages are safe and payload mismatch is rejected. | Retry creates duplicate tasks/effects or changes meaning. |
| `DUR-REQ-04` | MUST | Task and attempt are separate; one current attempt owns authority. | Late worker output overwrites a newer attempt. |
| `DUR-REQ-05` | MUST | State transition and dispatch/outbox commit atomically. | Work is committed but never dispatched, or dispatched without state. |
| `DUR-REQ-06` | MUST | Dynamic plans can add, block, quarantine, supersede, or cancel work without rewriting history. | Agentic replanning fights a rigid workflow definition. |
| `DUR-REQ-07` | MUST | Evidence and evaluation gates are part of state transitions. | Worker completion is mistaken for accepted correctness. |
| `DUR-REQ-08` | MUST | External effect outcomes include applied, absent, unknown, failed, accepted, rejected, and quarantined. | Timeout becomes false success or blind retry. |
| `DUR-REQ-09` | MUST | Every nonterminal item has restart reconciliation. | Missions remain permanently stuck after process loss. |
| `DUR-REQ-10` | MUST | Product state is queryable relationally by tenant, mission, asset, gap, task, effect, evidence, and time. | Operators and evaluators cannot inspect or reconstruct reality. |
| `DUR-REQ-11` | MUST | Code/model/skill/context versions are pinned to every attempt. | Replay or diagnosis cannot reproduce the invocation. |
| `DUR-REQ-12` | MUST | Customer-hosted operation works with limited infrastructure and no public control dependency. | Regulated/private deployments cannot run. |
| `DUR-REQ-13` | SHOULD | Go and Bun workers can participate through versioned contracts. | Runtime choice becomes an accidental architecture lock. |
| `DUR-REQ-14` | SHOULD | Fault injection can stop at every persistence, dispatch, execution, receipt, and evaluation boundary. | Recovery remains theoretical. |
| `DUR-REQ-15` | SHOULD | Long history can archive/compact without losing reconstructability. | Multi-month missions exceed storage/history limits. |
| `DUR-REQ-16` | MUST | Nondeterministic reasoning is persisted as an assignment/result, never re-executed to reconstruct committed mission state. | Replay demands the model make the same decision and freezes adaptive planning. |
| `DUR-REQ-17` | MUST | Plans are immutable revisions with validated deltas and explicit supersession. | Replanning rewrites history or allows obsolete tasks to regain authority. |

## First-principles split

The substrate needs two separate concepts:

### Domain authority

Owns:

- mission and estate versions;
- facts, claims, gaps, hypotheses, decisions;
- plans and tasks;
- attempt authority;
- effect intents and receipts;
- evaluation assignments and verdicts;
- evidence references;
- memory/skill lifecycle events.

### Durable execution machinery

Provides:

- work claiming;
- timers and wakeups;
- retries and backoff;
- cancellation;
- heartbeats;
- process recovery;
- queueing and concurrency;
- worker version routing.

A generic workflow engine may provide the second. It must not silently become the sole owner of the first.

## Existing Orca mechanics

Orca already proves useful distributed-control patterns:

- `runs`, `tasks`, `dispatch_contexts`, `worker_dispatches`, and `coordinator_runs`;
- task dependencies and ready promotion;
- separate task and dispatch identities;
- process incarnation and capability hashes;
- explicit `start_unknown` and `stop_unknown` worker states;
- stale/unauthorized completion rejection;
- idempotent mutation receipts keyed by caller/request/payload;
- outstanding delivery records and consumer generations;
- federated sequence/ack/replay records;
- bounded worker output archive before resource release.

Primary paths:

- `src/main/runtime/orchestration/types.ts`
- `src/main/runtime/orchestration/db/schema/create-core-tables-sql.ts`
- `src/main/runtime/orchestration/db/schema/create-graph-tables-sql.ts`
- `src/main/runtime/orchestration/db/tasks/task-store.ts`
- `src/main/runtime/orchestration/db/worker-dispatch/worker-dispatch-authority.ts`
- `src/main/runtime/orchestration/lifecycle-reconciliation.ts`
- `src/main/runtime/orchestration/db/mutation-receipts/mutation-receipt-store.ts`
- `src/main/runtime/orchestration/federation-sync.ts`

Limits:

- SQLite and process-global desktop runtime;
- identities tied to terminal handles, pane keys, worktrees, and runtime epochs;
- task specs/results are broad text/JSON rather than product domain records;
- no append-only mission event model;
- no product evidence/evaluation gate;
- no external target-effect reconciliation.

Disposition: **adapt invariants and tests; do not promote Orca’s current database to migration authority.**

## Existing OMP mechanics

OMP already provides durable worker-session mechanics:

- `SessionManager` append-only conversation journal;
- atomic entry batches and repair;
- `SessionPersistenceIndeterminateError` that latches persistence uncertainty and fails closed;
- `AgentSession` lifecycle, recovery, continuation, tool/result persistence;
- append-only context and compaction;
- goals and token/wall-clock budgets;
- persisted autoresearch sessions/runs/metrics;
- structured subagent execution and registry;
- RPC commands/events/host tools.

Primary pinned source:

- [`SessionManager`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/session/session-manager.ts)
- [`AgentSession`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/session/agent-session.ts)
- [`AppendOnlyContextManager`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/agent/src/append-only-context.ts)
- [`runStructuredSubagent`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/task/structured-subagent.ts)
- [`RpcHostToolBridge`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/modes/rpc/host-tools.ts)

Limits:

- journal is conversation/agent working history, not a multi-tenant mission ledger;
- goal state is session-scoped;
- task/subagent execution is parent-session scoped;
- no authoritative mission aggregate version;
- no domain effect/evaluation state machine;
- no relational estate/gap/evidence query model.

Disposition: **reuse worker/session mechanics; keep mission authority outside OMP.**

---

# Candidate comparison

## 1. Product-owned PostgreSQL state machine and reconciler

Shape:

```text
command
→ validate expected aggregate version + idempotency
→ append domain event
→ update current projection
→ create outbox/work row
→ COMMIT
→ reconciler claims work with lease/fence
→ worker observation/evaluation/effect receipt returns
→ next guarded transition
```

Strengths:

- one authority for domain records and dispatch intent;
- exact relational model for mission/evidence/gaps/effects;
- fully dynamic graph and state transitions;
- AI decisions are recorded results, not replayed nondeterministic code;
- lowest infrastructure count for initial customer-hosted POC;
- direct adaptation of tested Orca invariants;
- easy fault injection at explicit transitions.

Costs:

- we must implement and test scheduler/reconciler/timers/versioning;
- no free workflow UI or mature worker-version machinery;
- risk of slowly rebuilding a generic workflow engine;
- correctness burden remains ours.

Best use: **authoritative mission state and first S1 baseline.**

## 2. DBOS TypeScript

Primary evidence:

- [Why DBOS](https://docs.dbos.dev/why-dbos)
- [TypeScript workflows](https://docs.dbos.dev/typescript/tutorials/workflow-tutorial)
- [Transactions and datasources](https://docs.dbos.dev/typescript/tutorials/transaction-tutorial)
- [MIT TypeScript repository](https://github.com/dbos-inc/dbos-transact-ts)

Observed behavior:

- PostgreSQL-backed durable workflows;
- resume from completed step checkpoints;
- workflow ID as idempotency key;
- deterministic workflow step order;
- steps may retry and must handle side-effect uncertainty;
- datasource transactions atomically commit application writes and a DBOS checkpoint;
- TypeScript package has chaos tests and workflow versioning/patching support.

Fit:

- strongest challenger because product rows and a DBOS checkpoint can share PostgreSQL transaction scope;
- TypeScript aligns with Orca, while OMP remains a Bun child/gateway;
- materially less infrastructure than Temporal/Hatchet.

Risks:

- workflow replay/deterministic-step constraints may fight dynamic AI replanning;
- official runtime compatibility must be tested under our Node/Bun split;
- DBOS system schema becomes an additional framework contract;
- external target effects still require our idempotency and reconciliation;
- long-lived version/patch operations must be proven.

Disposition: **run a focused challenger spike; do not make it domain authority by assumption.**

## 3. Temporal

Primary evidence:

- [Workflow model and replay](https://docs.temporal.io/workflows)
- [Workflow execution](https://docs.temporal.io/workflow-execution)
- [Architecture](https://github.com/temporalio/documentation/blob/main/docs/encyclopedia/architecture/temporal-architecture.mdx)
- [Self-hosting](https://github.com/temporalio/documentation/blob/main/docs/production-deployment/self-hosted-guide/deployment.mdx)
- [MIT server repository](https://github.com/temporalio/temporal)

Observed behavior:

- mature event-history replay and long-running workflows;
- deterministic workflow code with activities for external work;
- signals, queries, timers, task queues, retry, cancellation, continue-as-new, worker versioning;
- Go and TypeScript SDKs;
- self-hosted Temporal Server plus persistence/visibility stores and schema operations.

Strengths:

- strongest generic durability/recovery/versioning platform in the comparison;
- mature operational model and polyglot workers;
- excellent for fixed or moderately dynamic sagas, timers, and activities.

Risks for this product:

- Temporal Event History becomes a second state authority beside our mission/evidence ledger;
- nondeterministic AI decisions cannot safely live inside replayed workflow code unless recorded as activities/events;
- dynamic mission graphs and evidence queries still require product tables;
- self-hosted operations are materially heavier than one product PostgreSQL;
- external target “commit but lost activity result” still requires idempotency/reconciliation;
- long histories need continue-as-new and careful versioning.

Disposition: **do not use for S1; reconsider when timers/schedules/retries/worker versioning dominate custom-kernel complexity.**

## 4. Restate

Primary evidence:

- [Durable execution and service model](https://docs.restate.dev/foundations/key-concepts)
- [Services, Virtual Objects, and Workflows](https://docs.restate.dev/foundations/services)
- [Database integration guidance](https://docs.restate.dev/guides/databases)
- [Server repository](https://github.com/restatedev/restate)

Observed behavior:

- journaled durable handlers;
- TypeScript, Go, Python, Java/Kotlin, and Rust SDKs;
- Virtual Objects with isolated key state and single-writer consistency;
- workflows with one run handler per ID and durable promises;
- single binary or HA server cluster.

Strengths:

- strong key-scoped state and concurrency model;
- simpler server shape than Temporal;
- attractive for stateful agents and control-plane resources.

Risks:

- Virtual Object state is K/V and owned by Restate; product still needs relational mission/evidence queries;
- external PostgreSQL and Restate state can create cross-system coordination;
- server is Business Source License 1.1, not open source until its change date; allowed internal/customer deployments require legal/product review;
- another authoritative state system complicates audit/reconstruction.

Disposition: **research candidate, not S1 baseline.**

## 5. Hatchet

Primary evidence:

- [Hatchet v1 overview](https://docs.hatchet.run/v1/)
- [MIT repository](https://github.com/hatchet-dev/hatchet)

Observed behavior:

- PostgreSQL-backed, self-hostable durable task/workflow platform;
- TypeScript, Go, Python, and Ruby SDKs;
- tasks, workers, workflows, retries, replay, checkpointing, concurrency/fairness/priority, monitoring.

Strengths:

- agent/task-oriented product shape;
- multi-language and self-hosting;
- operational dashboard and concurrency features.

Risks:

- full platform overlaps heavily with our operator/control product;
- task durability is not the same as domain mission/evidence authority;
- product still needs its own state, evaluation, effect, and reconciliation model;
- adopting it early may replace a small reconciler with a large platform dependency.

Disposition: **candidate for later high-parallelism task execution, not S1 authority.**

## 6. River

Primary evidence:

- [Transactional enqueueing](https://riverqueue.com/docs/transactional-enqueueing)
- [Unique jobs](https://riverqueue.com/docs/unique-jobs)

Observed behavior:

- PostgreSQL job queue for Go;
- transactional enqueue with application writes;
- unique-job/dedup constraints;
- at-least-once worker execution.

Strengths:

- simple and close to our PostgreSQL-first model;
- useful if the control kernel is Go;
- avoids writing generic queue claiming/backoff code.

Limits:

- job queue, not durable mission workflow or domain ledger;
- no apex/evidence/effect/evaluation semantics;
- Go-only integration boundary.

Disposition: **possible implementation helper after final kernel-language decision.**

## 7. LangGraph

Primary evidence:

- [Persistence and stores](https://docs.langchain.com/oss/python/langgraph/persistence)

Observed behavior:

- thread-scoped graph checkpoints;
- cross-thread key/value stores;
- pause/resume, time travel, and fault tolerance for graph execution.

Fit:

- useful reference for agent graph state and interactive interrupts.

Limits:

- not a product mission/effect authority;
- external state/effect consistency remains application responsibility;
- would overlap with OMP for agent runtime and orchestration.

Disposition: **research pattern only.**

## 8. Inngest

Primary evidence:

- [Durable function execution](https://www.inngest.com/docs/learn/how-functions-are-executed)
- [Self-hosting](https://www.inngest.com/docs/self-hosting)

Observed behavior:

- persisted step outputs, retries, pause/resume, event-driven execution;
- TypeScript, Python, and Go functions;
- self-hosted architecture includes event API/stream, runner, queue, executor, state store, database, API, and dashboard.

Fit and risks:

- strong event/function development experience;
- self-hosting adds a complete execution platform and current docs explicitly do not guarantee direct support for self-hosted instances;
- does not remove need for product mission/evidence authority.

Disposition: **not S1 baseline.**

---

# Decision matrix

Legend: `Strong`, `Partial`, `Weak`. “Strong” means the candidate directly supports the requirement; it does not mean the full product behavior is already solved.

| Requirement | Product PostgreSQL | DBOS | Temporal | Restate | Hatchet | River | LangGraph | Inngest |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Domain authority/query model | Strong | Strong with app tables | Partial | Partial | Partial | Weak | Weak | Partial |
| Crash/restart durability | Must build | Strong | Strong | Strong | Strong | Strong for jobs | Strong for graph | Strong |
| Dynamic AI replanning | Strong explicit state | Partial deterministic steps | Partial deterministic workflow | Strong handlers/state | Partial workflow DAG | Weak | Strong graph | Partial steps |
| Product transition + dispatch atomicity | Strong | Strong with datasource/enqueue transaction | Weak across separate stores | Partial inside Restate state | Partial | Strong | Weak | Partial |
| Stale attempt/fencing | Must build; Orca patterns | Must add domain guard | Workflow/activity identity, domain guard still needed | Key serialization; domain fence still needed | Task identity; domain guard needed | Unique jobs only | Application responsibility | Function/step identity; domain guard needed |
| Evidence/evaluation gates | Strong custom | Custom app state | Custom app state | Custom app/VO state | Custom app state | Weak | Custom graph state | Custom app state |
| Unknown external effect | Must build | Must build | Must build in activities | Must build around external call | Must build | Must build | Must build | Must build |
| One low-ops customer-hosted store | Strong | Strong/partial | Weak | Partial | Partial | Strong | Depends saver | Weak/partial |
| Go + TypeScript/Bun fit | Protocol-neutral | TS strong; Bun test needed | Strong SDKs | Strong SDKs | Strong SDKs | Go only | Python/JS ecosystem | Strong SDKs |
| Relational audit and reconstruction | Strong | Strong app DB + framework tables | Partial via product DB + Temporal history | Partial KV + analytics/export | Partial platform + product DB | Weak | Weak | Partial |
| License/product control | Full | MIT | MIT | BSL 1.1 | MIT | Verify before adoption | OSS package-specific | Verify self-host/product terms |
| S1 complexity | Medium build | Low/medium | High | Medium | Medium/high | Low helper only | Medium overlap | High self-host stack |

## Decision

### Selected S1 authority baseline

**Product-owned PostgreSQL explicit state machine and reconciler.**

Reasons:

1. The hard product problem is the domain state model: evidence, gaps, decisions, attempts, effects, evaluations, and learning—not generic retry syntax.
2. Nondeterministic model decisions are persisted as results and events. They are never reconstructed by replaying model code.
3. Dynamic replanning is a domain transition, not a workflow-code patch.
4. Event + projection + outbox can commit in one database transaction.
5. Relational state is directly inspectable and reconstructable.
6. Initial load does not justify another durable-execution service.
7. Orca provides tested invariants and failure cases to adapt.

### Selected challenger

**DBOS TypeScript spike.**

It is the closest alternative because it uses PostgreSQL and can atomically commit product changes with durability checkpoints. It could reduce scheduler/recovery code if it passes our dynamic-replan, versioning, inspectability, and runtime tests.

### Explicit non-decision

The final production kernel language remains open.

For S1, a TypeScript/Bun control prototype is acceptable if it accelerates OMP integration and preserves language-neutral schemas. Go remains the production control/relay hypothesis. The prototype must test semantics, not prove a language preference.

## Reversal conditions

Replace or augment the custom reconciler when measured evidence shows one of:

- timer/schedule/retry code becomes a dominant maintenance burden;
- worker-version routing cannot be handled safely;
- queue age or database contention misses the planning envelope;
- recovery bugs persist after focused experiments;
- DBOS/Temporal/another engine passes the same domain/fault suite with less code and equal inspectability;
- customer operations already standardize on one candidate and its extra authority boundary is acceptable.

Do not reverse because a framework demo looks simpler.

---

# Experiments

## `DUR-EXP-01` — Explicit PostgreSQL state machine

Fixture:

- one S1 mission;
- two specialist assignments;
- one deterministic evidence check;
- first artifact rejected;
- second artifact accepted;
- candidate memory created;
- crash points before/after every transaction and dispatch.

Pass:

- zero duplicate accepted transitions;
- zero lost terminal state;
- stale attempt rejected;
- identical projection after replay;
- every nonterminal row reconciles;
- event/projection/outbox atomicity proven.

## `DUR-EXP-02` — DBOS challenger

Implement the same S1 flow with:

- explicit product domain tables;
- DBOS workflow/steps;
- datasource transaction where applicable;
- identical crash points and state/evidence output.

Measure:

- implementation size and custom recovery code;
- dynamic replan friction;
- workflow versioning behavior;
- inspectability of domain state versus framework state;
- TypeScript runtime and OMP/Bun integration;
- fault and replay results;
- operational dependencies.

Pass as preferred substrate only if:

- all `DUR-EXP-01` invariants pass;
- no domain transition is hidden only in DBOS internals;
- dynamic correction does not require unsafe workflow-history surgery;
- version deployment is operationally credible;
- total product-owned durability code and operational burden are materially lower.

## `DUR-EXP-03` — Temporal reference spike only if needed

Do not build now. Trigger only if DBOS/custom comparison leaves unresolved timer, worker-version, or long-running recovery risk.

Use one workflow with activities representing OMP assignments/evaluations and product tables representing mission authority. Measure dual-state reconciliation and operational cost.

## `DUR-EXP-04` — External unknown effect

Shared across every candidate:

- external adapter commits effect;
- process dies before durable receipt;
- workflow engine retries/resumes;
- product reconciler reads target by stable effect key.

Pass:

- no duplicate mutation;
- engine-level “exactly once” claim is not used as target proof;
- final state is applied, absent, failed, or quarantined with evidence.

## `DUR-EXP-05` — Adaptive replan across crash

Fixture:

- mission starts with plan revision R1;
- one specialist observation invalidates a core assumption;
- apex attempt A proposes revision R2-A;
- crash before or after the plan-delta transaction;
- replacement apex attempt B reads current state and may propose a different valid R2-B;
- old R1 tasks report late results.

Pass:

- zero or one R2 revision commits from expected base R1, never two;
- a pre-commit crash permits a different valid replacement proposal;
- a post-commit crash preserves the committed revision without replaying apex reasoning;
- late superseded-task output remains evidence and cannot advance R2;
- already-issued effects are reconciled rather than erased;
- unaffected branches remain runnable;
- history shows why R1 was superseded and which evidence justified R2.

## Current environment prerequisite

This workstation had no Docker binary during the earlier harness check. The PostgreSQL experiments therefore require one explicit setup choice in `P2-LAB`:

- native PostgreSQL installation;
- approved container runtime installation;
- or a remote isolated PostgreSQL test service.

SQLite/PGlite may be used for interface tests, but cannot prove PostgreSQL locking, isolation, queue claims, or failover behavior.

## Next coordinate

`P1-RSCH-03` — research epistemic world models, active gap resolution, uncertainty, and abstention.
