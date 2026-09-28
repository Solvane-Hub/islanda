# Islanda

_(Formerly FoundryAI — renamed after the buildathon; see CHANGELOG.md.)_

An AI-native operating system for entrepreneurship, by **Solvane Hub**.

Islanda turns a founder's plain-language business idea into an evidence-backed launch
roadmap — the registrations, licences, permits, agencies, fees, timelines, and funding
programmes that apply to their business in their jurisdiction, each traceable to the
government document it came from.

> Islanda is not a chatbot. Authority comes from verified knowledge, not from the model.

**Current status:** Sprint 1 · Phase 0 — Platform Foundation. No AI, knowledge, or
product features are implemented yet.

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
