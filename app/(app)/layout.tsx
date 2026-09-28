import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/services/auth';
import { listBusinesses, resolveCurrentBusiness } from '@/services/business';
import { CURRENT_BUSINESS_COOKIE } from '@/lib/business-cookie';
import { Logo } from '@/components/brand/logo-mark';
import { Environment } from './_components/environment';
import { SidebarNav } from './_components/sidebar-nav';
import { MobileBottomNav } from './_components/mobile-bottom-nav';
import { BusinessSelector } from './_components/business-selector';
import { UserMenu } from './_components/user-menu';

/**
 * Authenticated application shell.
 *
 * The shell is an environment, not a chrome. A fixed photograph of the
 * territory sits behind everything; the header and the rail are translucent
 * panels suspended in it; the working area is transparent, so each route
 * decides its own material. That is the bridge from the landing page — a
 * founder crosses from the deep-water world into the instrument that operates
 * inside it, rather than into a different product. It is also the only surface
 * in the app dark enough for the champagne mark, which measures 1.84:1 on
 * canvas and 11.39:1 on ink.
 *
 * The rail floats with a margin rather than running edge to edge. A permanent
 * black column reads as an admin panel; a panel with water visible around it
 * reads as part of the environment, which is what the references do and what
 * makes the shell feel spatial rather than divided.
 *
 * `.workspace-env` is on the header and the rail, NOT on the root. Each route
 * owns its own material: most compose directly on the environment under
 * `.workspace-env` (dashboard, Nova, intake), and the long-form surfaces use
 * `WorkspaceCanvas`, which is itself a dark glass panel carrying the same scope.
 * The root stays neutral so a route is free to choose.
 *
 * On mobile, primary navigation moves from a hamburger-triggered copy of the
 * desktop rail into `MobileBottomNav` — a compact tab bar for the routes a
 * founder reaches most, with everything else one tap away in "More", grouped
 * by the same `NAV_SECTORS` the desktop rail uses (P7 Phase 1). The business
 * switcher used to disappear below `sm` with no replacement; it is now in the
 * header at every width, since it is a control a founder needs as often on a
 * phone as on a desktop.
 *
 * Middleware already redirects unauthenticated requests; this checks again.
 * Security Architecture: "No layer assumes another layer has already performed
 * validation." A proxy matcher change must not be able to silently expose a
 * protected route.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const db = await createClient();
  const user = await getCurrentUser(db);
  if (!user) redirect('/login');

  const [{ data: profile }, businesses, store] = await Promise.all([
    db.from('profiles').select('full_name').maybeSingle(),
    listBusinesses(db),
    cookies(),
  ]);

  const current = resolveCurrentBusiness(businesses, store.get(CURRENT_BUSINESS_COOKIE)?.value);

  return (
    <div className="relative min-h-dvh">
      <Environment />

      {/* Accessibility: keyboard users should be able to skip the nav. */}
      <a
        href="#main-content"
        className="bg-bahama-turquoise text-abyss sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      {/*
        The floating application frame.

        The whole product is one premium application suspended in the
        environment: a single rounded, hairline-bordered, deep-glass surface
        with the water visible around it. The top bar and the navigation rail
        live INSIDE it, and the workspace scrolls within it — so the shell reads
        as a desktop application, not a full-bleed website with a sidebar. On
        mobile the frame goes full-bleed (no margin, no corners) and the rail
        collapses into `MobileBottomNav`.

        The frame used to cap its own height at `min(74vh, 880px)` regardless of
        the actual viewport — on a 1440×900 screen that left roughly 610px of
        usable height and forced the whole workspace to scroll inside a box
        shorter than the window around it (P7 audit, "nested scrolling"). It now
        fills the space the outer padded wrapper actually gives it (`h-full`
        against that wrapper's `h-dvh` minus its own `p-6`/`p-8`) at every
        breakpoint, so the frame still reads as an inset, floating object — just
        sized to the screen it is on rather than to a fixed number.

        `.workspace-env` is on the frame, so every route inside inherits the
        dark-surface token remap. The frame owns the height and clips its own
        scroll, so the header, rail and mobile tab bar stay put while `main`
        scrolls.
      */}
      <div className="relative z-10 flex h-dvh items-stretch justify-center p-0 sm:items-center sm:p-6 lg:p-8">
        <div className="workspace-env app-frame bg-glass-deep/70 flex h-full w-full flex-col overflow-hidden border-white/12 backdrop-blur-2xl sm:w-[88vw] sm:max-w-[1600px] sm:rounded-3xl sm:border">
          {/* Internal top bar. */}
          <header className="bg-abyss/40 flex h-14 shrink-0 items-center gap-3 border-b border-white/8 px-4 sm:px-6">
            <Link
              href="/dashboard"
              aria-label="Islanda dashboard"
              className="text-on-ink shrink-0 rounded-sm"
            >
              <Logo height={20} />
            </Link>

            {current ? (
              <>
                <span aria-hidden="true" className="h-4 w-px shrink-0 bg-white/12" />
                <div className="min-w-0">
                  <BusinessSelector businesses={businesses} currentId={current.id} />
                </div>
              </>
            ) : null}

            <div className="ml-auto">
              <UserMenu email={user.email ?? null} fullName={profile?.full_name ?? null} />
            </div>
          </header>

          {/* Internal navigation rail + the scrolling workspace. */}
          <div className="flex min-h-0 flex-1">
            <aside className="hidden w-52 shrink-0 overflow-y-auto border-r border-white/8 px-3 py-5 md:block">
              <SidebarNav />
            </aside>

            <main id="main-content" className="min-w-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
                {children}
              </div>
            </main>
          </div>

          <MobileBottomNav />
        </div>
      </div>
    </div>
  );
}
