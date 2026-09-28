/**
 * Original engraved devices for the cover.
 *
 * Both are drawn here rather than sourced, and both are deliberately generic
 * navigational/contour forms — a rose and a set of swell lines. Nothing here
 * imitates any state's arms, seal or security artwork, and nothing here
 * asserts anything about the business: they are printing, not information.
 *
 * Islanda's own language is navigation and water ("Navigate What's Next"),
 * so the rose and the swell are the house devices rather than borrowed ones.
 */
export function PassportRose({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className={className}
      stroke="currentColor"
      strokeWidth="0.6"
    >
      <circle cx="60" cy="60" r="44" />
      <circle cx="60" cy="60" r="34" />
      <circle cx="60" cy="60" r="16" opacity="0.7" />
      {/* Cardinal points, as a struck eight-point star. */}
      <path d="M60 8 L66 52 L60 60 L54 52 Z" />
      <path d="M60 112 L66 68 L60 60 L54 68 Z" />
      <path d="M8 60 L52 54 L60 60 L52 66 Z" />
      <path d="M112 60 L68 54 L60 60 L68 66 Z" />
      <path d="M23 23 L56 51 L60 60 L51 56 Z" opacity="0.55" />
      <path d="M97 97 L64 69 L60 60 L69 64 Z" opacity="0.55" />
      <path d="M97 23 L69 56 L60 60 L64 51 Z" opacity="0.55" />
      <path d="M23 97 L51 64 L60 60 L56 69 Z" opacity="0.55" />
      {/* Graduation ticks. Coordinates are rounded to three places before they
          reach the DOM: React serialises a raw double differently on the
          server (string) and on the client (number), and the last digit of
          `Math.cos()` was enough to trip a hydration mismatch. */}
      {Array.from({ length: 36 }, (_, i) => {
        const angle = (i * 10 * Math.PI) / 180;
        const inner = i % 3 === 0 ? 36 : 39;
        const tick = (origin: number, unit: number, radius: number) =>
          (origin + unit * radius).toFixed(3);
        return (
          <line
            key={i}
            x1={tick(60, Math.cos(angle), inner)}
            y1={tick(60, Math.sin(angle), inner)}
            x2={tick(60, Math.cos(angle), 43)}
            y2={tick(60, Math.sin(angle), 43)}
            opacity={i % 3 === 0 ? 0.8 : 0.4}
          />
        );
      })}
    </svg>
  );
}

/** A swell rule — the ruled band that closes the foot of the cover. */
export function PassportSwell({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 34"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={className}
      stroke="currentColor"
      strokeWidth="0.7"
    >
      {[0, 5, 10, 15, 20].map((offset, i) => (
        <path
          key={offset}
          d={`M0 ${14 + offset} C 40 ${4 + offset}, 80 ${24 + offset}, 120 ${14 + offset} S 200 ${4 + offset}, 240 ${14 + offset} S 300 ${24 + offset}, 320 ${12 + offset}`}
          opacity={0.9 - i * 0.16}
        />
      ))}
    </svg>
  );
}
