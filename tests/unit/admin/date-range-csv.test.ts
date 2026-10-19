import { describe, expect, it } from 'vitest';
import {
  EARLIEST_DATA,
  parseDateRange,
  percentChange,
  rangeQuery,
  rate,
} from '@/lib/admin/date-range';
import { csvCell, exportFilename, toCsv } from '@/lib/admin/csv';

const NOW = new Date('2026-10-19T15:30:00Z');

describe('parseDateRange', () => {
  it('defaults to the last 30 UTC days, ending today inclusive', () => {
    const r = parseDateRange({}, NOW);
    expect(r.preset).toBe('30d');
    expect(r.from.toISOString()).toBe('2026-09-20T00:00:00.000Z');
    expect(r.to.toISOString()).toBe('2026-10-20T00:00:00.000Z');
    expect(r.toDay).toBe('2026-10-19');
  });

  it.each([
    ['today', '2026-10-19T00:00:00.000Z'],
    ['7d', '2026-10-13T00:00:00.000Z'],
    ['90d', '2026-07-22T00:00:00.000Z'],
  ])('%s starts at %s', (range, from) => {
    expect(parseDateRange({ range }, NOW).from.toISOString()).toBe(from);
  });

  it('"all" starts at the earliest possible data and has no previous period', () => {
    const r = parseDateRange({ range: 'all', compare: '1' }, NOW);
    expect(r.from).toEqual(EARLIEST_DATA);
    expect(r.previous).toBeNull();
  });

  it('custom ranges are inclusive, clamped and never inverted', () => {
    const r = parseDateRange({ range: 'custom', from: '2026-10-01', to: '2026-10-05' }, NOW);
    expect(r.from.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(r.to.toISOString()).toBe('2026-10-06T00:00:00.000Z');

    const future = parseDateRange({ range: 'custom', from: '2026-10-10', to: '2030-01-01' }, NOW);
    expect(future.to.toISOString()).toBe('2026-10-20T00:00:00.000Z');

    const inverted = parseDateRange({ range: 'custom', from: '2026-10-10', to: '2026-10-01' }, NOW);
    expect(inverted.to > inverted.from).toBe(true);

    const garbage = parseDateRange({ range: 'custom', from: "'; drop", to: 'x' }, NOW);
    expect(garbage.to > garbage.from).toBe(true);
  });

  it('the previous period is the same length immediately before', () => {
    const r = parseDateRange({ range: '7d', compare: '1' }, NOW);
    expect(r.compare).toBe(true);
    expect(r.previous!.to).toEqual(r.from);
    expect(r.previous!.to.getTime() - r.previous!.from.getTime()).toBe(
      r.to.getTime() - r.from.getTime(),
    );
  });

  it('an unknown preset falls back to 30 days', () => {
    expect(parseDateRange({ range: 'forever' }, NOW).preset).toBe('30d');
  });

  it('round-trips through the query string', () => {
    const r = parseDateRange(
      { range: 'custom', from: '2026-10-01', to: '2026-10-05', compare: '1' },
      NOW,
    );
    expect(rangeQuery(r)).toBe('range=custom&from=2026-10-01&to=2026-10-05&compare=1');
  });
});

describe('rates', () => {
  it('returns null instead of dividing by zero', () => {
    expect(rate(3, 0)).toBeNull();
    expect(rate(1, 4)).toBe(25);
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(15, 10)).toBe(50);
    expect(percentChange(5, null)).toBeNull();
  });
});

describe('CSV', () => {
  it.each(['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)', '\tcmd', '\rcmd'])(
    'neutralises formula injection in %j',
    (value) => {
      expect(csvCell(value).startsWith(`"'`)).toBe(true);
    },
  );

  it('quotes every cell and escapes quotes', () => {
    expect(csvCell('He said "hi", then left')).toBe('"He said ""hi"", then left"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(-5)).toBe('"-5"'); // numbers are data, not formulas
  });

  it('writes a BOM, a commented preamble, a header and CRLF rows', () => {
    const csv = toCsv(['A', 'B'], [[1, 'x']], ['Range 2026-10-01 – 2026-10-05']);
    expect(csv.startsWith('﻿"# Range 2026-10-01 – 2026-10-05"\r\n"A","B"\r\n"1","x"\r\n')).toBe(
      true,
    );
  });

  it('names files with the report and a UTC timestamp', () => {
    expect(exportFilename('waitlist', new Date('2026-10-19T15:30:12Z'))).toBe(
      'islanda-waitlist-20261019-1530Z.csv',
    );
  });
});
