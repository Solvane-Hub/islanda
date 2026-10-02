import { BookOpen, FileText, Landmark, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { NovaCitationView } from '@/types/nova';

/**
 * Evidence, as a first-class object.
 *
 * ## The chain this exists to make visible
 *
 *     CLAIM  →  SOURCE  →  PROVISION  →  PASSAGE
 *
 * A founder's trust moment is not reading the answer. It is looking at the
 * answer and being able to say "I can see why Nova told me this". Today that
 * chain exists perfectly in the data and renders as a bullet list, which is
 * the single largest gap between what this product IS and what it looks like.
 *
 * ## Compound components, deliberately
 *
 * The API shape is borrowed from the receipt-printer experiment: a `Root` that
 * owns state, and parts that compose freely inside it. It matters here because
 * evidence is not always the same shape — a claim may cite one source or four,
 * a provision may or may not parse, an amendment may or may not have
 * commenced. A single monolithic `<Evidence answer={...} />` would need a prop
 * for every one of those cases.
 *
 * ## What this component may never do
 *
 * ⚠ It renders what it is given and NOTHING ELSE. No fallback string for a
 *   missing agency, no "source unavailable" placeholder, no inferred
 *   jurisdiction, no reformatted date presented as a fact. Every field on
 *   screen came from the retrieval run via `NovaAnswerView`.
 *
 *   That rule is not stylistic. A synthesised citation field is
 *   indistinguishable from a real one to the founder acting on it, and the
 *   whole grounding architecture — `assertCitationsGrounded`, the `chunk_id`
 *   binding, the ADR-0017 envelope — exists to make fabrication structurally
 *   impossible upstream. It would be absurd to reintroduce it in the view.
 *
 * Presentation only. No `services/` import; the layer rules forbid it and the
 * component has no business knowing where an answer came from.
 */

/* ── Root ─────────────────────────────────────────────────────────────── */

export function EvidenceRoot({
  children,
  className,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'className'>) {
  return (
    <div className={cn('flex flex-col gap-3', className)} {...rest}>
      {children}
    </div>
  );
}

/* ── Chain ────────────────────────────────────────────────────────────── */

/**
 * The visual spine connecting a claim to the source under it.
 *
 * A hairline with a node, rather than indentation. Indentation says "this is a
 * sub-item"; a connector says "this came FROM that", which is the actual
 * relationship and the one worth showing.
 */
export function EvidenceChain({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative pl-5', className)}>
      <span aria-hidden="true" className="absolute top-1 bottom-1 left-1.5 w-px bg-white/12" />
      <span
        aria-hidden="true"
        className="bg-champagne absolute top-2 left-[3px] size-1.5 rounded-full"
      />
      {children}
    </div>
  );
}

/* ── Source ───────────────────────────────────────────────────────────── */

/**
 * One cited document.
 *
 * Ordered by what a founder checks first: which document, then which part of
 * it, then who published it, then when. The `chunk_id` is available but not
 * displayed — it is the citation's machine identity, and putting a hash on
 * screen would read as noise to the only audience that matters here.
 */
export function EvidenceSource({
  citation,
  className,
}: {
  citation: NovaCitationView;
  className?: string;
}) {
  /**
   * The full reference, in one `<cite>`.
   *
   * Document, provision and page belong together — that IS the citation, and
   * splitting the provision into a separate line would leave a `<cite>` that
   * names a whole Act when the claim rests on one subsection of it. Absent
   * parts are dropped rather than padded.
   */
  const reference = [
    citation.document,
    citation.section,
    citation.page ? `p. ${citation.page}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ');

  return (
    <div
      className={cn('flex min-w-0 items-start gap-2.5', className)}
      data-chunk={citation.chunkId}
    >
      <FileText aria-hidden="true" className="text-champagne mt-0.5 size-3.5 shrink-0" />

      <div className="min-w-0 flex-1">
        <cite className="text-on-ink block text-xs leading-relaxed font-medium text-pretty not-italic">
          {reference}
        </cite>

        <p className="text-on-glass-subtle text-2xs mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="inline-flex items-center gap-1.5">
            <Landmark aria-hidden="true" className="size-3 shrink-0" />
            {citation.agency}
          </span>
          {citation.publicationDate ? <span>{citation.publicationDate}</span> : null}
        </p>

        {/* No placeholder when absent. A dead link or a "source unavailable"
            string reads as a citation to someone skimming. */}
        {citation.url ? (
          <a
            href={citation.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-bahama-turquoise hover:text-on-ink mt-1.5 inline-block rounded-sm text-xs underline underline-offset-4 transition-colors duration-150"
          >
            Open the source
          </a>
        ) : null}
      </div>
    </div>
  );
}

/* ── Passage ──────────────────────────────────────────────────────────── */

/**
 * The quoted text itself.
 *
 * A `<blockquote>`, because that is what it is. Every word Nova produces is a
 * verbatim substring of a cited chunk — presenting it as Nova's own prose
 * would misrepresent where the words came from, and the extractive reasoner
 * exists precisely so that this markup is honest.
 */
export function EvidencePassage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <blockquote
      className={cn(
        'border-champagne/40 text-on-ink border-l-2 pl-4 text-sm leading-relaxed text-pretty',
        className,
      )}
    >
      {children}
    </blockquote>
  );
}

/* ── Status ───────────────────────────────────────────────────────────── */

/**
 * Whether the current legal position is established.
 *
 * ⚠ `established: false` is not an error and must not look like one. It means
 *   the passage is quoted correctly and a later instrument affects it whose
 *   commencement could not be verified — so the position is deliberately left
 *   unstated. That is the system working, and the visual language has to say
 *   "held open", not "failed".
 *
 * State is carried in words as well as colour, so it survives greyscale and
 * colour-blindness (SC 1.4.1).
 */
export function EvidenceStatus({
  established,
  children,
  className,
}: {
  established: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = established ? ShieldCheck : BookOpen;

  return (
    <p
      className={cn(
        'flex items-start gap-2 text-xs text-pretty',
        established ? 'text-on-ink-muted' : 'text-champagne',
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/* ── Detail ───────────────────────────────────────────────────────────── */

/**
 * Expandable evidence.
 *
 * A native `<details>` — keyboard operable, findable by in-page search, and
 * announced correctly, with no JavaScript and no state. `group-open:` handles
 * the marker rotation, so this stays a Server Component.
 */
export function EvidenceDetail({
  summary,
  count,
  children,
  className,
}: {
  summary: string;
  /** Shown beside the summary. Omitted when zero rather than shown as "0". */
  count?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <details className={cn('group', className)}>
      <summary className="text-on-ink-muted hover:text-on-ink flex cursor-pointer list-none items-center gap-2 rounded-sm text-xs font-medium transition-colors duration-150 marker:content-none">
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className="size-3 shrink-0 transition-transform duration-150 group-open:rotate-90"
        >
          <path d="M4 2.5 8 6l-4 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
        {summary}
        {count !== undefined && count > 0 ? (
          <span className="text-on-glass-subtle" data-numeric>
            {count}
          </span>
        ) : null}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

export const Evidence = {
  Root: EvidenceRoot,
  Chain: EvidenceChain,
  Source: EvidenceSource,
  Passage: EvidencePassage,
  Status: EvidenceStatus,
  Detail: EvidenceDetail,
};
