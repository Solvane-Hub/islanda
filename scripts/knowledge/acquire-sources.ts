import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BAHAMAS_MANIFEST } from '@/services/knowledge/manifests/bahamas';
import type { SourceManifest, SourceManifestEntry } from '@/services/knowledge/manifests/types';

/**
 * Acquire + extract a jurisdiction's real source material — the engineering half
 * of the knowledge pipeline that did not exist before.
 *
 *   SOURCE → RETRIEVE → HASH → EXTRACT (verbatim) → PROVENANCE
 *
 * ## ⚠ What this does and does not do
 *
 * It RETRIEVES the official documents named in the manifest and EXTRACTS their
 * text VERBATIM with `pdftotext` (Xpdf/poppler). It never rewrites, summarises,
 * paraphrases, merges or fabricates a single word — the output is exactly the
 * bytes the government published, and a SHA-256 of the PDF is recorded so any
 * later chunk can be traced to the exact file it came from.
 *
 * ## ⚠ Redistribution (G11)
 *
 * The extracted text is protected Government of The Bahamas material. It is
 * written ONLY to `.corpus/` (gitignored) for INTERNAL engineering, and is never
 * committed or published. Commercial publication is gated separately by
 * `commercial_publication_eligibility` (fail-closed 'restricted'). Retrieving a
 * document here confers no publication right.
 *
 * ## OCR
 *
 * A source whose manifest marks `textLayerPresent: false` cannot be extracted by
 * `pdftotext` and needs OCR, which is not installed here. Such sources are
 * recorded as `OCR_REQUIRED` and skipped rather than silently dropped.
 *
 * Usage:  tsx scripts/knowledge/acquire-sources.ts
 */

const FETCH_TIMEOUT_MS = 60_000;

interface AcquisitionRecord {
  manifestId: string;
  title: string;
  countryCode: string;
  canonicalUrl: string;
  accessedAt: string;
  httpStatus: number | null;
  bytes: number | null;
  sha256: string | null;
  extractionMethod: 'pdftotext -layout -enc UTF-8' | 'OCR_REQUIRED' | 'FAILED';
  textChars: number | null;
  /** Rough count of top-level `N.` section headers detected — a quality signal, not a chunk count. */
  detectedSections: number | null;
  note: string | null;
}

function corpusDir(countryCode: string): string {
  const dir = resolve(process.cwd(), '.corpus', countryCode.toLowerCase());
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Count lines that look like a top-level section header ("1. ", "12. "). Signal only. */
function countSections(text: string): number {
  let n = 0;
  for (const line of text.split('\n')) {
    if (/^\s*\d{1,3}\.\s+\S/.test(line)) n += 1;
  }
  return n;
}

async function acquire(entry: SourceManifestEntry, dir: string): Promise<AcquisitionRecord> {
  const accessedAt = new Date().toISOString();
  const base = {
    manifestId: entry.manifestId,
    title: entry.title,
    countryCode: entry.countryCode,
    canonicalUrl: entry.canonicalUrl,
    accessedAt,
  };

  if (!entry.textLayerPresent) {
    return {
      ...base,
      httpStatus: null,
      bytes: null,
      sha256: null,
      extractionMethod: 'OCR_REQUIRED',
      textChars: null,
      detectedSections: null,
      note: 'Manifest marks textLayerPresent=false. OCR is required and is not available in this environment.',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let bytes: Buffer;
  let httpStatus: number | null = null;
  try {
    const res = await fetch(entry.canonicalUrl, { signal: controller.signal });
    httpStatus = res.status;
    if (!res.ok) {
      return {
        ...base,
        httpStatus,
        bytes: null,
        sha256: null,
        extractionMethod: 'FAILED',
        textChars: null,
        detectedSections: null,
        note: `HTTP ${res.status} fetching source.`,
      };
    }
    bytes = Buffer.from(await res.arrayBuffer());
  } catch (error) {
    return {
      ...base,
      httpStatus,
      bytes: null,
      sha256: null,
      extractionMethod: 'FAILED',
      textChars: null,
      detectedSections: null,
      note: `Fetch failed: ${error instanceof Error ? error.name : 'unknown'}`,
    };
  } finally {
    clearTimeout(timeout);
  }

  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const pdfPath = resolve(dir, `${entry.manifestId}.pdf`);
  writeFileSync(pdfPath, bytes);

  let text: string;
  try {
    // Verbatim extraction to stdout. -layout preserves structure; UTF-8 keeps
    // en-dashes and section symbols intact.
    text = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', pdfPath, '-'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    return {
      ...base,
      httpStatus,
      bytes: bytes.length,
      sha256,
      extractionMethod: 'FAILED',
      textChars: null,
      detectedSections: null,
      note: `pdftotext failed: ${error instanceof Error ? error.message.slice(0, 120) : 'unknown'}`,
    };
  }

  writeFileSync(resolve(dir, `${entry.manifestId}.txt`), text);

  const record: AcquisitionRecord = {
    ...base,
    httpStatus,
    bytes: bytes.length,
    sha256,
    extractionMethod: 'pdftotext -layout -enc UTF-8',
    textChars: text.length,
    detectedSections: countSections(text),
    note: null,
  };
  writeFileSync(
    resolve(dir, `${entry.manifestId}.provenance.json`),
    JSON.stringify(record, null, 2),
  );
  return record;
}

async function run(manifest: SourceManifest): Promise<void> {
  const dir = corpusDir(manifest.countryCode);
  console.error(
    `\nAcquiring ${manifest.entries.length} sources for ${manifest.countryCode} → .corpus/${manifest.countryCode.toLowerCase()}/\n`,
  );

  const records: AcquisitionRecord[] = [];
  for (const entry of manifest.entries) {
    const rec = await acquire(entry, dir);
    records.push(rec);
    const size = rec.bytes ? `${(rec.bytes / 1024).toFixed(0)}KB` : '—';
    console.error(
      `  ${rec.extractionMethod === 'FAILED' ? '✗' : rec.extractionMethod === 'OCR_REQUIRED' ? '○' : '✓'} ` +
        `${entry.manifestId.padEnd(24)} ${size.padStart(7)}  ` +
        `${rec.detectedSections !== null ? `${rec.detectedSections} sections` : (rec.note ?? '')}`,
    );
  }

  writeFileSync(resolve(dir, '_acquisition-report.json'), JSON.stringify(records, null, 2));
  const ok = records.filter((r) => r.extractionMethod.startsWith('pdftotext')).length;
  const ocr = records.filter((r) => r.extractionMethod === 'OCR_REQUIRED').length;
  const failed = records.filter((r) => r.extractionMethod === 'FAILED').length;
  console.log(
    `\n${manifest.countryCode}: ${ok} extracted · ${ocr} OCR-required · ${failed} failed. ` +
      `Report: .corpus/${manifest.countryCode.toLowerCase()}/_acquisition-report.json\n`,
  );
}

run(BAHAMAS_MANIFEST).catch((error: unknown) => {
  console.error('\n✗ Acquisition failed:', error);
  process.exitCode = 1;
});
