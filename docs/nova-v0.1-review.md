# Nova v0.1 — Product & Architecture Review

**Status:** Engineering review — **NOT canonical**, not in `DOCUMENT_MANIFEST.md`
**Date:** 2026-08-23 · **Scope:** Days 1–4 · **Code changed:** none

---

## 1. What Nova can actually do today

Verified by test, not asserted.

| Capability                                                                                                                                     | Evidence                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Resolve a business into a jurisdiction-scoped retrieval context, refusing to infer jurisdiction from free text                                 | `nova/context` 12 tests                         |
| Retrieve from a published Knowledge Pack with deterministic filters **before** ranking — jurisdiction, authority floor, effective date, domain | `nova-retrieval` 20 tests                       |
| Produce a reproducible ordered result set with replay inputs recorded (`knowledgePackVersion`, config versions, query representation)          | `assertRetrievalResultValid`                    |
| Extract a **verbatim** passage per chunk and emit it as a typed claim with `chunk_id` + quote                                                  | `nova/reason` 25 tests                          |
| Refuse in three distinguishable ways, naming what it could not determine                                                                       | `nova/answer-service` 28 tests                  |
| Materialise citations **from the retrieval run**, and reject any claim citing a chunk that run did not return                                  | `assertCitationsGrounded`                       |
| Attach amendment metadata per provision and **withhold** the current legal position when any amendment's commencement is unestablished         | `nova/answer-service`, `nova/view`              |
| Render all of the above accessibly, as marked-up quotations with no synthesised citation fields                                                | `nova/render` 23 tests                          |
| Guarantee no model, no prompt, no provider SDK anywhere in the path                                                                            | `modelVersion: 'none:deterministic-extractive'` |

**~160 Nova-related tests. `tsc` clean. Zero external inference calls.**

The strongest property: **fabrication is impossible by construction.** Every founder-facing sentence is either a substring of a cited chunk or fixed interface copy. That is not a quality target being hit; it is a shape the code cannot deviate from.

---

## 2. What Nova cannot do today

| Cannot                    | Why                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Answer anything           | **No Knowledge Pack is published.** Every question returns `no_published_knowledge`                           |
| Ingest a real source      | No fetcher, no PDF parser, no OCR. `ingestSource` takes pre-made `drafts`                                     |
| Handle paraphrase         | Lexical matching only. "Do I pay tax on takeaway food?" will not match statutory vocabulary                   |
| Remember anything         | No conversation persistence. Each question is an independent run                                              |
| Explain                   | It quotes. It does not simplify, summarise, or translate legalese                                             |
| Assign trust levels       | The Trust Layer is unimplemented. No 🟢/🟡/🔵/⚪ badge is computed or shown                                   |
| Record what it did        | **Nova writes no audit event and no `agent_executions` row.** Auth, business and intake all do; Nova does not |
| Survive abuse             | **No rate limiting anywhere in the codebase**                                                                 |
| Answer across instruments | One claim per chunk. No synthesis across a base Act and its amendments                                        |

---

## 3. Blockers to a real Bahamas demonstration

| #   | Blocker                                    | Severity | Notes                                                                                                          |
| --- | ------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------- |
| D1  | **G11 commercial reuse**                   | 🔴       | _"Any commercial entity is required to obtain permission to reuse the data"_ — gates storage, not just display |
| D2  | Legal verification G1–G6                   | 🔴       | Are the 2025/2026 Acts in force? Is Ch. 324A operative?                                                        |
| D3  | No acquisition pipeline                    | 🔴       | Nothing fetches or parses. Hand-segmentation is the only path                                                  |
| D4  | Ch. 324A placeholder dates                 | 🔴       | `commencementDate: '2003-01-01'` is derived from the Act number, **not stated in the document**                |
| D5  | Lexical-only retrieval                     | 🟠       | A demo where the founder must guess statutory phrasing is a bad demo                                           |
| D6  | Amending Acts read as gibberish standalone | 🟠       | See §6.1 — the most under-appreciated risk                                                                     |
| D7  | No OCR                                     | 🟡       | Only affects S.I. 68/2015, which is P1                                                                         |

**Minimum honest demo:** D1–D4 resolved, four P0 sources ingested to a published pack, and a scripted question set proven to retrieve.

---

## 4. Blockers to a founder-ready beta

Everything above, plus:

| #   | Blocker                                           | Severity                                                                                               |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| B1  | **SF1/SF3 — legal disclaimer and accountability** | 🔴 Unchanged since Day 2. Founder-facing regulatory guidance without a settled accountability position |
| B2  | **No rate limiting**                              | 🔴 Unauthenticated cost and abuse exposure; see §7.1                                                   |
| B3  | **No audit trail for Nova answers**               | 🔴 A founder acts on an answer; nothing records what was said or from which pack version               |
| B4  | **Knowledge RLS is not jurisdiction-scoped**      | 🔴 See §7.2                                                                                            |
| B5  | Corpus too thin                                   | 🟠 Four statutes cannot answer most founder questions. Refusal rate will be very high                  |
| B6  | Semantic retrieval (KI1/MP-1)                     | 🟠 Founders do not speak statute                                                                       |
| B7  | Comprehension                                     | 🟠 Accurate quoted statute a founder cannot parse is a failure mode, not a success                     |
| B8  | No feedback channel                               | 🟡 No way to report a wrong or unhelpful answer                                                        |

---

## 5. Blockers to production launch

Everything above, plus:

| #   | Blocker                                            | Severity                                                                                                                          |
| --- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| P1  | **MP-2 data residency**                            | 🔴 ADR-0019 records it as outstanding. Currently moot — Nova sends nothing anywhere — but it gates the moment any provider enters |
| P2  | **Reproducibility persistence (ADR-0016, doc 15)** | 🔴 No `workflow_runs` / `agent_executions` tables. A historical answer cannot be replayed                                         |
| P3  | **Knowledge freshness monitoring (K6)**            | 🔴 No re-crawl, no change detection, no staleness propagation. A pack silently rots                                               |
| P4  | **Human review workflow (HR1)**                    | 🔴 K2 assumes reviewers exist. Nobody is staffed                                                                                  |
| P5  | **Evaluation harness (ADR-0018, EV1)**             | 🔴 Hard gates cannot be measured without a gold standard                                                                          |
| P6  | Trust Layer implementation                         | 🟠 Four dimensions, trust level, trust score — all specified, none built                                                          |
| P7  | Multi-jurisdiction                                 | 🟠 Architecture supports it; only `BS` is planned                                                                                 |
| P8  | SOC 2 / DPA posture                                | 🟠 Designed, not implemented                                                                                                      |
| P9  | Corpus coverage measurement                        | 🟠 No way to say what fraction of a jurisdiction we hold                                                                          |

---

## 6. Architectural weaknesses to fix before the first real ingestion

Ordered by how badly they fail, not by effort.

### 6.1 🔴 Amending Acts are instructional, not substantive — and Nova will quote them

This is the most serious finding in the review, and it is a **product** failure that no citation machinery detects.

An amending Act does not state law. It states _edits_:

> "Section 6 of the principal Act is amended, in paragraph (b), by the deletion of the words 'if sold unprepared in a food store and', immediately after the words 'Fourth Schedule'."

That is a perfectly valid, perfectly citable, Authority-5 verbatim quotation. It is also **useless and confusing** to a founder asking whether they pay VAT on food.

Nothing in the current design prevents retrieval from ranking an amending-Act chunk above the base provision — the amending Act contains the query terms too. So Nova can return an edit instruction as its answer.

**Why the existing safeguards miss it:** grounding checks _provenance_, not _comprehensibility_. The claim is genuinely quoted, genuinely cited, genuinely current. It is simply not an answer.

**Options** (decision needed before ingestion):

- (a) Tag chunks by `instrument_role` — `substantive` vs `amending_instruction` — and rank substantive chunks first, surfacing amending text only as attached context to a base provision.
- (b) Exclude amending-instruction chunks from primary claim selection entirely; they exist only to populate amendment notices.
- (c) Chunk amending Acts by _the provision they amend_ rather than by their own section numbers, so they join naturally to the base.

**Recommendation: (a) + (c).** (b) discards real information.

### 6.2 🔴 The manifest ↔ database join is a URL string, and it fails silently

`manifestEntryForChunk()` matches `chunk.citation.url === entry.canonicalUrl`. If a government URL changes, or a source is re-registered with a trailing slash, the join breaks — and the failure mode is **amendment notices silently disappear**. Nova then presents an amended provision with no caveat and `currentApplicabilityEstablished` defaulting to `true`.

**That defaults in the unsafe direction.** A missing join looks identical to "no amendments exist."

**Fix before ingestion:** add `manifest_id` to `knowledge_sources` (a migration), join on it, and make an unresolvable manifest reference an _error_, not a silent skip. Alternatively keep the URL join but invert the default: unknown provenance → `currentApplicabilityEstablished: false` and an explicit `unresolved` entry.

### 6.3 🔴 Amendment matching depends on exact `sectionReference` strings

`amendmentsForProvision` normalises to lowercase and collapses whitespace. So `'Section 56'` matches `'section 56'`, but `'s. 56'`, `'56'`, `'Section 56(1)'` and `'section 56A'` do not — and `56A` is a **different provision** that No. 45 of 2025 inserts.

A chunker that emits `'Section 56(1)'` for a subsection would find no amendments for a provision that was _repealed and replaced_.

**Fix:** a canonical provision identifier — parsed structure (`{kind: 'section', number: '56', subsection: '1'}`), not a display string — with subsection-to-section fallback for amendment lookup.

### 6.4 🟠 Chunks without a `sectionReference` get no amendment notice at all

`buildAmendmentNotices` skips any claim whose chunk has `sectionReference: null`. Silent. Schedules, preambles and definitions sections are exactly the chunks most likely to lack a clean section reference — and the Second Schedule is where the 2026 food exemption lives.

**Fix:** treat a null section reference on a source with known amendments as an explicit `unresolved` entry, not a skip.

### 6.5 🟠 Retrieval loads the entire pack into memory

`listChunksForPack` fetches every chunk, then filters in JavaScript. Correct for four statutes; untenable at a real corpus. The deterministic filters (jurisdiction, authority, effective date, domain) should be SQL predicates.

### 6.6 🟠 No semantic retrieval, and no path to it until KI1

Lexical scoring with a three-character floor and a stopword list. ADR-0019 warns that changing an embedding model invalidates the whole vector corpus — so this must be decided _before_ a large ingestion, not after.

### 6.7 🟡 One claim per chunk caps answer quality

A provision spanning several chunks yields several disconnected claims. Deliberate for v0.1; will read as fragmented once real statutes are chunked.

### 6.8 🟡 `unresolved` does not cover "we never looked"

Coverage gaps are reported for retrieved-but-unusable chunks. There is no signal for an expected regulatory domain that produced nothing — `CoverageSignal.emptyDomains` exists and is carried to the view, but nothing populates a _domain expectation map_ (Trust Layer §7 requires one per business classification).

---

## 7. Security and privacy

### 7.1 🔴 No rate limiting — confirmed absent codebase-wide

`askNovaAction` is reachable by any authenticated user with no throttle. Today each call is a database read plus in-process work, so the exposure is DB load and cost. **The moment a generative or voice layer lands, this becomes direct financial exposure.** Fix before either.

### 7.2 🔴 Knowledge RLS is not jurisdiction-scoped

```sql
create policy knowledge_chunks_read_published on public.knowledge_chunks
  for select to authenticated
  using (exists (select 1 from knowledge_packs p
                 where p.id = knowledge_chunks.knowledge_pack_id
                   and p.status = 'published'));
```

Any authenticated user can read **any published chunk from any country**. Jurisdiction isolation lives entirely in application code (`services/nova/retrieval.ts`).

That is a single point of failure for the platform's most important correctness property. Everywhere else — businesses, profiles, intake — RLS is the authoritative boundary precisely because it survives application bugs. Knowledge is the exception, and it is the one place where a bug produces _confidently wrong regulatory guidance_ rather than a data leak.

**Note the tension:** cross-jurisdiction reads are legitimate for the corpus browser and for future expansion analysis. So the fix is not a blanket country filter — it is an explicit, reviewed policy, plus a **jurisdiction assertion in the retrieval path that already exists** (it does — `assertRetrievalResultValid` re-checks). Defence in depth is currently one layer deep.

### 7.3 🔴 Nova writes no audit event

Auth, business and intake call `recordAuditEvent`. Nova does not. A founder can receive regulatory guidance and act on it, and the platform holds no record of what was said, from which pack version, or on what evidence.

Structured logging captures the _shape_ (`outcome`, claim count) but deliberately not the content, and logs are not an audit trail.

### 7.4 🟠 No `agent_executions` — reproducibility is claimed but not persisted

Retrieval computes `RetrievalReproducibilityInputs` faithfully and then **throws them away**. Nothing is stored. ADR-0016 and document 15 both require per-run persistence. Today an answer cannot be replayed, diffed, or defended.

### 7.5 🟡 PII posture is currently excellent — and fragile

Nova sends nothing to any third party. The `buildQueryRepresentation` function concatenates the founder's question with their business description and location. **That string is not currently transmitted anywhere** — but it is exactly the payload that would be sent first if a provider were introduced. Worth an explicit redaction policy _before_ that happens, not after.

### 7.6 🟡 Suggestion chips are hard-coded in a client component

Harmless today. If they ever become jurisdiction-specific they must come from the pack, not the bundle (CLAUDE.md: no hard-coded country assumptions outside the Knowledge Pack).

---

## 8. Legal, trust and safety

| #   | Issue                                                                                                                                                                                | Severity |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| L1  | **G11 reuse permission** — gates storage and display                                                                                                                                 | 🔴       |
| L2  | **SF1** — is a disclaimer legally required in The Bahamas, and what must it say? Current copy is one line of small text, chosen by an engineer                                       | 🔴       |
| L3  | **SF3** — who is accountable if a founder is penalised after following a Nova answer?                                                                                                | 🔴       |
| L4  | **SF2** — professional liability insurance                                                                                                                                           | 🟠       |
| L5  | Advice boundary holds structurally — Nova quotes and never recommends (AI-14 §6) — but has never been usability-tested with a real founder                                           | 🟠       |
| L6  | Trust Layer unimplemented, so no badge implies certainty. **Currently safe**; becomes a risk the moment badges appear                                                                | 🟠       |
| L7  | Crown-copyright status of gazette text is unresolved beyond the site's own reuse notice                                                                                              | 🟠       |
| L8  | Refusal rate will be very high on a four-source pack. AI-14 §8 notes a _falling_ refusal rate is an alert — but a near-total refusal rate is a product failure, not a safety success | 🟡       |

---

## 9. UX issues that could make founders misunderstand Nova

### 9.1 🔴 "Ask Nova" implies a conversation Nova cannot have

The composer, the placeholder, and the name all read as chat. Nova has **no memory between questions**. A founder who asks a follow-up — "and what about the fees?" — gets a retrieval run with no idea what "that" refers to, and will read the refusal as stupidity rather than as a designed boundary.

**Fix before beta:** either state plainly that each question is answered independently, or implement scoped follow-up properly (§10.3). Do not leave it implied.

### 9.2 🔴 Suggestion chips promise answers the corpus cannot give

The three hard-coded examples ask about prepared-food licences, VAT registration timing, and record-keeping. With a four-statute pack, **at least two will refuse.** A founder's first interaction being a refusal to a suggestion Nova itself offered is the worst possible first impression, and it implies coverage that does not exist.

**Fix:** derive suggestions from what the pack actually covers, or remove them.

### 9.3 🟠 Quoted statute is not comprehension

Nova's core guarantee — verbatim quotation — is also its core usability problem. _"A taxable activity means any activity carried on continuously or regularly by a person whether or not for a pecuniary profit"_ is accurate and unhelpful to a food-truck owner.

This is the central product tension of extractive Nova and it deserves an explicit answer, not drift. See §10.

### 9.4 🟠 The disclaimer is small grey text

One line under the composer, one under the answer. If SF1 requires a disclaimer, its prominence is a legal question, not a design preference.

### 9.5 🟡 No way to tell an unamended provision from an unchecked one

When `amendments` is empty the UI shows nothing. That is correct when the manifest confirms no amendments, and misleading when the manifest join failed (§6.2). The founder cannot distinguish these.

### 9.6 🟡 The roadmap fallback may confuse returning founders

The page silently swaps between roadmap and console depending on whether a pack is published. A founder who saw the console once and later sees the roadmap will have no explanation.

---

## 10. Conversational and voice — without breaking extractive Nova

### 10.1 The layering that must hold

```
L1  REGULATORY DETERMINATION        deterministic · extractive · authoritative
    retrieval → quotation → citation → amendment metadata
    ── produces the ONLY facts that exist in the system ──
                    ▼
L2  PRESENTATION / LINGUISTIC       optional · may be generative
    may rephrase, summarise, or converse over L1 output
    may NOT introduce a fact, a citation, or a legal conclusion
                    ▼
L3  VOICE                           TTS over L2 only
```

### 10.2 Rules that make a generative L2 safe

1. **L2 never sees retrieval.** Its only input is the validated envelope — claims, quotes, citations, amendment metadata, `unresolved`. It cannot reach the corpus, so it cannot cite anything the run did not return.
2. **L2 output is never citable.** Citations attach to L1 claims. A rephrasing carries the original claim's citation, and the verbatim quote stays visible alongside it — always, not behind a disclosure.
3. **L2 may not add or remove claims.** Assertable by test: the set of `claim_id`s referenced by L2 output must equal L1's.
4. **L2 may not resolve an `unresolved`.** If L1 withheld the current legal position, L2 states the same withholding.
5. **L2 failure degrades to L1.** If the model errors or its output fails validation, the founder sees the quotations. Never a blank, never a fallback sentence.
6. **L2 is evaluated separately** under ADR-0018, with its own gates: no added facts, no dropped caveats, no changed meaning.

**This is not "adding an LLM to feel conversational."** It is a translation layer over a fixed fact set, with the facts still on screen.

### 10.3 Scoped follow-up without conversational memory

The honest intermediate step, and it needs no model at all:

- Keep the last answer's **structured context** — instrument, provision, jurisdiction — not the transcript.
- Offer **explicit, generated-from-metadata** follow-ups: "Show the amending Act", "Show the whole section", "What else does this instrument cover?"
- Each is a fresh, fully-grounded retrieval with a machine-built query. No pronoun resolution, no ambiguity, no memory.

This delivers most of the conversational value with none of the risk, and it is buildable now.

### 10.4 Voice (Fish Audio) — correctly deferred

Voice is L3 and must consume L2 output only. Two things must be settled first: **audio cannot show a citation**, so the provenance model for voice is a genuine design problem (AI-14's verifiability requirement does not survive a speaker); and TTS of a third party's copyrighted legal text engages G11 differently from displaying it. Keep deferred.

---

## 11. What to build next — priority order

| #   | Item                                                                    | Type           | Gate                         |
| --- | ----------------------------------------------------------------------- | -------------- | ---------------------------- |
| 1   | **Resolve G11** (reuse permission)                                      | Legal          | Blocks everything downstream |
| 2   | **Resolve G1–G6** (legal status verification)                           | Legal          | Blocks ingestion             |
| 3   | **Rate limiting** on `askNovaAction`                                    | 🔴 Blocker     | Beta                         |
| 4   | **Nova audit events** + `agent_executions` persistence                  | 🔴 Blocker     | Beta                         |
| 5   | **Jurisdiction-scoped knowledge RLS**                                   | 🔴 Blocker     | Beta                         |
| 6   | **`instrument_role` on chunks** + rank substantive over amending (§6.1) | 🔴 Blocker     | Ingestion                    |
| 7   | **`manifest_id` join** replacing the URL match (§6.2)                   | 🔴 Blocker     | Ingestion                    |
| 8   | **Canonical provision identifiers** (§6.3)                              | 🔴 Blocker     | Ingestion                    |
| 9   | **Acquisition script + hand-segmentation** of P0 sources                | 🔴 Blocker     | Demo                         |
| 10  | **Correct Ch. 324A placeholder dates**                                  | 🔴 Blocker     | Ingestion                    |
| 11  | Replace suggestion chips with pack-derived ones (§9.2)                  | 🟠 Enhancement | Beta                         |
| 12  | State the no-memory boundary in the UI (§9.1)                           | 🟠 Enhancement | Beta                         |
| 13  | Push deterministic filters into SQL (§6.5)                              | 🟠 Enhancement | Scale                        |
| 14  | Scoped follow-up actions (§10.3)                                        | 🟠 Enhancement | Beta                         |
| 15  | Domain expectation map + coverage confidence (§6.8)                     | 🟠 Enhancement | Beta                         |
| 16  | Decide KI1/MP-1 and add semantic retrieval                              | 🟠 Enhancement | Beta quality                 |
| 17  | Trust Layer implementation                                              | 🟡 Later       | Production                   |
| 18  | K6 freshness monitoring                                                 | 🟡 Later       | Production                   |
| 19  | ADR-0018 evaluation harness (needs EV1)                                 | 🟡 Later       | Production / generative      |
| 20  | L2 linguistic layer (§10.2)                                             | 🟡 Later       | After 19                     |
| 21  | L3 voice                                                                | 🟡 Later       | After 20                     |

---

## 12. Proposed Day 5 – Day 10 roadmap

Assumes G11 and G1–G6 progress in parallel on the legal track. Engineering work below is **not** blocked on them except where marked.

### Day 5 — Corpus integrity (all blockers)

- `instrument_role` on chunks; substantive ranked above amending (§6.1)
- `manifest_id` column + join; unresolvable reference becomes an error (§6.2)
- Canonical provision identifiers with subsection fallback (§6.3)
- Null-section-reference chunks emit an explicit `unresolved` (§6.4)
- One migration, additive. Tests for each.

### Day 6 — Platform hardening (all blockers)

- Rate limiting on `askNovaAction` (per user, per business, per day)
- `recordAuditEvent` for every Nova answer — outcome, pack version, claim count, correlation id; **no question text, no retrieved content**
- `agent_executions` table + per-run persistence of the reproducibility inputs already computed
- Jurisdiction-scoped knowledge RLS, with the corpus-browser case explicitly considered

### Day 7 — Acquisition (blocker for demo)

- `scripts/knowledge/fetch-source.ts` — offline, prints SHA-256, writes to a gitignored directory
- **Runs only after G11 clears.** Written and tested against synthetic fixtures until then
- Hand-segmentation tooling for the four P0 statutes

### Day 8 — First ingestion (gated on G11 + G1–G6)

- Ingest four P0 sources into **draft** pack `BS-v0.1`
- Run `runQualityGate`. **Do not publish**
- Golden-question set: 15–20 real founder questions with expected outcomes, run against the draft pack. This is the first honest measurement of whether lexical retrieval is adequate

### Day 9 — Product truthfulness (enhancements, high value)

- Pack-derived suggestion chips (§9.2)
- Explicit no-memory statement in the UI (§9.1)
- Scoped follow-up actions from metadata (§10.3) — the conversational win with no model
- Distinguish "no amendments" from "amendments unchecked" (§9.5)

### Day 10 — Review and decide

- Assess Day 8 golden-question results
- **Decide KI1/MP-1** on evidence, not in the abstract — if lexical recall is adequate for the pilot corpus, semantic retrieval can wait
- Publication decision for `BS-v0.1`, conditional on G11, G1–G6, SF1 and SF3
- Re-run this review

### Explicitly not in Day 5–10

Generative L2 · voice · Trust Layer badges · multi-jurisdiction · evaluation harness. Each depends on a decision that is still open, and shipping any of them early would create a capability claim the system cannot honour.

---

## 13. The one-paragraph summary

Nova v0.1 is a small, honest, well-tested system that **cannot fabricate** and **cannot currently answer**. The engineering risk is low and the correctness properties are unusually strong. The real risks are elsewhere: an unresolved commercial-reuse restriction that gates the entire corpus, an accountability position nobody has taken, three silent-failure modes in the amendment layer that must be fixed before the first real ingestion, and a product tension — verbatim statute is accurate and hard to read — that cannot be solved by adding a model to the determination path and should not be. The next ten days should close the silent failures, harden the platform, and measure whether the retrieval is good enough, before anything is published to anyone.
