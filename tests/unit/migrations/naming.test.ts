import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Migration filenames are the link between the repository and production's
 * recorded history (supabase/migrations/README.md). A malformed or duplicate
 * version makes a push re-run SQL that has already been applied.
 */
const files = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql'));

describe('migration files', () => {
  it('are all named <14-digit version>_<snake_case name>.sql', () => {
    for (const file of files) expect(file).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
  });

  it('have unique versions and unique names', () => {
    const versions = files.map((f) => f.slice(0, 14));
    const names = files.map((f) => f.slice(15));
    expect(new Set(versions).size).toBe(files.length);
    expect(new Set(names).size).toBe(files.length);
  });

  it('carry plausible timestamps (a real date and time, not a placeholder)', () => {
    for (const file of files) {
      const v = file.slice(0, 14);
      const iso = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T${v.slice(8, 10)}:${v.slice(10, 12)}:${v.slice(12, 14)}Z`;
      expect(Number.isNaN(Date.parse(iso)), file).toBe(false);
    }
  });

  it('keep the reconciled versions production recorded (2026-10-19)', () => {
    for (const recorded of [
      '20260907043221_business_object_foundation.sql',
      '20260909020613_business_intelligence_core.sql',
      '20260909024557_business_documents_storage.sql',
      '20260909060524_ai_usage.sql',
      '20260911235640_ai_usage_force_rls.sql',
      '20260911235645_business_cases.sql',
      '20260912002318_business_cases_owner_integrity.sql',
      '20260917020153_business_evidence_foundation.sql',
      '20260917020157_waitlist_signups.sql',
      '20261017160038_waitlist_survey_and_recruitment.sql',
      '20261019171608_admin_portal_and_analytics.sql',
    ]) {
      expect(files, recorded).toContain(recorded);
    }
  });
});
