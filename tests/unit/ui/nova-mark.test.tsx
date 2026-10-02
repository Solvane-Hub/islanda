import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NovaMark, novaStateLabel, type NovaState } from '@/components/ui/nova-mark';

/**
 * Nova's mark.
 *
 * Two things are under test, and the second matters more.
 *
 *   1. The identity renders and scales.
 *   2. The STATE reaches assistive technology as words, and the words describe
 *      what the system is doing rather than what it is thinking.
 *
 * The second is a product commitment, not a nicety: the extractive reasoner
 * has no private reasoning to expose, and a label implying otherwise would
 * describe a system we deliberately did not build.
 */

const ALL_STATES: NovaState[] = [
  'idle',
  'listening',
  'searching',
  'evaluating',
  'composing',
  'ready',
  'limited',
  'refused',
];

describe('NovaMark — identity', () => {
  it('renders as an image with an accessible name', () => {
    render(<NovaMark />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('hides the geometry from assistive technology', () => {
    // Nine moving dots described aloud helps nobody. The label carries meaning.
    const { container } = render(<NovaMark />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders the full point field, not a placeholder', () => {
    const { container } = render(<NovaMark />);
    expect(container.querySelectorAll('circle.nova-point')).toHaveLength(9);
    expect(container.querySelector('rect.nova-axis')).toBeInTheDocument();
  });

  it('gives every point both a scattered and a converged position', () => {
    // The mark animates between two authored coordinate pairs. A point missing
    // one would jump to the origin rather than converge.
    const { container } = render(<NovaMark />);

    for (const point of container.querySelectorAll<SVGCircleElement>('circle.nova-point')) {
      const style = point.getAttribute('style') ?? '';
      for (const custom of ['--sx', '--sy', '--cx', '--cy', '--i']) {
        expect(style, `point missing ${custom}`).toContain(custom);
      }
    }
  });

  it('converges every point onto one axis line', () => {
    // The whole concept: fragmentation resolving to order. If converged points
    // were not collinear the mark would say something else entirely.
    const { container } = render(<NovaMark />);
    const ys = [...container.querySelectorAll<SVGCircleElement>('circle.nova-point')].map(
      (p) => /--cy:\s*(-?[\d.]+)/.exec(p.getAttribute('style') ?? '')?.[1],
    );

    expect(new Set(ys).size).toBe(1);
  });

  it('scatters points off the axis before convergence', () => {
    // If the scattered positions were also on the axis there would be no
    // journey to show.
    const { container } = render(<NovaMark />);
    const offAxis = [...container.querySelectorAll<SVGCircleElement>('circle.nova-point')].filter(
      (p) => /--sy:\s*24\b/.exec(p.getAttribute('style') ?? '') === null,
    );

    expect(offAxis.length).toBeGreaterThan(6);
  });

  it('renders at every size the product uses', () => {
    for (const size of [20, 48, 96]) {
      const { container, unmount } = render(<NovaMark size={size} />);
      const svg = container.querySelector('svg');

      expect(svg).toHaveAttribute('width', String(size));
      // One viewBox at every size — the mark scales rather than being redrawn.
      expect(svg).toHaveAttribute('viewBox', '0 0 48 48');
      unmount();
    }
  });
});

describe('NovaMark — state reaches assistive technology', () => {
  it('exposes the state as a data attribute for CSS', () => {
    for (const state of ALL_STATES) {
      const { unmount } = render(<NovaMark state={state} />);
      expect(screen.getByRole('img')).toHaveAttribute('data-nova-state', state);
      unmount();
    }
  });

  it('gives every state a distinct spoken label', () => {
    const labels = ALL_STATES.map(novaStateLabel);
    expect(new Set(labels).size).toBe(ALL_STATES.length);
  });

  it('describes system activity, never reasoning', () => {
    // The load-bearing assertion. Nova selects and quotes passages; it does not
    // deliberate, and the interface must not claim it does.
    for (const state of ALL_STATES) {
      const label = novaStateLabel(state).toLowerCase();

      for (const forbidden of ['think', 'thought', 'reason', 'consider', 'decid', 'believ']) {
        expect(label, `"${label}" implies reasoning`).not.toContain(forbidden);
      }
    }
  });

  it('states refusal as an absence of evidence, not as an error', () => {
    const label = novaStateLabel('refused').toLowerCase();

    expect(label).toContain('found nothing');
    for (const wrong of ['error', 'failed', 'sorry', 'unable']) {
      expect(label).not.toContain(wrong);
    }
  });

  it('lets a caller override the label when the surrounding copy already says it', () => {
    render(<NovaMark state="searching" label="Searching Example Jurisdiction" />);
    expect(screen.getByRole('img', { name: 'Searching Example Jurisdiction' })).toBeInTheDocument();
  });
});
