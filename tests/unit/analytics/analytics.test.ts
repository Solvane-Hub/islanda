import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  admin: { ok: true } as unknown,
  env: {
    ANALYTICS_HASH_SECRET: 's'.repeat(40),
    ANALYTICS_ENABLED: undefined as boolean | undefined,
    VERCEL_ENV: 'production' as string | undefined,
  },
}));

vi.mock('@/lib/env', () => ({
  serverEnv: mocks.env,
  clientEnv: { NEXT_PUBLIC_APP_URL: 'https://www.islanda.app' },
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => mocks.admin }));
vi.mock('@/lib/db/analytics', () => ({ insertAnalyticsEvents: mocks.insert }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));

import {
  browserFamily,
  cleanPath,
  cleanUtm,
  countryCode,
  deviceCategory,
  isLikelyBot,
  referrerHost,
  templatePath,
} from '@/lib/analytics/classify';
import {
  analyticsEnabled,
  errorCategoryFor,
  ingestClientEvent,
  recordServerEvent,
  visitorKey,
  type AnalyticsRequestContext,
} from '@/services/analytics';

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

function ctx(extra: Partial<AnalyticsRequestContext> = {}): AnalyticsRequestContext {
  return {
    ip: '203.0.113.7',
    userAgent: CHROME,
    country: 'BS',
    consent: null,
    visitorId: null,
    ownHosts: ['islanda.app', 'www.islanda.app'],
    ...extra,
  };
}

const EVENT = {
  id: '6f1c2f2e-6a59-4c55-9f4b-1d4c5f0c8a11',
  name: 'page_view',
  path: '/?utm_source=ig&email=ada@example.com#top',
  referrer: 'https://www.instagram.com/p/abc?x=1',
  utm: { source: 'Instagram', medium: 'social', campaign: 'launch-oct' },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.insert.mockResolvedValue({ error: null });
  mocks.admin = { ok: true };
  mocks.env.ANALYTICS_ENABLED = undefined;
  mocks.env.VERCEL_ENV = 'production';
});

describe('environment gate (one shared database)', () => {
  it('records on the production deployment', async () => {
    expect(analyticsEnabled()).toBe(true);
    expect(await ingestClientEvent(EVENT, ctx(), null)).toBe('stored');
  });

  it('records nothing locally, in CI or on preview deployments', async () => {
    for (const env of [undefined, 'preview', 'development']) {
      mocks.env.VERCEL_ENV = env;
      expect(analyticsEnabled()).toBe(false);
      expect(await ingestClientEvent(EVENT, ctx(), null)).toBe('disabled');
      await recordServerEvent({ name: 'waitlist_signup_succeeded', path: '/' }, ctx());
    }
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('an explicit ANALYTICS_ENABLED overrides the default both ways', () => {
    mocks.env.VERCEL_ENV = 'preview';
    mocks.env.ANALYTICS_ENABLED = true;
    expect(analyticsEnabled()).toBe(true);
    mocks.env.VERCEL_ENV = 'production';
    mocks.env.ANALYTICS_ENABLED = false;
    expect(analyticsEnabled()).toBe(false);
  });
});

describe('classification', () => {
  it('filters bots, monitors, scripts and empty user agents', () => {
    for (const ua of [
      'Googlebot/2.1',
      'Mozilla/5.0 (compatible; Vercelbot/0.1)',
      'curl/8.0',
      'UptimeRobot/2.0',
      'facebookexternalhit/1.1',
      'HeadlessChrome/120',
      '',
      null,
    ]) {
      expect(isLikelyBot(ua)).toBe(true);
    }
    expect(isLikelyBot(CHROME)).toBe(false);
    expect(isLikelyBot(IPHONE)).toBe(false);
  });

  it('reduces a user agent to a device category and browser family', () => {
    expect(deviceCategory(CHROME)).toBe('desktop');
    expect(deviceCategory(IPHONE)).toBe('mobile');
    expect(deviceCategory('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe('tablet');
    expect(browserFamily(CHROME)).toBe('Chrome');
    expect(browserFamily(IPHONE)).toBe('Safari');
    expect(browserFamily('Mozilla/5.0 Chrome/130 Safari/537 Edg/130')).toBe('Edge');
  });

  it('keeps only the referring host, and drops internal referrers', () => {
    expect(referrerHost('https://www.instagram.com/p/abc?x=1', ['islanda.app'])).toBe(
      'instagram.com',
    );
    expect(referrerHost('https://www.islanda.app/faq', ['islanda.app'])).toBeNull();
    expect(referrerHost('javascript:alert(1)', [])).toBeNull();
    expect(referrerHost('not a url', [])).toBeNull();
  });

  it('keeps only the path — never a query string that might carry personal data', () => {
    expect(cleanPath('/?email=ada@example.com#x')).toBe('/');
    expect(cleanPath('/faq/')).toBe('/faq');
    expect(cleanPath('//evil.com')).toBeNull();
    expect(cleanPath('https://evil.com/')).toBeNull();
    expect(templatePath('/admin/users/6f1c2f2e-6a59-4c55-9f4b-1d4c5f0c8a11')).toBe(
      '/admin/users/:id',
    );
  });

  it('accepts only short printable UTM values and two-letter countries', () => {
    expect(cleanUtm(' Instagram ')).toBe('instagram');
    expect(cleanUtm('<script>')).toBeNull();
    expect(cleanUtm('x'.repeat(101))).toBeNull();
    expect(countryCode('bs')).toBe('BS');
    expect(countryCode('XX')).toBeNull();
    expect(countryCode('Bahamas')).toBeNull();
  });
});

describe('visitorKey', () => {
  it('uses the consented first-party id when consent was granted', () => {
    const id = '0b7a2a62-6f6b-4c8e-9d5f-2b2b0a0e9e11';
    expect(visitorKey(ctx({ consent: 'granted', visitorId: id }))).toBe(`c:${id}`);
  });

  it('ignores an id without consent, and a malformed id even with consent', () => {
    expect(
      visitorKey(ctx({ consent: 'denied', visitorId: '0b7a2a62-6f6b-4c8e-9d5f-2b2b0a0e9e11' })),
    ).toMatch(/^d:/);
    expect(visitorKey(ctx({ consent: 'granted', visitorId: "x' or 1=1" }))).toMatch(/^d:/);
  });

  it('without consent: a keyed hash that rotates daily and never contains the IP', () => {
    const day1 = visitorKey(ctx(), new Date('2026-10-19T10:00:00Z'))!;
    const sameDay = visitorKey(ctx(), new Date('2026-10-19T23:00:00Z'));
    const day2 = visitorKey(ctx(), new Date('2026-10-20T01:00:00Z'));
    expect(day1).toMatch(/^d:[0-9a-f]{64}$/);
    expect(sameDay).toBe(day1);
    expect(day2).not.toBe(day1);
    expect(day1).not.toContain('203.0.113.7');
  });
});

describe('ingestClientEvent', () => {
  it('stores a minimal row: path without query, referrer host, cleaned UTM, coarse device', async () => {
    expect(await ingestClientEvent(EVENT, ctx(), null)).toBe('stored');
    const row = mocks.insert.mock.calls[0]![1][0];
    expect(row).toMatchObject({
      event_id: EVENT.id,
      kind: 'web',
      event_name: 'page_view',
      path: '/',
      referrer_host: 'instagram.com',
      utm_source: 'instagram',
      utm_medium: 'social',
      utm_campaign: 'launch-oct',
      country_code: 'BS',
      device: 'desktop',
      browser: 'Chrome',
      user_id: null,
    });
    expect(JSON.stringify(row)).not.toMatch(/ada@example\.com|203\.0\.113\.7|Mozilla/);
  });

  it('drops bots before anything is stored', async () => {
    expect(await ingestClientEvent(EVENT, ctx({ userAgent: 'Googlebot/2.1' }), null)).toBe(
      'ignored_bot',
    );
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('refuses event names the browser may not send (server-verified conversions)', async () => {
    expect(
      await ingestClientEvent({ ...EVENT, name: 'waitlist_signup_succeeded' }, ctx(), null),
    ).toBe('ignored_invalid');
    expect(await ingestClientEvent({ ...EVENT, name: 'anything' }, ctx(), null)).toBe(
      'ignored_invalid',
    );
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('never tracks admin, API or auth paths', async () => {
    for (const path of ['/admin', '/admin/waitlist', '/api/x', '/auth/callback']) {
      expect(await ingestClientEvent({ ...EVENT, path }, ctx(), null)).toBe('ignored_path');
    }
  });

  it('attaches the verified user id to application pages only', async () => {
    await ingestClientEvent({ ...EVENT, path: '/dashboard' }, ctx(), 'user-1');
    await ingestClientEvent(
      { ...EVENT, path: '/', id: '7f1c2f2e-6a59-4c55-9f4b-1d4c5f0c8a11' },
      ctx(),
      'user-1',
    );
    expect(mocks.insert.mock.calls[0]![1][0]).toMatchObject({ kind: 'product', user_id: 'user-1' });
    expect(mocks.insert.mock.calls[1]![1][0]).toMatchObject({ kind: 'web', user_id: null });
  });

  it('rejects oversized or free-text properties', async () => {
    const props = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`k${i}`, 1]));
    expect(await ingestClientEvent({ ...EVENT, props }, ctx(), null)).toBe('ignored_invalid');
    expect(
      await ingestClientEvent({ ...EVENT, props: { note: 'x'.repeat(101) } }, ctx(), null),
    ).toBe('ignored_invalid');
    expect(await ingestClientEvent({ ...EVENT, props: { 'Bad Key': 1 } }, ctx(), null)).toBe(
      'ignored_invalid',
    );
  });

  it('fails open: storage problems are swallowed and reported as unavailable', async () => {
    mocks.insert.mockResolvedValue({ error: 'boom' });
    expect(await ingestClientEvent(EVENT, ctx(), null)).toBe('unavailable');
    mocks.admin = null;
    expect(await ingestClientEvent(EVENT, ctx(), null)).toBe('unavailable');
  });
});

describe('recordServerEvent', () => {
  it('stores the outcome with a safe category and the same visitor key as the browser', async () => {
    await recordServerEvent(
      {
        name: 'waitlist_signup_failed',
        path: '/',
        status: 'failure',
        errorCategory: 'rate_limited',
      },
      ctx(),
    );
    const row = mocks.insert.mock.calls[0]![1][0];
    expect(row).toMatchObject({
      event_name: 'waitlist_signup_failed',
      status: 'failure',
      error_category: 'rate_limited',
      visitor_key: visitorKey(ctx()),
    });
  });

  it('maps application error codes to safe categories', () => {
    expect(errorCategoryFor('VALIDATION_FAILED')).toBe('validation');
    expect(errorCategoryFor('AUTH_RATE_LIMITED')).toBe('rate_limited');
    expect(errorCategoryFor('something weird')).toBe('unexpected');
  });
});
