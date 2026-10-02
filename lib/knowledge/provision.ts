/**
 * Canonical provision identifiers.
 *
 * Amendment matching used to compare display strings after lowercasing and
 * whitespace collapsing. That works for `'Section 56'` vs `'section 56'` and
 * fails for everything else a real chunker emits: `'s. 56'`, `'Section 56(1)'`,
 * `'Second Schedule'` vs `'Schedule 2'`.
 *
 * The failure is silent and unsafe. An amendment that repeals and replaces
 * section 56 would not attach to a chunk labelled `'Section 56(1)'`, so the
 * founder would be shown repealed text with no caveat.
 *
 * ⚠ Two rules this module exists to keep straight:
 *
 *   • **`56A` is NOT `56`.** A trailing letter is part of the section number —
 *     sections 38K, 47C and 56A are provisions *inserted* by an amending Act and
 *     are entirely distinct from 38, 47 and 56.
 *   • **`56(1)` IS part of `56`.** A subdivision belongs to its parent, so an
 *     amendment to either must attach to the other.
 *
 * Nothing here guesses. A display string that cannot be parsed returns `null`,
 * which callers must treat as "unknown provision" rather than "no amendments".
 */

export type ProvisionKind = 'section' | 'schedule' | 'part' | 'regulation' | 'rule' | 'article';

export interface ProvisionRef {
  kind: ProvisionKind;
  /** '6', '56', '96A'. Letters are significant and are upper-cased. */
  number: string;
  /** Subdivisions, outermost first: `56(1)(a)` → `['1', 'a']`. */
  subdivisions: readonly string[];
}

/** Ordinal schedule names. English only, which is a property of the drafting convention. */
const ORDINALS: Readonly<Record<string, string>> = Object.freeze({
  first: '1',
  second: '2',
  third: '3',
  fourth: '4',
  fifth: '5',
  sixth: '6',
  seventh: '7',
  eighth: '8',
  ninth: '9',
  tenth: '10',
  eleventh: '11',
  twelfth: '12',
});

const PREFIXES: Readonly<Record<ProvisionKind, string>> = Object.freeze({
  section: 's.',
  schedule: 'sch.',
  part: 'pt.',
  regulation: 'reg.',
  rule: 'r.',
  article: 'art.',
});

/** Trailing `(1)(a)` groups. */
const SUBDIVISION = /\(\s*([^)\s]+)\s*\)/g;

const PATTERNS: readonly { kind: ProvisionKind; re: RegExp }[] = [
  { kind: 'section', re: /^s(?:ec(?:t(?:ion)?)?)?\.?\s*(\d+[A-Za-z]*)\s*(.*)$/i },
  { kind: 'schedule', re: /^sch(?:ed(?:ule)?)?\.?\s*(\d+[A-Za-z]*)\s*(.*)$/i },
  { kind: 'regulation', re: /^reg(?:ulation)?\.?\s*(\d+[A-Za-z]*)\s*(.*)$/i },
  { kind: 'rule', re: /^r(?:ule)?\.?\s*(\d+[A-Za-z]*)\s*(.*)$/i },
  { kind: 'article', re: /^art(?:icle)?\.?\s*(\d+[A-Za-z]*)\s*(.*)$/i },
  { kind: 'part', re: /^p(?:ar)?t\.?\s*([IVXLCDM]+|\d+)\s*(.*)$/i },
];

/** `Second Schedule`, `Fourth Schedule`. */
const ORDINAL_SCHEDULE = /^(\w+)\s+schedule$/i;

function parseSubdivisions(tail: string): string[] {
  const out: string[] = [];
  for (const m of tail.matchAll(SUBDIVISION)) {
    const value = m[1];
    if (value) out.push(value.toLowerCase());
  }
  return out;
}

/**
 * Parse a display reference into a canonical structure.
 *
 * Returns `null` when the string cannot be parsed — including for a bare number
 * like `'56'`. A bare number could be a section, a schedule item or a page, and
 * guessing which is exactly the kind of inference that produces a confidently
 * wrong amendment match.
 */
export function parseProvision(display: string | null | undefined): ProvisionRef | null {
  if (!display) return null;
  const trimmed = display.trim();
  if (trimmed.length === 0) return null;

  const ordinal = ORDINAL_SCHEDULE.exec(trimmed);
  if (ordinal) {
    const number = ORDINALS[(ordinal[1] ?? '').toLowerCase()];
    if (!number) return null;
    return { kind: 'schedule', number, subdivisions: [] };
  }

  for (const { kind, re } of PATTERNS) {
    const m = re.exec(trimmed);
    if (!m) continue;

    const rawNumber = m[1];
    if (!rawNumber) continue;

    const number = kind === 'part' ? rawNumber.toUpperCase() : rawNumber.toUpperCase();
    return { kind, number, subdivisions: parseSubdivisions(m[2] ?? '') };
  }

  return null;
}

/** The stable identifier stored on a chunk and referenced by a manifest. */
export function canonicalProvisionId(ref: ProvisionRef): string {
  const subs = ref.subdivisions.map((s) => `(${s})`).join('');
  return `${PREFIXES[ref.kind]}${ref.number}${subs}`;
}

/** Parse and canonicalise in one step. `null` when unparseable. */
export function toCanonicalProvisionId(display: string | null | undefined): string | null {
  const ref = parseProvision(display);
  return ref ? canonicalProvisionId(ref) : null;
}

/** The containing provision, or `null` at the top of the tree. */
export function parentProvision(ref: ProvisionRef): ProvisionRef | null {
  if (ref.subdivisions.length === 0) return null;
  return { kind: ref.kind, number: ref.number, subdivisions: ref.subdivisions.slice(0, -1) };
}

/** Every ancestor including the ref itself, innermost first. */
export function provisionLineage(ref: ProvisionRef): ProvisionRef[] {
  const lineage: ProvisionRef[] = [ref];
  let current = parentProvision(ref);
  while (current) {
    lineage.push(current);
    current = parentProvision(current);
  }
  return lineage;
}

/**
 * Does an amendment to `amended` bear on a chunk covering `retrieved`?
 *
 * True when the two are the same provision, or when either contains the other:
 *
 *   • amendment to `s.56`, chunk is `s.56(1)`  → yes, the subsection is inside
 *     the amended section;
 *   • amendment to `s.56(1)`, chunk is `s.56`  → yes, the section's text
 *     contains the amended subsection.
 *
 * Both directions matter, and only one of them is obvious.
 *
 * `s.56` and `s.56A` never match: different sections, and the second usually
 * exists *because* an amending Act inserted it.
 */
export function provisionMatches(amended: ProvisionRef, retrieved: ProvisionRef): boolean {
  if (amended.kind !== retrieved.kind || amended.number !== retrieved.number) return false;

  const shorter =
    amended.subdivisions.length <= retrieved.subdivisions.length ? amended : retrieved;
  const longer = shorter === amended ? retrieved : amended;

  return shorter.subdivisions.every((s, i) => longer.subdivisions[i] === s);
}

/** Convenience over display strings. Unparseable input never matches. */
export function provisionIdMatches(
  amendedId: string | null | undefined,
  retrievedId: string | null | undefined,
): boolean {
  const a = parseProvision(amendedId);
  const b = parseProvision(retrievedId);
  if (!a || !b) return false;
  return provisionMatches(a, b);
}
