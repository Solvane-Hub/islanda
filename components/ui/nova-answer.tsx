'use client';

import { AlertTriangle, Building2, FlaskConical, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { isSyntheticCorpus } from '@/lib/knowledge/jurisdiction';
import { NovaCanvas, RailModule } from '@/components/nova/nova-canvas';
import { NovaFinding } from '@/components/nova/nova-finding';
import { NovaField, type NovaFieldNode } from '@/components/nova/nova-field';
import { NovaFocusProvider } from '@/components/nova/nova-focus';
import { NovaSays } from '@/components/nova/nova-says';
import { NovaSourceIndex } from '@/components/nova/nova-source-index';
import { narrateAnswer } from '@/lib/nova/narration';
import { NovaMark } from './nova-mark';
import { WorkspaceSurface, SurfaceLabel } from './workspace-surface';
import type { NovaAnswerView } from '@/types/nova';

/**
 * Nova's answer, rendered as a research result.
 *
 * Presentation only. This component composes nothing and concludes nothing —
 * every sentence a founder reads here is either a verbatim quotation from a
 * cited government source, or fixed interface copy that makes no claim about
 * the law.
 *
 * ## ⚠ Why there is no "what this means, in plain language"
 *
 * Because nothing in this system can write one, and inventing it here would
 * undo the entire architecture.
 *
 * Nova's reasoner is extractive: it selects the passage in a retrieved chunk
 * that best matches the question and quotes it verbatim
 * (`modelVersion: 'none:deterministic-extractive'`). There is no model, no
 * prompt, and therefore no component anywhere in the product capable of
 * producing a paraphrase. A "what this means" block would have to be written
 * by this file — which is to say, fabricated at the last possible moment, in
 * the one layer with no citation gate in front of it.
 *
 * Generative paraphrase is a real and wanted capability. It is gated behind
 * ADR-0018's evaluation harness (citation validity 100%, fabrication 0), and
 * it stays out until that exists.
 *
 * What the answer gives instead is the structure that IS available and true:
 * the provision, the quoted passage, its source, what later instruments affect
 * it, and what could not be established.
 *
 * ## Three rules it enforces visually
 *
 *  1. **A quotation looks like a quotation.** Claim text is a `<blockquote>`
 *     with its citation as `<cite>`.
 *  2. **No citation is ever synthesised.** Every field comes from the retrieval
 *     run — no fallback for a missing agency, no "source unavailable".
 *  3. **An unestablished position is never presented as settled** (AI-14 §6).
 *
 * Copy note: "what we found in the sources we hold", never "your complete
 * requirements" (Trust Layer §7.4, Constitution Article VII).
 */

/**
 * The four outcomes, worded distinctly.
 *
 * "We hold no sources for your jurisdiction" and "we hold sources but none
 * addresses this" are different truths. Collapsing them into one message would
 * tell a founder their question was unanswerable when the real problem is that
 * the corpus has not reached their country yet.
 */
const REFUSAL_COPY: Record<
  Exclude<NovaAnswerView['outcome'], 'answered'>,
  { title: string; body: string; searched: string }
> = {
  no_published_knowledge: {
    title: 'Nova has no sources for your jurisdiction yet',
    body: 'No Knowledge Pack has been published for your country, so there is nothing authoritative to quote. This is a gap in what we hold, not an answer about the law.',
    searched: 'Nothing was searched, because nothing is published for this jurisdiction yet.',
  },
  no_matching_evidence: {
    title: 'Nothing in the sources we hold addresses this',
    body: 'Nova searched the published sources for your jurisdiction and found no passage that answers this question. Rather than summarise something close, it is saying so.',
    searched:
      'The published sources for your jurisdiction were searched. No passage in them matched this question closely enough to quote.',
  },
  needs_clarification: {
    title: 'Nova needs more to work with',
    body: 'This question could not be matched against the sources we hold. Try naming the activity, the permit, or the obligation you have in mind.',
    searched: 'The question produced no terms that could be matched against the published sources.',
  },
};

/**
 * The refusal.
 *
 * ⚠ Not an error state, and it must not look like one. Nothing failed: the
 *   system searched, found nothing that supported an answer, and said so. A
 *   founder should finish reading this thinking "good, it didn't make something
 *   up" — which is the single most valuable impression this product can leave.
 *
 * So: no red, no warning triangle, no apology. The mark contracts to `refused`
 * and the copy states what was searched and what to do next.
 */
function Refusal({ outcome }: { outcome: Exclude<NovaAnswerView['outcome'], 'answered'> }) {
  const copy = REFUSAL_COPY[outcome];

  return (
    <WorkspaceSurface
      as="section"
      tone="deep"
      aria-labelledby="nova-refusal-heading"
      className="flex flex-col gap-5 p-6 sm:p-8"
    >
      <div className="flex items-start gap-4">
        <NovaMark state="refused" size={48} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <HelpCircle aria-hidden="true" className="text-champagne size-3.5" strokeWidth={2} />
            <SurfaceLabel as="h2" id="nova-refusal-heading">
              {copy.title}
            </SurfaceLabel>
          </div>
          <p className="text-on-ink-muted mt-3 max-w-2xl text-sm text-pretty">{copy.body}</p>
        </div>
      </div>

      <div className="border-t border-white/8 pt-4">
        <SurfaceLabel as="p" className="text-on-glass-subtle">
          What Nova searched
        </SurfaceLabel>
        <p className="text-on-ink-muted mt-2 max-w-2xl text-xs text-pretty">{copy.searched}</p>
      </div>
    </WorkspaceSurface>
  );
}

/**
 * The synthetic-corpus warning.
 *
 * ⚠ There is deliberately **no prop that turns this on**. It is derived from the
 *   answer's own jurisdiction and Knowledge Pack version by `isSyntheticCorpus`,
 *   so it cannot be forgotten at a call site, cannot be disabled by a caller,
 *   and cannot be attached to a real jurisdiction by mistake — ISO 3166-1
 *   permanently reserves the user-assigned codes it keys off, so `BS` can never
 *   match.
 *
 * Rendered FIRST, before any quotation, because a reader who stops after the
 * first cited passage must already have been told what they are reading.
 */
function SyntheticCorpusNotice() {
  return (
    <WorkspaceSurface
      as="section"
      tone="inset"
      aria-labelledby="nova-synthetic-heading"
      className="border-champagne/40 flex flex-col gap-2 border p-5 sm:p-6"
    >
      <div className="flex items-center gap-2.5">
        <FlaskConical aria-hidden="true" className="text-champagne size-3.5" strokeWidth={2} />
        <SurfaceLabel as="h2" id="nova-synthetic-heading">
          Synthetic demonstration corpus
        </SurfaceLabel>
      </div>
      <p className="text-on-ink-muted max-w-2xl text-sm text-pretty">
        Example Jurisdiction (ZZ) is fictional. This content is not real law and must not be used
        for legal or business decisions.
      </p>
    </WorkspaceSurface>
  );
}

/**
 * The business-aware layer (P1).
 *
 * ⚠ States business FACTS and Nova's own GAPS. It never interprets the law —
 *   there is no paraphrase of any provision here, exactly as in `narration.ts`.
 *   The founder facts are shown as founder-provided context, never as verified,
 *   and a missing decisive fact is reported as missing, never guessed.
 */
function BusinessAware({ business }: { business: NonNullable<NovaAnswerView['business']> }) {
  const { relevance, knownFacts, openQuestions, clarifyingQuestion } = business;
  if (!relevance && knownFacts.length === 0 && openQuestions.length === 0) return null;

  return (
    <WorkspaceSurface
      as="section"
      tone="inset"
      aria-labelledby="nova-business-heading"
      className="flex flex-col gap-4 p-5 sm:p-6"
    >
      <div className="flex items-center gap-2.5">
        <Building2 aria-hidden="true" className="text-champagne size-3.5" strokeWidth={2} />
        <SurfaceLabel as="h2" id="nova-business-heading">
          What this means for your business
        </SurfaceLabel>
      </div>

      {relevance ? <p className="text-on-ink max-w-2xl text-sm text-pretty">{relevance}</p> : null}

      {knownFacts.length > 0 ? (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-wrap gap-1.5">
            {knownFacts.map((fact) => (
              <li
                key={fact.label}
                className="border-border-control bg-surface text-on-ink-muted inline-flex items-baseline gap-1.5 rounded-full border px-2.5 py-1 text-xs"
              >
                <span className="text-on-glass-subtle">{fact.label}</span>
                <span className="text-on-ink font-medium">{fact.value}</span>
              </li>
            ))}
          </ul>
          <p className="text-on-glass-subtle text-2xs text-pretty">
            From your business profile — founder-provided, and not independently verified. Update it
            anytime and Nova will factor in the change.
          </p>
        </div>
      ) : null}

      {openQuestions.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-white/8 pt-4">
          <SurfaceLabel as="p" className="text-on-glass-subtle">
            What I don&apos;t know yet
          </SurfaceLabel>
          <ul className="flex flex-col gap-2.5">
            {openQuestions.map((q, i) => (
              <li key={`${q.question}-${i}`} className="text-sm">
                <span className="text-on-ink block font-medium text-pretty">{q.question}</span>
                <span className="text-on-ink-muted mt-1 block text-xs text-pretty">{q.why}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {clarifyingQuestion ? (
        <p className="text-on-ink-muted border-t border-white/8 pt-4 text-sm text-pretty italic">
          {clarifyingQuestion}
        </p>
      ) : null}
    </WorkspaceSurface>
  );
}

export function NovaAnswerPanel({
  answer,
  onContinue,
  className,
}: {
  answer: NovaAnswerView;
  /**
   * Starts a new investigation from a follow-up this answer points at.
   *
   * ⚠ Optional, and every continuation affordance is hidden without it. A
   *   panel rendered outside the console — in a test, or in a future read-only
   *   view — must not show an offer that does nothing when pressed.
   */
  onContinue?: (question: string) => void;
  className?: string;
}) {
  const refusalOutcome = answer.outcome === 'answered' ? null : answer.outcome;
  const synthetic = isSyntheticCorpus({
    jurisdiction: answer.jurisdiction,
    knowledgeVersion: answer.knowledgeVersion,
  });

  const settled =
    answer.claims.every((c) => c.currentApplicabilityEstablished) && answer.unresolved.length === 0
      ? 'ready'
      : 'limited';

  /**
   * What Nova says about its own search.
   *
   * ⚠ Narration, never interpretation. Every noun comes from the answer object
   *   — see `lib/nova/narration.ts` for the line this must not cross and
   *   why crossing it would undo the citation architecture.
   */
  const narration = narrateAnswer(answer);
  const markState = refusalOutcome === null ? settled : 'refused';

  /**
   * Follow-ups Nova is not asking about out loud.
   *
   * `narrateAnswer` offers the first one conversationally, so listing it again
   * in the rail would present the same question twice as though they were two
   * different leads.
   */
  const otherThreads = narration.continuation ? answer.followUps.slice(1) : answer.followUps;

  /**
   * One field node per cited chunk.
   *
   * ⚠ Derived entirely from the answer. The count on screen IS the number of
   *   distinct sources the retrieval run returned — nothing is padded to fill
   *   the field and nothing is dropped to tidy it. That is what makes the
   *   constellation an honest representation rather than an ambient graphic.
   */
  const fieldNodes: NovaFieldNode[] = answer.claims.flatMap((claim) => {
    const siblings = claim.citations.map((c) => c.chunkId);
    return claim.citations.map((citation) => ({
      chunkId: citation.chunkId,
      claimId: claim.claimId,
      siblings,
      // The instrument, verbatim from the citation. The field draws an edge
      // between two nodes when these match exactly — a fact, not an inference.
      document: citation.document,
      label: [citation.document, citation.section].filter(Boolean).join(' · '),
    }));
  });

  return (
    <NovaFocusProvider>
      <div
        className={cn('flex flex-col gap-4', className)}
        // Assistive tech announces the result when it arrives, without stealing
        // focus from the composer the founder is still using.
        role="status"
        aria-live="polite"
      >
        <p className="sr-only">You asked: {answer.question}</p>

        {synthetic ? <SyntheticCorpusNotice /> : null}

        <NovaCanvas
          rail={
            refusalOutcome === null ? (
              <>
                {/*
                  The constellation, in the rail rather than above the answer.

                  Beside the conversation it stays in view for the whole read,
                  which is the practical form of "evidence remains visible".
                  Above it, it scrolled away after two passages.
                */}
                <RailModule
                  label={
                    <SurfaceLabel as="h2" className="text-on-glass-subtle">
                      Evidence field
                    </SurfaceLabel>
                  }
                >
                  <NovaField state={settled} nodes={fieldNodes} />
                  <p className="text-on-glass-subtle text-2xs text-pretty">
                    One point per passage Nova retrieved. Hover a point to light the passage it
                    supports.
                  </p>
                </RailModule>

                {/*
                  What Nova read, grouped by document. A different question from
                  "where did this passage come from" — five passages from two
                  Acts is materially different from five from five, and the
                  per-passage citations never surface that.
                */}
                <RailModule
                  label={
                    <SurfaceLabel as="h2" className="text-on-glass-subtle">
                      Sources read
                    </SurfaceLabel>
                  }
                >
                  <NovaSourceIndex answer={answer} />
                </RailModule>

                {/*
                  The remaining threads.

                  The FIRST follow-up is not here — Nova asks about it directly,
                  in prose, in the focus column. These are the rest: available
                  without being pushed, in the rail where context lives rather
                  than in the reading path.

                  Each is a COMPLETE question composed from this answer's own
                  structured metadata — an instrument title, a section
                  reference, an amending Act. No pronoun to resolve, no previous
                  turn to remember. The full text is the `title`, so the
                  shortened label can never misrepresent what will be asked.
                */}
                {onContinue && otherThreads.length > 0 ? (
                  <RailModule
                    label={
                      <SurfaceLabel as="h2" className="text-on-glass-subtle">
                        Other threads
                      </SurfaceLabel>
                    }
                  >
                    <ul className="-mx-1.5 flex flex-col">
                      {otherThreads.map((f) => (
                        <li key={f.id}>
                          <button
                            type="button"
                            onClick={() => onContinue(f.question)}
                            title={f.question}
                            className="text-on-ink-muted hover:text-on-ink w-full min-w-0 truncate rounded-md px-1.5 py-1.5 text-left text-xs transition-colors duration-150 hover:bg-white/5"
                          >
                            {f.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="text-on-glass-subtle text-2xs text-pretty">
                      Each runs a fresh search on its own. Nova keeps no memory between them.
                    </p>
                  </RailModule>
                ) : null}

                {answer.knowledgeVersion ? (
                  <RailModule
                    label={
                      <SurfaceLabel as="h2" className="text-on-glass-subtle">
                        Knowledge
                      </SurfaceLabel>
                    }
                  >
                    <p className="text-on-ink-muted text-xs text-pretty">
                      Answered from Knowledge Pack {answer.knowledgeVersion}.
                      {synthetic
                        ? ' This pack is a synthetic demonstration corpus and is not real law.'
                        : null}
                    </p>
                    <p className="text-on-glass-subtle text-2xs text-pretty">
                      Nova quotes published sources and does not give legal advice.
                    </p>
                  </RailModule>
                ) : null}
              </>
            ) : null
          }
          focus={
            <>
              {/*
                Nova speaking. The conversational layer the evidence supports —
                first person, reading size, no bubble and no avatar, because
                nothing is being exchanged. Nova searched, and is saying what it
                did.
              */}
              <NovaSays
                narration={narration}
                state={markState}
                question={answer.question}
                {...(onContinue ? { onContinue } : {})}
              />

              {refusalOutcome === null ? (
                <WorkspaceSurface
                  as="section"
                  aria-labelledby="nova-findings-heading"
                  className="min-w-0"
                >
                  <div className="flex items-center gap-3.5 border-b border-white/8 px-5 py-4 sm:px-8">
                    <NovaMark state={settled} size={20} />
                    <SurfaceLabel as="h2" id="nova-findings-heading">
                      {/* Never "your complete requirements" — Trust Layer §7.4. */}
                      What we found in the sources we hold
                    </SurfaceLabel>
                    {answer.claims.length > 0 ? (
                      <span className="text-on-glass-subtle text-2xs ml-auto shrink-0" data-numeric>
                        {answer.claims.length} {answer.claims.length === 1 ? 'passage' : 'passages'}
                      </span>
                    ) : null}
                  </div>

                  {/*
                    Findings as hairline-separated bands on one surface, not a
                    stack of cards. The rail down each band's left edge carries
                    continuity, so the answer reads as one investigation.
                  */}
                  <div className="divide-y divide-white/8 pr-5 sm:pr-8">
                    {answer.claims.map((claim, i) => (
                      <NovaFinding key={claim.claimId} claim={claim} index={i} />
                    ))}
                  </div>
                </WorkspaceSurface>
              ) : (
                <Refusal outcome={refusalOutcome} />
              )}

              {/*
                The business-aware layer (P1). Shown only on an answered outcome
                with Business Object context. It sits between the quoted evidence
                and "what Nova could not establish" — the general rule first, then
                what it means for this business, then the open gaps. It states
                business facts and Nova's own limits, never a legal conclusion.
              */}
              {refusalOutcome === null && answer.business ? (
                <BusinessAware business={answer.business} />
              ) : null}

              {/*
                `unresolved[]` is shown on every outcome, including a successful
                one. ADR-0017 §5.3: discarding what could not be determined is
                the easiest route to a confidently incomplete answer, and hiding
                it in the UI has exactly the same effect as dropping it in the
                service.
              */}
              {answer.unresolved.length > 0 ? (
                <WorkspaceSurface
                  as="section"
                  tone="inset"
                  aria-labelledby="nova-unresolved-heading"
                  className="flex flex-col gap-3 p-5 sm:p-6"
                >
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle
                      aria-hidden="true"
                      className="text-champagne size-3.5"
                      strokeWidth={2}
                    />
                    <SurfaceLabel as="h2" id="nova-unresolved-heading">
                      What Nova could not establish
                    </SurfaceLabel>
                  </div>
                  <ul className="flex flex-col gap-3">
                    {answer.unresolved.map((u, i) => (
                      <li key={`${u.question}-${i}`} className="text-sm">
                        <span className="text-on-ink block font-medium text-pretty">
                          {u.question}
                        </span>
                        <span className="text-on-ink-muted mt-1 block text-xs text-pretty">
                          {u.why}
                        </span>
                      </li>
                    ))}
                  </ul>
                </WorkspaceSurface>
              ) : null}

              {/* The disclaimer stays on the focus column when there is no rail. */}
              {answer.knowledgeVersion && refusalOutcome !== null ? (
                <p className="text-on-glass-subtle text-2xs px-1">
                  Answered from Knowledge Pack {answer.knowledgeVersion}. Nova quotes published
                  sources and does not give legal advice.
                  {synthetic
                    ? ' This pack is a synthetic demonstration corpus and is not real law.'
                    : null}
                </p>
              ) : null}
            </>
          }
        />
      </div>
    </NovaFocusProvider>
  );
}

/**
 * The loading state.
 *
 * Names the stage rather than spinning. A founder waiting on a regulatory
 * answer should be able to see that the system is reading sources, not
 * inventing one — and the stage labels are true: retrieval genuinely runs
 * before the reasoner.
 */
export function NovaThinking({ question }: { question: string }) {
  return (
    <WorkspaceSurface
      tone="deep"
      className="flex flex-col gap-4 p-6 sm:p-8"
      role="status"
      aria-live="polite"
    >
      <p className="sr-only">Nova is working on your question: {question}</p>

      <SurfaceLabel as="p" aria-hidden="true">
        Reading the sources
      </SurfaceLabel>

      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-white/8" />
        <div className="h-3 w-full animate-pulse rounded-full bg-white/8 [animation-delay:120ms]" />
        <div className="h-3 w-5/6 animate-pulse rounded-full bg-white/8 [animation-delay:240ms]" />
      </div>

      <p className="text-on-ink-muted text-xs text-pretty">
        Nova is searching the published sources for your jurisdiction and quoting what it finds. It
        will say so if it finds nothing.
      </p>
    </WorkspaceSurface>
  );
}
