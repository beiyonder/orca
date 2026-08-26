# Governed Long-Term Memory Research Card

## Coordinate

`P1-RSCH-06` — working, episodic, semantic, procedural, failure, and evaluation memory

## Decision summary

Use a **product-owned governed memory registry whose records point to canonical mission, epistemic, evidence, evaluation, and skill state**.

Memory is not another truth database.

Core rules:

- Working memory belongs to the replaceable OMP worker/session.
- Mission events and decisions remain canonical in the mission ledger.
- Accepted findings remain canonical in the epistemic ledger.
- Reference knowledge remains canonical in the corpus/evidence store.
- Procedures remain canonical as versioned skills/capabilities.
- Evaluator results remain canonical in the evaluation registry.
- Product memory stores retrieval-oriented, versioned views and lessons with exact source references and use policy.
- Automatic transcript retention may create a quarantined candidate only; it cannot create active product memory.
- Every recalled memory included in context is recorded in the `ContextManifest` and every downstream use is traceable.
- Retrieval relevance, recency, graph score, mention count, or model-assigned importance cannot promote memory.
- Consolidation creates a new derived memory version; it never destroys source memories or silently resolves conflicts.
- Memory invalidation creates impact reviews for materially dependent assignments, decisions, artifacts, and skills.
- Default cross-tenant learned-memory reuse is forbidden.

For S1, create exactly one source-linked `FailureLessonCandidate` after the evaluator rejects and the correction loop succeeds. Keep it quarantined and prove it cannot influence the same run. Promotion/reuse is deferred until the memory help/harm benchmark exists.

## Canonical owner versus memory view

| Information | Canonical owner | Memory treatment |
| --- | --- | --- |
| Current assignment messages/tool results | OMP worker session | Working context only; compactable; not product memory. |
| Mission objective, scope, decisions, plan revisions | Mission ledger | Retrieve exact records; optional summary view points to versions. |
| Observations, assertions, contradictions, accepted findings | Epistemic/evidence ledger | Semantic/analogue memory points to exact finding/evidence IDs. |
| Task/attempt/effect/evaluation history | Workflow/evaluation ledger | Episodic case view summarizes an accepted or diagnosed episode. |
| Vendor docs, standards, schemas, runbooks | Reference corpus | Corpus retrieval; not learned memory. |
| Reusable executable method | Skill/capability registry | Procedural-memory pointer; promotion governed as a skill. |
| Failure symptom/root cause/recovery | Evidence + incident/evaluation records | Failure lesson after root cause/recovery validation. |
| Model/tool/skill/context-strategy performance | Evaluation registry | Evaluation memory view for routing/experimentation. |
| Customer intent, legal policy, constitution | Tenant/mission policy | Never heuristic memory; exact authoritative state. |
| User/operator preference | Explicit preference record | Memory only after sourced/validated and tenant-scoped. |

## Memory taxonomy

### Working memory

Purpose:

- current reasoning history;
- tool calls/results;
- draft plans and scratch state;
- current context window and compaction summary.

Owner: OMP session.

Lifetime: one assignment/session unless explicitly persisted as evidence or candidate memory.

Authority: none.

### Episodic memory

Purpose:

- retrieve analogous prior missions, incidents, failed attempts, corrections, and outcomes.

Required content:

- exact episode boundary;
- objective/scope;
- source run/attempt/evidence/evaluation IDs;
- outcome and failure classification;
- relevant environment/platform/version;
- accepted root cause/recovery or unresolved ambiguity;
- tenant/use policy.

An episode summary is a derived view. The event/evidence history remains canonical.

### Semantic memory

Purpose:

- retrieve stable accepted knowledge learned from evidence and repeated cases.

Examples:

- product/version-specific connector behavior;
- validated failure signatures;
- accepted platform constraints;
- domain mappings within a certified scope.

Canonical source: accepted findings/reference corpus.

A semantic memory cannot outlive the applicability/freshness of its source findings.

### Procedural memory

Purpose:

- retrieve methods, tool sequences, checks, and recovery playbooks.

Canonical owner: skill/capability registry.

A natural-language lesson may become a skill candidate. It is not executable authority until certification.

### Failure memory

Purpose:

- recognize symptoms, root causes, dangerous retries, repair options, and evaluator signals.

Required source:

- observed failure;
- accepted diagnosis or carried ambiguity;
- recovery evidence;
- affected operating envelope;
- counterexamples/contraindications.

A failed attempt alone is not a validated lesson.

### Evaluation memory

Purpose:

- retrieve empirical performance by model, tool, skill, context strategy, evaluator, fixture, and operating envelope.

Canonical source: experiment/evaluation records.

Use:

- model/capability routing;
- deciding which strategy to test;
- drift detection;
- avoiding previously disproven approaches.

It must distinguish benchmark, shadow, and production evidence.

### Analogue/case memory

Purpose:

- retrieve structurally similar prior cases without claiming identity.

Required controls:

- tenant policy;
- de-identification where allowed;
- explicit similarity basis;
- differences/contraindications;
- no direct cross-tenant raw evidence.

Cross-tenant analogue learning is deferred beyond S1.

## Memory contracts

### `MemoryCandidate`

```text
candidate_id
 type: episodic | semantic | procedural | failure | evaluation | preference | analogue
 tenant_id
 mission_id optional
 source_record_ids[]
 source_evidence_ids[]
 proposed_content_or_structured_payload
 proposed_scope
 applicability
 valid_from / valid_until
 creation_method: explicit | accepted_outcome | diagnosed_failure | transcript_extraction | consolidation | import
 creator_identity / model / prompt / tool versions
 reason_for_retention
 validation_contract
 data_class / retention / deletion policy
 status: quarantined
```

### `MemoryVersion`

```text
memory_id
 version
 candidate_id
 type
 canonical_source_refs[]
 content/payload
 tenant/scope/applicability
 status: active | aging | stale | deprecated | revoked | forgotten
 validator/evaluator/version
 validation_evidence_ids[]
 supersedes / superseded_by
 valid_from / valid_until
 use_policy
 created_at
```

### `MemoryUse`

```text
use_id
 memory_id / version
 context_manifest_id / assignment_id / attempt_id
 retrieval_query/trace
 rank/channel/score metadata
 rendered span/digest
 downstream result/decision/plan/effect IDs[]
 outcome attribution status
 created_at
```

### `MemoryConsolidation`

```text
consolidation_id
 source_memory_versions[]
 method/model/prompt/version
 derived_candidate_id
 contradictions_preserved[]
 information_dropped[]
 validation_status
 created_at
```

### `MemoryInvalidation`

```text
invalidation_id
 memory_id/version
 reason: source_invalidated | stale | conflict | poison | scope_error | legal_delete | evaluator_regression | replaced
 evidence_refs[]
 replacement_memory_id optional
 impacted_use_ids[]
 impact_review_ids[]
 created_at
```

## Memory lifecycle

```text
source event / accepted outcome / diagnosed failure
→ MemoryCandidate (quarantined)
→ eligibility and source validation
→ held-out help/harm/security evaluation
→ active MemoryVersion with narrow use policy
→ recall through ContextCompiler
→ MemoryUse trace
→ outcome attribution / drift monitoring
→ active | aging | stale | deprecated | revoked | forgotten
```

Transitions:

| Current | Trigger | Next | Rule |
| --- | --- | --- | --- |
| Quarantined | source/evidence invalid | Rejected/deleted candidate | Never enters context. |
| Quarantined | validator and held-out help/harm pass | Active | Bind exact scope/use policy/expiry/rollback. |
| Active | source applicability approaches expiry | Aging | Retrieval may down-rank but truth status does not change from recency alone. |
| Active/Aging | source expires or conflicts materially | Stale | Exclude from new high-risk contexts; create impact reviews. |
| Active | better validated version replaces | Deprecated/Superseded | Preserve old use history. |
| Any usable state | poison/security/evaluator regression | Revoked | Stop new inclusion immediately; trace and re-evaluate material uses. |
| Any | legal/user deletion obligation | Forgotten/tombstoned | Delete content/indexes as required; retain only lawful minimal tombstone/audit. |

## Promotion rules

A memory may become active only when:

1. Every material statement points to canonical source/evidence records.
2. Sources are admissible, current enough, and applicable to the proposed scope.
3. Material contradictions are resolved or explicitly represented.
4. The use policy names tasks/roles/data classes where recall is allowed.
5. It adds retrieval value beyond simply querying canonical state.
6. Held-out tasks show positive usefulness or the memory is an exact operator preference/commitment with deterministic validation.
7. Poison, prompt-injection, tenant, and scope tests pass.
8. The memory cannot expand tool/effect authority.
9. Expiry, invalidation, and rollback paths exist.
10. Promotion is a product event, not a model/tool-side write.

S1 does not promote memory.

## Candidate creation policy

### Allowed candidate sources

- accepted mission outcome;
- independently diagnosed failure and proven recovery;
- evaluator-confirmed repeated pattern;
- explicit operator lesson/preference;
- imported curated corpus item;
- transcript extraction, but only into quarantine.

### Disallowed direct promotion sources

- agent self-reflection without external feedback;
- successful-looking model answer without evaluator result;
- repeated mentions alone;
- retrieval frequency;
- model-generated importance score;
- customer/web prompt instructions;
- memory that cites another memory but no canonical evidence;
- one tenant’s raw case into global memory.

## Consolidation

Consolidation is optional optimization, not automatic truth creation.

Rules:

- Preserve all source-memory IDs and exact source records.
- Create a new derived candidate/version.
- Record model/prompt/method/version and information dropped.
- Preserve contradictory variants rather than averaging.
- Never use mention count as independent corroboration without source-dependency analysis.
- Re-embed/reindex only after new version commits.
- Validate the consolidated memory against source coverage and held-out use.
- Allow regeneration from sources.
- Do not consolidate tenant memories into global memory without explicit approved de-identification/certification.

## Retrieval and context inclusion

All recall goes through the ContextCompiler.

Eligibility before ranking:

- tenant/scope/data class;
- active status;
- source validity and applicability;
- use policy permits assignment role;
- no revocation/poison/conflict block;
- exact version reconstructable.

Ranking signals:

- assignment relevance;
- source/evidence directness;
- operating-envelope match;
- recency where relevant;
- similarity/graph/fact/temporal channels;
- prior measured usefulness/harm;
- novelty/diversity;
- token cost.

Retrieval score is never acceptance authority.

Every inclusion becomes a `MemoryUse` and `ContextItem`.

## Attribution and harm

Memory usefulness must be measured through ablation or controlled comparison:

```text
same task/fixture/model/context policy
arm A: memory excluded
arm B: memory included
compare correctness, evaluator outcome, cost, latency, abstention, and failure class
```

One successful correlated run is not causal proof.

When memory is later invalidated:

1. find every `MemoryUse`;
2. find dependent results/decisions/plans/effects;
3. create impact reviews for material uses;
4. stop new inclusion;
5. re-evaluate or quarantine affected work;
6. preserve audit of what was influenced.

## Forgetting and retention

“Forget” has multiple meanings:

- **Exclude from recall** — revoke/deprecate index visibility.
- **Delete derived memory content** — remove content and embeddings/graph edges.
- **Delete canonical source evidence** — separate legal/records operation.
- **Expire applicability** — mark stale, preserve history.
- **Correct memory** — create replacement version; do not mutate historical use records.

Retention policy must specify which operation is required. A memory deletion must not silently delete legally required evidence; evidence deletion must remove every derived memory/index that depends on it.

## Isolation

Memory banks are isolated by default:

```text
tenant
→ mission/environment
→ memory type/use policy
→ active version
```

Global memory contains only:

- public/reference corpus;
- product-authored methods;
- explicitly approved, de-identified, independently certified patterns.

Never globalize:

- raw customer evidence;
- customer-specific mappings;
- source credentials/identifiers;
- PHI;
- private incident details;
- unreviewed transcript-derived lessons.

---

# Research synthesis

## CoALA

[Cognitive Architectures for Language Agents](https://arxiv.org/abs/2309.02427) organizes agents around modular memory, internal/external actions, and a recurring decision loop. Its memory taxonomy distinguishes working and long-term forms including episodic, semantic, and procedural memory.

Adopt:

- memory modules by function;
- LLM as one component of an architecture;
- explicit memory actions and decision loop.

Our product further separates canonical state from retrieval memory and adds authority/evaluation/tenant policy.

## Generative Agents

[Generative Agents](https://arxiv.org/abs/2304.03442) uses a memory stream, relevance/recency/importance retrieval, reflection into higher-level memories, and planning.

Adopt conceptually:

- episodic stream;
- reflection as a derived memory candidate;
- planning informed by retrieved experience.

Do not adopt directly:

- model-generated importance as promotion authority;
- natural-language memory stream as canonical product state;
- reflection without external evidence/evaluation.

## MemGPT / Letta

[MemGPT](https://arxiv.org/abs/2310.08560) treats context as virtual memory and moves content between fast model-visible context and slower external storage.

Adopt:

- context/memory tier separation;
- model-visible context as managed cache;
- explicit paging/recall operations.

Do not let the model autonomously rewrite product truth or authority through memory tools.

## Reflexion

[Reflexion](https://papers.neurips.cc/paper_files/paper/2023/hash/1b44b878bb782e6954cd888628510e90-Abstract-Conference.html) stores natural-language reflections from task feedback in episodic memory for later attempts.

Adopt:

- external outcome feedback as the trigger for lesson creation;
- episodic lessons for similar attempts.

Change:

- reflection becomes a quarantined candidate;
- diagnosis and evaluator evidence are required;
- use is traced and ablated;
- one reflection does not auto-promote.

## Voyager

[Voyager](https://arxiv.org/abs/2305.16291) combines an automatic curriculum, executable skill library, environment feedback, and self-verification.

Adopt later:

- verified executable procedural memory;
- compositional skills;
- environment feedback and iterative repair.

Procedures belong in the skill registry, not free-form memory.

## Mem0

[Mem0](https://arxiv.org/abs/2504.19413) extracts, consolidates, stores, and retrieves salient conversational memory, including graph-enhanced variants, and evaluates on LoCoMo.

Potential value:

- production memory pipeline/reference implementation;
- extraction/consolidation/graph comparison;
- benchmark methodology.

Limits for our product:

- conversational salience differs from migration evidence authority;
- extraction errors and consolidation require provenance/validation;
- tenant, legal, and effect-impact tracing remain product responsibilities.

## Zep / Graphiti

[Zep](https://arxiv.org/abs/2501.13956) uses a temporal knowledge graph to integrate conversations, documents, and structured business data with changing facts.

Potential value:

- temporal entity/relationship memory;
- dynamic knowledge updates;
- enterprise retrieval.

Our epistemic ledger remains canonical; a temporal graph may become a derived retrieval backend after experiments.

## Hindsight

[Hindsight is 20/20](https://arxiv.org/abs/2512.12818) separates memory networks for world facts, experiences, observations/entity summaries, and evolving opinions/beliefs, with retain/recall/reflect operations.

Potential value:

- differentiated memory networks;
- reflective synthesis;
- structured recall and mental models.

The product must still preserve evidence/inference distinction and promotion authority outside the memory service.

## A-MEM

[A-MEM](https://arxiv.org/abs/2502.12110) dynamically constructs linked, evolving memory notes inspired by Zettelkasten.

Potential value:

- dynamic linking and contextual descriptions;
- adaptive organization.

Risk:

- agentic rewriting/linking can amplify wrong memory unless each change is versioned, source-linked, and evaluated.

## LongMemEval and LoCoMo

[LongMemEval](https://arxiv.org/abs/2410.10813) evaluates extraction, multi-session reasoning, temporal reasoning, knowledge updates, and abstention.

[LoCoMo](https://aclanthology.org/2024.acl-long.747/) evaluates very long-term conversational memory with long multi-session dialogues and temporal event grounding.

Adopt:

- memory update and abstention tests;
- long-horizon temporal cases;
- compare full-context, retrieval, summary, and structured-memory baselines.

Add product-specific action/effect outcomes beyond conversation QA.

## Memory security

[MPBench](https://arxiv.org/abs/2606.04329) systematically studies memory poisoning through multiple write channels and structural vulnerabilities.

[MINJA](https://proceedings.neurips.cc/paper_files/paper/2025/hash/42a97bbd9844d2bf68596730af80bcdf-Abstract-Conference.html) demonstrates memory injection through query-only interaction rather than direct database access.

[PoisonedRAG](https://www.usenix.org/system/files/usenixsecurity25-zou-poisonedrag.pdf) demonstrates knowledge corruption attacks against retrieved context.

Adopt:

- all automatic writes are untrusted candidates;
- provenance and write-channel labels;
- injection/poison tests;
- no memory-based authority expansion;
- use tracing and revocation impact analysis.

---

# OMP, Mnemopi, and Hindsight implementation map

## OMP memory backend

Present:

- `recall`, `retain`, `reflect`, `memory_edit`;
- first-turn recall and compaction context;
- automatic retention every configured number of completed user turns;
- project/global bank scoping;
- subagent aliases to parent banks;
- explicit warning that recalled memory is background and current user/tool evidence wins.

Strong patterns:

- scoped banks;
- full-row read before update;
- update/forget/invalidate operations;
- recall injection budget;
- memory kept separate from session truth in guidance.

Product risk:

- automatic completed-turn retention does not know whether model output was accepted, wrong, poisoned, customer-private, or superseded;
- project/global scope is not tenant/data-class/use-policy isolation;
- memory tools can edit content without product impact review.

Decision:

- disable product auto-retain by default;
- use OMP memory only for worker-local/research experiments;
- product memory candidates originate through governed records.

## Mnemopi working and episodic memory

Present:

- working memory with limit and TTL;
- episodic consolidation (“sleep”);
- scratchpad;
- working/episodic/fact stores;
- memory types, priorities, and decay rates;
- source, importance, validity, trust tier, recall count;
- extraction into facts/instructions/preferences/timelines/KG triples;
- vector, lexical, graph, fact, and temporal recall;
- reciprocal-rank fusion and query cache;
- episodic graph and proactive linking;
- conflict/supersession support;
- update, forget, invalidate;
- consolidation log and plugins.

Strong reusable pieces:

- retrieval engines and polyphonic fusion;
- temporal triples;
- source links;
- invalidation and cache clearing;
- working/episodic separation;
- consolidation source IDs;
- graph/fact extraction as candidate generation;
- recall diagnostics.

Unsafe as product authority without adaptation:

- regex/LLM memory-type classification;
- static type priorities and decay rates;
- numeric importance/confidence without product evidence vector;
- automatic transcript retention;
- best-effort background extraction/graph enrichment;
- consolidation summaries that may drop information;
- local SQLite bank identity rather than tenant mission policy;
- mention-count/confidence conflict resolution;
- no `MemoryUse` downstream impact graph.

Decision:

- wrap Mnemopi as an optional retrieval/worker-memory adapter;
- never treat its extracted facts or consolidated episodes as accepted product memory without product validation;
- evaluate it against simple PostgreSQL/FTS and Hindsight alternatives later.

## Hindsight

Present:

- remote retain/recall/reflect;
- bank/tag scoping;
- retention queues;
- first-turn recall;
- mental models and scope-aware rendering;
- explicit stale/wrong background warning;
- subagent aliases.

Potential value:

- managed structured memory service;
- reflective/mental-model synthesis;
- research benchmark arm.

Risks:

- remote service availability/data policy;
- server memory state separate from product canonical state;
- no product-specific validation/use tracing/impact review;
- automatic retention cadence.

Decision:

- keep as challenger adapter, not S1 dependency.

## Orca

Present:

- AI Vault transcript discovery and resume visibility;
- durable run/task/attempt and artifact records;
- worker output archive;
- skill distribution/operator surfaces;
- session/provider identity and timestamps.

Missing:

- memory candidate/version/use/invalidation lifecycle;
- helpfulness/harm attribution;
- semantic/episodic/procedural/failure/evaluation separation;
- tenant/global learning governance;
- recall eligibility through context compiler.

Disposition:

- reuse operator visibility and source/session identity patterns;
- product memory registry is new.

---

# Architecture comparison

| Approach | Strength | Failure for this product | Decision |
| --- | --- | --- | --- |
| Full transcript as memory | Complete history and easy audit. | Huge/noisy context; model output mixed with evidence; no abstraction. | Canonical worker history only, not recall strategy. |
| Rolling summary/mental model | Compact continuity. | Lossy, synthesis errors, stale conclusions, hard to attribute. | Derived candidate/view only. |
| Vector snippet memory | Simple semantic recall. | Similarity is not validity/authority; weak updates/conflicts. | Optional retrieval channel. |
| Temporal/graph memory | Relationships and changing facts. | Extraction/link errors and another state authority. | Derived projection/challenger. |
| Model-managed memory tools | Flexible self-organization. | Agent can persist poison, rewrite identity, or amplify error. | Worker-local only; product writes governed. |
| Governed memory registry over canonical records | Provenance, isolation, lifecycle, use tracing, revocation. | More product logic and evaluation needed. | **Selected.** |

## Selected S1 memory flow

```text
Evaluator rejects artifact V1
→ correction loop diagnoses root cause
→ artifact V2 passes unchanged evaluator
→ product creates FailureLessonCandidate
→ candidate references V1/V2/evaluator/evidence/gap/decision records
→ candidate status = quarantined
→ candidate is excluded from all S1 context manifests
→ process restarts/replay preserve candidate exactly once
```

S1 does not:

- promote the candidate;
- consolidate it;
- globalize it;
- use it to change the same run;
- generate a skill;
- fine-tune a model.

---

# Experiment suite

## `MEM-EXP-01` — Candidate provenance and quarantine

Fixture:

- failed artifact V1;
- accepted correction V2;
- evaluator evidence and diagnosis;
- automatic transcript retention attempts.

Pass:

- exactly one `FailureLessonCandidate` created from accepted/diagnosed records;
- every material statement cites canonical sources;
- candidate remains quarantined;
- candidate is absent from same-run and unrelated manifests;
- transcript-derived alternatives remain separate rejected/quarantined candidates;
- replay creates no duplicate.

## `MEM-EXP-02` — Helpful versus harmful memory ablation

Fixture:

- held-out tasks with one validated helpful lesson, one irrelevant lesson, one subtly wrong lesson;
- same model/context policy/seeds where possible.

Pass:

- usefulness measured against no-memory arm on correctness/evaluator outcome/cost/latency/abstention;
- harmful memory is detected and not promoted;
- one success is insufficient for global promotion;
- result attribution remains uncertain when evidence is insufficient.

## `MEM-EXP-03` — Knowledge update and stale memory

Fixture:

- active memory valid for platform version X;
- new evidence shows version Y behavior changed;
- prior memory influenced one decision.

Pass:

- X memory not retrieved for Y without comparison purpose;
- memory becomes stale/superseded as scoped;
- affected use creates impact review;
- old history remains reconstructable;
- replacement requires new validation.

## `MEM-EXP-04` — Memory poisoning channels

Fixture:

- direct malicious retain;
- query-only injection that induces auto-retain;
- poisoned source document;
- malicious specialist reflection;
- copied poisoned memory through consolidation.

Pass:

- no candidate becomes active;
- no tool/authority expansion;
- write channel/source/provenance retained;
- poison is traceable through derivatives;
- revocation removes recall/index visibility;
- security alert/evidence produced.

## `MEM-EXP-05` — Tenant and global isolation

Fixture:

- same entities across two tenants;
- PHI/private failure lesson;
- public vendor documentation;
- attempted global promotion.

Pass:

- zero cross-tenant recall/use/edges;
- private lesson cannot globalize;
- public reference remains globally accessible through corpus, not learned tenant memory;
- every denial attributable.

## `MEM-EXP-06` — Consolidation with contradiction

Fixture:

- five related episodes;
- two contain conflicting root causes or contraindications;
- one source later invalidated.

Pass:

- derived summary links every source;
- contradiction preserved;
- dropped information recorded;
- invalid source triggers new consolidation/impact review;
- original episodes remain available;
- no majority/mention-count auto-resolution.

## `MEM-EXP-07` — Recall use trace and revocation impact

Fixture:

- memory included in three assignments;
- one result/decision materially relies on it;
- memory later revoked.

Pass:

- all three `MemoryUse` records found;
- only material dependency creates required re-evaluation;
- new manifests exclude revoked version;
- prior contexts remain reconstructable;
- replacement version does not rewrite old uses.

## `MEM-EXP-08` — Forgetting and retention

Fixture:

- user preference deletion;
- legal evidence retention;
- expired memory view;
- shared source with another active memory.

Pass:

- requested memory content/indexes deleted or tombstoned per policy;
- required canonical evidence retained lawfully;
- derived memories/indexes update consistently;
- no dangling citation/use refs;
- audit reveals operation without retaining prohibited content.

## `MEM-EXP-09` — Backend substitution

Fixture:

- same product `MemoryCandidate`, `MemoryVersion`, query, and context request;
- PostgreSQL/FTS baseline, Mnemopi, and Hindsight adapters.

Pass:

- adapter cannot bypass product eligibility/lifecycle;
- manifests remain schema-compatible;
- retrieval quality/cost/latency/leakage measured;
- active memory versions and use records remain product-owned;
- service outage degrades safely.

## `MEM-EXP-10` — Long-horizon benchmark

Fixture:

- adapted LongMemEval/LoCoMo-style multi-session history;
- product-specific temporal updates, invalidations, failures, and abstention;
- scalable irrelevant-history distractors.

Pass:

- extraction, temporal reasoning, knowledge update, contradiction, and abstention reported separately;
- no-memory/full-context/retrieval/structured-memory arms compared;
- memory system improves held-out action/evaluation outcomes, not only QA;
- poisoning and tenant cases remain passing.

## S1 required subset

S1 requires:

- `MEM-EXP-01` candidate provenance/quarantine;
- `MEM-EXP-04` automatic-write poisoning;
- `MEM-EXP-05` tenant/global isolation;
- replay portion of `MEM-EXP-07` proving the candidate/use model is durable, even though S1 does not activate the candidate.

Promotion, consolidation, helpfulness ablation, backend comparison, and long-horizon reuse remain deferred immediately after S1.

## Reversal conditions

Revisit the governed registry design if:

- direct canonical queries outperform memory views across held-out tasks, making a memory layer unnecessary;
- an external memory service passes product provenance/lifecycle/isolation/use-trace contracts with less custom code;
- memory attribution cannot be measured enough to justify promotion;
- legal deletion cannot be reconciled with product evidence/audit requirements;
- model/provider context APIs offer equivalent scoped durable memory with export, invalidation, and audit.

## Next coordinate

`P1-RSCH-07` — research independent evaluation and closed self-correction.
