import type { Metadata } from 'next';
import { Environment } from '@/app/(app)/_components/environment';

/**
 * Team-only shell. Same atmosphere and dark-glass frame as the auth and app
 * shells (`.workspace-env` remaps every primitive to the dark tokens), but wide
 * enough for a table. Never indexed: nothing here is for the public.
 *
 * Access is enforced per page (staff role) and by RLS — this layout grants
 * nothing on its own.
 */
export const metadata: Metadata = {
  title: 'Team',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh">
      <Environment />
      <div className="relative z-10 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="workspace-env app-frame bg-glass-deep/90 sm:bg-glass-deep/75 mx-auto w-full max-w-[96rem] rounded-3xl border border-white/12 px-4 py-6 backdrop-blur-2xl sm:px-8 sm:py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
