import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { NovaVideo } from '@/components/nova/nova-video';
import { SurfaceLabel } from '@/components/ui/workspace-surface';
import { cn } from '@/lib/utils/cn';

/**
 * Nova on the dashboard — an intelligence presence, not a card with a video in it.
 *
 * ## Dissolved into the environment
 *
 * The container is deliberately NOT a `WorkspaceSurface`: no shadow, only a
 * hairline edge and a soft cyan atmosphere, so the Nova asset (already radially
 * masked) bleeds into the surface rather than sitting in a rectangle. The result
 * reads as "Nova is here", not "a video embed". The CTA is a quiet text link —
 * secondary to the presence itself.
 *
 * ## Honesty
 *
 * It makes no capability claim. The copy states only what Nova does — quote
 * published sources and cite them — and `/assistant` gates itself, so a prominent
 * entry here can never imply an answer the corpus cannot support.
 */
export function NovaInvite({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="nova-invite-heading"
      className={cn(
        'relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-white/[0.06] p-5 sm:p-6',
        className,
      )}
    >
      {/* Atmospheric cyan light — Nova's environment bleeding onto the workspace. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(75% 60% at 50% 32%, oklch(76% 0.127 203 / 0.12), transparent 66%)',
        }}
      />

      <SurfaceLabel as="p" id="nova-invite-heading" className="text-bahama-turquoise relative">
        Nova · Intelligence layer
      </SurfaceLabel>

      {/* The generated presence, idle — the dominant visual of this module. */}
      <NovaVideo state="idle" label="" className="relative aspect-video w-full" />

      <div className="relative min-w-0">
        <h2 className="text-on-ink text-base font-semibold tracking-[-0.01em] text-balance">
          Investigate with Nova
        </h2>
        <p className="text-on-ink-muted mt-1.5 max-w-md text-sm text-pretty">
          Answered only from the published sources for your jurisdiction, and cites every one.
        </p>
      </div>

      <Link
        href="/assistant"
        className="text-bahama-turquoise hover:text-on-ink relative mt-auto inline-flex w-fit items-center gap-1.5 rounded-sm pt-1 text-sm font-medium transition-colors duration-150"
      >
        Investigate with Nova
        <ArrowRight aria-hidden="true" className="size-4" strokeWidth={2} />
      </Link>
    </section>
  );
}
