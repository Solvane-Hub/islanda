import { describe, expect, it } from 'vitest';
import {
  ACCESS_COPY,
  accessModeFrom,
  availableToday,
  CAPABILITIES,
  capability,
  comingNext,
  STATUS_COPY,
} from '@/lib/product/availability';
import { sourceStandingLabel, isUsedAsCurrentLaw } from '@/lib/knowledge/source-display';
import { CURRENT_LAW_LEGAL_STATUSES } from '@/types/knowledge';

/**
 * The availability register is the single source of truth the homepage, the
 * navigation and the dashboard read. These tests pin the claims that matter:
 * nothing unbuilt is ever offered as usable today, and the access copy never
 * offers a sign-in the waitlist gate would refuse.
 */
describe('availability register', () => {
  it('never lets the public site present an unbuilt capability as usable today', () => {
    for (const c of CAPABILITIES) {
      if (c.publicToday) expect(c.status, c.id).toBe('available');
    }
  });

  it('keeps registration and licence guidance, dates and funding marked as in development', () => {
    for (const id of ['requirements_guidance', 'important_dates', 'funding'] as const) {
      expect(capability(id).status, id).toBe('in_development');
      expect(capability(id).publicToday, id).toBe(false);
    }
  });

  it('holds Nova back from the public "today" list until its release is signed off', () => {
    // Built and reachable in the app, but founder-facing release is gated on
    // SF1/SF3 (CLAUDE.md), so the homepage describes it as being tested.
    expect(capability('cited_answers').status).toBe('available');
    expect(availableToday().map((c) => c.id)).not.toContain('cited_answers');
    expect(comingNext().map((c) => c.id)).toContain('cited_answers');
  });

  it('partitions every capability into exactly one public list', () => {
    const today = availableToday().map((c) => c.id);
    const next = comingNext().map((c) => c.id);
    expect([...today, ...next].sort()).toEqual(CAPABILITIES.map((c) => c.id).sort());
    expect(today.filter((id) => next.includes(id))).toEqual([]);
  });

  it('never claims completeness or official status in its own copy', () => {
    const all = CAPABILITIES.map((c) => `${c.name} ${c.summary}`).join(' ');
    expect(all).not.toMatch(/everything you need|complete requirements|all your requirements/i);
    expect(all).not.toMatch(/\bverified\b|\bofficial approval\b|government service/i);
  });

  it('describes statuses in customer words, never internal names', () => {
    for (const text of Object.values(STATUS_COPY)) {
      expect(text).not.toMatch(/_/);
    }
  });

  it('throws on an unknown capability rather than inventing one', () => {
    expect(() => capability('nope' as never)).toThrow();
  });
});

describe('access copy', () => {
  it('maps the waitlist flag to the access mode', () => {
    expect(accessModeFrom(true)).toBe('waitlist');
    expect(accessModeFrom(false)).toBe('open');
  });

  it('waitlist mode offers neither sign-in nor sign-up, because the gate refuses both', () => {
    expect(ACCESS_COPY.waitlist.signInAvailable).toBe(false);
    expect(ACCESS_COPY.waitlist.signUpAvailable).toBe(false);
    expect(ACCESS_COPY.waitlist.statement).toMatch(/not open to the public/i);
  });

  it('open mode offers both, and still says it is early access', () => {
    expect(ACCESS_COPY.open.signInAvailable).toBe(true);
    expect(ACCESS_COPY.open.signUpAvailable).toBe(true);
    expect(ACCESS_COPY.open.statement).toMatch(/early access/i);
  });

  it('never invents an invitation step that does not exist', () => {
    for (const { statement } of Object.values(ACCESS_COPY)) {
      expect(statement).not.toMatch(/invitation code|invite link|you have been invited/i);
    }
  });
});

describe('source standing labels', () => {
  it('labels exactly the statuses retrieval treats as current law as usable', () => {
    for (const status of [
      'in_force',
      'base_text_amended',
      'enacted_not_in_force',
      'repealed',
      'spent',
      'superseded',
      'unresolved',
    ] as const) {
      const current = CURRENT_LAW_LEGAL_STATUSES.includes(status);
      expect(isUsedAsCurrentLaw(status), status).toBe(current);
      expect(/not used as current law/.test(sourceStandingLabel(status)), status).toBe(!current);
    }
  });

  it('says a passed-but-not-commenced Act is not in force', () => {
    expect(sourceStandingLabel('enacted_not_in_force')).toMatch(/not yet in force/);
  });
});
