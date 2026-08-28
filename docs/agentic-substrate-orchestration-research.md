# Apex and Specialist Orchestration Research Card

## Coordinate

`P1-RSCH-04` — apex and specialist orchestration

## Decision summary

Use a **durable typed blackboard with a replaceable apex planner and product-owned specialist assignments**.

The orchestration baseline is:

```text
product mission/epistemic state
→ deterministic reconciler decides whether routine work is ready or apex planning is needed
→ fresh apex OMP assignment reads a bounded mission snapshot
→ apex proposes PlanDelta + specialist/probe assignments
→ deterministic validator commits accepted revision and assignment records
→ product dispatcher leases assignments to isolated OMP workers
→ specialists return typed results/evidence/gaps
→ evaluator and epistemic engine update state
→ reconciler continues routine work or requests a new apex assignment
```

Core rules:

- The apex is intelligent but replaceable. It owns no durable state.
- The durable blackboard is typed product state, not a shared chat transcript.
- Top-level specialist assignments belong to the product ledger, not OMP’s parent session.
- Routine known work follows deterministic readiness/dependency rules; novel planning and replanning invoke the apex.
- Disagreement creates an epistemic gap or independent evaluation. It is not resolved by majority vote.
- Specialist output is a proposal/observation until validators and evaluators accept it.
- Parallelism requires explicit ownership or read-only scope.
- Completion is a product predicate, never “the agent said done.”
- Direct peer chat, swarms, contract markets, recursive hierarchies, and multiple apex agents remain deferred for S1.

## Why orchestration is not just delegation

The substrate must coordinate five different concerns:

1. **Cognition** — which question, plan, or hypothesis to pursue.
2. **State** — what is durably known, planned, running, accepted, or unresolved.
3. **Resource allocation** — which model/agent/tool receives which budget and scope.
4. **Authority** — what each worker may read, propose, or execute.
5. **Evaluation and recovery** — how results are checked, disagreed with, retried, superseded, or quarantined.

A manager prompt alone handles only the first and part of the third.

## Roles

### Deterministic mission reconciler

Responsibilities:

- read current mission/plan/task/effect/evaluation state;
- promote dependency-ready routine tasks;
- detect expired leases, stale attempts, unresolved effects, and blocked scopes;
- request an apex assignment when planning/replanning is needed;
- request evaluation/reconciliation work from committed contracts;
- apply legal state transitions;
- detect terminal mission predicates.

It does not invent a plan or interpret ambiguous evidence.

### Apex planner

Responsibilities:

- interpret the current mission snapshot;
- rank gaps and next evidence actions;
- propose plan revisions;
- propose specialist/probe/evaluation assignments;
- identify dependencies and mutually exclusive alternatives;
- respond to failures and changed findings;
- propose carried ambiguity or smallest external exception;
- explain rationale and cite evidence.

It cannot:

- directly mutate mission state;
- directly run customer effects;
- accept its own output;
- change hard authority/evaluation rules;
- rely on hidden conversation state for continuity.

### Specialist worker

Responsibilities:

- solve one typed bounded assignment;
- use only assigned context/tools/scope;
- return structured artifacts, assertions, evidence references, gaps, uncertainty signals, and failure details;
- propose follow-up work without dispatching it;
- stop at its budget or authority boundary.

Specialists do not own the final decision.

### Evaluation worker

Responsibilities:

- receive exact subject/input/evaluator versions;
- run deterministic or calibrated independent checks;
- produce measures, evidence, disagreement, and verdict;
- avoid producer context or identity when independence requires it.

### Exception responder

A human or external accountable party answers one smallest irreducible question. The answer becomes a sourced assertion/evidence item, not an unlogged side-channel instruction.

## Contracts

### `ApexAssignment`

```text
assignment_id
 mission_id
 mission_version
 active_plan_revision
 accepted_findings_snapshot
 material_contradictions
 ranked_open_gaps
 task/attempt/effect/evaluation summary
 recent outcomes and stall records
 available specialist capabilities
 mutable mission constraints
 hard constitution reference
 remaining budgets
 context_manifest
 output_schema_version
```

### `ApexResult`

```text
base_mission_version
 proposed_plan_deltas[]
 proposed_specialist_assignments[]
 proposed_probe_candidates[]
 proposed_evaluation_assignments[]
 proposed_external_exception
 mission_status_proposal
 evidence_refs[]
 assumptions[]
 unresolved_uncertainty[]
 rationale_summary
```

The result is rejected if its base version is stale, evidence references are unavailable, schemas are invalid, authority expands, or graph/recovery rules fail.

### `SpecialistAssignment`

```text
assignment_id
 parent_apex_assignment_id
 mission_id / mission_version / plan_revision
 capability_id / capability_version
 goal
 owned_scope
 read_scope
 dependencies
 context_manifest
 allowed_tools
 allowed_effect_classes
 budget: tokens / requests / wall_clock / cost
 output_schema
 evaluator_contract
 lease / fence / expiry
```

### `SpecialistResult`

```text
assignment_id / attempt_id / fence
 status: yielded | failed | expired | cancelled | superseded
 artifacts[]
 evidence_items[]
 assertions[]
 hypotheses[]
 gaps[]
 proposed_decisions[]
 proposed_followups[]
 evaluator_inputs[]
 usage
 failure_class
```

### `ProgressAssessment`

```text
mission_version
 plan_revision
 forward_progress_evidence
 repeated_action_fingerprints
 unresolved_blockers
 queue/attempt/effect/evaluation age
 local_retry_count
 global_replan_needed
 reason
```

## Durable blackboard

The blackboard is a set of product-owned relational projections over the mission/event ledger:

```text
mission snapshot
accepted findings
contradiction sets
ranked gaps and probes
plan revisions and task graph
assignment proposals, attempts and results
active effects and receipts
evaluation assignments and verdicts
budgets and capability availability
progress/stall assessments
external exceptions
```

Workers read a bounded snapshot through a `ContextManifest`. They never directly edit blackboard rows. They submit typed proposals that the kernel validates and commits.

This differs from a shared agent chat:

| Durable blackboard | Shared chat/group conversation |
| --- | --- |
| Typed, versioned, queryable records | Unstructured message stream |
| Explicit authority and ownership | Speaker order often implies control |
| Conflict preserved as epistemic state | Consensus may erase disagreement |
| Reconstructable from events | Context may truncate/compact |
| Tenant and data-class scoped | Shared context increases leakage risk |
| Stale results rejected by version/fence | Late messages can influence active agents |

## Control loops

### Loop 1 — Routine deterministic execution

When a committed plan already specifies a task, dependency, capability, evaluator, and recovery rule:

```text
ready task
→ lease specialist/evaluator/adapter
→ run
→ ingest typed result
→ evaluate/reconcile
→ transition or create gap
```

No apex call is needed merely to move a known task between states.

### Loop 2 — Adaptive apex planning

Trigger when:

- no plan exists;
- a material gap needs action selection;
- new evidence invalidates the active plan;
- specialist results conflict;
- a task fails for a non-routine reason;
- progress stalls or loops;
- capability/evaluator is missing;
- scope/priority/constraint changes.

```text
create ApexAssignment from current state
→ run fresh apex worker
→ validate result
→ commit PlanRevision/assignments/probes
→ return to routine execution
```

### Loop 3 — Local retry

A bounded specialist/effect may retry only when the failure classifier and contract say retry is safe. Local retries do not silently redesign the global plan.

### Loop 4 — Global replan

Repeated local failure, new contradiction, evaluator rejection, or capability gap creates a durable `ReplanRequested` event. A new apex assignment receives failure evidence and may change the strategy.

## Progress and stall detection

Do not ask only “is the task complete?”

Track:

- new accepted evidence/findings;
- closed or newly material gaps;
- accepted plan/task/evaluation/effect transitions;
- repeated assignment/probe fingerprints;
- repeated failure class;
- elapsed time and budget without evidence delta;
- queue, attempt, effect, and evaluator age;
- plan revisions without measurable progress.

S1 baseline:

- one local retry when the contract marks the failure transient;
- two consecutive no-progress assessments trigger a fresh apex replan;
- two replan cycles with no new evidence trigger quarantine or explicit external exception, not infinite agent loops.

These thresholds are prototype values and must be evaluated.

## Completion predicate

A mission or S1 slice is terminal only when the kernel verifies:

- required outputs/artifacts exist at accepted versions;
- required evaluators passed;
- no blocker-severity gap remains for the declared scope;
- no active or unknown external effect remains;
- every dependent task is terminal or explicitly out of scope;
- required evidence packet is complete;
- budget/exception rules are satisfied.

The apex may propose completion. It cannot commit completion.

---

# Pattern comparison

## Deterministic workflow

Best for:

- fixed sequential/parallel/loop subflows;
- known retry/timer/callback behavior;
- repeatable evaluation pipelines.

Failure for mission-level use:

- cannot anticipate evolving evidence and task shape;
- encourages encoding the mission brain in replayed code.

Decision: use for bounded routine subflows, not the apex mission loop.

## Manager / specialists as tools

A central agent retains control and calls specialists as tools.

Strengths:

- simple central coherence;
- specialist context isolation;
- easy synthesis;
- good S1 mental model.

Risks:

- hidden state accumulates in manager context;
- manager becomes bottleneck and single reasoning failure;
- specialist execution/result may not be durable outside the turn.

Decision: adapt the cognitive pattern, but move state/assignments/results to the product blackboard and run each top-level specialist as a product-owned worker.

## Handoffs / swarm

A triage/current agent transfers control to a specialist.

Strengths:

- focused prompts and direct specialist ownership;
- useful for conversational routing.

Risks:

- mission coherence and authority move implicitly with conversation control;
- difficult to combine independent outputs;
- context and state handoff may be incomplete.

Decision: not S1 mission orchestration. May support operator conversation later.

## Durable blackboard

Specialists operate over a shared typed problem state; a control policy chooses which knowledge source acts next.

Strengths:

- state outlives every agent;
- specialists remain decoupled;
- contradictions and partial progress coexist;
- asynchronous work and dynamic replanning fit naturally.

Risks:

- blackboard schema can become a dumping ground;
- agenda/next-action policy is the real intelligence bottleneck;
- unbounded writes create noisy or conflicting state.

Decision: selected, with typed records, proposal-only worker writes, and event-sourced history.

## Magentic-One-style orchestrator

The [Magentic-One paper](https://arxiv.org/abs/2411.04468) uses an outer task ledger and inner progress ledger. The orchestrator tracks facts, guesses, plan, next speaker, looping, progress, and stall count, then replans after repeated stalls.

Adopt:

- separate global task understanding from local progress assessment;
- explicit stall detection;
- context reset/new worker after replan;
- specialized tools/agents;
- plan as revisable guide.

Change:

- ledgers become product-owned typed durable records;
- facts/guesses become epistemic assertions/findings/hypotheses;
- speaker selection becomes leased assignment creation;
- completion and progress require external evidence, not orchestrator judgment alone.

## Planner / generator / evaluator

Anthropic’s [long-running application harness](https://www.anthropic.com/engineering/harness-design-long-running-apps) reports a planner, generator, and evaluator architecture with structured handoff artifacts and context resets.

Adopt:

- role separation;
- fresh contexts between stages;
- evaluator independence;
- durable artifacts rather than accumulated chat context.

S1 mapping:

- apex planner;
- two specialist generators/researchers;
- deterministic evaluator.

## Parallel orchestrator-workers

Anthropic’s [multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) uses a lead agent that plans and delegates parallel research to subagents with separate context windows, then compresses results.

Adopt when:

- subtasks are independent;
- parallel context capacity creates real coverage;
- results can be merged through evidence.

Avoid when:

- work is tightly coupled;
- agents mutate shared state/files/effects;
- coordination cost exceeds the task;
- evaluators cannot distinguish coverage from repeated error.

## Group chat and multi-agent debate

[Multiagent debate](https://arxiv.org/abs/2305.14325) and AutoGen team patterns can improve some reasoning tasks.

Risks:

- correlated models are not independent evidence;
- consensus can amplify a shared misconception;
- cost and transcript growth;
- unclear output ownership;
- speaker selection becomes another model decision.

Decision: defer. S1 disagreement becomes an epistemic gap and probe, not a vote.

## Contract net / market allocation

The [Contract Net Protocol](https://reidgsmith.com/The_Contract_Net_Protocol_Dec-1980.pdf) distributes tasks through announcements, bids, and awards.

Potential future value:

- many heterogeneous workers;
- capability/cost/availability-aware allocation;
- decentralized scaling.

Decision: defer until worker diversity makes central assignment a measured bottleneck.

## SOP/role pipelines

[MetaGPT](https://arxiv.org/abs/2308.00352) encodes standardized operating procedures and role-based intermediate artifacts to reduce cascading hallucinations.

Adopt later:

- typed capability packs;
- expected intermediate artifacts;
- role-specific evaluators.

Risk:

- fixed SOPs can become rigid when source reality requires replanning.

Decision: skills/capability layer after substrate correction loop.

## Current managed-agent architecture

Anthropic’s [Managed Agents architecture](https://www.anthropic.com/engineering/managed-agents) separates session, harness, and sandbox. The durable session is not identical to the model-visible context; harness policy can compact/reset/reorganize context while history remains.

Adopt:

- durable state separate from context;
- replaceable harness and model;
- sandbox/worker isolation;
- stable interfaces that outlive current model weaknesses.

Our product adds domain mission, epistemic, evaluation, and effect authority outside that worker session.

---

# OMP implementation map

## Strong reusable mechanics

### Structured task execution

Files:

- `packages/coding-agent/src/task/index.ts`
- `packages/coding-agent/src/task/types.ts`
- `packages/coding-agent/src/task/structured-subagent.ts`
- `packages/coding-agent/src/task/executor.ts`
- `packages/coding-agent/src/task/spawn-policy.ts`

Present:

- discovered specialist definitions;
- typed per-spawn assignments;
- structured output schemas with strict/permissive modes;
- per-agent tools/models/thinking/skills;
- spawn depth and allowed-agent policy;
- batch/parallel execution;
- worktree isolation;
- budgets and hard-stop grace;
- progress/lifecycle/event channels;
- retries and output/artifact management;
- advisories for specialization and coordination.

S1 reuse:

- agent definitions and structured schema conventions;
- strict output validation;
- model/tool/budget resolution;
- output truncation/artifact handling;
- bounded microtask fan-out only after product assignment is running.

S1 changes:

- first-level assignments are product records and separate OMP RPC workers;
- no permissive schema fallback for authoritative product results;
- output cannot directly mutate mission state;
- worktree isolation is optional implementation detail, not mission identity.

### Registry and lifecycle

Files:

- `packages/coding-agent/src/registry/agent-registry.ts`
- `packages/coding-agent/src/registry/agent-lifecycle.ts`
- `packages/coding-agent/src/registry/persisted-agents.ts`

Present:

- main/sub/advisor identity;
- running/idle/parked/aborted state;
- history/metrics;
- persisted transcript roster restoration;
- agent adoption, TTL parking, revival, cancellation, tombstones;
- stale lifecycle work bound to exact agent references.

Useful pattern:

- live process/session registry separated from persisted transcript history;
- exact-ref checks prevent stale async lifecycle operations from clobbering replacements.

Limit:

- process-global and session/transcript based;
- not tenant mission assignment authority.

### Hub and IRC

Files:

- `packages/coding-agent/src/tools/hub/*`
- `packages/coding-agent/src/irc/bus.ts`

Present:

- peer roster;
- send/wait/inbox;
- wake/revive/aside delivery behavior;
- background job wait/cancel/snapshot;
- ownership restrictions;
- process control.

Limit:

- process-global mailbox with bounded in-memory queues;
- direct messages influence active agent contexts;
- not authoritative or durable mission evidence by default.

Decision:

- do not use Hub/IRC as S1 blackboard or assignment protocol;
- retain as optional debugging/worker-local micro-coordination later;
- product messages become durable typed records first.

## OMP orchestration conclusion

OMP is a strong specialist execution harness. It should not become the top-level durable scheduler. Product orchestration wraps OMP workers through RPC and assigns exact role/context/tools/budgets/output schema.

---

# Orca implementation map

## Strong reusable mechanics

### Durable task and dispatch records

Files:

- `src/main/runtime/orchestration/types.ts`
- `src/main/runtime/orchestration/db/tasks/task-store.ts`
- `src/main/runtime/orchestration/db/worker-dispatch/*`
- `src/main/runtime/orchestration/lifecycle-reconciliation.ts`

Present:

- task/dependency/status;
- separate dispatch attempts;
- capabilities and process incarnation;
- dependency promotion;
- failure count/circuit breaker;
- stale/unauthorized completion rejection.

### Coordinator

Files:

- `src/main/runtime/orchestration/coordinator.ts`
- `coordinator-task-dispatch.ts`
- `coordinator-dag-convergence.ts`
- `coordinator-escalation-triage.ts`

Present:

- polling coordinator;
- ready-task dispatch with maximum concurrency;
- lifecycle message reconciliation;
- retry/circuit-break handling;
- stuck-DAG warning;
- worktree drift protection;
- decision gates.

Important limitation from source:

- AI-driven decomposition is explicitly not implemented; tasks must be pre-created;
- coordinator phase/completed/failed lists are process memory;
- worker selection uses terminals/worktrees;
- stale dispatches warn rather than automatically classify/recover;
- completion checks task statuses, not evidence/evaluation contracts.

Disposition:

- reuse/adapt task/attempt/capability/stale-result/circuit-break invariants;
- replace coordinator with deterministic mission reconciler + event-driven apex assignments;
- replace terminal/worktree identities with tenant/workload/assignment identities.

### Durable mail and federation

Files:

- `src/main/runtime/orchestration/db/runs/run-delivery.ts`
- `src/main/runtime/orchestration/db/messages/*`
- `src/main/runtime/orchestration/federation-sync.ts`

Present:

- outstanding delivery;
- consumer generation fencing;
- message sequence/read/delivered distinction;
- replay/acknowledgment;
- remote dispatch relay and settlement.

Disposition:

- adapt delivery semantics for assignment/result/event transport;
- typed product records, not free-form mail, remain authority.

## Orca orchestration conclusion

Orca supplies a valuable deterministic coordinator skeleton and tested failure semantics. It does not yet provide the intelligent decomposition/apex layer. The product should preserve its deterministic coordination strengths while moving intelligence into explicit apex assignments over durable mission/epistemic state.

---

# Orchestration architecture comparison

| Pattern | Dynamic planning | Durable state fit | Context isolation | Failure containment | Cost | S1 decision |
| --- | --- | --- | --- | --- | --- | --- |
| Single persistent apex session | High | Weak unless externalized | Weak over long horizon | Apex is single hidden-state failure | Low/medium | Reject as authority |
| Manager with specialists as tools | High | Partial | Strong for specialists | Parent turn/session still central | Medium | Adapt cognitive pattern |
| Handoffs/swarm | High routing flexibility | Weak/partial | Strong after handoff | Ownership/control moves implicitly | Medium | Defer |
| Deterministic workflow | Low/medium | Strong | N/A | Strong for known steps | Low | Use bounded subflows |
| Group chat/debate | Medium | Transcript-centric | Shared context | Correlated error/ownership risk | High | Defer |
| Contract net/market | High allocation flexibility | Needs durable task market | Strong | Distributed complexity | High | Defer |
| Magentic-One task/progress ledgers | High | In-context ledgers in reference design | Specialist separation | Stall/replan loop | High | Adapt ledgers into product state |
| Durable typed blackboard + fresh apex | High | Strong | Strong | State and workers separable | Medium | **Selected** |

## Selected S1 topology

```text
                   ┌─────────────────────────────┐
                   │ Product mission blackboard  │
                   │ evidence / gaps / plan /     │
                   │ assignments / evaluations   │
                   └──────────────┬──────────────┘
                                  │
                         deterministic reconciler
                                  │
                     needs planning/replanning?
                         ┌────────┴────────┐
                         │                 │
                        no                yes
                         │                 │
                 dispatch routine    run fresh apex OMP
                 bounded work        assignment
                         │                 │
                         │          PlanDelta + assignments
                         │                 │
                         └────────┬────────┘
                                  │
                      validate and commit revision
                                  │
                 ┌────────────────┴────────────────┐
                 │                                 │
        specialist OMP A                 specialist OMP B
                 │                                 │
                 └──────── typed results/evidence ─┘
                                  │
                    epistemic engine + evaluator
                                  │
                     commit outcome / gap / replan
```

## S1 assignment rules

1. One apex assignment at a time per mission version.
2. Apex lease/fence prevents stale plan commits.
3. Two specialists may run in parallel only with read-only or disjoint owned scopes.
4. Specialists cannot directly message each other in S1; clarifications become follow-up assignments through durable state.
5. Specialist schemas run in strict mode.
6. Every result carries assignment/attempt/fence and context manifest.
7. Duplicate result is idempotent; stale result becomes evidence only.
8. Disagreement creates a contradiction/gap, not a vote.
9. Evaluator is independently assigned and cannot be the producing specialist.
10. Mission completion is a kernel predicate.

## Progress policy

Prototype scoring inputs:

- accepted evidence/finding delta;
- gap severity/coverage delta;
- accepted artifact/evaluation delta;
- repeated assignment/probe fingerprint;
- repeated failure class;
- elapsed budget since last accepted delta;
- unresolved effect/evaluator age.

Policy:

```text
routine transient failure
→ at most one local retry

no accepted progress for two assessments
→ fresh apex replan

no accepted progress after two replans and no new evidence
→ quarantine scope or external exception
```

This policy must be evaluated; thresholds are not production defaults.

---

# Experiment suite

## `ORCH-EXP-01` — Apex crash and replacement

Fixture:

- apex receives mission version V1;
- proposes plan delta;
- crash before/after result/commit;
- replacement apex may propose a different delta.

Pass:

- exactly one accepted plan revision from V1;
- no model reasoning replay;
- stale apex result rejected;
- replacement reconstructs from durable state;
- history records all attempts and selected result.

## `ORCH-EXP-02` — Specialist disagreement

Fixture:

- two specialists receive independent contexts;
- one supports proposition X, one supports incompatible Y;
- one cheap probe discriminates them.

Pass:

- no majority/manager synthesis silently resolves conflict;
- contradiction and gap committed;
- apex selects admissible discriminating probe;
- probe result updates accepted finding;
- both specialist results remain evidence.

## `ORCH-EXP-03` — Duplicate and stale specialist result

Fixture:

- same result delivered twice;
- retry attempt supersedes original;
- original returns late with a different answer.

Pass:

- duplicate is idempotent;
- only current attempt may satisfy assignment;
- late result is evidence only;
- no duplicated artifact/evaluation/plan transition.

## `ORCH-EXP-04` — Parallel ownership

Fixture:

- two specialists with disjoint scopes;
- two specialists with overlapping mutation scope;
- shared read-only corpus.

Pass:

- disjoint/read-only work runs concurrently;
- overlapping mutations are serialized or rejected before dispatch;
- context/tenant isolation holds;
- merge uses typed evidence/artifacts, not last writer wins.

## `ORCH-EXP-05` — Stall, livelock, and budget

Fixture:

- specialist returns same failed approach repeatedly;
- apex issues equivalent probes under different wording;
- evaluator remains failed;
- finite token/request/time budget.

Pass:

- repeated action fingerprints detected;
- at most one local retry;
- fresh apex replan after two no-progress assessments;
- quarantine/exception after second evidence-free replan;
- no unbounded spawn or hidden budget overrun.

## `ORCH-EXP-06` — Model and worker substitution

Fixture:

- apex/specialist model version changes between attempts;
- one worker runtime crashes;
- context manifest stays fixed.

Pass:

- state continuity does not depend on provider session;
- every attempt pins model/runtime/version;
- replacement result is evaluated under the same contract;
- no cross-model hidden context.

## `ORCH-EXP-07` — Nested spawn containment

Fixture:

- specialist attempts recursive child fan-out beyond allowed depth/budget;
- child fails schema or times out.

Pass:

- spawn policy and budget enforced;
- child failure cannot alter product assignment state directly;
- parent produces explicit bounded failure/result;
- no orphan process/worktree/job.

## `ORCH-EXP-08` — False completion

Fixture:

- apex declares done while one blocker gap, one failed evaluator, or one unknown effect remains.

Pass:

- completion proposal rejected;
- exact unsatisfied predicates returned;
- required follow-up/reconciliation remains runnable;
- only product kernel commits terminal mission state.

## S1 required subset

Required before S1 passes:

- `ORCH-EXP-01` apex crash;
- `ORCH-EXP-02` disagreement;
- `ORCH-EXP-03` stale/duplicate result;
- `ORCH-EXP-04` parallel ownership;
- `ORCH-EXP-05` stall/budget;
- `ORCH-EXP-08` false completion.

Model substitution and nested spawning remain useful but may land immediately after S1 if the preserved seams pass review.

## Reversal conditions

Revisit the selected topology if:

- one apex becomes a measured planning bottleneck;
- independent apex candidates plus evaluator beat one-apex performance on held-out cases;
- durable peer communication materially improves tightly coupled specialist work;
- task allocation across many heterogeneous workers requires market/contract-net behavior;
- context reset loses critical continuity not recoverable from product state;
- deterministic orchestration can replace model planning for a capability without reducing outcome quality.

## Next coordinate

`P1-RSCH-05` — research context assembly, retrieval, citations, and live research.
