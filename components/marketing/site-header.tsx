import Link from 'next/link';

/**
 * Site header — the `banner` landmark, sitting directly on the photograph.
 *
 * Quiet by design: no logo. The hero below establishes the brand with the
 * full lockup, and showing it again here would be the exact duplicate
 * branding the header is deliberately avoiding — one Islanda mark per
 * viewport, not two. "Sign in" is the header's only job.
 *
 * The vignette band remains for legibility, not decoration: measured on the
 * actual hero pixels, the top-right corner is barely scrimmed by the hero's
 * own directional gradient, and "Sign in" there measured 3.17:1 without it —
 * under AA. The band takes it to 8.69:1, solved by the photograph's own
 * language instead of by a black box.
 *
 * Positioned by the page so it can stay a sibling of `<main>` and keep its
 * landmark role.
 */
export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-30">
      {/* Vignette, not chrome. Decorative and non-interactive. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-24"
        style={{
          background:
            'linear-gradient(to bottom, oklch(18% 0.055 245 / 0.5) 0%, oklch(18% 0.055 245 / 0.22) 45%, transparent 100%)',
        }}
      />

      <div className="mx-auto flex w-full max-w-[92rem] items-center justify-end px-6 py-6 sm:px-8 lg:px-12">
        <Link
          href="/login"
          className="text-on-ink inline-flex min-h-11 items-center rounded-sm px-1 text-sm font-medium drop-shadow-sm transition-opacity hover:opacity-80"
        >
          Sign in
        </Link>
      </div>
    </header>
  );
}
