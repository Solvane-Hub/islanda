/**
 * Motion vocabulary.
 *
 * The CSS custom properties in `app/globals.css` are the source of truth for
 * duration and easing; this module exists for the two things CSS cannot do —
 * naming the durations where JavaScript needs to sequence something, and
 * telling a component whether the person has asked for less motion.
 *
 * ⚠ Nothing here should be used to animate in JavaScript. Every animation in
 *   this product is a CSS transition or keyframe, which means it runs off the
 *   main thread, survives a slow render, and is switched off wholesale by the
 *   `prefers-reduced-motion` rule in the base layer. A JS animation loop would
 *   have none of those properties.
 */

/** Milliseconds. Mirrors `--duration-*`. Keep the two in step. */
export const DURATION = Object.freeze({
  instant: 90,
  quick: 160,
  settle: 320,
  considered: 560,
});

export type DurationName = keyof typeof DURATION;

/**
 * Whether the person has asked for reduced motion.
 *
 * ## Why this is threaded through context rather than read per component
 *
 * Taken from the receipt-printer experiment, which resolves it once at the
 * root and passes a `shouldMove` boolean down. That matters: if each component
 * reads the preference independently, a change mid-session can leave half a
 * composition animating and half of it static — which is more disorienting
 * than either state on its own. One read, one answer, everything agrees.
 *
 * SSR-safe. The server renders `false`, and the first client effect corrects
 * it. `false` is the safe default in the sense that matters here: the base CSS
 * layer already clamps durations under the media query, so a component that
 * briefly believes motion is allowed still cannot actually animate.
 */
import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * `useSyncExternalStore`, not `useState` + `useEffect`.
 *
 * The effect version reads the media query AFTER the first paint and then sets
 * state, which renders twice and — for one frame — tells every consumer that
 * motion is allowed when it is not. On a state machine that starts animating
 * immediately, that frame is visible.
 *
 * This subscribes to the media query as what it actually is: an external store
 * React can read synchronously during render. One render, no flash, and the
 * server snapshot is explicit rather than an initial value that happens to be
 * wrong until an effect corrects it.
 */
function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }

  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  // jsdom does not implement `matchMedia`, and neither do some embedded
  // browsers. Absent support means we cannot know the preference — and the
  // base CSS layer clamps durations under the media query regardless, so
  // reporting `false` here cannot actually let anything animate.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
