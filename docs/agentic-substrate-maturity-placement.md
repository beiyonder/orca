# Orca / OMP Agentic-Substrate Maturity Placement

## Coordinate

`P1-RSCH-13` — place Orca, OMP, and the combined migration product on the `M0`–`M5` progression.

## Maturity rubric

| Level | Meaning | Required evidence |
| --- | --- | --- |
| `M0 — Named gap` | Capability is named or absent; no credible implementation proof. | Responsibility and missing behavior stated. |
| `M1 — Researched contract` | Contract, failure model, implementation candidates and experiment are defined. | Research card, code placement and falsifiable threshold. |
| `M2 — Isolated proof` | One implementation exercises its observable contract in isolation. | Focused behavioral/fault tests or executable lab fixture. |
| `M3 — Integrated proof` | Capability works with adjacent state/tools/workers in its current product domain. | Cross-component workflow plus restart/failure recovery. |
| `M4 — Domain pressure` | Capability survives migration-shaped data/platform/security/fault cases. | Held-out migration fixtures and independent evaluation. |
| `M5 — Prototype ready` | Capability is safe, observable and repeatable in the complete prototype. | End-to-end mission evidence, kill points, rollback/repair and clean repeat. |

Rules:

- Maturity is claim- and domain-specific.
- A mature coding-session or terminal feature is not automatically a mature migration capability.
- Combined maturity is the weakest required product-owned link, not the maximum or average of OMP and Orca.
- Test volume is not a maturity level; tests must prove the named capability contract.
- `M1` architecture is not implementation.
- A capability does not reach `M3` until its authority and recovery boundaries integrate with adjacent product state.
- No A0–A7 capability is currently `M4` or `M5` for healthcare migration.

## Placement summary

| Capability | OMP in its domain | Orca in its domain | Combined migration product now | Why combined is lower | Next promotion evidence |
| --- | --- | --- | --- | --- | --- |
| `A0` Tool agent | `M3` | `M1` | `M1` | OMP loop is mature, but no pinned product worker adapter/RPC compatibility proof exists. | `WORKER-EXP-01` exact-binary RPC/tool/schema/cancel/artifact probe → `M2`. |
| `A1` Stateful worker | `M3` session; `M2` memory | `M2` visibility/archive | `M1` | No product `ContextManifest`, governed memory or exact assignment reconstruction path is implemented. | S1 context/session/restart proof plus CTX-EXP-01 → `M2`; integrated replay → `M3`. |
| `A2` Durable mission | `M1` patterns | `M3` terminal orchestration | `M1` | Orca’s authority is terminal/task state; product mission/event/projection/outbox kernel is absent. | DUR-EXP-01/02 command/event/outbox/replay crash matrix → `M2`. |
| `A3` Specialists | `M3` bounded coding fan-out | `M2/M3` external-worker coordination | `M1` | No product-owned assignment authority, replaceable apex, plan revisions or evidence-based disagreement. | ORCH-EXP-01/02/03 on S1 apex + two specialists → `M2`; crash-integrated loop → `M3`. |
| `A4` Evidence seeking | `M2` tools; epistemic `M1` | `M1` visibility | `M1` | No product epistemic ledger, gap engine or context compiler is implemented. | EPI-EXP-01/02 + CTX-EXP-01/04 on contradictory fixture → `M2`. |
| `A5` Self-correction | `M2` specialized primitives | `M1` recovery patterns | `M1` | No evaluator registry/subject contract/independent verdict/fixed-contract correction state. | EVAL-EXP-01/03/04/10 on S1 → `M2`; restart-integrated acceptance → `M3`. |
| `A6` Self-improvement | `M2` local capture/experiments | `M3` skill distribution; learning `M0` | `M1` | Product learning registry/certification/use lifecycle absent; direct auto-activation is unsafe. | IMPR-EXP-01 quarantined no-same-run candidate in S1 → `M2` for candidate capture only. |
| `A7` Bounded action | `M3` host-tool boundary | `M3` terminal/skill control patterns | `M1` | No migration effect intent/policy/capability/secret/adapter/receipt/readback state. | Preserve S1 seams; ACT-EXP-01/03/05 before non-production target effect → `M2`. |
| `A8` Integrated substrate | `M0` | `M0` | `M0` | A0–A7 have never operated under one product authority/evidence model. | Slice S1 passes end-to-end with restart/replay and one correction → `M2`; broader integrated lab → `M3`. |

---

# Detailed placement

## A0 — Tool agent

### OMP: `M3`

Proven:

- provider-neutral streaming model/tool loop;
- strict tool schemas and argument validation;
- parallel execution, hooks, cancellation and steering;
- canonical events/results and provider-dialect conversion;
- integrated coding-agent tools/sessions and broad regression coverage.

Not migration `M4`:

- no migration adapter/tool corpus or tenant/effect boundary proof.

### Orca: `M1`

Proven:

- detects/launches external agents and binds terminal/process/session identity;
- cross-platform prompt delivery and operator control.

Missing:

- model/tool loop lives in external agents.

### Product: `M1`

Contract and reuse choice exist. No executable product `WorkerInvocation` adapter yet.

### Next experiment: `WORKER-EXP-01`

Fixture:

- pinned OMP binary;
- one strict product host read tool and one denied tool;
- valid/invalid structured output;
- cancellation and disconnect;
- artifact capture.

Pass:

- protocol/version fingerprint recorded;
- invalid schema fails;
- denied tool never calls host;
- cancellation/disconnect settles once;
- exact session/transcript/artifacts link to assignment;
- no unmanaged product tool appears.

Promotion: product `A0` → `M2`.

## A1 — Stateful worker

### OMP: `M3` session, `M2` memory quality

Proven:

- append-only/atomic session journal;
- branches/artifacts/retry/compaction;
- stable prefix/append-only provider context;
- local/remote memory backends and recovery.

Unproven:

- memory help/harm, tenant governance and product-context reconstruction.

### Orca: `M2`

Proven:

- exact provider-session/process pin;
- bounded/redacted transcript/output archive;
- heterogeneous AI Vault visibility and restart-aware caches.

Unproven:

- semantic context/memory ownership.

### Product: `M1`

Research cards define deterministic context manifest and governed memory, but neither is implemented.

### Next experiment

S1 assignment reconstruction:

- compile manifest from two contradictory artifacts;
- launch OMP;
- kill/restart worker;
- reconstruct from product assignment + manifest;
- compare used evidence/citations and output schema;
- create one quarantined candidate that is unavailable to same run.

Promotion: product `A1` → `M2`; integrated mission replay later → `M3`.

## A2 — Durable mission

### OMP: `M1`

Goal/todo/autoresearch/session stores are credible patterns but session-specific.

### Orca: `M3` for terminal orchestration

Proven:

- durable runs/tasks/dependencies/dispatches/messages/deliveries/questions;
- atomic claim/promotion;
- stale/duplicate/unauthorized result rejection;
- mutation receipts and explicit unknown;
- migration/version-skew/recovery tests integrated with runtime/CLI.

Not migration `M4`:

- no migration domain records or pressure fixtures.

### Product: `M1`

PostgreSQL-first state machine/reconciler is selected but not implemented.

### Next experiment: `DUR-EXP-01/02`

Implement smallest mission/event/projection/outbox store. Kill at command/event/projection/outbox/claim/result/evaluation boundaries; replay from events and compare projection.

Pass:

- one command ID/expected version;
- no lost/double transition;
- stale attempt rejected;
- identical projection after replay;
- every nonterminal row has recovery.

Promotion: product `A2` → `M2`.

## A3 — Specialists

### OMP: `M3` bounded fan-out

Proven:

- typed specialists, strict schemas, tools/models/budgets/depth/spawn/isolation;
- progress/artifacts/cancellation and nested coordination.

Limitation:

- parent-session ownership and no product apex authority.

### Orca: `M2/M3`

Proven:

- durable external-worker dispatch, lifecycle authority, messaging, circuit breakers and federation.

Incomplete:

- coordinator AI decomposition explicitly absent;
- terminal identities and human gates dominate.

### Product: `M1`

Replaceable apex + deterministic reconciler contracts exist only in research.

### Next experiments: `ORCH-EXP-01` through `03`

- kill/replace apex with same mission snapshot;
- give two specialists conflicting evidence;
- inject stale result after re-dispatch.

Pass:

- apex reconstruction needs no hidden session;
- conflict creates discriminating check or true unresolved tie;
- stale result cannot mutate mission;
- exact assignment/attempt/context/output/evidence records exist.

Promotion: product `A3` → `M2`; integrated restart/correction loop → `M3`.

## A4 — Evidence seeking

### OMP: `M2` tools, `M1` epistemic system

Proven:

- broad read/search/web/browser/eval and experiment tools;
- source-bearing outputs and bounded artifacts;
- memory triples/conflict/supersession patterns.

Missing:

- authoritative propositions/assertions/gaps/findings/context manifests.

### Orca: `M1`

Proven:

- session/source/artifact/source-control visibility.

Missing:

- epistemic admission and active probe planning.

### Product: `M1`

Event-sourced epistemic ledger and context compiler are designed, not implemented.

### Next experiments

- `EPI-EXP-01`: conflicting artifacts remain explicit;
- `EPI-EXP-02`: stale evidence invalidates finding and creates impact review;
- `CTX-EXP-01`: exact manifest recompilation;
- `CTX-EXP-04`: every used claim resolves to included span; unsupported claim fails.

Promotion: product `A4` → `M2`.

## A5 — Self-correction

### OMP: `M2`

Proven:

- advisor, TTSR, Cleanse diagnose/repair/verify, security contracts/comparison and metaharness.

Missing:

- universal evaluator registry/acceptance state.

### Orca: `M1`

Proven:

- feature-specific stale/unknown/convergence/recovery checks and rich failure UX.

Missing:

- independent subject evaluation/correction authority.

### Product: `M1`

Evaluation contracts and fixed correction loop are designed only.

### Next experiments

S1 must run:

- `EVAL-EXP-01` seeded critical/benign mutations;
- `EVAL-EXP-03` producer/evaluator separation;
- `EVAL-EXP-04` V1 failure → V2 pass under unchanged contract;
- `EVAL-EXP-10` repeated no-progress quarantine.

Promotion: product `A5` → `M2`; restart-integrated correction → `M3`.

## A6 — Self-improvement

### OMP: `M2`

Proven:

- candidate capture, managed skill files, experiment metrics and keep/revert.

Unsafe for product:

- active/future skill refresh without certification.

### Orca: `M3` distribution, `M0` learning

Proven:

- version/digest package identity;
- local/WSL/SSH/cloud transaction/recovery;
- risk/freshness/operator flows.

Missing:

- outcome-derived learning and certification.

### Product: `M1`

Governed candidate/certification/rollout/use lifecycle is designed only.

### Next experiment: `IMPR-EXP-01`

S1 creates exactly one failure lesson after accepted correction.

Pass:

- candidate links failed evaluation and correction;
- remains quarantined;
- cannot enter current mission context;
- restart preserves exactly one candidate;
- active capability set unchanged.

Promotion: candidate-capture subset → `M2`. Full A6 remains `M1` until held-out certification/promotion/demotion works.

## A7 — Bounded action

### OMP: `M3` host boundary

Proven:

- strict host tools, approval tiers, bounded frames, cancellation/disconnect and process controls.

Missing:

- durable external effect identity and target truth.

### Orca: `M3` terminal/skill control patterns

Proven:

- capability hashes/process binding;
- mutation receipts/unknown;
- stale rejection;
- relay/federation/recovery;
- crash-safe local package/artifact effects.

Missing:

- migration target policy/adapter/readback.

### Product: `M1`

Effect protocol is designed, external execution explicitly deferred from S1.

### Next experiments

Before any non-production target effect:

- `ACT-EXP-01` exact capability/revocation;
- `ACT-EXP-03` every kill point;
- `ACT-EXP-04` key/payload/retention;
- `ACT-EXP-05` applied/absent/ambiguous readback;
- `ACT-EXP-06` stale fencing;
- `ACT-EXP-10` identity/tenant/supply chain.

Promotion: product `A7` → `M2` only after one narrow adapter passes.

---

# A8 integration maturity

Current: `M0`.

Reason:

- no product executable currently binds A0–A7 under one authority/evidence model;
- high-maturity OMP/Orca edge components do not compose automatically;
- no integrated crash/replay/evaluation/correction trace exists.

## Slice S1 promotion target

S1 targets:

- `A0`–`A5` product subset at `M2`;
- `A6` candidate-capture subset at `M2`;
- `A7` seam only at `M1`;
- `A8` evidence-correcting mission loop at `M2`.

S1 does not claim `M3`: it is an isolated integrated slice, not yet adjacent to real discovery/connectors/effects.

## Path from S1 to `M3`

Integrate:

- source discovery fixture/adapter;
- larger reference corpus/context benchmark;
- multiple mission branches and specialist roles;
- evaluation registry with more than one evaluator;
- operator API/view;
- repeated restarts and concurrent assignments;
- one narrow non-production effect only after A7 `M2`.

---

# Maturity risks

## False composition

Risk: “OMP A0/A1/A3 is M3 and Orca A2/A7 is M3, therefore the product is M3.”

False. The integration contracts, authority transfer, product records and recovery path are unimplemented.

## Domain transfer

Coding and terminal fixtures do not pressure:

- legacy data ambiguity;
- snapshot/CDC/delete/schema evolution;
- clinical/claims semantic correctness;
- source/target rate and credential constraints;
- tenant/PHI isolation;
- target unknown/compensation.

No `M4` until those fixtures exist.

## Test-count inflation

A large source test suite proves current feature contracts, not new product semantics. Port only tests whose invariants survive the domain cut; write new tests for new observable product contracts.

## Premature production claims

S1 is `M2` evidence, not production readiness. `M5` requires end-to-end prototype criteria, failure matrix, repeatability and operator evidence in the roadmap.

---

# P1-RSCH-13 conclusion

The placement is intentionally asymmetric:

```text
High maturity at the edges:
- OMP model/tool/session/specialist runtime
- Orca task/attempt/capability/receipt/relay/archive/package/UI mechanics

Low maturity at the product center:
- mission authority
- epistemic/context authority
- apex/reconciler integration
- evaluation/correction authority
- governed learning
- migration effects
```

Decision: build the center through S1; do not rebuild the mature edges and do not overstate their domain maturity.

## Next coordinate

`P1-RSCH-14` — select strongest external gap fillers only for gaps confirmed by this placement.
