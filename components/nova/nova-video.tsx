'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils/cn';
import { usePrefersReducedMotion } from '@/lib/design/motion';
import { novaStateLabel, type NovaState } from '@/components/ui/nova-mark';

/**
 * Nova's physical presence — the generated Kling asset.
 *
 * This replaces the SVG/canvas placeholder. The real intelligence identity is a
 * rendered video (crystalline turquoise shell, molten champagne core, particles,
 * deep-black environment), so it is played rather than drawn.
 *
 * ## Compositing, not a video box
 *
 * The asset is on a near-black ground. `mix-blend-mode: screen` drops that black
 * into the environment (black contributes nothing under screen) while Nova's
 * light adds onto the surface behind it, and a soft radial mask feathers the
 * rectangular edges away. The result reads as a presence suspended in the
 * environment, never as an embedded `<video>` with borders or controls.
 *
 * ## State → visual behaviour (assets we actually have)
 *
 * The Nova state machine stays the behavioural source of truth; this only maps
 * it to visuals. We have ONE asset (idle), so:
 *   • idle / ready / limited      → the idle loop, settled
 *   • listening / searching / …   → the same loop, a touch brighter and larger
 *   • speaking                    → audio-reactive (below)
 *   • refused (no evidence)       → the loop, quieted and desaturated
 * No fake per-state animations are invented; missing states reuse idle.
 *
 * ## Audio-reactive (locked pipeline)
 *
 * The Fish voice's amplitude (`levelRef`, written by `use-nova-speech`) gently
 * scales the body and lifts its brightness/glow while speaking — a physical
 * response, smoothed in JS so nothing pulses per frame. Never a waveform.
 *
 * ## Respect
 *
 * Under `prefers-reduced-motion` (`shouldMove=false`) the video is paused on a
 * frame — Nova is present but still. Muted, looping, `playsInline`, no controls.
 * The rAF loop runs only while speaking and is cancelled on unmount.
 */

const NOVA_IDLE_SRC = '/nova/nova-idle.mp4';

/** Resting scale / brightness / saturation per state (speaking is live-driven). */
function baseTone(state: NovaState): { scale: number; bright: number; sat: number; glow: number } {
  switch (state) {
    case 'listening':
      return { scale: 1.02, bright: 1.12, sat: 1.05, glow: 0.35 };
    case 'searching':
    case 'evaluating':
    case 'connecting':
    case 'composing':
      return { scale: 1.015, bright: 1.08, sat: 1.05, glow: 0.3 };
    case 'ready':
      return { scale: 1, bright: 1.03, sat: 1, glow: 0.22 };
    case 'limited':
      return { scale: 1, bright: 0.98, sat: 0.96, glow: 0.18 };
    case 'refused':
      // No evidence: quieter and desaturated — present, not broken.
      return { scale: 0.985, bright: 0.82, sat: 0.7, glow: 0.08 };
    case 'speaking':
      return { scale: 1.02, bright: 1.1, sat: 1.06, glow: 0.4 };
    default:
      return { scale: 1, bright: 1, sat: 1, glow: 0.2 };
  }
}

export function NovaVideo({
  state,
  levelRef,
  shouldMove,
  className,
  label,
}: {
  state: NovaState;
  /** Spoken-audio amplitude 0–1, read per frame while `state` is `speaking`. */
  levelRef?: React.RefObject<number>;
  /** Omit to resolve from `prefers-reduced-motion` (for server-rendered callers). */
  shouldMove?: boolean;
  className?: string;
  /** Accessible name; pass '' to hide when a status line carries the state. */
  label?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const move = shouldMove ?? !reduced;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const smoothRef = useRef(0);

  const speaking = state === 'speaking';

  // Play under motion; pause on a frame under reduced motion.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (move) {
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } else {
      try {
        v.pause();
      } catch {
        /* not ready */
      }
    }
  }, [move]);

  // Resting tone for the current state (non-speaking). Applied as CSS vars so
  // the video eases between states via a CSS transition.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || speaking) return;
    const tone = baseTone(state);
    wrap.style.setProperty('--nova-scale', String(tone.scale));
    wrap.style.setProperty('--nova-bright', String(tone.bright));
    wrap.style.setProperty('--nova-sat', String(tone.sat));
    wrap.style.setProperty('--nova-glow', String(tone.glow));
  }, [state, speaking]);

  // Audio-reactive loop, only while speaking and moving.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !speaking || !move || !levelRef) return;
    const tone = baseTone('speaking');

    const tick = () => {
      const target = Math.min(1, Math.max(0, levelRef.current ?? 0));
      smoothRef.current += (target - smoothRef.current) * 0.18;
      const l = smoothRef.current;
      wrap.style.setProperty('--nova-scale', String(tone.scale + l * 0.06));
      wrap.style.setProperty('--nova-bright', String(tone.bright + l * 0.28));
      wrap.style.setProperty('--nova-sat', String(tone.sat + l * 0.1));
      wrap.style.setProperty('--nova-glow', String(0.35 + l * 0.5));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [speaking, move, levelRef]);

  const accessibleName = label === undefined ? novaStateLabel(state) : label;

  return (
    <div
      ref={wrapRef}
      className={cn('nova-video', className)}
      data-nova-state={state}
      data-speaking={speaking ? 'true' : undefined}
      {...(accessibleName
        ? { role: 'img', 'aria-label': accessibleName }
        : { 'aria-hidden': true })}
    >
      <span aria-hidden="true" className="nova-video__glow" />
      <video
        ref={videoRef}
        className="nova-video__media"
        src={NOVA_IDLE_SRC}
        muted
        loop
        playsInline
        autoPlay={move}
        preload="auto"
        tabIndex={-1}
      />
    </div>
  );
}
