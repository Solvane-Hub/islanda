import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';

type Db = SupabaseClient<Database>;

/**
 * Agent execution repository — ADR-0016, K5 §12, document 15.
 *
 * Append-only, enforced by trigger so it holds even against service_role.
 * Writes go through the admin client because a founder must not be able to
 * forge or suppress the record of what the platform told them — the same
 * reasoning as `audit_log`.
 *
 * ⚠ NOTHING HERE CARRIES CONTENT. No question, no retrieved legal text, no
 *   generated answer. `queryRepresentationHash` identifies a query without
 *   storing it; `retrievedChunkIds` are identifiers, and their ORDER is
 *   significant (K5 §3.8 makes the ordered set part of the contract).
 */

export type AgentExecutionOutcome =
  'answered' | 'no_published_knowledge' | 'no_matching_evidence' | 'needs_clarification' | 'error';

export interface AgentExecutionEntry {
  businessId: string;
  actorId: string | null;
  correlationId: string;

  agent: string;
  agentVersion: string;
  promptVersion: string;
  modelVersion: string;

  outcome: AgentExecutionOutcome;
  claimCount: number;
  unresolvedCount: number;

  /** All null together when no retrieval ran. */
  knowledgePackId?: string | null;
  knowledgeVersion?: string | null;
  retrievalConfigVersion?: string | null;
  rankingConfigVersion?: string | null;
  queryRepresentationHash?: string | null;
  retrievalFilters?: Record<string, unknown>;
  embeddingIdentity?: Record<string, unknown> | null;
  /** Ordered. The order is part of what makes a run reproducible. */
  retrievedChunkIds?: readonly string[];
}

export async function insertAgentExecution(
  admin: Db,
  entry: AgentExecutionEntry,
): Promise<{ error: string | null }> {
  const { error } = await admin.from('agent_executions').insert({
    business_id: entry.businessId,
    actor_id: entry.actorId,
    correlation_id: entry.correlationId,
    agent: entry.agent,
    agent_version: entry.agentVersion,
    prompt_version: entry.promptVersion,
    model_version: entry.modelVersion,
    outcome: entry.outcome,
    claim_count: entry.claimCount,
    unresolved_count: entry.unresolvedCount,
    knowledge_pack_id: entry.knowledgePackId ?? null,
    knowledge_version: entry.knowledgeVersion ?? null,
    retrieval_config_version: entry.retrievalConfigVersion ?? null,
    ranking_config_version: entry.rankingConfigVersion ?? null,
    query_representation_hash: entry.queryRepresentationHash ?? null,
    retrieval_filters: (entry.retrievalFilters ?? {}) as Json,
    embedding_identity: (entry.embeddingIdentity ?? null) as Json,
    retrieved_chunk_ids: [...(entry.retrievedChunkIds ?? [])],
  });

  return { error: error?.message ?? null };
}
