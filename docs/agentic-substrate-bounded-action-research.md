# Bounded Action, External Effects, and Recovery Research Card

## Coordinate

`P1-RSCH-09` — bounded action, sandboxing, external effects, and recovery

## Decision summary

Use a **product-owned effect protocol**. Models and workers may propose an `EffectIntent`; only the deterministic control plane may authorize, fence, dispatch, reconcile, evaluate, and commit its outcome.

```text
proposed intent
→ deterministic policy decision
→ least-authority capability envelope
→ durable effect record + outbox
→ isolated runner with short-lived identity/secret lease
→ adapter sends one stable idempotent request
→ signed/attested receipt or explicit unknown
→ independent target readback/reconciliation
→ evaluation
→ commit applied/absent/failed/repaired/compensated/quarantined
```

Core rules:

- Model text is never authority.
- Tool visibility is not permission; permission is a typed, expiring capability for one purpose.
- Capability combines exact designation with allowed operations. No ambient production credentials.
- Policy evaluation and enforcement are separate, but enforcement always happens at the effect boundary.
- Every effect has a stable product identity that survives worker retries/restarts.
- Same idempotency key with different parameters is rejected.
- A timeout/cancel/disconnect after dispatch is `unknown`, never assumed failed.
- Unknown external state is reconciled by independently reading target reality before retry.
- A receipt proves an adapter report, not product acceptance; target readback and evaluator still gate state.
- Cancellation revokes future authority but cannot prove an in-flight external write did not land.
- Compensation is a new explicit effect, not database rollback and not guaranteed semantic reversal.
- Stale attempts/results remain evidence and cannot advance authoritative state.
- Irreversible or insufficiently observable operations remain denied or require an explicit exception policy.
- Sandbox, identity, policy, network, secret, budget and evidence controls are defense in depth.

S1 performs no customer/source/target mutation and receives no production credentials. It preserves effect/capability/receipt/recovery seams but proves only the evidence-correction substrate.

## Action classes

### Pure read

Examples:

- metadata inventory;
- catalog lookup;
- target status read;
- log/profile query.

Still bounded by tenant, source, query, rows/bytes/time, data class, network and secret lease.

### Local reversible artifact mutation

Examples:

- create generated file in an isolated workspace;
- build/test package;
- update candidate configuration.

Can often use filesystem transaction/backup/replace semantics. It is not equivalent to external rollback.

### Declarative ensure/set

Examples:

- ensure schema exists with exact properties;
- set configuration to versioned desired state;
- apply infrastructure declaration.

Prefer compare-and-set/preconditions and target readback. Repeating the same desired state should converge.

### Create with provider idempotency

Examples:

- create job/resource using provider client token;
- start a migration run with request key.

The product `effect_id` maps to the provider idempotency key and target resource tags/IDs.

### Non-idempotent mutation

Examples:

- append event without natural key;
- transfer/trigger operation;
- invoke opaque stored procedure.

Require adapter-specific deduplication, stable business key, or precondition/readback. Deny when safe duplicate detection is impossible.

### Destructive/irreversible action

Examples:

- drop source data;
- cutover DNS/traffic;
- revoke access;
- delete retention-protected objects.

Default deny. Promotion requires an explicit approved runbook, stronger policy, backup/readiness evidence, bounded blast radius and recovery/exception semantics.

## Product contracts

### `EffectIntent`

```text
effect_id (assigned once, stable across attempts)
 tenant/mission/plan/task
 subject decision/artifact versions
 operation class and adapter method/version
 exact target designation: provider/account/project/region/resource/type
 canonical parameters and digest
 desired state/postcondition
 expected pre-state/version/precondition
 idempotency strategy/key lifetime
 required identity/tools/network/secrets/data classes
 budget/time/blast-radius
 reversibility and compensation reference
 reconciliation method
 evaluator contract
 source evidence/justification
```

### `PolicyDecision`

```text
decision_id
 intent_id/digest
 subject/workload/tenant/environment
 policy bundle/version/digest
 structured policy input digest
 allow | deny | exception_required
 granted scope and limits
 obligations: backup, readback, dual control, window, evidence
 reasons/rule IDs
 expiry/revocation
```

### `CapabilityEnvelope`

```text
capability_id / random unforgeable secret or signed reference
 intent/effect_id and parameter digest
 workload identity / attempt / process incarnation
 exact target designation
 allowed adapter/tool/method/operations
 allowed filesystem/network destinations
 data classes and egress rules
 secret lease refs only
 CPU/memory/disk/network/time/output/effect budgets
 maximum uses
 issued/starts/expires/revoked
 current fence/nonce
 policy decision/version
 audience/runner identity/attestation requirements
```

The envelope is not a general bearer credential. Enforcement binds it to:

- exact workload identity;
- exact effect/parameters;
- exact adapter and target;
- short lifetime/use count;
- current fence;
- policy and revocation state.

### `SecretLease`

```text
lease_id/reference
 secret manager and source identity
 recipient workload/runner
 target/audience/scope
 issued/expires/max uses
 data class
 capability/effect linkage
 issuance/use/revocation evidence
```

Raw secrets never enter durable mission events, model context, logs, receipts or artifacts.

### `EffectAttempt`

```text
attempt_id / effect_id / current fence
 capability/policy/runner/adapter/image versions
 provider idempotency key and request digest
 state and timestamps
 request-started evidence
 response/receipt refs
 lease/cancellation/revocation state
```

### `EffectReceipt`

```text
receipt_id
 effect/attempt/fence
 adapter/runner/workload identity
 provider request/operation/resource IDs
 canonical request digest and idempotency key hash
 status: applied | absent | failed | unknown
 response code/category
 observed before/after refs
 timestamps
 retry/reconciliation hints
 residual resources
 raw response artifact ref/digest
 signer/attestation
 limitations
```

### `TargetObservation`

```text
observation_id
 effect_id
 independent read identity/credential
 target coordinates/resource IDs
 query/method/version
 observed state/version/time
 evidence ref/digest
 applied | absent | ambiguous | inaccessible | changed_by_other
```

### `RecoveryDisposition`

```text
effect_id
 triggering failure/unknown/cancel/restart
 current intent/attempt/capability state
 receipt and target observations
 chosen action: wait | same-key retry | repair | compensate | quarantine | escalate
 rationale/policy/evaluator refs
 new effect/attempt IDs if applicable
 residual risk/resources
```

### `CompensationIntent/Result`

A compensation is a separately authorized, idempotent, evaluated effect linked to the forward effect. It records what it can and cannot restore.

## Effect state machine

```text
proposed
├─ denied
├─ exception_required
└─ authorized
   ├─ expired/revoked_before_dispatch
   └─ dispatched
      ├─ failed_before_request
      ├─ unknown
      │  └─ reconciling
      │     ├─ confirmed_applied
      │     ├─ confirmed_absent
      │     ├─ repair_required
      │     └─ quarantined_unknown
      ├─ adapter_reported_failed
      └─ adapter_reported_applied
         └─ independently_evaluating
            ├─ accepted_applied
            ├─ rejected_repair
            ├─ compensation_required
            └─ quarantined
```

No transition from `unknown` directly to blind retry or `failed`.

## Transaction boundaries

### Intent acceptance

One product database transaction:

- validates expected mission/plan version;
- appends `EffectIntent` and policy request;
- records authorization or denial;
- creates capability metadata when allowed;
- appends dispatch outbox;
- advances projection.

No external request occurs inside this transaction.

### Work claim

Runner claim atomically records:

- current lease/fence;
- attempt and process incarnation;
- capability audience;
- adapter/image digest;
- deadline/budget.

A stale fence cannot start a new request.

### Pre-request durable point

Before network mutation, the local/customer-zone adapter records:

- effect/attempt/request IDs;
- canonical request digest;
- provider idempotency key;
- target designation;
- started timestamp.

If the adapter crashes afterward, recovery knows a request may have escaped.

### Receipt ingest

Inbox/dedup and receipt/evidence metadata commit atomically with effect projection. Duplicate identical receipts replay; mismatched reuse is rejected.

### Acceptance

Independent target observation and evaluator result commit before mission state accepts the effect.

## Idempotency policy

### Stable identity

`effect_id` is created from the authoritative intent, not a worker attempt. Retries/restarts keep the same effect ID and provider idempotency key.

### Canonical payload

Hash canonical method, target and parameters. Reusing an effect/request key with another digest is an error.

### Provider contract

Record:

- whether idempotency exists;
- retention duration;
- what errors/results are cached;
- concurrency behavior;
- whether identity is scoped per account/region/method;
- retry window;
- how to query the operation/resource.

After provider key expiry, do not assume same-key retry remains safe.

### Product deduplication

Product mutation receipts deduplicate control commands. They do not by themselves deduplicate a target that never received the product receipt.

### Natural resource identity

Tag/create resources with product `effect_id` where the target supports it. Reconciliation verifies ownership and exact attributes, not only name existence.

## Unknown-outcome recovery

Unknown means any of:

- timeout/network break after request may have left the process;
- runner killed after send but before receipt;
- relay lost acknowledgment;
- cancellation raced an in-flight call;
- provider returned an indeterminate server response;
- adapter/receipt storage failed after target commit.

Recovery order:

1. stop new attempts for the same effect;
2. preserve/revoke stale capability and fence;
3. inspect local request journal/spool;
4. query provider operation/request ID if available;
5. read target resource using separately scoped read identity;
6. compare exact target identity, parameters, version and postcondition;
7. classify applied/absent/ambiguous/inaccessible/changed-by-other;
8. choose same-key retry only when provider contract and key window make it safe;
9. repair/compensate with a new authorized effect when needed;
10. quarantine if reality cannot be determined.

Unrelated mission work continues when dependency/authority permits.

## Cancellation semantics

Cancellation:

- prevents undispatched effects;
- revokes unused/future capability operations;
- fences stale attempts;
- signals active runner;
- does not erase request evidence;
- does not classify an in-flight target mutation as absent;
- triggers reconciliation when request-start status is uncertain.

“Process stopped” and “effect absent” are different facts.

## Compensation semantics

A saga decomposes a long-running operation into committed steps and explicit compensating steps. Product rules:

- compensation is domain/adapter-specific;
- reverse order is a plan, not universal truth;
- compensation may be lossy or impossible;
- compensation has its own policy/idempotency/evaluator;
- record residual state and downstream exposure;
- never label compensation “rollback” unless it restores the declared invariant.

Examples:

- delete newly created unused target resource may compensate create;
- restoring prior configuration may compensate update if no intervening owner changed it;
- emitted messages, consumed data, external notifications and cutovers may not be fully reversible.

## Workload identity and policy

### Identity

Use distinct workload identity for:

- control-plane service;
- agent gateway;
- mission/assignment;
- customer-zone relay;
- runner/adapter;
- independent evaluator.

No shared “migration admin” identity.

### Policy input

Structured fields only:

- caller/workload;
- tenant/mission/environment;
- effect/target/operation;
- parameter digest and classified fields;
- evidence/readiness;
- current fence;
- budget/window;
- adapter/image provenance.

Do not pass model prose as a policy rule.

### Enforcement points

- plan/intent admission;
- tool visibility/context;
- host-tool bridge;
- relay dispatch;
- secret issuance;
- network/file sandbox;
- adapter request;
- receipt ingest;
- target readback;
- result acceptance.

Early checks improve feedback; the last responsible boundary still enforces.

## Control/data-flow separation

Untrusted source documents, tool output, web pages, logs and model text remain labeled data. They cannot mint capability or alter control flow merely by containing instructions.

The trusted control path is built from:

- accepted mission/plan records;
- typed adapter schema;
- deterministic policy;
- capability envelope;
- current fence;
- validated parameters.

A prompt injection can influence a proposal, but deterministic validation/policy must prevent unauthorized data flow or effect.

## Sandbox profile

Minimum runner profile:

- disposable per attempt or per narrowly compatible pool;
- non-root, no host PID/socket/device access;
- read-only base image and explicit writable workspace;
- only declared artifact mounts;
- default-deny network with exact destination/DNS policy;
- no ambient cloud/Kubernetes/SSH credentials;
- secret lease injected out of model-visible context;
- CPU/memory/process/disk/output/network/time limits;
- syscall/device isolation appropriate to risk;
- signed/pinned image and dependency provenance;
- stdout/stderr/artifact size limits and redaction;
- kill process tree and reconcile effects;
- tenant-safe cleanup and forensic evidence.

Isolation choices:

- ordinary process/worktree: useful for trusted local development, not hostile multi-tenant code;
- container/namespaces/seccomp: low overhead, shared-kernel risk;
- gVisor: reduced host-kernel syscall exposure, compatibility/performance tradeoff;
- Firecracker microVM: stronger VM boundary, more platform/operational work;
- customer-native Job/VM: may best satisfy network/data locality but job retry semantics still require idempotent work.

Select by measured threat model, workload compatibility, startup/throughput and operator burden—not marketing labels.

## Relay and disconnected operation

Customer-zone relay:

- initiates outbound mutually authenticated connection;
- verifies signed dispatch/capability/expiry/fence;
- keeps bounded encrypted spool;
- sequences frames and deduplicates IDs;
- acknowledges durable local acceptance, not target success;
- rejects expired/revoked/stale work;
- refreshes identity/secret leases after reconnect;
- uploads compact signed receipts/evidence;
- stops new effects when control authority expires;
- reconciles local request journal before replay.

Bulk data flows source → target in the customer zone, not through control plane.

## Supply-chain integrity

For runner/adapter/tool artifacts record:

- source and commit;
- build definition and builder identity;
- resolved dependencies;
- image/package digest;
- signature/attestation;
- scanner/evaluator status;
- approved environment/architecture;
- revocation.

Artifact provenance does not prove behavior, but makes exact executed code identifiable and rebuildable.

---

# Research synthesis

## Object capabilities

[Capability Myths Demolished](https://cgi.cse.unsw.edu.au/~cs9242/papers/Miller_YS_03.pdf) distinguishes object capabilities from ACL rows/secret keys and emphasizes designation plus authority, no ambient authority, fine-grained dynamic subjects, access-controlled delegation, confinement and revocable indirection.

Adopt:

- capability designates exact target and operation;
- fine-grained per-workload/per-effect authority;
- explicit delegation/attenuation;
- no ambient credentials;
- revocation through mediated capability/fence/expiry.

A serialized token is not sufficient if the runtime lets the holder bypass enforcement.

## CaMeL

[Defeating Prompt Injections by Design](https://arxiv.org/abs/2503.18813) proposes separating control flow from untrusted data flow and using capabilities to prevent unauthorized private-data flows even when the underlying LLM remains vulnerable.

Adopt conceptually:

- prompt injection is an architecture/data-flow problem, not only a classifier problem;
- untrusted content cannot directly determine tools/recipients;
- capabilities bind authorized flows;
- product planner/policy must extract and validate trusted control state.

Our implementation must work with dynamic migration plans and product records; it does not assume model output is trusted control code.

## SPIFFE/SPIRE

[SPIFFE](https://spiffe.io/docs/latest/spiffe-about/overview/) defines workload identity standards for dynamic heterogeneous environments and mutually authenticated workloads.

Potential use:

- service/relay/runner/evaluator identities;
- trust domains/federation;
- short-lived SVIDs instead of static service credentials.

SPIFFE authenticates workload identity. Product capability/policy still decides what that identity may do for a specific effect.

## OPA

[OPA](https://www.openpolicyagent.org/docs/latest/) separates policy decision-making from enforcement and evaluates structured input against policy/data.

Potential use:

- external policy bundle/decision engine after in-process baseline;
- versioned policy tests and explainable decisions.

The product still owns intent, capability, enforcement, receipt and state. OPA adoption is deferred until policy complexity/ownership justifies the service.

## Stripe idempotency and indeterminate errors

[Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests) records the first result for a key, rejects same-key parameter mismatch and documents retention behavior.

[Stripe advanced error handling](https://docs.stripe.com/error-low-level) explains that network failures leave the client unsure whether the request was received, and that some server errors should be treated as indeterminate because side effects may have occurred.

Adopt:

- stable key;
- identical parameter digest;
- provider-specific key lifetime/error semantics;
- explicit indeterminate state;
- same-key retry only under the provider contract.

## AWS safe retries

[AWS Builders’ Library: Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) frames the singleton-create timeout problem and uses caller-supplied request identity to distinguish retry from a new intent.

Adopt:

- caller request ID rather than inferring identity from identical parameters;
- semantic equivalence is caller intent, not only payload hash;
- late-arriving and same-token/different-intent cases are explicit;
- reconciliation remains necessary when idempotency is unavailable/expired.

## Transactional outbox

[Debezium Outbox Event Router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html) describes the outbox pattern for avoiding inconsistency between internal database state and emitted events.

Adopt:

- commit domain event/projection/outbox together;
- transport delivery is replayable and not truth;
- consumers deduplicate event IDs.

Outbox solves database-to-transport dual write, not database-to-external-target atomicity.

## Sagas

[Garcia-Molina and Salem’s Sagas](https://sigmodrecord.org/1987/12/09/sagas/) decomposes long-lived transactions into smaller transactions with compensating transactions.

Adopt:

- explicit forward/compensating step model;
- persist partial progress;
- plan recovery for committed external steps.

Do not pretend compensation restores every semantic consequence.

## Kubernetes Jobs

[Kubernetes Jobs](https://kubernetes.io/docs/concepts/workloads/controllers/job/) retries Pods until completions and can start replacement Pods after failure/deletion.

Architecture consequence:

- Job completion/retry is not exactly-once external effect;
- runner tasks must remain idempotent/fenced/reconcilable;
- pod success is adapter execution status, not target acceptance.

## gVisor and Firecracker

[gVisor’s security model](https://gvisor.dev/docs/architecture_guide/security/) reduces direct host-kernel exposure by implementing/intercepting much of the system interface in a userspace kernel, while documenting remaining system API, ABI and side-channel risks.

[Firecracker](https://firecracker-microvm.github.io/) provides KVM microVM isolation with a minimized device model and companion jailer.

Disposition:

- benchmark both only when the production threat/deployment profile is known;
- preserve sandbox-provider interface;
- no initial commitment for S1.

## SLSA provenance

[SLSA provenance](https://slsa.dev/spec/v1.1/provenance) records builder identity, build definition, external parameters, resolved dependencies and artifact subjects so consumers can verify how an artifact was produced.

Adopt for runner/adapter/tool identity and rebuildability. Pair with behavioral/security evaluation.

## ToolEmu

[ToolEmu](https://arxiv.org/abs/2309.15817) uses emulated tool environments to generate and evaluate long-tailed risky agent scenarios without implementing every real tool.

Potential value:

- broad pre-production adversarial scenario generation;
- safety-case discovery for tools not yet connected.

Limit:

- emulated behavior is not target truth;
- final effect protocol still requires executable adapter fixtures and real provider contract tests.

## ChatGPT agent system card

[OpenAI’s ChatGPT agent system card](https://deploymentsafety.openai.com/chatgpt-agent) documents browser/terminal/connectors, prompt-injection risk, limited network access and confirmation/safeguard patterns.

Adopt lessons:

- external action and private-data access require layered controls;
- confirmations can defend selected high-impact cases;
- prompt injection remains a central threat.

Our mission product cannot rely on routine human confirmation or model-side caution. Deterministic policy, capabilities, idempotency and reconciliation remain mandatory.

---

# OMP implementation map

## RPC host-tool bridge

Files:

- `packages/coding-agent/src/modes/rpc/host-tools.ts`
- `rpc-types.ts`
- `rpc-frame.ts`

Present:

- host supplies strict tool definitions/schemas;
- OMP sends correlated call/update/result/cancel frames;
- cancellation and disconnect reject pending calls;
- frame and reassembly byte limits;
- replaceable host boundary.

Strong fit:

- OMP can remain an untrusted reasoning worker;
- product host owns actual tool implementation and authority;
- per-assignment tool set can be minimal.

Limit:

- call ID is not a durable product effect/idempotency identity;
- cancel is best effort;
- host result is not target reconciliation or acceptance;
- reconnect does not itself resolve an in-flight external effect;
- tool schema does not express tenant/target/secret/fence/evaluator state.

Disposition: reuse host-tool transport behind product effect gateway.

## Approval policy

Files:

- `packages/coding-agent/src/tools/approval.ts`
- Bash approval logic and tests.

Present:

- read/write/exec tiers;
- allow/deny/prompt modes;
- argument-dependent tool decisions;
- per-tool user policy;
- hard tool denies;
- shell critical-pattern and compound-segment checks.

Limit:

- user approval is session/user policy, not mission/effect authorization;
- broad modes such as `yolo` are valid coding-agent choices but invalid production defaults;
- command-pattern detection cannot prove semantic safety;
- no workload identity, target designation, expiring capability or effect receipt.

Disposition: reuse as worker UX defense; product policy remains authoritative.

## Bash/file/process tools

Present:

- timeouts and cancellation;
- bounded output/artifacts;
- working directory control;
- process-tree/session ownership machinery;
- destructive/fetch-execute patterns;
- safe file/path operations and symlink defenses in many specialized workflows.

Limit:

- normal OMP subprocess/worktree execution is not a hostile multi-tenant sandbox;
- network/filesystem/secret authority largely follows the host process;
- arbitrary shell is too broad for production migration effects.

Disposition: use in isolated research/build jobs; expose narrow product adapters for effects.

## Security coordinator

Security sessions use a read-oriented fixed tool set and typed evidence/provenance/coverage bundles. This is a useful least-tool pattern but not a general effect gate.

## OMP conclusion

OMP provides the correct worker containment seam—strict host tools, cancellation, approval tiers and bounded RPC—but product A7 must be implemented by the host/control/relay/adapter layers. OMP must never own external-effect truth.

---

# Orca implementation map

## Worker dispatch authority

Files:

- `src/main/runtime/orchestration/db/worker-dispatch/worker-dispatch-authority.ts`
- remote attachment authority and dispatch capability hashing.

Present:

- transactionally generated random dispatch capabilities;
- only hashes stored;
- exact handle/pane/process-incarnation binding;
- timing-safe verification for remote attachment;
- ownership/resource effects recorded;
- stale/inactive state rejected;
- capability revocation on terminal settlement.

Strong pattern:

- fine-grained dynamic worker authority;
- process incarnation and resource ownership matter;
- capability is not enough without current state/fence identity.

## Lifecycle reconciliation

File:

- `src/main/runtime/orchestration/lifecycle-reconciliation.ts`

Present:

- worker completion needs task + current dispatch + assignee/pane authority;
- malformed, mismatched, inactive and stale completion becomes explicit rejection;
- stale report remains evidence but cannot settle task;
- transactional settlement and heartbeat suppression.

Strong pattern: adapt directly for attempt/fence/result acceptance.

Limit: worker “succeeded” is lifecycle status, not independent artifact/effect correctness.

## Durable mutation receipts

Files:

- `db/mutation-receipts/mutation-receipt-store.ts`
- `rpc/orchestration-mutation-executor.ts`
- `mutation-receipt-capacity.ts`

Present:

- caller fingerprint + request ID + method + canonical payload hash;
- duplicate completed request replays receipt;
- mismatched reuse rejected;
- concurrent in-process duplicates join same promise;
- unresolved pending mutation becomes `operation_unknown` after restart;
- worker-start recovery points to exact dispatch;
- bounded ledger fails closed when unresolved rows fill capacity.

Strong pattern: adapt for command idempotency and unknown outcome.

Limit:

- coverage is Orca orchestration mutations;
- completed control receipt does not prove external customer target state;
- most failed non-unknown operations discard pending receipt because their in-scope operations can prove they did not remain unknown.

## Federated start/relay recovery

Files:

- `federated-worker-start-reconcile.ts`
- `remote-dispatch-attachment-authority.ts`
- `runtime/rpc/relay-transport.ts`
- `runtime/relay/relay-session-broker.ts`

Present:

- explicit `start_unknown` state;
- resume/reconcile to ready/failed/stopped;
- capability/process binding;
- connection tickets, generations and stale-broker rejection;
- bounded relay frames, reconnect/backoff and status;
- residual-resource/effect records.

Strong pattern: unknown start is not failed; generation/identity/fence protect reconnect.

## Transactional skill operations

Orca skill install/remove/update/placement workflows add:

- package and file digests;
- request identity;
- backup/replace journals;
- startup recovery;
- WSL/SSH/Windows semantics;
- post-operation convergence reads.

Strong pattern for local artifact effects. Do not generalize filesystem replace into target rollback.

## Orca conclusion

Orca provides the strongest A7 code patterns in the combined system: capability hashes, process-incarnation binding, stale-result rejection, idempotent mutation receipts, explicit unknown states, relay generations, residual-resource records and transaction recovery.

Missing product layer:

- tenant/workload identity and data policy;
- migration `EffectIntent`/policy/capability envelope;
- secret leases and sandbox provider;
- target adapter contract;
- provider idempotency semantics;
- signed target receipt and independent readback;
- repair/compensation/quarantine lifecycle;
- external effect evaluation.

Disposition: adapt strongly; do not reuse terminal/worktree identities as migration-domain authority.

---

# Architecture comparison

| Approach | Strength | Failure for this product | Decision |
| --- | --- | --- | --- |
| Give agent broad credentials/tools | Simple. | Ambient authority, prompt-injection blast radius, weak attribution. | Prohibited. |
| Human confirmation for every write | Clear checkpoint. | Fatigue, no autonomy, does not solve duplicate/unknown target state. | Exception only. |
| Container + retries | Familiar runtime. | Shared-kernel/ambient credential risk; retries can duplicate effects. | Incomplete. |
| Workflow “exactly once” claim | Simplifies control code. | Cannot atomically include external target; response loss remains. | Reject claim; use idempotency + reconciliation. |
| Product effect protocol with capability, receipt and readback | Explicit authority and external reality. | Adapter work and state-machine complexity. | **Selected.** |

## Selected S1 action boundary

```text
OMP specialists receive read-only fixture tools and isolated workspace writes
→ no cloud/source/target credentials
→ no external EffectIntent dispatch
→ generated artifact remains proposal
→ deterministic evaluator reads artifact
→ product kernel accepts/rejects
```

S1 schemas keep `EffectIntent`, `CapabilityEnvelope`, `EffectReceipt` and `RecoveryDisposition` extension points, but external execution is deferred.

---

# Experiment suite

## `ACT-EXP-01` — Capability least authority and revocation

Fixture:

- exact read and write intents;
- wrong tenant/target/method/parameter digest;
- expired envelope;
- stale fence/process incarnation;
- revoked capability.

Pass:

- only exact authorized operation reaches adapter;
- every denial names policy/capability predicate;
- capability cannot be reused for another target or payload;
- revocation blocks undispatched/future work;
- model/tool text cannot mint authority.

## `ACT-EXP-02` — Prompt injection and data-flow exfiltration

Fixture:

- source document/tool output instructs agent to send secret/data to another host;
- malicious target name and callback URL;
- model proposes widened network/tool scope.

Pass:

- untrusted data remains data;
- deterministic plan/policy/envelope prevents control-flow/egress expansion;
- secret never enters model-visible/logged/durable data;
- only allowlisted destination receives traffic;
- attempted flow is evidenced.

## `ACT-EXP-03` — Kill-point effect protocol

Kill at:

- before/after intent commit;
- before/after dispatch claim;
- before request journal;
- after journal/before send;
- after send/before response;
- after response/before receipt;
- after receipt/before ingest;
- after readback/before acceptance.

Pass:

- one authoritative effect identity;
- no unsafe duplicate;
- every nonterminal state recovers/reconciles;
- applied/absent/unknown never inferred from process exit;
- projection after replay is coherent.

## `ACT-EXP-04` — Idempotency identity and retention

Fixture:

- duplicate same key/same payload;
- same key/different payload;
- concurrent duplicate;
- late request;
- provider idempotency key expires.

Pass:

- identical duplicate replays/joins one result;
- mismatch rejected;
- caller intent remains distinct even with identical payload;
- expired-key case uses target readback or quarantines, never blind resend;
- provider contract/version recorded.

## `ACT-EXP-05` — Unknown target response reconciliation

Fixture:

- target commits then drops response;
- target never receives request;
- similarly named resource belongs to other actor;
- readback unavailable/ambiguous.

Pass:

- cases classify applied, absent, changed-by-other or ambiguous;
- exact resource/request/effect identity checked;
- absent may retry under policy;
- ambiguous remains quarantined;
- no duplicate target resource/effect.

## `ACT-EXP-06` — Concurrent/stale attempt fencing

Fixture:

- lease expires while old runner continues;
- new attempt claims same effect;
- stale receipt/result arrives last;
- cancellation races send.

Pass:

- only current fence may begin a new request;
- stale result is evidence only;
- cancellation triggers unknown reconciliation when needed;
- no task/effect double-advance;
- capability/process identities remain attributable.

## `ACT-EXP-07` — Sandbox, secret and resource containment

Fixture:

- fork bomb/resource exhaustion;
- host filesystem/socket/device access;
- network scan/exfiltration;
- secret enumeration;
- oversized output/artifacts;
- process tree survives parent.

Pass:

- declared limits hold;
- no host/tenant escape or raw secret disclosure;
- process tree and workspace cleaned;
- effect uncertainty reconciled before cleanup completion;
- useful forensic evidence retained within policy.

## `ACT-EXP-08` — Relay partition, spool and replay

Fixture:

- disconnect before/after local durable accept;
- duplicate/out-of-order frames;
- expired envelope during partition;
- restart with pending local request;
- bounded spool fills.

Pass:

- sequence/ID dedup works;
- local ack is not target success;
- expired authority starts no new effect;
- reconnect reconciles journal before replay;
- capacity fails closed with attributable status;
- no raw bulk data crosses control channel.

## `ACT-EXP-09` — Compensation and irreversibility

Fixture:

- two-step saga with second failure;
- compensation succeeds, partially succeeds, or is impossible;
- concurrent external actor changes target;
- destructive action lacks recovery proof.

Pass:

- compensation is separately authorized/idempotent/evaluated;
- preconditions prevent overwriting another actor’s change;
- residual state explicit;
- impossible/destructive action remains denied/quarantined;
- history preserves forward and compensation effects.

## `ACT-EXP-10` — Identity, tenant and supply-chain isolation

Fixture:

- wrong workload SVID/relay/device;
- cross-tenant artifact/capability/receipt;
- unsigned or digest-mismatched runner image;
- revoked adapter/evaluator;
- log/receipt contains secret.

Pass:

- zero cross-tenant effects/disclosures;
- identity and current audience required;
- untrusted artifact cannot execute;
- revocation blocks new assignments;
- secret redaction/durable-data rules hold;
- every denial and artifact identity is inspectable.

## S1 required subset

S1 does not run external-effect experiments.

S1 must still prove:

- workers have no product mutation authority;
- tool set is read-only fixture access plus isolated artifact creation;
- stale worker results cannot advance mission state;
- candidate artifact requires independent evaluation;
- effect/capability/receipt extension fields do not become implicit booleans such as `executed=true`.

`ACT-EXP-01` through `10` become required before any non-production target operation enters the integrated prototype.

## Reversal conditions

Revisit the selected effect gateway if:

- a platform provides the same intent/policy/capability/idempotency/receipt/readback/recovery contracts with lower complexity;
- target providers cannot expose stable identity/readback for a required action;
- customer topology requires disconnected signed envelopes;
- gVisor/Firecracker/customer-native jobs materially change sandbox cost/compatibility;
- policy ownership/volume justifies SPIFFE/OPA production adoption;
- an action cannot be safely automated and must remain an explicit exception.

## Next coordinate

`P1-RSCH-10` — complete the exact OMP A0–A7 package/symbol/protocol/test audit.
