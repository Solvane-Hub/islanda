import type { DraftChunkInput } from '@/lib/validation/knowledge';
import { assertNoClaimLevelTrust, draftChunkSchema } from '@/lib/validation/knowledge';
import { contentHash, deriveChunkId } from '@/lib/knowledge/chunk-id';
import { toCanonicalProvisionId } from '@/lib/knowledge/provision';
import type { InsertChunkValues } from '@/lib/db/knowledge/chunks';
import type { KnowledgeSource } from '@/types/knowledge';

/**
 * K3 chunking.
 *
 * Pure: takes drafts plus their source, returns rows ready to persist. Keeping
 * it free of I/O means the identity and provenance rules can be tested without
 * a database, which matters because they are the rules citations depend on.
 */

export interface PreparedChunk extends InsertChunkValues {}

export class ChunkingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChunkingError';
  }
}

export function prepareChunks(params: {
  source: Pick<
    KnowledgeSource,
    'id' | 'knowledge_pack_id' | 'country_code' | 'source_authority' | 'legal_source_category'
  >;
  knowledgeVersion: string;
  drafts: readonly unknown[];
}): PreparedChunk[] {
  const { source, knowledgeVersion, drafts } = params;
  const seenIndices = new Set<number>();

  return drafts.map((raw, position) => {
    if (typeof raw === 'object' && raw !== null) {
      // Refuse claim-level trust explicitly. Zod would strip these silently,
      // and silence is how they get added by accident (K3 §5.1).
      assertNoClaimLevelTrust(raw as Record<string, unknown>);
    }

    const parsed = draftChunkSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ChunkingError(
        `K3: draft chunk at position ${position} is invalid — ${parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
      );
    }
    const draft: DraftChunkInput = parsed.data;

    if (seenIndices.has(draft.chunkIndex)) {
      throw new ChunkingError(
        `K3: duplicate chunk_index ${draft.chunkIndex} within one source. Indices must be unique.`,
      );
    }
    seenIndices.add(draft.chunkIndex);

    const chunkId = deriveChunkId({
      knowledgeVersion,
      sourceId: source.id,
      sectionReference: draft.sectionReference ?? null,
      body: draft.body,
    });

    // Canonical provision identity, derived once at ingestion rather than
    // matched as a display string at query time. `null` when the reference
    // cannot be parsed — reported downstream as unresolved, never as "no
    // amendments" (docs/nova-v0.1-review.md §6.3, §6.4).
    const provisionId = toCanonicalProvisionId(draft.sectionReference ?? null);
    const amendsProvision = toCanonicalProvisionId(draft.amendsProvision ?? null);

    if (draft.instrumentRole === 'amending_instruction' && !amendsProvision) {
      throw new ChunkingError(
        `K3: amending instruction at position ${position} names "${draft.amendsProvision}" as the ` +
          'provision it amends, which could not be parsed into a canonical identifier. An edit ' +
          'that cannot be attached to its target would be quoted to a founder in isolation.',
      );
    }

    return {
      chunk_id: chunkId,
      knowledge_source_id: source.id,
      knowledge_pack_id: source.knowledge_pack_id,
      chunk_index: draft.chunkIndex,
      title: draft.title ?? null,
      body: draft.body,
      content_hash: contentHash(draft.body),
      country_code: source.country_code,
      section_reference: draft.sectionReference ?? null,
      instrument_role: draft.instrumentRole,
      provision_id: provisionId,
      amends_provision: amendsProvision,
      clause: draft.clause ?? null,
      page: draft.page ?? null,
      // Source-level only. K3 §5.1.
      source_authority: source.source_authority,
      legal_source_category: source.legal_source_category,
      industry: draft.industry ?? null,
      regulatory_domain: draft.regulatoryDomain ?? null,
      keywords: draft.keywords ?? [],
      effective_date: draft.effectiveDate ?? null,
    };
  });
}
