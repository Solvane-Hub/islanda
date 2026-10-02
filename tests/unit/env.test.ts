import { describe, expect, it } from 'vitest';
import { __testing } from '@/lib/env';

const { parseClientEnv, parseServerEnv } = __testing;

const validClient: Record<string, string | undefined> = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
};

describe('environment validation', () => {
  it('accepts a valid public configuration', () => {
    const env = parseClientEnv(validClient);
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://example.supabase.co');
  });

  it('defaults the app URL when omitted', () => {
    expect(parseClientEnv(validClient).NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000');
  });

  it('fails fast when a required variable is missing', () => {
    expect(() => parseClientEnv({})).toThrow(/Invalid or missing/);
  });

  it('names the offending variable in the error', () => {
    expect(() => parseClientEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('rejects a malformed URL rather than accepting it silently', () => {
    expect(() => parseClientEnv({ ...validClient, NEXT_PUBLIC_SUPABASE_URL: 'not-a-url' })).toThrow(
      /Invalid or missing/,
    );
  });

  it('rejects a Supabase URL that includes a path — the /rest/v1/ misconfiguration', () => {
    // Regression: a URL ending in /rest/v1/ produced /rest/v1//rest/v1/... and
    // 404'd every query, against a database where the tables plainly existed.
    expect(() =>
      parseClientEnv({
        ...validClient,
        NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co/rest/v1/',
      }),
    ).toThrow(/origin only/i);
  });

  it('rejects a Supabase URL with any path segment', () => {
    expect(() =>
      parseClientEnv({ ...validClient, NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co/auth' }),
    ).toThrow(/origin only/i);
  });

  it('strips a trailing slash from the Supabase URL', () => {
    const env = parseClientEnv({
      ...validClient,
      NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co/',
    });
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://abc.supabase.co');
  });

  it('strips a trailing slash from the app URL', () => {
    const env = parseClientEnv({ ...validClient, NEXT_PUBLIC_APP_URL: 'https://app.example.com/' });
    expect(env.NEXT_PUBLIC_APP_URL).toBe('https://app.example.com');
  });

  it('keeps auth available by default in development and tests', () => {
    expect(parseServerEnv({ NODE_ENV: 'development' }).WAITLIST_ONLY_MODE).toBe(false);
    expect(parseServerEnv({ NODE_ENV: 'test' }).WAITLIST_ONLY_MODE).toBe(false);
  });

  it('defaults production to waitlist-only mode', () => {
    expect(parseServerEnv({ NODE_ENV: 'production' }).WAITLIST_ONLY_MODE).toBe(true);
  });

  it('accepts an explicit waitlist mode setting', () => {
    expect(
      parseServerEnv({ NODE_ENV: 'production', WAITLIST_ONLY_MODE: 'false' }).WAITLIST_ONLY_MODE,
    ).toBe(false);
    expect(
      parseServerEnv({ NODE_ENV: 'development', WAITLIST_ONLY_MODE: 'true' }).WAITLIST_ONLY_MODE,
    ).toBe(true);
  });

  it('rejects invalid waitlist mode values', () => {
    expect(() => parseServerEnv({ NODE_ENV: 'production', WAITLIST_ONLY_MODE: 'yes' })).toThrow(
      /WAITLIST_ONLY_MODE/,
    );
  });

  it('treats the service role key as optional but typed', () => {
    expect(parseServerEnv({ NODE_ENV: 'test' }).NODE_ENV).toBe('test');
  });
});
