# What Islanda can do today

**Updated:** 2026-10-16 · **Source of truth in code:** `lib/product/availability.ts`

This is the trace behind the availability register. The public homepage, the app
navigation ("Coming later") and the Home page's "coming later" line all read the
register, so they describe the same product. Change the register and this page together.

This is a product document, not an architecture document, and it is not registered in
`docs/architecture/DOCUMENT_MANIFEST.md`.

## Capabilities

| Capability                        | Status                                     | What it rests on (traced in code)                                                                                                                       | Customer wording                                                         |
| --------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Business profile                  | Available                                  | `buildBusinessAction` / `manageBusinessAction` (`app/(app)/actions.ts`) → `services/business`                                                           | "A profile for your business"                                            |
| Five guided questions             | Available                                  | `/intake`, `saveIntakeStepAction` → `services/intake` (resumable; ADR-0020 "I don't know yet")                                                          | "Five guided questions"                                                  |
| Business summary (Passport)       | Available                                  | `/passport`, `assembleBusinessPassport` (`services/passport`)                                                                                           | "Your business on one page" / "My Business"                              |
| Private document storage          | Available                                  | `/documents`, signed upload to private bucket `business-documents` (`services/documents`). No extraction exists.                                        | "Private document storage … Islanda stores them; it does not read them." |
| Goals                             | Available                                  | `createGoalAction` → `services/goals`; progress from recorded figures                                                                                   | "Goals"                                                                  |
| Money and sales figures           | Available                                  | `recordFigureAction` → `services/financials`; derived figures in `lib/business-intelligence/performance`. No bank connection.                           | "Money and sales figures"                                                |
| Nova — cited answers              | Available in app; **held from public**     | `/assistant`, extractive path (`services/nova`), published pack BS-v0.1 (VAT Act + amendments, Data Protection Acts). Founder release gated on SF1/SF3. | Homepage: "Built, being tested before release". App: "Get help".         |
| Nova — finance questions          | Needs configuration                        | `askNovaFinanceAction` → Intelligence Gateway; deterministic answers always, reasoning needs `OPENAI_API_KEY`. Shown only once figures exist.           | "Ask about your figures"                                                 |
| Nova — general business questions | Needs configuration; internal testing only | ADR-0023 (proposed). Needs `OPENAI_API_KEY`.                                                                                                            | Not advertised                                                           |
| Voice                             | Needs configuration                        | `/api/nova/speak` → Fish Audio; needs `FISH_API_KEY`, `FISH_NOVA_VOICE_ID`. Off by default.                                                             | Not advertised                                                           |
| Registration and licence guidance | In development                             | `/compliance` is a placeholder (`RoadmapRoute`)                                                                                                         | "We're working on this"                                                  |
| Important dates                   | In development                             | `/timeline` is a placeholder                                                                                                                            | "We're working on this"                                                  |
| Funding options                   | In development                             | `/funding` is a placeholder                                                                                                                             | "We're working on this"                                                  |

## Access

There are two access modes and **no invitation mechanism**.

| `WAITLIST_ONLY_MODE`             | Sign-in / sign-up                                                 | App routes                 | What the homepage says                                                      |
| -------------------------------- | ----------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------- |
| `true` (default in production)   | Both redirect to `/?access=waitlist`; the actions refuse directly | Redirect to the waitlist   | "Not open to the public yet. Join the waitlist." No sign-in links anywhere. |
| `false` (dev, CI, an open pilot) | Open to anyone with an email address                              | Signed-in users only (RLS) | "In early access." Sign-in and create-account links shown.                  |

`waitlist_signups.status` has an `invited` value, but nothing reads it: being marked
invited does not let anyone sign in. An invited-tester path would be new authentication
behaviour and needs its own design and review — it was deliberately not invented here.

The same holds for pilot recruitment (2026-10-17): `recruitment_status = 'confirmed'`
and a visitor answering "Yes" to early testing are team bookkeeping only and grant no
access. The single sign-in that stays open in waitlist mode is the team-only
`/admin/login`, which admits `waitlist_admin` staff to `/admin/waitlist` and signs
everyone else straight back out — it never reaches the founder app.

## Known coverage limits (Nova, BS-v0.1)

Checked on 2026-10-16 by asking questions in the running app:

- Questions about VAT registration and records return passages from the VAT Act.
- Questions about licences, business registration or annual returns return nothing — the
  pack does not cover them, and Nova says so.
- Retrieval often returns section 62 (the Comptroller's investigatory powers) as the
  "closest match", including for questions about invoices, late returns and personal
  information. Every passage is quoted verbatim and cited, so this is a relevance
  problem, not fabrication. Changing retrieval is an AI change and goes through the
  ADR-0018 evaluation gates.
