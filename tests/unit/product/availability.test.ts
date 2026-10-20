import { describe, expect, it } from 'vitest';
import {
  ACCESS_COPY,
  accessModeFrom,
  availableToday,
  CAPABILITIES,
  capability,
  isReleased,
  isVisible,
} from '@/lib/product/availability';
import { sourceStandingLabel, isUsedAsCurrentLaw } from '@/lib/knowledge/source-display';
import { CURRENT_LAW_LEGAL_STATUSES } from '@/types/knowledge';

/**
 * The availability register is the single source of truth the homepage, the
 * navigation and the dashboard read. These tests pin the claims that matter:
 * nothing unbuilt is ever offered as usable today, nothing unreleased is ever
 * shown to users, and the access copy never offers a sign-in the waitlist gate
 * would refuse.
 */
describe('availability register', () => {
  it('never releases a capability that is not built and working', () => {
    for (const c of CAPABILITIES) {
      if (c.released) expect(c.status, c.id).toBe('available');
      expect(isReleased(c.id), c.id).toBe(c.status === 'available' && c.released);
    }
  });

  it('keeps registration and licence guidance, dates and funding unbuilt and unreleased', () => {
    for (const id of ['requirements_guidance', 'important_dates', 'funding'] as const) {
      expect(capability(id).status, id).toBe('in_development');
      expect(isReleased(id), id).toBe(false);
    }
  });

  it('holds Nova back from users until its release is signed off (SF1/SF3)', () => {
    expect(capability('cited_answers').status).toBe('available');
    expect(isReleased('cited_answers')).toBe(false);
    expect(isReleased('financial_answers')).toBe(false);
    expect(availableToday().map((c) => c.id)).not.toContain('cited_answers');
  });

  it('lists exactly the released capabilities as available today', () => {
    expect(availableToday().map((c) => c.id)).toEqual(
      CAPABILITIES.filter((c) => isReleased(c.id)).map((c) => c.id),
    );
  });

  it('shows unreleased capabilities only when the environment allows it', () => {
    expect(isVisible('funding', false)).toBe(false);
    expect(isVisible('funding', true)).toBe(true);
    expect(isVisible('documents', false)).toBe(true);
  });

  it('never claims completeness or official status in its own copy', () => {
    const all = CAPABILITIES.map((c) => `${c.name} ${c.summary}`).join(' ');
    expect(all).not.toMatch(/everything you need|complete requirements|all your requirements/i);
    expect(all).not.toMatch(/\bverified\b|\bofficial approval\b|government service/i);
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
