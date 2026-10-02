import type { DraftChunkInput } from '@/lib/validation/knowledge';
import { toCanonicalProvisionId } from '@/lib/knowledge/provision';

/**
 * Section segmenter (v2) — the EXTRACT→SEGMENT step, turning `pdftotext -raw`
 * output into first-pass draft chunks aligned to an instrument's own provisions.
 *
 * ## The extraction artifact this is built around
 *
 * Several Bahamas Gazette / LRO PDFs draw each page's text 2–3 times (a bold
 * overlay). `-layout` collides the overlapping runs into character-level garbage
 * (`SeAcmtioennd…`, `SShhoorrtt…`); `-raw` avoids that but repeats whole page
 * copies. This module is fed `-raw` text and repairs the repetition
 * DETERMINISTICALLY, at the level of legal provisions:
 *
 *   1. `cleanupRawText` strips table-of-contents (dot-leader) lines, running
 *      headers/footers and page markers — so the Arrangement of Sections can
 *      never be mistaken for substantive provisions, however many times it was
 *      drawn.
 *   2. section headings are matched on the cleaned body, and every occurrence of
 *      a provision is grouped by its canonical id. The copies are collapsed by
 *      keeping the LONGEST body (which also recovers text that continued across a
 *      page break) and VERIFYING the shorter copies are consistent prefixes of
 *      it. A copy that is not consistent, or a body still showing the doubling
 *      signature, is not emitted — it is FLAGGED for human review (fail closed).
 *
 * Nothing here rewrites words, fabricates references, or decides an instrument is
 * publishable. It is the reviewable input to the staged-review step.
 */

export type InstrumentKind = 'substantive_act' | 'amending_act';

export interface SegmentOptions {
  kind: InstrumentKind;
  expectedSections?: number;
}

export interface SegmentedChunk {
  draft: DraftChunkInput;
  /** The raw heading line the chunk was cut at — kept for human review. */
  headingLine: string;
  /** Containing Part, e.g. "PART IV - REGISTRATION", or null. */
  part: string | null;
  /** How many identical copies of this provision were collapsed (1 = single-draw). */
  copies: number;
  kind: 'section' | 'schedule';
  /** A schedule body that looks like a tariff/table — kept verbatim, flagged for review. */
  containsTable: boolean;
}

export interface FlaggedProvision {
  reference: string;
  reason: string;
}

export interface SegmentQuality {
  runningTitle: string | null;
  linesDropped: number;
  sectionsEmitted: number;
  schedulesEmitted: number;
  amendingChunks: number;
  flagged: FlaggedProvision[];
  /** Highest doubled-glyph ratio seen in any emitted body line (0 = clean). */
  maxBodyDoublingRatio: number;
}

export type SegmentResult =
  | { outcome: 'segmented'; chunks: SegmentedChunk[]; quality: SegmentQuality }
  | { outcome: 'needs_manual_segmentation'; reason: string; quality: SegmentQuality };

/** A body line above this doubled-glyph ratio is treated as residual corruption. */
const BODY_DOUBLING_THRESHOLD = 0.6;

/**
 * A numbered section heading in raw output: "1. Short title", "38K. Insertion",
 * and also a section that opens directly on a subsection — "6. (1) A data
 * controller …" — as older LRO reprints lay them out.
 */
const SECTION_HEADING = /^ {0,4}(\d{1,3}[A-Z]?)\.\s+(\S.*?)\s*$/;

/** A Part heading: "PART IV - REGISTRATION", "PART 2 – …". */
const PART_HEADING = /^\s*PART\s+([IVXLCDM]+|\d+)\b.*$/;

/**
 * A schedule heading, STRICT: an all-caps schedule name occupying the whole line.
 * Deliberately excludes table-of-contents entries with a trailing page number
 * ("SECOND SCHEDULE 119"), mid-sentence references ("Schedule.") and prose
 * ("Schedule or Second Schedule or …") — matching any of those would latch the
 * segmenter into schedule mode and swallow the real sections after it.
 */
const SCHEDULE_HEADING =
  /^((?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH)\s+SCHEDULE|SCHEDULE(?:\s+\d+)?)$/;

/**
 * Amendment / insertion / substitution / repeal heading forms. Captures the
 * operation and the target provision text.
 *   "Amendment of section 6 of the principal Act"
 *   "Insertion of section 38K into the principal Act"
 *   "Substitution of section 12 of the principal Act"
 *   "Repeal of section 71 of the principal Act"
 *   "Insertion of Fourth Schedule into the principal Act"
 *   "Amendment of Second Schedule to the principal Act"
 */
const AMENDMENT_HEADING =
  /^(?:amendment|insertion|substitution|repeal|deletion)(?:\s+and\s+(?:replacement|substitution|amendment))?\s+(?:of|to|into)\s+(.+?)(?:\s+(?:of|to|into|in)\s+the\s+principal\s+act)?\.?$/i;

/** Headings of an amending Act that state its OWN law rather than edit the base. */
const SELF_PROVISION_HEADING = /^(short title|interpretation|commencement|citation)/i;

/** Dot-leader table-of-contents line: "… .......... 19". */
const DOT_LEADER = /\.{2,}\s*\d+\s*$/;

/** Page footer / running-number lines. */
const PAGE_MARKER = /^\s*(?:page\s*[-–]?\s*)?[0-9ivxlcdm]+\s*$/i;
const LRO_MARKER = /^\s*(?:LRO\b|STATUTE LAW OF THE BAHAMAS|\[?CH\.\s*\d+)/i;
const TOC_LABEL = /^\s*(arrangement of sections|section)\s*$/i;

/**
 * Fraction of a line that is adjacent duplicated characters — the doubled-glyph
 * artifact signature. "Short" → ~0; "SShhoorrtt" → ~1. Whitespace ignored.
 */
export function doublingRatio(line: string): number {
  const chars = [...line].filter((c) => c !== ' ' && c !== '\t');
  if (chars.length < 6) return 0;
  let pairs = 0;
  for (let i = 0; i + 1 < chars.length; i += 2) {
    if (chars[i] === chars[i + 1]) pairs += 1;
  }
  return pairs / Math.floor(chars.length / 2);
}

/** The most frequent ALL-CAPS line — the running header/title, if any. */
function detectRunningTitle(lines: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (const l of lines) {
    const t = l.trim();
    if (t.length > 8 && t === t.toUpperCase() && /[A-Z]/.test(t) && !DOT_LEADER.test(t)) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestN = 2; // must repeat to count as a running header
  for (const [t, n] of counts) {
    if (n > bestN) {
      best = t;
      bestN = n;
    }
  }
  return best;
}

/**
 * Minimum repetitions for an all-caps line to be treated as a running header.
 * Three, because the bold overlay draws each page ~3×, so a genuine running
 * header (long title, act name) recurs once per copy. Real legislative body text
 * is not an all-caps line repeated this many times.
 */
const RUNNING_HEADER_MIN_REPEATS = 3;

/** An act-number footer that recurs on every page, e.g. "No. 3 of 2025". */
const ACT_NUMBER_FOOTER = /^No\.\s*\d+\s+of\s+\d{4}$/i;

/**
 * The enacting formula. It recurs once per drawn page copy as a running header,
 * leaking into provision bodies; stripping every occurrence is safe because it
 * is a fixed formula, never substantive provision text.
 */
const ENACTING_FORMULA = /^enacted by the parliament\b/i;

/**
 * All-caps lines that repeat often enough to be a running header (title, long
 * title) rather than body — EXCLUDING Part and Schedule headings, which are
 * structural even though they too repeat once per drawn page copy.
 *
 * These leak into provision bodies before the next heading and, because each
 * page copy captures a slightly different amount of them, make otherwise
 * identical copies of a provision look inconsistent. Removing them is a
 * deterministic repair — no legal text is a many-times-repeated all-caps line.
 */
function detectRunningHeaders(lines: readonly string[]): Set<string> {
  const counts = new Map<string, number>();
  for (const l of lines) {
    const t = l.trim();
    if (t.length > 8 && t === t.toUpperCase() && /[A-Z]/.test(t) && !DOT_LEADER.test(t)) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  const headers = new Set<string>();
  for (const [t, n] of counts) {
    if (n >= RUNNING_HEADER_MIN_REPEATS && !PART_HEADING.test(t) && !SCHEDULE_HEADING.test(t)) {
      headers.add(t);
    }
  }
  return headers;
}

export interface CleanupResult {
  lines: string[];
  runningTitle: string | null;
  dropped: number;
}

/**
 * Strip table-of-contents, running headers/footers and page markers from raw
 * text, leaving substantive body lines (with their section/Part/Schedule
 * headings). Deterministic and independent of any single enacting-formula phrase.
 */
export function cleanupRawText(raw: string): CleanupResult {
  const all = raw.split(/\r?\n/);
  const runningTitle = detectRunningTitle(all);
  const runningHeaders = detectRunningHeaders(all);
  const kept: string[] = [];
  let dropped = 0;
  for (const line of all) {
    const t = line.trim();
    const isNoise =
      t.length === 0 ||
      DOT_LEADER.test(t) ||
      PAGE_MARKER.test(t) ||
      LRO_MARKER.test(t) ||
      TOC_LABEL.test(t) ||
      ACT_NUMBER_FOOTER.test(t) ||
      ENACTING_FORMULA.test(t) ||
      /^[a-z]$/.test(t) || // lone stray glyph ("c")
      runningHeaders.has(t);
    if (isNoise) {
      dropped += 1;
      continue;
    }
    kept.push(line);
  }
  return { lines: kept, runningTitle, dropped };
}

/** Extract the amended provision from an amendment heading, or null. */
function amendedProvisionFrom(headingText: string): string | null {
  const m = AMENDMENT_HEADING.exec(headingText.trim());
  if (!m || !m[1]) return null;
  // Strip drafting-convention prefixes that are not part of the reference:
  // "new section 47C" → "section 47C"; "the First Schedule" → "First Schedule".
  return m[1]
    .trim()
    .replace(/^(?:a\s+|an\s+|the\s+|new\s+)+/i, '')
    .trim();
}

function normalizeBody(body: string): string {
  return body.replace(/\s+/g, ' ').trim();
}

/**
 * Whether a body reads as prose rather than a heading/listing stub.
 *
 * A real provision body is running prose (mostly lower-case). An Arrangement of
 * Sections entry for the LAST section absorbs the following schedule LIST — all
 * caps names and markers — into its "body". Distinguishing them by case lets the
 * segmenter ignore the arrangement stub instead of flagging the real provision
 * as conflicting with it. Schedules (genuine tables) are handled separately.
 */
function looksLikeProse(normalizedBody: string): boolean {
  const letters = normalizedBody.replace(/[^A-Za-z]/g, '');
  if (letters.length < 20) return false;
  const lower = letters.replace(/[^a-z]/g, '').length;
  return lower / letters.length > 0.5;
}

/** A schedule body that looks like a tariff/customs table. */
function looksLikeTable(body: string): boolean {
  const lines = body.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 5) return false;
  const tariffish = lines.filter((l) =>
    /\d{2}\.\d{2}|\d{4}\.\d{4}|Heading|Subheading|TARIFF/i.test(l),
  );
  return tariffish.length >= 3;
}

interface Occurrence {
  reference: string;
  headingText: string;
  headingLine: string;
  body: string;
  part: string | null;
  isSchedule: boolean;
}

/** Collect every heading occurrence (sections + schedules) with its body and Part context. */
function collectOccurrences(lines: readonly string[]): Occurrence[] {
  // Index heading positions.
  interface H {
    index: number;
    reference: string;
    text: string;
    line: string;
    isSchedule: boolean;
  }
  const headings: H[] = [];
  let currentPart: string | null = null;
  const partAt = new Map<number, string | null>();
  // Once inside a Schedule, numbered lines are schedule paragraphs, not
  // sections — so "1. Composition of Tribunal" (a schedule paragraph) is not
  // confused with section 1. Schedules are kept whole as one chunk each.
  let inSchedule = false;

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (PART_HEADING.test(line)) {
      currentPart = trimmed;
    }
    partAt.set(i, currentPart);
    const sched = SCHEDULE_HEADING.exec(trimmed);
    if (sched && sched[1]) {
      inSchedule = true;
      headings.push({
        index: i,
        reference: sched[1].trim(),
        text: sched[1].trim(),
        line: line.trim(),
        isSchedule: true,
      });
      return;
    }
    if (inSchedule) return; // schedule-internal numbering stays in the schedule body
    const sec = SECTION_HEADING.exec(line);
    if (sec && sec[1] && sec[2]) {
      headings.push({
        index: i,
        reference: `section ${sec[1]}`,
        text: sec[2],
        line: line.trim(),
        isSchedule: false,
      });
    }
  });

  const out: Occurrence[] = [];
  for (let h = 0; h < headings.length; h += 1) {
    const cur = headings[h]!;
    const next = h + 1 < headings.length ? headings[h + 1]!.index : lines.length;
    const body = lines
      .slice(cur.index + 1, next)
      .join('\n')
      .trim();
    if (body.length === 0) continue;
    out.push({
      reference: cur.reference,
      headingText: cur.text,
      headingLine: cur.line,
      body,
      part: partAt.get(cur.index) ?? null,
      isSchedule: cur.isSchedule,
    });
  }
  return out;
}

/**
 * Segment one instrument's `-raw` extracted text into first-pass draft chunks.
 * Returns `needs_manual_segmentation` when nothing could be emitted.
 */
export function segmentLegalText(text: string, opts: SegmentOptions): SegmentResult {
  const { lines, runningTitle, dropped } = cleanupRawText(text);
  const occurrences = collectOccurrences(lines);

  const quality: SegmentQuality = {
    runningTitle,
    linesDropped: dropped,
    sectionsEmitted: 0,
    schedulesEmitted: 0,
    amendingChunks: 0,
    flagged: [],
    maxBodyDoublingRatio: 0,
  };

  // Group occurrences by canonical provision id (falls back to display ref when
  // it will not canonicalise, e.g. a schedule name we keep verbatim).
  const groups = new Map<string, Occurrence[]>();
  for (const occ of occurrences) {
    const key = toCanonicalProvisionId(occ.reference) ?? `raw:${occ.reference.toLowerCase()}`;
    const list = groups.get(key) ?? [];
    list.push(occ);
    groups.set(key, list);
  }

  const chunks: SegmentedChunk[] = [];
  for (const [, occs] of groups) {
    // Collapse copies. Prefer a prose body (a real provision) over an
    // Arrangement-of-Sections stub, then keep the longest (which recovers
    // cross-page continuation). For a schedule, prose-preference is a no-op.
    const proseScore = (o: Occurrence) =>
      !o.isSchedule && looksLikeProse(normalizeBody(o.body)) ? 1 : 0;
    const sorted = [...occs].sort(
      (a, b) => proseScore(b) - proseScore(a) || b.body.length - a.body.length,
    );
    const chosen = sorted[0]!;
    const longestNorm = normalizeBody(chosen.body);
    const chosenIsProse = proseScore(chosen) === 1;

    // Every SUBSTANTIAL copy must be a consistent prefix of the longest. A copy
    // that is not is either corruption or two different provisions sharing a
    // number: fail closed for this provision. Short copies are treated as
    // Arrangement-of-Sections stubs (a section number followed by its short
    // title, no body) and ignored — they are not evidence of a conflict.
    const substantialThreshold = Math.max(120, longestNorm.length * 0.5);
    let consistent = true;
    for (const other of sorted.slice(1)) {
      const n = normalizeBody(other.body);
      if (n.length < substantialThreshold) continue;
      // When the chosen body is prose, a non-prose copy is an Arrangement stub,
      // not a conflicting version of the provision — ignore it.
      if (chosenIsProse && !other.isSchedule && !looksLikeProse(n)) continue;
      if (longestNorm.startsWith(n) || longestNorm.includes(n)) continue;
      // A shorter copy is a truncated view of the same page; a page-artifact line
      // (running header / enacting formula / footer) can leak in at its cut point.
      // Treat it as consistent when its leading 90% is contained in the longest —
      // shared content agrees, only the trailing cut differs. A genuinely
      // different provision sharing a number diverges from the very start and is
      // still caught.
      const head = n.slice(0, Math.floor(n.length * 0.9));
      if (head.length >= substantialThreshold && longestNorm.includes(head)) continue;
      consistent = false;
      break;
    }
    if (!consistent) {
      quality.flagged.push({
        reference: chosen.reference,
        reason: 'Multiple copies of this provision have inconsistent text; kept for human review.',
      });
      continue;
    }

    // Residual corruption check.
    const worstDoubling = Math.max(0, ...chosen.body.split('\n').map((l) => doublingRatio(l)));
    quality.maxBodyDoublingRatio = Math.max(quality.maxBodyDoublingRatio, worstDoubling);
    if (worstDoubling > BODY_DOUBLING_THRESHOLD) {
      quality.flagged.push({
        reference: chosen.reference,
        reason: `Body still shows the doubled-glyph artifact (ratio ${worstDoubling.toFixed(2)}); kept for human review.`,
      });
      continue;
    }

    // Role + amended target.
    const isSelf = SELF_PROVISION_HEADING.test(chosen.headingText);
    let instrumentRole: DraftChunkInput['instrumentRole'] = 'substantive';
    let amendsProvision: string | null = null;
    if (opts.kind === 'amending_act' && !isSelf && !chosen.isSchedule) {
      // Derive the amended target from whichever page-copy heading actually
      // parses — the bold overlay can truncate a heading in one copy ("Amendment
      // of s") while another copy carries it in full.
      const amended = occs
        .map((o) => amendedProvisionFrom(o.headingText))
        .find((a): a is string => a !== null && toCanonicalProvisionId(a) !== null);
      if (!amended) {
        quality.flagged.push({
          reference: chosen.reference,
          reason: `Amendment heading "${chosen.headingText}" has a target that will not canonicalise; kept for human review.`,
        });
        continue;
      }
      instrumentRole = 'amending_instruction';
      amendsProvision = amended;
    } else if (opts.kind === 'amending_act' && !isSelf && chosen.isSchedule) {
      // A schedule inserted/amended by an amending Act edits the base schedule.
      const amended = amendedProvisionFrom(chosen.headingText) ?? chosen.reference;
      if (toCanonicalProvisionId(amended)) {
        instrumentRole = 'amending_instruction';
        amendsProvision = amended;
      }
    }

    const containsTable = chosen.isSchedule && looksLikeTable(chosen.body);
    const keywords: string[] = [];
    if (chosen.part) keywords.push(chosen.part.replace(/\s+/g, ' '));
    if (containsTable) keywords.push('table');

    chunks.push({
      headingLine: `${chosen.reference}. ${chosen.headingText}`,
      part: chosen.part,
      copies: occs.length,
      kind: chosen.isSchedule ? 'schedule' : 'section',
      containsTable,
      draft: {
        chunkIndex: chunks.length,
        title: chosen.headingText.slice(0, 300),
        sectionReference: chosen.reference,
        body: chosen.body,
        instrumentRole,
        ...(amendsProvision ? { amendsProvision } : {}),
        ...(keywords.length ? { keywords } : {}),
      },
    });

    if (chosen.isSchedule) quality.schedulesEmitted += 1;
    else quality.sectionsEmitted += 1;
    if (instrumentRole === 'amending_instruction') quality.amendingChunks += 1;
  }

  // Stable order by chunkIndex is already assigned in emission order; re-key
  // chunkIndex to be contiguous after any skips.
  chunks.forEach((c, i) => {
    c.draft.chunkIndex = i;
  });

  if (chunks.length === 0) {
    return {
      outcome: 'needs_manual_segmentation',
      reason:
        'No provisions could be emitted from the cleaned text. The instrument may use a structure ' +
        'this segmenter does not handle (e.g. margin-numbered LRO layout) and needs manual review.',
      quality,
    };
  }

  return { outcome: 'segmented', chunks, quality };
}
