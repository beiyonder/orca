# Process Completeness and Bounded Liveness Research Card

## Coordinate

`P9-INTEG-00` — process-completeness prerequisite before the public mission API
Live delivery and coordinate authority remains the generated [`agentic-substrate-current-handoff.md`](./agentic-substrate-current-handoff.md); this card defines the selected prerequisite and falsification contract, not merged implementation status.


## Question

How can the product prove that every critical workflow step occurred, or became explicitly failed, waived, cancelled, or overdue, without trusting an LLM to remember the step or constraining the LLM's internal reasoning strategy?

## Decision summary

Add a product-owned **process obligation** primitive to the existing PostgreSQL command/event/projection kernel.

- **Formal property:** bounded liveness.
- **Product guarantee:** process completeness.
- **Durable primitive:** process obligation.
- **Projection:** obligation ledger.
- **Runtime component:** completeness monitor.
- **Failure evidence:** obligation breach.

A versioned obligation definition is selected by deterministic product code. Its obligation instance is created atomically with the triggering authoritative transition. A critical obligation can be satisfied only by admitted product evidence, never by an agent heartbeat or self-report alone. A leased, fenced, idempotent monitor uses the database clock to emit one durable breach when deadline plus grace passes without valid proof.

This is not another evaluator. The completeness monitor asks whether required work occurred; an evaluator asks whether produced work is correct; a reconciler asks what external reality is after uncertainty.

`EXP-13` must kill every seeded critical omission with no benign false positives before `P9-INTEG-01` begins.

## Correction to the prior framing

The observed gap is real, with four refinements.

1. P3–P8 prove selected safety invariants under specified fixtures, not every safety property.
2. The system already has narrow liveness mechanisms: process timeouts, leases, fences, delivery retries, evaluation deadlines, restart reconciliation, and unknown-effect recovery.
3. Pure unbounded liveness cannot be conclusively violated from a finite trace. Operational monitoring therefore needs bounded response obligations with deadlines and grace.
4. Heartbeats detect missing signals. They do not prove that required business work completed correctly.

The precise missing capability is **cross-cutting, evidence-backed process completeness for required-but-omitted work**.

## Repository audit

### Behaviors already removed from LLM authority

Product code already validates or owns:

- strict assignment-result schemas;
- tenant, mission, assignment, attempt, and fence identity;
- exact captured output digest;
- allowed evidence, artifact, gap, and plan references;
- host-observed usage budgets;
- immutable context manifests and admitted source spans;
- task and attempt transitions;
- evaluator identity, independence, freshness, thresholds, and evidence;
- product-only acceptance;
- memory candidate provenance, scope, use policy, and invalidation;
- skill certification, activation, regression revocation, and rollback;
- signed effect target, adapter, runner, parameters, scope, budget, expiry, and use;
- external-effect receipts and independent target readback.

The system does not rely on an agent to commit authoritative state or declare its own output accepted.

### Existing narrow liveness controls

- agent startup, runtime, cancellation, and forced-termination deadlines;
- task/attempt leases and monotonic fences;
- transactional outbox claims, expiry, retry, and acknowledgement;
- evaluation deadlines and explicit unavailable/stale dispositions;
- restart reconciliation for tasks, attempts, effects, outbox work, and projections;
- explicit `unknown` external effects and target reconciliation;
- expiry and revocation for capabilities and skill versions.

### Confirmed negative-space gap

There is no generic durable mechanism that answers:

```text
For this mission, task, artifact, effect, memory, or capability lifecycle:
- which process steps were required;
- which obligation instances were opened;
- which completed;
- what authoritative evidence proves completion;
- which were legitimately waived or cancelled;
- which passed their deadline in silence.
```

Plan-DAG validation proves that declared work is structurally valid. It cannot detect a semantically necessary task that was never declared. Required evaluation strongly gates completion once an evaluation requirement exists. It does not generically guarantee that maintenance, retention disposition, recertification, or another cross-cutting process requirement was instantiated at all.

## Formal basis

Lamport's 1977 multiprocess-program work introduced the safety/liveness correctness vocabulary. Alpern and Schneider's 1985 definition gives the stronger operational distinction:

- a safety violation has a finite bad prefix;
- pure liveness cannot be disproved by any finite prefix;
- every property can be decomposed into safety and liveness components.

A monitor cannot conclusively reject the unbounded property:

```text
always(trigger implies eventually completion)
```

because completion may still occur later. The monitorable product contract is bounded response:

```text
always(trigger implies completion within deadline plus grace)
```

Before the bound expires, the instance is pending. After the bound expires without valid proof, the observed prefix is sufficient to emit a breach.

Runtime-verification literature supports three-valued finite-prefix reasoning: satisfied, violated, or still inconclusive. This product does not need a general LTL engine for the first implementation; explicit obligation rows are the smallest auditable representation of the required bounded-response subset.

## Canonical terminology

| Term | Meaning |
| --- | --- |
| `Process obligation definition` | Immutable versioned rule describing trigger, applicability, deadline, proof, severity, waiver, supersession, and breach response. |
| `Process obligation` | One durable requirement for one tenant and exact mission/task/effect/artifact/capability scope. |
| `Obligation proof` | Product-admitted record/event that satisfies the definition's proof contract. |
| `Obligation ledger` | Current rebuildable projection of obligation state and timing, derived from authoritative events/records. |
| `Completeness monitor` | Leased/fenced product process that detects overdue pending obligations and emits idempotent breaches. |
| `Obligation breach` | Immutable evidence that deadline plus grace passed without valid proof. |
| `Waiver` | Separately authorized, evidenced exception; not an agent-written `not applicable` string. |
| `Process completeness` | Every applicable critical obligation is durably represented and reaches an explicit state; silence is never terminal. |

Avoid `mandate` in durable APIs. It is easily confused with prompt instructions, legal mandates, and policy grants.

## Non-goals

The first implementation does not:

- prescribe or store private chain-of-thought;
- require one fixed reasoning trajectory;
- turn every best practice into a blocking obligation;
- make every task retrieve knowledge or write memory;
- replace independent evaluators;
- replace target reconciliation;
- adopt Temporal/Cadence as product authority;
- add a message bus;
- implement a general LTL/runtime-verification engine;
- claim that defined obligations cover every unknown real-world requirement;
- blindly retry an overdue external effect.

## Agent freedom and product authority

Agents may:

- propose tasks and plan changes;
- propose additional obligations and evidence needs;
- select an allowed adaptive reasoning path;
- produce proof candidates;
- report uncertainty and gaps.

Agents may not, by self-report alone:

- create a critical product obligation;
- satisfy a critical obligation;
- waive an obligation;
- change its deadline or severity;
- close a breach;
- use a heartbeat as completion proof.

The plan compiler and product transition handlers select required definitions. Product admission validates proof. Separate policy owns waiver and breach response.

## Do not mandate cargo-cult work

### Memory

Do not require a memory write after every task. Require an explicit **retention disposition** only when deterministic eligibility conditions fire:

- create a quarantined candidate;
- reject as non-reusable;
- record policy-based non-applicability.

Retention remains governed and evidence-backed.

### Retrieval

Do not require retrieval for every task. If a task contract declares an external-knowledge requirement, require one of:

- admitted fresh cited evidence;
- explicit stale/denied/unavailable disposition;
- authorized waiver.

### Maintenance

Trigger maintenance from objective state such as expiry, age, usage, drift, revocation, compatibility change, incident, or retention deadline. Do not use arbitrary recurring work without a stated risk or freshness objective.

## Proposed durable contracts

### `process-obligation-definition.v1`

Minimum fields:

```text
id, version, predecessor
scope kind
trigger event kind
applicability policy version/digest
deadline and grace policy
required proof kind/schema/version
severity
breach action
waiver policy
supersession policy
activation and revocation time
```

Definitions are immutable. A new required field or changed meaning creates a new schema/definition version.

### `process-obligation.v1`

Minimum fields:

```text
tenant, mission, obligation id
definition id/version/digest
scope kind/id and subject version
trigger event id/position
opened at, due at, grace until
state
proof record ids
satisfied/failed/waived/cancelled time
breached at
current fence
```

Recommended terminal states:

```text
satisfied
failed
waived
cancelled
```

`pending` is nonterminal. `Overdue` is a derived alert condition, not a terminal state. A late success can therefore preserve both facts:

```text
state = satisfied
breached_at = T1
satisfied_at = T2 where T2 > T1
```

### `process-obligation-breach.v1`

Records exact obligation/definition identity, due/grace times, observed database time, missing or invalid proof categories, monitor claim/fence, severity, selected response, and resolution linkage.

### `process-obligation-waiver.v1`

Records authorized actor/policy, exact scope, reason, evidence, validity period, residual risk, and affected obligation. The producing agent cannot be the sole waiver authority for its own critical obligation.

## Atomic transaction boundary

Creating an obligation after the trigger transaction recreates the omission hole:

```text
commit trigger
crash
obligation never exists
monitor sees nothing
```

The required transaction is:

```text
validate command and expected version
append trigger event
update projection
instantiate every applicable obligation
create outbox work if applicable
commit
```

The transaction must fail if a required obligation cannot be instantiated.

Satisfaction similarly binds proof in an authoritative transaction. An event tag alone is insufficient because the event itself may never be produced.

## Proof authority

Strong proof sources include:

- committed context-manifest digest;
- admitted evidence/artifact digest;
- current independent evaluation result;
- database checkpoint or projection version;
- signed effect receipt;
- independent target observation;
- skill certification, revocation, or rollback record;
- product-owned exception decision.

Weak sources that cannot independently satisfy critical obligations:

- agent prose;
- model-generated checklist;
- heartbeat alone;
- unverified logs;
- mutable path without digest;
- producer self-evaluation.

## Completeness monitor

Reuse the PostgreSQL claim/lease/fence pattern:

```text
select pending obligations whose grace_until <= transaction timestamp
for update skip locked
claim with lease and fence
re-read proof/current scope
emit one idempotent breach event
update projection and create policy-specific follow-up
acknowledge claim
```

Use the database clock. Worker clocks are evidence only.

The breach identity must deduplicate retries and concurrent monitors, for example by unique `(tenant_id, obligation_id, breach_generation)`.

If the monitor crashes, the overdue row remains directly queryable. Another monitor resumes after lease expiry. Operational monitoring separately observes monitor last-success time, oldest due age, claim backlog, and lease age; this avoids an infinite hierarchy of completeness obligations.

## Breach response matrix

| Obligation class | Safe response |
| --- | --- |
| Read-only retrieval | bounded retry or explicit unavailable disposition |
| Required evaluation | block acceptance |
| Evidence verification | keep record unadmitted |
| Memory disposition | keep candidate unusable; alert |
| Skill recertification | stop new assignments or restore stable version |
| Unknown external effect | reconcile target; never blind retry |
| Destructive effect | quarantine and escalate |
| Human exception | block dependent work only |
| Maintenance | schedule bounded work, alert, preserve overdue history |
| Expired capability | deny new execution |

A generic `retry overdue obligation` action is prohibited.

## Adaptive plans and supersession

Process completeness must not freeze one trajectory.

- A valid plan revision may open new obligations.
- It may cancel obligations whose trigger/scope is no longer applicable.
- Cancellation preserves history and requires an authoritative superseding plan/event.
- An already breached obligation remains breached even if later cancelled or satisfied.
- A new definition version does not reinterpret historical instances.
- Benign alternative paths must be explicit in the obligation definition or deterministic applicability policy.

## Alternatives

| Option | Benefit | Failure | Disposition |
| --- | --- | --- | --- |
| Trust agents plus post-hoc evaluation | no new subsystem | required work can remain absent and invisible | reject |
| Add trajectory/PRM scoring | richer process-quality signal | probabilistic self-reported trace; no durable occurrence guarantee | optional challenger later |
| Healthcheck/dead-man pings | simple missed-signal alert | heartbeat does not prove business completion | use only for operational progress |
| Adopt Temporal/Cadence now | mature durable timers/history | second workflow authority and migration cost before measured need | defer challenger |
| Native PostgreSQL obligations | atomic with existing authority, replay, leases, evidence | requires careful definition and waiver governance | select |
| Full LTL runtime monitor | expressive formalism | unnecessary implementation/operations complexity | defer |
| Offline process-mining conformance | strong expected-vs-observed audit | mostly after-the-fact | reuse concepts for audit/EXP-13 |

## Prior art and implications

### Safety and liveness

- Leslie Lamport, [“Proving the Correctness of Multiprocess Programs”](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/12/Proving-the-Correctness-of-Multiprocess-Programs.pdf), 1977.
- Bowen Alpern and Fred Schneider, [“Defining Liveness”](https://www.sciencedirect.com/science/article/pii/0020019085900560), 1985.

Implication: use bounded response with finite breach evidence; do not claim an online monitor proves pure unbounded liveness.

### Runtime verification

- Bartocci et al., [“Introduction to Runtime Verification”](https://www.um.edu.mt/library/oar/handle/123456789/86175), 2018.
- De Giacomo et al., [“LTLf and LDLf Monitoring”](https://arxiv.org/abs/1405.0054), 2014.

Implication: explicit three-valued pending/satisfied/violated semantics and finite-trace monitorability are sufficient; a general formula engine is not yet justified.

### Durable workflow heartbeats/history

- Temporal, [Activity timeouts and heartbeats](https://github.com/temporalio/documentation/blob/main/docs/develop/typescript/activities/timeouts.mdx).
- Temporal, [Workflow event history](https://github.com/temporalio/documentation/blob/main/docs/encyclopedia/event-history/event-history.mdx).

Implication: heartbeats detect a stalled scheduled activity and can carry checkpoints, but workflow code must first schedule the activity. Obligation instantiation belongs in the trigger transaction.

### Missed schedules and operational monitoring

- Healthchecks.io, [Monitoring cron jobs](https://healthchecks.io/docs/monitoring_cron_jobs/).
- Google SRE, [Distributed Periodic Scheduling](https://sre.google/sre-book/distributed-periodic-scheduling/).
- Google SRE, [Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/).
- NIST, [SP 800-137 Information Security Continuous Monitoring](https://csrc.nist.gov/pubs/sp/800/137/final).

Implication: track schedule/dispatch/start/completion and business effect, with risk-appropriate frequency and response. Silence must be interpreted against an explicit expectation and grace period.

### Process conformance

- Wil van der Aalst, [“Conformance Checking”](https://link.springer.com/chapter/10.1007/978-3-642-19345-3_7), 2011.

Implication: compare a normative expected model with observed event traces. The current ledger supplies observed events; obligation definitions supply the missing expected model.

### LLM process evaluation

- Lightman et al., [“Let’s Verify Step by Step”](https://arxiv.org/abs/2305.20050), 2023.
- Zhou et al., [“WebArena”](https://arxiv.org/abs/2307.13854), 2023.
- Liu et al., [“AgentBench”](https://arxiv.org/abs/2308.03688), 2023.

Implication: intermediate and long-horizon behavior matters, but model-scored reasoning or benchmark trajectories do not replace product-owned durable occurrence/proof checks.

## Threat and failure model

The implementation must detect or fail closed for:

- trigger commits without required obligation;
- duplicate trigger/obligation;
- missing completion;
- forged heartbeat;
- wrong-tenant/mission/scope proof;
- stale attempt/fence proof;
- wrong definition/schema version;
- late and duplicate completion;
- unauthorized or expired waiver;
- plan supersession without cancellation/new obligation;
- concurrent monitors;
- monitor crash before or after breach commit;
- breach replay duplication;
- cross-tenant claims;
- external-effect blind retry.

It must accept benign cases:

- valid alternative path;
- authorized evidenced waiver;
- cancellation before activation;
- plan supersession;
- retrieval legitimately not required;
- memory candidate correctly rejected;
- duplicate proof replay;
- late completion with preserved breach.

## `EXP-13` — Process obligation completeness campaign

### Critical mutations

1. omit obligation instantiation after trigger;
2. omit required completion;
3. emit heartbeat without proof;
4. attach wrong-tenant proof;
5. attach wrong mission/scope proof;
6. attach stale-fence proof;
7. attach wrong definition/schema version;
8. complete after deadline;
9. duplicate completion;
10. crash monitor before breach commit;
11. crash monitor after breach commit before acknowledgement;
12. waive through unauthorized actor;
13. supersede plan without cancelling old obligation;
14. add new plan requirement without new obligation;
15. claim obligation across tenants;
16. attempt blind retry for unknown external effect.

### Benign cases

1. allowed alternative route;
2. authorized waiver;
3. cancellation before activation;
4. superseding plan closes old obligation;
5. optional retrieval is not applicable;
6. memory retention is rejected under policy;
7. duplicate proof replay;
8. late completion remains satisfied with breach history.

### Pass thresholds

- 100% critical omission detection;
- zero critical false negatives;
- zero benign false positives in the seeded set;
- zero cross-tenant disclosure/effect;
- zero unauthorized waivers;
- zero duplicate logical breach events;
- exact replay/rebuild;
- detection no later than deadline + grace + two monitor sweep intervals;
- no blind external-effect retry.

The experiment must separately report definition coverage, obligation instantiation, proof admission, breach detection, response selection, and monitor recovery. A single aggregate pass boolean is insufficient.

### Qualification result

Sealed `EXP-13` seed 913 passes: 16/16 critical omissions detected, 0/8 benign false positives, zero cross-tenant effects, zero unauthorized waivers, zero duplicate logical breaches, exact rebuild, bounded detection and no generic retry. The artifact reports definition coverage, obligation instantiation, proof admission, breach detection, response selection and monitor recovery separately.

## Selected hypothesis

If every critical product transition atomically creates versioned, bounded, evidence-backed process obligations, and a fenced idempotent completeness monitor emits durable breaches for overdue obligations, then silent omission of required work becomes visible and attributable without constraining the LLM's internal reasoning strategy.

## Falsification conditions

Reject or redesign the selected approach if:

- a critical omission reaches accepted mission state undetected;
- trigger-to-obligation atomicity cannot be enforced;
- agent self-report can close a critical obligation;
- benign adaptive paths create material blocking false positives;
- monitor restart duplicates breach state;
- definition evolution makes history ambiguous;
- waiver bypasses authority;
- breach response retries an uncertain external effect;
- P9 measurements show timer/workflow operations exceed the PostgreSQL kernel envelope;
- Temporal/Cadence demonstrates materially lower correctness/operational cost without creating dual authority.

## Implementation sequence

1. Research/ADR/roadmap only — this card, terminology, `P9-INTEG-00`, `EXP-13`, architecture and maturity updates.
2. Versioned contracts plus append-only migration 019.
3. Atomic obligation lifecycle, proof admission, supersession, waiver, replay and restart reconciliation.
4. Leased/fenced completeness monitor, breach events, response policy and operational signals.
5. `EXP-13` mutation/fault qualification and gate review.
6. Resume `P9-INTEG-01`; expose obligation state through the mission API, activity stream and later operator views.

## Reversal conditions

Evaluate Temporal/Cadence as a challenger if P9 shows that timer cardinality, workflow evolution, long waits, failover, replay cost, or authoring complexity materially exceed the native kernel. Evaluate a formal runtime-verification engine only if obligation templates cannot express the required temporal relationships without unsafe bespoke code. Use trajectory/PRM evaluation only if it improves task outcomes in a held-out experiment without becoming product authority.

## Next coordinate

Implement and qualify `P9-INTEG-00`, then return to `P9-INTEG-01` — public mission API.
