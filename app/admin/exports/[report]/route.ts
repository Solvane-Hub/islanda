import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { parseDateRange } from '@/lib/admin/date-range';
import { buildExport, EXPORT_REPORTS, type ExportReport } from '@/services/admin/exports';
import { adminRequestContext } from '../../_lib/guard';
import { parseWaitlistFilters } from '../../_lib/waitlist-filters';

/**
 * CSV export download. Generated on request for an administrator on an MFA
 * session and returned directly — nothing is stored, so there is no export
 * URL that works for anyone else. Anyone else gets a bare 404.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function notFound(): NextResponse {
  return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ report: string }> },
) {
  const { report } = await params;
  if (!(EXPORT_REPORTS as readonly string[]).includes(report)) return notFound();

  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const ctx = await adminRequestContext();

  try {
    const db = await createClient();
    const file = await buildExport(
      db,
      {
        report: report as ExportReport,
        range: parseDateRange(query),
        waitlistFilters: parseWaitlistFilters(query),
        includeContact: query.contact === '1',
      },
      ctx,
    );
    return new NextResponse(file.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${file.filename}"`,
        'Cache-Control': 'no-store, private',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof AppError && error.code === 'FORBIDDEN') return notFound();
    logger.error('admin.export_failed', {
      correlationId: ctx.correlationId,
      code: error instanceof Error ? error.name : 'unknown',
    });
    return new NextResponse('The export could not be generated. Try again.', {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
