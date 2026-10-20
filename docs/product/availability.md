# What Islanda can do today

**Updated:** 2026-10-20 · **Source of truth in code:** `lib/product/availability.ts`
(release gate: `lib/product/release.ts`)

This is the trace behind the availability register. The public homepage and the app
navigation both read the register, so they describe the same product. Change the
register and this page together.

## Build privately, release deliberately (2026-10-20)

A capability is **released** only when it is `available` **and** marked `released: true`
in the register. Users — visitors and ordinary signed-in founders — see released
capabilities and nothing else:

- The homepage has no "what we're building next" section; the FAQ, the example and the
  auth pages make no promises about unbuilt features. Limits are stated as scope
  ("Islanda does not tell you which requirements apply"), never as "coming soon".
- The app navigation, dashboard, welcome page and Passport list no unreleased item:
  no "Soon" badges, no "Coming later" line, no doors to Nova while Nova is unreleased.
- **Unreleased routes are a 404 in production**, however they are reached:
  `/assistant` (and `/assistant/about`) via its layout, `/compliance`, `/timeline`,
  `/funding` via `requireReleased`; the Nova and Nova-finance server actions return
  NOT_FOUND; `/api/nova/speak` returns 404 before authentication.
- **Internal environments** (local, CI, Vercel previews — which sit behind Vercel's own
  sign-in) still show unreleased work, under "Internal preview" with a _Preview_ tag.
  `SHOW_UNRELEASED_FEATURES=false` rehearses production locally; `true` in production
  is for a deliberate internal check only.

Signed-in routes stream behind a loading boundary, so a gated page renders the not-found page with HTTP status 200 rather than 404 (verified 2026-10-20 with `SHOW_UNRELEASED_FEATURES=false`); no unreleased content is sent. The routes require a session, so crawlers never reach them; the API route returns a true 404.

Release is not authorization. Every route still requires a session, RLS still decides
what any query returns, and the admin portal keeps its own owner-only MFA model.

**To release a capability:** set `released: true` (and confirm `status: 'available'`),
update this table and the CHANGELOG, and check the gates it depends on (for Nova:
SF1/SF3 — the disclaimer and accountability decision).

This is a product document, not an architecture document, and it is not registered in
`docs/architecture/DOCUMENT_MANIFEST.md`.

## Capabilities

| Capability                        | Status / release                           | What it rests on (traced in code)                                                                                                                       | Customer wording                                                         |
| --------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Business profile                  | Available                                  | `buildBusinessAction` / `manageBusinessAction` (`app/(app)/actions.ts`) → `services/business`                                                           | "A profile for your business"                                            |
| Five guided questions             | Available                                  | `/intake`, `saveIntakeStepAction` → `services/intake` (resumable; ADR-0020 "I don't know yet")                                                          | "Five guided questions"                                                  |
| Business summary (Passport)       | Available                                  | `/passport`, `assembleBusinessPassport` (`services/passport`)                                                                                           | "Your business on one page" / "My Business"                              |
| Private document storage          | Available                                  | `/documents`, signed upload to private bucket `business-documents` (`services/documents`). No extraction exists.                                        | "Private document storage … Islanda stores them; it does not read them." |
| Goals                             | Available                                  | `createGoalAction` → `services/goals`; progress from recorded figures                                                                                   | "Goals"                                                                  |
| Money and sales figures           | Available                                  | `recordFigureAction` → `services/financials`; derived figures in `lib/business-intelligence/performance`. No bank connection.                           | "Money and sales figures"                                                |
| Nova — cited answers              | Available; **unreleased** (internal only)  | `/assistant`, extractive path (`services/nova`), published pack BS-v0.1 (VAT Act + amendments, Data Protection Acts). Founder release gated on SF1/SF3. | Not shown to users. Internal: "Get help".                                |
| Nova — finance questions          | Needs configuration; **unreleased**        | `askNovaFinanceAction` → Intelligence Gateway; deterministic answers always, reasoning needs `OPENAI_API_KEY` (generative Nova is out of scope).        | Not shown to users                                                       |
| Nova — general business questions | Needs configuration; internal testing only | ADR-0023 (proposed). Needs `OPENAI_API_KEY`.                                                                                                            | Not advertised                                                           |
| Voice                             | Needs configuration                        | `/api/nova/speak` → Fish Audio; needs `FISH_API_KEY`, `FISH_NOVA_VOICE_ID`. Off by default.                                                             | Not advertised                                                           |
| Registration and licence guidance | In development; unreleased                 | `/compliance` is a placeholder (`RoadmapRoute`), internal only                                                                                          | Not shown to users                                                       |
| Important dates                   | In development; unreleased                 | `/timeline` is a placeholder, internal only                                                                                                             | Not shown to users                                                       |
| Funding options                   | In development; unreleased                 | `/funding` is a placeholder, internal only                                                                                                              | Not shown to users                                                       |

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
