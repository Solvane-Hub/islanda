/**
 * Shared lexical tokenisation.
 *
 * Extracted so that retrieval ranking and extractive passage selection tokenise
 * a query IDENTICALLY. Two copies would drift, and drift here has a specific,
 * nasty failure: a chunk retrieved on a term the extractor tokenises differently
 * yields no passage, so Nova refuses a question it actually had the evidence to
 * answer. A spurious refusal is quiet and looks like thin coverage.
 *
 * Layer note: `lib/ai/**` may not import `lib/db` or `services` (ESLint,
 * Engineering Standards §8). `lib/knowledge` is importable from both sides,
 * which is why this lives here rather than beside either consumer.
 */

/**
 * Lowercase, strip punctuation, drop tokens shorter than three characters.
 *
 * The three-character floor removes most articles and prepositions without a
 * language-specific list, which matters because the platform must not hard-code
 * country assumptions outside the Knowledge Pack.
 */
export function normaliseTerms(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3);
}
