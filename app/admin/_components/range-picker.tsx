import { buttonVariants } from '@/components/ui/button';
import { RANGE_PRESETS, type DateRange } from '@/lib/admin/date-range';

/**
 * Date-range filter. A plain GET form — the range lives in the URL, so a view
 * can be bookmarked or shared between the two administrators, and works
 * without JavaScript.
 */
export function RangePicker({
  action,
  range,
  showCompare = true,
  hidden = {},
}: {
  action: string;
  range: DateRange;
  showCompare?: boolean;
  hidden?: Record<string, string>;
}) {
  return (
    <form
      method="get"
      action={action}
      aria-label="Date range"
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/12 p-3 sm:p-4"
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-foreground-muted font-medium">Range</span>
        <select
          name="range"
          defaultValue={range.preset}
          className="border-border-control bg-surface text-foreground h-10 rounded-lg border px-3 text-sm"
        >
          {RANGE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-foreground-muted font-medium">From (custom, UTC)</span>
        <input
          type="date"
          name="from"
          defaultValue={range.fromDay}
          className="border-border-control bg-surface text-foreground h-10 rounded-lg border px-3 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-foreground-muted font-medium">To (custom, UTC)</span>
        <input
          type="date"
          name="to"
          defaultValue={range.toDay}
          className="border-border-control bg-surface text-foreground h-10 rounded-lg border px-3 text-sm"
        />
      </label>
      {showCompare ? (
        <label className="text-foreground inline-flex min-h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="compare"
            value="1"
            defaultChecked={range.compare}
            className="size-4"
          />
          Compare with previous period
        </label>
      ) : null}
      <button type="submit" className={buttonVariants({ size: 'sm' })}>
        Apply
      </button>
      <p className="text-foreground-muted w-full text-xs">
        Showing {range.label}.
        {range.compare && !range.previous ? ' No earlier period is available to compare with.' : ''}
      </p>
    </form>
  );
}
