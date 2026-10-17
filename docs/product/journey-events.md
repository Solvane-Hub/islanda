# Journey events: what is recorded today, and what is not

**Updated:** 2026-10-16

Islanda has **no product analytics provider** (no PostHog, Plausible, GA or Vercel
Analytics). Nothing below is collected by a third party. No provider was added as part of
the 2026-10 UX overhaul: that needs a privacy review and configuration first.

What exists is the **audit log** (`audit_log`, written by `services/audit`) and
**structured server logs** (`lib/logger`). Both are shape-only: no document contents,
passwords, tokens, identifiers or free-text answers.

## Already recorded

| Journey step                  | Where                           | Event                                                                              |
| ----------------------------- | ------------------------------- | ---------------------------------------------------------------------------------- |
| Sign-in succeeded             | `audit_log`                     | `auth.signed_in`                                                                   |
| Account created               | `audit_log`                     | `auth.registered`                                                                  |
| Business created              | `audit_log`                     | `business.built` / `business.imported` / `business.created`                        |
| Intake started                | `audit_log`                     | `intake.started`                                                                   |
| Intake step completed         | `audit_log`                     | `intake.step_saved`                                                                |
| Intake completed              | `audit_log`                     | `intake.completed`                                                                 |
| Business details changed      | `audit_log`                     | `business.updated`                                                                 |
| Document upload succeeded     | `audit_log`                     | `business.document_added`                                                          |
| Nova answered / failed        | `audit_log`, `agent_executions` | `nova.answered`, `nova.failed`, `nova.rate_limited`                                |
| Waitlist submission failed    | server log                      | `waitlist.join_failed`, `waitlist.rate_limit_unavailable`, `waitlist.email_failed` |
| Waitlist submission succeeded | `waitlist_signups` row          | (a row, not an event)                                                              |

## Not recorded — recommended schema

These need either a client-side event (and so a provider and a privacy review) or a new
server log line. Recommended names and payloads, all shape-only:

| Event                       | When                                   | Payload                                               |
| --------------------------- | -------------------------------------- | ----------------------------------------------------- |
| `home.waitlist_cta_clicked` | Hero "Join the early-access waitlist"  | `{ accessMode }`                                      |
| `waitlist.joined`           | Server action returns `joined`         | `{ source: 'landing_page' }` — never the email        |
| `waitlist.already_joined`   | Duplicate submission                   | `{}`                                                  |
| `auth.sign_in_page_viewed`  | `/login` rendered                      | `{ hasNext: boolean }`                                |
| `auth.sign_in_failed`       | Sign-in rejected                       | `{ code }` — never the email                          |
| `documents.upload_failed`   | Ticket, storage or finalize step fails | `{ step: 'ticket' \| 'storage' \| 'finalize', code }` |

Do not record: document contents or file names, intake answers, passwords, tokens,
registration/tax/VAT numbers, or a person's email address in an analytics event.
