import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useNovaAnswerVoice } from '@/lib/nova/use-nova-answer-voice';
import { ok } from '@/lib/errors';
import type { NovaAnswerView } from '@/types/nova';

/**
 * The speak-on-answer orchestration.
 *
 * The three guarantees, tested directly:
 *   • voice OFF  → no request is ever made (the directive's hard rule)
 *   • voice ON   → the meaningful result is spoken, exactly once
 *   • a refusal / no-evidence result is spoken too — refusal is a trust moment,
 *     not a silence
 */

function answer(overrides: Partial<NovaAnswerView> = {}): NovaAnswerView {
  return {
    outcome: 'answered',
    question: 'do I need a licence',
    claims: [
      {
        claimId: 'c1',
        statement: 'A person shall hold a licence.',
        sectionReference: 'section 4',
        citations: [
          {
            chunkId: 'zz-chunk-1',
            agency: 'Agency',
            document: 'Example Act',
            section: 'section 4',
            page: null,
            publicationDate: null,
            knowledgeVersion: 'ZZ-v0.1',
            url: null,
          },
        ],
        amendments: [],
        currentApplicabilityEstablished: true,
      },
    ],
    unresolved: [],
    followUps: [],
    jurisdiction: 'ZZ',
    knowledgeVersion: 'ZZ-v0.1',
    emptyDomains: [],
    business: null,
    ...overrides,
  };
}

function controls() {
  return { speak: vi.fn(), stop: vi.fn() };
}

describe('useNovaAnswerVoice', () => {
  it('makes NO request when the voice is disabled', () => {
    const c = controls();
    renderHook(() =>
      useNovaAnswerVoice({ result: ok(answer()), pending: false, enabled: false, controls: c }),
    );
    expect(c.speak).not.toHaveBeenCalled();
  });

  it('speaks the result when the voice is enabled', () => {
    const c = controls();
    renderHook(() =>
      useNovaAnswerVoice({ result: ok(answer()), pending: false, enabled: true, controls: c }),
    );
    expect(c.speak).toHaveBeenCalledTimes(1);
    expect(String(c.speak.mock.calls[0]?.[0]).toLowerCase()).toContain('found');
  });

  it('speaks a refusal result too', () => {
    const c = controls();
    renderHook(() =>
      useNovaAnswerVoice({
        result: ok(answer({ outcome: 'no_matching_evidence', claims: [] })),
        pending: false,
        enabled: true,
        controls: c,
      }),
    );
    expect(c.speak).toHaveBeenCalledTimes(1);
  });

  it('speaks a given answer only once across re-renders', () => {
    const c = controls();
    const result = ok(answer());
    const { rerender } = renderHook((props) => useNovaAnswerVoice(props), {
      initialProps: { result, pending: false, enabled: true, controls: c },
    });
    rerender({ result, pending: false, enabled: true, controls: c });
    rerender({ result, pending: false, enabled: true, controls: c });
    expect(c.speak).toHaveBeenCalledTimes(1);
  });

  it('speaks again for a genuinely new result', () => {
    const c = controls();
    const { rerender } = renderHook((props) => useNovaAnswerVoice(props), {
      initialProps: { result: ok(answer()), pending: false, enabled: true, controls: c },
    });
    rerender({
      result: ok(answer({ question: 'a different one' })),
      pending: false,
      enabled: true,
      controls: c,
    });
    expect(c.speak).toHaveBeenCalledTimes(2);
  });

  it('does not retroactively speak an answer when the voice is switched on later', () => {
    const c = controls();
    const result = ok(answer());
    const { rerender } = renderHook((props) => useNovaAnswerVoice(props), {
      initialProps: { result, pending: false, enabled: false, controls: c },
    });
    // The answer was on screen while off; enabling now must stay silent.
    rerender({ result, pending: false, enabled: true, controls: c });
    expect(c.speak).not.toHaveBeenCalled();
  });

  it('stops any speech when a new investigation starts', () => {
    const c = controls();
    renderHook(() =>
      useNovaAnswerVoice({ result: null, pending: true, enabled: true, controls: c }),
    );
    expect(c.stop).toHaveBeenCalled();
  });
});
