import type { NovaState } from '@/components/ui/nova-mark';

/**
 * The behaviour of Nova's physical presence, per state.
 *
 * ## Why this is a pure table, separate from the canvas
 *
 * The canvas in `components/nova/nova-presence.tsx` is imperative and hard to
 * assert against — jsdom has no 2D context. The *decisions* it makes, though —
 * how tightly particles orbit, whether they connect, how energetic the core is —
 * are just data, and data can be tested. Keeping the state→behaviour mapping
 * here means the meaningful contract ("connecting draws connections", "refused
 * disperses and dims", "speaking reacts to audio") is verifiable without a GPU.
 *
 * ## What the fields mean
 *
 * Every value is normalised 0–1 (except `speed`, an angular multiplier), so the
 * canvas can scale them to whatever pixel size it renders at. The canvas eases
 * the CURRENT values toward the target config each frame, which is what makes a
 * state change a smooth physical transition rather than a cut.
 *
 * ## The story the numbers tell
 *
 *     FRAGMENTATION → CONNECTION → CONVERGENCE → CLARITY
 *
 * Read the `orbit` column down the investigation path: wide and loose at idle,
 * streaming inward while searching, drawn into a connected ring, settling as it
 * composes, resolved and calm when ready. The visual is the thesis.
 */
export interface PresenceConfig {
  /** Target ring radius, as a fraction of the maximum. Small = drawn in. */
  orbit: number;
  /** Radial randomness around the ring. High = scattered, low = ordered. */
  spread: number;
  /** Angular speed multiplier. */
  speed: number;
  /** Core size multiplier around its base radius. */
  coreScale: number;
  /** Core brightness and glow, 0–1. */
  coreEnergy: number;
  /** Particle opacity, 0–1. */
  particleAlpha: number;
  /** Opacity of the hairline arcs between related particles, 0–1. */
  connections: number;
  /** How strongly particles stream toward the core (motion streaks), 0–1. */
  inward: number;
  /** How far particles scatter outward and fade — the NO_EVIDENCE state, 0–1. */
  disperse: number;
  /** Whether the core and particles react to spoken-audio amplitude. */
  audioReactive: boolean;
}

/**
 * ⚠ Every NovaState has an entry — a `Record`, not a partial map, so a new state
 *   cannot be added without deciding how the presence behaves in it. The two
 *   presentation states (`speaking`) and the pipeline states share the same
 *   visual language; nothing here implies reasoning.
 */
export const PRESENCE_CONFIG: Record<NovaState, PresenceConfig> = {
  // Present but inactive: a wide, slow, loosely-held field, quietly breathing.
  idle: {
    orbit: 0.72,
    spread: 0.18,
    speed: 0.25,
    coreScale: 1,
    coreEnergy: 0.5,
    particleAlpha: 0.55,
    connections: 0,
    inward: 0.1,
    disperse: 0.1,
    audioReactive: false,
  },
  // Attentive: the field draws in a little, brightens, leans toward the input.
  listening: {
    orbit: 0.6,
    spread: 0.12,
    speed: 0.36,
    coreScale: 1.02,
    coreEnergy: 0.64,
    particleAlpha: 0.72,
    connections: 0,
    inward: 0.4,
    disperse: 0,
    audioReactive: false,
  },
  // Gathering: particles stream toward the core, fast, with depth.
  searching: {
    orbit: 0.3,
    spread: 0.3,
    speed: 0.9,
    coreScale: 1.05,
    coreEnergy: 0.8,
    particleAlpha: 0.82,
    connections: 0.05,
    inward: 0.9,
    disperse: 0,
    audioReactive: false,
  },
  // Narrowing: the gathered field tightens as it is evaluated.
  evaluating: {
    orbit: 0.42,
    spread: 0.2,
    speed: 0.6,
    coreScale: 1.04,
    coreEnergy: 0.74,
    particleAlpha: 0.82,
    connections: 0.22,
    inward: 0.5,
    disperse: 0,
    audioReactive: false,
  },
  // Connecting: an ordered ring, related passages linked by hairline arcs.
  connecting: {
    orbit: 0.55,
    spread: 0.08,
    speed: 0.4,
    coreScale: 1.03,
    coreEnergy: 0.82,
    particleAlpha: 0.9,
    connections: 0.9,
    inward: 0.2,
    disperse: 0,
    audioReactive: false,
  },
  // Composing: motion settles, the structure holds, the core converges.
  composing: {
    orbit: 0.5,
    spread: 0.05,
    speed: 0.3,
    coreScale: 1.06,
    coreEnergy: 0.86,
    particleAlpha: 0.9,
    connections: 0.5,
    inward: 0.15,
    disperse: 0,
    audioReactive: false,
  },
  // Speaking: the answer exists; the body reacts to its own audio.
  speaking: {
    orbit: 0.58,
    spread: 0.1,
    speed: 0.36,
    coreScale: 1.08,
    coreEnergy: 0.9,
    particleAlpha: 0.86,
    connections: 0.3,
    inward: 0.2,
    disperse: 0,
    audioReactive: true,
  },
  // Ready: resolved, calm, the strongest sense of convergence.
  ready: {
    orbit: 0.62,
    spread: 0.06,
    speed: 0.22,
    coreScale: 1.05,
    coreEnergy: 0.82,
    particleAlpha: 0.8,
    connections: 0.35,
    inward: 0.1,
    disperse: 0,
    audioReactive: false,
  },
  // Limited: resolved, but a little of the field stays unsettled and dimmer.
  limited: {
    orbit: 0.62,
    spread: 0.14,
    speed: 0.24,
    coreScale: 1.03,
    coreEnergy: 0.68,
    particleAlpha: 0.7,
    connections: 0.25,
    inward: 0.1,
    disperse: 0.15,
    audioReactive: false,
  },
  // No evidence: quieter, dispersed, unresolved — uncertainty, not failure.
  refused: {
    orbit: 0.9,
    spread: 0.35,
    speed: 0.18,
    coreScale: 0.92,
    coreEnergy: 0.32,
    particleAlpha: 0.32,
    connections: 0,
    inward: 0,
    disperse: 0.8,
    audioReactive: false,
  },
};

export function resolvePresenceConfig(state: NovaState): PresenceConfig {
  return PRESENCE_CONFIG[state];
}
