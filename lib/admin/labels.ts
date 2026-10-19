/** Display names for admin report keys. One place, so tables, charts and exports agree. */

export const FUNNEL_STEP_LABELS: Record<string, string> = {
  visitors: 'Website visitors',
  form_started: 'Started the waitlist form',
  signed_up: 'Signed up',
  survey_started: 'Started the questionnaire',
  survey_completed: 'Completed the questionnaire',
  early_access_interest: 'Interested in early access (yes or maybe)',
  pilot_confirmed: 'Confirmed pilot participant',
  tested: 'Tested Islanda',
};

export const FEATURE_LABELS: Record<string, string> = {
  account: 'Account & sign-in',
  onboarding: 'Onboarding & intake',
  nova: 'Nova assistant',
  documents: 'Documents & evidence',
  finances: 'Finances & metrics',
  goals: 'Goals',
  business_cases: 'Business cases',
  business_profile: 'Business profile',
  dashboard: 'Dashboard',
  settings: 'Settings',
  timeline: 'Timeline (preview)',
  compliance: 'Compliance (preview)',
  funding: 'Funding (preview)',
  other: 'Other pages',
};

export function featureLabel(key: string | null): string {
  if (!key) return '—';
  return FEATURE_LABELS[key] ?? key;
}

/** Human wording for an audit event key, e.g. "intake.step_saved" → "Intake · step saved". */
export function eventLabel(event: string): string {
  const [area, action] = event.split('.', 2);
  if (!action) return event;
  return `${area!.charAt(0).toUpperCase()}${area!.slice(1)} · ${action.replace(/_/g, ' ')}`;
}
