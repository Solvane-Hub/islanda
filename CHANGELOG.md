# Changelog

All notable changes to Islanda (formerly FoundryAI) are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project is pre-release; versions are sprint-scoped until first deployment.

---

## [Unreleased] — Post-competition rebrand

**FoundryAI was renamed to Islanda following the competition.** The company remains
Solvane Hub and the AI agent remains Nova — only the product name changed. Historical
entries below predate the rename and are preserved as written; they say "FoundryAI"
because that was the product's actual name at the time. No database identifiers,
applied migrations, or historical evidence documents were altered by the rename.

---

## [Unreleased] — Sprint 1 (Platform Foundation)

### Knowledge/Retrieval Foundation — Phase 1 · 2026-08-08

First implementation phase after the architecture freeze. Implements K1–K4 and K7;
K5 is contract-only. No architecture was reopened and no specification was created.

**Migration** `20260808120000_knowledge_foundation.sql` — `knowledge_packs` (system of
record, immutable once published), `knowledge_sources`, `knowledge_source_validations`
(append-only), `knowledge_chunks`, `knowledge_chunk_relations`,
`knowledge_embedding_manifests`. RLS enabled **and forced** on all six; authenticated
reads are scoped to published packs, so "unpublished content cannot enter retrieval" is a
database guarantee rather than a rule every query must remember.

**KI1 / MP-1 remains open.** No embedding model, provider or dimensionality is chosen. No
vector column, no pgvector extension, no vector index. `dimensions` is stored as data in
the manifest table, not as a column type, so the manifest can exist while KI1 does not.
`resolveEmbeddingProvider()` throws by design — a default would be a residency decision
(MP-2) taken by accident.

**`chunk_id` is a deterministic UUIDv5** derived from Pack version, source, section and
normalised body. Not random: ADR-0016 makes retries normal operation, and a retried
ingestion step that minted new ids would orphan every citation the first attempt issued.

**Claim-level trust is refused, not ignored.** `knowledge_chunks` has no
`evidence_strength`, `reasoning_confidence`, `trust_level` or `trust_score` column, and
`assertNoClaimLevelTrust()` throws rather than letting Zod silently strip them — silence
is how these fields get added by accident (K3 §5.1).

**One bug found by its own test.** `normaliseContent` preserved newlines, so re-extracting
the same provision at a different line width produced a different `chunk_id`. K3 §3
requires identifiers to survive non-material change; whitespace now collapses fully. The
implementation was wrong, not the test.

**Temporary:** `types/database-knowledge.ts` and `lib/db/knowledge/client.ts` bridge the
generated `Database` type until the migration is applied. Removal procedure is in the file
header. 221 unit tests pass (114 new).

### Four unregistered documents retired; 24 shadow ADRs retired · 2026-08-08

Founder decisions **D1–D5** applied. Four Notion documents each declared `Status: Canonical`
while absent from `DOCUMENT_MANIFEST.md`, and each carried its own ADR series outside
`docs/decisions/`. All are now registered with explicit non-canonical status and retained for
history.

| Document                         | Status                  | Replaced by                                     |
| -------------------------------- | ----------------------- | ----------------------------------------------- |
| Retrieval Engine Specification   | 🟡 SUPERSEDED           | K5 · AI-3 Coordinator                           |
| Knowledge Graph Architecture     | ⛔ ARCHIVED             | no single successor — graph-first not adopted   |
| FoundryAI Reasoning Model        | 🟡 SUPERSEDED           | ADR-0016 · ADR-0017 · AI-3 · AI-4 · AI-1 · AI-2 |
| Evidence & Citation Architecture | 🟡 SUPERSEDED in schema | Trust Layer §8 · K4 · ADR-0015 · K6 §2A.4       |

**D1 — the retrieval architecture is unchanged.** K3 chunks → K5 deterministic filtering →
semantic/hybrid retrieval → trust filtering. Graph-first retrieval was not adopted; the
Knowledge Graph is not the system of record; graph traversal is not a prerequisite for
discovering legal obligations. **K5 and K3 were not reopened** — K3 received an additive
harvest only.

**D3 — 24 shadow ADRs retired, none promoted.** `ADR-RE-001…006`, `ADR-KG-001…006`,
`ADR-RM-001…006`, `ADR-EC-001…006`. Two were rejected outright as contradicting ratified
decisions: `ADR-RM-004` (Coordinator delegates to specialists) against ADR-0016, and
`ADR-KG-001` (graph is the source of regulatory truth) against K1/K7. The manifest records
which canonical document covers each series.

**D4 — harvested material and new owners.**

- **Founder "Why?" evidence panel** → **Launch Plan Architecture §5A.** Renders the Trust Layer
  §8 citation object; defines no schema. Copy obeys Constitution Article VII — "Requirements we
  found". The badge is labelled **Trust Level**, not "Confidence" as the source document had it,
  and Coverage Confidence is not displayed in v1.
- **Business-taxonomy expansion** → **Coordinator §5A.** Classification and query-scope input
  only, feeding domain declaration. Explicitly not a retrieval stage; K5 §4 unchanged.
- **Conditional requirement logic** → **K3 §7.1** (Notion and mirror). Recorded as structured
  conditions on chunk relationships. Notably, an **unevaluable condition is not `false`** — it
  is reported as unresolved, because silently dropping a requirement for a missing profile field
  is exactly the omission failure the platform exists to prevent. **No new specification created.**

**Recorded as future ADR input, not adopted:** jurisdictional inheritance (KG §7), the 16-type
relationship vocabulary (KG §6), the consolidated failure-mode taxonomy (RM §15 / EC §14).
Gaps acknowledged, not filled.

**D5 — ADR-0018 unchanged.** Retrieval Engine §16's <2 s latency and ≥99% requirement recall
were not promoted into a binding ADR.

Retirement banners added to all four Notion pages, each naming its successor and its known
conflicts. ADR-0015 … ADR-0019 unchanged. K1–K7 remain canonical. The four-dimension trust
model, the canonical citation object and mandatory `chunk_id` are untouched. No embedding model
chosen.

### Documentation integrity — conflict register synchronized · 2026-08-08

`DOCUMENT_MANIFEST.md` still described conflicts as open after they had been resolved and
applied. The register lagged the ratified state; no content or decision changed.

- Header now reads **zero unresolved conflicts** (C1–C3, R1–R3, A1–A12), replacing "⚠️ 3 conflicts open".
- **C2 marked resolved** — AI-6 retired, mechanisms absorbed into K6 §2A. Header was "🟠 needs reconciliation".
- **C1** — the stale status line inside its history block ("not applied; requires founder direction")
  is now marked superseded, recording that the proposed path was approved and applied.
- **C3 confirmed resolved** — Trust Layer §8 is the canonical citation object; `chunk_id` mandatory.
- Register heading notes that the six open **founder decisions** are pending inputs, not conflicts —
  the two were easy to conflate while the header said conflicts were open.

Original conflict descriptions retained in full under `<details>`, struck through rather than
deleted. A resolved conflict is the record of why a rule exists.

**ADR-0015 not modified.** No architectural decision changed. K1–K7 content untouched.

### Knowledge Engineering K2–K7 mirrored into the repository · 2026-08-08

All seven Knowledge Engineering documents now exist locally under
`docs/architecture/knowledge-engineering/`. K1 was mirrored previously; K2–K7 complete the set.

Each mirror carries an HTML comment header recording its Notion source URL and mirror date, so
drift between the two copies is detectable rather than silent. Notion remains the authoring
surface; the repository holds what CI and AI assistants actually read.

**Mirrored content is the Notion canonical text, reproduced faithfully.** Structure, section
numbering, wording and diagrams are preserved. The A1–A12 amendments were already applied in
Notion on 2026-08-08 and appear here as they appear there — no amendment was re-authored, and
no substantive content was rewritten during mirroring.

Verified present in the mirrors:

- **Reasoning Confidence** is the only dimension name in use. The two remaining occurrences of
  "Reasoning Quality" are the correction notes in K2 §7 and K4 §5 recording the rename.
- **Five-level Source Authority** is canonical; **Legal Source Category** persists as metadata
  (K2 §8.1, K3 §8, K5 §3.4). No sixth level.
- **Claim-level trust is never stored on a chunk** (K3 §5.1, K5 §3.4).
- **`chunk_id`** is mandatory and singular (K4 §6, K5 §3.10, §11).
- **Deterministic reproducibility** with persisted replay inputs (K5 §3.8, §12).
- **Embeddings are retrieval artifacts**, not Knowledge Pack versions (K7 §3, §3.1, §7).
- **AI-6 is retired, not recreated** — mechanisms absorbed in K6 §2A; the history file remains
  at `docs/architecture/knowledge-freshness-specification.md`.
- **No embedding model selected.** KI1 / MP-1 remains open and still blocks K3 §6, K5 §7 and
  K7 §7.

Conflict register rows C2 and C3 marked resolved in the cross-reference table.

**One correction worth recording.** The first mirroring pass reconstructed the documents from
working memory of the amendments rather than re-fetching the sources. The result read
plausibly but was not the canonical text — sections were renumbered, wording differed, and
three mirror headers carried wrong Notion URLs. It was caught by cross-checking the headers
against `DOCUMENT_MANIFEST.md`, whose URLs disagreed. All six were discarded and re-mirrored
from freshly fetched sources. A mirror that paraphrases its source is a second specification
wearing the first one's name.

### K2/K3/K5/K7 audit findings A1–A12 resolved · 2026-08-08

All six substantive findings founder-approved; ADR-0015 unchanged.

**A4 — legal-source distinctions preserved without a sixth level.** K2's six categories
(Constitution · primary legislation · Regulations · Ministerial orders · Official guidance ·
Agency publications) are retained as **Legal Source Category metadata** and mapped to the
ratified five levels. Conflict resolution now orders by Source Authority, then by the finer
category _within_ a level, then by recency — so a Constitution still outranks an ordinary Act
even though both are Authority 5. No sixth trust level was created.

**A7 — trust is not a chunk property.** K3 stored "trust dimensions" on chunks. A chunk has no
claim to be strong evidence _for_ — the same chunk may be Evidence Strength 5 for one claim and
2 for another. Chunks now carry **Source Authority only** (genuinely a property of the source
document); Evidence Strength, Reasoning Confidence, Trust Level and Trust Score are derived per
claim. Storing them at publication would let a value computed once be reused for claims it was
never assessed against — the trust-laundering the Trust Layer exists to prevent. All provenance
metadata preserved.

**A8 — retrieval reports, the Coordinator decides.** K5 allowed retrieval to trigger founder
clarification. Retrieval sees one query's results; the Coordinator sees the whole business
context. A retrieval-triggered question would fire per-query and interrupt a founder repeatedly
for gaps the Coordinator had already accounted for.

**A9 — deterministic reproducibility.** "Materially identical" replaced: for a fixed Knowledge
Pack version, retrieval configuration, query representation, filters, ranking configuration and
embedding model/version, retrieval must return **the same ordered result set**. Those inputs are
now persisted per run. The document explicitly states that later infrastructure changes do _not_
reproduce a historical retrieval unless the versioned inputs were preserved.

**A10 — embeddings are retrieval artifacts, not knowledge versions.** K1's position is canonical.
K7 revised: regenerating embeddings does **not** create a Knowledge Pack version; changing the
embedding model invalidates and rebuilds affected retrieval artifacts only. Each generation
records model, version, **dimensions**, timestamp, source Knowledge Pack version, retrieval
configuration version, chunk version and status. **No embedding model was chosen** — KI1/MP-1
remains open.

**A12 — `chunk_id` mandatory in the retrieval → agent contract.** Must correspond to the exact
chunk returned by the run and stay stable within its Knowledge Pack version. It is the **single**
citation identity — no retrieval-local index, per-run handle or passage hash may compete with it.
Propagated to K5, the Specialist Agent Contract, the Coordinator and AI-5.

**A1–A3, A5, A6** — terminology and hierarchy corrections applied.

### Documentation conflicts C1–C3, R1–R3 resolved · 2026-08-08

All six founder-approved. **ADR-0015 was not modified** — it governed every resolution.

**C1 — Source Authority scale.** K1 §4.3 aligned to ADR-0015 (Notion + local). Level 5 =
primary legislation; Level 4 = statutory instruments and regulations; Level 3 = official
guidance. New **§4.3.1** states the rule directly: _a document does not acquire authority
because a ministry published it_ — an Act is 5, a regulation is 4, and the guidance page
explaining it is 3, even from the same department. Level 3 can never reach VERIFIED.

**R1 — Trust Layer contradicted itself.** §9 Decision Flow still carried pre-ratification
logic granting VERIFIED at authority ≥ 3, omitting Evidence Strength and Reasoning Confidence
entirely. Rewritten to evaluate all four dimensions in order: the three per-claim dimensions
first (each can independently disqualify), then Coverage over the surviving _set_. Coverage
deliberately does **not** gate persistence — withholding a low-coverage set would leave the
founder with nothing while telling them nothing. **This was my error, not K1's.**

**R2 — Stale open questions.** T2 marked resolved. T1 and T4 were equally stale and are also
marked resolved.

**R3 — Terminology.** **Reasoning Confidence** is canonical. Two occurrences of "Reasoning
Quality" in K4 corrected. Unrelated uses of "quality" (cost/quality trade-off, quality
regression, source quality) deliberately untouched — no blind replacement.

**C2 — AI-6 merged into K6.** K6 is now the single canonical monitoring specification.
Absorbed into **K6 §2A**: review cadence by source class · −10 trust-score staleness penalty ·
plan cascade (`ready` regenerates, `active` never silently replaced) · 404 ≠ unpublish ·
coverage recovery. K6 keeps its stronger change taxonomy, impact assessment, logging,
governance and publication workflow. **AI-6 retired, not deleted** — retained with a banner
mapping each mechanism to its new home. K6 §17 corrected: it had listed the Trust Layer
Specification as _following_ it, inverting the hierarchy.

**C3 — One canonical citation object.** `chunk_id` was **missing** from K4. Trust Layer §8 now
holds the single canonical definition, the union of both formats: `chunk_id` mandatory, plus
agency, document, section, publication_date, last_reviewed_date, knowledge_version, url,
accessed_at, with K4's `clause` and `page` retained as optional. No useful field was dropped
to force symmetry. K4, `schema-future-phases.sql` and the Specialist Agent Contract now
**reference** the definition rather than restating it.

> `clause` and `page` help a _human_ find the text. `chunk_id` is what lets the _system_ prove
> the passage was actually retrieved — without it, citation binding, Evidence Strength and
> grounding replay are all impossible.

### Knowledge Engineering series registered · 2026-08-08

**Added**

- `docs/architecture/knowledge-engineering/knowledge-pack-authoring-guide.md` — mirrored
  verbatim from Notion (K1 of 7).
- `DOCUMENT_MANIFEST.md` — new **Knowledge Engineering series** section registering all seven
  documents with Notion URLs, mirror status and cross-references to the AI Architecture
  series, plus a new **Conflict register**.

**Documents registered** (authored outside this session, parent:
[Knowledge Engineering](https://app.notion.com/p/3b69910b029a80d88859df39edaab80a))

K1 Knowledge Pack Authoring Guide · K2 Knowledge Validation Standard · K3 Knowledge Chunking
Strategy · K4 Metadata & Citation Standard · K5 Retrieval Architecture (RAG) Specification ·
K6 Knowledge Monitoring & Change Detection Specification · K7 Knowledge Publishing Pipeline
Specification.

**Mirror status: 1 of 7 complete.** Until a document is mirrored, **Notion remains canonical
for that document** — the manifest records this per-document rather than claiming the
repository is authoritative for content it does not yet hold.

### ⚠️ Conflicts discovered — none resolved, none of the documents rewritten

**C1 — Source Authority scale (K1 §4.3 vs ADR-0015). 🔴 Founder decision required.**

The two scales disagree at levels 4 and 5. The consequential difference is not the numbering:
ADR-0015 defines Source Authority as **a property of a document**, objective and assignable at
registration. K1's Level 4 — _"Competent Regulatory Authority: Ministries, Departments"_ —
classifies by **who published it**, an organisation.

Under K1, anything a ministry publishes is Level 4 and therefore qualifies for 🟢 VERIFIED.
ADR-0015 explicitly decided official agency guidance is Level 3 and _"can be 🟡 DERIVED at
most"_. **K1 as written would loosen exactly the control the founder tightened when ratifying
VERIFIED ≥ 4** — and it would do so invisibly, since both documents use the same 1–5 vocabulary.

K1 §1.4 declares itself _subordinate to the Trust Layer Specification_, which indicates the
ratified scale governs and K1 §4.3 should be aligned. **Not applied**, per the instruction not
to rewrite these documents.

**C2 — Freshness vs Monitoring overlap (K6 vs AI-6). 🟠** Both specify change detection, review
cadence and staleness propagation. One should supersede the other, or their scopes be divided
explicitly. Both currently listed canonical.

**C3 — Citation object (K4 vs Trust Layer §8). 🟡** The Trust Layer mandates `chunk_id` so
grounding is reproducible. K4 to be verified on mirroring.

**Reassuring finding:** K1 independently arrives at the same four trust dimensions
(§2.11) and the same rule that Source Authority and Evidence Strength are independent
(§4.6) — _"a Level 5 Act mentioning business licences in passing may provide weak evidence"_.
Two documents written separately converged on the model ratified in ADR-0015.

### AI Architecture series COMPLETE — documents 4–15 · 2026-08-07

**Added — 12 canonical architecture documents**

`specialist-agent-contract` · `knowledge-ingestion-pipeline` · `knowledge-freshness-specification`
· `ai-evaluation-framework` · `prompt-engineering-standard` · `agent-memory-architecture`
· `human-review-workflow` · `observability-and-telemetry` · `model-provider-architecture`
· `ai-cost-optimisation` · `ai-safety-framework` · `versioning-and-reproducibility`

**Added — 3 ADRs**

- **ADR-0017 — Shared agent output contract.** One envelope for every specialist. Four
  non-negotiables: emit the envelope, bind every claim to a `chunk_id` _plus a verbatim
  quote_, be idempotent, never self-assess trust. `unresolved[]` is **mandatory** — an agent
  that determined four requirements and could not determine a fifth returns four claims **and
  one unresolved entry**. Discarding what could not be determined is the easiest way to
  produce a confidently incomplete plan.
- **ADR-0018 — Evaluation gates and release criteria.** Any prompt, model, chunking or
  retrieval change re-runs the suite. Hard gates: coverage recall ≥ 95% (**also the TRL 3
  gate**), citation validity 100%, domain-declaration recall ≥ 99%, fabrication 0. A recall
  regression > 2pp blocks release even when the absolute value still passes — gradual erosion
  is how coverage would be lost.
- **ADR-0019 — Model provider abstraction and data residency.** Capability tiers, not model
  names; provider SDKs importable only inside `lib/ai/providers/`. **Failover is off by
  default** — silently answering a compliance question with an unevaluated model is worse than
  failing the run.

**Founder decisions recorded (CO1–CO3)**

- **CO1** — `premises_type` is _not_ added to intake; requested via targeted clarification
  only when classification requires it. Asking every founder a question relevant to a minority
  lengthens intake for everyone.
- **CO2** — LOW classification confidence produces a **best-effort plan** with reduced Coverage
  Confidence plus clarification, then regeneration. Blocking leaves someone staring at a
  question with nothing to react to, and people answer questions about their business far
  better when they can see what the answer would change. The safeguard is that reduced
  coverage is _computed, not cosmetic_.
- **CO3** — `knowledge_domains` is owned by **Knowledge Pack metadata**; the Coordinator
  consumes it. Domains are jurisdiction-specific, so Coordinator ownership would force an
  application change per country — breaking the rule that country logic never lives in code.

**Themes that emerged across the series**

_Omission is the platform's defining risk._ It leads the safety harm taxonomy (H1), drives
Coverage Confidence, makes `unresolved[]` mandatory, sets domain-declaration recall at ≥ 99%,
and is the reason coverage recall gates TRL 3. Conventional AI safety practice defends against
fabrication; almost nothing defends against a confidently incomplete answer.

_Refusal is a designed output, not a failure._ A **falling refusal rate is a monitored alert**
— if the system stops saying "unknown", the likeliest cause is a prompt edit that dropped the
refusal instruction, not a better corpus.

_Replay makes no model calls._ That is precisely what makes it trustworthy as audit — it
cannot produce a different answer than the one recorded.

**⚠️ Conflict identified, not resolved: reproducibility vs erasure.** Reproducibility requires
retaining agent inputs containing founder business data; a data-subject erasure request
requires deleting it. Three options are set out in document 15 §12, none chosen — it needs
legal input. **It should be settled before real founder data accumulates**, since retrofitting
a retention model is materially harder than choosing one now.

**`DOCUMENT_MANIFEST.md` rebuilt** — all 15 documents with status, version, implementation
status, local path, Notion URL, Drive location, dependencies, related documents, ADRs and
evidence, plus the critical path and a consolidated blocker table.

### AI Architecture — document 3 + ADR-0016 · 2026-08-07

**Added**

- `docs/architecture/coordinator-agent-specification.md` — **Coordinator Agent Specification
  v2.0**, superseding the Notion v1.0.
- `docs/decisions/ADR-0016-long-running-ai-workflow-execution.md` — **accepted**.
- Launch Plan Architecture gains **§7A Execution Strategy**: generation → approval →
  execution → monitoring → regeneration.

**ADR-0016 — the execution foundation**

> A workflow is a **state machine in PostgreSQL**, not a running process. Each worker
> invocation advances it by exactly **one step**.

That single constraint delivers everything else: every invocation is short (so serverless
limits stop mattering), every completed step is durable, and resuming is just reading a row.
Retries are per-step with a 3-attempt budget; cancellation is cooperative and checked between
steps, never mid-inference; `(workflow_run_id, sequence_no)` is unique, so a retry that
partially wrote is rejected rather than duplicated.

**Partial results are always retained.** A run that fails at Funding still holds validated
Compliance output — the founder is told what _was_ determined, never shown a blank failure.

A durable-execution vendor (Inngest, Temporal) was rejected for v1: it introduces a third
party processing founder data, which is material for a platform naming government agencies as
partners. The state machine is the contract, so migrating later would not change agent code.

Resolves R-12 (raised 2026-08-05) and Launch Plan open question L1.

**Launch Plan §7A — approval is now a state**

A generated plan is a **proposal, not an instruction**. It waits for founder acceptance,
grounded in the Constitution's _Human Agency_ article: a plan that silently becomes "your
plan" implies an authority the platform does not have.

The consequential rule: **an approved plan is never silently replaced.** If a founder is
mid-execution and the law changes, the new version enters `ready` while the approved version
stays `active` until they accept it. The ground does not move under someone without consent.

Monitoring also gained a third watcher that is easy to overlook and matters most: when the
Knowledge Pack _gains_ coverage in a domain that previously returned nothing, the founder's
plan was incomplete and can now be improved. **This is the only mechanism the platform has for
correcting an omission after the fact.**

**Coordinator v2.0 — two material changes**

1. **The Coordinator plans; it no longer executes.** v1.0 had it "launch agents" and "assemble
   the package" — an orchestrator inside a request, which ADR-0016 makes impossible. It is now
   step 1 of the run, emitting an Execution Plan that the runner executes. Smaller, testable,
   and resumable, because the routing decision becomes durable data.
2. **Clarification contradiction resolved.** v1.0 required both "no human-facing explanation"
   and "asks a clarifying question". Now: a structured request with a `prompt_key` referencing
   product-owned copy. The agent writes no prose, so founder-facing language stays reviewable
   and an agent cannot invent a question implying a requirement.

⚠️ **`classification_confidence` is explicitly NOT a trust dimension** — never surfaced, never
written to `trust_level`/`trust_score`. Stated outright because that is exactly how a fifth
scale would creep back in after ADR-0015 fixed the four.

⚠️ **The Coordinator decides what "complete" means.** Its `knowledge_domains` list is the
expectation coverage is assessed against, making under-declaration the highest-leverage failure
in the system — every other failure produces wrong-_looking_ output, while this one produces
output that looks **right** and is incomplete. Mitigated by making domain derivation
**rule-based, not model-chosen**, with a ≥ 99% recall target.

**Closed:** open question **Q-S2** — the five `business_stage` values intake has collected
since Sprint 1 Phase 6 are adopted as the canonical Coordinator vocabulary.

### AI Architecture — document 2: Launch Plan Architecture · 2026-08-07

**Added**

- `docs/architecture/launch-plan-architecture.md` — **Launch Plan Architecture v1.0**.

Defines the artefact the whole platform exists to produce. Three decisions shape it:

- **A plan is a versioned snapshot, not a mutable document.** A founder who registered a
  company in March acted on March's plan; if the law changed in June they must be able to see
  both. Regeneration creates a version and never overwrites.
- **Founder progress is separate from generated content.** Tasks are matched across versions
  by a stable identity key derived from `(category, agency, normalised title)`, not database
  ID. A completed task that disappears from a new version is **retained and flagged "no
  longer required", never silently deleted** — the founder did the work and may have paid for
  it.
- **Absence is stated.** `⚪ UNKNOWN` items appear as first-class entries at _high_ priority,
  because an absent requirement is indistinguishable from one that does not exist, and that
  ambiguity is where founders get hurt.

Also specified: deterministic topological ordering **outside the model** (sorting a DAG has
exactly one correct answer and does not need a language model), fees and deadlines as `null`
rather than estimated when unpublished, and a founder-visible diff after every regeneration.

### AI Architecture — ADR-0015 ratified · 2026-08-07

**Changed — founder ratification with two refinements**

- **Four independent dimensions**, not three: **Source Authority** (a document) ·
  **Evidence Strength** (a passage↔claim link) · **Reasoning Confidence** (an inference) ·
  **Coverage Confidence** (a set). Trust Level and Trust Score are **derived** from these,
  not dimensions themselves.

  Evidence Strength was the founder's addition and it closes a real gap: the original model
  scored "a highly authoritative document that mentions a topic in passing" the same as "a
  document that states the claim explicitly". Fabrication hid in exactly that space.

- **🟢 VERIFIED now requires Source Authority ≥ 4** — legislation and regulations only.
  Official government guidance can produce 🟡 DERIVED at most. ⚠️ **This has a direct
  consequence for Phase 3:** the Knowledge Pack must contain actual statutory instruments,
  not only agency guidance pages, or nearly every requirement will render as DERIVED and the
  platform will appear far less certain than it is. Now a requirement on document 5.

- **Coverage Confidence is computed and stored but not displayed in v1.** Binding
  consequence: because founders are not told a list may be incomplete, the product must not
  imply that it is — copy must say _"Requirements we found"_, never _"Your complete
  requirements"_. Constitution Article VII makes this mandatory, not stylistic.

**Applied to canonical documents** (previously specified but withheld pending ratification):

- **Knowledge Architecture** — "Confidence Levels" renamed to **Source Authority**, level 3 →
  "official government guidance", level 2 → "government-supported publication", plus the
  statutory-sourcing consequence.
- **AI System Architecture** — its 1–5 scale **removed**. Its level 3, "verified from multiple
  government sources", was a _reasoning_ property mislabelled as a _source_ property — which
  is precisely why it conflicted with the other two scales. Now expressed as Reasoning
  Confidence and the DERIVED classification.
- **Research Agent Specification** — unchanged; its scale is canonical.

**`DOCUMENT_MANIFEST.md` expanded** with implementation status, dependencies, related
documents, ADRs, evidence references and documentation locations for all 15 series documents,
plus the critical path (1 → 5 → 4 → 3 → 2, with 7 gating any claim that the system works).

### AI Architecture documentation · 2026-08-07

**Added**

- `docs/architecture/DOCUMENT_MANIFEST.md` — permanent register of every architecture
  document with status, version, Notion URL, local path, Drive location, owner, related
  documents, ADRs and evidence files. **A document not in the manifest is not canonical.**
- `docs/architecture/trust-layer-specification.md` — **Trust Layer Specification v1.0**
  (document 1 of 15 in the AI Architecture series).
- `docs/decisions/ADR-0015-unified-trust-confidence-model.md` — ⏳ proposed, awaiting founder
  ratification.

**Architectural conflict resolved (pending ratification)**

Four canonical documents defined confidence and no two agreed. Root cause identified: the
three 1–5 scales were measuring **two different things** through one number — _source
authority_ (a property of a document) and _reasoning depth_ (a property of a claim). The AI
System Architecture's level 3, "verified from multiple government sources", is a reasoning
property; the other two scales' level 3 is a source property. They were never the same scale.

Resolved by separating the dimensions and adopting the existing scale that measures each —
**nothing invented**, per the Codex's canonical rule. The Research Agent Specification's scale
becomes canonical unchanged; Knowledge Architecture and AI System Architecture require the
edits specified in ADR-0015 §"Required document changes". **Those edits are specified but not
applied** — see ADR-0015.

Two internal contradictions in the Trust Layer framework also resolved: `RECOMMENDED` scored
exactly 50 against a "below 50 never shown" rule (threshold now `< 50`, exclusive), and
`UNKNOWN` carried no score but was displayed (now explicitly exempt).

**New architectural concept — Coverage Confidence**

The specification introduces a second, independent dimension addressing the platform's most
severe unmitigated risk: **omission**. Every prior safeguard defends against fabrication. None
defended against a checklist in which every item is real, every citation valid, every badge
🟢 VERIFIED — and which silently omits a required permit. Per-item trust cannot express this
because each item is individually correct; completeness is a property of the set.

Coverage recall is now named as the metric that determines whether the platform works, and as
the primary blocker to advancing beyond TRL 2.

### Phase 8 — Hardening · 2026-08-07 · **Sprint 1 complete**

**Added**

- `lib/logger` — structured JSON logging, vendor-agnostic (ADR-0014). Emits `correlationId`,
  `operation`, `durationMs` and `code`, and **redacts PII including the founder's free-text
  intake answers**. `timed()` records execution time so no caller can forget the documented
  requirement. All raw `console.*` in `app/`, `services/` and `lib/` replaced.
- `tests/e2e/sprint1-journey.spec.ts` — the full Sprint 1 Definition of Done, including the
  critical assertion: leave intake mid-flow, navigate away, return, and find the answer still
  there.
- `tests/e2e/accessibility.spec.ts` — automated WCAG 2.1 AA checks across 8 routes plus a
  keyboard-reachability test asserting the skip link is the first tab stop. CI job added.
- `supabase/seed.sql` — **reference data only**. No business, compliance or funding data is
  seeded: a seeded "Business Licence requirement" is indistinguishable from a real one to
  anyone looking at the screen, including us during a demo.
- ADR-0014; Sprint 1 completion report in `docs/evidence/`.

**Audited**

- **Accessibility (static):** no unlabelled inputs, no images without alt, no icon-only
  buttons without accessible names, correct landmark and heading structure. Five initial
  grep hits were verified as false positives — each element receives the `aria` spread from
  `Field` or carries an explicit label.
- **Error messages:** every one of the 19 `humanMessage` strings is plain and non-technical.
  No `developerMessage`, stack trace, or provider error is rendered anywhere.

**Known gaps at Sprint 1 close**

Playwright has never executed · no `axe` run performed · CI has never run · email delivery
untested · no performance testing · no screenshots or demo. Rate limiting, MFA, breached-password
screening and data residency remain unspecified in the architecture.

### Phase 7 — Dashboard & Settings · 2026-08-07

**Added**

- `services/progress` — derives a single "what should I do next" answer from real state.
  **Unbuilt capabilities are marked `blocked`, not `upcoming`**, and are excluded from the
  progress calculation. Counting them would leave the platform permanently showing ~40%
  regardless of what the founder does, and offering an action they cannot take.
- Dashboard journey view with milestone states, real progress bar, and the next action.
- Account profile editing (`services/profile`), business rename, and business archiving with
  a confirmation step — archiving is the only removal path, since no `DELETE` policy exists.
- 8 new unit tests (102 total across 10 files), including an assertion that no milestone
  promises data that does not exist.

**Design note**

The archive confirmation exists because the action is destructive _from the founder's point
of view_ even though no data is deleted. The copy says so explicitly rather than implying
permanence.

### Phase 6 — Founder Intake · 2026-08-07

**Added**

- Five-step intake wizard (business description, stage and location, team, funding, goals)
  with per-step validation and a progress indicator.
- **Draft persistence on every step.** Each submit writes immediately, so closing the browser
  mid-flow loses nothing (acceptance criteria C3/C4). Resumability is a data property, not UI
  polish.
- Resume logic that refuses to jump ahead of what has been answered — a later step would have
  nothing to resume from. Junk step parameters clamp into range.
- Review screen with per-answer edit links, and intake completion advancing the business to
  `intake_complete` through the ADR-0007 state machine.
- Dashboard now shows real intake progress and the correct next action.
- 30 new unit tests (94 total).

**Fixed**

- `tests/unit/business-lifecycle.test.ts` asserted on `Error.message`, which is deliberately
  the _developer_ message. Audited every founder-facing path first: `fail()` serializes only
  `humanMessage`, the UI renders the `Result`'s message, and `assertTransition` reaches users
  solely via `archiveBusinessAction` → `flatten` → `fail`. The implementation was correct, so
  the test was strengthened rather than relaxed — it now asserts the founder-safe message,
  that developer context is preserved internally, and that **nothing technical survives
  serialization to the client**.

**Design notes**

- Funding amount is genuinely optional. Forcing a number would fabricate data the Funding
  Agent would later treat as real; "I don't know" must be representable.
- Funding currency is derived in the service from the business's country, never typed by the
  founder, so it cannot disagree with the `bp_funding_currency_required_with_amount`
  constraint.
- ⚠️ `business_stage` values are still undefined in canonical documentation (open question
  Q-S2). The five values used are generic business language, not a regulatory
  classification, and are stored as free text so they can change without a migration. **They
  must be confirmed before the Coordinator Agent consumes them**, or the agent contract will
  drift.

**Verified live** (as an authenticated founder, under RLS)

```
create business            -> status=draft
create intake profile      -> last_completed_step=0
save step 1                -> 200  (draft persisted)
amount without currency    -> 400  (constraint correctly rejects)
amount + derived currency  -> 204
advance to intake_complete -> 204
duplicate intake profile   -> 409  (1:1 enforced)
archive                    -> 204
hard DELETE attempt        -> 403  (no DELETE policy exists)
```

- The layer-boundary lint caught three `app/ → lib/db` violations during this phase. All were
  fixed by exposing reads through `services/` and centralizing types, never by relaxing the rule.

### Phases 4 & 5 — Application Shell and Business Creation · 2026-08-07

**Added**

- **Application shell**: sticky header with business selector and user menu, sidebar
  navigation, responsive mobile nav, skip-to-content link, per-segment loading skeleton and
  error boundary.
- Navigation lists not-yet-built routes as visibly disabled rather than hiding them or
  linking to dead ends — the founder can see where the product is going without being misled.
- **Business creation**: `services/business` with the ADR-0007 lifecycle state machine,
  `lib/db/businesses` repository, Zod contracts, and Server Actions for create, rename,
  archive and select.
- Business selector backed by an httpOnly cookie. The cookie is a _hint, not an
  authorization token_: every read re-checks it against the RLS-scoped list, so a foreign or
  stale ID silently falls back rather than selecting another tenant's business.
- Settings page (account details, business rename), and placeholder routes for intake,
  timeline, compliance, funding, documents and Nova.
- `components/ui`: Card, EmptyState, Select, Badge. `EmptyState` requires an explanation and
  a next step — "No data" is not expressible through it.
- `types/business.ts` — centralized domain types so `app/` and `components/` can name a
  business without importing the data-access layer.
- 21 new unit tests (64 total) covering lifecycle transitions, cookie resolution and
  business validation.

**Fixed**

- `lib/env.ts` threw a raw `TypeError` ("Invalid URL") instead of a validation error on a
  malformed Supabase URL. Zod 4 runs refinements even after an earlier check fails, so the
  unguarded `new URL()` escaped `safeParse`. Now guarded; the reported test failure is
  resolved and four regression tests cover it.
- Corrected `NEXT_PUBLIC_SUPABASE_URL`, which carried a `/rest/v1/` suffix and caused every
  Supabase request to 404 against tables that exist. Validation now rejects any path at boot.

**Security**

- Layer-boundary lint caught `app/` importing a type from `lib/db` during this phase; fixed
  by centralizing the type rather than relaxing the rule.
- Business status transitions are enforced in the services layer. The database enum
  constrains the vocabulary; only this state machine prevents a business skipping intake.
- Audit events recorded for `business.created`, `business.updated`, `business.archived`.
  Verified functional end-to-end: `audit_log` write returned 201, anon read still 401, and
  the append-only trigger still rejects `service_role` UPDATE with 403.

**Known gaps**

- `next build` and Vitest **cannot run over the mounted filesystem** — both crash with
  `Bus error (core dumped)` (SIGBUS from memory-mapped I/O on a network mount) or hang.
  Typecheck and lint pass; the full gate must be run locally on Windows.
- Playwright still cannot run in the agent environment.

### Phase 3 — Authentication · 2026-08-05

**Added**

- Email/password authentication: sign up, sign in, sign out, password reset request, and
  password reset completion — all as Server Actions (ADR-0003).
- `proxy.ts` (Next.js 16.3 replaces the `middleware` convention) — refreshes the session on
  every navigation and enforces route protection across 8 protected prefixes.
- Defence in depth: the `(app)` layout re-checks authentication server-side. Middleware can
  be disabled by a matcher change; the layout check cannot.
- `/auth/callback` route handler exchanging email-confirmation and recovery codes for a
  session — a GET navigation target from an email, which is the documented REST exception.
- Application Services layer: `services/auth` and `services/audit`. Server Actions validate
  and delegate; they hold no business logic.
- `lib/errors` — typed errors carrying a **human message** (safe to render) separately from
  a developer message (never rendered), plus a correlation ID surfaced to users as a support
  reference.
- Auth Zod schemas (ADR-0005) and per-field error mapping.
- Minimum UI primitives against the existing token layer: Button, Input, Field, Alert.
  `Field` wires label, description and error via `aria-describedby` / `aria-invalid`.
- Audit logging of `auth.registered`, `auth.signed_in`, `auth.signed_out`,
  `auth.password_reset_requested`, `auth.password_reset_completed`.
- 34 new unit tests (43 total) and an 11-case Playwright auth suite.
- ADR-0012 (audit write path and fail-open policy), ADR-0013 (password policy).

**Security**

- **Open-redirect protection** on the post-sign-in `next` parameter and on `/auth/callback`.
  A user who has just entered credentials is maximally phishable, so this is treated as a
  security control and covered by 12 dedicated tests.
- **No user enumeration.** Wrong credentials return "That email or password is incorrect";
  password reset always reports success regardless of whether the account exists.
- Passwords: 12-character minimum, no composition rules, 72-byte cap (ADR-0013).
- `getUser()` used for every authorization decision — never `getSession()`, which only reads
  a cookie and can be spoofed.
- Supabase provider error strings are translated to our own vocabulary and never surfaced.
- No PII in audit metadata.

**Changed**

- `middleware.ts` → `proxy.ts`; `lib/supabase/middleware.ts` → `lib/supabase/proxy-session.ts`
  (Next.js 16.3 deprecation).
- Landing page now links into the real auth flow.

**Known gaps**

- `SUPABASE_SERVICE_ROLE_KEY` is not configured, so **audit events are not being recorded**.
  The service logs an explicit error rather than failing quietly (ADR-0012).
- Playwright cannot run in the current environment (missing `libXdamage.so.1`, needs root).
  The auth E2E suite is written and wired into CI but has **not** been executed. The same
  behaviour was instead verified at the HTTP layer against the running app with a real
  session — see the Phase 3 evidence record.
- Breached-password screening and MFA are not enabled and are unspecified in the architecture.

### Documentation Operations · 2026-08-05

**Corrected**

- **The FoundryAI Codex exists.** It was reported missing during Sprint 1 planning because it
  was absent from the synced engineering Knowledge base, not from the workspace. Located in
  Notion, read, and confirmed not to conflict with any decision taken. The Codex is a
  structural contents index; no rework was required.

**Added**

- `docs/evidence/` — dated verification records for schema and tests.
- `CHANGELOG.md` — this file. The Master Documentation Index requires a change log in every
  document; none existed.

**Synchronised to Notion** — Database Architecture (3 corrections + implementation status),
Security Architecture (authorization model corrected to user-owned tenancy, plus function
security and audit integrity sections), Development Roadmap (Phase 1 status), API
Architecture (Server Actions decision rule), Engineering Standards (enforcement mechanisms),
Frontend Architecture (directory structure extension), Claude Code Master Context (layer
boundaries + ADR register), Master Documentation Index (repository documentation section +
status corrections), Trust Layer (confidence-scale conflict flag + Learning Layer
reclassified as concept). Created: Sprint Notes, Development Journal, TRL Evidence Register.
Appended: Buildathon Logbook Entry 001.

**Synchronised to Google Drive** — schema verification evidence (`04 Database`), test results
(`13 Buildathon/Judging Evidence`), TRL assessment (`13 Buildathon/TRL Evidence`),
engineering log (`09 Daily Log`).

### Phase 1 — Data Foundation · 2026-08-05

**Added**

- Sprint 1 database schema applied to Supabase (`20260805120000_sprint1_foundation`):
  `countries`, `profiles`, `businesses`, `business_profiles`, `audit_log`.
- `app.business_access(uuid)` — the single ownership predicate for every business-owned
  table. Introducing organisations later is a change to this one function body.
- `business_status` enum implementing the approved lifecycle: `draft` → `intake_started`
  → `intake_complete` → `launch_plan_generated` → `active` → `archived`.
- Append-only `audit_log` enforced by trigger, so it holds against roles carrying
  `BYPASSRLS` — not by privilege revocation alone.
- `app.handle_new_user()` trigger guaranteeing every `auth.users` row has a profile.
- 9 RLS policies across 5 tables. **No `DELETE` policy anywhere** — deletion is impossible
  through the API by design.
- Generated `types/database.ts` and a `db:types` script.
- `tests/rls/` — 30 tenant-isolation tests running against a live database with two real
  authenticated sessions.
- CI job for the RLS suite with `RLS_TESTS_REQUIRED=1`, so a missing configuration fails
  rather than silently skipping a security suite.
- `docs/architecture/schema-design.md`, `er-diagram.md`, `schema-future-phases.sql`.
- `docs/evidence/` — schema verification and test results.
- ADR-0008 (primary keys), ADR-0009 (RLS policy pattern), ADR-0010 (identity ownership),
  ADR-0011 (controlled denormalization for RLS).

**Security**

- `FORCE ROW LEVEL SECURITY` on all four user-data tables, so RLS is not bypassed by the
  table owner during maintenance.
- Both `SECURITY DEFINER` functions pin `search_path = ''`, closing the shadowing
  privilege-escalation vector.
- Helper functions isolated in a private `app` schema, which PostgREST does not expose.
- Grants revoked from `anon` on every table; verified by live HTTP returning `42501`.

**Known issues**

- Pre-existing `public.rls_auto_enable()` is `SECURITY DEFINER` and executable by `anon`.
  Assessed LOW risk (event-trigger functions cannot be invoked via RPC). **Not modified** —
  outside Sprint 1 scope, awaiting founder approval.
- One permanent probe row exists in `audit_log` from append-only verification. It cannot be
  removed without the purge procedure, which is not yet defined (Q-S4).

---

### Phase 0 — Foundation & Engineering Workflow · 2026-08-05

**Added**

- Next.js 16.3 App Router · React 19.2 · TypeScript 5.9 (strict) · Tailwind 4.3 ·
  Zod 4.4 · Vitest 4.1 · Playwright 1.62.
- ESLint flat config enforcing three architectural layer boundaries as **build failures**:
  `app/` ✗ `lib/db`; `lib/ai/` ✗ `lib/db` and `services/`; `components/` ✗ `services/`.
- `lib/env.ts` — Zod-validated environment, fail-fast at boot.
- CI: typecheck → lint → format → test → build, plus E2E and dependency-audit jobs.
- PR template mirroring the Engineering Standards code review checklist.
- `README.md`, `CONTRIBUTING.md`, `CLAUDE.md`.
- ADR-0001 through ADR-0007.

**Changed**

- ESLint pinned to 9.39.5 rather than 10.x: npm was silently overriding a peer conflict
  with `typescript-eslint@8`. Correctness over recency.
- TypeScript pinned to 5.9.x rather than 7.x, which is not yet verified against the
  Next.js and ESLint toolchains. A deliberate future upgrade, not an incidental one.
