/**
 * Nova presentation types.
 *
 * These live in `types/` for the same reason `types/business.ts` does: `app/`
 * and `components/` must be able to name a Nova answer without importing
 * `services/`, which the layer-boundary lint rule correctly forbids.
 *
 * ⚠ This is a PROJECTION of `NovaAnswer`, not a re-export of it, and the
 *   omissions are the point:
 *
 *   • `envelope.reasoning` is absent. ADR-0017 §5 calls it "machine-facing
 *     rationale, never rendered to a founder". A view model that cannot carry
 *     it cannot leak it — which is a stronger guarantee than a code review.
 *   • Nothing here is derived, inferred, or reformatted. Every string
 *     originates in a gazetted source or in verified manifest metadata. The
 *     presentation layer states no legal conclusion of its own.
 */

/** What a founder is shown as the outcome of asking. */
export type NovaViewOutcome =
  'answered' | 'no_published_knowledge' | 'no_matching_evidence' | 'needs_clarification';

/** One citation, ready to render. Every field comes from the retrieval run. */
export interface NovaCitationView {
  chunkId: string;
  agency: string;
  document: string;
  section: string | null;
  page: number | null;
  publicationDate: string | null;
  knowledgeVersion: string;
  url: string | null;
}

/** One amending instrument's bearing on the provision quoted. Metadata only. */
export interface NovaAmendmentView {
  title: string;
  actNumber: string | null;
  commencementDate: string | null;
  /** False means the current position must NOT be presented as settled. */
  commencementEstablished: boolean;
}

/**
 * One quoted passage and everything attached to it.
 *
 * `statement` is verbatim from a cited source. The reasoner produced it by
 * quotation, not generation, and the UI renders it as a quotation.
 */
export interface NovaClaimView {
  claimId: string;
  statement: string;
  sectionReference: string | null;
  citations: readonly NovaCitationView[];
  /** Present only when the manifest records later instruments touching this provision. */
  amendments: readonly NovaAmendmentView[];
  /**
   * True only where every amendment's commencement is established. False means
   * the passage is shown, the amendments are named, and the current legal
   * position is deliberately left unstated.
   */
  currentApplicabilityEstablished: boolean;
}

/**
 * A follow-up a founder can ask next.
 *
 * ⚠ **This is not conversational memory, and must never become it.**
 *
 * A follow-up is a COMPLETE, SELF-CONTAINED question composed deterministically
 * from structured metadata already present in the answer — an instrument title,
 * a section reference, an amending Act's number. It contains no pronoun, refers
 * to no previous turn, and carries no hidden context. Asking it runs the whole
 * pipeline again: rate limit, retrieval, extraction, citation grounding,
 * execution recording. The result is grounded on its own terms and would be
 * identical if the founder had typed the same words as their first question.
 *
 * That is the entire trick. It reads as exploration; it is a fresh query.
 */
export interface NovaFollowUpView {
  /** Stable within an answer. Derived from the question, not from position. */
  id: string;
  /** What the button says. Shortened for display; asserts nothing about the law. */
  label: string;
  /** The exact text that will be submitted. Self-contained by construction. */
  question: string;
}

/** Something Nova could not determine. Never omitted, never softened. */
export interface NovaUnresolvedView {
  question: string;
  why: string;
}

/** One founder-provided business fact Nova used as context. Never verified. */
export interface NovaKnownFactView {
  label: string;
  value: string;
}

/**
 * The business-aware layer (P1), ready to render.
 *
 * ⚠ Like the rest of this projection, it states no legal conclusion. `relevance`
 *   names business facts and how Nova read the material; `openQuestions` name
 *   what Nova could not determine about THIS business. Nothing here paraphrases
 *   a provision — that boundary is identical to `narration.ts`.
 */
export interface NovaBusinessContextView {
  /** The intelligence category. Always 'regulatory' on this evidence-backed path. */
  category: 'regulatory';
  knownFacts: readonly NovaKnownFactView[];
  relevance: string | null;
  openQuestions: readonly NovaUnresolvedView[];
  clarifyingQuestion: string | null;
}

export interface NovaAnswerView {
  outcome: NovaViewOutcome;
  question: string;
  claims: readonly NovaClaimView[];
  unresolved: readonly NovaUnresolvedView[];
  /** Self-contained next questions, derived from this answer's own metadata. */
  followUps: readonly NovaFollowUpView[];
  /**
   * The jurisdiction the answer was scoped to, from `businesses.country_code`.
   *
   * Present so the presentation layer can recognise a synthetic demonstration
   * corpus from the DATA rather than from a flag a caller has to remember to
   * pass. See `lib/knowledge/jurisdiction.ts`.
   */
  jurisdiction: string;
  /** Null when no Knowledge Pack is published — there was no run to version. */
  knowledgeVersion: string | null;
  /** Domains the Coordinator expected that returned nothing (K5 §10). */
  emptyDomains: readonly string[];
  /**
   * The business-aware layer (P1). Null when there is no Business Object context
   * to add (or on a refusal). Founder-provided facts + Nova's own gaps only.
   */
  business: NovaBusinessContextView | null;
}
