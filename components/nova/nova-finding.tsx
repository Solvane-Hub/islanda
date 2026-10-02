'use client';

import { Landmark, Scale } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Evidence } from '@/components/ui/evidence';
import { SurfaceLabel } from '@/components/ui/workspace-surface';
import { useIsRelated, useNovaFocus } from '@/components/nova/nova-focus';
import type { NovaClaimView } from '@/types/nova';

/**
 * One finding, and everything that supports it.
 *
 * ## A band, not a card
 *
 * Cards were the wrong metaphor. Eight bordered boxes stacked vertically read
 * as a list of records — precisely the "government database" feel the product
 * must not have. A finding is a full-width band with an evidence rail down its
 * left edge, hairline-separated from the next. The rail is what carries
 * continuity, so the answer reads as one investigation rather than as several
 * unrelated results.
 *
 * ## The bands, in the order the pipeline established them
 *
 *     PROVISION  →  PASSAGE  →  SOURCE  →  LATER EFFECTS
 *
 * That order is the receipt-printer principle at the right granularity. The
 * idea worth borrowing was never paper — it was that a receipt does not appear,
 * it FEEDS, one line at a time, in the order the machine prints them.
 *
 * ⚠ Every band is data that has ALREADY ARRIVED. The staging is fast (55ms
 *   steps) and no status line accompanies it, because implying that evidence
 *   is still being fetched when it is already in hand would be exactly the kind
 *   of small dishonesty this architecture exists to prevent.
 *
 * ## The relationship
 *
 * Hovering or focusing the finding lights its sources in the constellation
 * above; hovering a node there lights this finding. Same relationship, both
 * directions, no graph diagram. The highlight is decorative — the finding
 * already lists its sources in text — so nothing is lost if it is not
 * perceived.
 */

export function NovaFinding({
  claim,
  index,
  className,
}: {
  claim: NovaClaimView;
  index: number;
  className?: string;
}) {
  const { focus, focusedChunk, relatedChunks } = useNovaFocus();
  const chunkIds = claim.citations.map((c) => c.chunkId);

  /**
   * Related when ANY of this finding's chunks is focused.
   *
   * Computed from one context read rather than by calling `useIsRelated` per
   * citation: a hook inside a `.map` makes the hook count depend on how many
   * sources a claim happens to cite, which is a rules-of-hooks violation and a
   * genuine crash the first time two answers have different citation counts.
   */
  const related =
    focusedChunk !== null &&
    chunkIds.some((id) => id === focusedChunk || relatedChunks.includes(id));

  const headingId = `nova-finding-${index}`;
  const highlight = () => focus(chunkIds[0] ?? null, chunkIds);
  const release = () => focus(null);

  return (
    <article
      aria-labelledby={headingId}
      data-related={related ? 'true' : undefined}
      onMouseEnter={highlight}
      onMouseLeave={release}
      onFocus={highlight}
      onBlur={release}
      className={cn('nova-finding stage-band py-6 pl-6 sm:py-7 sm:pl-8', className)}
      style={{ '--band': index } as React.CSSProperties}
    >
      <span aria-hidden="true" className="nova-finding-node" />

      {/*
        The accessible name says "passage", not "finding".
        What this band contains is a verbatim quotation, and the name a screen
        reader announces should describe the content rather than the product's
        word for the container.
      */}
      <h3 id={headingId} className="sr-only">
        {claim.sectionReference ? `Passage from ${claim.sectionReference}` : `Passage ${index + 1}`}
      </h3>

      {/* Band 1 — the provision. What this finding is about, before its text. */}
      <div
        className="stage-band flex items-baseline gap-3"
        style={{ '--band': 0 } as React.CSSProperties}
      >
        {claim.sectionReference ? (
          <SurfaceLabel as="p">{claim.sectionReference}</SurfaceLabel>
        ) : (
          <SurfaceLabel as="p" className="text-on-glass-subtle">
            Provision not stated
          </SurfaceLabel>
        )}
        <span className="text-on-glass-subtle text-2xs ml-auto shrink-0" data-numeric>
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>

      {/* Band 2 — the passage. The source's own words, marked up as a quotation. */}
      <div className="stage-band mt-3" style={{ '--band': 1 } as React.CSSProperties}>
        <blockquote className="border-bahama-turquoise/50 border-l-2 pl-4">
          <p className="text-on-ink text-base text-pretty sm:text-lg">{claim.statement}</p>
        </blockquote>
      </div>

      {/* Band 3 — the chain down to the source. */}
      <div className="stage-band mt-5" style={{ '--band': 2 } as React.CSSProperties}>
        <div className="mb-2.5 flex items-center gap-2.5">
          <Landmark aria-hidden="true" className="text-champagne size-3.5" strokeWidth={2} />
          <SurfaceLabel as="h4">{claim.citations.length === 1 ? 'Source' : 'Sources'}</SurfaceLabel>
        </div>

        <Evidence.Root>
          {claim.citations.map((citation) => (
            <SourceRow key={citation.chunkId} chunkId={citation.chunkId} siblings={chunkIds}>
              <Evidence.Source citation={citation} />
            </SourceRow>
          ))}
        </Evidence.Root>
      </div>

      {/*
        Band 4 — later effects.

        Rendered whenever amendments exist OR the current position could not be
        established. The second case matters: when the amendment chain cannot be
        resolved there are no amendments to list, and showing nothing would
        present an unverified provision as settled — the exact unsafe-direction
        default this whole layer exists to prevent.
      */}
      {claim.amendments.length > 0 || !claim.currentApplicabilityEstablished ? (
        <div className="stage-band mt-5" style={{ '--band': 3 } as React.CSSProperties}>
          <LaterEffects claim={claim} />
        </div>
      ) : null}
    </article>
  );
}

/**
 * A source row that participates in the relationship.
 *
 * Split out so the hook is called once per row rather than conditionally —
 * `useIsRelated` is a hook, and hooks cannot run inside a `.map` callback in
 * the parent without becoming order-dependent on the citation count.
 */
function SourceRow({
  chunkId,
  siblings,
  children,
}: {
  chunkId: string;
  siblings: readonly string[];
  children: React.ReactNode;
}) {
  const { focus } = useNovaFocus();
  const related = useIsRelated(chunkId);

  return (
    <div
      data-chunk={chunkId}
      data-related={related ? 'true' : undefined}
      onMouseEnter={() => focus(chunkId, siblings)}
      onMouseLeave={() => focus(null)}
      className={cn(
        'rounded-lg px-2 py-1.5 transition-colors duration-150',
        related && 'bg-bahama-turquoise/8',
      )}
    >
      {children}
    </div>
  );
}

/**
 * What later instruments do to this provision.
 *
 * ⚠ `currentApplicabilityEstablished: false` is not an error. It means the
 *   passage is quoted correctly and something later affects it whose
 *   commencement could not be verified — so the position is deliberately left
 *   unstated. The visual language says "held open", never "failed".
 */
function LaterEffects({ claim }: { claim: NovaClaimView }) {
  return (
    <div className="border-l border-white/8 pl-4">
      <div className="mb-2.5 flex items-center gap-2.5">
        <Scale aria-hidden="true" className="text-champagne size-3.5" strokeWidth={2} />
        <SurfaceLabel as="h4" id="amendments-heading">
          {claim.amendments.length > 0
            ? 'Later instruments affect this provision'
            : 'Amendment history could not be checked'}
        </SurfaceLabel>
      </div>

      <ul className="flex flex-col gap-2.5">
        {claim.amendments.map((a) => (
          <li key={`${a.title}-${a.actNumber ?? 'none'}`} className="text-xs">
            <span className="text-on-ink block font-medium">{a.title}</span>
            <span className="text-on-ink-muted mt-0.5 block">
              {a.actNumber ? `${a.actNumber} · ` : null}
              {/* State in words, never colour or an icon alone. */}
              {a.commencementEstablished && a.commencementDate
                ? `In force from ${a.commencementDate}`
                : 'Commencement not established'}
            </span>
          </li>
        ))}
      </ul>

      {!claim.currentApplicabilityEstablished ? (
        <Evidence.Status established={false} className="mt-3">
          {claim.amendments.length > 0
            ? 'Because the commencement of at least one of these could not be established, Nova is not stating the current legal position for this provision.'
            : 'Nova could not check whether this provision has been amended, so it is not stating the current legal position. The passage above is quoted as published.'}
        </Evidence.Status>
      ) : null}
    </div>
  );
}
