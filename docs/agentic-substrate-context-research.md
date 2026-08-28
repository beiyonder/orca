# Context Assembly, Retrieval, Citations, and Live Research Card

## Coordinate

`P1-RSCH-05` — context assembly, retrieval, citations, and live research

## Decision summary

Use a **product-owned deterministic context compiler** that produces an immutable, versioned `ContextManifest` for every apex, specialist, evaluator, and tool-bearing assignment.

The compiler performs two distinct stages:

1. **Eligibility** — deterministic authorization, tenant, data-class, source-version, applicability, freshness, revocation, and evidence-integrity checks.
2. **Selection and packing** — task-specific retrieval, ranking, diversity, token budgeting, ordering, redaction, and rendering.

Core rules:

- The durable mission/session history is not the model context.
- Context is a compiled product artifact, not an invisible prompt-building side effect.
- Every included item has a source, version, digest, scope, trust label, token cost, inclusion reason, and exact rendered position.
- Every excluded candidate has a reason available in the retrieval trace.
- Material output claims cite exact `EvidenceItem`/span references.
- Live research results become untrusted evidence before they become context.
- Model-visible memory and skills are validated, scoped inputs—not hidden authority.
- Context compaction may change worker-local presentation but cannot replace the product manifest or source evidence.
- A changed mission version can make an assignment result stale even if the model answer is otherwise good.

For S1, do not build a vector database, GraphRAG pipeline, learned reranker, crawler, or context optimizer. The fixture has two controlled artifacts; deterministic exact selection plus lexical/span retrieval is enough to prove the contracts.

## Why context is a first-class product subsystem

A strong model with the wrong context is a weak system.

Context failures include:

- wrong tenant or environment;
- stale document version;
- missing critical evidence;
- irrelevant content crowding out useful content;
- contradictory evidence collapsed into one summary;
- revoked memory or skill included;
- prompt injection treated as instruction;
- source citation points to a URL that changed;
- output cites a document that was never present;
- compaction drops a hard constraint or critical tool result;
- long context places decisive evidence where the model fails to use it;
- model/provider policy allows data that should not leave the customer network.

The context compiler must be reproducible and evaluable independently of the agent.

## Context contracts

### `ContextRequest`

```text
request_id
 assignment_id
 assignment_type: apex | specialist | evaluator | effect_planner | recovery
 mission_id
 mission_version
 plan_revision
 tenant_id
 environment_ids[]
 data_classes_allowed[]
 model_route_policy
 role/capability/version
 objective
 owned_scope
 read_scope
 open_gap_ids[]
 required_finding_ids[]
 required_evidence_ids[]
 tool/capability envelope
 output/evaluator contract
 token/input/output budgets
 freshness horizon
```

### `RetrievalQuery`

```text
query_id
 context_request_id
 question_or_information_need
 source_classes_allowed[]
 structured_filters
 lexical_query
 semantic_query_optional
 graph_seed_ids[]
 recency/freshness rules
 desired_coverage
 max_candidates
 stop_condition
```

The information need is explicit. “Search for useful context” is not a query contract.

### `RetrievalCandidate`

```text
candidate_id
 source/evidence/memory/skill/finding ref
 exact version and digest
 tenant / environment / product-version scope
 span selector
 source role
 directness
 applicability
 freshness
 retrieval channels and ranks
 token estimate
 duplicate/derivation group
 data class
 eligibility status/reason
```

### `ContextItem`

```text
item_id
 candidate_id or required product-state ref
 role: instruction | constitution | assignment | mission_state | plan | finding | gap | evidence | method | skill | memory | tool_contract
 trust_label: product_instruction | product_state | sourced_evidence | untrusted_content | validated_memory | validated_skill
 rendered_content_ref
 rendered_digest
 source_span
 redactions[]
 tokens
 section/order/position
 inclusion_reason
 required_or_optional
 citation_id
```

Untrusted content stays visibly delimited from product instructions.

### `ContextManifest`

```text
manifest_id
 assignment_id / attempt_id
 mission_version / plan_revision
 compiler_version
 policy_version
 model/provider/context-window
 tool-schema digest
 system/role/output-schema digests
 token budget and actual allocation
 ordered ContextItem IDs
 excluded candidate IDs + reasons
 retrieval query/trace IDs
 redaction and source-policy decisions
 rendered prompt/context artifact digest
 created_at / expires_at
 refresh_generation
```

### `RetrievalTrace`

```text
query
 backends invoked
 filters
 candidates per backend
 ranks/scores per channel
 fusion/rerank result
 dedup/diversity decisions
 included/excluded items and reasons
 latency/cost
 coverage result
 warnings/errors
```

### `Citation`

```text
citation_id
 result_id
 material claim/span in result
 evidence_item_id
 evidence version/digest
 source span selector
 relation: supports | refutes | derives | demonstrates | provides_context
 applicability scope
```

### `ContextRefresh`

```text
prior_manifest_id
 refresh_generation
 reason: live_research | tool_observation | stale_source | mission_changed | budget_repack
 added/removed/superseded items
 new rendered digest
```

A refresh never silently edits a prior manifest.

## Source classes

| Class | Examples | Default handling |
| --- | --- | --- |
| Product instructions | Constitution, role, assignment/output schema | Required, immutable for attempt, highest instruction authority. |
| Product state | Mission version, accepted findings, gaps, plan, effects, evaluations | Required/relevance-selected; exact version. |
| Environment evidence | Schema snapshot, query result, log, code, target read | High-value evidence; scope/time/applicability mandatory. |
| Reference corpus | Vendor docs, standards, capability cards, runbooks | Retrieve by product/version/task; primary source preferred. |
| Customer artifacts | Diagrams, spreadsheets, prose, tickets | Untrusted assertions/evidence; never instruction authority. |
| Validated memory | Accepted lessons/failures with provenance | Optional; task relevance, expiry, tenant and validation required. |
| Validated skill | Certified method, tool/evaluator contract | Included only when assignment binds exact version. |
| Live research | Web/API/browser results acquired during assignment | Register as evidence, snapshot/digest, source/time/licensing metadata, injection boundary. |
| Worker-local history | Prior tool calls/results and reasoning context | OMP-managed working context; not mission authority. |

## Eligibility rules

A candidate is ineligible when any is true:

- tenant mismatch;
- environment/system/version scope mismatch without explicit comparison purpose;
- data class cannot route to selected model/provider;
- source/evidence object missing or digest invalid;
- finding/memory/skill revoked, expired, stale beyond policy, or superseded;
- access purpose does not permit use;
- source license/retention policy forbids ingestion/rendering;
- item contains secrets or sensitive fields not redacted for this route;
- item belongs to a competing mission scope and no approved analogue policy exists;
- context request does not authorize its source class;
- citation/span cannot be reconstructed.

Ineligible candidates never enter model-ranking or packing.

## Selection and ranking

### Mandatory bands

Always reserve space for:

1. constitution and assignment contract;
2. role/capability and output/evaluator schema;
3. current mission/plan/task version and owned scope;
4. relevant hard policy/authority/tool limits;
5. blocker gaps and required accepted findings/evidence.

Optional evidence/method/memory competes only after mandatory bands fit.

### Retrieval sequence

```text
structured exact lookup
→ relational mission/epistemic query
→ lexical search
→ optional semantic/vector search
→ optional bounded graph expansion
→ merge and deduplicate
→ task-specific rerank
→ coverage/diversity selection
→ token-aware packing
```

For small corpora, include the exact full artifacts or deterministic spans instead of building RAG infrastructure.

### Ranking vector

Track separately:

- assignment relevance;
- decision/gap impact;
- directness;
- exact applicability;
- freshness;
- source independence;
- novelty/information gain;
- contradiction coverage;
- expected citation utility;
- token cost;
- redundancy;
- retrieval channel/rank.

Do not treat a vector similarity score as source authority.

### Fusion

Initial hybrid approach when needed:

- structured matches are a separate required tier;
- combine lexical and vector candidate ranks using transparent reciprocal-rank fusion;
- graph expansion may add bounded neighbors but cannot bypass eligibility;
- reranking can reorder eligible candidates but must retain per-channel trace;
- maximum candidates and expansion depth are hard-bounded.

## Packing and ordering

Packing goals:

- preserve all mandatory contracts;
- place the active objective, task, and critical constraints prominently;
- co-locate claims with evidence/citation IDs;
- preserve contradiction pairs together;
- separate untrusted evidence from instructions;
- avoid burying decisive evidence in the middle of a long context;
- preserve output/tool-result headroom;
- use references plus read/retrieval tools instead of stuffing large artifacts.

The [Lost in the Middle](https://arxiv.org/abs/2307.03172) result shows that long-context performance can depend strongly on evidence position. The manifest therefore records order and position, and the context experiment suite varies them.

No fixed percentage is a product invariant. S1 records allocation across:

```text
instructions/contracts
mission/plan state
epistemic findings/gaps
evidence
methods/skills/memory
working/tool-result reserve
output reserve
```

Model-specific packers may be added later behind the manifest contract.

## Context refresh and staleness

### Worker-acquired evidence

When a worker performs live research or a tool observation:

1. tool result is captured as an `EvidenceItem` or bounded transient observation;
2. source/version/time/scope/digest/data-class/injection label are attached;
3. retrieval/context trace records its use;
4. material result claims cite it;
5. product acceptance still happens after worker output.

### Mission changes during an assignment

- Assignment keeps its original mission/base version.
- Read-only evidence may remain useful.
- Result cannot commit a plan/effect against a newer base without revalidation.
- Major mission/context change triggers a fresh assignment/manifest rather than silently rewriting the current one.

### Long-running worker refresh

A worker may request a new context generation. The compiler creates a new manifest linked to the old one. Tool observations already in working context remain session history, but product state references are refreshed explicitly.

## Citation contract

A material claim is one that affects:

- accepted finding;
- decision;
- plan/task;
- mapping/architecture;
- evaluator verdict;
- effect/recovery;
- security/privacy/cost/performance assertion;
- external exception.

Each material claim must have one or more citations or be explicitly marked unsupported/hypothesis.

Citation checks:

1. **Validity** — referenced evidence/version/span exists and matches digest/tenant.
2. **Correctness/entailment** — cited content supports the exact claim in scope.
3. **Completeness/recall** — every material claim has sufficient support.
4. **Precision** — citations are not irrelevant decoration.
5. **Applicability** — source environment/version/time matches the claim.
6. **Freshness** — source is current enough for the decision horizon.
7. **Independence** — multiple citations are not copies of one source when corroboration matters.

[ALCE](https://aclanthology.org/2023.emnlp-main.398/) measures citation recall and precision using whether cited passages support claims and whether individual citations are relevant. We adopt the dimensions, not its NLI judge as unquestioned authority. Citation evaluation itself needs held-out labels and calibration.

## Live research contract

### `LiveResearchRequest`

```text
research_id
 assignment_id
 gap/question
 target source classes
 primary-source preference
 recency/version range
 allowed domains/APIs
 max queries/pages/bytes/time/cost
 data-class and browser/tool policy
 stop condition
 expected evidence schema
```

### Acquisition rules

- Prefer known primary sources and exact URLs over search-result summaries.
- Search broad enough to find sources, then read the primary page/document directly.
- Record query, provider, rank, URL, fetch time, canonical URL, content type, source version/date, digest, extraction method, warnings, and access terms.
- Store only content permitted by license/retention policy; otherwise store citation metadata and bounded excerpts where allowed.
- Treat retrieved content as untrusted data; embedded instructions cannot change tools/system policy.
- Capture contradictory primary sources rather than selecting one silently.
- Stop when the evidence contract is met, budget expires, or remaining sources are dominated/redundant.
- Search/provider/model snippets are never final evidence when the primary source is reachable.

### Research result

```text
research_id
 evidence_item_ids[]
 assertions[]
 contradictions[]
 coverage
 unresolved gaps
 excluded sources and reasons
 queries and retrieval trace
 budget/latency/cost
 source-policy warnings
```

## Compaction and worker context

OMP may compact/prune worker-local history, but product continuity cannot depend on that summary.

Must survive compaction in model-visible form or be re-injected from product state:

- assignment objective and owned scope;
- hard constitution/tool/authority rules;
- output/evaluator contract;
- current base mission/plan version;
- critical unresolved gaps;
- evidence/citation IDs needed by current work;
- active effect/recovery obligations;
- files/artifacts currently being changed;
- pending external exception.

The durable session retains full event history; the product manifest retains exact assignment context. Compaction is a presentation policy.

---

# Research synthesis

## Context engineering and managed agents

Anthropic’s [effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) frames context as a finite resource that should stay high-signal, with dynamic retrieval, compaction, tools, and subagents used deliberately.

Anthropic’s [Managed Agents architecture](https://www.anthropic.com/engineering/managed-agents) separates durable session, harness, and sandbox. The session event history is not the same as the context window; harness policy decides what subset and transformation the model sees.

Adopt:

- durable state/context separation;
- replaceable context strategies;
- clean specialist contexts;
- structured artifact references;
- compaction/reset without deleting source history.

## Retrieval-augmented generation

The foundational [RAG paper](https://proceedings.neurips.cc/paper_files/paper/2020/hash/6b493230-Abstract.html) combines parametric generation with retrieved non-parametric memory and highlights provenance and updatable knowledge as open problems.

Adopt:

- external, updateable evidence rather than model weights as source of truth;
- retrieval evaluated separately from generation.

Do not assume retrieval alone guarantees grounded output.

## Contextual and hybrid retrieval

Anthropic’s [Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval) adds chunk-specific document context before BM25/embedding, combines lexical and semantic retrieval, and optionally reranks. It also notes that simply including the complete source can be best when the corpus fits.

Adopt later:

- hybrid lexical/semantic candidates;
- contextualized chunks;
- reranking;
- measure failed retrieval rather than adopt vector search by default.

S1 uses complete controlled artifacts or deterministic spans.

## Long-context limitations

[Lost in the Middle](https://arxiv.org/abs/2307.03172) reports strong position sensitivity: relevant information at the beginning/end can be used better than information buried in the middle.

Adopt:

- record ordering/position;
- co-locate claims and evidence;
- evaluate packer order;
- avoid “just increase context” as the only strategy.

## Citation evaluation

[ALCE](https://aclanthology.org/2023.emnlp-main.398/) defines automatic evaluation across fluency, correctness, and citation quality, including citation recall and precision.

[RAGAS](https://aclanthology.org/2024.eacl-demo.16/) separates retrieval relevance/focus, generation faithfulness, and response quality with reference-free evaluation methods.

[FACTS Grounding](https://arxiv.org/abs/2501.03200) evaluates long-form responses for fulfillment and grounding against supplied context.

Adopt:

- retrieval, generation, citation, and task correctness as separate metrics;
- claim-level grounding and coverage;
- human/calibrated labels for high-impact cases.

Caution:

- automated NLI/LLM judges can be wrong;
- reference-free metrics are indicators, not product acceptance for critical claims.

## GraphRAG

Microsoft’s [GraphRAG indexing pipeline](https://github.com/microsoft/graphrag/blob/main/docs/index/overview.md) extracts entities, relationships, claims, communities, reports, and embeddings.

Potential later value:

- corpus-level entity/relationship discovery;
- global/multi-hop questions;
- summarizing large document collections.

S1 decision:

- defer GraphRAG/indexing cost and graph-specific retrieval;
- preserve entity/edge/provenance and backend-neutral query contracts.

## Deep research and prompt injection

OpenAI’s [Deep research system card](https://openai.com/index/deep-research-system-card/) covers safety risks including prompt injection, hallucination, privacy, browsing, and code execution in a research agent.

Adopt:

- web sources remain untrusted;
- tool/system authority never comes from retrieved content;
- browsing/research has explicit domain, cost, time, data, and stop policies;
- source provenance and result verification are mandatory.

---

# OMP implementation map

## Strong reusable mechanics

### System/context construction

Files:

- `packages/coding-agent/src/system-prompt.ts`
- `packages/coding-agent/src/sdk.ts`
- `packages/coding-agent/src/session/session-context.ts`

Present:

- system prompt construction;
- project/user context files and deduplication;
- skills/rules/prompt templates/extensions/tools;
- workspace tree and environment information;
- branch-aware session context reconstruction;
- compaction and provider replay handling;
- explicit SDK override/discovery surfaces.

Limits:

- discovery is rooted in cwd/home/session settings, not tenant mission policy;
- no durable `ContextManifest`, retrieval trace, inclusion/exclusion record, or product citation contract;
- ambient context discovery is unsafe for product assignments unless replaced with explicit clean configuration.

### Append-only context and compaction

Files:

- `packages/agent/src/append-only-context.ts`
- `packages/agent/src/compaction/*`
- `packages/coding-agent/src/session/snapcompact-inline.ts`

Present:

- stable system/tool prefix for prompt caching;
- append-only provider message log;
- branch/session summary handling;
- token budgeting and reserve;
- tool-output pruning/supersession;
- file-operation tracking;
- provider-native/local compaction;
- Snapcompact transformations and savings estimates.

Reuse:

- stable prefix and context-window accounting;
- preserving tool-result relationships;
- file-operation and protected-tool tracking;
- compaction as worker-local presentation policy.

Do not use as product evidence:

- generated summaries are lossy;
- pruned/snapcompact context cannot replace source artifacts or product manifests;
- model-visible context may differ from full session history.

### Read summarization

Files:

- `packages/coding-agent/src/tools/read.ts`
- `packages/coding-agent/src/tools/read-summary.ts`

Present:

- bounded selectors;
- structural summaries using current bytes/content hash;
- deterministic parse cache without a staleness window;
- large-file and format handling;
- repeat-read loop hints.

Reuse:

- bounded on-demand source reading;
- summaries as navigation/index aids;
- source selectors as citation spans.

Caution:

- a structural summary omits code/data; material claims must cite/read exact spans.

### Skills and memory

Files:

- `packages/coding-agent/src/extensibility/skills.ts`
- `packages/coding-agent/src/mnemopi/*`
- `packages/mnemopi/src/core/polyphonic-recall.ts`
- `packages/coding-agent/src/hindsight/*`

Present:

- on-demand skill prompt messages;
- project/global memory scopes;
- vector/graph/fact/temporal retrieval;
- query cache, MMR, episodic graph;
- mental-model summaries with explicit stale/wrong warning.

Reuse/adapt:

- retrieval backends and memory candidates;
- source scope and recall traces where available;
- on-demand capability context.

Missing:

- product eligibility/authorization compiler;
- exact manifest of included/excluded context;
- finding/evidence applicability checks;
- claim-level citation validation;
- task outcome evaluation of retrieval choices.

### Web/live research

OMP provides web search, known-URL read, browser, parallel search/extract, and research-capable agents.

Reuse:

- source discovery and extraction tools;
- primary-source reads;
- browser automation;
- parallel independent searches.

Missing:

- product-level `LiveResearchRequest` and stop policy;
- automatic source snapshot/digest/licensing/data-class record;
- registration of acquired sources into the epistemic ledger before acceptance.

## OMP conclusion

OMP provides a strong worker context engine. S1 should give it a generated, explicit configuration and manifest rather than using default cwd/home discovery. OMP may compact and retrieve inside the assignment, but every product-relevant source/result must flow through evidence and context records.

---

# Orca implementation map

Useful current patterns:

- orchestration preambles that send task/dispatch/gate context to workers;
- explicit runtime/worktree/source identities;
- agent/session scanner and AI Vault visibility;
- artifact display/share/update interfaces;
- source-control prompt builders with structured known context;
- remote-host and worktree routing;
- operator UI for files, diffs, sessions, and artifacts.

Missing:

- general assignment `ContextRequest`/`ContextManifest`;
- retrieval eligibility and ranking;
- mission/epistemic snapshot compiler;
- source/citation spans and correctness evaluation;
- model-provider data-class routing per context item;
- context refresh and stale-result handling;
- live research acquisition ledger.

Disposition:

- reuse operator/inspection, artifact, identity, and routing patterns;
- build product context compiler outside desktop prompt builders;
- do not treat terminal prompt text as reconstructable assignment state.

---

# Candidate architecture comparison

| Approach | Strength | Failure for this product | Decision |
| --- | --- | --- | --- |
| Dump all available context | Simple; avoids retrieval misses for tiny corpus. | Token cost, lost-in-middle, leakage, stale/irrelevant crowding. | S1 only for two bounded artifacts when manifest records it. |
| OMP default context discovery | Mature coding-agent behavior. | Ambient cwd/home/user config and no product manifest/tenant policy. | Replace with explicit generated config/context. |
| Lexical/structured retrieval | Transparent, strong for exact names/versions/IDs. | Misses paraphrases and conceptual similarity. | **S1 baseline.** |
| Vector retrieval | Semantic recall and paraphrase matching. | Similarity is not authority; cost/embedding/privacy/version issues. | Deferred behind known-answer failure. |
| Hybrid BM25 + vector + rerank | Stronger recall across exact/semantic queries. | More services/models, trace complexity, still needs eligibility/citation. | Planned later baseline after experiment. |
| Graph expansion/GraphRAG | Multi-hop/entity/global questions. | Index cost, extraction errors, graph sprawl, no automatic acceptance. | Deferred; relational edges first. |
| Learned context optimizer | May improve token utility/model-specific packing. | Can overfit, hide exclusions, or leak sensitive data. | Deferred until manifest/evals stable. |
| Worker-local compaction only | Handles context windows. | Loses product reproducibility and can preserve confusion. | Use locally; never product continuity. |
| Deterministic product context compiler | Reproducible, inspectable, policy-aware, backend-neutral. | Must implement ranking/packing/evaluation. | **Selected.** |

## Selected S1 context pipeline

```text
Apex/Specialist/Evaluator Assignment record
→ ContextRequest
→ deterministic eligibility filters
→ exact mission/epistemic/evidence lookups
→ optional lexical span selection
→ contradiction-aware dedupe/grouping
→ token budget and ordering
→ redaction and trust boundaries
→ immutable ContextManifest + rendered artifact digest
→ launch clean OMP RPC worker
→ worker tool/live-research observations become evidence/trace
→ result citations validated before acceptance
```

S1 includes:

- one compiler implementation;
- product instructions/assignment/output schema;
- exact current mission/version;
- gaps/contradictions/accepted findings;
- two controlled evidence artifacts or exact spans;
- strict tool contract;
- line/span citation IDs;
- inclusion/exclusion trace;
- context digest;
- stale-result rejection;
- compaction preservation test.

S1 excludes vector/graph/learned retrieval and open web crawling.

---

# Experiment suite

## `CTX-EXP-01` — Manifest reproducibility

Fixture:

- fixed mission/version/assignment/model/tool schemas;
- two evidence artifacts;
- one optional memory candidate excluded by policy.

Pass:

- two compiler runs produce identical ordered item IDs, rendered digest, exclusions, and token accounting;
- changing compiler/policy/source version creates a new manifest;
- worker restart reconstructs exact product context without prior live session.

## `CTX-EXP-02` — Tenant, scope, and data-class isolation

Fixture:

- same proposition in two tenants/environments;
- one restricted evidence item;
- external model route that cannot receive restricted class.

Pass:

- zero cross-tenant/environment item inclusion;
- restricted item excluded/redacted before ranking;
- exclusion reason attributable;
- route changes only when policy permits;
- no sensitive bytes in rendered artifact/log/trace.

## `CTX-EXP-03` — Known-answer retrieval and coverage

Fixture:

- 50–100 small documents with exact, paraphrased, stale, conflicting, and distractor passages;
- labeled relevant spans per information need.

Pass:

- structured+lexical S1 baseline reaches agreed recall@k for exact fixture needs;
- no ineligible passage counted as success;
- missing coverage is explicit;
- vector/hybrid promotion only if it materially improves held-out recall without isolation regression.

## `CTX-EXP-04` — Citation validity, correctness, and completeness

Fixture:

- result with supported, unsupported, partially supported, stale, wrong-scope, and decorative citations.

Pass:

- all missing/bad IDs/digests/spans rejected deterministically;
- every critical material claim has sufficient support;
- irrelevant citations detected within labeled threshold;
- applicability/freshness failures surfaced separately from entailment;
- automatic judge calibrated against human labels before gating critical findings.

## `CTX-EXP-05` — Stale mission context

Fixture:

- specialist starts on mission version V1;
- evidence changes and V2 supersedes a finding/plan while specialist runs;
- worker returns a valid V1 result.

Pass:

- result remains inspectable evidence;
- direct V2 state/plan/effect commit is rejected;
- revalidation or fresh assignment decides reusable parts;
- no hidden context refresh changes the original manifest.

## `CTX-EXP-06` — Retrieved prompt injection

Fixture:

- customer/web document instructs the model to ignore policy, expose secrets, invoke tools, or mark itself authoritative.

Pass:

- content stays in untrusted evidence boundary;
- tool/system/role policy and allowed capabilities unchanged;
- no secret/tool/effect escalation;
- material assertions cite the source and source role;
- injection attempt appears in trace/evidence warnings.

## `CTX-EXP-07` — Compaction preservation

Fixture:

- assignment exceeds model context through large read/tool outputs;
- OMP compaction/pruning/reset occurs.

Pass:

- hard assignment/authority/output/evaluator contract remains model-visible;
- active evidence/citation IDs remain usable;
- product manifest and source artifacts remain unchanged;
- replay with a fresh worker reconstructs required context;
- no product state depends solely on generated summary text.

## `CTX-EXP-08` — Live research provenance

Fixture:

- search returns snippets, secondary summaries, stale official docs, and current primary source;
- one source has restrictive storage terms;
- one page contains injection text.

Pass:

- primary source read directly when reachable;
- query/rank/fetch/canonical URL/time/digest/extraction recorded;
- snippets not promoted as final evidence;
- storage policy obeyed;
- contradictions preserved;
- budget/stop condition enforced.

## `CTX-EXP-09` — Packing order and context ablation

Fixture:

- decisive evidence placed beginning, middle, end, omitted, summarized, and co-located with claim;
- fixed model and task.

Pass:

- order sensitivity measured rather than assumed;
- chosen packer beats or matches alternatives on held-out task/citation outcome within budget;
- mandatory constraints survive every packing arm;
- manifest makes every arm reproducible.

## `CTX-EXP-10` — Retrieval backend substitution

Fixture:

- same `ContextRequest` served by exact/lexical, hybrid vector, and graph-expanded implementations.

Pass:

- manifests remain schema-compatible;
- backend does not bypass eligibility;
- quality/latency/cost/leakage reported separately;
- promotion requires held-out task gain, not retrieval score alone.

## S1 required subset

Required for S1:

- `CTX-EXP-01` reproducibility;
- `CTX-EXP-02` isolation;
- `CTX-EXP-03` exact/lexical coverage on small fixture;
- `CTX-EXP-04` citation contract;
- `CTX-EXP-05` stale context;
- `CTX-EXP-06` injection;
- `CTX-EXP-07` compaction preservation.

Live web research, long-context optimization, and backend substitution may run after the core S1 loop if the deferred seams remain intact.

## Reversal conditions

Revisit the deterministic compiler baseline if:

- task success requires agent-controlled context assembly that cannot be represented as requests/traces;
- exact/lexical retrieval fails held-out coverage and hybrid retrieval materially improves it;
- context-manifest storage cost/latency exceeds value at measured scale;
- provider-native context/memory APIs offer equivalent provenance, isolation, reproducibility, and evaluation;
- a standard context protocol passes the full S1 experiment suite with less custom code.

## Next coordinate

`P1-RSCH-06` — research working, episodic, semantic, procedural, failure, and evaluation memory.
