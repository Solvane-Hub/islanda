import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  createClient: vi.fn(),
  signUp: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock('@/lib/env', () => ({ serverEnv: { WAITLIST_ONLY_MODE: true } }));
vi.mock('@/lib/supabase/server', () => ({ createClient: h.createClient }));
vi.mock('@/services/auth', () => ({ signUp: h.signUp, signIn: h.signIn }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

import { signInAction, signUpAction } from '@/app/(auth)/actions';
import { updateSession } from '@/lib/supabase/proxy-session';

describe('waitlist-only access gate', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['/dashboard', '/documents', '/assistant', '/settings', '/businesses', '/intake'])(
    'redirects direct requests to %s back to the public waitlist',
    async (path) => {
      const response = await updateSession(new NextRequest(`https://islanda.test${path}`));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('https://islanda.test/?access=waitlist');
    },
  );

  it('redirects direct requests to login and signup to the waitlist experience', async () => {
    const response = await updateSession(new NextRequest('https://islanda.test/signup'));
    expect(response.headers.get('location')).toBe('https://islanda.test/?access=waitlist');
  });

  it('keeps the public landing page available without contacting Supabase Auth', async () => {
    const response = await updateSession(new NextRequest('https://islanda.test/'));
    expect(response.status).toBe(200);
    expect(h.createClient).not.toHaveBeenCalled();
  });

  it('rejects direct signup action calls before creating an auth client', async () => {
    const result = await signUpAction(null, new FormData());
    expect(result).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(h.createClient).not.toHaveBeenCalled();
    expect(h.signUp).not.toHaveBeenCalled();
  });

  it('rejects direct sign-in action calls before creating an auth client', async () => {
    const result = await signInAction(null, new FormData());
    expect(result).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(h.createClient).not.toHaveBeenCalled();
    expect(h.signIn).not.toHaveBeenCalled();
  });
});
