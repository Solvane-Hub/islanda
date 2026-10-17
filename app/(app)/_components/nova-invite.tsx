import Link from 'next/link';
import { ArrowRight, LifeBuoy } from 'lucide-react';
import { SurfaceLabel, WorkspaceSurface } from '@/components/ui/workspace-surface';
import { cn } from '@/lib/utils/cn';

/**
 * "Get help" on the dashboard — a doorway to Nova, introduced by its job.
 *
 * Nova is named, but as the helper, not as the explanation of the product.
 * The copy claims only what the extractive path does — quote the official
 * documents Islanda holds and link each one — and says plainly that it does not
 * hold every rule. `/assistant` gates itself, so this entry can never imply an
 * answer the published sources cannot support.
 *
 * No video here: an autoplaying presence on the most-visited page cost every
 * visit bandwidth on exactly the modest phones this product is for.
 */
export function NovaInvite({ className }: { className?: string }) {
  return (
    <WorkspaceSurface
      as="section"
      tone="inset"
      aria-labelledby="nova-invite-heading"
      className={cn('flex flex-col gap-3 p-5 sm:p-6', className)}
    >
      <div className="flex items-center gap-2.5">
        <LifeBuoy aria-hidden="true" className="text-bahama-turquoise size-4" strokeWidth={2} />
        <SurfaceLabel as="h2" id="nova-invite-heading">
          Get help with your business
        </SurfaceLabel>
      </div>
      <p className="text-on-ink-muted max-w-md text-sm text-pretty">
        Ask Nova a question. It answers with the exact words from the official documents Islanda
        holds, and cites every one. It doesn&apos;t have every rule yet, and it tells you when it
        can&apos;t find an answer.
      </p>
      <Link
        href="/assistant"
        className="text-bahama-turquoise hover:text-on-ink inline-flex min-h-11 w-fit items-center gap-1.5 rounded-sm text-sm font-medium transition-colors duration-150"
      >
        Ask a question
        <ArrowRight aria-hidden="true" className="size-4" strokeWidth={2} />
      </Link>
    </WorkspaceSurface>
  );
}
