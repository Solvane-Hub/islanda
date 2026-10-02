import type { BusinessPassport } from '@/services/passport';

/**
 * Shared, pure derivations used by the Cover board, the Overview page and the
 * State page — one source for the reference code, the Business State rows and
 * the next-action cascade, so those presentations can never drift into
 * disagreeing about the same business.
 */

/**
 * The Passport reference shown on the cover — a deterministic, cosmetic code
 * derived from the business id, never stored and never an official
 * identifier. It exists so the cover reads as "a specific document" rather
 * than a generic template; it carries no legal or governmental meaning.
 */
export function passportReference(businessId: string): string {
  return businessId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

export interface StateRow {
  label: string;
  value: string;
  href: string;
}

export function businessStateRows(passport: BusinessPassport): StateRow[] {
  const { financials, goals, documents, completeness } = passport;
  return [
    {
      label: 'Financials',
      value: financials.hasData ? 'Available' : 'Not started',
      href: '/dashboard#financials',
    },
    {
      label: 'Goals',
      value: goals.length > 0 ? `${goals.length} active` : 'Not started',
      href: '/dashboard#goals',
    },
    {
      label: 'Documents',
      value: documents.length > 0 ? `${documents.length} records` : 'None yet',
      href: '/documents',
    },
    {
      label: 'Profile',
      value: completeness.intake.isComplete
        ? 'Complete'
        : `${completeness.intake.percent}% complete`,
      href: '/intake',
    },
  ];
}

/**
 * The single most useful next step, deterministically — not a task list, one
 * answer. This is a Passport-native cascade over Passport's own completeness
 * fields; it does not import or duplicate `buildJourney`/`DashboardPriorities`
 * (dashboard-specific machinery, out of scope to touch this milestone) — it
 * simply reasons over the same category of real state via its own read.
 */
export function nextAction(passport: BusinessPassport): { label: string; href: string } {
  const { completeness, financials, goals, documents } = passport;
  if (!completeness.intake.isComplete) {
    return { label: 'Complete your business profile', href: '/intake' };
  }
  if (!financials.hasData) {
    return { label: 'Record your first financial figure', href: '/dashboard#financials' };
  }
  if (goals.length === 0) {
    return { label: 'Set your first goal', href: '/dashboard#goals' };
  }
  if (documents.length === 0) {
    return { label: 'Add your first document', href: '/documents' };
  }
  return { label: 'Explore Nova', href: '/assistant' };
}
