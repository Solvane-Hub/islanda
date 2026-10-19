/**
 * Islanda's first-party analytics vocabulary. Safe to import from the browser:
 * it holds names only, no credentials and no logic that touches data.
 *
 * Two sources, deliberately separate:
 *   - CLIENT events may be sent by the browser to /api/analytics. They describe
 *     what a visitor looked at or started — never the content of a form.
 *   - SERVER events are recorded by Server Actions after something actually
 *     happened (a signup saved, a save failed). The browser cannot send them,
 *     so a conversion count can never be inflated from the outside.
 *
 * Product workflow completions (business created, intake completed, Nova
 * answered, …) are NOT duplicated here: the application services already
 * record them in `audit_log`, and the admin reports read them from there.
 */

export const CLIENT_EVENTS = [
  'page_view',
  'waitlist_form_started',
  'waitlist_survey_started',
  'waitlist_survey_section_viewed',
  'waitlist_survey_skipped',
  'outbound_click',
] as const;

export const SERVER_EVENTS = [
  'waitlist_signup_succeeded',
  'waitlist_signup_duplicate',
  'waitlist_signup_failed',
  'waitlist_survey_saved',
  'waitlist_survey_completed',
  'waitlist_survey_failed',
  'product_action_failed',
] as const;

export type ClientEventName = (typeof CLIENT_EVENTS)[number];
export type ServerEventName = (typeof SERVER_EVENTS)[number];
export type AnalyticsEventName = ClientEventName | ServerEventName;

/** Safe error categories. Never a message, never user input. */
export const ERROR_CATEGORIES = [
  'validation',
  'rate_limited',
  'not_found',
  'forbidden',
  'unavailable',
  'unexpected',
] as const;
export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

/**
 * The visitor's analytics choice. Until they choose "granted", no persistent
 * identifier is stored on their device: visits are counted with a keyed hash
 * that rotates daily (see services/analytics).
 */
export const CONSENT_COOKIE = 'islanda_analytics_consent';
/** Random first-party id, set only after consent is granted. Never linked to an email. */
export const VISITOR_COOKIE = 'islanda_vid';
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Public endpoint that receives client events. */
export const ANALYTICS_ENDPOINT = '/api/analytics';

/** Path prefixes that never send analytics at all. */
export const UNTRACKED_PREFIXES = ['/admin', '/api', '/auth'] as const;
