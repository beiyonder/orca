# Agentic-Substrate Executable Experiment Queue

## Coordinate

`P1-RSCH-16` — consolidate research experiments into one dependency-ordered execution contract.

## Current state

- Queue schema and runner contract: `IMPLEMENTED` for the Phase 2 baseline.
- Experiment runner: `prototype/migration-control-plane/scripts/migration-control-plane-lab.mjs`, implemented by `P2-LAB-12`.
- Runtime: Node 24+ with strict TypeScript; OMP/DBOS/Inspect remain process-isolated worker/challenger runtimes.
- First dependency-ready roadmap coordinate: `P7-EVAL-01`.
- `G2-LAB` through `G6-DISC` are complete; the independent evaluation contract layer is next.
- Source research cards remain the authoritative fixture and pass/fail specifications.

This queue contains all 70 experiments defined by the eight Phase 1 research cards plus six integration/harness experiments introduced by the code audits, gap decisions and S1 contract.

## `G2-LAB` execution evidence

Local sealed runs under ignored `.runs/`:

| Experiment | Seed | Status | Run ID |
| --- | ---: | --- | --- |
| `BASELINE-EXP-01` | 204 | `passed` | `baseline-exp-01-204-baseline-none-run_000000_fac5e8ac236c1090` |
| `LAB-EXP-01` | 205 | `passed` | `lab-exp-01-205-baseline-none-run_000000_121b6d9ce7649417` |
| `S1-FIXTURE-EXP-01` | 206 | `passed` | `s1-fixture-exp-01-206-baseline-none-run_000000_bc28d1ef6d576c92` |
| `WORKER-EXP-01` | 417 | `passed` | `worker-exp-01-417-baseline-none-run_000000_766910686f21b20f` |
| `EXP-02` | 602 | `passed` | `exp-02-602-baseline-none-run_000000_eb8a1afb7fb61c4c` |
| `EXP-03` | 603 | `passed` | `exp-03-603-baseline-none-run_000000_757028aec38917d2` |
| `EXP-04` | 604 | `passed` | `exp-04-604-baseline-none-run_000000_9e3c9160451ac11f` |
| `EXP-05` | 413 | `passed` | `exp-05-413-baseline-none-run_000000_e176cfe9800c0719` |
| `EXP-10` | 412 | `passed` | `exp-10-3040f76381e7a97eaa2d` |
| `EXP-06` | 506 | `passed` | `exp-06-506-baseline-none-run_000000_b9160260c6af7df3` |
| `EXP-07` | 507 | `passed` | `exp-07-507-baseline-none-run_000000_81c0168e84e967df` |

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

## `P3-KERN-11` through `P3-KERN-13` convergence evidence

- migration 005 makes mission events append-only and fingerprints its function/trigger;
- replay verifies contiguous positions plus full-event/payload/projection digests before atomically rebuilding all current mission views;
- corrupted/dropped views converge exactly while event tamper and gaps fail;
- every nonterminal task/attempt/effect/outbox row receives one idempotent deterministic restart disposition;
- active leases defer; missing/expired authority never implies process death or permits completion;
- required task evaluation must be persisted, passing, contract-complete, and traceable to the current attempt/fence/result;
- schema v5: 5 migrations, 17 tables, fingerprint `15aca9dc2ee49e138bd997e2ee076ef779a6e6ec5932a173bc988cd807d9a56c`;
- verification passes 10 unit files / 57 tests and 9 PostgreSQL files / 33 tests;
- `DUR-EXP-01` passes three integration seeds and sealed CLI seed 103 (`dur-exp-01-103-baseline-none-run_000000_873d4c1794ee4292`); all seven measures and artifact integrity pass.

## `P4-AGNT-01` process-supervisor evidence

- exactly one absolute executable/cwd and explicit environment per supervisor incarnation;
- observable idle/starting/running/cancelling/exited/failed lifecycle without mission-state authority;
- `shell: false`, hidden Windows consoles, safe `.cmd` quoting, and detached POSIX process groups;
- independently bounded stdout/stderr prefixes plus full observed byte counts and truncation flags;
- bounded startup/runtime/cancellation/force timeouts and idempotent cancellation;
- graceful exit, forced kill, spawned-descendant cleanup, natural nonzero exit, spawn failure, output flood, and duplicate-start paths;
- eight real-child tests pass with no remaining `agent-process-child.mjs` process; complete lab verification is 11 files / 65 tests.

## `P4-AGNT-02/03` environment and RPC containment evidence

- exclusive private home/workspace/agent/temp/XDG roots and 0700/0600 permissions per incarnation;
- only PATH/platform locale/runtime variables inherited; user profiles, config overlays, hooks, auth brokers, model/cloud/GitHub credentials, SSH agents, and runtime preload options omitted;
- Git/npm/AWS/Azure/Docker/Kubernetes/Claude/Codex/GitHub config paths redirected to the isolated root;
- manifest records sorted variable-value digests without exposing values; root reuse fails until cleanup;
- a real supervised child observes only isolated cwd/state roots and null hostile variables;
- fail-closed JSONL decoder pins OMP 18.0.6 limits: 1 MiB physical, 64 MiB logical, 256 KiB chunk payload;
- ready-first v1, negotiate-to-v2, ordered canonical-base64 reassembly, response/event/host-tool-call/host-tool-cancel/error categories;
- overflow, unterminated, UTF-8, JSON, schema, unknown type, duplicate ready, pre-ready, chunk order/metadata/interruption/length/base64 failures reject and poison the decoder;
- eleven focused tests pass; complete lab verification is 13 files / 76 tests.

## `P4-AGNT-04` through `P4-AGNT-07` context/result/tool authority evidence

- one canonical prompt carries the exact schema-validated manifest and ordered source spans; its bytes and digest reconstruct identically in fresh isolated workspaces;
- source IDs/versions/full-source digests, text/JSON-pointer spans, exclusions, whole-item redactions, role, tenant, mission, assignment, attempt, base revision, model route, prompt/tool/output digests, and budget are bound before delivery;
- private exclusive context path and 0400 payload prevent accidental in-place reuse; a redacted source span never enters prompt bytes;
- successful assignment output requires the strict typed schema, at least one in-scope evidence reference, explicit gap/artifact/plan arrays, current assignment/attempt/fence, exact captured digest, and host-observed usage within budget;
- registered host-tool JSON schema digest, canonical arguments, active attempt, policy allow/grant, workload-bound capability, expiry/revocation state, and minimum use budget all pass before the implementation starts;
- duplicate host IDs, invalid schemas/arguments/results, stale authority, exhaustion, OMP per-call cancel, attempt cancellation, and capability revocation fail closed; cancellation/revocation close the start gate synchronously and idempotently before acknowledgement returns;
- fifteen focused tests pass; complete lab verification is 16 files / 91 tests.

## `P4-AGNT-08` through `P4-AGNT-13` orchestration and qualification evidence

- nine role-specific specialist contracts pin typed brief/result, owned/read scope, tool order/schema, output contract, maximum budget, claim-level citation, abstention, and complete proposal-only authority exclusions;
- digest-bound apex snapshots admit exactly one current evidence/gap/role/budget-valid action and record it as `reconciler-required`; the input snapshot is unchanged;
- disagreement preserves every cited specialist result, opens a blocker gap, and chooses only the cheapest current read-only deterministic discriminator; majority and unprobeable conflict remain explicit ties;
- a force-killed child reconstructs from persisted assignment/attempt/fence/context/ledger/executable digests into a fresh root with identical logical invocation/context bytes and no hidden marker;
- real pinned OMP `18.0.6` (`68d91103…eda6be4c`) negotiates v2, returns typed subagent state, accepts strict host tools, receives the digest-bound context, requests/writes a checksum-bound isolated artifact, cancels an active local provider request, starts zero effects after acknowledgement, rejects gateway flood/context overflow, returns an explicit malformed-frame error, and reconstructs after crash in under 30 seconds;
- `EXP-10` run `exp-10-3040f76381e7a97eaa2d` passes all eleven measures with report digest `bb4343a2…a73482d`; imported `WORKER-EXP-01` seed 417 passes both contract and binary measures;
- `EXP-05` seed 413 passes 15/15 resolvable choices, 20/20 citation coverage, and 5/5 explicit true ties;
- all three sealed run indexes verify; complete lab verification is 21 files / 118 tests; no OMP or fixture child remains.

## `P5-KNOW-01` through `P5-KNOW-03` corpus foundation evidence

- five strict V1 contracts cover source manifests, parse versions, chunks, entities, and relations; the generated registry expands from 41 to 46 schemas;
- source manifests bind tenant/visibility, source class, owner, permission/license, canonical URI, exact source/version, SHA-256 object URI/bytes, data class, applicability, observed/published times, freshness, retention, limitations, and predecessor;
- private content-addressed storage preserves original and parsed bytes with 64 MiB bounds, 0400 files, 0700 directories, idempotent identical replay, restart reconstruction, exact digest/byte validation, and path/symlink/hard-link rejection;
- parse admission requires the exact source manifest/version/digest; chunk ordinal/content/span/applicability, entity provenance, and relation endpoints/provenance all fail closed on drift;
- deterministic catalog queries return documents/data profiles, entities, edges, current-version selection, applicability, and complete source→parse→chunk provenance;
- migration 006 binds all 46 generated contract digests, updates registry digest `cf9dadff…841947`, and prevents update/delete of persisted corpus domain rows;
- PostgreSQL fingerprint is `4895a52248479b57d340faa725866bba81ec8fb58d2afa28d754ea4966b30dac`; 6 migrations / 17 tables;
- complete verification passes 22 unit files / 127 tests and 10 PostgreSQL files / 34 tests.

## `P5-KNOW-04` through `P5-KNOW-08` retrieval and context evidence

- structured exact/entity signals and BM25-simple lexical scores are independent, inspectable channels; RRF records per-channel rank and fused score without treating score as authority;
- every candidate carries exact source manifest/source ID/version/source digest, parse/chunk IDs, span, content digest, token estimate, class, channels/ranks/scores, and attributable eligibility or exclusion;
- optional sparse semantic projection is version/configuration-digest bound and recovers the repeated-record/compound-identifier paraphrase missed by lexical-only retrieval;
- tenant-local relational BFS records visited entities/relations, enforces depth/candidate limits, and contributes only original provenance chunks;
- tenant/source-class/data-class/scope/source-list/render/digest/current/applicability/freshness checks run before any ranking; denied candidates have no channel ranks or scores;
- deterministic context assembly preserves citation metadata, performs literal redaction and content-digest dedupe, enforces token budget, records exclusions, and reproduces exact rendered/context digests;
- migration 007 registers immutable query/trace/context records; registry has 49 schemas and PostgreSQL fingerprint is `892bba1b…d1117e2`;
- complete verification passes 23 unit files / 137 tests and 11 PostgreSQL files / 35 tests.

## `P5-KNOW-09` through `P5-KNOW-13` governed capability and qualification evidence

- six strict V1 contracts cover memory candidate/version/use/invalidation and skill version/lifecycle records; the generated registry expands from 49 to 55 schemas;
- mission, episodic, procedural, failure, and evaluator candidates require canonical provenance, digest-bound content, exact scope/applicability/retention/validation metadata, no authority delta, and quarantine with no recall;
- deterministic reconstruction orders memory versions and skill dependency/lifecycle history independent of database row order; recall checks tenant, role, task, data, environment, product/version, validity, status, and current lineage;
- every memory use binds version/context/assignment/attempt/retrieval trace/rank/score/render digest/downstream records/attribution; invalidation names every prior use and a matching stale/deprecated/revoked/forgotten replacement version;
- skill versions bind artifact/contracts, evaluator IDs, authority envelope, dependencies, model/runtime/harness/tool/data/task compatibility, signer/license, and predecessor; only legal quarantine→certification→activation→deprecation/revocation history can resolve;
- migration 008 registers all 55 schemas, keeps corpus/retrieval/context/memory/skill records immutable, and converges empty/upgraded databases to fingerprint `2ade23da…b4bf5e`;
- sealed `EXP-06` seed 506 runs 20 queries over 55 current/conflicting/stale/cross-tenant/distractor documents: semantic retrieval covers 20/20 versus lexical 15/20, 20/20 used answers carry exact citations, and zero denied items are included;
- sealed `EXP-07` seed 507 improves deterministic held-out accuracy from 10/20 to 20/20, rejects both seeded poisoned/stale memories, leaks zero cross-tenant records, removes all post-invalidation recall, and retains 20 attributable use traces;
- both sealed run indexes verify; complete verification passes 25 unit files / 152 tests and 12 PostgreSQL files / 36 tests.

## `P6-DISC-01` frozen source-fixture evidence

- Pagila tag `pagila-v3.1.0` is pinned to commit `fef9675714cfba1756df4719b5e36075a7ddf90e`; upstream license, schema, and INSERT-form data bytes are retained under exact SHA-256 and Git blob identities;
- the canonical qualification runtime is PostgreSQL 16.15 with UTF8/C and no extensions; upstream claims PostgreSQL 12+ compatibility;
- the exact fixture digest is `c22e7c170feafc06e70bee21771181e1880b5ef9c8ccc8567b093eeaf4fe025d`;
- the expected estate records 21 ordinary tables, one partitioned table with seven monthly children, seven views, one materialized view, 13 sequences, 10 functions, 15 triggers, 55 indexes plus one partitioned index, 36 foreign keys, 22 primary keys, three custom types, and exact row counts;
- the README claim of “PostgreSQL license” conflicts with the MIT permission text in `LICENSE.txt`; both facts remain explicit and the exact license bytes ship with the fixture;
- WideWorldImporters, Oracle samples, Synthea, and Debezium examples remain later challengers because their runtime, domain shape, or CDC topology would conflate the first fixture with later coordinates;
- strict manifest/file/estate validation, upstream INSERT counting, shared path/symlink/hard-link defenses, and real PostgreSQL reconstruction pass; complete verification is 27 unit files / 158 tests and 13 PostgreSQL files / 37 tests.

## `P6-DISC-02` through `P6-DISC-03` source authority evidence

- four strict contracts cover adapter definition, access envelope, semantic request and observation; registry reconstruction enforces version lineage, tenant/source/endpoint/operation/data/limit/time/use authority and exact request→observation identity;
- source operations contain no mutation vocabulary or arbitrary SQL input; permission evidence, credential reference, endpoint digest, read limits, data class, denial-not-absence outcomes, partial evidence and retry disposition are explicit;
- the PostgreSQL sandbox verifies endpoint/database/version, enters repeatable-read/read-only, exports a snapshot, serializes trusted operation queries, enforces query/row/byte/statement/overall/concurrency limits and exposes no filesystem capability;
- real tests prove reads, mutation rejection with unchanged rows, network/source mismatch, row/statement deadlines and concurrent-start denial;
- migration 009 persists all four immutable records and expands the registry from 55 to 59 schemas.

## `P6-DISC-04` through `P6-DISC-07` estate discovery evidence

- system inventory records database/server/schema/extension identity and complete/denied/unavailable coverage; schema inventory records relations, columns, constraints, indexes, routines, triggers, types, sequences and grants;
- bounded profiling records exact row/null/distinct counts, text-order min/max digests and sample digests only; raw values never enter the durable profile;
- views, materialized views, functions, procedures and triggers are written into one checksum-bound artifact with per-object digests and explicit coverage;
- lineage nodes/edges distinguish catalog-declared, static-analysis, query-log and runtime-trace methods; missing endpoints remain unresolved rather than fabricated;
- frozen Pagila qualification returns 30 relations, 58 relation constraints, 56 indexes, 10 routines, 15 triggers, three types, 13 sequences, exact actor statistics, 36 foreign-key and seven partition edges plus view/trigger/sequence/routine dependencies;
- migration 010 persists five immutable discovery projections; registry 64, migrations 10 / tables 17, fingerprint `374e03e9…82ec42`; verification passes 30 unit files / 167 tests and 16 PostgreSQL files / 48 tests.

## `P6-DISC-08` through `P6-DISC-16` reasoning and qualification evidence

- checksum-bound overlay fixture `1eb3b9fc…d6d7229c` supplies ten claims, ten hidden estate items, two attributable denials, one decoy, a ten-event CDC trace and versioned synthetic target capability;
- CDC analysis replays snapshot rows, atomic updates/inserts, explicit delete, versioned DDL, checkpoint, restart duplicate and late update by source position; every event has one disposition and final state is checksum-exact;
- claim comparison retains supplied/observed digests and citations across supported/refuted/unresolved/denied/stale states; denied scope cannot prove absence;
- deterministic gap scoring checks impact + uncertainty + blocking − cost − risk; safe-probe planning selects bounded observable work while retaining unrelated exception-only gaps for accountable input;
- immutable target capability versions bind resources, principal/secret references, operations/idempotency, data classes, source compatibility and coverage; incomplete/latest snapshots cannot resolve;
- the first full Pagila pipeline produces a proposal-only/reconciler-required estate design with 30 assets, cited target/decisions/gaps, 22 proposed raw mappings and five dependency/proof/recovery tasks;
- sealed `EXP-02` seed 602 passes 8/8 material contradictions, 10/10 citations, zero false promotions and zero denial-as-absence;
- sealed `EXP-03` seed 603 passes 9/10 planted recall, zero fabricated accepted assets, 2/2 explicit denials and proposal-only authority;
- sealed `EXP-04` seed 604 passes 10/10 event dispositions, exact final state and zero gaps; all three artifact indexes verify;
- migration 011 persists seven reasoning/target/proposal contracts; registry 71, migrations 11 / tables 17, fingerprint `7acfcb43…8769156`; verification passes 33 unit files / 176 tests and 18 PostgreSQL files / 53 tests.

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
- `G5-KNOW`: retrieval/context authorization, provenance, memory help/harm, and reversible capability lifecycle experiments.
- `G6-DISC`: contradiction, hidden-estate, denial, CDC replay and cited proposal experiments.
- `G7-EVAL`: evaluation/correction/improvement experiments.
- `G8-EXEC`: all `PRE-EFFECT` experiments.
- `G9-INTEG`: `S1-E2E-01` plus expanded integrated scenario.
- `G10-PROTOTYPE`: domain pressure, complete dry run and production qualification experiments.

## Next queue action

Begin `P7-EVAL-01`: make evaluator/subject/input/measure/threshold/evidence versions the explicit acceptance contract before adding correction or skill promotion.
