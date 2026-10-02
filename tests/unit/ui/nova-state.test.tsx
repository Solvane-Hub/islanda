import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NovaStateProvider, NovaStatusLine, useNovaState } from '@/components/nova/nova-state';
import { NovaMark } from '@/components/ui/nova-mark';

/**
 * Nova's state provider.
 *
 * Two commitments are under test:
 *
 *   1. Every part of a Nova surface agrees about the state. A mark saying
 *      "searching" above an answer that already arrived is the exact
 *      incoherence a shared provider exists to prevent.
 *
 *   2. ⚠ The provider carries STATUS and nothing else. ADR-0017: Nova holds no
 *      memory across turns. A future contributor putting the previous question
 *      or answer in here would be building conversational memory through the
 *      side door, so the shape of the context value is asserted.
 */

function StateProbe() {
  const { state, shouldMove } = useNovaState();
  return (
    <span data-testid="probe" data-state={state} data-move={String(shouldMove)}>
      {state}
    </span>
  );
}

describe('NovaStateProvider', () => {
  it('publishes the state to every descendant', () => {
    render(
      <NovaStateProvider state="searching">
        <StateProbe />
      </NovaStateProvider>,
    );

    expect(screen.getByTestId('probe')).toHaveAttribute('data-state', 'searching');
  });

  it('drives CSS through a data attribute rather than a class', () => {
    // One attribute write per state change, and the current system state is
    // visible in devtools without opening React.
    const { container } = render(
      <NovaStateProvider state="composing">
        <span>x</span>
      </NovaStateProvider>,
    );

    expect(container.querySelector('[data-nova-state="composing"]')).toBeInTheDocument();
  });

  it('keeps the mark and its surroundings in agreement', () => {
    render(
      <NovaStateProvider state="ready">
        <NovaMark state="ready" />
        <StateProbe />
      </NovaStateProvider>,
    );

    expect(screen.getByRole('img')).toHaveAttribute('data-nova-state', 'ready');
    expect(screen.getByTestId('probe')).toHaveAttribute('data-state', 'ready');
  });

  it('carries no question, answer or history', () => {
    // The load-bearing ADR-0017 assertion. If this object ever grows a field
    // that survives a turn, Nova has conversational memory.
    //
    // The key list is RENDERED rather than captured into an outer variable:
    // assigning during render is a side effect, and a test that breaks the
    // rules of React is a test that will eventually lie about React.
    function Keys() {
      const value = useNovaState();
      return <span data-testid="keys">{Object.keys(value).sort().join(',')}</span>;
    }

    render(
      <NovaStateProvider state="ready">
        <Keys />
      </NovaStateProvider>,
    );

    expect(screen.getByTestId('keys')).toHaveTextContent('shouldMove,state');
  });

  it('falls back to idle outside a provider rather than throwing', () => {
    // A mark in the navigation is a legitimate standalone use and must not
    // crash the route.
    render(<StateProbe />);
    expect(screen.getByTestId('probe')).toHaveAttribute('data-state', 'idle');
  });
});

describe('reduced motion is resolved once, at the root', () => {
  it('reports movement allowed when no preference is set', () => {
    render(
      <NovaStateProvider state="idle">
        <StateProbe />
      </NovaStateProvider>,
    );

    expect(screen.getByTestId('probe')).toHaveAttribute('data-move', 'true');
  });

  it('reports movement withheld when reduced motion is requested', () => {
    // Resolved at the provider so a composition never animates in half and
    // stays static in the other half.
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );

    render(
      <NovaStateProvider state="idle">
        <StateProbe />
      </NovaStateProvider>,
    );

    expect(screen.getByTestId('probe')).toHaveAttribute('data-move', 'false');
    vi.unstubAllGlobals();
  });
});

describe('NovaStatusLine — the state in words', () => {
  it('announces politely without stealing focus', () => {
    render(<NovaStatusLine>Searching the published sources</NovaStatusLine>);
    const status = screen.getByRole('status');

    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Searching the published sources');
  });
});
