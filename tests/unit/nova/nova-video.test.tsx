import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NovaVideo } from '@/components/nova/nova-video';

/**
 * Nova's presence video.
 *
 * The behavioural contract that matters: it plays the real idle asset, reflects
 * the state machine as data attributes (so CSS/audio can respond), carries state
 * to assistive tech only through the label, and honours reduced motion.
 */

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('NovaVideo', () => {
  it('plays the real idle asset, muted and looping', () => {
    const { container } = render(<NovaVideo state="idle" shouldMove label="" />);
    const video = container.querySelector('video')!;
    expect(video.getAttribute('src')).toContain('/nova/nova-idle.mp4');
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.autoplay).toBe(true);
  });

  it('exposes the state, and hides itself from AT when unlabeled', () => {
    const { container } = render(<NovaVideo state="connecting" shouldMove label="" />);
    const wrap = container.querySelector('.nova-video')!;
    expect(wrap.getAttribute('data-nova-state')).toBe('connecting');
    expect(wrap.getAttribute('aria-hidden')).toBe('true');
  });

  it('marks the speaking state so CSS can drop its transition', () => {
    const { container } = render(<NovaVideo state="speaking" shouldMove label="Nova" />);
    const wrap = container.querySelector('.nova-video')!;
    expect(wrap.getAttribute('data-speaking')).toBe('true');
    // Labeled → announced as an image.
    expect(wrap.getAttribute('role')).toBe('img');
    expect(wrap.getAttribute('aria-label')).toBe('Nova');
  });

  it('does not autoplay when motion is withheld', () => {
    const { container } = render(<NovaVideo state="idle" shouldMove={false} label="" />);
    expect(container.querySelector('video')!.autoplay).toBe(false);
  });
});
