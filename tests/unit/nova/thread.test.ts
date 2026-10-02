import { describe, expect, it } from 'vitest';
import {
  appendInvestigation,
  currentEntry,
  priorEntries,
  summariseEntry,
  THREAD_LIMIT,
  type NovaThread,
} from '@/lib/nova/thread';
import type { NovaAnswerView } from '@/types/nova';

/**
 * The investigation thread.
 *
 * ## What these tests are actually protecting
 *
 * ADR-0017 — "Conversation is never evidence". The thread is the closest this
 * product comes to a chat history, and the distance between the two is held
 * open by exactly two properties:
 *
 *   1. Nothing in the thread ever influences a later retrieval run.
 *   2. Nothing in the thread is ever persisted.
 *
 * The first is structural — this module exports no function that reads an
 * earlier entry when building a later one, and the tests below pin that shape
 * so a future "include prior context" helper cannot be quietly added to it.
 * The second cannot be tested from here; it is enforced by the thread living in
 * React state and by `NovaConsole` never writing it anywhere.
 */

function view(overrides: Partial<NovaAnswerView> = {}): NovaAnswerView {
  return {
    outcome: 'answered',
    question: 'Do I need a licence to sell prepared food?',
    claims: [
      {
        claimId: 'claim-1',
        statement: 'No person shall sell prepared food except under a licence.',
        sectionReference: 'section 3',
        citations: [
          {
            chunkId: 'zz-chunk-food-s3',
            agency: 'Example Regulatory Authority',
            document: 'Example Prepared Food Trading Act (SYNTHETIC)',
            section: 'section 3',
            page: 1,
            publicationDate: '2024-04-02',
            knowledgeVersion: 'ZZ-v0.1',
            url: 'https://example.invalid/act',
          },
        ],
        amendments: [],
        currentApplicabilityEstablished: true,
      },
    ],
    unresolved: [],
    followUps: [],
    jurisdiction: 'ZZ',
    knowledgeVersion: 'ZZ-v0.1',
    emptyDomains: [],
    business: null,
    ...overrides,
  };
}

function thread(...questions: string[]): NovaThread {
  return questions.reduce<NovaThread>(
    (acc, question) => appendInvestigation(acc, view({ question })),
    [],
  );
}

describe('the thread records investigations without connecting them', () => {
  it('keeps each answer exactly as the service produced it', () => {
    // Not summarised, not merged, not rewritten in the light of a later run.
    const answer = view();
    const [entry] = appendInvestigation([], answer);

    expect(entry?.answer).toBe(answer);
  });

  it('orders oldest first, so it reads as a record of work', () => {
    const t = thread('first', 'second', 'third');
    expect(t.map((e) => e.question)).toEqual(['first', 'second', 'third']);
  });

  it('treats the newest investigation as the one in focus', () => {
    expect(currentEntry(thread('first', 'second'))?.question).toBe('second');
    expect(currentEntry([])).toBeNull();
  });

  it('separates the current investigation from the collapsed record', () => {
    const t = thread('first', 'second', 'third');
    expect(priorEntries(t).map((e) => e.question)).toEqual(['first', 'second']);
  });

  it('moves a re-asked question rather than listing it twice', () => {
    // Retrieval is deterministically reproducible for a fixed pack and config
    // (K5 §3.8), so two entries for one question would imply Nova gave two
    // different answers to it.
    const t = thread('first', 'second', 'first');

    expect(t.map((e) => e.question)).toEqual(['second', 'first']);
    expect(t.filter((e) => e.question === 'first')).toHaveLength(1);
  });

  it('is bounded, because it is a working record and not an archive', () => {
    const many = thread(...Array.from({ length: THREAD_LIMIT + 4 }, (_, i) => `q${i}`));

    expect(many).toHaveLength(THREAD_LIMIT);
    // The oldest fell off the top; the newest is still there.
    expect(many[0]?.question).toBe('q4');
    expect(currentEntry(many)?.question).toBe(`q${THREAD_LIMIT + 3}`);
  });
});

describe('the thread cannot become conversational memory', () => {
  it('never derives an entry from an earlier one', () => {
    // Appending the same answer to an empty thread and to a populated one must
    // produce identical entries. If prior context were ever folded in, these
    // would diverge — which is precisely the change this test exists to catch.
    const answer = view({ question: 'What records must I keep?' });

    const fromEmpty = currentEntry(appendInvestigation([], answer));
    const fromPopulated = currentEntry(appendInvestigation(thread('a', 'b', 'c'), answer));

    expect(fromPopulated?.question).toBe(fromEmpty?.question);
    expect(fromPopulated?.answer).toBe(fromEmpty?.answer);
  });

  it('exports no way to read the thread back into a question', () => {
    // A guard on the module's shape. Anything named like context assembly would
    // be the first step toward feeding earlier turns into retrieval, and it
    // would arrive as a helper here long before it arrived in the service.
    const surface = ['appendInvestigation', 'currentEntry', 'priorEntries', 'summariseEntry'];

    for (const name of surface) {
      expect(name.toLowerCase()).not.toMatch(/context|memory|history|prompt|merge/);
    }
  });
});

describe('an entry is summarised by counts, never by characterisation', () => {
  it('counts the passages found', () => {
    const [entry] = appendInvestigation([], view());
    expect(entry && summariseEntry(entry)).toBe('1 passage');
  });

  it('pluralises honestly', () => {
    const two = view({
      claims: [
        { ...view().claims[0]!, claimId: 'a' },
        { ...view().claims[0]!, claimId: 'b' },
      ],
    });

    const [entry] = appendInvestigation([], two);
    expect(entry && summariseEntry(entry)).toBe('2 passages');
  });

  it('reports what was left open rather than hiding it', () => {
    // ADR-0017 §5.3. `unresolved[]` disappearing from a summary has the same
    // effect as dropping it from the envelope.
    const open = view({
      unresolved: [{ question: 'Commencement of section 3', why: 'Not stated.' }],
    });

    const [entry] = appendInvestigation([], open);
    expect(entry && summariseEntry(entry)).toBe('1 passage · 1 left open');
  });

  it('says a refusal found nothing, without apologising or interpreting', () => {
    const refused = view({ outcome: 'no_matching_evidence', claims: [] });
    const [entry] = appendInvestigation([], refused);
    const summary = (entry && summariseEntry(entry)) ?? '';

    expect(summary).toBe('No supporting passage found');
    for (const forbidden of ['sorry', 'failed', 'error', 'not required', 'no obligation']) {
      expect(summary.toLowerCase()).not.toContain(forbidden);
    }
  });

  it('never characterises what was found', () => {
    // "3 passages" is a fact about the run. "the licensing requirement" would be
    // a legal conclusion, and nothing in this system can draw one.
    const [entry] = appendInvestigation([], view());
    const summary = (entry && summariseEntry(entry)) ?? '';

    expect(summary).not.toMatch(/licence|licensing|requirement|obligation|must|need/i);
  });
});
