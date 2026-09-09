import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NovaField, type NovaFieldNode } from '@/components/nova/nova-field';
import { NovaFinding } from '@/components/nova/nova-finding';
import { NovaFocusProvider } from '@/components/nova/nova-focus';
import { NovaAnswerPanel } from '@/components/ui/nova-answer';
import { NOVA_ABOUT, NOVA_DISCLAIMER } from '@/lib/nova/about';
import type { NovaAnswerView, NovaCitationView, NovaClaimView } from '@/types/nova';

/**
 * The evidence workspace.
 *
 * The property under test is the one that makes Nova's claim credible: the
 * constellation is DERIVED FROM THE ANSWER, not decoration. A field that
 * padded itself to look fuller, or that showed a fixed number of nodes
 * regardless of what was retrieved, would be an ambient graphic pretending to
 * be a measurement — which is precisely the failure this product cannot
 * afford.
 *
 * SYNTHETIC content only (G11).
 */

function citation(overrides: Partial<NovaCitationView> = {}): NovaCitationView {
  return {
    chunkId: 'zz-chunk-food-s3',
    agency: 'Example Regulatory Authority',
    document: 'Example Prepared Food Trading Act (SYNTHETIC)',
    section: 'section 3',
    page: 1,
    publicationDate: '2024-04-02',
    knowledgeVersion: 'ZZ-v0.1',
    url: 'https://example.invalid/prepared-food-trading-act',
    ...overrides,
  };
}

function claim(overrides: Partial<NovaClaimView> = {}): NovaClaimView {
  return {
    claimId: 'claim-1',
    statement: 'No person shall sell prepared food to the public except under a licence.',
    sectionReference: 'section 3',
    citations: [citation()],
    amendments: [],
    currentApplicabilityEstablished: true,
    ...overrides,
  };
}

function answer(overrides: Partial<NovaAnswerView> = {}): NovaAnswerView {
  return {
    outcome: 'answered',
    question: 'what licence do I need to sell prepared food',
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

function node(overrides: Partial<NovaFieldNode> = {}): NovaFieldNode {
  return {
    chunkId: 'zz-chunk-food-s3',
    claimId: 'claim-1',
    siblings: ['zz-chunk-food-s3'],
    document: 'Example Prepared Food Trading Act (SYNTHETIC)',
    label: 'Example Prepared Food Trading Act · section 3',
    ...overrides,
  };
}

describe('NovaField — every node is a real retrieved source', () => {
  it('renders exactly one node per cited chunk', () => {
    const nodes = [node({ chunkId: 'a' }), node({ chunkId: 'b' }), node({ chunkId: 'c' })];
    const { container } = render(
      <NovaFocusProvider>
        <NovaField state="ready" nodes={nodes} />
      </NovaFocusProvider>,
    );

    // Not padded to fill the field, not truncated to tidy it.
    expect(container.querySelectorAll('.nova-node')).toHaveLength(3);
  });

  it('labels each node with the source it stands for', () => {
    render(
      <NovaFocusProvider>
        <NovaField state="ready" nodes={[node()]} />
      </NovaFocusProvider>,
    );

    expect(
      screen.getByRole('button', { name: /Example Prepared Food Trading Act · section 3/ }),
    ).toBeInTheDocument();
  });

  it('states the source count in words for assistive technology', () => {
    render(
      <NovaFocusProvider>
        <NovaField state="ready" nodes={[node({ chunkId: 'a' }), node({ chunkId: 'b' })]} />
      </NovaFocusProvider>,
    );

    expect(screen.getByText(/2 sources support this answer/i)).toBeInTheDocument();
  });

  it('hides the illustrative scatter from assistive technology when there is no data', () => {
    // A scatter that looks like data but is not must never be described as one.
    const { container } = render(
      <NovaFocusProvider>
        <NovaField state="idle" nodes={[]} />
      </NovaFocusProvider>,
    );

    // The hiding moved from the wrapper to the svg: with data the nodes are
    // focusable controls, and focusable elements must never sit inside an
    // aria-hidden subtree.
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByText(/sources support this answer/i)).not.toBeInTheDocument();
  });

  it('places a node deterministically, so the constellation does not reshuffle', () => {
    const render1 = render(
      <NovaFocusProvider>
        <NovaField state="ready" nodes={[node({ chunkId: 'stable-id' })]} />
      </NovaFocusProvider>,
    );
    const first = render1.container.querySelector('.nova-point')?.getAttribute('style');
    render1.unmount();

    const render2 = render(
      <NovaFocusProvider>
        <NovaField state="ready" nodes={[node({ chunkId: 'stable-id' })]} />
      </NovaFocusProvider>,
    );
    const second = render2.container.querySelector('.nova-point')?.getAttribute('style');

    expect(first).toBe(second);
  });

  it('is reachable by keyboard', () => {
    render(
      <NovaFocusProvider>
        <NovaField state="ready" nodes={[node()]} />
      </NovaFocusProvider>,
    );

    // Lowercase: React writes the `tabIndex` prop as the `tabindex` attribute,
    // and attribute lookup on an SVG element is case-sensitive.
    expect(screen.getByRole('button', { name: /Source:/ })).toHaveAttribute('tabindex', '0');
  });
});

describe('claim ↔ evidence relationship', () => {
  it('highlights a finding when its source is focused', () => {
    const { container } = render(
      <NovaFocusProvider>
        <NovaField state="ready" nodes={[node()]} />
        <NovaFinding claim={claim()} index={0} />
      </NovaFocusProvider>,
    );

    const finding = container.querySelector('.nova-finding');
    expect(finding).not.toHaveAttribute('data-related');

    fireEvent.focus(screen.getByRole('button', { name: /Source:/ }));
    expect(container.querySelector('.nova-finding')).toHaveAttribute('data-related', 'true');
  });

  it('releases the highlight when focus leaves', () => {
    const { container } = render(
      <NovaFocusProvider>
        <NovaField state="ready" nodes={[node()]} />
        <NovaFinding claim={claim()} index={0} />
      </NovaFocusProvider>,
    );

    const target = screen.getByRole('button', { name: /Source:/ });
    fireEvent.focus(target);
    fireEvent.blur(target);

    expect(container.querySelector('.nova-finding')).not.toHaveAttribute('data-related');
  });

  it('leaves everything equal when nothing is focused', () => {
    // An interface that dims itself until you point at something is exhausting
    // to read, and hides information from anyone who never hovers.
    const { container } = render(
      <NovaFocusProvider>
        <NovaField state="ready" nodes={[node({ chunkId: 'a' }), node({ chunkId: 'b' })]} />
      </NovaFocusProvider>,
    );

    expect(container.querySelectorAll('[data-related="true"]')).toHaveLength(0);
  });

  it('highlights a multi-source finding from any one of its sources', () => {
    // The hook-count trap: a finding citing three chunks must not call a hook
    // per chunk. This proves the relationship still works when it does not.
    const multi = claim({
      citations: [
        citation({ chunkId: 'a' }),
        citation({ chunkId: 'b' }),
        citation({ chunkId: 'c' }),
      ],
    });

    const { container } = render(
      <NovaFocusProvider>
        <NovaField state="ready" nodes={[node({ chunkId: 'c', siblings: ['a', 'b', 'c'] })]} />
        <NovaFinding claim={multi} index={0} />
      </NovaFocusProvider>,
    );

    fireEvent.focus(screen.getByRole('button', { name: /Source:/ }));
    expect(container.querySelector('.nova-finding')).toHaveAttribute('data-related', 'true');
  });
});

describe('NovaFinding — bands, in pipeline order', () => {
  it('leads with the provision, then the quoted passage', () => {
    const { container } = render(
      <NovaFocusProvider>
        <NovaFinding claim={claim()} index={0} />
      </NovaFocusProvider>,
    );

    const html = container.innerHTML;
    expect(html.indexOf('section 3')).toBeLessThan(html.indexOf('<blockquote'));
  });

  it('says so when a provision reference is absent, rather than leaving a gap', () => {
    render(
      <NovaFocusProvider>
        <NovaFinding claim={claim({ sectionReference: null })} index={0} />
      </NovaFocusProvider>,
    );

    expect(screen.getByText(/provision not stated/i)).toBeInTheDocument();
  });

  it('renders later effects when the position could not be established', () => {
    render(
      <NovaFocusProvider>
        <NovaFinding claim={claim({ currentApplicabilityEstablished: false })} index={0} />
      </NovaFocusProvider>,
    );

    expect(screen.getByText(/amendment history could not be checked/i)).toBeInTheDocument();
    expect(screen.getByText(/not stating the current legal position/i)).toBeInTheDocument();
  });

  it('renders no later-effects band for a settled, unamended provision', () => {
    render(
      <NovaFocusProvider>
        <NovaFinding claim={claim()} index={0} />
      </NovaFocusProvider>,
    );

    expect(screen.queryByText(/later instruments affect this provision/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/could not be checked/i)).not.toBeInTheDocument();
  });
});

describe('the answer panel composes the field with the findings', () => {
  it('shows a constellation node for every cited chunk in the answer', () => {
    const two = answer({
      claims: [
        claim({ claimId: 'c1', citations: [citation({ chunkId: 'a' })] }),
        claim({ claimId: 'c2', citations: [citation({ chunkId: 'b' })] }),
      ],
    });

    const { container } = render(<NovaAnswerPanel answer={two} />);
    expect(container.querySelectorAll('.nova-node')).toHaveLength(2);
  });

  it('renders no constellation for a refusal — nothing was found to plot', () => {
    const { container } = render(
      <NovaAnswerPanel answer={answer({ outcome: 'no_matching_evidence', claims: [] })} />,
    );

    expect(container.querySelectorAll('.nova-node')).toHaveLength(0);
  });
});

describe('How Nova works — transparency content', () => {
  it('states what Nova does not do with the same weight as what it does', () => {
    const titles = NOVA_ABOUT.map((s) => s.title.toLowerCase()).join(' | ');

    expect(titles).toMatch(/does not paraphrase/);
    expect(titles).toMatch(/when the sources do not answer/);
    expect(titles).toMatch(/independently/);
  });

  it('never promises coverage it does not have', () => {
    // Targets the OVERCLAIM, not the word. "a complete fresh search" is a true
    // statement about a search; "a complete list of requirements" would be a
    // false statement about coverage. Banning the bare substring would also ban
    // "incomplete", which is a word this content needs.
    const body = NOVA_ABOUT.map((s) => s.body.toLowerCase()).join(' ');

    for (const overclaim of [
      'all regulations',
      'every requirement',
      'complete list',
      'comprehensive',
      'everything that applies',
      'all the rules',
    ]) {
      expect(body, `content claims "${overclaim}"`).not.toContain(overclaim);
    }
  });

  it('states the advice disclaimer plainly and without softening', () => {
    expect(NOVA_DISCLAIMER).toMatch(/not legal, financial or tax advice/i);
    expect(NOVA_DISCLAIMER).toMatch(/informational and navigation resource/i);
  });

  it('describes the no-memory rule as a property, not a limitation to apologise for', () => {
    const memory = NOVA_ABOUT.find((s) => s.id === 'memory');

    expect(memory?.body).toMatch(/keeps no memory/i);
    expect(memory?.body).toMatch(/fresh search/i);
    expect(memory?.body.toLowerCase()).not.toContain('unfortunately');
  });
});

describe('the field shows connection, not only convergence', () => {
  /**
   * Fragmentation is the problem the product exists to solve, so the picture
   * has to show RELATION and not just accumulation. The only relation Nova can
   * assert without inference is "these two passages came from one instrument",
   * and that is the only relation drawn.
   */
  it('draws an arc between two passages from the same document', () => {
    const nodes = [
      node({ chunkId: 'a', document: 'Example Act' }),
      node({ chunkId: 'b', document: 'Example Act' }),
    ];

    const { container } = render(
      <NovaFocusProvider>
        <NovaField state="ready" nodes={nodes} />
      </NovaFocusProvider>,
    );

    expect(container.querySelectorAll('.nova-edge')).toHaveLength(1);
  });

  it('draws nothing between passages from different documents', () => {
    // The absence IS the information: two unrelated instruments look unrelated.
    const nodes = [
      node({ chunkId: 'a', document: 'Example Act' }),
      node({ chunkId: 'b', document: 'Example Regulations' }),
    ];

    const { container } = render(
      <NovaFocusProvider>
        <NovaField state="ready" nodes={nodes} />
      </NovaFocusProvider>,
    );

    expect(container.querySelectorAll('.nova-edge')).toHaveLength(0);
  });

  it('connects three passages from one document with two arcs, not three', () => {
    const nodes = ['a', 'b', 'c'].map((id) => node({ chunkId: id, document: 'Example Act' }));

    const { container } = render(
      <NovaFocusProvider>
        <NovaField state="ready" nodes={nodes} />
      </NovaFocusProvider>,
    );

    expect(container.querySelectorAll('.nova-edge')).toHaveLength(2);
  });

  it('draws no arcs while the search is still running', () => {
    // Mid-search the nodes are still scattered. A line drawn to where a point is
    // going rather than where it is would be a picture of something that has not
    // happened.
    const nodes = [
      node({ chunkId: 'a', document: 'Example Act' }),
      node({ chunkId: 'b', document: 'Example Act' }),
    ];

    const { container } = render(
      <NovaFocusProvider>
        <NovaField state="searching" nodes={nodes} />
      </NovaFocusProvider>,
    );

    expect(container.querySelectorAll('.nova-edge')).toHaveLength(0);
  });

  it('lights an arc when either of its endpoints is focused', () => {
    const nodes = [
      node({ chunkId: 'a', document: 'Example Act', siblings: ['a'] }),
      node({ chunkId: 'b', document: 'Example Act', siblings: ['b'] }),
    ];

    const { container } = render(
      <NovaFocusProvider>
        <NovaField state="ready" nodes={nodes} />
      </NovaFocusProvider>,
    );

    const edge = container.querySelector('.nova-edge');
    expect(edge).not.toHaveAttribute('data-related');

    const first = container.querySelector('.nova-node[data-chunk="a"]');
    fireEvent.mouseEnter(first!);

    expect(container.querySelector('.nova-edge')).toHaveAttribute('data-related', 'true');
  });

  it('describes the connections in text rather than leaving them to the picture', () => {
    const nodes = [
      node({ chunkId: 'a', document: 'Example Act' }),
      node({ chunkId: 'b', document: 'Example Act' }),
    ];

    render(
      <NovaFocusProvider>
        <NovaField state="ready" nodes={nodes} />
      </NovaFocusProvider>,
    );

    expect(screen.getByText(/come from the same document/i)).toBeInTheDocument();
  });

  it('never labels an arc as a legal relationship', () => {
    // "Same instrument" is a fact from the citation. "Section 3 qualifies
    // section 9" is a legal conclusion nothing in this system can reach, and an
    // arrowhead alone would imply one.
    const nodes = ['a', 'b'].map((id) => node({ chunkId: id, document: 'Example Act' }));

    const { container } = render(
      <NovaFocusProvider>
        <NovaField state="ready" nodes={nodes} />
      </NovaFocusProvider>,
    );

    const edge = container.querySelector('.nova-edge');
    expect(edge).not.toHaveAttribute('marker-end');
    expect(container.textContent?.toLowerCase() ?? '').not.toMatch(
      /amends|qualifies|overrides|supersedes|requires/,
    );
  });
});
