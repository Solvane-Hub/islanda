import {
  ANALYTICS_ENDPOINT,
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_SECONDS,
  UNTRACKED_PREFIXES,
  VISITOR_COOKIE,
  type ClientEventName,
} from './events';

/**
 * Browser-side analytics. Sends one small JSON event per call to the
 * first-party endpoint with `navigator.sendBeacon` (falling back to a
 * keep-alive fetch). Never throws, never blocks, never sends form content.
 *
 * Only call from client components / effects.
 */

type Props = Record<string, string | number | boolean>;

function readCookie(name: string): string | null {
  try {
    const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
  } catch {
    return null;
  }
}

function writeCookie(name: string, value: string, maxAge: number): void {
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
  } catch {
    // Cookies blocked — analytics continues without a persistent identifier.
  }
}

/** Browser-level privacy signals. When present, no persistent identifier is ever created. */
export function privacySignalPresent(): boolean {
  try {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    return nav.globalPrivacyControl === true || navigator.doNotTrack === '1';
  } catch {
    return false;
  }
}

export type ConsentChoice = 'granted' | 'denied' | null;

export function getConsent(): ConsentChoice {
  const value = readCookie(CONSENT_COOKIE);
  return value === 'granted' || value === 'denied' ? value : null;
}

/**
 * Records the visitor's choice. "granted" creates a random first-party id;
 * "denied" removes any id. Either way the choice itself is remembered so the
 * prompt does not reappear.
 */
export function setConsent(choice: 'granted' | 'denied'): void {
  writeCookie(CONSENT_COOKIE, choice, CONSENT_MAX_AGE_SECONDS);
  if (choice === 'granted' && !privacySignalPresent()) {
    if (!readCookie(VISITOR_COOKIE))
      writeCookie(VISITOR_COOKIE, crypto.randomUUID(), CONSENT_MAX_AGE_SECONDS);
  } else {
    writeCookie(VISITOR_COOKIE, '', 0);
  }
}

/** Fired when the visitor asks to change their analytics choice (footer control). */
export const CONSENT_REOPEN_EVENT = 'islanda:analytics-choice';

/**
 * Withdraws the recorded choice and the identifier that came with it, then asks
 * the consent prompt to show again. Until the visitor chooses, visits count
 * only with the daily rotating key — the same as "No thanks".
 */
export function reopenConsent(): void {
  writeCookie(CONSENT_COOKIE, '', 0);
  writeCookie(VISITOR_COOKIE, '', 0);
  try {
    window.dispatchEvent(new Event(CONSENT_REOPEN_EVENT));
  } catch {
    // No window (tests, SSR) — nothing to reopen.
  }
}

function untracked(path: string): boolean {
  return UNTRACKED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

function utm(): { source: string | null; medium: string | null; campaign: string | null } {
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      source: params.get('utm_source'),
      medium: params.get('utm_medium'),
      campaign: params.get('utm_campaign'),
    };
  } catch {
    return { source: null, medium: null, campaign: null };
  }
}

export function track(name: ClientEventName, props?: Props): void {
  try {
    const path = window.location.pathname;
    if (untracked(path)) return;
    const payload = JSON.stringify({
      id: crypto.randomUUID(),
      name,
      path,
      referrer: document.referrer || null,
      utm: utm(),
      ...(props ? { props } : {}),
    });
    const blob = new Blob([payload], { type: 'application/json' });
    if (navigator.sendBeacon?.(ANALYTICS_ENDPOINT, blob)) return;
    void fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      body: payload,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => undefined);
  } catch {
    // Analytics never interferes with the page.
  }
}
