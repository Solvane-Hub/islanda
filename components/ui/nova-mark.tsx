import { cn } from '@/lib/utils/cn';

/**
 * Nova's mark.
 *
 * Nine points and one axis. Scattered, the points are the fragmented sources a
 * founder would otherwise search by hand — separate Acts, regulations, agency
 * notices, none of them talking to each other. Converged, they sit in order on
 * a single line. That journey IS the product:
 *
 *     FRAGMENTATION  →  CONVERGENCE  →  CLARITY
 *
 * ## Why this and not an orb
 *
 * A glowing dotted sphere is what every assistant shipped in the last two
 * years looks like. It communicates "there is an AI here" and nothing else.
 * This mark communicates what the AI does, and it stays legible with the word
 * "Nova" removed — which is the only real test of an identity.
 *
 * ## The states are system states
 *
 * ⚠ Each state names a stage the pipeline genuinely passes through: retrieval,
 *   deterministic filtering, extraction, envelope validation. None of them
 *   exposes reasoning, and the extractive reasoner has none to expose — it
 *   selects and quotes passages, it does not deliberate. An animation that
 *   implied hidden deliberation would be describing a system we deliberately
 *   did not build.
 *
 * ## Accessibility
 *
 * `role="img"` with a per-state label, so the status reaches a screen reader
 * as words. The geometry is `aria-hidden` — an aerial description of nine
 * moving dots helps nobody. Under `prefers-reduced-motion` the base layer
 * collapses every transition and each state resolves instantly to its final
 * frame; looping animations are gated behind `no-preference` in CSS, because a
 * loop clamped to 0.01ms strobes.
 *
 * All animation is CSS. This stays a Server Component.
 */

export type NovaState =
  /** Present, no request in flight. */
  | 'idle'
  /** The founder is composing a question. */
  | 'listening'
  /** Retrieval is running against the published pack. */
  | 'searching'
  /** Deterministic filters and ranking are narrowing the result set. */
  | 'evaluating'
  /**
   * Related passages are being drawn together — the citation graph's
   * same-document relationships, made visible. Not a claim about legal
   * relationships (see `nova-field.tsx`): only that these came from one source.
   */
  | 'connecting'
  /** The extractive reasoner is selecting passages and building the envelope. */
  | 'composing'
  /**
   * Nova is speaking its result aloud. A presentation state, not a pipeline
   * stage: the answer already exists, and the body is reacting to its own audio.
   */
  | 'speaking'
  /** An answer is available. */
  | 'ready'
  /** An answer is available, but coverage is incomplete. */
  | 'limited'
  /** No retrieved passage supported the question. */
  | 'refused';

/**
 * What a screen reader is told. Plain system status — never a claim about the
 * law, and never a description of reasoning.
 */
const STATE_LABEL: Record<NovaState, string> = {
  idle: 'Nova is ready',
  listening: 'Nova is waiting for your question',
  searching: 'Nova is searching the published sources',
  evaluating: 'Nova is narrowing the sources it found',
  connecting: 'Nova is drawing together passages from the same sources',
  composing: 'Nova is assembling an answer from the sources',
  speaking: 'Nova is speaking its answer',
  ready: 'Nova has an answer',
  limited: 'Nova has a partial answer',
  refused: 'Nova found nothing that answers this',
};

/**
 * Point geometry, in a 48×48 user-space box.
 *
 * `s` is the scattered position, `c` the converged one. Converged points are
 * evenly spaced along y = 24 — the ordered answer. Scattered positions are
 * hand-placed rather than generated: a random field clusters and reads as
 * noise, and the whole point is that the BEFORE state should look like
 * fragmentation rather than like static.
 *
 * Nine points. Enough to read as "many", few enough to resolve at 20px.
 */
const POINTS: readonly { s: [number, number]; c: [number, number] }[] = [
  { s: [7, 11], c: [6, 24] },
  { s: [17, 6], c: [10.5, 24] },
  { s: [30, 9], c: [15, 24] },
  { s: [41, 14], c: [19.5, 24] },
  { s: [10, 22], c: [24, 24] },
  { s: [38, 27], c: [28.5, 24] },
  { s: [8, 36], c: [33, 24] },
  { s: [22, 41], c: [37.5, 24] },
  { s: [35, 38], c: [42, 24] },
];

export interface NovaMarkProps {
  state?: NovaState;
  /** Rendered box in pixels. Tuned for 20, 48 and 96. */
  size?: number;
  /**
   * Overrides the per-state label. Use when the surrounding copy already
   * states the status, to avoid announcing it twice.
   */
  label?: string;
  className?: string;
}

export function NovaMark({ state = 'idle', size = 48, label, className }: NovaMarkProps) {
  // Dots stay legible at 20px and never look coarse at 96px. Below ~28px the
  // axis needs proportionally more weight or it disappears entirely.
  const radius = size <= 24 ? 2.6 : 2.1;
  const axisHeight = size <= 24 ? 1.4 : 1;

  return (
    <span
      role="img"
      aria-label={label ?? STATE_LABEL[state]}
      data-nova-state={state}
      className={cn('inline-flex shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        width={size}
        height={size}
        fill="none"
        className="overflow-visible"
      >
        {/* The axis: the ordered answer the points resolve onto. It is drawn
            first so the points always sit above it. */}
        <rect
          className="nova-axis fill-bahama-turquoise"
          x="4"
          y={24 - axisHeight / 2}
          width="40"
          height={axisHeight}
          rx={axisHeight / 2}
        />

        {POINTS.map((point, i) => (
          <circle
            key={`${point.s[0]}-${point.s[1]}`}
            className="nova-point fill-on-ink"
            cx="0"
            cy="0"
            r={radius}
            style={
              {
                '--sx': point.s[0],
                '--sy': point.s[1],
                '--cx': point.c[0],
                '--cy': point.c[1],
                '--i': i,
              } as React.CSSProperties
            }
          />
        ))}
      </svg>
    </span>
  );
}

/** Exported for tests and for surfaces that state the status in their own copy. */
export function novaStateLabel(state: NovaState): string {
  return STATE_LABEL[state];
}
