'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { METRIC_KEYS } from '@/lib/validation/business-intelligence';
import { recordFigureAction } from '../actions';

const METRIC_LABELS: Record<(typeof METRIC_KEYS)[number], string> = {
  revenue: 'Revenue',
  expenses: 'Expenses',
  net_profit: 'Net profit',
  gross_margin: 'Gross margin',
  cash_flow: 'Cash flow',
  sales_count: 'Sales count',
  customer_count: 'Customer count',
  other: 'Other',
};

type PeriodType = 'quarter' | 'month' | 'year' | 'custom';

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (year: number, month: number) => new Date(year, month, 0).getDate();

/** Compute a period's start/end from the lightweight picker inputs. */
function computeRange(
  type: PeriodType,
  v: { year: number; quarter: number; month: string; customStart: string; customEnd: string },
): { periodStart: string; periodEnd: string } | null {
  if (type === 'year') return { periodStart: `${v.year}-01-01`, periodEnd: `${v.year}-12-31` };
  if (type === 'quarter') {
    const sm = (v.quarter - 1) * 3 + 1;
    const em = sm + 2;
    return {
      periodStart: `${v.year}-${pad(sm)}-01`,
      periodEnd: `${v.year}-${pad(em)}-${pad(lastDay(v.year, em))}`,
    };
  }
  if (type === 'month') {
    if (!/^\d{4}-\d{2}$/.test(v.month)) return null;
    const [y, m] = v.month.split('-').map(Number);
    return { periodStart: `${v.month}-01`, periodEnd: `${v.month}-${pad(lastDay(y!, m!))}` };
  }
  if (v.customStart && v.customEnd) return { periodStart: v.customStart, periodEnd: v.customEnd };
  return null;
}

export function RecordFigure({
  periods,
  documents,
}: {
  periods: { id: string; label: string }[];
  documents: { id: string; title: string }[];
}) {
  const router = useRouter();
  const thisYear = new Date().getFullYear();

  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>(undefined);

  // Period selection.
  const [periodChoice, setPeriodChoice] = useState<string>(periods[0]?.id ?? '__new__');
  const [periodType, setPeriodType] = useState<PeriodType>('quarter');
  const [year, setYear] = useState(thisYear);
  const [quarter, setQuarter] = useState(1);
  const [month, setMonth] = useState(`${thisYear}-01`);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Figure.
  const [metricKey, setMetricKey] = useState<(typeof METRIC_KEYS)[number]>('revenue');
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('');
  const [sourceDocumentId, setSourceDocumentId] = useState('');

  const isNewPeriod = periodChoice === '__new__';
  const err = (n: string) => fieldErrors?.[n]?.[0];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors(undefined);

    const input: Parameters<typeof recordFigureAction>[0] = {
      metricKey,
      value,
      ...(metricKey === 'other' && label ? { label } : {}),
      ...(sourceDocumentId ? { sourceDocumentId } : {}),
    };

    if (isNewPeriod) {
      const range = computeRange(periodType, { year, quarter, month, customStart, customEnd });
      if (!range) {
        setFormError('Choose a valid period.');
        return;
      }
      input.periodType = periodType;
      input.periodStart = range.periodStart;
      input.periodEnd = range.periodEnd;
    } else {
      input.financialPeriodId = periodChoice;
    }

    setPending(true);
    const res = await recordFigureAction(input);
    setPending(false);
    if (res.ok) {
      setOpen(false);
      setValue('');
      setLabel('');
      setSourceDocumentId('');
      router.refresh();
    } else if (res.fieldErrors) {
      setFieldErrors(res.fieldErrors);
    } else {
      setFormError(res.message);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-bahama-turquoise hover:text-on-ink inline-flex w-fit items-center gap-1.5 rounded-sm text-xs font-medium transition-colors duration-150"
      >
        <Plus aria-hidden="true" className="size-3.5" strokeWidth={2} />
        Record a figure
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 border-t border-white/8 pt-5">
      {formError ? <Alert tone="error">{formError}</Alert> : null}

      {/* Period */}
      <Field id="rf-period" label="Period" error={err('financialPeriodId')}>
        {(aria) => (
          <Select {...aria} value={periodChoice} onChange={(e) => setPeriodChoice(e.target.value)}>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            <option value="__new__">＋ New period</option>
          </Select>
        )}
      </Field>

      {isNewPeriod ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="rf-period-type" label="Period type">
            {(aria) => (
              <Select
                {...aria}
                value={periodType}
                onChange={(e) => setPeriodType(e.target.value as PeriodType)}
              >
                <option value="quarter">Quarter</option>
                <option value="month">Month</option>
                <option value="year">Year</option>
                <option value="custom">Custom</option>
              </Select>
            )}
          </Field>

          {periodType === 'quarter' ? (
            <>
              <Field id="rf-quarter" label="Quarter">
                {(aria) => (
                  <Select
                    {...aria}
                    value={quarter}
                    onChange={(e) => setQuarter(Number(e.target.value))}
                  >
                    <option value={1}>Q1</option>
                    <option value={2}>Q2</option>
                    <option value={3}>Q3</option>
                    <option value={4}>Q4</option>
                  </Select>
                )}
              </Field>
              <Field id="rf-year" label="Year">
                {(aria) => (
                  <Input
                    {...aria}
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                  />
                )}
              </Field>
            </>
          ) : null}

          {periodType === 'year' ? (
            <Field id="rf-year" label="Year">
              {(aria) => (
                <Input
                  {...aria}
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                />
              )}
            </Field>
          ) : null}

          {periodType === 'month' ? (
            <Field id="rf-month" label="Month">
              {(aria) => (
                <Input
                  {...aria}
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              )}
            </Field>
          ) : null}

          {periodType === 'custom' ? (
            <>
              <Field id="rf-start" label="Start">
                {(aria) => (
                  <Input
                    {...aria}
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                )}
              </Field>
              <Field id="rf-end" label="End">
                {(aria) => (
                  <Input
                    {...aria}
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                )}
              </Field>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Figure */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="rf-metric" label="Metric" error={err('metricKey')}>
          {(aria) => (
            <Select
              {...aria}
              value={metricKey}
              onChange={(e) => setMetricKey(e.target.value as (typeof METRIC_KEYS)[number])}
            >
              {METRIC_KEYS.map((k) => (
                <option key={k} value={k}>
                  {METRIC_LABELS[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          id="rf-value"
          label={metricKey === 'gross_margin' ? 'Amount (%)' : 'Amount'}
          error={err('value')}
        >
          {(aria) => (
            <Input
              {...aria}
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          )}
        </Field>

        {metricKey === 'other' ? (
          <Field id="rf-label" label="Metric name" error={err('label')}>
            {(aria) => <Input {...aria} value={label} onChange={(e) => setLabel(e.target.value)} />}
          </Field>
        ) : null}

        {documents.length > 0 ? (
          <Field id="rf-doc" label="Supporting document" optional>
            {(aria) => (
              <Select
                {...aria}
                value={sourceDocumentId}
                onChange={(e) => setSourceDocumentId(e.target.value)}
              >
                <option value="">None</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}
      </div>

      <p className="text-on-glass-subtle text-2xs">
        Source:{' '}
        <span className="text-on-ink-muted">
          {sourceDocumentId ? 'From uploaded document' : 'Founder provided'}
        </span>{' '}
        · not independently verified.
      </p>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending} size="sm" className="w-fit">
          Save figure
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-on-ink-muted hover:text-on-ink text-xs"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
