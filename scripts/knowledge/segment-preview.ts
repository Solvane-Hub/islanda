import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { BAHAMAS_MANIFEST } from '@/services/knowledge/manifests/bahamas';
import { segmentLegalText, type InstrumentKind } from '@/services/knowledge/segmentation';
import { draftChunkSchema } from '@/lib/validation/knowledge';

/**
 * Run the v2 segmenter over the `-raw` extracted BS corpus and emit a REVIEWABLE
 * preview — per-source draft chunks plus quality metrics — for the human-review
 * step. Reads `.corpus/bs/*.raw.txt` (produced by extract-raw.ts); writes only
 * under `.corpus/` (gitignored). No database writes, no publication.
 *
 * Usage:  tsx scripts/knowledge/segment-preview.ts
 */

const dir = resolve(process.cwd(), '.corpus', 'bs');

interface Row {
  manifestId: string;
  kind: InstrumentKind;
  outcome: string;
  sections: number;
  schedules: number;
  amending: number;
  flagged: number;
  ingestionValid: number;
  linesDropped: number;
  note: string;
}

const rows: Row[] = [];

for (const entry of BAHAMAS_MANIFEST.entries) {
  const txtPath = resolve(dir, `${entry.manifestId}.raw.txt`);
  const kind: InstrumentKind = entry.amends !== null ? 'amending_act' : 'substantive_act';

  if (!existsSync(txtPath)) {
    rows.push({
      manifestId: entry.manifestId,
      kind,
      outcome: 'MISSING_RAW',
      sections: 0,
      schedules: 0,
      amending: 0,
      flagged: 0,
      ingestionValid: 0,
      linesDropped: 0,
      note: 'No .raw.txt — run extract-raw.ts.',
    });
    continue;
  }

  const result = segmentLegalText(readFileSync(txtPath, 'utf8'), { kind });

  if (result.outcome === 'needs_manual_segmentation') {
    rows.push({
      manifestId: entry.manifestId,
      kind,
      outcome: 'NEEDS_MANUAL',
      sections: result.quality.sectionsEmitted,
      schedules: result.quality.schedulesEmitted,
      amending: result.quality.amendingChunks,
      flagged: result.quality.flagged.length,
      ingestionValid: 0,
      linesDropped: result.quality.linesDropped,
      note: result.reason,
    });
    continue;
  }

  const ingestionValid = result.chunks.filter(
    (c) => draftChunkSchema.safeParse(c.draft).success,
  ).length;

  writeFileSync(
    resolve(dir, `${entry.manifestId}.segment-preview.json`),
    JSON.stringify(
      {
        manifestId: entry.manifestId,
        kind,
        quality: result.quality,
        chunks: result.chunks.map((c) => ({
          headingLine: c.headingLine,
          sectionReference: c.draft.sectionReference,
          kind: c.kind,
          part: c.part,
          copies: c.copies,
          containsTable: c.containsTable,
          instrumentRole: c.draft.instrumentRole,
          amendsProvision: c.draft.amendsProvision ?? null,
          bodyChars: c.draft.body.length,
          bodyPreview: c.draft.body.slice(0, 160),
        })),
      },
      null,
      2,
    ),
  );

  rows.push({
    manifestId: entry.manifestId,
    kind,
    outcome: 'SEGMENTED',
    sections: result.quality.sectionsEmitted,
    schedules: result.quality.schedulesEmitted,
    amending: result.quality.amendingChunks,
    flagged: result.quality.flagged.length,
    ingestionValid,
    linesDropped: result.quality.linesDropped,
    note: ingestionValid === result.chunks.length ? '' : 'Some drafts fail the ingestion schema.',
  });
}

writeFileSync(resolve(dir, '_segment-preview-report.json'), JSON.stringify(rows, null, 2));

console.log('\nBS segmentation preview v2 (raw extraction + provision dedup):\n');
console.log(
  '  MANIFEST ID'.padEnd(34) +
    'OUTCOME'.padEnd(14) +
    'SEC'.padStart(5) +
    'SCH'.padStart(5) +
    'AMD'.padStart(5) +
    'FLAG'.padStart(6),
);
for (const r of rows) {
  console.log(
    `  ${r.manifestId}`.padEnd(34) +
      r.outcome.padEnd(14) +
      String(r.sections).padStart(5) +
      String(r.schedules).padStart(5) +
      String(r.amending).padStart(5) +
      String(r.flagged).padStart(6),
  );
  if (r.note) console.log(`      ↳ ${r.note}`);
}
console.log('\n  Previews: .corpus/bs/<id>.segment-preview.json\n');
