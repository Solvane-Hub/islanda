import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Evidence } from '@/components/ui/evidence';
import type { NovaCitationView } from '@/types/nova';

/**
 * Evidence primitives.
 *
 * The rule these exist to hold: **render what you are given, and nothing
 * else.** A synthesised citation field is indistinguishable from a real one to
 * the founder acting on it, and the entire grounding architecture upstream —
 * `assertCitationsGrounded`, the `chunk_id` binding, the ADR-0017 envelope —
 * exists to make fabrication structurally impossible. Reintroducing it in the
 * view would be absurd, so it is tested here too.
 *
 * SYNTHETIC content only (G11).
 */

const CITATION: NovaCitationView = {
  chunkId: 'zz-chunk-food-s3',
  agency: 'Example Regulatory Authority',
  document: 'Example Prepared Food Trading Act (SYNTHETIC — not real legislation)',
  section: 'section 3',
  page: 1,
  publicationDate: '2024-04-02',
  knowledgeVersion: 'ZZ-v0.1',
  url: 'https://example.invalid/prepared-food-trading-act',
};

describe('Evidence.Source — never invents a field', () => {
  it('renders the document as a citation element', () => {
    const { container } = render(<Evidence.Source citation={CITATION} />);
    const cite = container.querySelector('cite');

    expect(cite).toBeInTheDocument();
    expect(cite).toHaveTextContent('Example Prepared Food Trading Act');
  });

  it('shows the agency and publication date supplied', () => {
    render(<Evidence.Source citation={CITATION} />);
    expect(screen.getByText(/Example Regulatory Authority/)).toBeInTheDocument();
    expect(screen.getByText('2024-04-02')).toBeInTheDocument();
  });

  it('omits the link entirely when no url was supplied', () => {
    // No dead link, no "source unavailable" — a placeholder reads as a
    // citation to anyone skimming.
    render(<Evidence.Source citation={{ ...CITATION, url: null }} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('omits the page when none was supplied', () => {
    render(<Evidence.Source citation={{ ...CITATION, page: null }} />);
    expect(screen.queryByText(/p\. /)).not.toBeInTheDocument();
  });

  it('omits the publication date when none was supplied', () => {
    render(<Evidence.Source citation={{ ...CITATION, publicationDate: null }} />);
    expect(screen.queryByText('2024-04-02')).not.toBeInTheDocument();
  });

  it('renders nothing where a section reference is absent', () => {
    render(<Evidence.Source citation={{ ...CITATION, section: null, page: null }} />);
    expect(screen.queryByText('—')).not.toBeInTheDocument();
    expect(screen.queryByText(/unknown/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not available/i)).not.toBeInTheDocument();
  });

  it('opens external sources safely', () => {
    render(<Evidence.Source citation={CITATION} />);
    const link = screen.getByRole('link', { name: /open the source/i });

    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('carries the chunk id for binding without displaying it', () => {
    // `chunk_id` is the citation's machine identity. It has to be available to
    // the DOM for evidence↔claim linking, and would be noise on screen.
    const { container } = render(<Evidence.Source citation={CITATION} />);

    expect(container.querySelector('[data-chunk="zz-chunk-food-s3"]')).toBeInTheDocument();
    expect(screen.queryByText('zz-chunk-food-s3')).not.toBeInTheDocument();
  });
});

describe('Evidence.Passage — a quotation looks like a quotation', () => {
  it('renders quoted text in a blockquote', () => {
    // Every word Nova produces is a verbatim substring of a cited chunk.
    // Presenting it as Nova's own prose would misrepresent its origin.
    const { container } = render(
      <Evidence.Passage>No person shall sell prepared food to the public.</Evidence.Passage>,
    );

    expect(container.querySelector('blockquote')).toHaveTextContent(
      'No person shall sell prepared food',
    );
  });
});

describe('Evidence.Status — an unestablished position is not an error', () => {
  it('states an established position in words, not colour alone', () => {
    render(<Evidence.Status established>In force from 2025-03-01</Evidence.Status>);
    expect(screen.getByText('In force from 2025-03-01')).toBeInTheDocument();
  });

  it('states an unestablished position without alarm language', () => {
    // "Held open" is the meaning. The system is working; the position is
    // deliberately not stated.
    render(<Evidence.Status established={false}>Commencement not established</Evidence.Status>);
    const text = screen.getByText('Commencement not established');

    expect(text).toBeInTheDocument();
    expect(text.closest('p')).not.toHaveClass('text-danger');
  });
});

describe('Evidence.Detail — expandable without JavaScript', () => {
  it('uses a native disclosure so it is keyboard and search reachable', () => {
    const { container } = render(
      <Evidence.Detail summary="Show the passage">
        <p>Quoted text</p>
      </Evidence.Detail>,
    );

    expect(container.querySelector('details')).toBeInTheDocument();
    expect(container.querySelector('summary')).toHaveTextContent('Show the passage');
  });

  it('shows a count when there is one', () => {
    render(
      <Evidence.Detail summary="Sources" count={3}>
        <p>x</p>
      </Evidence.Detail>,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('omits the count rather than rendering a zero', () => {
    render(
      <Evidence.Detail summary="Sources" count={0}>
        <p>x</p>
      </Evidence.Detail>,
    );
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});

describe('Evidence.Chain — the connector is decorative', () => {
  it('hides the spine from assistive technology', () => {
    const { container } = render(
      <Evidence.Chain>
        <p>Claim</p>
      </Evidence.Chain>,
    );

    // The relationship is conveyed by document order and the surrounding copy.
    // A screen reader does not need the drawn line described.
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
    expect(screen.getByText('Claim')).toBeInTheDocument();
  });
});
