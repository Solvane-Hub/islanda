import { createHash, randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminClient, adminConfigured, anonClient, rlsConfigured, RUN, signIn } from './client';

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

/**
 * Survey + pilot recruitment (20261017000000_waitlist_survey_and_recruitment).
 *
 * Proves, live: the public can still only INSERT the contact columns; survey
 * answers reach a row only through the token-gated function; recruitment is
 * invisible and immutable to visitors and founders; and only a
 * `waitlist_admin` can read the list or change recruitment — and even then
 * never the token hash or the contact columns.
 */
describe.skipIf(!rlsConfigured)('Row Level Security — waitlist survey and recruitment', () => {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const email = `${RUN}-survey@example.dev`.toLowerCase();

  it('a visitor can insert a signup carrying a survey token hash and a phone', async () => {
    const { error } = await anonClient().from('waitlist_signups').insert({
      email,
      first_name: 'Survey',
      last_name: 'Tester',
      phone: '(242) 555-0123',
      source: 'landing_page',
      survey_token_hash: tokenHash,
    });
    expect(error).toBeNull();
  });

  it('a visitor cannot set recruitment status, survey answers or a signup date at insert', async () => {
    const attempts = [
      { recruitment_status: 'confirmed' },
      { testing_interest: 'yes' },
      { created_at: '2020-01-01T00:00:00Z' },
    ];
    for (const [i, extra] of attempts.entries()) {
      const { error } = await anonClient()
        .from('waitlist_signups')
        .insert({
          email: `${RUN}-sneaky-${i}@example.dev`,
          first_name: 'X',
          last_name: 'Y',
          ...extra,
        } as never);
      expect(error).not.toBeNull(); // column-level INSERT grant excludes these
    }
  });

  it('the database rejects a malformed phone number', async () => {
    const { error } = await anonClient()
      .from('waitlist_signups')
      .insert({
        email: `${RUN}-bad-phone@example.dev`,
        first_name: 'X',
        last_name: 'Y',
        phone: 'call me',
      });
    expect(error).not.toBeNull(); // ws_phone_format
  });

  it('the survey function accepts the right token and reveals nothing for a wrong one', async () => {
    const anon = anonClient();
    const wrong = await anon.rpc('submit_waitlist_survey', {
      p_token: randomBytes(32).toString('base64url'),
      p_testing_interest: 'yes',
    });
    expect(wrong.error).toBeNull();
    expect(wrong.data).toBe(false);

    const answers = {
      p_country: 'The Bahamas',
      p_city_island: 'Exuma',
      p_business_stage: 'trying_to_register' as const,
      p_biggest_challenge: 'other' as const,
      p_challenge_other: 'Finding a shop',
      p_testing_interest: 'yes' as const,
    };
    const right = await anon.rpc('submit_waitlist_survey', { p_token: token, ...answers });
    expect(right.error).toBeNull();
    expect(right.data).toBe(true);

    // Submitting again updates the same row — it never creates another.
    const again = await anon.rpc('submit_waitlist_survey', {
      p_token: token,
      ...answers,
      p_business_stage: 'already_operating',
    });
    expect(again.data).toBe(true);
  });

  it('a visitor still cannot read anything back', async () => {
    const { data } = await anonClient()
      .from('waitlist_signups')
      .select('id, testing_interest')
      .eq('email', email);
    expect(data ?? []).toHaveLength(0);
  });

  it('a signed-in founder cannot read, change recruitment, or grant themselves a role', async () => {
    const { db, userId } = await signIn('A');

    const read = await db.from('waitlist_signups').select('id').eq('email', email);
    expect(read.data ?? []).toHaveLength(0);

    const update = await db
      .from('waitlist_signups')
      .update({ recruitment_status: 'tested' })
      .eq('email', email)
      .select('id');
    expect(update.data ?? []).toHaveLength(0); // RLS: no visible row to update

    const grant = await db
      .from('staff_members')
      .insert({ user_id: userId, role: 'waitlist_admin' });
    expect(grant.error).not.toBeNull(); // no INSERT grant or policy

    const tokenRead = await db.from('waitlist_signups').select('survey_token_hash').limit(1);
    expect(tokenRead.error).not.toBeNull(); // no column grant, for anyone
  });

  describe.skipIf(!adminConfigured)('as a waitlist_admin', () => {
    let staffUserId = '';

    beforeAll(async () => {
      const { userId } = await signIn('B');
      staffUserId = userId;
      const { error } = await adminClient()
        .from('staff_members')
        .insert({ user_id: staffUserId, role: 'waitlist_admin' });
      if (error && error.code !== '23505') throw error;
    });

    afterAll(async () => {
      if (staffUserId) {
        await adminClient()
          .from('staff_members')
          .delete()
          .eq('user_id', staffUserId)
          .eq('role', 'waitlist_admin');
      }
    });

    it('can read the signup with its answers; answering did not touch recruitment', async () => {
      const { db } = await signIn('B');
      const { data, error } = await db
        .from('waitlist_signups')
        .select(
          'phone, survey_country, business_stage, challenge_other, testing_interest, survey_completed_at, recruitment_status, recruitment_updated_at',
        )
        .eq('email', email)
        .single();
      expect(error).toBeNull();
      expect(data).toMatchObject({
        phone: '(242) 555-0123',
        survey_country: 'The Bahamas',
        business_stage: 'already_operating',
        challenge_other: 'Finding a shop',
        testing_interest: 'yes',
        recruitment_status: 'not_contacted',
        recruitment_updated_at: null,
      });
      expect(data?.survey_completed_at).not.toBeNull();
    });

    it('can update recruitment status and notes, which stamps the update time', async () => {
      const { db } = await signIn('B');
      const { data, error } = await db
        .from('waitlist_signups')
        .update({ recruitment_status: 'contacted', recruitment_notes: 'Called; prefers WhatsApp.' })
        .eq('email', email)
        .select('recruitment_status, recruitment_updated_at')
        .single();
      expect(error).toBeNull();
      expect(data?.recruitment_status).toBe('contacted');
      expect(data?.recruitment_updated_at).not.toBeNull();
    });

    it('cannot change contact details or survey answers', async () => {
      const { db } = await signIn('B');
      for (const change of [{ email: `${RUN}-x@example.dev` }, { testing_interest: 'maybe' }]) {
        const { error } = await db
          .from('waitlist_signups')
          .update(change as never)
          .eq('email', email);
        expect(error).not.toBeNull(); // column-level UPDATE grant covers recruitment only
      }
    });

    it('still cannot read the token hash', async () => {
      const { db } = await signIn('B');
      const { error } = await db
        .from('waitlist_signups')
        .select('survey_token_hash')
        .eq('email', email);
      expect(error).not.toBeNull();
    });
  });
});
