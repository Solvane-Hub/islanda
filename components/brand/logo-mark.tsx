import Image from 'next/image';
import { cn } from '@/lib/utils/cn';

/**
 * The Islanda brand mark (2026 asset).
 *
 * Source files, all authoritative — not redrawn or reproportioned. Each is
 * cropped to its own ink bounding box (the supplied canvases carried large
 * transparent margins), so a `height` prop produces the width you expect:
 *
 *   `islanda-mark.png`        the icon alone, 401×643 (aspect 0.624)
 *   `islanda-logo.png`        the full lockup as supplied — icon + "islanda"
 *                              wordmark in dark ink, baked into one image,
 *                              1487×406 (aspect 3.663)
 *   `islanda-logo-on-dark.png` the same lockup with ONLY the wordmark's dark
 *                              ink pixels recoloured white (thresholded by
 *                              luminance, the icon's own gradient untouched) —
 *                              for the one place the lockup sits directly on
 *                              a dark/photographic ground with no backing
 *                              plate. See `LogoLockup`'s `variant` prop.
 *
 * There are three ways to show the brand, each for a different situation:
 *
 *   `LogoMark`   icon only. Reads on both light and dark surfaces (the icon
 *                is a mid-toned teal/blue gradient) — use this in compact
 *                nav rails and on dark grounds.
 *   `Logo`       icon + HTML text. The text inherits `currentColor`, so this
 *                is the general-purpose header/nav lockup: it adapts to
 *                whatever surface it sits on automatically, light or dark.
 *   `LogoLockup` the supplied full-lockup graphic. Use this only where the
 *                exact designed lockup must appear as one image (the
 *                marketing hero) — never pair it with adjacent "Islanda"
 *                text, which would duplicate the wordmark already baked in.
 *                `variant="dark"` selects the white-wordmark file above for a
 *                dark ground; the icon itself is never recoloured either way.
 */
const MARK_ASPECT = 401 / 643;
const LOCKUP_ASPECT = 1487 / 406;

export function LogoMark({
  height = 28,
  className,
  priority,
}: {
  height?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/islanda-mark.png"
      // Decorative: the accessible name comes from adjacent text (`Logo`) or
      // the caller's own label, so announcing the mark too would just stutter.
      alt=""
      aria-hidden="true"
      width={Math.round(height * MARK_ASPECT)}
      height={height}
      className={cn('h-auto w-auto select-none', className)}
      style={{ height, width: Math.round(height * MARK_ASPECT) }}
      {...(priority ? { priority: true } : {})}
    />
  );
}

/** Mark + wordmark. The accessible name lives on the text. */
export function Logo({
  height = 26,
  className,
  priority,
}: {
  height?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark height={height} {...(priority ? { priority: true } : {})} />
      <span className="text-[1.0625rem] font-semibold tracking-[-0.02em]">Islanda</span>
    </span>
  );
}

/**
 * The full lockup — see the file doc comment for when to reach for this
 * instead of `Logo`. `width`/`height` describe the source pixels for Next's
 * `srcset`; render size is controlled by `className` (e.g. `w-[clamp(...)]
 * h-auto`) the same way `LogoMark`'s callers do.
 */
export function LogoLockup({
  variant = 'light',
  className,
  priority,
}: {
  /** `'dark'` selects the white-wordmark file for a dark/photographic ground. */
  variant?: 'light' | 'dark';
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={variant === 'dark' ? '/brand/islanda-logo-on-dark.png' : '/brand/islanda-logo.png'}
      alt="Islanda"
      width={1487}
      height={406}
      className={cn('h-auto w-full select-none', className)}
      {...(priority ? { priority: true } : {})}
    />
  );
}

/** Exported for anything sizing a container around the lockup (e.g. a backing plate). */
export const LOGO_LOCKUP_ASPECT = LOCKUP_ASPECT;
