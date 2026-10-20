# Admin portal and first-party analytics

_Added 2026-10-18 (migration `20261019171608_admin_portal_and_analytics`)._

The owner-only operations console at **`/admin`**: website traffic and conversion,
waitlist and questionnaire responses, registered users and businesses, product usage,
pilot recruitment, CSV exports, and the security audit log.

## Who can get in

Exactly two people: **Jamil Nash** (`jamilnash@solvanehub.us`) and **Jonathan Cash**
(`jonathancash@solvanehub.us`). Access needs **all** of the following, checked on the
server for every page, action and export, and again by Postgres for every query:

| Check                                                                          | Where                                                                      |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| A real Supabase session (`getUser()`, never `getSession()`)                    | `services/admin/access.ts`                                                 |
| Email on the allowlist                                                         | `lib/admin/allowlist.ts`                                                   |
| A `platform_admins` row bound to the account's **user id**                     | `public.platform_admins` (CHECK constraint permits only the two addresses) |
| The account's current email equals the provisioned one, and is confirmed       | `app.platform_admin_identity_ok()`                                         |
| An **MFA (aal2)** session — TOTP authenticator                                 | `app.is_platform_admin()`                                                  |
| No pending temporary-password change (`app_metadata.password_change_required`) | `services/admin/access.ts`                                                 |

Registering one of the two addresses grants nothing: there is no `platform_admins` row
for that account. Nobody can add a row through the API (no INSERT/UPDATE/DELETE grant);
rows are written only by `scripts/provision-admin.ts` with the service role. Changing the
allowlist needs a reviewed change to **both** the migration's CHECK constraint and
`lib/admin/allowlist.ts`. The former `waitlist_admin` staff role no longer grants
anything.

A signed-in non-administrator who opens an admin page gets a 404, and the attempt is
recorded as `admin.access_denied`. The admin sign-in page gives the same message for a
wrong password, an unknown email and a non-administrator.

## Provisioning

```bash
# Jamil — the account already exists and is confirmed: bind it (no password change).
npm run admin:provision -- --email jamilnash@solvanehub.us --name "Jamil Nash"

# Jonathan — no account yet. Recommended: Supabase's invitation email; he verifies
# the mailbox and chooses his own password on /admin/reset-password.
npm run admin:provision -- --email jonathancash@solvanehub.us --name "Jonathan Cash" --invite

# Alternative: a temporary password, read from standard input only (never an argument,
# file or variable). The account is created unconfirmed, Supabase sends a confirmation
# email, and the password must be changed at first sign-in.
<password-manager-cli-output> | npm run admin:provision -- --email jonathancash@solvanehub.us --name "Jonathan Cash" --temporary-password-stdin
```

Each run is idempotent and is audited (`admin.provisioned`).

## Sign-in, MFA and passwords

1. `/admin/login` — email and password (also works while the founder product is
   waitlist-only). Signing in through the normal `/login` also lands an administrator in
   the portal.
2. Temporary password → `/admin/account/password` (forced change; current password
   required).
3. `/admin/mfa` — first time: scan the QR code into an authenticator app and confirm a
   code; afterwards: enter the current code. Only then does any admin data load.
4. **Change password:** Admin Settings (needs the current password; checked without
   replacing the MFA session).
5. **Forgot password:** `/admin/forgot-password` → emailed link → `/admin/reset-password`
   (accepted only for a session that came from that link within 30 minutes; with an
   authenticator set up, the code is required first).
6. **Lost authenticator:** the other administrator removes the factor in the Supabase
   dashboard (Authentication → Users → MFA) after confirming identity out of band; a new
   one is enrolled at next sign-in.

## Analytics: what is collected

First-party only — no advertising trackers, no third parties. Ingestion:
`POST /api/analytics` (always answers 204), validated in `services/analytics`, written
with the service role into `analytics_events`, readable only by platform
administrators.

| Stored                                                                                   | Never stored                                          |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Event name and time                                                                      | IP address (used transiently for the daily hash only) |
| Pseudonymous visitor key (see below)                                                     | Raw user agent, query strings, fragments              |
| Page path (ids replaced by `:id`)                                                        | Form content, questionnaire answers, names, emails    |
| Referring **host**, UTM source/medium/campaign                                           | Nova prompts, document contents, financial figures    |
| Country code from the hosting platform header (`x-vercel-ip-country`)                    | Precise location, fingerprints                        |
| Device category, browser family                                                          | Passwords, tokens, secrets                            |
| For signed-in app pages: the verified user id (from the session, never the request body) |                                                       |

**Visitor keys and consent.** A small prompt on the homepage asks whether Islanda may
remember the browser. _Allow_ → a random first-party id (`islanda_vid` cookie) lets the
dashboard tell new from returning visitors. _No thanks_, no answer, or a browser Global
Privacy Control / Do Not Track signal → nothing is stored on the device; visits are
counted with HMAC-SHA256(day, IP, user agent) under `ANALYTICS_HASH_SECRET` (falling back
to the service-role key), which rotates daily and cannot be reversed. Such visitors are
shown as "not identifiable" rather than new or returning.

Since 2026-10-20: the **server** also honours `Sec-GPC: 1` / `DNT: 1` — an earlier
"Allow" is ignored while the signal is present (the id is not used). The footer's
**Analytics choices** control withdraws the choice at any time: it deletes the consent
and `islanda_vid` cookies immediately and shows the prompt again.

**`ANALYTICS_HASH_SECRET` continuity.** Setting or rotating it changes only the `d:`
keys from that moment — that day's anonymous visitors may be counted twice across the
change. `c:` keys (consented ids) are unaffected. Set it once, then leave it alone.

### Retention and items for legal review

Nothing here is a claim of compliance with any law. The following need a decision or
review by the owners and, where noted, a qualified adviser:

| Item                            | Current behaviour                                                         | Proposed / question                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Analytics retention             | `analytics_events` kept indefinitely; no purge job exists                 | Proposed: delete events older than **13 months** (a scheduled job, after approval)                           |
| Consented id lifetime           | `islanda_vid` / consent cookies last 365 days (`CONSENT_MAX_AGE_SECONDS`) | Confirm the period is proportionate                                                                          |
| Waitlist and questionnaire data | Kept until deleted by an administrator                                    | Decide a retention period and a deletion-request process                                                     |
| Audit log                       | Kept indefinitely (security record)                                       | Confirm period                                                                                               |
| Consent wording                 | "privacy-friendly analytics — no advertising, no third parties"           | **Legal review**: wording, whether the daily hash needs notice, and the Bahamas Data Protection Act position |
| Privacy notice                  | None published                                                            | **Legal review**: a privacy notice covering waitlist, questionnaire, analytics and email                     |
| Hosting location                | Supabase / Vercel regions as configured (MP-2 open)                       | Founder decision MP-2                                                                                        |

**Where it records.** Every environment shares one Supabase project, so analytics
writes happen **only on the production deployment** (`VERCEL_ENV=production`). Local
development, CI and preview deployments record nothing unless `ANALYTICS_ENABLED=true`
is set (`false` switches it off everywhere). Added 2026-10-19 after local test runs
were found writing into the production table.

**Bots** (crawlers, uptime monitors, link previews, scripts, headless browsers, missing
user agents) are dropped before storage. A repeated `event_id` is ignored. Each client
has an ingestion budget (300 events / 10 minutes) through the existing fail-closed
limiter; analytics itself fails open (a problem never breaks a page).

### Event taxonomy

| Event                                                       | Source      | Meaning                                                     |
| ----------------------------------------------------------- | ----------- | ----------------------------------------------------------- |
| `page_view`                                                 | browser     | A page shown (once per distinct path on client navigation)  |
| `waitlist_form_started`                                     | browser     | First focus in the signup form                              |
| `waitlist_survey_started` · `_section_viewed` · `_skipped`  | browser     | Questionnaire interaction (section number only)             |
| `waitlist_signup_succeeded` · `_duplicate` · `_failed`      | **server**  | Verified signup outcome; failures carry a safe category     |
| `waitlist_survey_saved` · `_completed` · `_failed`          | **server**  | Verified questionnaire save                                 |
| `product_action_failed`                                     | **server**  | A signed-in save/upload/archive failed (area + category)    |
| Business, intake, documents, goals, finances, Nova outcomes | `audit_log` | Recorded by the application services since 2026-08 (reused) |

The browser can send only the first group; conversions are server-verified.

### Coverage boundary

Website and app page-view history begins on the day this release is deployed; the
dashboards say so and never back-fill. Product workflow history comes from `audit_log`
(from 2026-08). Automated test records — reserved domains `example.*`, `resend.dev`,
`foundryai-test.dev`, `foundryai-judge.dev`, `*.test` — are excluded from every
aggregate and labelled in lists. Since 2026-10-20 so are signups whose `source` is
`rls_test`, `e2e_test`, `development` or `preview` (see "Test data" below).

### Test data and the shared database

Until a separate test project exists, local, CI, preview and production all use the one
Supabase project. Safeguards (2026-10-20):

- Signups made outside production are tagged `source = 'preview' | 'development'`
  (production stays `landing_page`) and excluded from reports, the admin list (unless
  "show tests") and team notifications. The signer still gets their confirmation email.
- The team notification email is never sent for a test address or a non-production
  signup.
- RLS suites that write signups refuse to run against production unless
  `RLS_ALLOW_PRODUCTION_WRITES=1` is set; **CI never sets it**. Rows they write carry
  `source = 'rls_test'` and `@example.dev` addresses. Their database-level assertions run
  on every push in `npm run test:db` — every migration replayed into an isolated PGlite
  with production's default privileges — which is how a missing grant that would have
  refused all public signups was caught before 20261020185611 was applied.
- Analytics never records outside production (above).

**Recommended:** a dedicated Supabase test project (or Supabase branching) for CI, RLS
and end-to-end runs — this is a cost and setup decision for the owners. Existing test
rows are not deleted automatically; they are labelled and excluded. A one-off cleanup
can be run after review.

## Metric definitions

- **Unique visitors** — distinct visitor keys with a page view (an estimate, not people).
- **Session** — a visitor's events with no gap over 30 minutes; source and landing page
  come from the first event.
- **Visitor → signup** — waitlist rows created in the range ÷ unique visitors in the range.
- **Funnel** — steps 1–2 from analytics; steps 3–8 are the signups created in the range.
- **Active user** — at least one recorded action or app page view in the window (sign-out
  excluded). Having an account is not activity. Administrators and test accounts excluded.
- **Retention cohort** — users by the week of first activity, active again 1–4 weeks later.

## Exports

`/admin/exports/<report>` — generated per request for an administrator, never stored,
`Cache-Control: no-store`, audited (`admin.export`, shape only). Contact details only when
explicitly chosen (always for the recruitment list). Internal notes are never exported.
Cells beginning with `= + - @` (or tab/CR) are prefixed to defeat spreadsheet formula
injection.
