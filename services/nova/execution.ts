import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import {
  insertAgentExecution,
  type AgentExecutionEntry,
  type AgentExecutionOutcome,
} from '@/lib/db/agent-executions';
import {
  NOVA_AGENT,
  NOVA_AGENT_VERSION,
  NOVA_NO_MODEL,
  NOVA_REASONER_VERSION,
} from '@/lib/ai/agents/nova/contract';
import type { NovaAnswer } from '@/services/nova/answer';

/**
 * Nova execution recording — the reproducibility half of ADR-0016.
 *
 * ⚠ **This fails CLOSED, and that is the opposite of `recordAuditEvent`.**
 *
 * Audit deliberately fails open (ADR-0012): losing a sign-in log must not
 * become an availability fault, and failing a user's action on a logging hiccup
 * is trivially abusable as a denial of service.
 *
 * Reproducibility is different. An agent execution record is not telemetry
 * about an answer — for regulatory guidance it is part of the answer's standing.
 * A founder acts on what Nova says; if the platform cannot say afterwards which
 * Knowledge Pack version and retrieval configuration produced it, the answer
 * cannot be defended, audited or replayed. Delivering guidance we could never
 * account for is worse than delivering none, which is the same reasoning the
 * Trust Layer uses.
 *
 * The cost is explicit: without `SUPABASE_SERVICE_ROLE_KEY`, or with the
 * database unreachable, Nova stops answering. That is an availability trade
 * taken on purpose.
 */

export class ExecutionNotRecordedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExecutionNotRecordedError';
  }
}

/**
 * Identify a query without storing it.
 *
 * SHA-256 over the query representation. Enough to prove two runs used the same
 * query and to detect that a replay diverged; NOT enough to reconstruct the
 * founder's question, which is the point.
 *
 * ⚠ It is therefore also not enough to RE-EXECUTE a historical run. Full replay
 *   would require persisting the query text, which is a privacy decision that
 *   has not been taken. See docs/nova-v0.1-review.md and the migration comment.
 */
export function hashQueryRepresentation(queryRepresentation: string): string {
  return createHash('sha256').update(queryRepresentation, 'utf8').digest('hex');
}

function outcomeOf(answer: NovaAnswer): AgentExecutionOutcome {
  return answer.outcome;
}

/** Build the execution row from a completed answer. Content never crosses this boundary. */
export function executionEntryForAnswer(params: {
  answer: NovaAnswer;
  businessId: string;
  actorId: string | null;
  correlationId: string;
  queryRepresentation: string;
}): AgentExecutionEntry {
  const { answer } = params;

  return {
    businessId: params.businessId,
    actorId: params.actorId,
    correlationId: params.correlationId,
    agent: NOVA_AGENT,
    agentVersion: NOVA_AGENT_VERSION,
    promptVersion: NOVA_REASONER_VERSION,
    modelVersion: NOVA_NO_MODEL,
    outcome: outcomeOf(answer),
    claimCount: answer.envelope?.claims.length ?? 0,
    unresolvedCount: answer.unresolved.length,
    knowledgePackId: answer.packId,
    knowledgeVersion: answer.knowledgeVersion,
    retrievalConfigVersion: answer.reproducibility?.retrievalConfigVersion ?? null,
    rankingConfigVersion: answer.reproducibility?.rankingConfigVersion ?? null,
    queryRepresentationHash: hashQueryRepresentation(params.queryRepresentation),
    retrievalFilters: (answer.reproducibility?.filters ?? {}) as Record<string, unknown>,
    embeddingIdentity: (answer.reproducibility?.embeddingIdentity ?? null) as Record<
      string,
      unknown
    > | null,
    retrievedChunkIds: answer.retrievedChunkIds,
  };
}

/** Build the execution row for a run that threw before producing an answer. */
export function executionEntryForFailure(params: {
  businessId: string;
  actorId: string | null;
  correlationId: string;
  queryRepresentation: string;
}): AgentExecutionEntry {
  return {
    businessId: params.businessId,
    actorId: params.actorId,
    correlationId: params.correlationId,
    agent: NOVA_AGENT,
    agentVersion: NOVA_AGENT_VERSION,
    promptVersion: NOVA_REASONER_VERSION,
    modelVersion: NOVA_NO_MODEL,
    outcome: 'error',
    claimCount: 0,
    unresolvedCount: 0,
    queryRepresentationHash: hashQueryRepresentation(params.queryRepresentation),
  };
}

/**
 * Persist an execution, or refuse to proceed.
 *
 * Throws `ExecutionNotRecordedError` when the record cannot be written. Callers
 * must not swallow it — the answer must not reach the founder.
 */
export async function recordNovaExecution(entry: AgentExecutionEntry): Promise<void> {
  const admin = createAdminClient();

  if (!admin) {
    logger.error('nova.execution_not_recorded', {
      reason: 'SUPABASE_SERVICE_ROLE_KEY is not configured',
      correlationId: entry.correlationId,
      businessId: entry.businessId,
    });
    throw new ExecutionNotRecordedError(
      'Nova cannot record agent executions because no service role key is configured. ' +
        'Answers are withheld rather than delivered unaccountably.',
    );
  }

  const { error } = await insertAgentExecution(admin, entry);

  if (error) {
    logger.error('nova.execution_not_recorded', {
      reason: 'insert_failed',
      correlationId: entry.correlationId,
      businessId: entry.businessId,
      code: error,
    });
    throw new ExecutionNotRecordedError(
      `Nova could not record this execution: ${error}. The answer is withheld.`,
    );
  }
}

/** Map a recording failure into the platform error shape. */
export function executionNotRecordedError(correlationId: string, cause: unknown): AppError {
  return new AppError({
    code: 'UNEXPECTED',
    humanMessage:
      'Nova could not complete this request. Nothing was answered, and the attempt was logged.',
    developerMessage:
      'agent_executions write failed. Reproducibility is a precondition for delivering ' +
      'regulatory guidance, so the answer was withheld (fails closed, unlike audit).',
    correlationId,
    cause,
  });
}
