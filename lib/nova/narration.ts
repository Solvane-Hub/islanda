import type { NovaAnswerView } from '@/types/nova';

/**
 * What Nova says about its own investigation.
 *
 * ## ⚠ The line this module must never cross
 *
 * Nova narrates **the search**. It never interprets **the law**.
 *
 *   ✅ "I searched the published sources and found five passages across two
 *       documents. The closest match to your question is section 3 of the
 *       Example Prepared Food Trading Act."
 *
 *   ❌ "Yes — you need a prepared food licence."
 *
 * The second sentence is a legal conclusion drawn from a passage. Producing it
 * requires reading the provision and deciding what it means, which is exactly
 * what a language model does and exactly what this system deliberately does not
 * have: `modelVersion` is `none:deterministic-extractive`, the reasoner selects
 * and quotes, and there is no component in the answer path capable of
 * paraphrase.
 *
 * Writing that conclusion here would mean fabricating it in the one layer with
 * no citation gate in front of it — after `assertCitationsGrounded`, after the
 * ADR-0017 envelope, after everything built to make fabrication structurally
 * impossible. Generative interpretation is a real and wanted capability; it is
 * gated behind ADR-0018's evaluation harness and it stays out until that exists.
 *
 * ## What makes narration safe
 *
 * Every noun, number and name below comes from the `NovaAnswerView` the service
 * produced. Nothing is counted that was not returned, nothing is characterised,
 * and no sentence asserts anything about a requirement. The result reads as
 * speech because it describes a real action Nova took, not because it was
 * written to sound conversational.
 *
 * Pure function, no I/O, no dependency on the request. Testable in isolation,
 * which is how the boundary above stays enforced.
 *
 * ## Why `lib/` and not `services/`
 *
 * It reads a `NovaAnswerView` and returns strings. No database, no request, no
 * business decision — a projection, not an Application Service. It lives here
 * because `components/` must be able to import it and the layer rule correctly
 * forbids `components/ → services/`. Same reasoning as
 * `lib/knowledge/jurisdiction.ts`, which the synthetic banner depends on for
 * exactly the same reason.
 */

export interface NovaNarration {
  /**
   * The acknowledgement.
   *
   * ⚠ The one line here that is not derived from data — and it is safe for a
   *   specific reason: it makes no claim. "Let's look at that" is an
   *   interactional move, not an assertion about the corpus or the law. It is
   *   what makes the exchange feel like an investigation rather than a query,
   *   and it is the ONLY latitude this module takes.
   */
  opener: string;
  /** The opening line. Always present — Nova always says what it did. */
  lead: string;
  /** What was found, or where the closest match sits. Null on a refusal. */
  detail: string | null;
  /**
   * What could not be established, in one line.
   *
   * Null when nothing was left open. Never an apology — an unestablished
   * position is the system working, and the copy says so.
   */
  caveat: string | null;
  /** How the founder is invited to go deeper. Null when there is nothing to open. */
  invitation: string | null;
  /**
   * What Nova offers to look at next.
   *
   * ⚠ Derived entirely from `followUps`, which the view service composes from
   *   structured metadata — an instrument title, a section reference, an
   *   amending Act. Nova is not proposing a line of enquiry it invented; it is
   *   naming a document the current answer already points at, and offering to
   *   search for it.
   *
   *   `question` is the complete, self-contained text that will be submitted.
   *   No pronoun, no dependence on this turn. Pressing it runs a full fresh
   *   retrieval, exactly as typing those words would (ADR-0017).
   */
  continuation: { prompt: string; question: string } | null;
}

/** English plural without a library. `1 passage`, `5 passages`. */
function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** Distinct documents cited across the whole answer. A real count, not an estimate. */
function distinctDocuments(answer: NovaAnswerView): string[] {
  const seen = new Set<string>();
  for (const claim of answer.claims) {
    for (const citation of claim.citations) seen.add(citation.document);
  }
  return [...seen];
}

/**
 * Refusal narration, per outcome.
 *
 * ⚠ Three distinct truths, worded distinctly. "We hold no sources for your
 *   jurisdiction" and "we hold sources but none addresses this" are different
 *   facts, and collapsing them would tell a founder their question was
 *   unanswerable when the real problem is that the corpus has not reached
 *   their country yet.
 *
 *   None of these is an error, and none apologises. Nova searched what it is
 *   allowed to search and did not find enough to quote. A founder should
 *   finish reading and think "good, it didn't make something up".
 */
function refusalNarration(answer: NovaAnswerView): NovaNarration {
  switch (answer.outcome) {
    case 'no_published_knowledge':
      return {
        opener: 'Let me check what I have.',
        continuation: null,
        lead: 'I have no published sources for your jurisdiction yet, so there was nothing for me to search.',
        detail: null,
        caveat:
          'This is a gap in what Islanda holds — not a statement about what the law requires.',
        invitation: null,
      };

    case 'needs_clarification':
      return {
        opener: 'Let me look at that.',
        continuation: null,
        lead: 'I could not match that question against the sources I hold.',
        detail: null,
        caveat: null,
        invitation:
          'Try naming the activity, the permit, or the obligation you have in mind, and I will search again.',
      };

    default:
      return {
        opener: 'Let me look at that.',
        continuation: null,
        lead: 'I searched the published sources for your jurisdiction and found nothing that answers this.',
        detail: null,
        caveat:
          'Rather than quote something close and let it read as an answer, I am telling you the sources do not cover it.',
        invitation: null,
      };
  }
}

/**
 * Narrate an answer.
 *
 * The lead describes the search. The detail names where the closest match sits
 * — "closest" being a statement about lexical ranking, which retrieval really
 * performed, and not a claim about which provision matters most legally.
 */
export function narrateAnswer(answer: NovaAnswerView): NovaNarration {
  if (answer.outcome !== 'answered') return refusalNarration(answer);

  const passages = answer.claims.length;
  const documents = distinctDocuments(answer);
  const top = answer.claims[0];

  const lead =
    documents.length > 1
      ? `I searched the published sources for your jurisdiction and found ${count(passages, 'passage')} across ${count(documents.length, 'document')}.`
      : `I searched the published sources for your jurisdiction and found ${count(passages, 'passage')}.`;

  /**
   * Where the closest match sits.
   *
   * Uses the FIRST claim, which is rank 1 from retrieval — the reasoner
   * preserves retrieval order (K5 §3.8). "Closest match to your question"
   * describes that ranking honestly; "most important" or "the answer" would
   * be characterisations nothing computed.
   */
  const topDocument = top?.citations[0]?.document ?? null;
  const detail =
    top && topDocument
      ? top.sectionReference
        ? `The closest match to your question is ${top.sectionReference} of ${topDocument}. Its exact words are below.`
        : `The closest match to your question is in ${topDocument}. Its exact words are below.`
      : null;

  const unresolved = answer.unresolved.length;
  const unestablished = answer.claims.filter((c) => !c.currentApplicabilityEstablished).length;

  let caveat: string | null = null;
  if (unestablished > 0) {
    caveat = `For ${count(unestablished, 'passage')}, a later instrument affects the provision and I could not establish whether it is in force — so I am not stating the current position there.`;
  } else if (unresolved > 0) {
    caveat = `There ${unresolved === 1 ? 'is one thing' : `are ${unresolved} things`} I could not establish. They are listed below rather than left out.`;
  }

  const invitation =
    passages > 1
      ? `Each passage is shown with the document and provision it came from, so you can check any of them.`
      : null;

  /**
   * The next thing Nova offers to trace.
   *
   * Phrased as a question from Nova rather than rendered as a chip, because a
   * chip is a menu and a question is a conversation. The words after "trace"
   * are the follow-up's own label, which came from the answer's metadata — so
   * Nova is offering to look at a document this answer actually points at.
   */
  const nextUp = answer.followUps[0];
  const continuation = nextUp
    ? { prompt: `Want me to trace ${nextUp.label.toLowerCase()}?`, question: nextUp.question }
    : null;

  return { opener: 'Let me look at that.', lead, detail, caveat, invitation, continuation };
}
