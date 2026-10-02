'use client';

import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useNovaFocus } from '@/components/nova/nova-focus';
import type { NovaAnswerView } from '@/types/nova';

/**
 * The documents behind an answer, indexed once.
 *
 * ## Why this is not the same as the source line under each passage
 *
 * Under a passage, the citation answers "where did THIS come from". Here it
 * answers "what did Nova read at all" — which is a different question, and the
 * one a founder asks when deciding whether to trust the whole answer rather
 * than one sentence of it.
 *
 * Five passages from two Acts is a materially different situation from five
 * passages from five Acts, and a per-passage citation list never surfaces that.
 * Grouping by document makes it immediate.
 *
 * ## ⚠ Counted, never estimated
 *
 * Documents are de-duplicated from the answer's own citations. The number
 * beside each is how many passages in THIS answer came from it. Nothing here
 * describes the size of the corpus, how many sources exist, or how much was
 * searched — none of which the view can know.
 *
 * Hovering an entry lights the passages it produced, through the same focus
 * context the constellation uses. One relationship, three places it can be
 * entered from.
 */

interface IndexedDocument {
  document: string;
  agency: string;
  /** Chunks in this answer that came from this document. */
  chunkIds: string[];
}

function indexDocuments(answer: NovaAnswerView): IndexedDocument[] {
  const byDocument = new Map<string, IndexedDocument>();

  for (const claim of answer.claims) {
    for (const citation of claim.citations) {
      const existing = byDocument.get(citation.document);
      if (existing) {
        existing.chunkIds.push(citation.chunkId);
      } else {
        byDocument.set(citation.document, {
          document: citation.document,
          agency: citation.agency,
          chunkIds: [citation.chunkId],
        });
      }
    }
  }

  return [...byDocument.values()];
}

export function NovaSourceIndex({ answer }: { answer: NovaAnswerView }) {
  const { focus, focusedChunk, relatedChunks } = useNovaFocus();
  const documents = indexDocuments(answer);

  if (documents.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1">
      {documents.map((entry) => {
        const related =
          focusedChunk !== null &&
          entry.chunkIds.some((id) => id === focusedChunk || relatedChunks.includes(id));

        return (
          <li key={entry.document}>
            <button
              type="button"
              onMouseEnter={() => focus(entry.chunkIds[0] ?? null, entry.chunkIds)}
              onMouseLeave={() => focus(null)}
              onFocus={() => focus(entry.chunkIds[0] ?? null, entry.chunkIds)}
              onBlur={() => focus(null)}
              className={cn(
                'flex w-full min-w-0 items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors duration-150',
                related ? 'bg-bahama-turquoise/8' : 'hover:bg-white/5',
              )}
            >
              <FileText
                aria-hidden="true"
                className={cn(
                  'mt-0.5 size-3.5 shrink-0 transition-colors duration-150',
                  related ? 'text-bahama-turquoise' : 'text-champagne',
                )}
              />

              <span className="min-w-0 flex-1">
                <span className="text-on-ink block text-xs leading-relaxed font-medium text-pretty">
                  {entry.document}
                </span>
                <span className="text-on-glass-subtle text-2xs mt-0.5 block">
                  {entry.agency} ·{' '}
                  {entry.chunkIds.length === 1 ? '1 passage' : `${entry.chunkIds.length} passages`}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
