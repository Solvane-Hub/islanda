import { describe, expect, it } from 'vitest';
import { speechForAnswer, stripUnspeakable } from '@/lib/nova/speech';
import type { NovaAnswerView, NovaClaimView } from '@/types/nova';

/**
 * What Nova says out loud.
 *
 * Two commitments:
 *   1. The voice speaks a real, meaningful line for both answers and refusals.
 *   2. ⚠ It NEVER speaks an identifier — no URL, no chunk id, no UUID. This is
 *      the directive's hard rule, enforced structurally by `stripUnspeakable`.
 */

function claim(overrides: Partial<NovaClaimView> = {}): NovaClaimView {
  return {
    claimId: 'claim-1',
    statement: 'A person shall hold a current licence before operating.',
    sectionReference: 'section 4',
    citations: [
      {
        chunkId: 'zz-chunk-food-s3',
        agency: 'Example Agency',
        document: 'Example Prepared Food Trading Act',
        section: 'section 3',
        page: null,
        publicationDate: null,
        knowledgeVersion: 'ZZ-v0.1',
        url: 'https://example.invalid/act',
      },
    ],
    amendments: [],
    currentApplicabilityEstablished: true,
    ...overrides,
  };
}

function answer(overrides: Partial<NovaAnswerView> = {}): NovaAnswerView {
  return {
    outcome: 'answered',
    question: 'do I need a licence',
    claims: [claim()],
    unresolved: [],
    followUps: [],
    jurisdiction: 'ZZ',
    knowledgeVersion: 'ZZ-v0.1',
    emptyDomains: [],
    business: null,
    ...overrides,
  };
}

describe('stripUnspeakable — identifiers never reach the voice', () => {
  it('removes URLs', () => {
    expect(stripUnspeakable('See https://example.invalid/act now')).not.toContain('http');
  });

  it('removes chunk-id-style slugs', () => {
    expect(stripUnspeakable('from zz-chunk-food-s3 here')).not.toContain('zz-chunk-food-s3');
  });

  it('removes UUIDs', () => {
    const withId = 'ref 550e8400-e29b-41d4-a716-446655440000 done';
    expect(stripUnspeakable(withId)).not.toContain('550e8400');
  });

  it('leaves ordinary prose and provision references intact', () => {
    expect(stripUnspeakable('The closest match is section 3 of the Act.')).toBe(
      'The closest match is section 3 of the Act.',
    );
  });
});

describe('speechForAnswer — a meaningful, clean spoken line', () => {
  it('speaks for an answered result', () => {
    const line = speechForAnswer(answer());
    expect(line.length).toBeGreaterThan(0);
    expect(line.toLowerCase()).toContain('found');
  });

  it('never speaks a URL, chunk id, or version identifier', () => {
    const line = speechForAnswer(answer());
    expect(line).not.toContain('http');
    expect(line).not.toContain('zz-chunk');
    expect(line).not.toContain('ZZ-v0.1');
  });

  it('speaks a trust line for a refusal rather than falling silent', () => {
    const line = speechForAnswer(answer({ outcome: 'no_matching_evidence', claims: [] }));
    expect(line.length).toBeGreaterThan(0);
    // The refusal narration states the sources do not cover it — never an error.
    expect(line.toLowerCase()).not.toContain('error');
  });

  it('speaks the no-knowledge case as a gap, not a failure', () => {
    const line = speechForAnswer(answer({ outcome: 'no_published_knowledge', claims: [] }));
    expect(line.length).toBeGreaterThan(0);
    expect(line.toLowerCase()).not.toContain('failed');
  });
});
