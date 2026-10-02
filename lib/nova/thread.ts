import type { NovaAnswerView } from '@/types/nova';

/**
 * The investigation thread.
 *
 * ## ⚠ This is not conversation memory, and the distinction is the whole point
 *
 * ADR-0017 stands: Nova holds no memory across turns. Every entry below was
 * produced by a COMPLETE, INDEPENDENT retrieval run. Nothing from entry 1
 * influenced entry 2 — not the question, not the answer, not a summary of
 * either. Nova did not know entry 1 existed when it answered entry 2.
 *
 * What the thread is, then, is a **log of separate investigations the founder
 * ran in this session**. It exists because a founder tracing an obligation asks
 * three or four related questions, and losing the earlier answers each time
 * makes the product feel like a search box rather than a workspace.
 *
 * Three consequences, all deliberate:
 *
 *   • It lives in React state and is NEVER persisted. A closed tab loses it.
 *     Persisting it would create a store that looks exactly like conversation
 *     history to whoever reads the schema next, and the distinction above would
 *     survive precisely as long as the comment explaining it.
 *   • It is never sent anywhere. No entry enters a query representation, a
 *     prompt, or a retrieval call. There is no code path from this module into
 *     `askNovaAction`.
 *   • The UI must label entries as separate investigations. An interface that
 *     renders them as a chat transcript is making a promise the service does
 *     not keep — see `NovaThread` for how that is handled visually.
 *
 * Re-running a question returns the same answer because the pack and the
 * retrieval config are unchanged (K5 §3.8 reproducibility), not because
 * anything was cached or remembered.
 */

export interface ThreadEntry {
  /** Stable within the session. Derived from the question and its position. */
  id: string;
  /** Exactly what the founder asked. */
  question: string;
  /** The complete, independent result of that investigation. */
  answer: NovaAnswerView;
}

/** Newest last, so the thread reads top to bottom like a record of work. */
export type NovaThread = readonly ThreadEntry[];

/**
 * How many investigations stay in view.
 *
 * Bounded because the thread is a working record, not an archive — and because
 * an unbounded list of full answers becomes unreadable long before it becomes
 * a memory problem. Older entries fall off the top; nothing about them was
 * durable in the first place.
 */
export const THREAD_LIMIT = 6;

/**
 * Append a completed investigation.
 *
 * Re-asking a question that is already in the thread MOVES it to the end rather
 * than duplicating it: the founder re-ran that investigation, and the newest
 * result is the one that matters. The earlier copy is dropped because keeping
 * both would imply Nova had two different answers to the same question, when in
 * fact reproducibility guarantees they are identical.
 */
export function appendInvestigation(thread: NovaThread, answer: NovaAnswerView): NovaThread {
  const question = answer.question;
  const withoutDuplicate = thread.filter((entry) => entry.question !== question);

  const entry: ThreadEntry = {
    id: `${withoutDuplicate.length}-${question}`,
    question,
    answer,
  };

  return [...withoutDuplicate, entry].slice(-THREAD_LIMIT);
}

/** The investigation currently in focus — always the most recent. */
export function currentEntry(thread: NovaThread): ThreadEntry | null {
  return thread[thread.length - 1] ?? null;
}

/** Everything before it, oldest first. Rendered collapsed. */
export function priorEntries(thread: NovaThread): NovaThread {
  return thread.slice(0, -1);
}

/**
 * A one-line summary of a prior investigation, for the collapsed view.
 *
 * ⚠ Counts only. No characterisation of what was found, because a summary that
 *   said "found the licensing requirement" would be an interpretation this
 *   system cannot make.
 */
export function summariseEntry(entry: ThreadEntry): string {
  const { answer } = entry;

  if (answer.outcome !== 'answered') return 'No supporting passage found';

  const passages = answer.claims.length;
  const open = answer.unresolved.length;

  const found = `${passages} ${passages === 1 ? 'passage' : 'passages'}`;
  return open > 0 ? `${found} · ${open} left open` : found;
}
