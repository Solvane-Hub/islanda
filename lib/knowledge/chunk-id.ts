import { createHash } from 'node:crypto';

/**
 * Deterministic `chunk_id` derivation — the single citation identity
 * (K5 §3.10, A12, ADR-0017).
 *
 * RFC 4122 v5 (SHA-1, namespaced). Deterministic rather than random because
 * ADR-0016 makes retries normal operation: re-ingesting the same source into
 * the same Pack version must produce the same ids, or a retry would orphan
 * every citation issued by the first attempt.
 *
 * No wall-clock input. Nothing here may depend on when it ran.
 */

/**
 * Fixed namespace for knowledge-chunk identity. Changing the VALUE re-identifies
 * every chunk — this constant was renamed from FOUNDRYAI_CHUNK_NAMESPACE during
 * the Islanda rebrand, but the literal UUID below is byte-for-byte unchanged.
 */
const KNOWLEDGE_CHUNK_NAMESPACE = '6f1c0d2a-7b3e-4f5a-9c81-2d4e6a8b0c13';

export interface ChunkIdentityInput {
  /** Knowledge Pack version, e.g. 'BS-v1.4'. Scopes stability (K5 §3.10). */
  knowledgeVersion: string;
  /** Stable source identity. */
  sourceId: string;
  /** Section reference within the source, if any. */
  sectionReference?: string | null;
  /** Chunk body. Normalised before hashing — see `normaliseContent`. */
  body: string;
}

/**
 * Whitespace-normalise so that re-flowing a paragraph does not mint a new id
 * while a genuine wording change does. Insertions and deletions still change
 * the hash; only layout is forgiven.
 *
 * ALL whitespace runs collapse to a single space, newlines included. Line
 * breaks in extracted legal text are an artefact of the source layout — the
 * same provision re-extracted from a PDF at a different column width must keep
 * its identity, because K3 §3 requires identifiers to survive updates where the
 * requirement is materially unchanged. Preserving newlines would make a
 * re-wrap orphan every citation pointing at the chunk.
 */
export function normaliseContent(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function chunkIdentityString(input: ChunkIdentityInput): string {
  // Unit separator, not a printable delimiter: a section reference containing
  // the delimiter must not be able to collide with a different field split.
  return [
    input.knowledgeVersion,
    input.sourceId,
    input.sectionReference ?? '',
    normaliseContent(input.body),
  ].join('');
}

/**
 * Exported so that other deterministic identities — `claim_id` in the Nova agent
 * contract — derive from the same implementation rather than a second copy.
 * Each caller supplies its own namespace, so identities never collide across
 * kinds even when every input string matches.
 */
export function uuidV5(name: string, namespace: string): string {
  const nsBytes = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1').update(nsBytes).update(Buffer.from(name, 'utf8')).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/** Stable within its Knowledge Pack version (K5 §3.10). */
export function deriveChunkId(input: ChunkIdentityInput): string {
  return uuidV5(chunkIdentityString(input), KNOWLEDGE_CHUNK_NAMESPACE);
}

/** Content hash for change detection (K6 §2A.2). Not an identity. */
export function contentHash(body: string): string {
  return createHash('sha256').update(normaliseContent(body), 'utf8').digest('hex');
}
