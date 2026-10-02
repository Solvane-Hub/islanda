import { cn } from '@/lib/utils/cn';

/**
 * The business's identity mark — where a personal passport carries a
 * photograph, this carries the business's own logo.
 *
 * Rendered as a mounted plate rather than an avatar: a dark tile, a foil
 * edge, an inner keyline, and a soft bloom behind it, so the mark reads as
 * set INTO the document rather than floating on top of it. `logoUrl` is the
 * business's uploaded logo when it has one; otherwise a deterministic
 * monogram. Never the Islanda mark — this slot is the business's identity,
 * not the platform's.
 */
export function PassportMonogram({
  name,
  logoUrl = null,
  size = 104,
  className,
}: {
  name: string | null;
  logoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const initials = monogramFor(name);

  return (
    <span
      style={{ width: size, height: size }}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[22%]',
        'from-passport-cover to-passport-cover-deep bg-gradient-to-br',
        'ring-passport-foil/45 shadow-[0_0_0_1px_oklch(0%_0_0/0.55),0_14px_28px_-14px_oklch(0%_0_0/0.85)] ring-1',
        className,
      )}
    >
      {/* Inner keyline — the second, tighter edge a mounted plate carries. */}
      <span
        aria-hidden="true"
        className="ring-passport-foil/15 pointer-events-none absolute inset-[7%] rounded-[18%] ring-1"
      />
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a signed storage URL, not a static asset
        <img src={logoUrl} alt="" className="relative h-full w-full object-cover" />
      ) : (
        <span
          aria-hidden="true"
          className="passport-foil relative font-semibold tracking-[0.02em]"
          style={{ fontSize: size * 0.34 }}
        >
          {initials}
        </span>
      )}
    </span>
  );
}

function monogramFor(name: string | null): string {
  if (!name) return '—';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}
