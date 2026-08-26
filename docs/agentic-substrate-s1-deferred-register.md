# S1 Deferred Capability Register

## Purpose

Track capabilities deliberately excluded from Slice S1 so prototype focus does not become accidental product scope.

Slice S1 proves one **evidence-correcting mission loop**:

- durable mission state;
- two conflicting evidence artifacts;
- one apex assignment;
- two product-owned specialist assignments;
- explicit epistemic gaps and contradictions;
- one deterministic discriminating check;
- first artifact rejected;
- corrected artifact accepted;
- one quarantined memory candidate;
- crash/restart/replay without duplicate accepted state.

Every deferred item preserves a seam and has a re-entry trigger.

## Status rules

| Status | Meaning |
| --- | --- |
| `DEFERRED` | Purposefully excluded from S1; expected later. |
| `PROMOTED` | Trigger fired; item has moved into an active roadmap coordinate. |
| `DROPPED` | Evidence showed the capability should not be built/adopted. |
| `REPLACED` | Another capability now satisfies the need. |

Update this register whenever:

- S1 scope changes;
- research reveals a new necessary capability;
- an experiment fires a re-entry trigger;
- a deferred seam becomes difficult to preserve;
- an item is promoted, replaced, or dropped.

## Deferred items

| ID | Status | Capability intentionally excluded from S1 | Why excluded | Seam preserved in S1 | Re-entry trigger | Planned coordinate |
| --- | --- | --- | --- | --- | --- | --- |
| `S1-DEF-001` | `DEFERRED` | Real source connector | S1 tests the substrate, not database access breadth. | `EvidenceItem` and source-adapter interface accept fixture artifacts. | Epistemic/orchestration/correction loop passes and source discovery begins. | `P6-DISC-01`–`03` |
| `S1-DEF-002` | `DEFERRED` | Snapshot, CDC, schema drift, deletes, late data | Requires source-specific runtime and replay corpus. | Task/evidence/evaluator contracts can represent watermarks and dispositions. | First source adapter selected. | `P6-DISC-08`, `P6-DISC-16` |
| `S1-DEF-003` | `DEFERRED` | Real Databricks/Snowflake/cloud target mutation | External-effect work must not distract from core correction loop. | `EffectIntent`, capability envelope, receipt, and unknown state remain in schemas. | S1 state/evaluation gates pass. | `P8-EXEC-07`–`12` |
| `S1-DEF-004` | `DEFERRED` | Remote execution relay and customer-zone spool | No source/target network exists in S1. | Assignment/effect protocols use location-neutral IDs and receipts. | One local effect protocol passes; remote topology needed. | `P8-EXEC-04`–`06` |
| `S1-DEF-005` | `DEFERRED` | Production operator console | CLI/minimal inspector is enough to prove state/evidence. | Public query shapes and stable record IDs remain UI-ready. | Integrated mission behavior stabilizes. | `P9-INTEG-03`–`09` |
| `S1-DEF-006` | `DEFERRED` | Production Kubernetes/HA/DR | S1 needs reproducibility, not production availability certification. | Stateless worker boundaries and durable store interfaces remain deployable. | Clean local prototype passes and customer RTO/RPO is known. | `P10-QUAL-01`, later production phase |
| `S1-DEF-007` | `DEFERRED` | Full enterprise identity, SCIM, KMS, secret-manager integrations | No real customer credential/effect exists in S1. | Tenant ID, workload ID, capability, data class, and secret reference are mandatory fields. | First real connector/effect integration. | `P8-EXEC-02`, `P8-EXEC-13` |
| `S1-DEF-008` | `DEFERRED` | Production-grade multi-tenancy and row-level security | S1 can test logical tenant isolation without full enterprise auth. | Every durable key and context manifest includes tenant; negative fixtures exist. | Shared service deployment or customer multi-business-unit need. | `P8-EXEC-13`, `P10-QUAL-07` |
| `S1-DEF-009` | `DEFERRED` | Dedicated graph database | Relational support/refutation/dependency edges cover S1. | Graph queries sit behind epistemic repository interface. | PostgreSQL traversal/latency or argumentation experiment misses threshold. | `P5-KNOW-06`, `L-KNOW-01` |
| `S1-DEF-010` | `DEFERRED` | Full ATMS or formal argumentation solver | Complexity is unjustified before contradiction workload exists. | Assumptions, justifications, support/refute, contradiction sets, and candidate hypotheses are explicit. | EPI experiments reveal combinatorial environments or incorrect simple acceptance. | `P5-KNOW`, `P7-EVAL`, `L-KNOW-01` |
| `S1-DEF-011` | `DEFERRED` | Bayesian belief network and calibrated expected information gain | No calibrated priors/likelihoods exist yet. | Probe candidates store predicted outcomes and transparent ordinal factors. | Domain corpus supplies calibrated probabilities and improves probe choice. | `P7-EVAL`, post-S1 research |
| `S1-DEF-012` | `DEFERRED` | Semantic entropy and model uncertainty service | S1 acceptance is evidence-based; model uncertainty is optional signal. | Assignment results may carry uncertainty signals without authority. | EPI-EXP-06 shows measurable risk/coverage benefit. | `P7-EVAL-06`, `L-EVAL-01` |
| `S1-DEF-013` | `DEFERRED` | Vector retrieval and reranking | Two fixture artifacts do not need semantic search. | Context assembler and retrieval result schemas are backend-neutral. | Corpus size/known-answer benchmark defeats lexical/structured retrieval. | `P5-KNOW-05` |
| `S1-DEF-014` | `DEFERRED` | Full long-term memory taxonomy and consolidation | S1 needs only one quarantined memory candidate. | Candidate record includes type, provenance, scope, expiry, and status. | Repeated tasks exist and help/harm can be measured. | `P5-KNOW-09`–`13` |
| `S1-DEF-015` | `DEFERRED` | Skill certification, promotion, drift, demotion, rollback | S1 does not execute learned skills. | Learning candidate and skill-manifest interfaces remain versioned. | Correction loop passes and one repeated capability is identified. | `P7-EVAL-10`–`14` |
| `S1-DEF-016` | `DEFERRED` | Fine-tuning, distillation, or custom model training | Corpus/evaluator does not yet exist; weights are not the current bottleneck. | Every attempt pins model/version and produces evaluation data. | Stable held-out corpus and repeated model-specific error class. | Post-prototype decision |
| `S1-DEF-017` | `DEFERRED` | Recursive multi-level agent hierarchy | One apex and two specialists are enough to test authority/disagreement. | Assignment model includes parent, depth, budget, scope, and spawn policy. | ORCH experiment shows one level cannot decompose required workload. | `P4-AGNT`, after ORCH baseline |
| `S1-DEF-018` | `DEFERRED` | Open-ended swarm/group chat | Chatter creates cost and unclear ownership without guaranteed diversity. | Messages and evidence are durable, but authority stays assignment-based. | Bounded group experiment beats apex/worker baseline on held-out tasks. | `P4-AGNT`, research branch |
| `S1-DEF-019` | `DEFERRED` | Agent voting as conflict resolution | Correlated models can confidently vote for the same wrong answer. | Disagreement creates epistemic gaps and discriminating probes. | Independent diversity/calibration evidence proves voting value. | `P7-EVAL`, research branch |
| `S1-DEF-020` | `DEFERRED` | Contract-net/market-based task allocation | No large heterogeneous worker market in S1. | Specialist capability, budget, cost, and availability fields exist. | Worker count/capability diversity makes central assignment a bottleneck. | `P4-AGNT`, scale iteration |
| `S1-DEF-021` | `DEFERRED` | OMP internal subagents as durable first-level assignments | OMP task agents are parent-session scoped and not mission authority. | Product assignment IDs wrap one OMP RPC process; nested subagents remain optional micro-work. | Product-owned dispatch works; a microtask needs cheaper local fan-out. | `P4-AGNT-08`–`13` |
| `S1-DEF-022` | `DEFERRED` | Multiple apex agents or permanent debate council | Cost/coordination complexity before one apex contract is proven. | High-risk decision can request an independent evaluator/advisor assignment. | ORCH experiment shows apex bottleneck or systematic uncorrected bias. | `P4-AGNT`, `P7-EVAL` |
| `S1-DEF-023` | `DEFERRED` | Persistent apex model session/persona | Durable mission state should outlive and replace the model worker. | Apex assignment is reconstructed from mission snapshot/context manifest. | Experiment proves continuity benefit beyond product state without hidden authority. | `P4-AGNT`, research branch |
| `S1-DEF-024` | `DEFERRED` | DBOS/Temporal/Restate/Hatchet production adoption | S1 baseline must first expose actual durability pain. | Durable-execution interface and challenger experiment remain explicit. | DUR-EXP-01/02 shows custom or challenger materially wins. | `P2-LAB`, `P3-KERN`, `L-ARCH-01` |
| `S1-DEF-025` | `DEFERRED` | Message bus, Redis, or separate queue service | S1 load does not justify extra infrastructure. | Transactional outbox/work-claim interface is transport-neutral. | Queue age/database contention misses measured envelope. | `P3-KERN`, `L-ARCH-01` |
| `S1-DEF-026` | `DEFERRED` | OPA/external policy engine | S1 can enforce a small typed in-process policy. | Policy input/output and decision record are engine-neutral. | Policy volume/ownership/versioning needs independent bundles. | `P8-EXEC-02` |
| `S1-DEF-027` | `DEFERRED` | Healthcare semantic capability pack | S1 validates substrate mechanics with technical artifacts. | Finding/evaluator contracts support domain-specific records. | Generic substrate correction loop passes. | Migration/domain work after `G7-EVAL` |
| `S1-DEF-028` | `DEFERRED` | Multi-cloud, multi-source, multi-target coverage | Breadth before one correct path creates shallow adapters and weak evaluation. | Capability matrix and adapter interfaces are versioned. | One connector/target path is certified. | Post-prototype capability expansion |
| `S1-DEF-029` | `DEFERRED` | Disconnected/offline production envelopes | Requires trust-root, expiry, sequence, transfer, and revocation design. | Envelope IDs, signatures, expiry, and evidence imports remain extensible. | Customer disconnected requirement and connected effect protocol pass. | Post-prototype production phase |
| `S1-DEF-030` | `DEFERRED` | Production evidence WORM/legal hold/export | S1 uses immutable local artifacts and digests only. | Evidence metadata includes retention, class, digest, and source. | Customer legal/records requirements supplied. | Production compliance phase |
| `S1-DEF-031` | `DEFERRED` | Production observability/SLO/alert platform | S1 needs traces and run artifacts, not enterprise operations integration. | Correlation IDs, event metrics, queue age, failure categories preserved. | Integrated prototype and customer SLOs exist. | `P10-QUAL`, production phase |
| `S1-DEF-032` | `DEFERRED` | Broad corpus acquisition and model training dataset | S1 needs two controlled contradictory artifacts and seeded labels. | Corpus manifests include license/version/classification/checksum. | Research or domain experiment requires more coverage. | `P2-LAB`, `P5-KNOW`, `P6-DISC` |
| `S1-DEF-033` | `DEFERRED` | Continuous web crawling and automatic corpus synchronization | S1 uses controlled local artifacts; open web ingestion adds licensing, injection, freshness, and storage policy. | `LiveResearchRequest/Result`, evidence ingestion, canonical URL, digest, freshness, and stop-policy contracts exist. | A substrate/domain task requires current external knowledge not available in approved corpus. | `P1-RSCH-05`, `P5-KNOW`, later research service |
| `S1-DEF-034` | `DEFERRED` | Learned or model-specific context optimizer | S1 must first establish reproducible manifests and held-out context evaluation. | Compiler/packer is versioned and backend/model-strategy neutral. | CTX-EXP-09 shows stable model-specific packing gain without leakage or constraint loss. | `P5-KNOW`, `P7-EVAL` |
| `S1-DEF-035` | `DEFERRED` | Automated NLI/LLM citation judge as critical acceptance authority | Automatic citation judges can miss partial support and inherit model bias. | Citation validity/correctness/completeness interfaces and human-labeled calibration set are defined. | CTX-EXP-04 demonstrates calibrated error below the threshold for a named claim class. | `P7-EVAL-06` |
| `S1-DEF-036` | `DEFERRED` | Advanced long-context, prompt-caching, and provider-native context optimization | These optimize cost/latency after correctness and manifest contracts exist. | Manifest records order, position, prefix/tool digests, budget, and strategy version. | CTX-EXP-09 or cost/load tests show the baseline misses task quality or budget targets. | `P5-KNOW`, `P10-QUAL-06` |
| `S1-DEF-037` | `DEFERRED` | Cross-tenant analogue learning and globalized customer lessons | S1 has no approved de-identification/certification process and must default to isolation. | Memory records carry tenant/use policy; global reference corpus is separate from learned memory. | Explicit customer/privacy approval plus de-identification and held-out leakage/correctness certification. | Post-S1 memory/domain phase |
| `S1-DEF-038` | `DEFERRED` | Production memory backend selection between product Postgres, Mnemopi, Hindsight, or another service | S1 only creates a quarantined candidate; backend performance is not yet the bottleneck. | Product memory contracts and adapter boundary own lifecycle/use traces. | MEM-EXP-09 shows one backend materially improves quality/operations without weakening governance. | `P5-KNOW`, `L-KNOW-01` |
| `S1-DEF-039` | `DEFERRED` | Production legal forgetting, deletion propagation, and retention orchestration | S1 uses synthetic/local records without customer deletion or legal-hold obligations. | Memory/source/derivation/use IDs and deletion policy fields are mandatory. | Customer legal/records requirements or non-synthetic data enters the system. | Production compliance phase; MEM-EXP-08 |
| `S1-DEF-040` | `DEFERRED` | Adaptive memory consolidation, learned importance/decay, and autonomous reorganization | These can amplify errors before help/harm and poison benchmarks exist. | Consolidation creates versioned candidates with source/drop/conflict records; ranking strategy is replaceable. | MEM-EXP-02/04/06/10 demonstrate safe measurable gain. | `P5-KNOW`, `P7-EVAL` |

## Promotion procedure

When a trigger fires:

1. Change status from `DEFERRED` to `PROMOTED`.
2. Name the triggering experiment/evidence.
3. Add or activate the roadmap coordinate.
4. Define acceptance evidence.
5. Update architecture/ADR only if the promoted item changes boundaries.
6. Retain the original reason and date so scope history remains reconstructable.
