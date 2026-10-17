import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NovaGeneralAnswerView } from '@/types/nova';
import { NovaGeneralAnswer } from '@/components/nova/nova-general-answer';
import { settledNovaState } from '@/components/nova/nova-activity';
import { speechForAnswer } from '@/lib/nova/speech';
import { appendInvestigation, summariseEntry } from '@/lib/nova/thread';
import {
  GENERAL_ANSWER_NOTICE,
  MAX_SPOKEN_CHARS,
  clampForSpeech,
  generalUnavailableCopy,
} from '@/lib/nova/general-answer';
import { toNovaGeneralView } from '@/services/nova/general';

function view(overrides: Partial<NovaGeneralAnswerView> = {}): NovaGeneralAnswerView {
  return {
    outcome: 'general',
    status: 'answered',
    question: 'How can I attract more customers?',
    answer: 'Run a weekend tasting.',
    confidence: 'medium',
    recommendations: [{ text: 'Track which posts work.', basis: 'RECOMMENDATION' }],
    evidence: [
      {
        id: 'identity:industry',
        type: 'business',
        source: 'Industry',
        provenance: 'FOUNDER_PROVIDED',
      },
    ],
    followUps: ['How should I price a tasting box?'],
    unknowns: [],
    ...overrides,
  };
}

describe('NovaGeneralAnswer', () => {
  it('always labels the answer as general guidance, not from cited sources', () => {
    render(<NovaGeneralAnswer answer={view()} onContinue={() => {}} />);
    expect(screen.getByText('Run a weekend tasting.')).toBeTruthy();
    expect(screen.getByText(new RegExp(GENERAL_ANSWER_NOTICE.slice(0, 40)))).toBeTruthy();
    expect(GENERAL_ANSWER_NOTICE).toMatch(/not from Islanda’s cited sources/);
    expect(GENERAL_ANSWER_NOTICE).toMatch(/not legal, tax or regulatory advice/);
  });

  it('renders no citation or quotation affordance', () => {
    const { container } = render(<NovaGeneralAnswer answer={view()} onContinue={() => {}} />);
    expect(container.querySelector('blockquote')).toBeNull();
    expect(container.textContent?.toLowerCase()).not.toMatch(/passage|citation|verified/);
  });

  it('shows the business context it used with its provenance', () => {
    render(<NovaGeneralAnswer answer={view()} onContinue={() => {}} />);
    expect(screen.getByText('Business context used')).toBeTruthy();
    expect(screen.getByText('Industry')).toBeTruthy();
  });

  it('submits a follow-up as a fresh question', () => {
    const onContinue = vi.fn();
    render(<NovaGeneralAnswer answer={view()} onContinue={onContinue} />);
    fireEvent.click(screen.getByRole('button', { name: /price a tasting box/ }));
    expect(onContinue).toHaveBeenCalledWith('How should I price a tasting box?');
  });

  it('shows a calm unavailable state with no answer text', () => {
    render(
      <NovaGeneralAnswer
        answer={view({ status: 'unavailable', answer: null, reason: 'provider_not_configured' })}
        onContinue={() => {}}
      />,
    );
    expect(screen.getByText(generalUnavailableCopy('provider_not_configured'))).toBeTruthy();
    expect(screen.queryByText('Run a weekend tasting.')).toBeNull();
  });
});

describe('general answers in the shared Nova surfaces', () => {
  it('settles to ready, limited, or refused from the data', () => {
    expect(settledNovaState(view())).toBe('ready');
    expect(settledNovaState(view({ unknowns: ['Footfall'] }))).toBe('limited');
    expect(settledNovaState(view({ status: 'unavailable', answer: null }))).toBe('refused');
  });

  it('summarises a thread entry without claiming sources', () => {
    const [entry] = appendInvestigation([], view());
    expect(summariseEntry(entry!)).toBe('General guidance · not from cited sources');
  });

  it('speaks the answer, sanitised and within the speak route limit', () => {
    expect(speechForAnswer(view())).toBe('Run a weekend tasting.');
    expect(speechForAnswer(view({ answer: 'See https://example.com for more.' }))).toBe(
      'See for more.',
    );

    const long = 'This is a sentence. '.repeat(60);
    const spoken = speechForAnswer(view({ answer: long }));
    expect(spoken.length).toBeLessThanOrEqual(MAX_SPOKEN_CHARS);
    expect(spoken.endsWith('.')).toBe(true);
  });

  it('speaks the unavailable line rather than nothing', () => {
    expect(
      speechForAnswer(view({ status: 'unavailable', answer: null, reason: 'provider_error' })),
    ).toBe(generalUnavailableCopy('provider_error'));
  });

  it('clamps at a word boundary when there is no sentence end', () => {
    const clamped = clampForSpeech('word '.repeat(200));
    expect(clamped.length).toBeLessThanOrEqual(MAX_SPOKEN_CHARS);
    expect(clamped.endsWith('word')).toBe(true);
  });
});

describe('toNovaGeneralView', () => {
  const usage = {
    determination: 'llm' as const,
    llmCalled: false,
    provider: 'openai',
    model: 'm',
    modelTier: 'mini' as const,
    modelReason: 'r',
    inputTokens: null,
    outputTokens: null,
    estimatedCostUsd: null,
    validationOk: null,
    failed: true,
    errorCode: 'provider_error',
  };

  it('never carries an answer on an unavailable outcome', () => {
    const v = toNovaGeneralView('q', {
      status: 'unavailable',
      category: 'general',
      reason: 'provider_error',
      usage,
    });
    expect(v).toMatchObject({
      outcome: 'general',
      status: 'unavailable',
      answer: null,
      reason: 'provider_error',
    });
  });

  it('degrades an unexpected deterministic outcome instead of inventing an answer', () => {
    const v = toNovaGeneralView('q', { status: 'deterministic', category: 'general', usage });
    expect(v).toMatchObject({ status: 'unavailable', answer: null, reason: 'validation_failed' });
  });
});
