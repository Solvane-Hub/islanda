import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AnswerFeedback } from '@/components/nova/answer-feedback';
import { NovaComposer } from '@/components/nova/nova-composer';
import { NovaLanding } from '@/components/nova/nova-landing';
import { NovaThread } from '@/components/nova/nova-thread';
import { NOVA_UPDATES } from '@/lib/nova/updates';
import type { NovaAnswerView } from '@/types/nova';

/**
 * The Nova workspace surfaces.
 *
 * What these guard is the product's character, not its layout: that this is an
 * investigation surface rather than a chat, that re-runnable research is never
 * presented as memory, and that no panel claims something the data did not
 * supply.
 */

/** A minimal answered view. Only what the thread summary actually reads. */
function view(overrides: Partial<NovaAnswerView> = {}): NovaAnswerView {
  return {
    outcome: 'answered',
    question: 'What records must I keep?',
    claims: [
      {
        claimId: 'claim-1',
        statement: 'Every licensee shall keep records of each transaction.',
        sectionReference: 'section 7',
        citations: [
          {
            chunkId: 'zz-chunk-records-s7',
            agency: 'Example Regulatory Authority',
            document: 'Example Prepared Food Trading Act (SYNTHETIC)',
            section: 'section 7',
            page: 2,
            publicationDate: '2024-04-02',
            knowledgeVersion: 'ZZ-v0.1',
            url: 'https://example.invalid/prepared-food-trading-act',
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

function composerRef() {
  return { current: null } as React.RefObject<HTMLTextAreaElement | null>;
}

describe('NovaComposer — an instrument, not a chat input', () => {
  it('labels the field plainly, and never as a chat message to send', () => {
    render(<NovaComposer inputRef={composerRef()} />);

    expect(screen.getByRole('textbox', { name: /your question/i })).toBeVisible();
    expect(screen.queryByRole('button', { name: /send/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ask this question/i })).toBeInTheDocument();
  });

  it('states the keyboard contract rather than assuming it is known', () => {
    render(<NovaComposer inputRef={composerRef()} />);
    expect(screen.getByText(/press enter to ask/i)).toBeInTheDocument();
  });

  it('carries the advice disclaimer at the point of asking', () => {
    // Not buried in a footer. The founder reads it while forming the question.
    render(<NovaComposer inputRef={composerRef()} />);
    expect(screen.getByText(/does not give legal advice/i)).toBeInTheDocument();
  });

  it('shows a field error instead of the hint, and links it to the input', () => {
    render(
      <NovaComposer inputRef={composerRef()} error="Ask a question of at least a few words." />,
    );

    const field = screen.getByRole('textbox');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/at least a few words/i)).toBeInTheDocument();
    expect(screen.queryByText(/press enter to ask/i)).not.toBeInTheDocument();
  });

  it('caps the question at the length the server action accepts', () => {
    // `askSchema` rejects over 500. A composer that let a founder write 900
    // characters and then refused them would be the interface's fault.
    render(<NovaComposer inputRef={composerRef()} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '500');
  });

  it('carries Nova identity inside the field', () => {
    render(<NovaComposer inputRef={composerRef()} />);
    expect(screen.getByRole('img', { name: 'Nova' })).toBeInTheDocument();
  });
});

describe('NovaLanding — names the problem, shows only real facts', () => {
  it('says what Nova does, and its limits, in plain words', () => {
    render(
      <NovaLanding businessName="Example Demo Trading Co." knowledgeLine={null}>
        <div />
      </NovaLanding>,
    );

    expect(screen.getByText(/official documents Islanda holds/i)).toBeInTheDocument();
    expect(screen.getByText(/isn.t legal advice/i)).toBeInTheDocument();
    expect(screen.getByText(/doesn.t have every rule yet/i)).toBeInTheDocument();
  });

  it('is titled by its job and names the founder’s business', () => {
    render(
      <NovaLanding businessName="Da Back Yard" knowledgeLine={null}>
        <div />
      </NovaLanding>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Get help with your business',
    );
    expect(screen.getByText(/Da Back Yard/)).toBeInTheDocument();
  });

  it('shows the knowledge panel only when there is something true to say', () => {
    const { unmount } = render(
      <NovaLanding businessName="X" knowledgeLine={null}>
        <div />
      </NovaLanding>,
    );
    expect(
      screen.queryByRole('heading', { name: /^what nova can search$/i }),
    ).not.toBeInTheDocument();
    unmount();

    render(
      <NovaLanding businessName="X" knowledgeLine="Example Jurisdiction · ZZ-v0.1 — SYNTHETIC.">
        <div />
      </NovaLanding>,
    );
    expect(screen.getByRole('heading', { name: /^what nova can search$/i })).toBeInTheDocument();
    expect(screen.getByText(/ZZ-v0\.1/)).toBeInTheDocument();
  });

  it('renders the mark at rest, scattered, before anything is asked', () => {
    const { container } = render(
      <NovaLanding businessName="X" knowledgeLine={null}>
        <div />
      </NovaLanding>,
    );

    // The "before" of the fragmentation story.
    expect(container.querySelector('[data-nova-state="idle"]')).toBeInTheDocument();
  });

  it('presents Nova updates as transparency, not a changelog', () => {
    render(
      <NovaLanding businessName="X" knowledgeLine={null}>
        <div />
      </NovaLanding>,
    );

    expect(screen.getByText(/what’s new in nova/i)).toBeInTheDocument();
    expect(screen.getByText(/why this matters/i)).toBeInTheDocument();
    expect(screen.getByText(/what we’re working on/i)).toBeInTheDocument();
  });
});

describe('Nova updates content', () => {
  it('never states a delivery date for planned work', () => {
    // `next` is intent. A month in it reads as a commitment.
    const months =
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i;

    for (const update of NOVA_UPDATES) {
      for (const item of update.next) {
        expect(item, `"${item}" names a month`).not.toMatch(months);
      }
    }
  });

  it('never claims Bahamas coverage exists', () => {
    // G11 is unresolved. A transparency surface that overstates coverage is
    // worse than no transparency surface.
    for (const update of NOVA_UPDATES) {
      expect(update.what.toLowerCase()).not.toContain('bahamas');
    }
  });
});

describe('NovaThread — a record of work, never a transcript', () => {
  /**
   * These assertions were written for `ResearchHistory`, which the thread
   * replaces. They are kept intact because the property they protect has not
   * changed: a list of past questions must never imply Nova remembers them.
   */
  const entry = (question: string, answer?: NovaAnswerView) => ({
    id: question,
    question,
    answer: answer ?? view({ question }),
  });

  it('renders nothing before anything has been asked', () => {
    const { container } = render(<NovaThread entries={[]} onRerun={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says each entry was answered independently', () => {
    render(<NovaThread entries={[entry('What records must I keep?')]} onRerun={vi.fn()} />);

    expect(screen.getByText(/each was answered independently/i)).toBeInTheDocument();
    expect(screen.getByText(/keeps no memory between them/i)).toBeInTheDocument();
  });

  it('never implies Nova remembers the conversation', () => {
    // ADR-0017. The wording here is the difference between a feature and a
    // promise the service does not keep.
    const { container } = render(
      <NovaThread entries={[entry('What records must I keep?')]} onRerun={vi.fn()} />,
    );
    const text = container.textContent?.toLowerCase() ?? '';

    for (const forbidden of ['remember', 'conversation history', 'where you left off', 'context']) {
      expect(text, `thread copy says "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it('re-runs the exact question that was asked', () => {
    const onRerun = vi.fn();
    render(<NovaThread entries={[entry('What records must I keep?')]} onRerun={onRerun} />);

    fireEvent.click(screen.getByRole('button', { name: /what records must i keep/i }));
    expect(onRerun).toHaveBeenCalledWith('What records must I keep?');
  });

  it('cannot be re-run while a request is already in flight', () => {
    render(<NovaThread entries={[entry('q')]} onRerun={vi.fn()} disabled />);
    expect(screen.getByRole('button', { name: /q/i })).toBeDisabled();
  });

  it('summarises an entry with counts only, never with a characterisation', () => {
    // "3 passages" is a fact about the run. "found the licensing requirement"
    // would be an interpretation nothing in this system computed.
    render(<NovaThread entries={[entry('What records must I keep?')]} onRerun={vi.fn()} />);

    expect(screen.getByText(/^1 passage$/)).toBeInTheDocument();
  });

  it('shows a refused investigation as having found nothing', () => {
    const refused = view({
      question: 'What is the VAT rate?',
      outcome: 'no_matching_evidence',
      claims: [],
    });

    render(<NovaThread entries={[entry('What is the VAT rate?', refused)]} onRerun={vi.fn()} />);
    expect(screen.getByText(/no supporting passage found/i)).toBeInTheDocument();
  });
});

describe('AnswerFeedback — product feedback, honestly described', () => {
  it('asks whether the answer was useful', () => {
    render(<AnswerFeedback />);
    expect(screen.getByText(/was this useful/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /not quite/i })).toBeInTheDocument();
  });

  it('asks what was missing only after "not quite"', () => {
    render(<AnswerFeedback />);
    expect(screen.queryByText(/what was missing/i)).not.toBeInTheDocument();

    // `fireEvent`, not `.click()` — a raw DOM click does not flush the React
    // state update, so the assertion would race the re-render.
    fireEvent.click(screen.getByRole('button', { name: /not quite/i }));
    expect(screen.getByText(/what was missing/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /couldn't find what i needed/i }),
    ).toBeInTheDocument();
  });

  it('confirms only what actually happened', () => {
    // Not persisted yet. "Noted for the team" is true; "saved" would not be.
    render(<AnswerFeedback />);
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));

    expect(screen.getByRole('status')).toHaveTextContent(/noted for the team/i);
    expect(screen.queryByText(/saved/i)).not.toBeInTheDocument();
  });
});

describe('NovaLanding — what Nova can search', () => {
  const SOURCES = [
    {
      title: 'Value Added Tax Act (Reprint), Chapter 370A',
      agency: 'Government',
      sourceUrl: 'https://example.test/vat',
      effectiveDate: null,
      legalStatus: 'base_text_amended' as const,
    },
    {
      title: 'Data Protection Act, 2025',
      agency: 'Government',
      sourceUrl: null,
      effectiveDate: null,
      legalStatus: 'enacted_not_in_force' as const,
    },
  ];

  it('lists each published document by name, with its standing in plain words', () => {
    render(
      <NovaLanding
        businessName="X"
        knowledgeLine="The Bahamas: official documents."
        sources={SOURCES}
      >
        <div />
      </NovaLanding>,
    );
    const link = screen.getByRole('link', { name: /Value Added Tax Act/ });
    expect(link).toHaveAttribute('href', 'https://example.test/vat');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByText('In force, with later amendments')).toBeInTheDocument();
    // A passed-but-not-commenced Act is listed, and says it is not used as current law.
    expect(screen.getByText('Data Protection Act, 2025')).toBeInTheDocument();
    expect(screen.getByText(/not yet in force, so not used as current law/)).toBeInTheDocument();
  });

  it('lists nothing when nothing is published', () => {
    render(
      <NovaLanding businessName="X" knowledgeLine={null} sources={[]}>
        <div />
      </NovaLanding>,
    );
    expect(screen.queryByRole('heading', { name: /what nova can search/i })).toBeNull();
  });
});
