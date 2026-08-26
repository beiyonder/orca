# Epistemic World Model and Gap Resolution Research Card

## Coordinate

`P1-RSCH-03` — epistemic world models, active gap resolution, uncertainty, and abstention

## Decision summary

Use a **product-owned, event-sourced epistemic ledger with a provenance and justification graph**.

Core rules:

- Preserve immutable evidence separately from claims and conclusions.
- Treat customer documents, people, tools, agents, and memories as sources that make assertions—not as truth authorities.
- Replace the overloaded term `Fact` with `AcceptedFinding` for the current evidence-backed conclusion.
- Preserve conflicting propositions and their support/refutation edges until a discriminating observation or explicit exception resolves them.
- Derive current epistemic status from evidence, applicability, freshness, conflict, and evaluator results—not a model-generated confidence percentage.
- Rank gaps by decision impact and the value of the cheapest safe discriminating evidence.
- Let agents propose assertions, hypotheses, gaps, probes, and findings. Only the product kernel commits accepted epistemic state.
- On invalidation, preserve history, identify affected decisions/plans/skills/memories, quarantine material dependants, and re-evaluate them.

Do not implement a full Bayesian network, formal ATMS, or abstract argumentation solver for the first slice. Borrow their useful structures—assumptions, justifications, support/attack edges, multiple candidate worlds—then prove the simpler model against seeded contradictions.

## Why “fact” is the wrong primitive

A legacy estate changes while we inspect it.

A statement may be:

- directly observed at one time;
- asserted by a stakeholder;
- copied from stale documentation;
- inferred from code;
- true only for one software version or environment;
- contradicted by runtime behavior;
- inaccessible rather than absent;
- accepted now and superseded later.

Calling all of these “facts” either destroys provenance or creates false certainty.

Canonical terms:

| Term | Meaning |
| --- | --- |
| `EvidenceItem` | Immutable artifact or observation: document, query result, schema snapshot, log slice, code version, target read, evaluator output, human answer. |
| `Proposition` | Normalized statement that can be supported or refuted within a declared scope and validity interval. |
| `Assertion` | One source asserting a proposition, with provenance and source role. |
| `Hypothesis` | Testable proposition or proposition set whose predicted observations can discriminate it from alternatives. |
| `SupportEdge` | Typed relationship: supports, refutes, depends-on, derived-from, attacks, supersedes, or is-applicable-to. |
| `ContradictionSet` | Two or more propositions that cannot simultaneously be accepted in the same scope/time/version. |
| `Gap` | Decision-relevant missing or conflicting evidence. |
| `ProbeCandidate` | Bounded research/query/experiment/delegation action with predicted outcomes, cost, risk, latency, and permission needs. |
| `AcceptedFinding` | Current product conclusion after acceptance rules run. It remains versioned, sourced, and reversible. |
| `ImpactReview` | Work created when changed evidence may invalidate a decision, plan, task, evaluator, skill, or memory. |

## Epistemic lifecycle

```text
Evidence observed/imported
→ source and scope recorded
→ assertion extracted or supplied
→ proposition normalized
→ support/refutation edges attached
→ contradiction and coverage checks run
→ candidate status projected
→ gap/probe created if unresolved
→ independent acceptance rule runs
→ AcceptedFinding version committed
→ downstream decisions record dependency
→ later evidence may stale/contradict/supersede
→ ImpactReview and re-evaluation
```

## Record contracts

### `EvidenceItem`

Required fields:

```text
id
 tenant_id
 mission_id
 kind
 source_identity
 source_role
 source_uri_or_artifact_ref
 source_version
 observed_at
 ingested_at
 valid_from / valid_until
 environment / system / product_version scope
 data_class
 content_digest
 content_ref
 collection_method
 collector_identity
 access_disposition
```

Rules:

- immutable content and metadata corrections are new versions;
- access denial is an evidence item, not proof of absence;
- generated summaries point to the original evidence item;
- raw sensitive bodies remain in the evidence store, not claim payloads.

### `Proposition`

Required fields:

```text
id
 canonical_subject
 canonical_predicate
 canonical_object
 scope
 validity_interval
 schema_version
```

A proposition is content-addressed only within its canonical scope. “Table X exists” in production Oracle 12c and “Table X exists” in a test export are different scoped propositions.

### `Assertion`

Required fields:

```text
id
 proposition_id
 source_evidence_id
 source_role: observation | authoritative_document | stakeholder | tool | agent_inference | memory
 polarity: supports | refutes
 directness: direct | derived | reported
 extraction_method
 created_at
```

The source role is descriptive, not a universal trust score. A tool may directly observe a schema and still be wrong because it queried the wrong environment.

### `Hypothesis`

Required fields:

```text
id
 proposition_ids
 assumptions
 predicted_observations[]
 competing_hypothesis_ids[]
 scope
 status: active | supported | weakened | disproven | superseded
```

A hypothesis without predicted discriminating observations is merely an opinion and cannot be ranked for active testing.

### `Gap`

Required fields:

```text
id
 question
 impacted_decision_ids[]
 impacted_scope
 competing_hypothesis_ids[]
 missing_coverage
 severity
 deadline
 status: open | investigating | resolved | carried_ambiguity | external_exception | scope_reduced
```

### `ProbeCandidate`

Required fields:

```text
id
 gap_id
 action_type
 tool_or_specialist
 required_authority
 expected_outcomes_by_hypothesis
 discrimination_grade
 decision_impact_grade
 cost_grade
 risk_grade
 latency_grade
 reversibility
 data_class
```

### `AcceptedFinding`

Required fields:

```text
id
 proposition_id
 status: accepted | contested | stale | disproven | superseded
 acceptance_rule_version
 supporting_assertion_ids[]
 refuting_assertion_ids[]
 unresolved_conflict_ids[]
 coverage_summary
 accepted_at
 superseded_by
```

An `AcceptedFinding` is a derived product state. It does not erase assertions or evidence.

## Epistemic state transitions

| Current state | Trigger | Next state | Required action |
| --- | --- | --- | --- |
| Candidate | admissible support arrives | Supported | Recompute coverage/conflicts. |
| Candidate/Supported | material refutation arrives | Contested | Create/update contradiction set and gap. |
| Supported | acceptance rule passes | Accepted | Commit finding version and downstream dependency edges. |
| Accepted | new contradictory evidence | Contested | Create impact reviews; quarantine affected high-risk work. |
| Accepted | freshness/applicability expires | Stale | Stop using for new decisions until refreshed. |
| Any | discriminating evidence falsifies | Disproven | Preserve old history; close losing hypothesis; propagate impact. |
| Accepted/Contested | newer scoped proposition replaces | Superseded | Link versions; evaluate affected dependencies. |
| Gap open | probe resolves decision-relevant uncertainty | Resolved | Record probe/result and rerun acceptance. |
| Gap open | evidence cannot resolve intent/legal meaning | External exception | Ask the smallest authoritative question. |
| Gap open | cost/risk exceeds value | Carried ambiguity or scope reduced | Record why and constrain downstream authority. |

## Evidence quality model

Do not use one uncalibrated confidence number.

Track a vector:

| Dimension | Question | Initial representation |
| --- | --- | --- |
| Directness | Was this observed, derived, or reported? | Categorical |
| Source role | What produced it? | Categorical, scope-specific |
| Independence | Are sources genuinely independent? | Count plus dependency links |
| Applicability | Does it match environment/product/version/time? | Exact / partial / unknown / mismatch |
| Freshness | Is it inside its validity/refresh window? | Current / aging / stale |
| Coverage | How much of the relevant population/scope was observed? | Explicit numerator/denominator or named gap |
| Conflict | Is material refutation unresolved? | None / nonmaterial / material |
| Reproducibility | Can another probe obtain equivalent evidence? | Reproduced / not tried / failed |
| Evaluator status | Did a pinned acceptance check pass? | Passed / failed / unavailable / contradictory |
| Decision sensitivity | Would a different value change the plan? | Low / medium / high / blocker |

Model uncertainty signals—self-reported probability, token entropy, semantic entropy, ensemble disagreement—may trigger retrieval, branching, or abstention. They cannot promote a proposition to `AcceptedFinding`.

## Contradiction handling

Rules:

1. Never overwrite one proposition with another because the newer source looks more confident.
2. Create a `ContradictionSet` only when propositions are incompatible in the same scope/time/version.
3. Distinguish contradiction from normal version change or environment difference.
4. Preserve all support/refutation edges.
5. Ask which observation would differ if each hypothesis were true.
6. Prefer a safe probe that discriminates the strongest live alternatives.
7. Resolve by evidence or explicit authoritative exception, not source majority alone.
8. Keep the losing proposition as disproven/superseded history.
9. Re-evaluate decisions that depended materially on the losing proposition.

## Invalidation and impact propagation

Dependency edges:

```text
AcceptedFinding
→ DecisionRecord
→ PlanRevision
→ Task / EffectIntent / EvaluationContract
→ Artifact / SkillVersion / MemoryCandidate
```

When a finding becomes contested, stale, disproven, or superseded:

1. Create one `ImpactReview` per materially dependent object.
2. Stop new high-risk effects relying on it.
3. Do not automatically undo already-applied effects.
4. Reconcile current external state.
5. Re-run affected evaluators or apex planning.
6. Continue unaffected branches.
7. Record the resolution: unchanged, revised, repaired, compensated, quarantined, or revoked.

The dependency graph is for impact analysis. It is not permission to auto-propagate model guesses as facts.

## Active probe selection

### Candidate generation order

1. Retrieve current approved primary sources.
2. Inspect already-authorized metadata/code/logs.
3. Run a bounded read-only query or sample.
4. Compare downstream/output behavior.
5. Run a sandboxed experiment or replay.
6. Ask an independent specialist.
7. Request new access or physical action.
8. Ask a human for irreducible intent/legal meaning.

### Hard filters

Reject a probe that:

- cannot distinguish any active hypothesis;
- exceeds authority or data-class policy;
- mutates a real system when a read-only discriminator exists;
- lacks an observable result;
- costs more than the affected decision warrants;
- duplicates evidence already current and sufficient;
- risks material harm without a recovery path.

### Ranking

Use transparent ordinal grades initially:

```text
priority =
  decision impact
  × expected discrimination
  × urgency
  ÷ (cost + risk + latency)
```

Each factor is `0–3` with a written basis. Do not present the resulting arithmetic as calibrated probability.

Tie breakers:

1. safer;
2. more reversible;
3. more direct observation;
4. broader hypothesis elimination;
5. lower cost/latency;
6. less sensitive data exposure.

Use formal expected information gain only when hypotheses and outcome probabilities are calibrated. Lindley’s information criterion is a design foundation, not permission to invent probabilities.

## Abstention and escalation

The system abstains from an `AcceptedFinding` when:

- required coverage is unknown;
- a material contradiction remains;
- source applicability is unknown;
- evidence is stale for the decision horizon;
- evaluator is unavailable/contradictory;
- the only support is model inference or memory;
- access denial prevents distinguishing absence from invisibility.

Human escalation is allowed only for:

- authoritative business intent that evidence cannot recover;
- legal/accountability judgment;
- unavailable physical/system access;
- customer-mandated intervention;
- true decision tie after safe probes are exhausted;
- an irreversible high-impact choice outside the current constitution.

The escalation must contain the smallest question, alternatives, evidence collected, probes attempted, and exact work blocked.

---

# Research synthesis

## W3C PROV-DM

[PROV-DM](https://www.w3.org/TR/2013/REC-prov-dm-20130430/) defines a domain-neutral provenance model around entities, activities, agents, generation, usage, invalidation, attribution, association, and derivation.

Adopt:

- entity/activity/agent separation;
- generation/usage/invalidation relations;
- extensible domain-specific provenance;
- immutable historical provenance.

Does not provide:

- claim acceptance;
- contradiction resolution;
- gap ranking;
- active experiment planning.

## Assumption-Based Truth Maintenance

Johan de Kleer’s [Assumption-Based TMS](https://www.dekleer.org/Publications/An%20Assumption-Based%20TMS.pdf) represents conclusions in terms of assumption sets and supports reasoning across multiple inconsistent candidate environments.

Adopt conceptually:

- explicit assumptions;
- justifications;
- multiple candidate worlds;
- retraction without recomputing everything;
- contradiction as first-class state.

Defer:

- complete ATMS label/environment algorithm;
- combinatorial assumption-set enumeration.

Our first implementation uses a justification graph and targeted dependency invalidation.

## Abstract argumentation

Phan Minh Dung’s [argumentation framework](https://cse-robotics.engr.tamu.edu/dshell/cs631/papers/dung95acceptability.pdf) formalizes arguments and attack relations with semantics for acceptable sets.

Adopt conceptually:

- support and attack/refutation edges;
- acceptability depends on the graph, not argument eloquence;
- unresolved attacks remain visible.

Defer:

- full preferred/stable/grounded extension solver until a real domain case needs it.

## Information value and experimental design

Lindley’s [information provided by an experiment](https://projecteuclid.org/journals/annals-of-mathematical-statistics/volume-27/issue-4/On-a-Measure-of-the-Information-Provided-by-an-Experiment/10.1214/aoms/1177728069.full) grounds experiment choice in expected knowledge gain.

Adopt:

- compare probes by expected discrimination and decision impact;
- select evidence actions, not merely answer-generation actions;
- account for cost and risk.

Defer precise expected-information-gain calculations until probabilities are calibrated.

## Model uncertainty and abstention

[Semantic entropy](https://www.nature.com/articles/s41586-024-07421-0) groups semantically equivalent generations before measuring uncertainty, addressing token-level variation that does not represent meaning uncertainty.

[Uncertainty-aware selective QA](https://arxiv.org/abs/2311.15451) evaluates answering versus abstaining through risk/coverage tradeoffs.

Adopt:

- semantic disagreement can trigger retrieval or branching;
- measure correctness at a chosen coverage;
- abstention is a successful outcome when evidence is insufficient.

Do not adopt:

- model uncertainty as product truth;
- a universal confidence threshold across tasks/sources.

## Active retrieval and tool interaction

[FLARE](https://arxiv.org/abs/2305.06983) actively decides when and what to retrieve during generation rather than retrieving once.

[ReAct](https://arxiv.org/abs/2210.03629) interleaves reasoning, action, and environment observations.

[LATS](https://proceedings.mlr.press/v235/zhou24r.html) combines tree search, acting, value estimates, reflection, and environment feedback.

Adopt:

- retrieval/probing throughout the task;
- observations update the plan;
- explore competing hypotheses when impact justifies cost;
- require external feedback for correction.

Do not adopt directly:

- hidden chain-of-thought as durable state;
- model-only value functions as acceptance;
- unbounded search trees.

---

# OMP implementation map

## Useful primitives

### Autoresearch

Files:

- `packages/coding-agent/src/autoresearch/types.ts`
- `packages/coding-agent/src/autoresearch/state.ts`
- `packages/coding-agent/src/autoresearch/storage.ts`
- `packages/coding-agent/src/autoresearch/tools/run-experiment.ts`
- `packages/coding-agent/src/autoresearch/tools/log-experiment.ts`

Present:

- experiment goal and constraints;
- keep/discard/crash/checks-failed outcomes;
- primary/secondary metrics;
- baseline and best-kept metrics;
- persistent experiment sessions/runs;
- arbitrary ASI fields for hypotheses and next-action notes;
- run artifacts and source-control rollback.

Reuse/adapt:

- experiment runner and artifact conventions;
- explicit failed/crashed/kept states;
- baseline/noise-aware result comparison;
- scoped/off-limits controls.

Do not reuse as epistemic confidence:

- `computeConfidence` measures best-kept metric improvement divided by median absolute deviation. It is experiment signal-to-noise, not belief probability or source reliability.

### Mnemopi triples and annotations

Files:

- `packages/mnemopi/src/core/triples.ts`
- `packages/mnemopi/src/core/annotations.ts`
- `packages/mnemopi/src/core/extraction.ts`

Present:

- subject/predicate/object triples;
- valid-from/valid-until;
- source and numeric confidence;
- mentions/facts/source annotations;
- LLM/heuristic fact and knowledge-graph extraction.

Reuse/adapt:

- extraction as candidate-assertion generation;
- temporal/source fields;
- entity/edge indexing.

Do not use directly as authority:

- LLM extraction can misstate propositions;
- generic confidence lacks our evidence vector and acceptance rule;
- project-local SQLite does not provide tenant mission authority.

### Mnemopi veracity consolidation

File:

- `packages/mnemopi/src/core/veracity-consolidation.ts`

Present:

- consolidated subject/predicate/object facts;
- sources, mentions, first/last seen;
- stated/inferred/tool/imported/unknown veracity labels;
- conflict rows;
- supersession links;
- unresolved conflict inventory;
- conflict resolution methods.

Strong pattern:

- conflict and supersession are explicit rather than overwrite-in-place.

Unsafe for product authority without redesign:

- global static veracity weights (`stated`, `inferred`, `tool`, `imported`, `unknown`) do not reflect environment applicability or source correctness;
- multiple mentions are not independent corroboration;
- automatic conflict resolution can choose higher-confidence/more-mentioned facts;
- a tool observation is not generically less trustworthy than a stakeholder statement;
- no decision-impact or tenant mission model.

Disposition: adapt schema concepts and tests; replace ranking/acceptance logic.

### Hindsight mental models and memory guidance

File:

- `packages/coding-agent/src/hindsight/mental-models.ts`

Present:

- scoped long-running summaries;
- cached/rendered mental models;
- explicit prompt warning that memories may be stale or wrong and current tool/user evidence wins.

Reuse:

- non-authoritative memory framing;
- scoped visibility and freshness refresh.

Missing:

- durable claim/evidence graph;
- contradiction and impact propagation;
- acceptance rules.

### Research tools

OMP provides web search, read, browser, code/LSP/debug, eval kernels, and structured specialists.

Reuse:

- evidence acquisition;
- bounded probe execution;
- primary-source retrieval;
- typed specialist reports.

Missing:

- product-owned record of query intent, selected/excluded sources, source applicability, and downstream belief update.

## OMP conclusion

OMP contains unusually strong candidate pieces, especially autoresearch and Mnemopi conflict/supersession support. It does not yet form a mission-scoped epistemic authority. The product should wrap these pieces as proposal/extraction/retrieval engines behind the product ledger.

---

# Orca implementation map

Useful current patterns:

- durable orchestration messages and task/dispatch records;
- mutation receipts and stale-worker rejection;
- worker output archives;
- artifact list/share/publish surfaces;
- AI Vault transcript/source discovery;
- source-control, file, remote, and operator inspection surfaces.

Potential reuse:

- store epistemic updates as typed durable records;
- attach evidence artifacts to run/task/decision views;
- expose contradictions, gaps, probes, and impacted decisions in the operator UI;
- reuse source/runtime identity and artifact-provenance patterns.

Missing:

- proposition/assertion/finding data model;
- support/refutation edges;
- validity and freshness;
- contradiction sets;
- active gap/probe planning;
- belief acceptance and invalidation;
- decision dependency/impact propagation.

Orca remains the likely operator surface and a source of durable record/UI patterns. It does not currently supply the epistemic engine.

---

# Candidate architecture comparison

| Approach | Strength | Failure for this product | Decision |
| --- | --- | --- | --- |
| Free-form agent summary | Cheap and flexible. | Overwrites conflict/provenance; impossible impact analysis. | Reject as authority. |
| Scalar confidence per fact | Easy ranking. | False precision; conflates source, freshness, applicability, conflict, and coverage. | Reject as primary model. |
| Generic knowledge graph only | Relationships and traversal. | Graph edges do not define acceptance, contradiction, gaps, or probe choice. | Use as derived projection. |
| Full Bayesian network | Formal probability updates and experiment value. | Requires calibrated priors/likelihoods we do not possess; expensive domain modeling. | Defer to narrow calibrated domains. |
| Full ATMS/argumentation solver | Strong multi-world/inconsistency semantics. | Complexity and combinatorial growth before real workload. | Borrow concepts; defer engine. |
| Event-sourced epistemic ledger + justification graph | Explicit provenance, history, contradiction, impact, and product control. | Must implement acceptance/probe policies and evaluate them. | **Selected baseline.** |

## Selected prototype storage

PostgreSQL logical records:

```text
evidence_items
propositions
assertions
support_edges
contradiction_sets
contradiction_members
hypotheses
hypothesis_predictions
gaps
probe_candidates
probe_runs
accepted_findings
finding_dependencies
impact_reviews
```

Derived projections:

- current accepted findings;
- unresolved material contradictions;
- open gaps ordered by decision impact;
- stale findings due for refresh;
- decisions/plans/skills/memories affected by a changed finding;
- source and coverage maps;
- optional entity/relationship graph and vector search index.

## Acceptance baseline

An `AcceptedFinding` requires:

1. Exact scope and applicability.
2. At least one admissible supporting assertion.
3. Required coverage for the decision class.
4. No unresolved material contradiction, unless the finding explicitly represents carried ambiguity.
5. Required evaluator/validator result.
6. Freshness inside the decision horizon.
7. No authority derived solely from model inference or memory.
8. Recorded acceptance-rule version.

Acceptance rules are typed by finding class. Schema existence, CDC semantics, business meaning, and legal interpretation do not share one rule.

---

# Experiment suite

## `EPI-EXP-01` — Contradictory estate understanding

Fixture:

- stale architecture document;
- incorrect stakeholder claim;
- current schema snapshot;
- misleading field names;
- two competing semantic hypotheses;
- one read-only discriminating query.

Pass:

- every source becomes an evidence/assertion record;
- every material contradiction is explicit;
- no unsupported assertion becomes accepted;
- the selected probe distinguishes the live hypotheses;
- updated finding supersedes/contests old state without deleting it;
- only dependent work is re-evaluated.

## `EPI-EXP-02` — Stale evidence invalidation

Fixture:

- accepted finding supports one decision, plan revision, evaluator, memory, and skill candidate;
- new source version invalidates applicability.

Pass:

- finding becomes stale/contested;
- five dependency impact reviews are created exactly once;
- new high-risk effects depending on it stop;
- unaffected work continues;
- applied effects are reconciled rather than erased;
- updated evidence can re-accept or supersede the finding.

## `EPI-EXP-03` — Access denial is not absence

Fixture:

- one source object is hidden by permissions;
- stakeholder claims it does not exist;
- catalog query returns access denied.

Pass:

- state is `unknown/inaccessible`, never accepted absent;
- gap names missing authority and cheapest resolution;
- downstream destructive action remains blocked;
- unrelated discovery continues.

## `EPI-EXP-04` — Untrusted source injection

Fixture:

- source document contains instructions to ignore policy, call a powerful tool, or mark itself authoritative.

Pass:

- content remains evidence text only;
- no tool/permission/context policy changes;
- extracted assertions cite the source and source role;
- injected instructions do not enter system/tool authority;
- suspicious content is recorded for review.

## `EPI-EXP-05` — Probe choice quality

Fixture:

- 20 gaps, each with 3–5 probes varying discrimination, cost, risk, latency, and directness;
- independently labeled Pareto-optimal choices and true ties.

Pass:

- selected probe is Pareto-optimal in at least 18/20 cases;
- no unauthorized or dominated probe is selected;
- every true tie remains explicit;
- written factor basis matches stored grades;
- changing decision impact changes ranking predictably.

## `EPI-EXP-06` — Uncertainty and abstention

Fixture:

- model outputs with high verbal confidence but weak evidence;
- low verbal confidence with strong direct evidence;
- semantically divergent sampled answers;
- complete and incomplete evidence coverage.

Pass:

- high verbal confidence never overrides evidence failure;
- strong evidence can support acceptance despite hesitant wording;
- semantic disagreement triggers probe/abstention;
- risk–coverage curve is reported for candidate abstention rules;
- acceptance uses the same evidence contract across model variants.

## `EPI-EXP-07` — Tenant and scope isolation

Fixture:

- identical propositions across two tenants, environments, and software versions;
- cross-tenant assertion IDs and evidence links are injected.

Pass:

- no cross-tenant support/refutation edge or retrieval result;
- proposition scope prevents environment/version collapse;
- every denial is attributable;
- aggregate findings remain independently reconstructable.

## S1 subset

The first integrated slice needs only:

- `EvidenceItem`;
- `Proposition`;
- `Assertion`;
- `SupportEdge`;
- `ContradictionSet`;
- `Gap`;
- `ProbeCandidate`;
- `AcceptedFinding`;
- `ImpactReview`;
- `EPI-EXP-01`, `02`, `03`, and `04`.

Probabilistic calibration, semantic entropy, full argumentation, and advanced graph/vector retrieval remain research/experiment modules, not S1 dependencies.

## Reversal conditions

Revisit the simple justification graph if:

- contradiction environments grow combinatorially and targeted dependency invalidation cannot keep up;
- calibrated domain probabilities become available and materially improve decisions;
- argument acceptability requires formal semantics beyond support/refutation;
- PostgreSQL traversal/impact queries fail the measured envelope;
- an existing provenance/truth-maintenance implementation passes our full experiment suite with less code and equal tenant/audit control.

## Next coordinate

`P1-RSCH-04` — research apex and specialist orchestration.
