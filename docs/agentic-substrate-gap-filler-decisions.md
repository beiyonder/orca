# Agentic-Substrate Gap-Filler Decisions

## Coordinate

`P1-RSCH-14` — strongest open-source gap fillers for confirmed A0–A7 gaps.

## Decision summary

No new production dependency is adopted in Phase 1.

The strongest candidates are assigned one of four outcomes:

- **reuse existing** — already in OMP/Orca;
- **challenger spike** — compare against the product-owned baseline in Phase 2;
- **defer with trigger** — preserve a seam and re-enter only after measured need;
- **do not adopt** — poor authority/domain/maintenance fit.

Immediate decisions:

1. **Durable state:** build the product PostgreSQL kernel; run **DBOS TypeScript** as the only S1-adjacent durable-execution challenger.
2. **Epistemic/context authority:** build product-owned ledgers/compiler; no framework selected.
3. **Specialist execution:** reuse OMP; no second agent framework.
4. **Evaluation:** build product evaluator registry/coordinator; run **Inspect AI** as the strongest external evaluation-harness challenger.
5. **Memory:** start with product registry + no S1 recall; later compare OMP Mnemopi and **Hindsight** behind the same adapter.
6. **Optimization:** after S1, compare a simple manual baseline against **DSPy/GEPA** for prompt/program changes and **SkillOpt** for text skills.
7. **Policy/identity/sandbox:** keep typed product interfaces; defer **OPA**, **SPIRE**, **gVisor** and **Firecracker** until real topology/policy/threat/workload evidence exists.
8. **Graph retrieval and generic agent frameworks:** no adoption. PostgreSQL/lexical baseline first; GraphRAG and AutoGen are currently maintenance-mode projects and do not own the product contracts anyway.

## Selection criteria

A candidate must improve at least one measured axis without weakening the product authority model:

1. **Contract fit** — can it represent exact subject/version/identity/tenant/state?
2. **Failure semantics** — crash, retry, duplicate, stale, unknown, cancellation and replay behavior are explicit.
3. **Authority fit** — product state/policy/evaluation remains canonical and replaceable.
4. **Evidence** — source, tests, provenance, version and observable outputs are inspectable.
5. **Isolation/security** — least privilege, data class, secrets, network and tenant boundaries can be enforced.
6. **Operability** — deployment, upgrades, recovery, monitoring and local/customer-hosted use are plausible.
7. **Compatibility** — OMP/Orca/SSH/native/WSL/customer-zone cuts remain viable.
8. **Maintenance/licensing** — open-source license and project status are acceptable at adoption time.
9. **Complexity** — measured benefit exceeds dependency/runtime/operations cost.
10. **Exit** — product data/contracts survive removal or replacement.

A popular framework does not pass by popularity.

---

# Candidate decisions by capability

## A0 — Tool agent

### Gap

A pinned product worker adapter between product assignments and a real OMP binary.

### Strongest filler

**OMP itself.** It already has the model/tool/session/subagent/RPC implementation.

### Decision

`REUSE EXISTING`.

Do not add OpenAI Agents SDK, LangChain, AutoGen, Google ADK or another general agent loop. A second framework duplicates the mature edge while leaving mission/evidence/evaluation/effect authority unsolved.

### Spike

`WORKER-EXP-01`: exact OMP RPC/tool/schema/cancel/artifact/version probe.

### Reversal

Only if OMP cannot satisfy the pinned worker contract or operational isolation envelope.

## A1 — Stateful worker and memory

### Gap

Product-governed context and long-term memory, not generic storage/retrieval.

### Candidates

| Candidate | Verified value | Missing product contract | Decision |
| --- | --- | --- | --- |
| OMP session/context | Mature worker journal, compaction and artifacts. | Product context manifest/tenant/evidence admission. | `REUSE EXISTING`. |
| OMP Mnemopi | Integrated local SQLite memory with multiple recall voices and recovery. | Product candidate/use/validation/impact lifecycle. | `CHALLENGER AFTER S1`. |
| [Hindsight](https://github.com/vectorize-io/hindsight) | Open-source MIT agent-memory service; remote retain/recall/reflect, banks/tags and benchmarks. | Product authority, tenant policy, help/harm, deletion and use trace. | `CHALLENGER AFTER S1`. |
| Mem0 / Graphiti / A-MEM | Useful memory algorithms/benchmarks. | Same governance gaps; extra services/complexity before need. | `DEFER`. |

### Decision

Build the product memory registry and backend-neutral adapter. S1 creates one quarantined candidate and performs no recall. Compare Mnemopi versus Hindsight only after a stable help/harm benchmark exists.

### Trigger

`MEM-EXP-09`: one backend materially improves held-out task outcome/operations without weakening isolation, provenance, invalidation or deletion.

## A2 — Durable mission

### Gap

Product-owned command/event/projection/outbox/lease/fence/recovery authority for adaptive missions.

### Strongest candidate

[DBOS TypeScript](https://github.com/dbos-inc/dbos-transact-ts) — MIT, database-backed durable TypeScript workflows, datasource transaction integration and chaos tests.

### Decision

- Product-owned PostgreSQL state machine/reconciler remains the **baseline**.
- DBOS is the **only Phase 2 challenger spike**.
- DBOS may execute bounded deterministic subflows; it does not replay or own model reasoning.
- Product domain tables/events/commands remain canonical in both arms.

### Why not adopt immediately

- S1 control load is small;
- the product state model is not implemented yet;
- a framework could hide rather than remove mission-state complexity;
- adoption before kill-point comparison would lock an untested execution model.

### Other candidates

| Candidate | Strength | Why not S1 |
| --- | --- | --- |
| Temporal | Mature durable workflow/event history and worker operations. | Separate service/SDK/replay constraints; adaptive model reasoning must stay outside deterministic replay. |
| Restate | Durable RPC/virtual-object/workflow model. | New runtime/service boundary before product state contract is proven. |
| Hatchet | High-parallelism durable task execution. | Queue/execution breadth exceeds S1 need; not domain authority. |
| River | PostgreSQL job queue for Go. | Kernel language not final; job queue alone does not solve mission authority. |
| LangGraph | Checkpoints/threads and agent workflow patterns. | State graph is agent-framework state, not product mission/effect authority. |
| Inngest | Event-driven durable functions. | Hosted/runtime semantics and service dependency before measured need. |

### Spike

`DUR-EXP-02`: identical mission schema/commands and kill matrix for custom baseline versus DBOS.

Pass challenger only if it reduces custom recovery code/operational risk without weakening transaction locality, replay transparency or dynamic replanning.

## A3 — Apex and specialists

### Gap

Replaceable apex + product-owned assignments + deterministic reconciler + evidence-based disagreement.

### Strongest existing implementation

OMP structured subagents for worker execution; Orca task/attempt/capability/delivery patterns for durable coordination.

### External research candidates

- Magentic-One: strongest orchestration pattern for task/progress ledgers, stall detection and replanning.
- AutoGen/teams: useful pattern catalog, but the [AutoGen repository](https://github.com/microsoft/autogen) states it is in maintenance mode and directs new users elsewhere.
- Anthropic/OpenAI/Google agent patterns: useful primary design references, not required runtime dependencies.

### Decision

`BUILD PRODUCT ORCHESTRATOR; REUSE OMP; ADAPT ORCA PATTERNS.`

No general multi-agent framework is added. It would duplicate OMP task execution and still require product authority/state/evaluation.

### Reversal

Only if ORCH experiments prove the simple apex/reconciler cannot support required workload and a candidate passes the same typed assignment/evidence/recovery contracts.

## A4 — Epistemic state, retrieval and context

### Gap

Explicit facts/claims/assertions/gaps/contradictions/probes/findings/impact and deterministic context manifests.

### Candidate review

| Candidate | Value | Why not authority | Decision |
| --- | --- | --- | --- |
| W3C PROV-DM | Provenance concepts. | Specification, not product epistemic engine. | `ADAPT CONCEPTS`. |
| ATMS / Dung argumentation | Formal justification/conflict concepts. | Complexity before workload/calibration. | `DEFER`. |
| PostgreSQL relational edges + FTS | Transaction-local, queryable, simplest S1 baseline. | Must be implemented/tested. | `SELECTED BASELINE`. |
| [Microsoft GraphRAG](https://github.com/microsoft/graphrag) | Graph-based retrieval over narrative corpora. | Research project currently in maintenance mode; extra indexing/service complexity; no product truth/acceptance. | `DO NOT ADOPT NOW`. |
| Vector search/rerankers | Better semantic recall at scale. | Two S1 artifacts and no known-answer benchmark do not need it. | `DEFER`. |
| RAGAS/ALCE/FACTS | Retrieval/citation evaluation ideas. | Automatic judges require claim-specific calibration. | `ADAPT METRICS`, not authority. |

### Decision

Build product epistemic ledger and context compiler on PostgreSQL/immutable artifacts. Reuse OMP read/search/browser/eval tools. Add vector/graph components only after `CTX-EXP-10` or graph traversal benchmarks fail the simpler baseline.

## A5 — Evaluation and correction

### Gap

Versioned evaluator definitions/contracts/assignments/results, independent acceptance and fixed-contract correction.

### Strongest candidate

[Inspect AI](https://github.com/UKGovernmentBEIS/inspect_ai) — MIT evaluation framework with tasks, tools/agents, scorers/model graders, logs, limits, checkpoints and extensive prebuilt evaluations.

### Decision

- Build the product evaluation registry/coordinator and authoritative state.
- Run Inspect as the strongest **external harness challenger** for experiment execution, multi-scorer/model-grader evaluation and log review.
- Retain OMP metaharness/Cleanse as the no-new-runtime baseline.

Inspect may execute/score an `EvaluationAssignment`; it cannot own:

- product subject/version/digest identity;
- acceptance state;
- evaluator independence policy;
- correction budget/state;
- tenant/evidence retention;
- evaluator revocation impact.

### Spike

`EVAL-HARNESS-EXP-01`:

- same seeded mutation corpus;
- native product/OMP runner versus Inspect runner;
- compare reproducibility, isolation, logs, scorer composition, recovery, cost and integration weight.

Adopt only if Inspect materially improves the harness while product contracts remain unchanged.

## A6 — Memory, skills and self-improvement

### Gap

Quarantine → bounded optimization → held-out certification → shadow/canary → use trace → drift/demotion/rollback.

### Strongest candidates

| Change class | Candidate | Verified value | Decision |
| --- | --- | --- | --- |
| Prompt/LM program | [DSPy](https://github.com/stanfordnlp/dspy), MIPROv2 and GEPA | MIT modular LM programs/optimizers; instruction/demo/reflective Pareto search and trial tracing. | `CHALLENGER AFTER S1`. |
| Natural-language skill | [SkillOpt](https://arxiv.org/abs/2605.23904) | Separate optimizer, bounded add/delete/replace edits and held-out selection for frozen agents. | `FIRST SKILL OPTIMIZER CHALLENGER`. |
| Portable skill artifact | Agent Skills + OMP skills + Orca skill packages | Existing interoperable content, strict package identity and transaction recovery. | `REUSE EXISTING`. |
| Weight training | Toolformer/fine-tuning/distillation | Can internalize tool/task behavior. | `DEFER`; last layer. |

### Decision

Build the product improvement lab/registry first. Compare optimizers only after evaluator/corpus splits and active/stable/revoked state exist.

No optimizer may see held-out labels, alter its objective/evaluator/authority or activate itself.

### Trigger

S1 passes, one repeated failure class exists, and `IMPR-EXP-02/03/04` can run.

## A7 — Bounded action and recovery

### Gap

Typed effect intent/policy/capability/secret/sandbox/request journal/receipt/readback/recovery.

### Component candidates

| Gap slice | Candidate | Verified value | Decision |
| --- | --- | --- | --- |
| Policy decisions | [OPA](https://github.com/open-policy-agent/opa) | Apache-2.0 general-purpose policy engine, structured input and decision/enforcement separation. | `DEFER WITH TYPED INTERFACE`; in-process policy first. |
| Workload identity | [SPIRE](https://github.com/spiffe/spire) / SPIFFE | Apache-2.0 workload identity and trust-domain federation. | `DEFER`; local S1 has no federated topology. |
| Container isolation | [gVisor](https://github.com/google/gvisor) | Apache-2.0 userspace application kernel/OCI runtime reducing direct host-kernel exposure. | `SANDBOX CHALLENGER` after real workload/threat profile. |
| VM isolation | [Firecracker](https://github.com/firecracker-microvm/firecracker) | Apache-2.0 minimal KVM microVM and jailer for multi-tenant workloads. | `SANDBOX CHALLENGER` after real workload/threat profile. |
| Local/customer jobs | Kubernetes Jobs / customer-native jobs | Operationally common run-to-completion substrate. | `ADAPTER OPTION`; retries still need idempotency/reconciliation. |
| Build provenance | SLSA/in-toto concepts | Exact builder/definition/dependency/artifact provenance. | `ADAPT CONTRACTS`; signing platform later. |

### Decision

Build product effect protocol and in-process policy first. No external target mutation in S1.

OPA/SPIRE/gVisor/Firecracker solve component slices; none solves external target atomicity or product effect truth.

### Re-entry triggers

- OPA: policy volume/ownership/versioning exceeds typed in-process rules.
- SPIRE: multiple services/customer zones require workload federation.
- gVisor/Firecracker: first untrusted adapter/code workload has measured compatibility/isolation requirements.
- Kubernetes/customer jobs: first real connector/target topology.

---

# Cross-cutting candidates

## Observability

OpenTelemetry conventions remain the preferred trace/metric/log interoperability layer. Product domain events/evidence are not replaced by telemetry.

Decision: instrument after S1 behavior stabilizes; preserve correlation IDs now.

## Connectors and migration pack

Debezium, Airbyte, OpenLineage and Great Expectations remain strong later-phase candidates for CDC/connectors/lineage/data checks.

Decision: not substrate gap fillers. Evaluate during migration capability pack phases after S1/G5.

## PostgreSQL extensions/services

FTS and relational edges first. Vector/graph/cache/message-bus additions require measured query/load failures.

---

# Adoption/spike ledger

| ID | Candidate | State | Earliest coordinate | Required proof |
| --- | --- | --- | --- | --- |
| `GF-01` | DBOS TypeScript | `CHALLENGER SPIKE` | `P2-LAB` / `L-ARCH-01` | Same S1 domain schema and kill matrix; less recovery complexity without weaker authority. |
| `GF-02` | Inspect AI | `CHALLENGER SPIKE` | `P2-LAB`, before broad `P7-EVAL` | Same mutation/scorer corpus; better reproducibility/logging/isolation at acceptable integration cost. |
| `GF-03` | Mnemopi vs Hindsight | `DEFERRED CHALLENGER` | after S1, `P5-KNOW` | MEM-EXP-09 help/harm/poison/isolation/operations. |
| `GF-04` | DSPy/GEPA | `DEFERRED CHALLENGER` | after S1, `P7-EVAL` | Held-out prompt/program gain without overfit, leakage, authority or protected regression. |
| `GF-05` | SkillOpt | `DEFERRED CHALLENGER` | after S1, `P7-EVAL` | Held-out target-specific skill gain and rollback under product registry. |
| `GF-06` | OPA | `DEFERRED` | `P8-EXEC` | Typed policy load/ownership/versioning proves in-process baseline insufficient. |
| `GF-07` | SPIRE | `DEFERRED` | production identity phase | Customer-zone/service federation and workload-attestation requirement. |
| `GF-08` | gVisor | `DEFERRED CHALLENGER` | `P8-EXEC` | ACT-EXP-07 isolation/compatibility/startup/throughput/operations. |
| `GF-09` | Firecracker | `DEFERRED CHALLENGER` | `P8-EXEC` | Same ACT-EXP-07 comparison with stronger VM boundary need. |
| `GF-10` | GraphRAG | `NOT SELECTED` | `L-KNOW-01` only if reopened | Known-answer/traversal benchmark defeats PostgreSQL baseline and maintenance status is acceptable. |
| `GF-11` | AutoGen | `NOT SELECTED` | none | OMP already fills worker framework role; repository is maintenance mode. |

## Dependency rule

A challenger spike does not authorize a dependency addition.

Before adoption:

1. pin version/commit;
2. verify license/security/maintenance status again;
3. define adapter and removal path;
4. run exact experiment with baseline;
5. record operational/deployment/data implications;
6. add only if threshold passes;
7. update ADR/deferred register and affected tests.

---

# Explicit build rationale

## Why mission authority is custom

The product’s differentiating state—evidence, gaps, decisions, plans, evaluation and effects—must remain queryable, replayable and framework-independent. Durable workflow engines may execute subflows, but none removes the need for the domain state machine.

## Why epistemic/context authority is custom

Retrieval frameworks return context; they do not decide migration-specific source roles, scoped propositions, contradiction/denial semantics, decision impact or acceptance.

## Why evaluator authority is custom

Evaluation harnesses run tasks/scorers. The product must own exact subject versions, independence, hard gates, correction, revocation and acceptance history.

## Why learning authority is custom

Memory/skill/optimizer projects can store or propose improvements. They do not provide the tenant/authority/corpus/certification/use/impact lifecycle required here.

## Why effect authority is custom

Policy, identity and sandbox projects each cover one boundary. No framework can atomically include an arbitrary external target; product-specific stable identity, idempotency, target readback and recovery remain necessary.

---

# P1-RSCH-14 conclusion

The research does not justify importing a framework stack.

Selected posture:

```text
Build product authority.
Reuse mature OMP/Orca edges.
Spike DBOS and Inspect against the same contracts.
Defer memory/optimizer/policy/identity/sandbox challengers behind measured triggers.
Reject duplicate or maintenance-mode framework adoption.
```

## Next coordinate

`P1-RSCH-15` — freeze Slice S1 as the first integrated substrate build and specify its exact implementation/evaluator contract.
