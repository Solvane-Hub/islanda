'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Sparkles, Target } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ProvenanceBadge, type ProvenanceKind } from '@/components/ui/provenance-badge';
import { WorkspaceSurface, SurfaceLabel } from '@/components/ui/workspace-surface';
import { GOAL_TYPES, METRIC_KEYS } from '@/lib/validation/business-intelligence';
import { GOAL_TYPE_LABELS } from '@/lib/business-intelligence/goal-display';
import { createGoalAction } from '../actions';

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

/** A serializable goal projection with derived progress. */
export interface GoalItem {
  id: string;
  title: string;
  typeLabel: string;
  statusLabel: string;
  targetLabel: string | null;
  percent: number | null;
  currentLabel: string | null;
  currentProvenanceKind: ProvenanceKind | null;
  /** A self-contained regulatory question Nova can answer, or null. */
  novaQuestion: string | null;
}

export function GoalsModule({ items }: { items: readonly GoalItem[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>(undefined);

  // Manual submit (not useActionState) so success closes the form and refreshes
  // in the same event handler — no setState inside an effect.
  async function onSubmit(formData: FormData) {
    setPending(true);
    setFormError(null);
    setFieldErrors(undefined);
    const res = await createGoalAction(null, formData);
    setPending(false);
    if (res.ok) {
      setShowForm(false);
      router.refresh();
    } else if (res.fieldErrors) {
      setFieldErrors(res.fieldErrors);
    } else {
      setFormError(res.message);
    }
  }

  const err = (n: string) => fieldErrors?.[n]?.[0];

  return (
    <WorkspaceSurface as="section" tone="shell" className="flex flex-col gap-6 p-6 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Target aria-hidden="true" className="text-champagne size-3.5" strokeWidth={2} />
          <SurfaceLabel as="h2">Goals</SurfaceLabel>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="text-bahama-turquoise hover:text-on-ink inline-flex items-center gap-1.5 rounded-sm text-xs font-medium transition-colors duration-150"
        >
          <Plus aria-hidden="true" className="size-3.5" strokeWidth={2} />
          Set a goal
        </button>
      </div>

      {items.length > 0 ? (
        <ul className="flex flex-col divide-y divide-white/8">
          {items.map((goal) => (
            <li key={goal.id} className="flex flex-col gap-2.5 py-4 first:pt-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-on-ink text-sm font-medium text-pretty">{goal.title}</span>
                <span className="text-on-glass-subtle text-2xs tracking-[0.08em] uppercase">
                  {goal.typeLabel} · {goal.statusLabel}
                </span>
              </div>

              {goal.percent !== null ? (
                <Progress
                  value={goal.percent}
                  label={`Progress toward ${goal.title}`}
                  caption={
                    goal.currentLabel && goal.targetLabel
                      ? `${goal.currentLabel} of ${goal.targetLabel}`
                      : (goal.targetLabel ?? undefined)
                  }
                />
              ) : (
                <p className="text-on-ink-muted text-xs">
                  {goal.targetLabel ? `Target: ${goal.targetLabel}. ` : ''}Not yet measured — record
                  a matching figure and progress will appear here.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {goal.currentProvenanceKind ? (
                  <ProvenanceBadge kind={goal.currentProvenanceKind} />
                ) : null}
                {goal.novaQuestion ? (
                  <Link
                    href={`/assistant?q=${encodeURIComponent(goal.novaQuestion)}`}
                    className="text-bahama-turquoise hover:text-on-ink inline-flex items-center gap-1.5 text-xs font-medium"
                  >
                    <Sparkles aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                    Ask Nova
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : !showForm ? (
        <p className="text-on-ink-muted max-w-prose text-sm text-pretty">
          Set what the business is working toward — a revenue target, a launch, a licence. Goals
          become the anchors for planning and progress.
        </p>
      ) : null}

      {showForm ? (
        <form action={onSubmit} className="flex flex-col gap-4 border-t border-white/8 pt-5">
          {formError ? <Alert tone="error">{formError}</Alert> : null}

          <Field id="goal-title" label="Goal" error={err('title')}>
            {(aria) => (
              <Input
                {...aria}
                name="title"
                placeholder="e.g. Reach $250k annual revenue"
                required
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="goalType" label="Type" error={err('goalType')}>
              {(aria) => (
                <Select {...aria} name="goalType" defaultValue="revenue_target">
                  {GOAL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {GOAL_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field id="targetMetricKey" label="Measured by" optional error={err('targetMetricKey')}>
              {(aria) => (
                <Select {...aria} name="targetMetricKey" defaultValue="">
                  <option value="">Not measured by a metric</option>
                  {METRIC_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {METRIC_LABELS[k]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field id="targetValue" label="Target value" optional error={err('targetValue')}>
              {(aria) => <Input {...aria} name="targetValue" inputMode="decimal" />}
            </Field>

            <Field id="targetDate" label="Target date" optional error={err('targetDate')}>
              {(aria) => <Input {...aria} name="targetDate" type="date" />}
            </Field>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" loading={pending} size="sm" className="w-fit">
              Save goal
            </Button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-on-ink-muted hover:text-on-ink text-xs"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </WorkspaceSurface>
  );
}
