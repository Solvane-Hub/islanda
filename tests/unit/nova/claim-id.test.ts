import { describe, expect, it } from 'vitest';
import { claimIdentityString, deriveClaimId } from '@/lib/ai/agents/nova/claim-id';

/**
 * `claim_id` — a hash of normalised content, not a random id (contract §6).
 *
 * ADR-0016 makes retries normal operation, so a re-run must produce matching
 * claims rather than duplicates. Identity is scoped to the Knowledge Pack
 * version for the same reason `chunk_id` is: a new Pack version is new evidence,
 * even where the text is byte-identical.
 */

const base = {
  knowledgeVersion: 'BS-2026.1',
  chunkId: '6f1c0d2a-7b3e-4f5a-9c81-2d4e6a8b0c13',
  statement: 'A person shall not operate a food business without a valid licence.',
};

describe('claim_id', () => {
  it('is deterministic across calls', () => {
    expect(deriveClaimId(base)).toBe(deriveClaimId(base));
  });

  it('is a well-formed RFC 4122 v5 UUID', () => {
    expect(deriveClaimId(base)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('changes when the Knowledge Pack version changes', () => {
    expect(deriveClaimId({ ...base, knowledgeVersion: 'BS-2027.1' })).not.toBe(deriveClaimId(base));
  });

  it('changes when the chunk it came from changes', () => {
    expect(deriveClaimId({ ...base, chunkId: 'a-different-chunk' })).not.toBe(deriveClaimId(base));
  });

  it('changes when the statement changes', () => {
    expect(deriveClaimId({ ...base, statement: 'Something else entirely.' })).not.toBe(
      deriveClaimId(base),
    );
  });

  it('survives whitespace reflow but not wording changes', () => {
    expect(
      deriveClaimId({
        ...base,
        statement: 'A person shall  not operate\n a food business without a valid licence.',
      }),
    ).toBe(deriveClaimId(base));

    expect(
      deriveClaimId({
        ...base,
        statement: 'A person may not operate a food business without a valid licence.',
      }),
    ).not.toBe(deriveClaimId(base));
  });

  it('does not depend on wall-clock time', () => {
    expect(deriveClaimId(base)).toBe(deriveClaimId(base));
  });

  it('is namespaced separately from chunk identity', () => {
    // A claim and the chunk it quotes are different things and must never
    // collide, even where every input string matches.
    expect(deriveClaimId(base)).not.toBe(base.chunkId);
  });

  it('cannot be collided by moving content across field boundaries', () => {
    const a = claimIdentityString({ ...base, chunkId: 'ab', statement: 'cd' });
    const b = claimIdentityString({ ...base, chunkId: 'a', statement: 'bcd' });
    expect(a).not.toBe(b);
  });
});
