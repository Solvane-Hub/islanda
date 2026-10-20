/**
 * What Islanda can actually do — the single source of truth for availability
 * AND for release.
 *
 * The public site and the app navigation both read from this register, so
 * they cannot drift into describing two different products. Every `status`
 * below was set by tracing the capability to the code that implements it (see
 * docs/product/availability.md for the trace), not from the roadmap.
 *
 *   available            — built, wired to real services, covered by tests.
 *   needs_configuration  — built, but only works when an operator configures it
 *                          (an API key, an environment flag), or is switched off
 *                          for an operational reason.
 *   in_development       — not built.
 *
 * ## Build privately, release deliberately
 *
 * A capability is RELEASED only when it is `available` AND `released: true`.
 * Released capabilities are the only ones a visitor or an ordinary signed-in
 * user ever sees: public pages describe nothing else, and the app shows no
 * "coming soon" cards, badges or placeholder pages. Unreleased work stays in
 * the codebase and is reachable only in internal environments (local, preview)
 * — see `lib/product/release.ts`, which also 404s unreleased routes in
 * production. Releasing something is a one-line change here.
 *
 * Release is not authorization: a released route still requires a session and
 * RLS still decides what it returns.
 *
 * Pure data: no I/O, no server-only imports, safe in Client Components.
 */

export type AvailabilityStatus = 'available' | 'needs_configuration' | 'in_development';

export type CapabilityId =
  | 'business_profile'
  | 'guided_questions'
  | 'business_summary'
  | 'documents'
  | 'goals'
  | 'money_records'
  | 'cited_answers'
  | 'financial_answers'
  | 'requirements_guidance'
  | 'important_dates'
  | 'funding';

export interface Capability {
  id: CapabilityId;
  status: AvailabilityStatus;
  /** Short customer-facing name. */
  name: string;
  /** One plain sentence: what it does for the person, not how it works. */
  summary: string;
  /**
   * Deliberately released to users. Only released capabilities appear on public
   * pages or in the ordinary signed-in app; the rest are internal until flipped.
   */
  released: boolean;
}

export const CAPABILITIES: readonly Capability[] = [
  {
    id: 'business_profile',
    status: 'available',
    name: 'A profile for your business',
    summary: 'Give your business a name, the country it operates in, and what it does.',
    released: true,
  },
  {
    id: 'guided_questions',
    status: 'available',
    name: 'Five guided questions',
    summary:
      'Describe your business, your stage, your team, the money you may need and your goals. Your answers are saved as you go.',
    released: true,
  },
  {
    id: 'business_summary',
    status: 'available',
    name: 'Your business on one page',
    summary: 'See everything you have told Islanda in one place, and change it any time.',
    released: true,
  },
  {
    id: 'documents',
    status: 'available',
    name: 'Private document storage',
    summary:
      'Keep business files such as licences, invoices and statements together in private storage. Islanda stores them; it does not read them.',
    released: true,
  },
  {
    id: 'goals',
    status: 'available',
    name: 'Goals',
    summary: 'Write down what you want to achieve and track progress against figures you record.',
    released: true,
  },
  {
    id: 'money_records',
    status: 'available',
    name: 'Money and sales figures',
    summary:
      'Record figures such as sales and expenses for a month or quarter, and compare one period with another.',
    released: true,
  },
  {
    // The extractive Nova path. Built and tested, but its founder-facing release
    // is gated on the disclaimer and accountability decision (SF1/SF3), so it is
    // internal-only until that decision is made.
    id: 'cited_answers',
    status: 'available',
    name: 'Nova: answers quoted from official sources',
    summary:
      'Ask a question and see the exact words from the official documents Islanda holds, with a link to each source.',
    released: false,
  },
  {
    // Nova over the founder's own figures. The deterministic answers work; the
    // open-question path calls a model provider, and generative Nova is out of
    // scope until the ADR-0018 evaluation gates can be demonstrated.
    id: 'financial_answers',
    status: 'needs_configuration',
    name: 'Questions about your own figures',
    summary:
      'Ask about the sales and costs you have recorded, with each answer tied to your records.',
    released: false,
  },
  {
    id: 'requirements_guidance',
    status: 'in_development',
    name: 'Registration and licence guidance',
    summary:
      'Which registrations, licences and permits may apply to your business, each linked to the official source.',
    released: false,
  },
  {
    id: 'important_dates',
    status: 'in_development',
    name: 'Important dates',
    summary: 'The steps to take in order, and the deadlines and renewals to keep track of.',
    released: false,
  },
  {
    id: 'funding',
    status: 'in_development',
    name: 'Funding options',
    summary: 'Programmes and funding that may suit a business at your stage.',
    released: false,
  },
];

export function capability(id: CapabilityId): Capability {
  const found = CAPABILITIES.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown capability: ${id}`);
  return found;
}

/** Released: built, working, and deliberately switched on for users. */
export function isReleased(id: CapabilityId): boolean {
  const c = capability(id);
  return c.status === 'available' && c.released;
}

/**
 * Whether a person in this environment may see a capability. `showUnreleased`
 * comes from the server (`unreleasedVisible()` in lib/product/release.ts) and is
 * true only in internal environments.
 */
export function isVisible(id: CapabilityId, showUnreleased: boolean): boolean {
  return showUnreleased || isReleased(id);
}

/** What the homepage may present as usable today — released capabilities only. */
export function availableToday(): readonly Capability[] {
  return CAPABILITIES.filter((c) => isReleased(c.id));
}

/**
 * Who can get in today.
 *
 * Islanda has two access modes and no invitation mechanism:
 *   • waitlist — `WAITLIST_ONLY_MODE=true` (the production default). Sign-in,
 *     sign-up and every app route redirect to the public waitlist. Nobody can
 *     sign in to the founder app, including anyone who joined the waitlist.
 *     (Team staff sign in separately at `/admin/login`; see services/waitlist/recruitment.)
 *   • open — sign-up and sign-in work for anyone with an email address.
 *
 * The copy below is the only place either mode is described to a visitor, so
 * the homepage, the auth pages and the footer cannot contradict each other.
 */
export type AccessMode = 'waitlist' | 'open';

export function accessModeFrom(waitlistOnly: boolean): AccessMode {
  return waitlistOnly ? 'waitlist' : 'open';
}

export const ACCESS_COPY: Record<
  AccessMode,
  { statement: string; signInAvailable: boolean; signUpAvailable: boolean }
> = {
  waitlist: {
    statement:
      'Islanda is not open to the public yet. Join the early-access waitlist and we will email you when access opens.',
    signInAvailable: false,
    signUpAvailable: false,
  },
  open: {
    statement:
      'Islanda is in early access. You can create an account and use the features described below.',
    signInAvailable: true,
    signUpAvailable: true,
  },
};
