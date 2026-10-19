/**
 * Pure helpers that turn a raw request into the few coarse attributes
 * analytics stores. No network, no storage — unit-tested directly.
 *
 * Privacy rules applied here:
 *   - a referrer keeps its HOST only (no path, no query, no fragment);
 *   - a page keeps its PATH only (no query string, no fragment);
 *   - a user agent becomes a device category and a browser family — the raw
 *     string is never stored.
 */

const BOT_PATTERN =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|vercel|monitor|uptime|pingdom|statuscake|curl|wget|python-requests|httpclient|axios|node-fetch|go-http|java\/|okhttp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|slack/i;

/** True for automated clients that should never count as visitors. Missing UA counts as a bot. */
export function isLikelyBot(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.length < 10) return true;
  return BOT_PATTERN.test(userAgent);
}

export type DeviceCategory = 'desktop' | 'mobile' | 'tablet' | 'unknown';

export function deviceCategory(userAgent: string | null | undefined): DeviceCategory {
  if (!userAgent) return 'unknown';
  if (/iPad|Tablet|PlayBook|Silk|Kindle/i.test(userAgent)) return 'tablet';
  if (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android|Windows Phone/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

/** Browser family only — never a version. Order matters: Edge and Opera also say "Chrome". */
export function browserFamily(userAgent: string | null | undefined): string {
  if (!userAgent) return 'Other';
  if (/Edg\//.test(userAgent)) return 'Edge';
  if (/OPR\/|Opera/.test(userAgent)) return 'Opera';
  if (/SamsungBrowser/.test(userAgent)) return 'Samsung Internet';
  if (/Firefox\/|FxiOS/.test(userAgent)) return 'Firefox';
  if (/Chrome\/|CriOS/.test(userAgent)) return 'Chrome';
  if (/Safari\//.test(userAgent)) return 'Safari';
  return 'Other';
}

/**
 * The referring site's host, or null for direct visits and internal
 * navigation (a referrer on one of `ownHosts`).
 */
export function referrerHost(
  referrer: string | null | undefined,
  ownHosts: string[],
): string | null {
  if (!referrer) return null;
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const own = ownHosts.map((h) => h.toLowerCase().replace(/^www\./, ''));
  if (!host || own.includes(host)) return null;
  return host.slice(0, 255);
}

/** Path only, normalised; null when it is not an internal path. */
export function cleanPath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return null;
  const withoutQuery = path.split(/[?#]/)[0] ?? '/';
  const trimmed = withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, '') : withoutQuery;
  return trimmed.slice(0, 300) || '/';
}

/**
 * Replaces ids in a path with a placeholder so an admin report groups
 * `/admin/users/<uuid>`-style pages together and never stores an id taken
 * from a URL.
 */
export function templatePath(path: string): string {
  return path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');
}

/** Signed-in application areas. Mirrors PROTECTED_PREFIXES in lib/supabase/proxy-session. */
export const PRODUCT_PATH_PREFIXES = [
  '/dashboard',
  '/intake',
  '/timeline',
  '/compliance',
  '/funding',
  '/documents',
  '/assistant',
  '/settings',
  '/businesses',
  '/passport',
  '/welcome',
  '/intelligence',
] as const;

export function isProductPath(path: string): boolean {
  return PRODUCT_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** UTM values: short, printable, lowercase. Anything else is dropped. */
export function cleanUtm(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (!v || v.length > 100) return null;
  return /^[\p{L}\p{N} ._+\-/:]+$/u.test(v) ? v : null;
}

/** ISO 3166-1 alpha-2 from a trusted platform header; anything else is dropped. */
export function countryCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(v) && v !== 'XX' ? v : null;
}
