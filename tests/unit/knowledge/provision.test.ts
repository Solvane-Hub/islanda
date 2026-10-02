import { describe, expect, it } from 'vitest';
import {
  canonicalProvisionId,
  parentProvision,
  parseProvision,
  provisionIdMatches,
  provisionLineage,
  provisionMatches,
  toCanonicalProvisionId,
} from '@/lib/knowledge/provision';

/**
 * Canonical provision identity.
 *
 * The two rules that matter, and the reason this module exists:
 *   `56A` is NOT `56`  — a trailing letter is a different section, usually one
 *                        an amending Act inserted.
 *   `56(1)` IS in `56` — a subdivision belongs to its parent, both directions.
 */

describe('parseProvision — the forms a real chunker emits', () => {
  it.each([
    ['Section 56', 's.56'],
    ['section 56', 's.56'],
    ['SECTION 56', 's.56'],
    ['s. 56', 's.56'],
    ['s.56', 's.56'],
    ['sec 56', 's.56'],
    ['sect. 56', 's.56'],
  ])('reads %s as %s', (input, expected) => {
    expect(toCanonicalProvisionId(input)).toBe(expected);
  });

  it('keeps a trailing letter, because 56A is a different section from 56', () => {
    expect(toCanonicalProvisionId('section 56A')).toBe('s.56A');
    expect(toCanonicalProvisionId('section 56')).toBe('s.56');
    expect(toCanonicalProvisionId('section 56A')).not.toBe(toCanonicalProvisionId('section 56'));
  });

  it('reads subdivisions', () => {
    expect(toCanonicalProvisionId('section 56(1)')).toBe('s.56(1)');
    expect(toCanonicalProvisionId('section 56(1)(a)')).toBe('s.56(1)(a)');
    expect(toCanonicalProvisionId('section 22(f)')).toBe('s.22(f)');
  });

  it('reads ordinal and numbered schedules to the same identity', () => {
    expect(toCanonicalProvisionId('Second Schedule')).toBe('sch.2');
    expect(toCanonicalProvisionId('Schedule 2')).toBe('sch.2');
    expect(toCanonicalProvisionId('sch. 2')).toBe('sch.2');
    expect(toCanonicalProvisionId('Fourth Schedule')).toBe('sch.4');
  });

  it('reads regulations, rules, articles and parts', () => {
    expect(toCanonicalProvisionId('regulation 5')).toBe('reg.5');
    expect(toCanonicalProvisionId('rule 3')).toBe('r.3');
    expect(toCanonicalProvisionId('article 4')).toBe('art.4');
    expect(toCanonicalProvisionId('Part II')).toBe('pt.II');
  });

  it('refuses a bare number rather than guessing', () => {
    // '56' could be a section, a schedule item or a page. Guessing is how a
    // confidently wrong amendment match happens.
    expect(parseProvision('56')).toBeNull();
  });

  it('refuses empty, blank and unparseable input', () => {
    expect(parseProvision(null)).toBeNull();
    expect(parseProvision(undefined)).toBeNull();
    expect(parseProvision('')).toBeNull();
    expect(parseProvision('   ')).toBeNull();
    expect(parseProvision('the preamble')).toBeNull();
    expect(parseProvision('Nineteenth Schedule')).toBeNull();
  });
});

describe('provision lineage', () => {
  it('walks a subdivision up to its section', () => {
    const ref = parseProvision('section 56(1)(a)');
    expect(ref).not.toBeNull();
    if (!ref) return;

    expect(provisionLineage(ref).map(canonicalProvisionId)).toEqual([
      's.56(1)(a)',
      's.56(1)',
      's.56',
    ]);
  });

  it('has no parent at the top', () => {
    const ref = parseProvision('section 56');
    expect(ref && parentProvision(ref)).toBeNull();
  });
});

describe('provisionMatches — both directions', () => {
  it('matches a provision to itself', () => {
    expect(provisionIdMatches('section 56', 's.56')).toBe(true);
  });

  it('matches an amendment to a SECTION against a retrieved SUBSECTION', () => {
    // The amendment changes s.56; the founder retrieved s.56(1), which is inside it.
    expect(provisionIdMatches('section 56', 'section 56(1)')).toBe(true);
  });

  it('matches an amendment to a SUBSECTION against a retrieved SECTION', () => {
    // The amendment changes s.56(1); the founder retrieved the whole of s.56,
    // whose text contains the amended subsection. Less obvious, equally required.
    expect(provisionIdMatches('section 56(1)', 'section 56')).toBe(true);
  });

  it('does NOT match a different section', () => {
    expect(provisionIdMatches('section 56', 'section 57')).toBe(false);
  });

  it('does NOT match an inserted lettered section', () => {
    // s.56A exists because an amending Act inserted it. Treating it as s.56
    // would attach the wrong amendment history to both.
    expect(provisionIdMatches('section 56', 'section 56A')).toBe(false);
    expect(provisionIdMatches('section 56A', 'section 56')).toBe(false);
  });

  it('does NOT match a sibling subdivision', () => {
    expect(provisionIdMatches('section 56(1)', 'section 56(2)')).toBe(false);
  });

  it('does NOT match across provision kinds', () => {
    expect(provisionIdMatches('section 2', 'Schedule 2')).toBe(false);
  });

  it('treats unparseable input as no match, never as a wildcard', () => {
    expect(provisionIdMatches('section 56', null)).toBe(false);
    expect(provisionIdMatches(null, 'section 56')).toBe(false);
    expect(provisionIdMatches('the preamble', 'section 56')).toBe(false);
  });

  it('is symmetric', () => {
    const a = parseProvision('section 9');
    const b = parseProvision('section 9(1)');
    if (!a || !b) throw new Error('expected both to parse');

    expect(provisionMatches(a, b)).toBe(provisionMatches(b, a));
  });
});
