import { describe, expect, it } from 'vitest';
import { narrateAnswer } from '@/lib/nova/narration';
import type { NovaAnswerView, NovaCitationView, NovaClaimView } from '@/types/nova';

/**
 * Nova's narration.
 *
 * ## The line under test
 *
 * Nova narrates **the search**. It never interprets **the law**.
 *
 * This is the most dangerous module in the presentation layer, because it is
 * the only one that writes sentences rather than rendering supplied strings.
 * Every one of those sentences sits AFTER `assertCitationsGrounded`, after the
 * ADR-0017 envelope, after every gate built to make fabrication structurally
 * impossible. If a legal conclusion is ever going to appear in this product
 * without evidence behind it, it will appear here first.
 *
 * So the tests are adversarial: they check that the copy contains no
 * requirement language, no obligation verbs, and no answer to the founder's
 * actual question — only a description of what Nova did.
 */

function citation(overrides: Partial<NovaCitationView> = {}): NovaCitationView {
  return {
    chunkId: 'zz-chunk-food-s3',
    agency: 'Example Regulatory Authority',
    document: 'Example Prepared Food Trading Act (SYNTHETIC)',
    section: 'section 3',
    page: 1,
    publicationDate: '2024-04-02',
    knowledgeVersion: 'ZZ-v0.1',
    url: 'https://example.invalid/prepared-food-trading-act',
    ...overrides,
  };
}

function claim(overrides: Partial<NovaClaimView> = {}): NovaClaimView {
  return {
    claimId: 'claim-1',
    statement: 'No person shall sell prepared food to the public except under a licence.',
    sectionReference: 'section 3',
    citations: [citation()],
    amendments: [],
    currentApplicabilityEstablished: true,
    ...overrides,
  };
}

function answer(overrides: Partial<NovaAnswerView> = {}): NovaAnswerView {
  return {
    outcome: 'answered',
    question: 'Do I need a licence to sell prepared food?',
    claims: [claim()],
    unresolved: [],
    followUps: [],
    jurisdiction: 'ZZ',
    knowledgeVersion: 'ZZ-v0.1',
    emptyDomains: [],
    business: null,
    ...overrides,
  };
}

/** Everything the narration says, as one lowercase string. */
function spoken(view: NovaAnswerView): string {
  const n = narrateAnswer(view);
  return [n.opener, n.lead, n.detail, n.caveat, n.invitation, n.continuation?.prompt]
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .toLowerCase();
}

describe('narration describes the search, never the law', () => {
  it('never states an obligation', () => {
    // The exact failure this module exists to prevent: "you need a licence" is
    // a legal conclusion drawn from a passage, and nothing in this system can
    // draw one.
    const text = spoken(answer());

    for (const forbidden of [
      'you need',
      'you must',
      'you are required',
      'you will need',
      'is required',
      'you should',
      'you have to',
      'applies to you',
    ]) {
      expect(text, `narration asserts "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it('never answers the question yes or no', () => {
    const n = narrateAnswer(answer());
    expect(n.lead.toLowerCase()).not.toMatch(/^(yes|no)\b/);
    expect(n.lead).not.toMatch(/\byes —/i);
  });

  it('never characterises what a provision means', () => {
    const text = spoken(answer());

    for (const forbidden of ['means that', 'in other words', 'this means', 'essentially']) {
      expect(text, `narration interprets: "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it('never claims completeness', () => {
    // Trust Layer §7.4 — Coverage Confidence is computed but not displayed.
    const text = spoken(answer());
    for (const forbidden of ['all the', 'everything', 'complete list', 'nothing else']) {
      expect(text, `narration claims "${forbidden}"`).not.toContain(forbidden);
    }
  });
});

describe('narration counts only what the answer contains', () => {
  it('reports the real passage count', () => {
    const three = answer({
      claims: [claim({ claimId: 'a' }), claim({ claimId: 'b' }), claim({ claimId: 'c' })],
    });

    expect(narrateAnswer(three).lead).toContain('3 passages');
  });

  it('uses the singular for one passage', () => {
    expect(narrateAnswer(answer()).lead).toContain('1 passage');
    expect(narrateAnswer(answer()).lead).not.toContain('1 passages');
  });

  it('counts distinct documents, not citations', () => {
    // Two passages from the same Act is one document. Reporting two would
    // overstate the breadth of what was read.
    const sameDocument = answer({
      claims: [
        claim({ claimId: 'a', citations: [citation({ chunkId: 'x' })] }),
        claim({ claimId: 'b', citations: [citation({ chunkId: 'y' })] }),
      ],
    });

    expect(narrateAnswer(sameDocument).lead).not.toContain('document');
  });

  it('mentions document breadth only when there is more than one', () => {
    const twoDocuments = answer({
      claims: [
        claim({ claimId: 'a', citations: [citation({ chunkId: 'x', document: 'Act A' })] }),
        claim({ claimId: 'b', citations: [citation({ chunkId: 'y', document: 'Act B' })] }),
      ],
    });

    expect(narrateAnswer(twoDocuments).lead).toContain('2 documents');
  });

  it('names the closest match from the first claim, which is retrieval rank 1', () => {
    const n = narrateAnswer(answer());

    expect(n.detail).toContain('section 3');
    expect(n.detail).toContain('Example Prepared Food Trading Act');
  });

  it('describes ranking, not importance', () => {
    // "closest match" is a true statement about lexical ranking. "most
    // important" would be a judgement nothing computed.
    const text = spoken(answer());

    expect(text).toContain('closest match');
    for (const forbidden of ['most important', 'the key', 'the main requirement', 'strongest']) {
      expect(text, `narration ranks by importance: "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it('omits the detail rather than inventing one when a claim has no citation', () => {
    const uncited = answer({ claims: [claim({ citations: [] })] });
    expect(narrateAnswer(uncited).detail).toBeNull();
  });
});

describe('narration surfaces what could not be established', () => {
  it('names an unestablished position as the reason, not as a failure', () => {
    const n = narrateAnswer(
      answer({ claims: [claim({ currentApplicabilityEstablished: false })] }),
    );

    expect(n.caveat).toContain('could not establish whether it is in force');
    expect(n.caveat?.toLowerCase()).not.toContain('sorry');
    expect(n.caveat?.toLowerCase()).not.toContain('error');
  });

  it('reports unresolved items rather than dropping them', () => {
    const n = narrateAnswer(
      answer({ unresolved: [{ question: 'Current position of section 9', why: 'Not stated.' }] }),
    );

    expect(n.caveat).toContain('could not establish');
    expect(n.caveat).toContain('listed below rather than left out');
  });

  it('says nothing about caveats when there are none', () => {
    expect(narrateAnswer(answer()).caveat).toBeNull();
  });
});

describe('narration on a refusal', () => {
  it('distinguishes no published sources from no matching passage', () => {
    const noPack = narrateAnswer(answer({ outcome: 'no_published_knowledge', claims: [] }));
    const noMatch = narrateAnswer(answer({ outcome: 'no_matching_evidence', claims: [] }));

    expect(noPack.lead).toContain('no published sources');
    expect(noMatch.lead).toContain('found nothing that answers this');
    expect(noPack.lead).not.toBe(noMatch.lead);
  });

  it('states a missing corpus as a gap in coverage, not a fact about the law', () => {
    const n = narrateAnswer(answer({ outcome: 'no_published_knowledge', claims: [] }));
    expect(n.caveat).toContain('not a statement about what the law requires');
  });

  it('offers a next step when the question could not be matched', () => {
    const n = narrateAnswer(answer({ outcome: 'needs_clarification', claims: [] }));
    expect(n.invitation).toContain('search again');
  });

  it('never apologises for refusing', () => {
    // A refusal is the system working. Apologising for it teaches founders to
    // read it as a defect rather than as integrity.
    for (const outcome of [
      'no_published_knowledge',
      'no_matching_evidence',
      'needs_clarification',
    ] as const) {
      const text = spoken(answer({ outcome, claims: [] }));
      for (const forbidden of ['sorry', 'unfortunately', 'apolog', 'failed', 'error']) {
        expect(text, `${outcome} says "${forbidden}"`).not.toContain(forbidden);
      }
    }
  });

  it('never produces a detail on a refusal — there is nothing to point at', () => {
    for (const outcome of [
      'no_published_knowledge',
      'no_matching_evidence',
      'needs_clarification',
    ] as const) {
      expect(narrateAnswer(answer({ outcome, claims: [] })).detail, outcome).toBeNull();
    }
  });
});

describe('narration always says something', () => {
  it('produces a lead for every outcome', () => {
    for (const outcome of [
      'answered',
      'no_published_knowledge',
      'no_matching_evidence',
      'needs_clarification',
    ] as const) {
      const n = narrateAnswer(answer({ outcome, claims: outcome === 'answered' ? [claim()] : [] }));
      expect(n.lead.length, outcome).toBeGreaterThan(0);
    }
  });

  it('speaks in the first person, so the words belong to Nova', () => {
    expect(narrateAnswer(answer()).lead).toMatch(/^I /);
  });
});

describe('narration opens and offers to continue', () => {
  it('acknowledges the question before reporting on it', () => {
    // The one line here that is not derived from the answer. It is safe
    // because it asserts nothing — it is an interactional move, not a claim.
    expect(narrateAnswer(answer()).opener).toBe('Let me look at that.');
  });

  it('acknowledges on every outcome, including a refusal', () => {
    for (const outcome of [
      'answered',
      'no_published_knowledge',
      'no_matching_evidence',
      'needs_clarification',
    ] as const) {
      const n = narrateAnswer(answer({ outcome, claims: outcome === 'answered' ? [claim()] : [] }));
      expect(n.opener.length, outcome).toBeGreaterThan(0);
    }
  });

  it('the acknowledgement never previews a result it has not got', () => {
    // "Let me look at that" is fine. "Good question, yes you do" is not — and
    // neither is anything that characterises the answer before it is reported.
    for (const outcome of [
      'answered',
      'no_published_knowledge',
      'no_matching_evidence',
      'needs_clarification',
    ] as const) {
      const opener = narrateAnswer(
        answer({ outcome, claims: outcome === 'answered' ? [claim()] : [] }),
      ).opener.toLowerCase();

      for (const forbidden of ['yes', 'no,', 'found', 'need', 'must', 'require', 'law']) {
        expect(opener, `${outcome} opener says "${forbidden}"`).not.toContain(forbidden);
      }
    }
  });

  it('offers nothing to continue when the answer produced no follow-up', () => {
    expect(narrateAnswer(answer()).continuation).toBeNull();
  });

  it('offers the first follow-up as a question Nova asks', () => {
    const n = narrateAnswer(
      answer({
        followUps: [
          {
            id: 'f1',
            label: 'Section 9 of the Example Widget Licensing Act',
            question: 'What does section 9 of the Example Widget Licensing Act require?',
          },
        ],
      }),
    );

    expect(n.continuation?.prompt).toMatch(/^want me to trace /i);
    expect(n.continuation?.prompt).toContain('example widget licensing act');
  });

  it('carries the follow-up question verbatim, so nothing is asked that was not shown', () => {
    const question = 'What does section 9 of the Example Widget Licensing Act require?';
    const n = narrateAnswer(answer({ followUps: [{ id: 'f1', label: 'Section 9', question }] }));

    expect(n.continuation?.question).toBe(question);
  });

  it('never offers to continue on a refusal', () => {
    // There is no evidence to point at, so there is no lead to follow. An offer
    // here would be the interface inventing a direction the search did not
    // produce.
    for (const outcome of [
      'no_published_knowledge',
      'no_matching_evidence',
      'needs_clarification',
    ] as const) {
      const n = narrateAnswer(
        answer({
          outcome,
          claims: [],
          followUps: [{ id: 'f1', label: 'Section 9', question: 'What about section 9?' }],
        }),
      );

      expect(n.continuation, outcome).toBeNull();
    }
  });

  it('the offer describes tracing a document, never predicting what it says', () => {
    const n = narrateAnswer(
      answer({
        followUps: [
          { id: 'f1', label: 'Section 9 of the Example Act', question: 'What does section 9 say?' },
        ],
      }),
    );

    const prompt = n.continuation?.prompt.toLowerCase() ?? '';
    for (const forbidden of [
      'probably',
      'likely',
      'should also',
      'you will also need',
      'applies',
    ]) {
      expect(prompt, `continuation predicts: "${forbidden}"`).not.toContain(forbidden);
    }
  });
});
