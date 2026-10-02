import { NovaMark } from '@/components/ui/nova-mark';
import { SurfaceLabel } from '@/components/ui/workspace-surface';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Nova's loading state.
 *
 * Without this file the `/assistant` route inherits the app-group loader
 * (`app/(app)/loading.tsx`), which is shaped like the dashboard briefing — a
 * dial, a snapshot grid, a timeline. Nova is not a dashboard, and settling a
 * dashboard silhouette into the composer was the previous version's tell that
 * the wrong page was loading.
 *
 * This mirrors Nova's OWN shape so the surface settles into place rather than
 * rearranging itself on arrival: the mark, the "Nova" label, one line of intent,
 * then the composer. It is deliberately minimal — the full Nova visual pass
 * comes later; this only has to communicate that NOVA IS INITIALIZING, in Nova's
 * language rather than the dashboard's.
 *
 * All existing design language: `NovaMark`, `SurfaceLabel`, `Skeleton`, and the
 * same glass composer treatment `NovaComposer` uses. Server Component — the mark
 * animates in CSS.
 */
export default function Loading() {
  return (
    <div
      className="workspace-env flex max-w-4xl flex-col gap-6 pt-3 sm:gap-8 sm:pt-6"
      role="status"
      aria-label="Nova is initializing"
    >
      <section className="flex flex-col gap-5 px-1">
        {/*
          The mark mid-search: nine scattered sources converging onto one axis —
          the product's whole story, and here it doubles as the loading
          indicator. Driven entirely by CSS, so this stays a Server Component and
          collapses to a static final frame under prefers-reduced-motion.
        */}
        <NovaMark state="searching" size={48} label="Nova is initializing" className="-mb-1" />

        <div className="min-w-0">
          <SurfaceLabel as="p">Nova</SurfaceLabel>
          <p className="text-on-ink mt-3 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            Setting up Nova…
          </p>
          <p className="text-on-ink-muted mt-3 max-w-xl text-sm text-pretty sm:text-base">
            Loading the published sources Islanda holds for your jurisdiction.
          </p>
        </div>
      </section>

      {/*
        The composer, settling into place. Same glass field, border and inner
        mark as NovaComposer, so nothing jumps when the real one replaces it. The
        inner mark stays idle — the surface mark above carries the activity, and
        two marks animating at once would compete.
      */}
      <div className="flex max-w-3xl flex-col gap-2">
        <div className="bg-glass-deep/88 shadow-glass rounded-2xl border border-white/10">
          <div className="flex items-start gap-3 p-3 sm:gap-3.5 sm:p-4">
            <span className="mt-2 shrink-0">
              <NovaMark state="idle" size={20} label="Nova" />
            </span>
            <div className="min-w-0 flex-1 py-2">
              <Skeleton className="h-4 w-2/3 max-w-xs" />
            </div>
            <Skeleton className="mt-1 size-9 shrink-0 rounded-full" />
          </div>
        </div>
        <Skeleton className="mx-1 h-3 w-64 max-w-full" />
      </div>

      <span className="sr-only">Nova is initializing…</span>
    </div>
  );
}
