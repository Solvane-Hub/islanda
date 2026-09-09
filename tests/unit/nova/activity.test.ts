import { describe, expect, it } from 'vitest';
import { settledNovaState } from '@/components/nova/nova-activity';
import type { NovaAnswerView, NovaClaimView } from '@/types/nova';

/**
 * The settled Nova state.
 *
 * ⚠ This is the boundary between what the system OBSERVED and what the
 *   interface shows. The intermediate phases are paced on the client — there is
 *   no stream — but the settled state must be derived entirely from the result
 *   the service produced. A `ready` mark over an answer with unresolved gaps
 *   would be the interface making a claim the service refused to make.
 */

function claim(overrides: Partial<NovaClaimView> = {}): NovaClaimView {
  return {
    claimId: 'claim-1',
    statement: 'A person shall hold a current widget licence before operating a widget.',
    sectionReference: 'section 4',
    citations: [],
    amendments: [],
    currentApplicabilityEstablished: true,
    ...overrides,
  };
}

function answer(overrides: Partial<NovaAnswerView> = {}): NovaAnswerView {
  return {
    outcome: 'answered',
    question: 'do I need a widget licence',
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

describe('settled state follows the result, never the presentation', () => {
  it('is ready when everything was established and nothing was left open', () => {
    expect(settledNovaState(answer())).toBe('ready');
  });

  it('is limited when a claim’s current position could not be established', () => {
    // The passage is quoted correctly and a later instrument affects it whose
    // commencement is unverified. The answer stands; the position is withheld.
    expect(
      settledNovaState(answer({ claims: [claim({ currentApplicabilityEstablished: false })] })),
    ).toBe('limited');
  });

  it('is limited when anything was left unresolved', () => {
    expect(
      settledNovaState(
        answer({ unresolved: [{ question: 'Current position of section 9', why: 'Not stated.' }] }),
      ),
    ).toBe('limited');
  });

  it('is refused on every non-answered outcome', () => {
    for (const outcome of [
      'no_matching_evidence',
      'needs_clarification',
      'no_published_knowledge',
    ] as const) {
      expect(settledNovaState(answer({ outcome, claims: [] })), outcome).toBe('refused');
    }
  });

  it('never reports ready for a refusal, whatever else is present', () => {
    // The specific regression worth guarding: a refusal has no claims, so
    // `claims.every(...)` is vacuously true. Outcome has to be checked first.
    expect(settledNovaState(answer({ outcome: 'no_matching_evidence', claims: [] }))).toBe(
      'refused',
    );
  });
});
