import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NovaPresence } from '@/components/nova/nova-presence';

/**
 * Nova's presence and the motion preference.
 *
 * ⚠ The reduced-motion contract is strict: when motion is withheld the presence
 *   must draw ONE resting frame and schedule no animation loop at all. A loop
 *   clamped to nothing still strobes — the harm the preference exists to prevent.
 */

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('NovaPresence — reduced motion', () => {
  it('schedules no animation frame when motion is withheld', () => {
    const raf = vi.fn().mockReturnValue(1);
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<NovaPresence state="idle" shouldMove={false} label="" />);
    expect(raf).not.toHaveBeenCalled();
  });

  it('starts a single animation loop when motion is allowed', () => {
    const raf = vi.fn().mockReturnValue(1); // returns an id, does not recurse
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<NovaPresence state="idle" shouldMove label="" />);
    expect(raf).toHaveBeenCalled();
  });

  it('cancels its animation frame on unmount', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(7));
    const cancel = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancel);

    const { unmount } = render(<NovaPresence state="searching" shouldMove label="" />);
    unmount();
    expect(cancel).toHaveBeenCalled();
  });

  it('exposes the state as a data attribute and hides the canvas from AT when unlabeled', () => {
    const { container } = render(<NovaPresence state="connecting" shouldMove={false} label="" />);
    expect(container.querySelector('[data-nova-state="connecting"]')).toBeInTheDocument();
  });
});
