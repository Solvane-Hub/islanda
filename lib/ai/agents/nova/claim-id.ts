import { normaliseContent, uuidV5 } from '@/lib/knowledge/chunk-id';

/**
 * Deterministic `claim_id` — Specialist Agent Contract §6.
 *
 * "A hash of normalised content, not a random ID — so a retry produces matching
 * claims." ADR-0016 makes retries normal operation, and
 * `(workflow_run_id, sequence_no)` is unique, so a re-run that minted fresh ids
 * would look like new claims rather than the same ones.
 *
 * No wall-clock input. Nothing here may depend on when it ran.
 */

/**
 * Distinct from the chunk namespace on purpose. A claim and the chunk it quotes
 * are different things; identical input strings must not produce a colliding id.
 *
 * Renamed from FOUNDRYAI_CLAIM_NAMESPACE during the Islanda rebrand; the
 * literal UUID below is byte-for-byte unchanged.
 */
const NOVA_CLAIM_NAMESPACE = 'c4a91e7d-58b2-4a06-9f13-7e2b5d0a6c94';

/** Unit separator — non-printable, so it cannot occur inside a field value. */
const FIELD_SEPARATOR = '\u001f';

export interface ClaimIdentityInput {
  /** Scopes stability to a Pack version, as `chunk_id` is scoped (K5 §3.10). */
  knowledgeVersion: string;
  /** The chunk the claim was extracted from. */
  chunkId: string;
  /** The claim's statement. Whitespace-normalised before hashing. */
  statement: string;
}

export function claimIdentityString(input: ClaimIdentityInput): string {
  return [input.knowledgeVersion, input.chunkId, normaliseContent(input.statement)].join(
    FIELD_SEPARATOR,
  );
}

/**
 * Stable within its Knowledge Pack version.
 *
 * Whitespace reflow is forgiven — the same provision re-extracted at a different
 * column width keeps its identity — while any wording change mints a new id,
 * because a changed statement is a different claim.
 */
export function deriveClaimId(input: ClaimIdentityInput): string {
  return uuidV5(claimIdentityString(input), NOVA_CLAIM_NAMESPACE);
}
