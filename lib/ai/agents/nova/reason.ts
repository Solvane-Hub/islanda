import type {
  NovaClaim,
  NovaEnvelope,
  NovaEvidenceInput,
  NovaReasonerInput,
  NovaUnresolved,
} from './contract';
import {
  NOVA_AGENT,
  NOVA_AGENT_VERSION,
  NOVA_NO_MODEL,
  NOVA_REASONER_VERSION,
  assertEnvelopeValid,
} from './contract';
import { deriveClaimId } from './claim-id';
import { normaliseTerms } from '@/lib/knowledge/text';

/**
 * Nova's reasoner — Option A, extractive.
 *
 * There is no model call here, and there is no prompt. The reasoner selects the
 * passage within each retrieved chunk that best matches the question and quotes
 * it VERBATIM. Every statement Nova produces is therefore a substring of a cited
 * government source.
 *
 * That is the whole point of Option A: fabrication is prevented **by
 * construction**, not by evaluation. The generative reasoner that replaces this
 * one must clear ADR-0018's gates (citation validity 100%, fabrication 0) before
 * it may run; this one cannot fail them because it cannot write a sentence.
 *
 * Design principles it satisfies (Specialist Agent Contract §4):
 *   A2 evidence in, evidence out · A3 idempotent · A4 no trust self-assessment ·
 *   A5 structured refusal · A6 deterministic wherever computable without a model.
 */

/**
 * Scoring-only stopwords.
 *
 * Applied AFTER `normaliseTerms`, and only when scoring passages — retrieval's
 * ranking is left exactly as it was. The asymmetry is deliberate and safe in one
 * direction: extraction being stricter than retrieval can only reject passages
 * that matched on noise. Without this, a question about marine salvage "matches"
 * a licensing passage on the word "the", and Nova answers a question it has no
 * evidence for. That is the exact failure Option A exists to make impossible.
 */
const SCORING_STOPWORDS: ReadonlySet<string> = new Set([
  'and',
  'are',
  'but',
  'can',
  'did',
  'does',
  'for',
  'from',
  'had',
  'has',
  'have',
  'how',
  'its',
  'may',
  'must',
  'not',
  'our',
  'shall',
  'that',
  'the',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'was',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'whom',
  'why',
  'will',
  'with',
  'would',
  'you',
  'your',
]);

/** Sentence and clause boundaries. Legal text enumerates with `;` and `:` as often as `.`. */
const PASSAGE_BOUNDARY = /[.;:]\s+|\n+/g;

interface Passage {
  /** Exact substring of the chunk body, trimmed of surrounding whitespace. */
  text: string;
  /** Offset into the body. Used only to break scoring ties deterministically. */
  start: number;
}

/**
 * Split a chunk body into candidate passages.
 *
 * Offsets are tracked so that each passage is provably a substring of the body:
 * only leading and trailing whitespace is removed, never interior characters.
 * That property is what makes the verbatim-quote guarantee checkable.
 */
function segment(body: string): Passage[] {
  const passages: Passage[] = [];

  const push = (raw: string, offset: number): void => {
    const leading = raw.length - raw.trimStart().length;
    const text = raw.trim();
    if (text.length > 0) passages.push({ text, start: offset + leading });
  };

  let cursor = 0;
  for (const match of body.matchAll(PASSAGE_BOUNDARY)) {
    const end = (match.index ?? 0) + match[0].length;
    push(body.slice(cursor, end), cursor);
    cursor = end;
  }
  if (cursor < body.length) push(body.slice(cursor), cursor);

  return passages;
}

function contentTerms(value: string): string[] {
  return normaliseTerms(value).filter((term) => !SCORING_STOPWORDS.has(term));
}

/** Count of distinct question terms present in the passage. Distinct, so repetition cannot inflate a score. */
function scorePassage(passage: Passage, questionTerms: readonly string[]): number {
  const terms = new Set(contentTerms(passage.text));
  let score = 0;
  for (const term of questionTerms) {
    if (terms.has(term)) score += 1;
  }
  return score;
}

/**
 * The single best-supported passage in a chunk, or null if nothing matched.
 *
 * One claim per chunk. Each claim then maps 1:1 to the chunk it came from, which
 * keeps citation binding trivial to verify and keeps a single chunk from
 * flooding an answer with near-duplicate clauses.
 */
function bestPassage(chunk: NovaEvidenceInput, questionTerms: readonly string[]): Passage | null {
  let best: Passage | null = null;
  let bestScore = 0;

  // Strict `>` with document-order iteration means the EARLIEST passage wins a
  // tie. Deterministic, and it prefers the operative provision over a later
  // cross-reference to it.
  for (const passage of segment(chunk.body)) {
    const score = scorePassage(passage, questionTerms);
    if (score > bestScore) {
      best = passage;
      bestScore = score;
    }
  }

  return bestScore > 0 ? best : null;
}

function refuse(
  input: NovaReasonerInput,
  status: 'NO_AUTHORITATIVE_INFORMATION_FOUND' | 'NEEDS_CLARIFICATION',
  why: string,
  reasoning: string,
): NovaEnvelope {
  const envelope: NovaEnvelope = {
    status,
    agent: NOVA_AGENT,
    agentVersion: NOVA_AGENT_VERSION,
    promptVersion: NOVA_REASONER_VERSION,
    modelVersion: NOVA_NO_MODEL,
    knowledgeVersion: input.knowledgeVersion,
    reasoning,
    claims: [],
    unresolved: [{ question: input.question, why }],
  };

  assertEnvelopeValid(envelope);
  return envelope;
}

/**
 * Extract an answer from retrieved evidence, or refuse.
 *
 * Decision flow is the contract's §7, in the order the contract states it —
 * evidence emptiness is checked before input sufficiency:
 *
 *   evidence empty?      -> NO_AUTHORITATIVE_INFORMATION_FOUND
 *   question unusable?   -> NEEDS_CLARIFICATION
 *   no passage supports? -> NO_AUTHORITATIVE_INFORMATION_FOUND
 *   otherwise            -> OK, with anything unusable named in `unresolved`
 *
 * Refusal is a designed output (A5, AI-14 §8). This function does not throw to
 * express "I don't know"; it says so in the envelope.
 */
export function reasonExtractively(input: NovaReasonerInput): NovaEnvelope {
  if (input.evidence.length === 0) {
    return refuse(
      input,
      'NO_AUTHORITATIVE_INFORMATION_FOUND',
      'Retrieval returned no chunks from the published Knowledge Pack for this jurisdiction, ' +
        'so there is no authoritative passage to quote.',
      'Extractive selection: 0 chunks retrieved.',
    );
  }

  const questionTerms = contentTerms(input.question);

  if (questionTerms.length === 0) {
    return refuse(
      input,
      'NEEDS_CLARIFICATION',
      'The question contains no terms that can be matched against the Knowledge Pack.',
      `Extractive selection: ${input.evidence.length} chunk(s) retrieved, question yielded no usable terms.`,
    );
  }

  // Rank order is the retrieval order and is strictly increasing (K5 §3.8), so
  // sorting on it gives a total order. Ties cannot occur, but chunk_id breaks
  // them anyway rather than leaving output to array order.
  const ordered = [...input.evidence].sort(
    (a, b) => a.rank - b.rank || a.chunkId.localeCompare(b.chunkId),
  );

  const claims: NovaClaim[] = [];
  const unresolved: NovaUnresolved[] = [];

  for (const chunk of ordered) {
    const passage = bestPassage(chunk, questionTerms);

    if (!passage) {
      // §5.3 — retrieval judged this chunk relevant enough to return, and no
      // passage in it supports the question. Saying so is what stops a thin
      // corpus from looking like a complete answer.
      unresolved.push({
        question: input.question,
        why:
          `Chunk ${chunk.chunkId} was retrieved but contains no passage matching the question, ` +
          'so nothing in it could be quoted.',
      });
      continue;
    }

    claims.push({
      claimId: deriveClaimId({
        knowledgeVersion: input.knowledgeVersion,
        chunkId: chunk.chunkId,
        statement: passage.text,
      }),
      content: {
        statement: passage.text,
        sectionReference: chunk.sectionReference,
        regulatoryDomain: chunk.regulatoryDomain,
      },
      evidence: [
        {
          chunkId: chunk.chunkId,
          // Byte-identical to the statement. Extraction IS the reasoning here.
          quote: passage.text,
          sourceAuthority: chunk.sourceAuthority,
        },
      ],
      // §5.2 — a quotation restates one passage. Always one hop, never asserted
      // as anything else, and never converted into a confidence by this agent.
      reasoningHops: 1,
    });
  }

  const reasoning =
    `Extractive selection: ${claims.length} of ${ordered.length} retrieved chunk(s) yielded a ` +
    `quoted passage matching the question; ${unresolved.length} yielded none.`;

  if (claims.length === 0) {
    return refuse(
      input,
      'NO_AUTHORITATIVE_INFORMATION_FOUND',
      `${ordered.length} chunk(s) were retrieved, but none contains a passage matching the question.`,
      reasoning,
    );
  }

  const envelope: NovaEnvelope = {
    status: 'OK',
    agent: NOVA_AGENT,
    agentVersion: NOVA_AGENT_VERSION,
    promptVersion: NOVA_REASONER_VERSION,
    modelVersion: NOVA_NO_MODEL,
    knowledgeVersion: input.knowledgeVersion,
    reasoning,
    claims,
    unresolved,
  };

  assertEnvelopeValid(envelope);
  return envelope;
}
