import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashSurveyToken, joinWaitlist, submitWaitlistSurvey } from '@/services/waitlist';

/**
 * The public waitlist service against a fake Supabase client. The real
 * database rules (unique email, column grants, the token-gated function) are
 * proven live in tests/rls/waitlist.test.ts; this suite pins what the service
 * sends and how it interprets the answers.
 */

const TOKEN = 'b'.repeat(43);

function fakeDb(opts: { insertError?: { code: string } | null; rpcResult?: unknown } = {}) {
  const insert = vi.fn().mockResolvedValue({ error: opts.insertError ?? null });
  const rpc = vi.fn().mockResolvedValue({ data: opts.rpcResult ?? true, error: null });
  const db = { from: vi.fn(() => ({ insert })), rpc };
  return { db: db as never, insert, rpc };
}

describe('joinWaitlist', () => {
  beforeEach(() => vi.clearAllMocks());

  it('stores the hash of a fresh survey token — never the token — and returns the token', async () => {
    const { db, insert } = fakeDb();
    const result = await joinWaitlist(db, {
      email: ' Ada@Example.com ',
      firstName: 'Ada',
      lastName: 'Lovelace',
      source: 'landing_page',
    });

    expect(result.status).toBe('joined');
    if (result.status !== 'joined') throw new Error('unreachable');
    expect(result.surveyToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const row = insert.mock.calls[0]![0];
    expect(row).toMatchObject({
      email: 'ada@example.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
    });
    expect(row.survey_token_hash).toBe(
      createHash('sha256').update(result.surveyToken).digest('hex'),
    );
    expect(JSON.stringify(row)).not.toContain(result.surveyToken);
    // Nothing the visitor does at signup can set recruitment or survey fields.
    expect(Object.keys(row).sort()).toEqual(
      ['email', 'first_name', 'last_name', 'source', 'survey_token_hash'].sort(),
    );
  });

  it('includes the optional phone number when given', async () => {
    const { db, insert } = fakeDb();
    await joinWaitlist(db, {
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: ' (242) 555-0123 ',
      source: 'landing_page',
    });
    expect(insert.mock.calls[0]![0].phone).toBe('(242) 555-0123');
  });

  it('issues a different token on every signup', async () => {
    const { db } = fakeDb();
    const input = { email: 'a@example.com', firstName: 'A', lastName: 'B', source: 'x' };
    const a = await joinWaitlist(db, input);
    const b = await joinWaitlist(db, input);
    expect(a.status === 'joined' && b.status === 'joined' && a.surveyToken !== b.surveyToken).toBe(
      true,
    );
  });

  it('a duplicate email is "already on the list", with no survey token', async () => {
    const { db } = fakeDb({ insertError: { code: '23505' } });
    const result = await joinWaitlist(db, {
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      source: 'landing_page',
    });
    expect(result).toEqual({ status: 'already_on_list' });
  });

  it('rethrows any other database error', async () => {
    const { db } = fakeDb({ insertError: { code: '42501' } });
    await expect(
      joinWaitlist(db, { email: 'a@example.com', firstName: 'A', lastName: 'B', source: 'x' }),
    ).rejects.toMatchObject({ code: '42501' });
  });
});

describe('submitWaitlistSurvey', () => {
  const input = (answers: Record<string, unknown>, final = false) =>
    ({ token: TOKEN, final, answers }) as never;

  it('writes only the answers present, through the token-gated function', async () => {
    const { db, rpc } = fakeDb({ rpcResult: true });
    const result = await submitWaitlistSurvey(
      db,
      input({
        country: 'Barbados',
        industry: 'other',
        industryOther: 'Boat repair',
        businessJourney: undefined,
      }),
    );
    expect(result).toEqual({ status: 'saved' });
    expect(rpc).toHaveBeenCalledWith('save_waitlist_survey', {
      p_token: TOKEN,
      p_answers: { country: 'Barbados', industry: 'other', industryOther: 'Boat repair' },
      p_final: false,
    });
    // No insert, no direct table write: answers can never create a signup.
    expect((db as unknown as { from: ReturnType<typeof vi.fn> }).from).not.toHaveBeenCalled();
  });

  it('marks the questionnaire complete only on the final submit', async () => {
    const { db, rpc } = fakeDb({ rpcResult: true });
    await submitWaitlistSurvey(db, input({ additionalInfo: 'Need a food licence' }, true));
    expect(rpc.mock.calls[0]![1].p_final).toBe(true);
  });

  it('an empty save with nothing stored before writes nothing (same as skipping)', async () => {
    const { db, rpc } = fakeDb({ rpcResult: null });
    expect(await submitWaitlistSurvey(db, input({}, true))).toEqual({ status: 'empty' });
    // Only the read-back of stored answers was made; no save.
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['get_waitlist_survey']);
  });

  it('a final submit with nothing new still completes when earlier sections were saved', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: { country: 'Barbados', completed: false }, error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    const db = { from: vi.fn(), rpc } as never;
    expect(await submitWaitlistSurvey(db, input({ additionalInfo: null }, true))).toEqual({
      status: 'saved',
    });
    expect(rpc.mock.calls[1]![0]).toBe('save_waitlist_survey');
  });

  it('reports an unknown token as not_found', async () => {
    const { db } = fakeDb({ rpcResult: false });
    expect(await submitWaitlistSurvey(db, input({ testingInterest: 'maybe' }))).toEqual({
      status: 'not_found',
    });
  });

  it('hashes tokens exactly as the database function does (sha256, hex)', () => {
    expect(hashSurveyToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
