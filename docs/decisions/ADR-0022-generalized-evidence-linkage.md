# ADR-0022 — Generalized Evidence Linkage

**Date:** 2026-09-12 · **Status:** Accepted for implementation (documentation only — no code, schema, or migration change)

## Context

The P0–P7 architecture audit and the subsequent P8 design pass found that business
facts already exist across several independent domains — `business_metrics`,
`business_documents`, `business_goals`, `business_cases`, and the
`business_regulatory_requirements` per-business join into the dormant
`regulatory_*` domain — but the relationships between them are fragmented into
one-off, single-purpose foreign keys:

1. `business_metrics.source_document_id` → `business_documents` (a metric may
   name the one document it came from).
2. `regulatory_requirement_evidence` → `knowledge_chunks` (a global
   `regulatory_requirements` row may cite the chunk that substantiates it in
   law).

No mechanism today lets a business's own document evidence a regulatory
requirement, a goal, or a case. `regulatory_requirement_evidence` cannot fill
this role — it is a **global, authoring-scoped** table (RLS restricted to
`status = 'published'`, no `business_id`, no `authenticated` write path) that
answers "which published chunk substantiates this requirement's existence in
law," not "which of _this business's_ documents evidences _their_ progress
toward it." These are different questions on different axes (global authoring
vs. per-business fact), and this ADR does not conflate them.

This is the single highest-leverage gap identified across the audit: it
independently blocks Business Passport (§ below), compliance activation,
future document intelligence (P9), and institutional/advisor review, all for
the same underlying reason.

## Decision

Introduce one canonical evidence entity and a small, closed set of typed
subject-link tables, using **Option C (evidence entity + typed
subject-relationships)** deployed via the **Option D hybrid strategy**
(existing narrow relationships are retained, unchanged, alongside the new
mechanism).

### `business_evidence`

```
business_evidence
  id                  uuid primary key
  business_id         uuid not null references businesses(id)
  document_id         uuid references business_documents(id)      -- nullable
  knowledge_chunk_id   uuid references knowledge_chunks(chunk_id)   -- nullable
  provenance          fact_provenance not null
  verification_state  verification_state not null default 'unverified'
  retracted_at        timestamptz
  actor_id            uuid not null references auth.users(id)
  created_at          timestamptz not null default now()

  check (
    (document_id is not null)::int + (knowledge_chunk_id is not null)::int = 1
  )
```

`business_id` records **whose evidence-usage this is**, not who owns the
underlying source — this matters for the `knowledge_chunk_id` arm, since
knowledge chunks are global, not business-owned. The exclusive-arc CHECK
requires **exactly one** source column to be populated: never zero, never
both. This is a well-established, fully relational alternative to a
polymorphic reference — every source is a real, DB-enforced foreign key, and
the set of permitted sources is closed and explicit rather than an open,
untyped discriminator.

Composite-FK same-business invariant, following the pattern already ratified
in ADR-0011: where the source is a document, the constraint is declared as

```
foreign key (business_id, document_id)
  references business_documents (business_id, id)
```

so a mismatched `(business_id, document_id)` pair is unrepresentable, not
merely unexpected. No equivalent constraint is needed on the
`knowledge_chunk_id` arm — chunks are global and their own RLS already governs
what a business can legitimately have seen.

### Typed subject-link tables

Four tables, one per subject domain in P8's scope:

```
business_evidence_for_metrics       (business_id, evidence_id, metric_id,       relationship, actor_id, created_at)
business_evidence_for_goals         (business_id, evidence_id, goal_id,         relationship, actor_id, created_at)
business_evidence_for_cases         (business_id, evidence_id, case_id,         relationship, actor_id, created_at)
business_evidence_for_requirements  (business_id, evidence_id, requirement_id,  relationship, actor_id, created_at)
                                                                 -- requirement_id → business_regulatory_requirements(id)
```

Each carries **two** composite foreign keys, both anchored to the same single
`business_id` column on that row:

```
foreign key (business_id, evidence_id) references business_evidence (business_id, id)
foreign key (business_id, metric_id)   references business_metrics  (business_id, id)   -- (per table's subject)
```

### Why typed subject links, not a polymorphic subject id

A polymorphic `subject_type text, subject_id uuid` pair was evaluated and
rejected. Postgres cannot express a foreign key whose target table is decided
by the value of a sibling column — `subject_id` would be referentially
unenforced, making it possible (at the database level) for a link row to point
at a subject that never existed or belongs to a different business, detectable
only by application code, if at all. RLS on such a table would need to branch
per `subject_type` inside every policy, which is exactly the "RLS that is
impossible to reason about" this design is required to avoid. Typed subject
tables cost one additional `CREATE TABLE` per subject domain — a normal,
additive migration, fully consistent with how every other domain in this
schema has always grown — in exchange for full, DB-enforced referential
integrity and a uniform, mechanically reviewable RLS shape identical to every
other table in the system.

## Relationship semantics

P8 introduces exactly one new enum, `evidence_relationship_type`, with exactly
two values:

- **`supports`** — the evidence corroborates a fact or claim that was already
  asserted independently of it (e.g. a founder manually attaches an existing
  licence document to a `business_regulatory_requirements` row they already
  believe applies to them).
- **`derived_from`** — the fact would not exist, or would not have this exact
  value, without the evidence (e.g. a future P9-confirmed metric whose value
  came directly from parsing the attached document).

The distinction matters now, before P9 exists, because P8's own vertical slice
(§ Regulatory vertical slice) uses `supports`, while P9's confirmation flow
will need `derived_from` — reserving the second value today costs nothing and
avoids a later enum migration for a value whose need is already known.

**Explicitly deferred, not built:**

- **`verifies`** — would mean an evidence item independently confirms a claim
  is true, which only makes sense once a genuine verifying actor exists (an
  advisor, an external data check). P8 has no such actor. An unused enum value
  today would be decoration, not architecture.
- **`contradicts`** — meaningful only once something consumes it (change
  detection / monitoring, P11). Nothing in P8 detects or acts on conflicting
  evidence.
- **`related_to`** — a semantically empty catch-all. Every other vocabulary in
  this schema (`fact_provenance`, `verification_state`, the regulatory state
  enums) is deliberately narrow and exhaustive; a generic "related" value would
  become a dumping ground and erode that discipline. Deferred indefinitely
  unless a genuine, specific use case appears — not built merely because the
  audit's original list of candidate relationships included it.

## Existing relationships retained

`business_metrics.source_document_id` and `regulatory_requirement_evidence`
are **retained unchanged and are not deprecated.**

- `source_document_id` already correctly models the single most common case (a
  metric's originating document), already carries a composite same-business
  FK, and already has test coverage. Migrating existing rows into the new
  mechanism for a purely cosmetic convergence would be churn with no
  functional benefit. A future read that needs "all evidence for this metric"
  simply reads both sources and presents them together — the two mechanisms
  coexist by design, not by omission.
- `regulatory_requirement_evidence` continues to serve its distinct,
  authoring-time purpose (substantiating a global requirement's existence in
  law against the knowledge corpus) and is untouched by this ADR. Nothing
  about generalized business evidence changes how requirements are authored.

## Authorization / RLS

No new authorization concept is introduced. Every new table's RLS is written
against the same seam every other business-owned table already uses:

```
using (app.business_access(business_id))
```

- **`business_evidence`** — `select`/`insert`/`update` to `authenticated`,
  gated by `app.business_access(business_id)`. `update` exists only so
  `verification_state` and `retracted_at` can change later; no other column is
  expected to be mutated after insert.
- **`business_evidence_for_*`** — `select`/`insert` only, same gate. **No
  `update`** — a link, once made, is immutable; changing a relationship means
  adding a new link row, which incidentally leaves a free, already-ordered
  history behind for any future monitoring work to read.
- **No `delete` policy on any new table**, consistent with the system-wide
  posture (ADR-0009). Removal is `retracted_at`, never a row deletion —
  identical in spirit to how every other table in this schema treats
  archival, not erasure, as the only removal mechanism.
- **Cross-business attachment is impossible by construction, not by policy
  discipline alone.** Each `business_evidence_for_*` row carries exactly one
  `business_id` column, and both of its composite foreign keys — to
  `business_evidence` and to the subject table — are anchored to that same
  column. There is no way to construct a row where evidence from business A is
  linked to a subject from business B, because doing so would require the one
  shared `business_id` value to simultaneously match two different owners.
- **Future advisor/institution access** requires zero changes to any table or
  policy introduced by this ADR. ADR-0021 documents the exact extension:
  `app.business_access()` gains an `OR EXISTS(...)` branch against a future
  `business_access_grants` table. Because every policy here calls that same
  function and nothing else, an advisor grant becomes visible across the
  entire evidence model the instant that function changes — no second
  authorization system, no table left behind.

## Provenance

`business_evidence.provenance` and `.verification_state` reuse the existing
`fact_provenance` and `verification_state` enums exactly as they are used
everywhere else in the schema (`business_metrics`, `business_documents`,
`business_goals`, `business_identifiers`). No new provenance vocabulary is
introduced.

**`EpistemicType` (`lib/intelligence/types.ts`) is explicitly not introduced
into this schema.** That vocabulary is an ephemeral, request-time
classification belonging to the P5/P6 intelligence gateway — ten values
(`FACT`, `VERIFIED_FACT`, `FOUNDER_PROVIDED`, `DOCUMENT_DERIVED`,
`EXTERNAL_DATA`, `CALCULATION`, `REGULATORY_EVIDENCE`, `RECOMMENDATION`,
`INFERENCE`, `UNKNOWN`) constructed per Nova request and never persisted.
Coupling a persistent, DB-level relational structure to it would (a) be a
layer-boundary violation — `lib/intelligence/` is scoped to gateway concerns,
not general domain modeling — and (b) force every non-Nova consumer of
evidence (Passport, a future compliance UI) to depend on gateway types for a
question `fact_provenance` already answers correctly and has answered
correctly since P0.

## Actor model

`actor_id` means **creator** — who inserted the row — consistently with how
`audit_log`, `ai_usage`, and `agent_executions` already use `actor_id` today.
It is explicitly **not** "last modifier"; if a "last modified by" need ever
arises, that is a separate, additively-named column, never an overload of this
one.

- On the four new tables introduced by this ADR, `actor_id` is `not null` from
  the first row — there is no legacy-data problem to accommodate.
- Adding `actor_id` to the pre-existing `business_metrics`, `business_goals`,
  and `business_documents` tables is **explicitly out of scope for this
  ADR's schema** and, if pursued, must be **nullable** — historical rows
  predate any actor-tracking concept and cannot be honestly backfilled to a
  real user. That work, if undertaken, is an independent, separately-migrated
  change with no dependency on anything in this ADR.

## Passport

`assembleBusinessPassport(businessId)` is a pure, read-only composition
function — in the same style as the existing `assembleIntelligenceContext`
and `buildPerformanceView` — reading across `businesses`, `business_profiles`,
`business_financial_periods`/`business_metrics`, `business_documents`,
`business_goals`, `business_cases`, `business_regulatory_requirements`, and
the new `business_evidence`/`business_evidence_for_*` tables. It introduces no
new persisted state and is not itself a table: every section is composed at
read time from an existing authoritative source, exactly as ADR-0020 already
established for Nova's business context ("Nova gets no separate table/copy").

Evidence and compliance become two additional composed sections — evidence
directly from the new tables, compliance from `business_regulatory_requirements`
once the vertical slice below exists. An "important dates" section (document
expirations, financial period ends, goal target dates, requirement renewal
dates) is included only if it can be composed cheaply from sections that
already exist; it is not a dedicated build priority in its own right. A "Nova"
section is deferred: no Nova pathway persists full answer content today (only
shape/usage metadata survives in `agent_executions`/`ai_usage`), so there is
nothing authoritative yet for Passport to show beyond activity counts, which
is a distinct, smaller feature this ADR does not scope.

## Regulatory vertical slice

The smallest end-to-end scenario that proves this architecture, without
seeding the regulatory domain broadly:

1. One real `regulatory_requirements` row — an annual Business Licence
   requirement for The Bahamas — created `status = 'draft'`.
2. One `regulatory_requirement_evidence` row linking it to an **already
   published, already existing** `knowledge_chunks` row from the live BS-v0.1
   corpus — no new knowledge ingestion.
3. One `regulatory_applicability_rules` row, `rule_type = 'all'` — the
   narrowest, least error-prone starting rule.
4. The existing, unmodified `evaluateBusinessRequirements()` evaluated for one
   real test business, producing one real `business_regulatory_requirements`
   row (`state = 'applicable'`).
5. A founder attaches their own uploaded licence document as evidence via the
   new mechanism: one `business_evidence` row (`document_id` set,
   `provenance = 'user_document'`) plus one `business_evidence_for_requirements`
   row (`relationship = 'supports'`).

**Engineering must not move this requirement's `status` to `'published'`
without confirmation from someone with actual authority over Bahamian
regulatory content.** Asserting a legal obligation is a different kind of
claim than asserting a schema is correct, and `'draft'` status keeps it
invisible to founders (per the existing `..._read_published` RLS pattern)
until that confirmation happens.

## P9 boundary

This ADR reserves no column, source arm, or table for P9. P9 (Document
Intelligence) will introduce its own, independent `business_extraction_candidates`
table with a `pending_review | confirmed | rejected` lifecycle. An extracted
value only becomes an authoritative business fact — a real `business_metrics`
row with `provenance = 'user_document'` — after **explicit founder
confirmation**; nothing in the extraction step itself writes to
`business_metrics`, `business_evidence`, or any table this ADR introduces.

When P9's candidate table exists, it will extend `business_evidence`'s
exclusive arc with **one additive migration**: a new nullable
`extracted_candidate_id uuid references business_extraction_candidates(id)`
column, plus a corresponding update to the CHECK constraint (from "exactly one
of two" to "exactly one of three"), following the same drop-and-recreate
pattern already used in this codebase for evolving a constraint after the
fact (see the P7.1 owner-integrity policy fix). No table introduced by this
ADR needs to be altered beyond that single column and CHECK update, and none
of the four subject-link tables are touched at all.

### Option A vs. Option B for `extracted_candidate_id` — Option B selected

The read-only design phase proposed reserving `extracted_candidate_id uuid`
now, with no FK, against a table that does not yet exist. On review, this is
rejected in favor of **omitting the column entirely from P8**:

- A nullable `uuid` column with no FK is exactly the "application-only
  referential integrity" this architecture is built to avoid elsewhere — it
  would look like a reference without being one, inviting a future write to it
  before any constraint exists to catch a mistake.
- It buys no real migration savings: P9 must alter the CHECK constraint
  regardless of whether the column pre-existed, since the constraint's
  semantics change either way.
- It forecloses design flexibility for a table that has not been designed yet.
  P9's extraction-candidate model may not even end up shaped as a single
  `uuid`-keyed table — pre-committing to that shape now is a speculative
  schema commitment with no offsetting benefit.
- No precedent for a reserved, FK-less "future reference" column exists
  anywhere in the current schema (15 migrations, reviewed). The closest
  analogous placeholder — `lib/ai/providers/embedding.ts` — is a TypeScript
  interface with no implementation, not a database column masquerading as a
  constraint; it carries no relational-integrity risk because it isn't part
  of the relational schema at all. That precedent does not transfer here.

## Migration strategy

Strictly additive; no destructive step at any stage.

1. `evidence_relationship_type` enum (`supports`, `derived_from`).
2. `business_evidence` table — two-arm exclusive-arc CHECK
   (`document_id` / `knowledge_chunk_id`), RLS, no `delete` policy,
   `actor_id not null`.
3. Four subject-link tables — composite-FK same-business invariant, RLS, no
   `delete` policy, `actor_id not null`.
4. _(Separable — no dependency on steps 1–3)_ optional, nullable `actor_id`
   added to `business_metrics` / `business_goals` / `business_documents`.
5. Service layer (`services/evidence/`) — attach/read functions, following
   existing service conventions (RLS-scoped client, audit event on write).
6. RLS test suite additions proving cross-business rejection, exclusive-arc
   enforcement, and the absence of any delete path — mirroring the structure
   of the existing `tests/rls/*.test.ts` files.
7. Regulatory vertical slice (§ above) — one requirement, one applicability
   rule, one chunk-evidence row, evaluated against one real test business.
8. `assembleBusinessPassport` composition service — no new schema.
9. Full regression verification (typecheck, lint, prettier, unit, RLS, build)
   before any staging or commit.

## Alternatives considered

1. **Generic polymorphic subject/evidence table** (`subject_type`,
   `subject_id`, `evidence_type`, `evidence_id`, all bare `uuid`). Rejected:
   no foreign key is possible on the polymorphic columns, referential
   integrity becomes application-only, and RLS would need to branch per type
   inside every policy — the exact "RLS that cannot be reasoned about" this
   design must avoid.
2. **Typed association tables per (subject, evidence-source) pair, with no
   shared evidence entity** (e.g. `metric_document_evidence`,
   `goal_document_evidence`, `metric_chunk_evidence`, ... one table per
   combination). Relationally sound, but grows combinatorially: every new
   evidence _source_ multiplies against every existing _subject_ type. Its
   per-table RLS simplicity is preserved in the selected design by applying
   the same principle one layer up — a subject-link table per subject type,
   pointing at one shared evidence entity, rather than one per pair.
3. **Evidence entity + typed subject-relationships (selected, via the hybrid
   rollout).** See Decision.
4. **Hybrid retaining narrow FKs (selected, as the rollout strategy for 3).**
   Not a competing schema shape — it is the decision to add option 3 alongside
   the existing narrow relationships rather than migrating them away, avoiding
   churn with no functional benefit.
5. **JSON/EAV/event-ledger evidence model** (an append-only "evidence events"
   table carrying a JSON payload, or folding evidence into `audit_log`).
   Rejected: this is the "generic everything blob" this architecture is
   explicitly required not to create, loses queryability and FK enforcement
   entirely, and — for the `audit_log` variant — conflates a fail-open
   telemetry sink with load-bearing relational structure meant to be joined
   and read routinely, not merely inspected during an incident.

## Consequences

**Gained**

- Every evidence relationship is DB-enforced, not application-trusted —
  matching the standard this codebase already holds every other table to.
- A new evidence _source_ (e.g. P9's future extraction candidates) costs one
  nullable column plus one CHECK update on a single table — no subject-link
  table is touched.
- A new _subject_ type (a future domain that can have evidence) costs one new
  typed link table, using an RLS shape identical to every table already in
  this schema — no new RLS pattern to review or reason about.
- Existing narrow relationships (`source_document_id`,
  `regulatory_requirement_evidence`) remain stable and untouched; no
  migration risk is introduced against live data.
- No combinatorial subject × source table growth — the shared evidence entity
  is what prevents this.
- Institutional/advisor access extends across the entire evidence model
  automatically once `app.business_access()` itself is extended (ADR-0021),
  with zero additional changes here.

**Accepted costs**

- Five new tables (one evidence entity, four subject-link tables) where the
  narrower per-pair alternative might have started with fewer, at the cost of
  the combinatorial growth this design avoids as usage expands.
- A new subject type will always require a new migration and a new typed
  table — this is not a "zero code change" seam in the way ADR-0021's grants
  extension is; it is an ordinary, additive schema growth pattern, consistent
  with how every other domain in this system has always been added.

## Non-goals

Explicitly out of scope for this ADR and for P8:

- OCR, extraction, or any document-parsing implementation.
- The `business_extraction_candidates` table itself (P9).
- Seeding the regulatory domain beyond the one vertical-slice requirement.
- Structured multi-step Business Planning (`business_plans`, P10).
- Monitoring, change-detection, or any scheduling/notification infrastructure
  (P11).
- Autonomous execution or action-taking on a founder's behalf (Solvane, P12).
- Billing, subscriptions, or investor-reporting dashboards.
- The `business_access_grants` table or any other institutional-access
  implementation beyond what ADR-0021 already documents.
- Unifying the P1 and P6 Nova pathways, their execution models, or their
  evidence contracts (`NovaEvidenceRef` vs. `EvidenceRef`) — only this ADR's
  persistent evidence model exists; nothing here touches either Nova pathway.
- Persisting full Nova answer transcripts or reasoning content.

## Acceptance criteria

P8's implementation is aligned with this ADR only if:

- No polymorphic identifier column exists anywhere in the new schema.
- Cross-business evidence attachment is impossible at the database level, not
  merely prevented by application logic.
- Evidence provenance is expressed using the existing `fact_provenance` and
  `verification_state` enums — no new provenance vocabulary is introduced.
- No `delete` policy exists on any table introduced by this ADR.
- `business_metrics.source_document_id` and `regulatory_requirement_evidence`
  remain exactly as they are today.
- Business Passport is implemented as a composed read model with no new
  persisted "business truth" table.
- P9's future extraction pipeline cannot cause an unconfirmed value to become
  an authoritative business fact through any path introduced here.
- All existing P0–P7 tests, RLS behavior, and Nova pathway behavior remain
  unchanged.

## Risks

- **Exclusive-arc correctness.** An incorrectly written CHECK constraint
  (permitting zero or more than one populated source) would silently reopen
  the referential-integrity problem this design exists to prevent. Requires
  explicit test coverage, not review alone.
- **Regulatory assertion risk.** Seeding even one real requirement asserts
  something about actual law; mitigated by keeping it `status = 'draft'` until
  confirmed by someone with actual regulatory authority.
- **Table growth as subject domains expand.** Not a reason to introduce
  polymorphism now, but worth revisiting if a fifth or sixth subject type
  appears in rapid succession.
- **Passport materialization drift.** If a future change under time pressure
  gives Passport its own persisted, independently-updatable copy of data it
  should only be composing, it becomes a second source of truth — the exact
  failure mode ADR-0020 already paid down once for Nova's business context.
- **Migration/test complexity at rollout.** Four new tables plus one new enum
  is more surface area than a single table would be; mitigated by every table
  sharing one uniform RLS/FK shape, making the added tests mechanical rather
  than novel per table.

## References

ADR-0006 (tenancy model) · ADR-0009 (RLS policy pattern) · ADR-0011
(controlled denormalization for RLS) · ADR-0012 (audit write path) · ADR-0019
(model provider abstraction — precedent for reserving capability without
building it) · ADR-0020 (intake/knowledge model — "no separate table" Passport
precedent) · ADR-0021 (institutional access extension point) ·
`docs/architecture/business-intelligence-core.md` · P8 read-only architecture
design pass (2026-09-12, private, not yet mirrored to a standalone document).
