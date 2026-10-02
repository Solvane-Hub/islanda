/**
 * What's new in Nova.
 *
 * ## Transparency, not a changelog
 *
 * A changelog lists what shipped. This says what changed, why it matters to a
 * founder, and what is being worked on next — because the thing being asked
 * for here is trust in a system that answers regulatory questions, and trust is
 * built by being legible about capability rather than by shipping quietly.
 *
 * ## ⚠ Rules for entries
 *
 *   • Every claim must be true of the CURRENT build. An entry describing
 *     something planned belongs in `next`, never in `what`.
 *   • No entry may describe or imply legal content. This is about the system.
 *   • `next` is a statement of intent, and is worded as one. "Expanding
 *     coverage" — never "coverage will be available in October".
 *
 * Product-managed content in Git rather than a database, for the same reason
 * prompts and manifests are: it is a reviewed artifact, and a claim about what
 * the product can do should not be editable in a console without review.
 */

export interface NovaUpdate {
  /** e.g. 'August 2026'. Deliberately month-level; a date implies a release cadence. */
  period: string;
  headline: string;
  /** What changed, in the founder's terms. */
  what: string;
  /** Why it matters. This is the part a changelog leaves out. */
  why: string;
  /** What is being worked on. Intent, never a commitment to a date. */
  next: readonly string[];
}

export const NOVA_UPDATES: readonly NovaUpdate[] = [
  {
    period: 'August 2026',
    headline: 'Nova quotes published sources, and refuses when it cannot',
    what:
      'Nova answers only by quoting passages from a published Knowledge Pack for your ' +
      'jurisdiction. Every passage carries the document, provision and agency it came from, and ' +
      'where a later instrument affects a provision Nova names it rather than quietly quoting ' +
      'the older text.',
    why:
      'A confident answer that cannot be traced to a source is the failure mode that matters ' +
      'most in regulatory guidance. Nova has no model writing prose, so it cannot invent a ' +
      'requirement — when the published sources do not support an answer, it says so instead of ' +
      'summarising something close.',
    next: [
      'Bahamas coverage, once the reuse terms for the official legislation sources are settled',
      'Clearer explanations of why a particular passage was returned',
      'A way to tell us what was missing when Nova could not help',
    ],
  },
];

/** The current entry. Null when there is nothing to say, which is a valid state. */
export function currentNovaUpdate(): NovaUpdate | null {
  return NOVA_UPDATES[0] ?? null;
}
