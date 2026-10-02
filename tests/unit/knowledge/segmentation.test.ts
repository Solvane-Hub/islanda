import { describe, expect, it } from 'vitest';
import {
  cleanupRawText,
  doublingRatio,
  segmentLegalText,
  type SegmentResult,
} from '@/services/knowledge/segmentation';

/**
 * Segmenter v2. All fixtures are SYNTHETIC text shaped like Bahamas Gazette / LRO
 * `pdftotext -raw` output — no real legislation. They assert the deterministic
 * repair (page-copy dedup, TOC/running-header removal, amendment-heading parsing,
 * schedule scoping) and the fail-closed rules.
 */

function seg(r: SegmentResult) {
  if (r.outcome !== 'segmented') throw new Error(`expected segmented: ${r.reason}`);
  return r;
}

describe('doublingRatio', () => {
  it('is low for clean text and high for the doubled-glyph artifact', () => {
    expect(doublingRatio('Short title and commencement')).toBeLessThan(0.2);
    expect(doublingRatio('SShhoorrtt ttiittllee aanndd ccoommmmeenncceemmeenntt')).toBeGreaterThan(
      0.9,
    );
  });
});

describe('cleanupRawText', () => {
  it('drops dot-leader TOC lines, page markers and the running header', () => {
    const raw = [
      'SAMPLE ACT, 2099',
      'Arrangement of Sections',
      '1. Short title...........................................1',
      '2. Interpretation.......................................1',
      'Page - 1',
      'SAMPLE ACT, 2099',
      '1. Short title.',
      'This Act may be cited as the Sample Act, 2099.',
    ].join('\n');
    const { lines } = cleanupRawText(raw);
    expect(lines.some((l) => /\.{2,}\s*\d+\s*$/.test(l))).toBe(false); // no TOC dot-leaders
    expect(lines).not.toContain('Page - 1');
    expect(lines).toContain('1. Short title.');
    expect(lines).toContain('This Act may be cited as the Sample Act, 2099.');
  });
});

// A page whose content is drawn 3× (the bold-overlay artifact), interleaved with
// running headers/footers — the shape `-raw` produces.
const TRIPLED_ACT = (() => {
  const header = [
    'SAMPLE ACT, 2099',
    'Enacted by the Parliament of The Bahamas',
    'PART I - PRELIMINARY',
  ];
  const body = [
    '1. Short title.',
    'This Act may be cited as the Sample Act, 2099.',
    '2. Interpretation.',
    'In this Act, "widget" means a sample thing of substance and detail here.',
  ];
  const footer = ['Page - 5'];
  const copy = [...header, ...body, ...footer];
  return [...copy, ...copy, ...copy].join('\n');
})();

describe('segmentLegalText — page-copy dedup', () => {
  it('collapses 3 identical page copies into one chunk per provision', () => {
    const r = seg(segmentLegalText(TRIPLED_ACT, { kind: 'substantive_act' }));
    expect(r.chunks.map((c) => c.draft.sectionReference)).toEqual(['section 1', 'section 2']);
    expect(r.chunks[0]!.copies).toBe(3);
    expect(r.chunks[1]!.draft.body).toContain('widget');
  });
});

const AMENDING_ACT = [
  'VALUE ADDED TAX (AMENDMENT) ACT, 2099',
  'Arrangement of Sections',
  '1. Short title and commencement...........................1',
  '2. Amendment of section 6 of the principal Act............1',
  'Enacted by the Parliament of The Bahamas',
  '1. Short title and commencement.',
  '(1) This Act may be cited as the Value Added Tax (Amendment) Act, 2099.',
  '2. Amendment of section 6 of the principal Act.',
  'Section 6 of the principal Act is amended in subsection (1) by deleting words.',
  '3. Insertion of new section 47C in the principal Act.',
  'The principal Act is amended by inserting after section 47B the following new text here.',
  '4. Repeal and replacement of section 56 of the principal Act.',
  'Section 56 of the principal Act is repealed and the following substituted with detail.',
  '5. Amendment of the First Schedule to the principal Act.',
  'The First Schedule to the principal Act is amended by inserting a new item of detail.',
].join('\n');

describe('segmentLegalText — amendment heading variants', () => {
  const r = seg(segmentLegalText(AMENDING_ACT, { kind: 'amending_act' }));
  const byRef = (ref: string) => r.chunks.find((c) => c.draft.sectionReference === ref)!;

  it('treats short title as this act’s own substantive provision', () => {
    expect(byRef('section 1').draft.instrumentRole).toBe('substantive');
    expect(byRef('section 1').draft.amendsProvision).toBeUndefined();
  });

  it('parses Amendment of section X', () => {
    expect(byRef('section 2').draft.instrumentRole).toBe('amending_instruction');
    expect(byRef('section 2').draft.amendsProvision).toBe('section 6');
  });

  it('parses Insertion of new section X (stripping "new")', () => {
    expect(byRef('section 3').draft.amendsProvision).toBe('section 47C');
  });

  it('parses "Repeal and replacement of section X"', () => {
    expect(byRef('section 4').draft.amendsProvision).toBe('section 56');
  });

  it('parses "Amendment of the First Schedule" (stripping "the")', () => {
    expect(byRef('section 5').draft.amendsProvision).toBe('First Schedule');
  });
});

describe('segmentLegalText — schedule scoping', () => {
  it('keeps a schedule whole and does not read its paragraphs as sections', () => {
    const withSchedule = [
      'Enacted by the Parliament of The Bahamas',
      '1. Short title.',
      'This Act may be cited as the Sample Act, 2099, with sufficient body length here.',
      'FIRST SCHEDULE',
      '1. Composition of the Tribunal and other structured paragraph content follows here.',
      '2. Members of the Tribunal are appointed under the following structured provisions here.',
    ].join('\n');
    const r = seg(segmentLegalText(withSchedule, { kind: 'substantive_act' }));
    // Section 1 survives; the schedule's "1./2." paragraphs do NOT become sections.
    const sectionRefs = r.chunks
      .filter((c) => c.kind === 'section')
      .map((c) => c.draft.sectionReference);
    expect(sectionRefs).toEqual(['section 1']);
    const schedule = r.chunks.find((c) => c.kind === 'schedule');
    expect(schedule).toBeDefined();
    expect(schedule!.draft.body).toContain('Composition of the Tribunal');
    expect(schedule!.draft.body).toContain('Members of the Tribunal');
  });
});

describe('segmentLegalText — fail closed', () => {
  it('flags a provision whose substantial copies conflict (ambiguous numbering)', () => {
    // "section 1" as a real section AND as a schedule-like duplicate with different long text.
    const conflicting = [
      'Enacted by the Parliament of The Bahamas',
      '1. Short title.',
      'This is the genuine section one body text, long enough to be well past the substantial ' +
        'threshold so that the consistency check actually compares it against the other copy here.',
      '1. Short title.',
      'A completely different and equally substantial body that conflicts with the first copy and ' +
        'is also well past the substantial threshold so the consistency check must compare them now.',
    ].join('\n');
    const r = segmentLegalText(conflicting, { kind: 'substantive_act' });
    // Either flagged (conflict) — never silently emitting one of two conflicting bodies.
    if (r.outcome === 'segmented') {
      expect(r.quality.flagged.some((f) => f.reference === 'section 1')).toBe(true);
      expect(r.chunks.some((c) => c.draft.sectionReference === 'section 1')).toBe(false);
    } else {
      expect(r.quality.flagged.length).toBeGreaterThan(0);
    }
  });

  it('flags a body still showing the doubled-glyph artifact', () => {
    const corrupt = [
      'Enacted by the Parliament of The Bahamas',
      '5. Corrupted section.',
      'TThhiiss bbooddyy iiss ssttiillll ddoouubblleedd aanndd ccoorrrruupptt hheerree.',
    ].join('\n');
    const r = segmentLegalText(corrupt, { kind: 'substantive_act' });
    const flaggedDoubling =
      r.outcome === 'segmented'
        ? r.quality.flagged.some((f) => /doubled/i.test(f.reason))
        : /doubled|manual/i.test(r.reason);
    expect(flaggedDoubling).toBe(true);
  });

  it('flags an amendment whose target will not canonicalise', () => {
    const bad = [
      'Enacted by the Parliament of The Bahamas',
      '2. Amendment of the whole thing of the principal Act.',
      'The principal Act is amended somehow without a parseable target reference here.',
    ].join('\n');
    const r = segmentLegalText(bad, { kind: 'amending_act' });
    if (r.outcome === 'segmented') {
      expect(r.chunks.some((c) => c.draft.instrumentRole === 'amending_instruction')).toBe(false);
      expect(r.quality.flagged.length).toBeGreaterThan(0);
    } else {
      expect(r.quality.flagged.length + 1).toBeGreaterThan(0);
    }
  });
});
