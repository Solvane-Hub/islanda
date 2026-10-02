# Contributing to Islanda

## Before you write code

Islanda is documentation-first. Engineering Standards §2: _"If it is not specified,
it should not be implemented."_

1. Read the relevant documentation in the Knowledge Base.
2. Identify affected systems.
3. Propose an implementation plan.
4. If the change touches architecture, get approval before building.
5. Build incrementally.
6. Test.
7. Update documentation if architecture changed.

## Source of truth

When documents conflict, this order wins:

1. FoundryAI Constitution
2. FoundryAI Codex
3. Product Requirements Document
4. Platform Architecture
5. Engineering Standards
6. Individual technical specifications

If uncertainty remains, ask the founder. Do not guess.

## Branching

```
main                 always deployable, protected
feat/<scope>-<slug>  new functionality
fix/<scope>-<slug>   defect repair
chore/<slug>         tooling, dependencies, docs
```

No direct pushes to `main`. Every change lands via reviewed pull request.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat(business): persist business creation through the services layer
fix(auth): redirect unauthenticated users to login
chore(ci): add dependency audit job
docs(adr): record tenancy decision
test(rls): assert cross-tenant reads fail
```

Keep commits logically scoped. One concern per commit.

## Definition of Done

A change is complete only when it:

- satisfies the specification
- includes tests
- follows the documented architecture
- updates documentation if architecture changed
- introduces no regressions
- is understandable by another engineer

Run `npm run verify` before pushing. CI enforces the same gates.

## Architectural decisions

Any non-obvious decision gets an ADR in `docs/decisions/`, numbered sequentially.
Copy `ADR-TEMPLATE.md`. This closes the Decision Log gap identified in the
Engineering Understanding Report.

## Non-negotiables

These are Constitutional, not stylistic:

- **Never fabricate.** No invented regulation, fee, agency, permit, deadline, or
  citation — including in demos, seed data, and placeholder UI. If information is
  unavailable, the system says so.
- **Never bypass Row Level Security.**
- **Never let AI write to the database.** Agents return validated JSON; services persist.
- **Never hard-code country-specific logic** outside a Knowledge Pack.
- **Never use `any`** without a comment justifying it.
