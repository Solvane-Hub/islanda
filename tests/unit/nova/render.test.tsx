import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NovaAnswerPanel, NovaThinking } from '@/components/ui/nova-answer';
import type { NovaAnswerView, NovaClaimView } from '@/types/nova';

/**
 * Nova presentation tests.
 *
 * These guard the truthfulness rules the surface depends on: a quotation is
 * marked up as a quotation, no citation field is ever invented, an
 * unestablished legal position is never shown as settled, and `unresolved[]`
 * appears even on a successful answer.
 *
 * All content is SYNTHETIC. No Bahamian legal source material (G11).
 */

const CITATION = {
  chunkId: 'zz-chunk-s4',
  agency: 'Example Regulatory Authority',
  document: 'Example Widget Licensing Act (SYNTHETIC)',
  section: 'section 4',
  page: 1,
  publicationDate: '2024-01-15',
  knowledgeVersion: 'ZZ-v1.0',
  url: 'https://example.invalid/widget-licensing-act',
};

function claim(overrides: Partial<NovaClaimView> = {}): NovaClaimView {
  return {
    claimId: 'claim-1',
    statement: 'A person shall hold a current widget licence before operating a widget.',
    sectionReference: 'section 4',
    citations: [CITATION],
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
    knowledgeVersion: 'ZZ-v1.0',
    emptyDomains: [],
    business: null,
    ...overrides,
  };
}

/**
 * A REAL jurisdiction, used to prove the synthetic notice stays away.
 *
 * Content is still invented — the point of the fixture is the country code and
 * pack version, not the text. `BS` is a real ISO 3166-1 code, which is exactly
 * why it must never trigger the synthetic warning.
 */
function realJurisdictionAnswer(overrides: Partial<NovaAnswerView> = {}): NovaAnswerView {
  return answer({
    jurisdiction: 'BS',
    knowledgeVersion: 'BS-v1.0',
    claims: [claim({ citations: [{ ...CITATION, knowledgeVersion: 'BS-v1.0' }] })],
    ...overrides,
  });
}

describe('NovaAnswerPanel — quotations are marked up as quotations', () => {
  it('renders the statement inside a blockquote', () => {
    const { container } = render(<NovaAnswerPanel answer={answer()} />);
    const quote = container.querySelector('blockquote');

    expect(quote).toBeInTheDocument();
    expect(quote).toHaveTextContent('A person shall hold a current widget licence');
  });

  it('renders the source as a cite element', () => {
    const { container } = render(<NovaAnswerPanel answer={answer()} />);
    const cite = container.querySelector('cite');

    expect(cite).toBeInTheDocument();
    expect(cite).toHaveTextContent('Example Widget Licensing Act');
    expect(cite).toHaveTextContent('section 4');
  });

  it('never claims the list is complete', () => {
    render(<NovaAnswerPanel answer={answer()} />);
    // Trust Layer §7.4 / Constitution Article VII.
    expect(screen.queryByText(/complete requirements/i)).not.toBeInTheDocument();
    expect(screen.getByText(/what we found in the sources we hold/i)).toBeInTheDocument();
  });
});

describe('NovaAnswerPanel — citations are never invented', () => {
  it('shows the agency and publication date supplied', () => {
    render(<NovaAnswerPanel answer={answer()} />);

    // `getAllBy`, because the agency now legitimately appears twice: under the
    // passage it published, and again in the rail's index of what Nova read.
    // Those answer different questions — "where did THIS come from" and "what
    // did Nova read at all" — so both are correct. The invariant under test is
    // unchanged: the supplied fields are shown, and nothing is invented.
    expect(screen.getAllByText(/Example Regulatory Authority/).length).toBeGreaterThan(0);
    expect(screen.getByText(/2024-01-15/)).toBeInTheDocument();
  });

  it('omits the source link entirely when no url was supplied', () => {
    render(
      <NovaAnswerPanel
        answer={answer({ claims: [claim({ citations: [{ ...CITATION, url: null }] })] })}
      />,
    );
    // No placeholder, no dead link, no "source unavailable" that could read as
    // a citation. The field is simply absent.
    expect(screen.queryByRole('link', { name: /open the source/i })).not.toBeInTheDocument();
  });

  it('omits the page reference when none was supplied', () => {
    const { container } = render(
      <NovaAnswerPanel
        answer={answer({ claims: [claim({ citations: [{ ...CITATION, page: null }] })] })}
      />,
    );
    expect(container.querySelector('cite')).not.toHaveTextContent('p.');
  });

  it('opens source links safely in a new tab', () => {
    render(<NovaAnswerPanel answer={answer()} />);
    const link = screen.getByRole('link', { name: /open the source/i });

    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});

describe('NovaAnswerPanel — amendment notices', () => {
  const amended = answer({
    claims: [
      claim({
        currentApplicabilityEstablished: false,
        amendments: [
          {
            title: 'Amendment Act A (SYNTHETIC)',
            actNumber: 'No. 1 of 2025',
            commencementDate: '2025-03-01',
            commencementEstablished: true,
          },
          {
            title: 'Amendment Act B (SYNTHETIC)',
            actNumber: 'No. 2 of 2025',
            commencementDate: null,
            commencementEstablished: false,
          },
        ],
      }),
    ],
  });

  it('names every amending instrument', () => {
    render(<NovaAnswerPanel answer={amended} />);
    expect(screen.getByText(/Amendment Act A/)).toBeInTheDocument();
    expect(screen.getByText(/Amendment Act B/)).toBeInTheDocument();
  });

  it('states commencement status in words, not colour alone', () => {
    render(<NovaAnswerPanel answer={amended} />);
    expect(screen.getByText(/In force from 2025-03-01/)).toBeInTheDocument();
    expect(screen.getByText(/Commencement not established/)).toBeInTheDocument();
  });

  it('explicitly withholds the current position when not established', () => {
    render(<NovaAnswerPanel answer={amended} />);
    expect(screen.getByText(/not stating the current legal position/i)).toBeInTheDocument();
  });

  it('still shows the quoted passage — an amendment is not a reason to refuse', () => {
    const { container } = render(<NovaAnswerPanel answer={amended} />);
    expect(container.querySelector('blockquote')).toHaveTextContent('widget licence');
  });

  it('shows no amendment section when the provision is unamended', () => {
    render(<NovaAnswerPanel answer={answer()} />);
    expect(screen.queryByText(/later instruments affect this provision/i)).not.toBeInTheDocument();
  });
});

describe('NovaAnswerPanel — refusal states are distinct', () => {
  it('distinguishes no published knowledge from no matching evidence', () => {
    const { unmount } = render(
      <NovaAnswerPanel
        answer={answer({
          outcome: 'no_published_knowledge',
          claims: [],
          knowledgeVersion: null,
          unresolved: [{ question: 'q', why: 'No Knowledge Pack is published.' }],
        })}
      />,
    );
    expect(screen.getByText(/no sources for your jurisdiction yet/i)).toBeInTheDocument();
    unmount();

    render(
      <NovaAnswerPanel
        answer={answer({
          outcome: 'no_matching_evidence',
          claims: [],
          unresolved: [{ question: 'q', why: 'Nothing matched.' }],
        })}
      />,
    );
    expect(screen.getByText(/nothing in the sources we hold addresses this/i)).toBeInTheDocument();
  });

  it('asks for a clearer question rather than blaming the corpus', () => {
    render(
      <NovaAnswerPanel
        answer={answer({
          outcome: 'needs_clarification',
          claims: [],
          unresolved: [{ question: 'q', why: 'No usable terms.' }],
        })}
      />,
    );
    expect(screen.getByText(/needs more to work with/i)).toBeInTheDocument();
  });

  it('renders no quotation on any refusal', () => {
    for (const outcome of [
      'no_published_knowledge',
      'no_matching_evidence',
      'needs_clarification',
    ] as const) {
      const { container, unmount } = render(
        <NovaAnswerPanel
          answer={answer({ outcome, claims: [], unresolved: [{ question: 'q', why: 'w' }] })}
        />,
      );
      expect(container.querySelector('blockquote')).toBeNull();
      expect(container.querySelector('cite')).toBeNull();
      unmount();
    }
  });
});

describe('NovaAnswerPanel — unresolved items', () => {
  it('shows unresolved items even on a successful answer', () => {
    render(
      <NovaAnswerPanel
        answer={answer({
          unresolved: [
            { question: 'Current position of section 9', why: 'Commencement not established.' },
          ],
        })}
      />,
    );

    const section = screen.getByRole('region', { name: /what nova could not establish/i });
    expect(within(section).getByText(/Current position of section 9/)).toBeInTheDocument();
    expect(within(section).getByText(/Commencement not established/)).toBeInTheDocument();
  });

  it('omits the section entirely when nothing is unresolved', () => {
    render(<NovaAnswerPanel answer={answer()} />);
    expect(screen.queryByText(/what nova could not establish/i)).not.toBeInTheDocument();
  });
});

describe('Nova surface — accessibility', () => {
  it('announces the result politely without stealing focus', () => {
    render(<NovaAnswerPanel answer={answer()} />);
    const live = screen.getByRole('status');
    expect(live).toHaveAttribute('aria-live', 'polite');
  });

  it('makes the question available to screen readers', () => {
    render(<NovaAnswerPanel answer={answer()} />);
    expect(screen.getByText(/you asked: do I need a widget licence/i)).toBeInTheDocument();
  });

  it('gives every claim an accessible name even without a section reference', () => {
    render(<NovaAnswerPanel answer={answer({ claims: [claim({ sectionReference: null })] })} />);
    expect(screen.getByRole('article', { name: /passage 1/i })).toBeInTheDocument();
  });

  it('states the disclaimer alongside the knowledge version', () => {
    render(<NovaAnswerPanel answer={answer()} />);
    expect(screen.getByText(/does not give legal advice/i)).toBeInTheDocument();
    expect(screen.getByText(/ZZ-v1.0/)).toBeInTheDocument();
  });
});

/**
 * The synthetic-corpus warning.
 *
 * These are the tests that make the demo safe to put in front of an advisor.
 * The notice must be impossible to omit for ZZ and impossible to trigger for a
 * real jurisdiction — and neither property may depend on a caller remembering
 * to pass anything, which is why `NovaAnswerPanel` takes no flag for it.
 */
describe('NovaAnswerPanel — synthetic corpus warning', () => {
  it('warns that the corpus is synthetic for a ZZ pack', () => {
    render(<NovaAnswerPanel answer={answer()} />);
    expect(
      screen.getByRole('heading', { name: /synthetic demonstration corpus/i }),
    ).toBeInTheDocument();
  });

  it('repeats the warning in the provenance footer', () => {
    // Two places, deliberately: the banner is what a reader sees first, the
    // footer is what survives a copy-paste of the answer.
    render(<NovaAnswerPanel answer={answer()} />);
    expect(
      screen.getByText(/synthetic demonstration corpus and is not real law/i),
    ).toBeInTheDocument();
  });

  it('says plainly that the jurisdiction is fictional and not real law', () => {
    render(<NovaAnswerPanel answer={answer()} />);
    expect(
      screen.getByText(/Example Jurisdiction \(ZZ\) is fictional\. This content is not real law/i),
    ).toBeInTheDocument();
  });

  it('warns before the first quotation, not after it', () => {
    // A reader who stops after the first cited passage must already have been
    // told what they are reading.
    const { container } = render(<NovaAnswerPanel answer={answer()} />);
    const html = container.innerHTML;

    expect(html.indexOf('Synthetic demonstration corpus')).toBeLessThan(
      html.indexOf('<blockquote'),
    );
  });

  it('warns on a refusal too — the corpus is synthetic either way', () => {
    render(<NovaAnswerPanel answer={answer({ outcome: 'no_matching_evidence', claims: [] })} />);
    expect(
      screen.getByRole('heading', { name: /synthetic demonstration corpus/i }),
    ).toBeInTheDocument();
  });

  it('does NOT warn for a real jurisdiction', () => {
    render(<NovaAnswerPanel answer={realJurisdictionAnswer()} />);
    expect(screen.queryAllByText(/synthetic demonstration corpus/i)).toHaveLength(0);
    expect(screen.queryByText(/is fictional/i)).not.toBeInTheDocument();
  });

  it('cannot be turned on for a real jurisdiction by any prop', () => {
    // `NovaAnswerPanel` accepts `answer` and `className` and nothing else. The
    // notice is derived, so there is no prop to set — this asserts the shape of
    // the API, which is what makes the guarantee hold.
    render(<NovaAnswerPanel answer={realJurisdictionAnswer()} className="anything" />);
    expect(screen.queryAllByText(/synthetic demonstration corpus/i)).toHaveLength(0);
  });

  it('does not warn when nothing was read at all', () => {
    // `no_published_knowledge` quotes nothing, so there is no corpus on screen
    // to characterise.
    render(
      <NovaAnswerPanel
        answer={answer({
          outcome: 'no_published_knowledge',
          claims: [],
          jurisdiction: 'BS',
          knowledgeVersion: null,
        })}
      />,
    );
    expect(screen.queryAllByText(/synthetic demonstration corpus/i)).toHaveLength(0);
  });
});

describe('NovaAnswerPanel — accessibility, continued', () => {
  it('announces the loading state and describes it in words', () => {
    render(<NovaThinking question="do I need a widget licence" />);
    const status = screen.getByRole('status');

    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText(/nova is working on your question/i)).toBeInTheDocument();
  });

  it('does not imply the loading state is generating an answer', () => {
    render(<NovaThinking question="q" />);
    // "Reading the sources" and "quoting what it finds" — never "writing" or
    // "thinking up", which would misdescribe an extractive reasoner.
    expect(screen.getByText(/quoting what it finds/i)).toBeInTheDocument();
    expect(screen.queryByText(/generating/i)).not.toBeInTheDocument();
  });
});

describe('Nova continues the investigation without remembering it', () => {
  const withFollowUps = () =>
    answer({
      followUps: [
        {
          id: 'f1',
          label: 'Section 9 of the Example Widget Licensing Act',
          question: 'What does section 9 of the Example Widget Licensing Act require?',
        },
        {
          id: 'f2',
          label: 'The Example Widget Amendment Act 2025',
          question: 'What did the Example Widget Amendment Act 2025 change?',
        },
      ],
    });

  it('asks about the next thread in prose rather than offering a row of chips', () => {
    render(<NovaAnswerPanel answer={withFollowUps()} onContinue={vi.fn()} />);

    expect(screen.getByText(/want me to trace/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /yes — trace that/i })).toBeInTheDocument();
  });

  it('shows the exact question before it is asked', () => {
    // Nothing hidden behind a friendly phrase. The founder reads the words that
    // will be searched.
    render(<NovaAnswerPanel answer={withFollowUps()} onContinue={vi.fn()} />);

    expect(
      screen.getByText(/What does section 9 of the Example Widget Licensing Act require\?/),
    ).toBeInTheDocument();
  });

  it('runs the follow-up as a complete, self-contained question', () => {
    // No pronoun, no dependence on this turn — because the new run has no
    // access to it (ADR-0017).
    const onContinue = vi.fn();
    render(<NovaAnswerPanel answer={withFollowUps()} onContinue={onContinue} />);

    fireEvent.click(screen.getByRole('button', { name: /yes — trace that/i }));

    expect(onContinue).toHaveBeenCalledWith(
      'What does section 9 of the Example Widget Licensing Act require?',
    );
    const [asked] = onContinue.mock.calls[0] as [string];
    expect(asked).not.toMatch(/\b(it|that|this|they|those)\b/i);
  });

  it('does not repeat the thread Nova already asked about', () => {
    render(<NovaAnswerPanel answer={withFollowUps()} onContinue={vi.fn()} />);

    // The first follow-up is spoken; the rest sit in the rail. Listing the
    // first in both would present one lead as two.
    expect(
      screen.queryByRole('button', { name: /^Section 9 of the Example Widget Licensing Act$/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Example Widget Amendment Act 2025/ }),
    ).toBeInTheDocument();
  });

  it('states that each continuation is answered on its own', () => {
    render(<NovaAnswerPanel answer={withFollowUps()} onContinue={vi.fn()} />);
    expect(screen.getByText(/keeps no memory between them/i)).toBeInTheDocument();
  });

  it('offers nothing to continue when the panel cannot run one', () => {
    // A panel rendered without a handler must not show an affordance that does
    // nothing when pressed.
    render(<NovaAnswerPanel answer={withFollowUps()} />);

    expect(screen.queryByRole('button', { name: /yes — trace that/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/other threads/i)).not.toBeInTheDocument();
  });

  it('offers nothing to continue after a refusal', () => {
    // No evidence means no lead. An offer here would be the interface inventing
    // a direction the search did not produce.
    render(
      <NovaAnswerPanel
        answer={answer({ outcome: 'no_matching_evidence', claims: [], followUps: [] })}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /yes — trace that/i })).not.toBeInTheDocument();
  });

  it('never draws a conclusion in the continuation copy', () => {
    const { container } = render(<NovaAnswerPanel answer={withFollowUps()} onContinue={vi.fn()} />);
    const text = container.textContent?.toLowerCase() ?? '';

    for (const forbidden of [
      'you will also need',
      'you must also',
      'this also applies',
      'which means you',
      'so you should',
    ]) {
      expect(text, `continuation concludes: "${forbidden}"`).not.toContain(forbidden);
    }
  });
});
