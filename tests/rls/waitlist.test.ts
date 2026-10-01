import { describe, expect, it } from 'vitest';
import { anonClient, rlsConfigured, RUN, signIn } from './client';

/**
 * Row Level Security — public waitlist (`waitlist_signups`).
 *
 * Unlike every other table in this schema, this one has no owner and no
 * `app.business_access()` seam at all: it is intentionally reachable by
 * `anon`, but only through a single narrow door (INSERT). This suite proves
 * that door is the only one — a public visitor can create a signup, but can
 * never read any row (including the one they just created), update anything,
 * or delete anything, and that a duplicate email is rejected at the database
 * layer regardless of what the application layer does with that rejection.
 */
describe.skipIf(!rlsConfigured)('Row Level Security — waitlist_signups', () => {
  const email = `${RUN}-waitlist@example.dev`.toLowerCase();

  it('an anonymous visitor can INSERT a signup', async () => {
    const anon = anonClient();
    const { error } = await anon.from('waitlist_signups').insert({
      email,
      first_name: 'Founder',
      last_name: 'Founder',
      source: 'landing_page',
    });
    expect(error).toBeNull();
  });

  it('the database rejects a duplicate email regardless of case', async () => {
    const anon = anonClient();
    const { error } = await anon.from('waitlist_signups').insert({
      email: email.toUpperCase(),
      first_name: 'Founder',
      last_name: 'Founder',
      source: 'landing_page',
    });
    expect(error).not.toBeNull(); // waitlist_signups_email_unique_idx on lower(email)
  });

  it('the database rejects a malformed email', async () => {
    const anon = anonClient();
    const { error } = await anon.from('waitlist_signups').insert({
      email: `${RUN}-not-an-email`,
      first_name: 'Founder',
      last_name: 'Founder',
      source: 'landing_page',
    });
    expect(error).not.toBeNull(); // ws_email_format
  });

  it('an anonymous visitor cannot read any signup, including their own', async () => {
    const anon = anonClient();
    const { data } = await anon.from('waitlist_signups').select('id').eq('email', email);
    expect(data ?? []).toHaveLength(0);
  });

  it('an anonymous visitor cannot update a signup', async () => {
    const anon = anonClient();
    const { error, data } = await anon
      .from('waitlist_signups')
      .update({ status: 'invited' } as never)
      .eq('email', email)
      .select('id');
    expect(error).not.toBeNull(); // no UPDATE grant/policy
    expect(data ?? []).toHaveLength(0);
  });

  it('an anonymous visitor cannot delete a signup', async () => {
    const anon = anonClient();
    const { error, data } = await anon
      .from('waitlist_signups')
      .delete()
      .eq('email', email)
      .select('id');
    expect(error).not.toBeNull(); // no DELETE grant/policy
    expect(data ?? []).toHaveLength(0);
  });

  it('a signed-in founder cannot read the waitlist either', async () => {
    const { db } = await signIn('A');
    const { data } = await db.from('waitlist_signups').select('id').limit(1);
    expect(data ?? []).toHaveLength(0);
  });

  it('a signed-in founder can also join the waitlist (no auth required, none forbidden)', async () => {
    const { db } = await signIn('B');
    const { error } = await db.from('waitlist_signups').insert({
      email: `${RUN}-founder-b@example.dev`.toLowerCase(),
      first_name: 'Founder',
      last_name: 'B',
      source: 'landing_page',
    });
    expect(error).toBeNull();
  });

  describe('rate limiting (the anon grant extension this migration adds)', () => {
    it('an anonymous caller can now invoke consume_rate_limit, and it denies past the limit', async () => {
      const anon = anonClient();
      const scope = `${RUN}-waitlist-rate-test`;
      const subject = `${RUN}-rate-subject`;

      let lastAllowed = true;
      for (let i = 0; i < 6; i++) {
        const { data, error } = await anon.rpc('consume_rate_limit', {
          p_scope: scope,
          p_subject_id: subject,
          p_window_seconds: 3600,
          p_limit: 5,
        });
        expect(error).toBeNull(); // anon can call it at all — the grant this migration adds
        lastAllowed = Boolean(data?.[0]?.allowed);
      }
      // The 6th call against a limit of 5 must be denied.
      expect(lastAllowed).toBe(false);
    });
  });
});
