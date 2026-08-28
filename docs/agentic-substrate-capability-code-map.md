# Verified Agentic-Substrate Capability-to-Code Map

## Coordinates

- `P1-RSCH-12` — combined capability-to-code disposition map
- source audits:
  - `docs/agentic-substrate-omp-audit.md`
  - `docs/agentic-substrate-orca-audit.md`

## Disposition vocabulary

| Disposition | Meaning |
| --- | --- |
| `REUSE` | Consume the existing implementation behind a narrow adapter; its current contract remains useful. |
| `ADAPT` | Preserve tested semantics/invariants and possibly code, but introduce product-owned domain types/state/authority. |
| `PATTERN` | Reuse the idea, tests or failure model; do not make the current implementation a product dependency/owner. |
| `REPLACE` | Current implementation is useful in its own domain but must not occupy the product authority role. |
| `MISSING` | No adequate implementation exists in OMP or Orca; build and prove it. |
| `DEFER` | Explicitly outside S1; preserve only the seam and re-entry trigger. |

A row may carry more than one disposition when its mechanics and authority have different outcomes.

## Final ownership rule

```text
Product kernel owns:
mission, estate, evidence, epistemic state, decisions, plan revisions,
assignments/attempts, evaluator contracts/results, memory/skill lifecycle,
effect intent/policy/capability/receipt/recovery, tenant/data policy.

OMP owns:
one replaceable model/tool worker session, its transient context/tool loop,
worker transcript and worker-local nested micro-work.

Orca owns:
operator/authoring shell, live desktop terminals/worktrees, UI preferences,
optional external-agent compatibility and product API presentation.
```

Neither an OMP transcript nor an Orca terminal-orchestration row becomes migration truth.

---

# A0 — Tool agent

| Existing component | Evidence | Disposition | Product boundary |
| --- | --- | --- | --- |
| OMP `Agent`, `agentLoop`, `AgentEvent`, `AgentTool` | `packages/agent/src/{agent,agent-loop,types}.ts`; large agent/loop suites. | `REUSE` | Model/provider/tool loop behind one product assignment. |
| OMP provider normalization and tool schema validation | `packages/ai/*`, `toolWireSchema`, `validateToolArguments`. | `REUSE` | Pin OMP version and expose only assignment tools. |
| OMP concrete read/search/eval/code tools | `packages/coding-agent/src/tools/*`, `web/search/*`. | `REUSE` selectively | Read/probe/build tools return candidate evidence/artifacts. Product effects use host gateway only. |
| OMP Bash/general filesystem tools | approval/time/output/process controls and tests. | `PATTERN` for production; `REUSE` only in isolated research/build jobs | Never give broad customer credentials/ambient target authority. |
| Orca TUI agent catalog and terminal launcher | `TUI_AGENT_CONFIG`, `OrcaRuntimeService.create/ensure/launchAgentSession`. | `REUSE` as optional operator compatibility; `REPLACE` as substrate worker path | Headless product path uses OMP RPC, not prompt scraping. |
| Orca PTY/process lifecycle | exact process/descendant termination and status tests. | `ADAPT` | Worker supervisor/process evidence around OMP. |
| Product `WorkerInvocation` adapter | No current component. | `MISSING` | Pins assignment/context/model/tools/skill/output schema/budget/fence and converts output to proposal/evidence. |

## A0 decision

Use OMP directly as the model/tool runtime. Do not build another agent loop in Orca or the product kernel.

---

# A1 — Stateful worker

| Existing component | Evidence | Disposition | Product boundary |
| --- | --- | --- | --- |
| OMP `SessionManager`/`AgentSession` | append-only JSONL, atomic persistence, branches/artifacts/retry/compaction tests. | `REUSE` | Worker-session evidence and resumability only. |
| OMP `AppendOnlyContextManager`/compaction | stable prefix, append-only log, fingerprints and compaction tests. | `REUSE` internally; `ADAPT` at assignment boundary | Product compiles exact initial context; OMP may manage within-turn/session budget. |
| OMP Mnemopi/Hindsight adapters | memory facade, scopes, recall/consolidation/recovery tests. | `ADAPT` / `DEFER` backend choice | Product memory registry governs eligibility/use/invalidation; backend is replaceable. |
| Orca AI Vault scanners/parsers/cache | heterogeneous native/WSL/SSH session visibility and exact parser tests. | `REUSE` UI/compatibility; `PATTERN` for product records | Product worker view links canonical assignment/output, not discovered transcript first. |
| Orca exact provider-session pin/output archive | `selectExactWorkerProviderSession`, bounded/redacted transcript and archive. | `ADAPT` strongly | Capture exact OMP transcript/artifact evidence before worker release. |
| Orca process incarnation/terminal liveness | pane/process/launch identity and recovery. | `ADAPT` | Replace pane as authority with assignment/attempt/fence; retain process proof. |
| Product `ContextManifest` compiler | No existing authority. | `MISSING` | Exact eligible/retrieved/excluded/redacted sources and rendered digest. |
| Product governed memory registry | No existing lifecycle authority. | `MISSING` | Candidate/version/use/consolidation/invalidation/impact. |

## A1 decision

Reuse OMP session mechanics; add product context and memory governance outside the session. Reuse Orca’s exact-session/output observability.

---

# A2 — Durable mission

| Existing component | Evidence | Disposition | Product boundary |
| --- | --- | --- | --- |
| OMP Goal/Todo state | session objective/budget/status, phased todo and reminder tests. | `PATTERN` | Worker UX only; no product mission authority. |
| OMP autoresearch SQLite state | experiment session/run reconstruction, baseline/best and keep/revert. | `PATTERN` | Experiment harness, not mission aggregate. |
| OMP session journal | durable conversation/custom entries. | `REPLACE` as mission authority | Store as worker evidence only. |
| Orca run/task/dependency schema | durable rows, atomic task readiness and graph tests. | `ADAPT` strongly | New product `Mission`/`Assignment` records with domain IDs and invariants. |
| Orca dispatch context/worker report settlement | exact attempt, assignee/process authority, stale/duplicate rejection. | `ADAPT` strongly | Product `AssignmentAttempt`/lease/fence/result proposal. |
| Orca messages/deliveries/questions/gates | durable batches, consumer generations, replay, exact threads. | `ADAPT` selectively | Typed outbox/inbox/exception records; free-form mail is never authority. |
| Orca durable mutation receipts | caller/request/method/payload, pending/completed/unknown. | `ADAPT` strongly | Product command idempotency and external-effect ingress. |
| Orca current orchestration database | SQLite terminal/worktree domain. | `REPLACE` as migration kernel | Keep serving Orca desktop orchestration; do not add migration truth columns. |
| Product PostgreSQL command/event/projection/outbox kernel | No current implementation. | `MISSING` | Sole mission/evidence/decision/plan/effect/evaluation authority. |
| DBOS TypeScript challenger | External research candidate. | `DEFER` challenger spike | Must use same product schema/state machine and datasource transaction. |

## A2 decision

Create a clean product kernel. Port Orca invariants/tests, not the terminal schema.

---

# A3 — Specialist orchestration

| Existing component | Evidence | Disposition | Product boundary |
| --- | --- | --- | --- |
| OMP `runStructuredSubagent` | strict schema, depth/spawn/tool/model/isolation/budget/artifact policy and tests. | `REUSE`/`ADAPT` | One top-level OMP RPC worker per product specialist assignment. |
| OMP nested task executor | concurrency, worktree isolation, progress, yield/schema, cancellation. | `REUSE` for optional micro-work | Nested results collapse into parent assignment; no product authority. |
| OMP registry/lifecycle/IRC/Hub | process-global agent roster, park/revive, bounded mailboxes/jobs. | `PATTERN`; `DEFER` direct product use | Useful inside one worker session only; product messages are typed durable records. |
| Orca tasks/dispatch attempts/capabilities | exact current dispatch, process/pane authority, circuit breaker. | `ADAPT` strongly | Product assignments and attempts independent of terminal handles. |
| Orca durable delivery/federation | generation fences, sequence/acks, remote attachment/unknown/recovery. | `ADAPT` strongly | Assignment/result/receipt transport and customer-zone relay. |
| Orca polling `Coordinator` | integrated dispatch/monitor/gate loop; decomposition explicitly absent. | `REPLACE` as mission orchestrator; `PATTERN` for deterministic reconciliation | Product reconciler consumes durable state/events; no polling free-form brain. |
| Orca human decision gates | exact task/dispatch binding and blocking. | `ADAPT` narrowly | Only irreducible exceptions; apex resolves evidence gaps automatically where possible. |
| Product replaceable apex | No existing implementation. | `MISSING` | Reads snapshot/context and proposes one `PlanDelta`/next action; never owns state. |
| Product deterministic reconciler | No general mission implementation. | `MISSING` | Validates versions/authority, schedules work, applies results/evaluations and recovers every nonterminal state. |
| Product disagreement/probe policy | No existing implementation. | `MISSING` | Converts conflicting specialist claims into explicit gap/discriminating probe or true tie. |

## A3 decision

Combine OMP specialist execution with adapted Orca durable task/attempt/delivery patterns under a new product reconciler and replaceable apex.

---

# A4 — Evidence-seeking intelligence

| Existing component | Evidence | Disposition | Product boundary |
| --- | --- | --- | --- |
| OMP read/grep/glob/web/browser/eval tools | bounded selectors/artifacts, provider search adapters and broad tests. | `REUSE` | Evidence acquisition only; output enters admission pipeline. |
| OMP autoresearch | goal/constraints/metrics/experiments/keep-discard. | `ADAPT` / `PATTERN` | Active probe experiment runner under product gap/plan/evaluation records. |
| OMP Mnemopi triples/annotations/veracity | temporal/source/confidence and consolidation structures. | `PATTERN`; possible backend `ADAPT` | Product epistemic record semantics remain canonical. |
| Orca AI Vault/output archives | exact source/session/process and bounded evidence. | `ADAPT` | Worker evidence/provenance and operator drill-down. |
| Orca artifacts/source-control/review/browser UI | strong artifact/source visibility and recovery. | `REUSE`/`ADAPT` | Product evidence/artifact views and generated-code surface. |
| Product epistemic ledger/justification graph | No current implementation. | `MISSING` | EvidenceItem/Proposition/Assertion/Hypothesis/ContradictionSet/Gap/Probe/AcceptedFinding/ImpactReview. |
| Product context compiler | No current implementation. | `MISSING` | Deterministic policy/eligibility/rank/pack/citation/live-research manifest. |
| Vector/GraphRAG/graph database | External candidates; not needed by S1. | `DEFER` | Re-enter only after known-answer/latency/traversal benchmark. |

## A4 decision

Reuse OMP tools, not OMP/Orca conversational state. Build explicit epistemic and context authority.

---

# A5 — Self-correcting system

| Existing component | Evidence | Disposition | Product boundary |
| --- | --- | --- | --- |
| OMP AdvisorRuntime | separate review context, unsafe-output quarantine, watchdog. | `PATTERN`/`ADAPT` advisory signal | Advisor feedback cannot accept subject. |
| OMP TTSR | deterministic stream/tool rule interruption. | `REUSE` as worker guardrail | Final subject still evaluated independently. |
| OMP Cleanse | diagnostic collection, bounded repair ownership, post-repair verify. | `ADAPT` strongly | Closest implementation pattern for S1 correction loop. |
| OMP security contracts/coordinator/comparison | typed finding/evidence/provenance/coverage/validation and producer/lineage comparison. | `ADAPT` strongly | Generalize to evaluator/result registry while retaining security specialization. |
| OMP metaharness | normalized benchmark traces, runs, cost/pass metrics. | `REUSE`/`ADAPT` | Evaluator calibration/regression experiments; not acceptance state. |
| Orca stale-result/unknown/transaction recovery | exact current authority and fault tests. | `ADAPT` | Evaluation assignment/result/correction recovery. |
| Orca source-control/feature recovery UX | failure snapshot and corrective prompts. | `REUSE` UI pattern | Typed failed measures/diagnosis rather than generic prose. |
| Product evaluator registry/coordinator | No current implementation. | `MISSING` | EvaluatorDefinition/Contract/Assignment/Measure/Result and independent acceptance. |
| Product correction state machine | No current implementation. | `MISSING` | Failed measure → gap/diagnosis → new subject version → unchanged contract → accept/quarantine. |
| Semantic LLM judge fleet | External Inspect/model-judge patterns. | `DEFER` | Deterministic S1 evaluator first; require held-out expert calibration. |

## A5 decision

Build product evaluation authority. Adapt Cleanse and security/metaharness mechanics; never equate worker/advisor/recovery success with acceptance.

---

# A6 — Self-improving system

| Existing component | Evidence | Disposition | Product boundary |
| --- | --- | --- | --- |
| OMP AutoLearn candidate extraction | isolated capture turn, feature gating and skill/fact distinction. | `PATTERN` | May propose quarantined candidate only. |
| OMP direct managed-skill activation | safe file writes but immediate refresh/future discovery. | `REPLACE` as product learning path | No direct candidate → active mutation. |
| OMP Agent Skills packaging/discovery | standard `SKILL.md`, metadata, on-demand injection. | `REUSE`/`ADAPT` | Portable skill artifact beneath product manifest/certification. |
| OMP autoresearch/metaharness | bounded changes, metrics, keep/revert, variants/traces. | `ADAPT` strongly | Offline improvement lab with frozen splits and independent evaluators. |
| Orca skill package/version/digests/bundles | strict identity, containment and provenance. | `REUSE` strongly | Product capability artifact distribution. |
| Orca install/update/remove/recovery and risk/freshness UI | transactional local/WSL/SSH/cloud operations and restart/convergence tests. | `REUSE` strongly | Deployment/rollback transport after certification. |
| Product learning candidate/capability registry | No current implementation. | `MISSING` | Quarantine, immutable version, target envelope, certification, active/stable/revoked. |
| Product use trace/drift/demotion/impact | No current implementation. | `MISSING` | Every invocation/outcome; stop harmful versions and re-evaluate affected outputs. |
| GEPA/DSPy/SkillOpt optimizer | External challengers. | `DEFER` | Adopt only behind product corpus/evaluator/registry and after held-out gain. |
| Fine-tuning/distillation | No justified corpus/evaluator. | `DEFER` | Last layer after simpler capability changes saturate. |

## A6 decision

Reuse Orca skill distribution and OMP skill/experiment primitives. Build the governed lifecycle; S1 creates one quarantined lesson only.

---

# A7 — Bounded autonomous executor

| Existing component | Evidence | Disposition | Product boundary |
| --- | --- | --- | --- |
| OMP `RpcHostToolBridge` and frame protocol | strict host definitions, call/update/result/cancel, byte limits and tests. | `REUSE` | OMP only invokes narrow product host tools. |
| OMP approval tiers/Bash danger policies | argument-dependent allow/deny/prompt and process/time/output controls. | `PATTERN`/defense-in-depth | Product deterministic policy/capability remains authoritative; no `yolo` production path. |
| Orca dispatch capability hashes/process binding | random capability, hash at rest, timing-safe remote verification, revocation/current process. | `ADAPT` strongly | Product workload/effect capability bound to tenant/target/parameters/fence. |
| Orca lifecycle stale-result rejection | exact task+dispatch+assignee/pane/current state. | `ADAPT` strongly | Product assignment/effect result acceptance. |
| Orca durable mutation receipts | duplicate replay, mismatch reject, pending unknown and fail-closed capacity. | `ADAPT` strongly | Product command and effect idempotency; target still needs readback. |
| Orca federated `start_unknown`, relay generation/ack/reconnect | explicit unknown and remote recovery. | `ADAPT` strongly | Customer-zone dispatch/receipt transport and spool. |
| Orca skill/artifact transaction journals | crash-safe local effect and convergence reads. | `PATTERN`/`ADAPT` | Adapter-specific local effects; external target needs separate protocol. |
| Product EffectIntent/PolicyDecision/CapabilityEnvelope | No current implementation. | `MISSING` | Exact stable external effect identity and least-authority policy. |
| Product SecretLease/sandbox provider | No current implementation. | `MISSING`/`DEFER` provider selection | Short-lived non-model secret; default-deny file/network/resource boundary. |
| Product adapter request journal/receipt/readback/reconciler | No current implementation. | `MISSING` | Provider idempotency, pre-request durable point, applied/absent/unknown and repair/compensation/quarantine. |
| SPIFFE/OPA/gVisor/Firecracker | External production candidates. | `DEFER` | Re-enter with concrete topology/policy/threat/workload benchmark. |

## A7 decision

Reuse OMP’s host boundary. Adapt Orca’s capability/receipt/unknown/relay/recovery semantics. Build target-specific effect authority and reconciliation outside both.

---

# Cross-cutting code placement

## New product modules

Names describe responsibilities; exact language/package cut remains an implementation decision.

| Module | Canonical state / responsibility | Existing code dependency |
| --- | --- | --- |
| `mission-kernel` | Commands, expected versions, events, projections, outbox, leases/fences and recovery. | Adapt Orca DB invariants/tests; no Orca orchestration schema dependency. |
| `epistemic-ledger` | Evidence/propositions/assertions/gaps/contradictions/findings/impact. | OMP tools as evidence producers only. |
| `context-compiler` | Policy/eligibility/ranking/packing/citation/live-research manifests. | Invokes OMP retrieval/search adapters; outputs immutable manifest. |
| `agent-orchestrator` | Assignment contracts, deterministic reconciler, apex proposal, worker gateway. | OMP RPC worker; adapted Orca attempt/delivery patterns. |
| `evaluation-coordinator` | Evaluator registry, assignments/results, acceptance and correction. | OMP strict subagents/Cleanse/metaharness runners. |
| `memory-capability-registry` | Memory and learning candidates, versions, certification/use/revocation. | Mnemopi/Hindsight adapters; OMP/Orca skill artifact systems. |
| `effect-gateway` | Intent/policy/capability/secret/attempt/receipt/readback/recovery. | OMP host tools; adapted Orca receipt/capability/relay patterns. |
| `operator-api` | Stable mission query/command/event stream. | Orca renderer consumes it. |

## Dependency direction

```text
Orca renderer/operator shell
        ↓ product API
Product kernel and domain services
        ↓ assignment/evaluator/effect adapters
OMP RPC worker / evaluator jobs / target adapters
        ↓ evidence and receipts only
Product kernel
```

Forbidden directions:

- product kernel parsing OMP transcript to derive truth;
- OMP importing product database and mutating authority;
- Orca terminal orchestration tables acting as product mission tables;
- renderer local state deciding mission/evaluation/effect status;
- memory/skills bypassing context/evaluator/policy registries.

## S1 minimum reuse set

```text
REUSE
- OMP Agent/AgentSession/RPC/strict host tools/structured subagent
- OMP read/eval/artifact mechanics
- Orca process/session output archive patterns

ADAPT
- Orca expected-current attempt/stale-result invariants
- Orca mutation receipt identity/unknown semantics
- Cleanse diagnose/correct/verify pattern

BUILD
- small product PostgreSQL mission/event/projection/outbox kernel
- epistemic records and deterministic context manifest
- one apex + two specialist assignment contracts
- one deterministic evaluator and fixed-contract correction
- one quarantined memory candidate
- replay/fault harness and minimal inspector

DEFER
- external target effects
- semantic LLM judges
- memory recall and skill promotion
- vector/graph backends
- production sandbox/identity/policy services
```

## Combined placement conclusion

The combined codebase is strongest in the worker edge and control mechanics:

- OMP: model/tool/session/context/subagent/research/correction/experiment primitives;
- Orca: durable task/attempt/capability/receipt/unknown/relay/archive/package/UI primitives.

It is weakest exactly where product differentiation and safety live:

- migration mission authority;
- epistemic/context authority;
- adaptive apex under deterministic reconciliation;
- independent acceptance/correction;
- governed learning;
- target effect authority/reconciliation.

That is the correct cut. Reusing the edges avoids rebuilding mature mechanics; building the center avoids making coding sessions and terminal panes the healthcare migration domain model.

## Next coordinate

`P1-RSCH-13` — assign M0–M5 maturity, proven behavior and next discriminating experiment to every A0–A7 capability.
