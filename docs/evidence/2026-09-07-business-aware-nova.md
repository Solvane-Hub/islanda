# Business-aware Nova (P1) — manual test matrix

Branch `post-competition/business-object`. Deterministic/extractive only — no
generative model. Business context influences relevance and interpretation
framing; it never manufactures a legal conclusion, and sensitive identifiers
never reach Nova.

Prerequisite: signed in, a business selected whose jurisdiction has a published
Knowledge Pack (The Bahamas / BS today). Set voice off.

## Case A — Existing business uses known context

1. Manage-mode business: industry `Restaurant`, location `New Providence`, stage `Operating`.
2. Open `/assistant`. The landing shows a subtle line: _"I already have the basics of {name}. Ask about the requirements that may affect it."_
3. Ask: **"Do I need to register for VAT?"**

Expect:

- The quoted, cited passages appear under **What we found in the sources we hold** (unchanged).
- A **What this means for your business** panel:
  - a relevance line naming _restaurant_ and _New Providence_, framed as context ("…I read the published material below in that context"), **not** "you must".
  - founder-provided fact chips (Industry / Location / Stage), captioned _founder-provided, not independently verified_.
- Under **What I don't know yet**: _Your current taxable turnover_ — with an honest gap explanation, **no invented figure**.
- Nova never states that VAT registration applies to the business.

## Case B — Missing decisive fact is named

1. Same business. Ask: **"Am I required to register?"** (or any VAT/threshold question).

Expect:

- If turnover/threshold is decisive and unknown, it is listed in **What I don't know yet**, and a single focused clarification is offered (e.g. _"Roughly what is your annual turnover?"_).
- No fabricated turnover, no assumed registration status.

## Case C — Unsupported question keeps the refusal intact

1. Ask something outside the corpus, e.g. **"What is the VAT rate in The Bahamas?"** (the built-in boundary example).

Expect:

- The existing refusal renders (no red, no apology): _"Nothing in the sources we hold addresses this"_ (or the matching outcome).
- **No business-aware panel** appears on a refusal — there is nothing retrieved to frame.

## Case D — Sensitive identifier never reaches Nova

1. Manage-mode business with a Tax ID / registration number on file.
2. Ask any regulatory question.

Expect (verify):

- The answer's business panel shows only non-sensitive facts (industry, activities, location, stage, team) — **never** the tax id or registration number.
- `agent_executions.query_representation_hash` for the run is derived from a query representation that contains no identifier (the `NovaBusinessFacts` passed to Nova has no identifier field; `buildQueryRepresentation` cannot name one). Confirm by inspecting the query representation / that identifiers appear nowhere in the execution record.

## Automated coverage

- `tests/unit/nova/business-awareness.test.ts` — facts mapping, structural identifier exclusion, relevance framing (no "you must"/"you need"), missing-turnover gap without a figure, known headcount used vs. asked, refusal → null, no-context → null.
- `tests/unit/nova/answer-service.test.ts` — business context attaches on an answered outcome, absent without facts, never on a no-pack refusal.
- `tests/unit/nova/context.test.ts` — Business Object enriches the query representation; a stray identifier contributes nothing.
