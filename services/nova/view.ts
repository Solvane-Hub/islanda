import type { NovaAnswer } from '@/services/nova/answer';
import type {
  NovaAmendmentView,
  NovaAnswerView,
  NovaCitationView,
  NovaClaimView,
  NovaFollowUpView,
} from '@/types/nova';

/**
 * Project a `NovaAnswer` into the shape the presentation layer may see.
 *
 * This is a narrowing, and every field it drops is dropped deliberately:
 *
 *   • `envelope.reasoning` — machine-facing, "never rendered to a founder"
 *     (ADR-0017 §5). Absent from `NovaAnswerView` entirely, so no component can
 *     render it even by accident.
 *   • `agentVersion` / `promptVersion` / `modelVersion` — provenance for replay
 *     and telemetry, not founder-facing.
 *   • `packId`, `retrievedAt`, raw coverage — internal.
 *
 * Nothing is added. No sentence is composed, no status is inferred, no date is
 * reformatted into a claim. If a value is not in the answer, it is not in the
 * view.
 */
/**
 * The longest a generated follow-up may be.
 *
 * `askSchema` in the server action caps a question at 500 characters. A
 * follow-up that exceeded it would be rejected as invalid input the founder
 * never typed, so it is never offered.
 */
const MAX_FOLLOW_UP_QUESTION = 500;

/** At most this many, so the surface stays a set of options rather than a menu. */
const MAX_FOLLOW_UPS = 4;

/**
 * Shorten an instrument title for a button.
 *
 * Drops a trailing parenthetical — `"Example Widget Licensing Act (SYNTHETIC —
 * not real legislation)"` becomes `"Example Widget Licensing Act"`. This is
 * presentation only and appears on a LABEL, never in a claim, a citation, or the
 * submitted question, all of which keep the full title. No assertion about any
 * document is altered by it.
 */
function shortTitle(document: string): string {
  return document.replace(/\s*\([^)]*\)\s*$/, '').trim() || document;
}

/**
 * Build self-contained follow-up questions from an answer's structured metadata.
 *
 * Every question here is a noun phrase naming a document or a provision. There
 * is deliberately no template containing "it", "this", "that" or "the above" —
 * a follow-up must mean the same thing typed into an empty composer tomorrow as
 * it does under the answer that suggested it. That property is what lets Nova
 * feel conversational without holding any conversation state.
 */
export function buildFollowUps(claims: readonly NovaClaimView[]): NovaFollowUpView[] {
  const followUps: NovaFollowUpView[] = [];
  const seen = new Set<string>();

  const add = (label: string, question: string): void => {
    const trimmed = question.trim();
    if (trimmed.length < 3 || trimmed.length > MAX_FOLLOW_UP_QUESTION) return;
    if (seen.has(trimmed)) return;
    seen.add(trimmed);
    followUps.push({ id: trimmed, label, question: trimmed });
  };

  for (const claim of claims) {
    const document = claim.citations[0]?.document;
    if (!document) continue;

    if (claim.sectionReference) {
      add(`More on ${claim.sectionReference}`, `${claim.sectionReference} ${document}`);
    }

    add(`More from ${shortTitle(document)}`, document);

    for (const amendment of claim.amendments) {
      // Naming the amending Act is the most useful follow-up in the system: it
      // is the instrument that determines whether the passage just quoted is
      // still the law, and it is a document in its own right.
      add(`Read ${amendment.actNumber ?? shortTitle(amendment.title)}`, amendment.title);
    }
  }

  return followUps.slice(0, MAX_FOLLOW_UPS);
}

export function toNovaAnswerView(answer: NovaAnswer, question: string): NovaAnswerView {
  const noticesByClaim = new Map(answer.amendmentNotices.map((n) => [n.claimId, n]));
  const citationsByClaim = new Map(answer.citations.map((c) => [c.claimId, c.citations]));

  const claims: NovaClaimView[] = (answer.envelope?.claims ?? []).map((claim) => {
    const notice = noticesByClaim.get(claim.claimId);

    const citations: NovaCitationView[] = (citationsByClaim.get(claim.claimId) ?? []).map((c) => ({
      chunkId: c.chunk_id,
      agency: c.agency,
      document: c.document,
      section: c.section,
      page: c.page ?? null,
      publicationDate: c.publication_date,
      knowledgeVersion: c.knowledge_version,
      url: c.url,
    }));

    const amendments: NovaAmendmentView[] = (notice?.amendments ?? []).map((a) => ({
      title: a.title,
      actNumber: a.actNumber,
      commencementDate: a.commencementDate,
      commencementEstablished: a.commencementEstablished,
    }));

    return {
      claimId: claim.claimId,
      statement: claim.content.statement,
      sectionReference: claim.content.sectionReference,
      citations,
      amendments,
      // Absent notice means no amendment touches this provision, which is not
      // the same as "amendments exist and we could not resolve them". Defaulting
      // to true here would be the wrong direction; defaulting to false would
      // caveat provisions that need no caveat. The notice decides.
      currentApplicabilityEstablished: notice ? notice.currentApplicabilityEstablished : true,
    };
  });

  const business: NovaAnswerView['business'] = answer.businessContext
    ? {
        category: answer.businessContext.category,
        knownFacts: answer.businessContext.knownFacts.map((f) => ({
          label: f.label,
          value: f.value,
        })),
        relevance: answer.businessContext.relevance,
        openQuestions: answer.businessContext.openQuestions.map((q) => ({
          question: q.question,
          why: q.why,
        })),
        clarifyingQuestion: answer.businessContext.clarifyingQuestion,
      }
    : null;

  return {
    outcome: answer.outcome,
    question,
    claims,
    unresolved: answer.unresolved.map((u) => ({ question: u.question, why: u.why })),
    followUps: buildFollowUps(claims),
    jurisdiction: answer.jurisdiction,
    knowledgeVersion: answer.knowledgeVersion,
    emptyDomains: answer.coverage.emptyDomains,
    business,
  };
}
