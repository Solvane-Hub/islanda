import Link from 'next/link';
import { AnalyticsChoicesButton } from '@/components/analytics/analytics-choices-button';
import { ACCESS_COPY, type AccessMode } from '@/lib/product/availability';
import { PRODUCT_NAME, TAGLINE } from '@/lib/brand';

/**
 * Footer.
 *
 * Islanda is the product and owns the page; Solvane Hub is the builder and
 * appears once, here, at body-text weight. Brand hierarchy is a decision, and
 * this is where it is enforced.
 *
 * Its links follow the access mode, like every other door on the page: no
 * "Create an account" link while sign-up redirects straight back here.
 */
export function SiteFooter({ mode }: { mode: AccessMode }) {
  const open = ACCESS_COPY[mode].signUpAvailable;
  const linkClass =
    'hover:text-on-ink inline-flex min-h-11 items-center rounded-sm text-sm transition-colors';
  return (
    <footer className="bg-abyss text-on-ink-muted border-ink-line/70 border-t">
      <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-8 lg:px-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <span className="text-on-ink text-[0.9375rem] font-semibold tracking-[-0.02em]">
              {PRODUCT_NAME}
            </span>
            <p className="text-sm">{TAGLINE}</p>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <Link href="#waitlist" className={linkClass}>
              Join the waitlist
            </Link>
            {open ? (
              <>
                <Link href="/login" className={linkClass}>
                  Sign in
                </Link>
                <Link href="/signup" className={linkClass}>
                  Create an account
                </Link>
              </>
            ) : null}
          </nav>
        </div>

        <div className="border-ink-line mt-10 flex flex-col gap-2 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-on-ink-subtle text-xs">
            Islanda is built by Solvane Hub. It is not a government service.
          </p>
          <div className="flex items-center gap-4">
            <AnalyticsChoicesButton className="text-on-ink-subtle hover:text-on-ink inline-flex min-h-11 items-center rounded-sm text-xs underline-offset-4 transition-colors hover:underline" />
            <p className="text-on-ink-subtle text-xs">Nassau, The Bahamas</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
