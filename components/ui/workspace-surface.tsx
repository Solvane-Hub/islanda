import { cn } from '@/lib/utils/cn';

/**
 * A material in the authenticated environment.
 *
 * The workspace is not a page with cards on it. It is a small number of
 * surfaces suspended in water, and they descend rather than rise — the shell
 * lifts out of the environment, everything inside it is pushed further in.
 * That inversion is the same one §03 of the landing page uses, and it is what
 * stops the composition reading as glassmorphism-by-default.
 *
 *   shell  the workspace panel — the only surface lighter than the water, and
 *          the only one that blurs what is behind it
 *   inset  a sub-module within the shell, pushed back toward `abyss`
 *   deep   the focal module, furthest in and therefore highest contrast, which
 *          is why the one action that matters lives on it
 *
 * Only `shell` carries `backdrop-filter`. Inner modules sit on an already
 * blurred surface, so a second one would cost a compositing layer and change
 * nothing visible.
 *
 * Alphas are not adjustable by callers. Each was measured against the
 * composite over the brightest pixel of the environment photograph; a caller
 * passing `bg-white/20` would silently take the surface below AA.
 */
export type SurfaceTone = 'shell' | 'inset' | 'deep';

const TONES: Record<SurfaceTone, string> = {
  shell: 'bg-glass/62 border-white/10 shadow-glass rounded-2xl backdrop-blur-2xl sm:rounded-3xl',
  inset: 'bg-abyss/45 border-white/8 rounded-xl sm:rounded-2xl',
  deep: 'bg-glass-deep/88 border-white/10 shadow-glass rounded-xl sm:rounded-2xl',
};

/**
 * Hover and focus only — no entrance animation, no scroll trigger. The
 * workspace is somewhere a founder works, not something they watch.
 *
 * The hover value is per tone rather than a shared white wash. `inset` is
 * built from `abyss` over the shell, so it lightens by holding BACK alpha; a
 * single `hover:bg-white/5` would have darkened it, which is the wrong
 * direction for a hover state and exactly the sort of thing a shared
 * "interactive" class quietly gets wrong.
 */
const INTERACTIVE = 'transition-[background-color,border-color] duration-150';

const TONE_HOVER: Record<SurfaceTone, string> = {
  shell: 'hover:border-white/28 hover:bg-glass/78 focus-within:border-white/28',
  inset: 'hover:border-white/28 hover:bg-abyss/30 focus-within:border-white/28',
  deep: 'hover:border-white/28 hover:bg-glass-deep/78 focus-within:border-white/28',
};

export function WorkspaceSurface({
  tone = 'shell',
  interactive,
  as: As = 'div',
  className,
  children,
  ...rest
}: {
  tone?: SurfaceTone;
  /** Adds hover and focus-within response. For surfaces that contain a link. */
  interactive?: boolean;
  as?: 'div' | 'section' | 'article' | 'li';
  className?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'className'>) {
  return (
    <As
      className={cn(
        'relative border',
        TONES[tone],
        interactive && [INTERACTIVE, TONE_HOVER[tone]],
        className,
      )}
      {...rest}
    >
      {children}
    </As>
  );
}

/**
 * The label above a module.
 *
 * Small caps in champagne, which is the landing page's section-numbering
 * language brought inside. Editorial only — it is never a link, and nothing
 * here is clickable, so the accent stays unambiguous.
 *
 * ⚠ `as` chooses the ELEMENT, and every value renders identically. That is the
 *   point: a heading level is a statement about document structure, and it has
 *   to be chosen by where the label sits in the outline, not by how big it
 *   should look. Two labels at the same visual weight can legitimately be an
 *   `h2` and an `h3`, and a screen reader user navigating by heading depends on
 *   the difference.
 *
 *   `p` and `dt` exist for labels that are NOT headings — a caption above a
 *   definition list, a status line. Using `h2` there would put a phantom entry
 *   in the outline, which is the more common mistake.
 */
export function SurfaceLabel({
  children,
  id,
  as: As = 'h2',
  className,
}: {
  children: React.ReactNode;
  id?: string;
  as?: 'h2' | 'h3' | 'h4' | 'p' | 'dt';
  className?: string;
}) {
  return (
    <As
      id={id}
      className={cn('text-champagne text-2xs font-medium tracking-[0.14em] uppercase', className)}
    >
      {children}
    </As>
  );
}
