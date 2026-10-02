import { describe, expect, it } from 'vitest';
import {
  countryCodeOfKnowledgeVersion,
  isSyntheticCorpus,
  isUserAssignedCountryCode,
} from '@/lib/knowledge/jurisdiction';

/**
 * How a synthetic corpus is recognised.
 *
 * This is the logic the demonstration banner rests on, so it is worth being
 * precise about the two directions of failure. A FALSE POSITIVE would put
 * "this is not real law" over real regulatory guidance, which destroys trust in
 * the guidance. A FALSE NEGATIVE would put invented law on screen with nothing
 * marking it, which is worse.
 *
 * The design chooses ISO 3166-1's permanently reserved user-assigned range
 * precisely because it makes the first impossible and the second forgettable
 * only by inventing a jurisdiction outside that range.
 */

describe('user-assigned country codes', () => {
  it('recognises every reserved code', () => {
    const reserved = [
      'AA',
      'ZZ',
      ...'MNOPQRSTUVWXYZ'.split('').map((c) => `Q${c}`),
      ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => `X${c}`),
    ];

    for (const code of reserved) {
      expect(isUserAssignedCountryCode(code), code).toBe(true);
    }
  });

  it('recognises no real jurisdiction', () => {
    // The full Caribbean set the platform targets, plus a sample of others.
    for (const code of ['BS', 'JM', 'BB', 'TT', 'GY', 'BZ', 'US', 'GB', 'CA', 'QA', 'ZA', 'ZM']) {
      expect(isUserAssignedCountryCode(code), code).toBe(false);
    }
  });

  it('does not treat QA or ZA as reserved', () => {
    // Near misses worth naming: Qatar is QA (reserved range starts at QM) and
    // South Africa is ZA (only ZZ is reserved).
    expect(isUserAssignedCountryCode('QA')).toBe(false);
    expect(isUserAssignedCountryCode('ZA')).toBe(false);
    expect(isUserAssignedCountryCode('QM')).toBe(true);
  });

  it('rejects malformed input rather than guessing', () => {
    for (const value of ['zz', 'Z', 'ZZZ', ' ZZ', '', null, undefined]) {
      expect(isUserAssignedCountryCode(value)).toBe(false);
    }
  });
});

describe('the country code inside a Knowledge Pack version', () => {
  it('reads the prefix the database constraint guarantees', () => {
    expect(countryCodeOfKnowledgeVersion('ZZ-v0.1')).toBe('ZZ');
    expect(countryCodeOfKnowledgeVersion('BS-v12.34')).toBe('BS');
  });

  it('returns null for anything that does not match the constraint', () => {
    // A version that does not match `kp_version_format` did not come from the
    // database, so slicing hopefully would be inventing a jurisdiction.
    for (const value of ['ZZ', 'ZZ-0.1', 'zz-v0.1', 'ZZZ-v0.1', 'ZZ-v0', '', null, undefined]) {
      expect(countryCodeOfKnowledgeVersion(value), String(value)).toBeNull();
    }
  });
});

describe('recognising a synthetic corpus', () => {
  it('flags a ZZ pack read by a ZZ business', () => {
    expect(isSyntheticCorpus({ jurisdiction: 'ZZ', knowledgeVersion: 'ZZ-v0.1' })).toBe(true);
  });

  it('does not flag a real jurisdiction reading its own pack', () => {
    expect(isSyntheticCorpus({ jurisdiction: 'BS', knowledgeVersion: 'BS-v1.0' })).toBe(false);
    expect(isSyntheticCorpus({ jurisdiction: 'JM', knowledgeVersion: 'JM-v2.7' })).toBe(false);
  });

  it('flags nothing when no pack was read at all', () => {
    // `no_published_knowledge` quotes nothing, so there is no corpus to
    // characterise and no warning to give.
    expect(isSyntheticCorpus({ jurisdiction: 'BS', knowledgeVersion: null })).toBe(false);
    expect(isSyntheticCorpus({ jurisdiction: 'ZZ', knowledgeVersion: null })).toBe(false);
  });

  it('flags a mismatch between the business and the pack', () => {
    // Impossible in a healthy system — retrieval filters on the context country
    // and RLS enforces the same boundary. If it happens, we cannot vouch for
    // what is on screen, so the warning is the safe direction.
    expect(isSyntheticCorpus({ jurisdiction: 'BS', knowledgeVersion: 'JM-v1.0' })).toBe(true);
  });

  it('flags a malformed pack version', () => {
    expect(isSyntheticCorpus({ jurisdiction: 'BS', knowledgeVersion: 'not-a-version' })).toBe(true);
  });

  it('flags a synthetic pack even if the business jurisdiction looks real', () => {
    expect(isSyntheticCorpus({ jurisdiction: 'BS', knowledgeVersion: 'ZZ-v0.1' })).toBe(true);
  });

  it('flags a synthetic business even if the pack version looks real', () => {
    expect(isSyntheticCorpus({ jurisdiction: 'ZZ', knowledgeVersion: 'BS-v1.0' })).toBe(true);
  });
});
