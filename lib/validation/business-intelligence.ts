import { z } from 'zod';

/**
 * Business Intelligence Core validation (ADR-0005).
 *
 * The literal arrays mirror the Postgres enums in
 * `20260908000000_business_intelligence_core.sql`. Kept explicit (not derived
 * from generated types) so a schema change is a deliberate, reviewable edit.
 */

export const DOCUMENT_TYPES = [
  'financial_statement',
  'profit_loss',
  'sales_report',
  'tax_document',
  'invoice',
  'expense_report',
  'bank_statement',
  'payroll_report',
  'inventory_report',
  'registration',
  'licence',
  'certificate',
  'other',
] as const;

export const METRIC_KEYS = [
  'revenue',
  'expenses',
  'net_profit',
  'gross_margin',
  'cash_flow',
  'sales_count',
  'customer_count',
  'other',
] as const;

export const GOAL_TYPES = [
  'revenue_target',
  'launch_product',
  'open_location',
  'hire',
  'expand_market',
  'improve_profitability',
  'increase_sales',
  'obtain_licence',
  'other',
] as const;

const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.')
  .optional()
  .or(z.literal('').transform(() => undefined));

const optionalUuid = z
  .uuid('Unknown reference.')
  .optional()
  .or(z.literal('').transform(() => undefined));

/** Requesting a signed upload — the metadata, before the bytes. */
export const documentUploadSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES, { message: 'Choose a document type.' }),
  title: z.string().trim().min(1, 'Give the document a title.').max(200, 'That title is too long.'),
  filename: z.string().trim().min(1).max(255),
  financialPeriodId: optionalUuid,
  documentDate: optionalDate,
  expirationDate: optionalDate,
});

export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;

/** Confirming the bytes landed. */
export const finalizeUploadSchema = z.object({
  documentId: z.uuid('Unknown document.'),
  contentType: z.string().trim().max(255).optional(),
  byteSize: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
});

/** Creating a business goal. */
export const createGoalSchema = z.object({
  goalType: z.enum(GOAL_TYPES, { message: 'Choose a goal type.' }),
  title: z.string().trim().min(1, 'Give the goal a title.').max(200, 'That title is too long.'),
  description: z
    .string()
    .trim()
    .max(5000, 'That is longer than we can store.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  targetMetricKey: z
    .enum(METRIC_KEYS)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  targetValue: z
    .union([z.literal(''), z.coerce.number().min(0).max(9_999_999_999)])
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : Number(v))),
  targetDate: optionalDate,
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
