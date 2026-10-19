/**
 * CSV writing for admin exports. Pure and unit-tested.
 *
 * Formula injection: a cell beginning with = + - @ (or a tab / carriage
 * return) can be executed as a formula by spreadsheet software. Such cells are
 * prefixed with a single quote, which spreadsheets display as text. Every cell
 * is then quoted per RFC 4180.
 */

export type Cell = string | number | boolean | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return '""';
  let text = typeof value === 'string' ? value : String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: Cell[][], preamble: string[] = []): string {
  const lines = [
    ...preamble.map((line) => csvCell(`# ${line}`)),
    header.map(csvCell).join(','),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ];
  // BOM so Excel opens UTF-8 (accents, en dashes) correctly.
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** islanda-<report>-<YYYYMMDD-HHmm>Z.csv */
export function exportFilename(report: string, now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '-');
  return `islanda-${report}-${stamp}Z.csv`;
}
