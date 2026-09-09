import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/financials', () => ({
  insertFinancialPeriod: vi.fn(),
  insertMetric: vi.fn(),
  listFinancialPeriods: vi.fn(),
  listMetricsForBusiness: vi.fn(),
  listMetricsForPeriod: vi.fn(),
}));
vi.mock('@/lib/db/business-documents', () => ({
  insertBusinessDocument: vi.fn(),
  listBusinessDocuments: vi.fn(),
  findBusinessDocumentById: vi.fn(),
}));
vi.mock('@/lib/db/business-goals', () => ({
  insertBusinessGoal: vi.fn(),
  listBusinessGoals: vi.fn(),
  findBusinessGoalById: vi.fn(),
  updateBusinessGoal: vi.fn(),
}));
vi.mock('@/services/audit', () => ({ recordAuditEvent: vi.fn() }));

import { insertFinancialPeriod, insertMetric, listMetricsForBusiness } from '@/lib/db/financials';
import { insertBusinessDocument } from '@/lib/db/business-documents';
import { insertBusinessGoal, listBusinessGoals } from '@/lib/db/business-goals';
import { recordAuditEvent } from '@/services/audit';
import { createFinancialPeriod, recordMetric } from '@/services/financials';
import { addBusinessDocument } from '@/services/documents';
import { createBusinessGoal, getGoalProgress } from '@/services/goals';

const db = {} as never;
const audit = vi.mocked(recordAuditEvent);

beforeEach(() => vi.clearAllMocks());

describe('financials service', () => {
  it('derives the period label when none is supplied', async () => {
    vi.mocked(insertFinancialPeriod).mockResolvedValue({
      data: { id: 'p1' } as never,
      error: null,
    });
    await createFinancialPeriod(db, 'owner-1', {
      businessId: 'biz-1',
      periodType: 'quarter',
      periodStart: '2026-04-01',
      periodEnd: '2026-06-30',
    });
    expect(insertFinancialPeriod).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ label: 'Q2 2026', business_id: 'biz-1' }),
    );
  });

  it('records a metric founder_provided by default and never audits the value', async () => {
    vi.mocked(insertMetric).mockResolvedValue({ data: { id: 'm1' } as never, error: null });
    await recordMetric(db, 'owner-1', {
      businessId: 'biz-1',
      metricKey: 'revenue',
      value: 123456.78,
    });

    expect(insertMetric).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ provenance: 'founder_provided', value: 123456.78 }),
    );

    const call = audit.mock.calls.find((c) => c[0]?.event === 'business.metric_recorded');
    expect(call).toBeTruthy();
    const metadata = JSON.stringify(call?.[0]?.metadata ?? {});
    expect(metadata).toContain('revenue'); // the metric KEY is fine
    expect(metadata).not.toContain('123456'); // the VALUE must never be audited
  });
});

describe('documents service', () => {
  it('audits the document type only, never the title', async () => {
    vi.mocked(insertBusinessDocument).mockResolvedValue({
      data: { id: 'd1' } as never,
      error: null,
    });
    await addBusinessDocument(db, 'owner-1', {
      businessId: 'biz-1',
      documentType: 'financial_statement',
      title: 'Q2 2026 Secret Financials',
    });
    const call = audit.mock.calls.find((c) => c[0]?.event === 'business.document_added');
    const metadata = JSON.stringify(call?.[0]?.metadata ?? {});
    expect(metadata).toContain('financial_statement');
    expect(metadata).not.toContain('Secret');
  });
});

describe('goals service', () => {
  it('creates a goal and audits its type', async () => {
    vi.mocked(insertBusinessGoal).mockResolvedValue({ data: { id: 'g1' } as never, error: null });
    await createBusinessGoal(db, 'owner-1', {
      businessId: 'biz-1',
      goalType: 'revenue_target',
      title: 'Reach $250k',
    });
    const call = audit.mock.calls.find((c) => c[0]?.event === 'business.goal_created');
    expect(call?.[0]?.metadata).toEqual({ goal_type: 'revenue_target' });
  });

  it('derives progress from goals and metrics on read', async () => {
    vi.mocked(listBusinessGoals).mockResolvedValue([
      {
        id: 'g1',
        business_id: 'biz-1',
        target_metric_key: 'revenue',
        target_value: 250000,
      } as never,
    ]);
    vi.mocked(listMetricsForBusiness).mockResolvedValue([
      { id: 'm1', metric_key: 'revenue', value: 125000, provenance: 'founder_provided' } as never,
    ]);

    const rows = await getGoalProgress(db, 'biz-1');
    expect(rows[0]?.progress.percent).toBe(50);
    expect(rows[0]?.progress.currentValue).toBe(125000);
  });
});
