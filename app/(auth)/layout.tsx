import Link from 'next/link';
import { Environment } from '@/app/(app)/_components/environment';
import { Logo } from '@/components/brand/logo-mark';

/**
 * Auth shell — the entrance into the same world as the dashboard and Nova.
 *
 * Not a separate product: it renders the exact application `Environment`
 * (near-black deep-ocean atmosphere) and carries `.workspace-env`, so every
 * control below inherits the dark-surface token remap — warm-white type on deep
 * glass, hairline borders, and the Bahamian-turquoise primary action. The mark
 * is the same `Logo` the authenticated app shell uses, so a founder sees one
 * continuous identity from sign-in through to the dashboard. The forms, their
 * Supabase actions, validation, error handling, loading states and routing are
 * untouched; this is only the surface they sit on.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh">
      <Environment />

      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-5 py-10 sm:px-6">
        <div className="workspace-env app-frame bg-glass-deep/70 flex w-full max-w-md flex-col gap-8 rounded-3xl border border-white/12 px-7 py-9 backdrop-blur-2xl sm:px-10 sm:py-11">
          <header className="flex flex-col gap-3">
            <Link href="/" className="text-on-ink inline-flex w-fit items-center rounded-sm">
              <Logo height={24} />
            </Link>
            <p className="text-champagne-dim text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
              Intelligence for entrepreneurship
            </p>
          </header>

          <main className="flex flex-col">{children}</main>

          <footer className="text-on-ink-subtle border-t border-white/8 pt-5 text-xs">
            An AI-native operating system for entrepreneurship. From Solvane Hub.
          </footer>
        </div>
      </div>
    </div>
  );
}
