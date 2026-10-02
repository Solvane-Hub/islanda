import Link from 'next/link';

/**
 * Footer.
 *
 * Islanda is the product and owns the page; Solvane Hub is the builder and
 * appears once, here, at body-text weight. Brand hierarchy is a decision, and
 * this is where it is enforced.
 *
 * Sits on `abyss` so it continues §06's surface rather than stepping back up a
 * tone — the page bottoms out and stays there.
 */
export function SiteFooter() {
  return (
    <footer className="bg-abyss text-on-ink-muted border-ink-line/70 border-t">
      <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-8 lg:px-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <span className="text-on-ink text-[0.9375rem] font-semibold tracking-[-0.02em]">
              Islanda
            </span>
            <p className="text-sm">An operating system for building a business in The Bahamas.</p>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/login" className="hover:text-on-ink rounded-sm text-sm transition-colors">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-on-ink rounded-sm text-sm transition-colors">
              Create an account
            </Link>
          </nav>
        </div>

        <div className="border-ink-line mt-10 flex flex-col gap-2 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-on-ink-subtle text-xs">Islanda is built by Solvane Hub.</p>
          <p className="text-on-ink-subtle text-xs">Nassau, The Bahamas</p>
        </div>
      </div>
    </footer>
  );
}
