import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BAHAMAS_MANIFEST } from '@/services/knowledge/manifests/bahamas';

/**
 * Second extraction pass: `pdftotext -raw` alongside the preserved `-layout`
 * original.
 *
 * ## Why a second mode
 *
 * Several Bahamas Gazette / LRO PDFs draw each page's text 2–3 times with a tiny
 * offset to fake a bold weight. `-layout` places those overlapping runs on the
 * same line and interleaves them character by character — producing artifacts
 * like `SeAcmtioennd2mof…` (two runs of *different* text) and `SShhoorrtt`
 * (two runs of the *same* text). This is not recoverable from the `-layout`
 * output.
 *
 * `-raw` emits text in content-stream order instead of by position, so the
 * overlapping runs come out as clean, separate lines. The only residue is whole
 * repeated copies of each page, which is collapsed deterministically downstream
 * at the provision/chunk level (identical copies merge; copies that differ fail
 * closed). See `services/knowledge/segmentation.ts`.
 *
 * The `-layout` `.txt` is kept as the provenance original; this writes `.raw.txt`
 * for segmentation and records the method + hash. Reads cached `.pdf` files only
 * — it does not re-download. Writes under `.corpus/` (gitignored).
 *
 * Usage:  tsx scripts/knowledge/extract-raw.ts
 */

const dir = resolve(process.cwd(), '.corpus', 'bs');

interface RawRecord {
  manifestId: string;
  extractionMethod: 'pdftotext -raw -enc UTF-8';
  rawChars: number;
  rawSha256: string;
  extractedAt: string;
}

const records: RawRecord[] = [];

for (const entry of BAHAMAS_MANIFEST.entries) {
  const pdfPath = resolve(dir, `${entry.manifestId}.pdf`);
  if (!existsSync(pdfPath)) {
    console.error(`  ✗ ${entry.manifestId}: no cached PDF — run acquire-sources.ts first`);
    continue;
  }
  const raw = execFileSync('pdftotext', ['-raw', '-enc', 'UTF-8', pdfPath, '-'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  writeFileSync(resolve(dir, `${entry.manifestId}.raw.txt`), raw);
  const record: RawRecord = {
    manifestId: entry.manifestId,
    extractionMethod: 'pdftotext -raw -enc UTF-8',
    rawChars: raw.length,
    rawSha256: createHash('sha256').update(raw).digest('hex'),
    extractedAt: new Date().toISOString(),
  };
  records.push(record);
  writeFileSync(
    resolve(dir, `${entry.manifestId}.raw.provenance.json`),
    JSON.stringify(record, null, 2),
  );
  // Cross-check the layout original still exists (preserved for provenance).
  const layoutKept = existsSync(resolve(dir, `${entry.manifestId}.txt`));
  console.error(
    `  ✓ ${entry.manifestId.padEnd(32)} raw=${String(raw.length).padStart(7)} chars` +
      `  layout-original ${layoutKept ? 'preserved' : 'MISSING'}`,
  );
}

writeFileSync(resolve(dir, '_raw-extraction-report.json'), JSON.stringify(records, null, 2));
console.log(`\n${records.length} sources re-extracted with -raw. Layout originals preserved.\n`);
