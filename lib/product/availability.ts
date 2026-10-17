/**
 * What Islanda can actually do — the single source of truth for availability.
 *
 * The public site, the app navigation and the in-app "coming later" copy all
 * read from this register, so they cannot drift into describing two different
 * products. Every `status` below was set by tracing the capability to the code
 * that implements it (see docs/product/availability.md for the trace), not from
 * the roadmap.
 *
 *   available            — built, wired to real services, covered by tests.
 *   needs_configuration  — built, but only works when an operator configures it
 *                          (an API key, an environment flag). Never advertised
 *                          publicly as a feature.
 *   in_development       — not built. May have a placeholder route that says so.
 *
 * Customer-facing copy translates these into plain words ("We're working on
 * this"), never into internal status names.
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
  /** Whether the public homepage may describe this as something you can use today. */
  publicToday: boolean;
}

export const CAPABILITIES: readonly Capability[] = [
  {
    id: 'business_profile',
    status: 'available',
    name: 'A profile for your business',
    summary: 'Give your business a name, the country it operates in, and what it does.',
    publicToday: true,
  },
  {
    id: 'guided_questions',
    status: 'available',
    name: 'Five guided questions',
    summary:
      'Describe your business, your stage, your team, the money you may need and your goals. Your answers are saved as you go.',
    publicToday: true,
  },
  {
    id: 'business_summary',
    status: 'available',
    name: 'Your business on one page',
    summary: 'See everything you have told Islanda in one place, and change it any time.',
    publicToday: true,
  },
  {
    id: 'documents',
    status: 'available',
    name: 'Private document storage',
    summary:
      'Keep business files such as licences, invoices and statements together in private storage. Islanda stores them; it does not read them.',
    publicToday: true,
  },
  {
    id: 'goals',
    status: 'available',
    name: 'Goals',
    summary: 'Write down what you want to achieve and track progress against figures you record.',
    publicToday: true,
  },
  {
    id: 'money_records',
    status: 'available',
    name: 'Money and sales figures',
    summary:
      'Record figures such as sales and expenses for a month or quarter, and compare one period with another.',
    publicToday: true,
  },
  {
    // The extractive Nova path. Built and tested, and reachable in the app, but
    // its founder-facing release is gated on the disclaimer and accountability
    // decision (SF1/SF3), so the public site describes it as in progress.
    id: 'cited_answers',
    status: 'available',
    name: 'Nova: answers quoted from official sources',
    summary:
      'Ask a question and see the exact words from the official documents Islanda holds, with a link to each source.',
    publicToday: false,
  },
  {
    id: 'requirements_guidance',
    status: 'in_development',
    name: 'Registration and licence guidance',
    summary:
      'Which registrations, licences and permits may apply to your business, each linked to the official source.',
    publicToday: false,
  },
  {
    id: 'important_dates',
    status: 'in_development',
    name: 'Important dates',
    summary: 'The steps to take in order, and the deadlines and renewals to keep track of.',
    publicToday: false,
  },
  {
    id: 'funding',
    status: 'in_development',
    name: 'Funding options',
    summary: 'Programmes and funding that may suit a business at your stage.',
    publicToday: false,
  },
];

export function capability(id: CapabilityId): Capability {
  const found = CAPABILITIES.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown capability: ${id}`);
  return found;
}

/** What the homepage may present as usable today. */
export function availableToday(): readonly Capability[] {
  return CAPABILITIES.filter((c) => c.status === 'available' && c.publicToday);
}

/** What the homepage presents as coming next — one list, no second roadmap. */
export function comingNext(): readonly Capability[] {
  return CAPABILITIES.filter((c) => !c.publicToday);
}

/** Customer wording for a status. Internal status names never reach the screen. */
export const STATUS_COPY: Record<AvailabilityStatus, string> = {
  available: 'Available',
  needs_configuration: 'Not switched on yet',
  in_development: "We're working on this",
};

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
      'Islanda is in early access. You can create an account and use the features marked as available below.',
    signInAvailable: true,
    signUpAvailable: true,
  },
};
