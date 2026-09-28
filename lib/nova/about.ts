/**
 * How Nova works, in plain language.
 *
 * ## Why this is content in Git rather than marketing copy in a component
 *
 * These statements are commitments about system behaviour. Each one is true of
 * the current build and is enforced somewhere in the codebase — usually by a
 * test. Keeping them as reviewed data means a claim cannot drift away from the
 * thing it describes without someone editing this file and being asked why.
 *
 * ⚠ Rules for entries:
 *   • Every statement must be true NOW. Nothing aspirational.
 *   • No statement may describe legal content. This describes the system.
 *   • `cannot` is not an apology. What a system refuses to do is the most
 *     useful thing a founder can know about it, and it is listed with the same
 *     weight as what it does.
 */

export interface AboutSection {
  id: string;
  title: string;
  /** One or two sentences. Longer than that means the section is really two. */
  body: string;
}

export const NOVA_ABOUT: readonly AboutSection[] = [
  {
    id: 'what',
    title: 'What Nova is',
    body:
      'Nova answers questions about your business by searching the published sources Islanda ' +
      'holds for your jurisdiction, and quoting the passages it finds. It is a way to navigate ' +
      'information that is otherwise spread across separate Acts, regulations and agency notices.',
  },
  {
    id: 'searches',
    title: 'What Nova searches',
    body:
      'Only the Knowledge Pack published for the jurisdiction your business operates in. Every ' +
      'source in a pack has been validated and carries the agency, document and provision it ' +
      'came from. Nova searches nothing else — not the open web, not your files, not other ' +
      'jurisdictions.',
  },
  {
    id: 'quotes',
    title: 'Nova quotes, it does not paraphrase',
    body:
      'Every sentence Nova produces is a verbatim passage from a cited source. There is no ' +
      'language model writing prose in the answer path, which means Nova cannot invent a ' +
      'requirement, soften a provision, or fill a gap with something plausible.',
  },
  {
    id: 'refuses',
    title: 'What happens when the sources do not answer',
    body:
      'Nova says so. It does not summarise something close, and it does not offer a general ' +
      'answer in place of a specific one. A refusal means the published sources were searched ' +
      'and no passage in them supported an answer.',
  },
  {
    id: 'amendments',
    title: 'How Nova handles changes to the law',
    body:
      'A provision can be amended by a later instrument that has not yet commenced. Where Nova ' +
      'cannot establish whether such a change is in force, it quotes the passage as published, ' +
      'names the later instrument, and explicitly declines to state the current position.',
  },
  {
    id: 'memory',
    title: 'Each question is researched independently',
    body:
      'Nova keeps no memory between questions. Nothing you asked earlier influences a later ' +
      'answer, and there is no conversation to continue. Past questions are kept only so you ' +
      'can run one again, which performs a complete fresh search.',
  },
  {
    id: 'coverage',
    title: 'Where coverage is incomplete',
    body:
      'Knowledge Packs are published per jurisdiction, and a jurisdiction with no published pack ' +
      'gets no answers rather than approximate ones. Where a pack is a synthetic demonstration ' +
      'corpus, every answer drawn from it is labelled as such on screen.',
  },
];

/**
 * The disclaimer.
 *
 * Stated once, plainly, and never softened. Kept as a constant so the same
 * words appear wherever it is needed rather than being paraphrased per surface.
 */
export const NOVA_DISCLAIMER =
  'Nova is not legal, financial or tax advice. Islanda is an informational and navigation ' +
  'resource: it helps you find and read the published sources that may apply to your business, ' +
  'and it is not a substitute for professional advice on your specific situation.';

/**
 * What a synthetic corpus means, in the founder's terms.
 *
 * Shown only where one is actually in use — a definition of something the
 * reader is not looking at is noise.
 */
export const SYNTHETIC_CORPUS_EXPLANATION =
  'A synthetic demonstration corpus is invented material used to show how Nova works before a ' +
  'real Knowledge Pack is published for a jurisdiction. Example Jurisdiction (ZZ) is not a real ' +
  'country, the instruments in it are not real law, and nothing drawn from it may be relied on.';
