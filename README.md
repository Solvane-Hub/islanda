# Islanda

_(Formerly FoundryAI — renamed after the buildathon; see CHANGELOG.md.)_

A business workspace for people starting a business in The Bahamas, by **Solvane Hub**.

**What works today** (for early-access users): a business profile, five guided questions,
a one-page summary ("My Business", the Business Passport), private document storage,
goals, and money-and-sales figures. Nova — answers quoted verbatim from the official
documents Islanda holds, with citations — is built and in the app, and held back from
public release until the disclaimer and accountability decision (SF1/SF3) is made.

**Not built yet:** registration and licence guidance, important dates, and funding.
The long-term direction is an evidence-backed launch roadmap, each requirement traceable
to the government document it came from.

> Islanda is not a chatbot. Authority comes from verified knowledge, not from the model.

**Access:** with `WAITLIST_ONLY_MODE=true` (the production default) the public site is
waitlist-only and founder sign-in is closed to everyone; there is no invitation mechanism
yet. The one exception is the team-only waitlist admin at `/admin` (see
[Waitlist & pilot recruitment](#waitlist--pilot-recruitment-team-only)).
The full capability list and its trace through the code is in
[`docs/product/availability.md`](docs/product/availability.md), mirrored in
`lib/product/availability.ts`.

---

## Getting started

```bash
nvm use                 # Node 22+
npm install
cp .env.example .env.local   # then fill in your Supabase values
npm run dev
```

The app validates its environment at boot and will refuse to start with a clear error
if anything is missing — see `lib/env.ts`.

## Scripts

| Command             | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Development server                           |
| `npm run build`     | Production build                             |
| `npm run typecheck` | TypeScript, no emit                          |
| `npm run lint`      | ESLint, including layer-boundary rules       |
| `npm run test`      | Unit, integration, and RLS tests (Vitest)    |
| `npm run test:e2e`  | End-to-end tests (Playwright)                |
| `npm run verify`    | typecheck → lint → test. Run before pushing. |

## Waitlist & pilot recruitment (team only)

After joining the waitlist (name + email, optional phone), a visitor is offered four
optional questions — location, business stage, biggest challenge, interest in early
testing. Answers are written to their **existing** `waitlist_signups` row through the
token-gated `submit_waitlist_survey` function; skipping writes nothing. Migration:
`supabase/migrations/20261017000000_waitlist_survey_and_recruitment.sql`.

Team members review signups and track pilot recruitment (Not Contacted → Contacted →
Confirmed → Tested) at **`/admin/waitlist`**, signing in at `/admin/login`. This works
even with `WAITLIST_ONLY_MODE=true`; anyone without the role is signed straight back out.

**Granting access** (once per team member, in the Supabase SQL editor):

1. Create the person's user in Supabase → Authentication → Users → _Add user_ (with a
   password). They do not need a founder account or a business.
2. Grant the role:

   ```sql
   insert into public.staff_members (user_id, role)
   select id, 'waitlist_admin' from auth.users where email = 'coo@example.com';
   ```

To revoke: `delete from public.staff_members where user_id = '<uuid>' and role = 'waitlist_admin';`

Roles cannot be granted through the app or the API — `staff_members` has no write policy.
"Early testing" is what the visitor said; "Recruitment status" is what the team did.
Neither implies consent beyond the waitlist's stated purpose (Islanda early access).

## Architecture

Strict, unidirectional layering. No layer may bypass another.

```
app/          Presentation — routing, layouts, Server Components. No business rules.
  ↓
services/     Application Services — ALL business rules and ALL database writes.
  ↓
lib/db/       Repositories — the only place queries are written.
  ↓
Supabase PostgreSQL + Row Level Security
```

Two boundaries are enforced by ESLint and fail the build, not by convention:

1. `app/` may not import `lib/db` — it must route through `services/`.
2. `lib/ai/` may not import `lib/db` or `services/` — **AI never writes to the database**
   (Engineering Standards §8). Agents return validated JSON; services persist it.

## Repository layout

| Path          | Purpose                                                                              |
| ------------- | ------------------------------------------------------------------------------------ |
| `app/`        | Next.js App Router — routes, layouts, Server Components                              |
| `components/` | Presentation only. `ui/` is the design system.                                       |
| `services/`   | Application Services — business rules, state transitions, writes                     |
| `lib/`        | Infrastructure: Supabase clients, repositories, AI, knowledge, trust, validation     |
| `types/`      | Centralized shared interfaces. `database.ts` is generated — never hand-edit.         |
| `supabase/`   | Migrations, RLS policies, seed data                                                  |
| `tests/`      | `unit/`, `integration/`, `e2e/`, `rls/` — RLS is a separate, security-critical suite |
| `docs/`       | Architecture mirror, ADRs, runbooks, sprint records                                  |

## Documentation

The canonical source of truth is the FoundryAI Knowledge Base. Read in this order:
Constitution → Master Documentation Index → PRD → Platform Architecture → the relevant
technical specification.

Decisions taken during implementation are recorded as ADRs in `docs/decisions/`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). All work follows the Engineering Standards
Definition of Done.
