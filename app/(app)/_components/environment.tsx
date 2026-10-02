/**
 * The atmosphere the application floats in.
 *
 * Near-black deep-ocean space with two restrained blue lights and a corner
 * vignette, so the floating application frame reads as a physical object
 * suspended in the environment rather than a page on a background. A single
 * low-opacity glow drifts slowly (only under `prefers-reduced-motion:
 * no-preference`) so the space feels alive without announcing that it moves.
 *
 * ⚠ Deliberately NOT a photograph and NOT a gradient hero. All of it is in
 *   `.app-environment` in `app/globals.css`; the contrast for everything above
 *   it comes from the frame's own dark glass, not from this layer.
 *
 * `aria-hidden` throughout — it is atmosphere, and a screen reader describing it
 * before the founder's next action would be noise. `z-0`, with the shell's
 * content above it on `z-10`.
 */
export function Environment() {
  return (
    <div aria-hidden="true" className="app-environment">
      <div className="app-environment__glow" />
    </div>
  );
}
