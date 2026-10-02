import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { KnowledgePack, KnowledgeSource } from '@/types/knowledge';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  findPackByVersion,
  insertPack,
  publishPack,
  updatePackStatus,
} from '@/lib/db/knowledge/packs';
import { listChunksForPack } from '@/lib/db/knowledge/chunks';
import { latestValidationOutcome, listSourcesForPack } from '@/lib/db/knowledge/sources';
import { insertBusiness, listActiveBusinesses } from '@/lib/db/businesses';
import { ingestSource } from '@/services/knowledge/ingestion';
import {
  assertPackTransition,
  runQualityGate,
  type SourceReadiness,
} from '@/services/knowledge/publishing';
import { assertManifestValid, toRegistrationInput } from '@/services/knowledge/manifests/types';
import {
  DEMO_ZZ_BUSINESS_INDUSTRY,
  DEMO_ZZ_BUSINESS_NAME,
  DEMO_ZZ_COUNTRY_NAME,
  DEMO_ZZ_CURRENCY_CODE,
  DEMO_ZZ_KNOWLEDGE_VERSION,
  DEMO_ZZ_MANIFEST,
  demoZzDraftsFor,
} from '@/services/knowledge/manifests/demo-zz';
import {
  DEMO_SEED_COUNTRY_CODE,
  DemoSeedRefused,
  assertDemoJurisdiction,
  assertDemoPackVersion,
  assertDemoSeedAllowed,
  assertPackIsSeedable,
} from './demo-seed/guards';

/**
 * Seed the SYNTHETIC Example Jurisdiction (ZZ) demonstration Knowledge Pack.
 *
 * ⚠ **This script cannot write to a real jurisdiction.** `DEMO_SEED_COUNTRY_CODE`
 *   is a compile-time constant, there is no CLI argument and no environment
 *   variable that changes it, and `assertDemoJurisdiction` re-checks every value
 *   individually before it is written — the country row, the business, the pack,
 *   and each manifest entry. BS in particular is unreachable from here, which
 *   matters because the G11 commercial-reuse question over real Bahamian legal
 *   text is still open.
 *
 * ⚠ **It fetches nothing.** There is no HTTP client in this file and no file
 *   read. Every byte it writes is defined in
 *   `services/knowledge/manifests/demo-zz.ts` and is invented.
 *
 * ## It uses the real pipeline
 *
 * Sources go through `ingestSource` — so `registerSourceSchema`, `validateSource`
 * and `prepareChunks` all run, chunk ids are derived rather than asserted, and
 * a validation record is written. Publication goes through `runQualityGate` and
 * the atomic `publish_knowledge_pack` RPC. Nothing is inserted with raw SQL.
 *
 * The demo therefore demonstrates the publishing pipeline as well as Nova. A
 * fixture load would have proved neither.
 *
 * ## Idempotency
 *
 * A second run must not duplicate anything. Each step looks before it writes:
 * the country row is upserted, the business is reused if a non-archived one with
 * the same deterministic name already exists, an existing unpublished pack is
 * resumed, and a source whose `manifest_id` is already registered is skipped.
 * A pack that has already been PUBLISHED stops the script entirely — that is a
 * refusal, not a resume, because a published pack is immutable (K7 §4.3).
 *
 * Usage:
 *
 *   FOUNDRYAI_DEMO_PACK=1 FOUNDRYAI_DEMO_OWNER_EMAIL=you@example.com \
 *     npx tsx --env-file=.env.local scripts/seed-demo-pack.ts
 */

type Db = SupabaseClient<Database>;

/** Progress goes to stderr so a redirected stdout summary stays parseable. */
function step(message: string): void {
  console.error(`  · ${message}`);
}

// ── Owner ───────────────────────────────────────────────────────────────────

/**
 * Resolve the demo owner to a REAL auth user.
 *
 * No account is created. The demo business must be reached through the same
 * sign-in, RLS and business-scoping path a founder uses, and inventing an auth
 * user here would make the demo prove less than it appears to.
 */
async function resolveOwnerId(admin: Db, email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    throw new DemoSeedRefused(`Could not list auth users: ${error.message}`);
  }

  const wanted = email.toLowerCase();
  const user = data.users.find((u) => u.email?.toLowerCase() === wanted);

  if (!user) {
    throw new DemoSeedRefused(
      `No account exists for ${email}. Sign up in the application first, then re-run. ` +
        'This script does not create accounts.',
    );
  }

  return user.id;
}

// ── Country ─────────────────────────────────────────────────────────────────

/**
 * Ensure the ZZ country row exists, and is INACTIVE.
 *
 * `is_active` gates `listActiveCountries`, which is what the business-creation
 * form offers. Leaving ZZ inactive means Example Jurisdiction never appears in
 * a real founder's dropdown, so no real user can create a business there and,
 * through the Day 6 jurisdiction policy, no real user can read a ZZ chunk.
 *
 * It is written as an explicit false rather than relying on the column default,
 * because a re-run against a row somebody had activated by hand should correct
 * it rather than leave it.
 */
async function ensureDemoCountry(admin: Db): Promise<void> {
  assertDemoJurisdiction(DEMO_SEED_COUNTRY_CODE, 'the country row');

  const { error } = await admin.from('countries').upsert(
    {
      code: DEMO_SEED_COUNTRY_CODE,
      name: DEMO_ZZ_COUNTRY_NAME,
      currency_code: DEMO_ZZ_CURRENCY_CODE,
      is_active: false,
    },
    { onConflict: 'code' },
  );

  if (error) throw new DemoSeedRefused(`Could not upsert the ZZ country row: ${error.message}`);
  step(`country ${DEMO_SEED_COUNTRY_CODE} present, is_active=false`);
}

// ── Business ────────────────────────────────────────────────────────────────

async function ensureDemoBusiness(
  admin: Db,
  ownerId: string,
): Promise<{ id: string; created: boolean }> {
  assertDemoJurisdiction(DEMO_SEED_COUNTRY_CODE, 'the demo business');

  const existing = (await listActiveBusinesses(admin)).find(
    (b) =>
      b.owner_id === ownerId &&
      b.country_code === DEMO_SEED_COUNTRY_CODE &&
      b.name === DEMO_ZZ_BUSINESS_NAME,
  );

  if (existing) {
    step(`business "${DEMO_ZZ_BUSINESS_NAME}" already exists — reused`);
    return { id: existing.id, created: false };
  }

  const { data, error } = await insertBusiness(admin, {
    owner_id: ownerId,
    name: DEMO_ZZ_BUSINESS_NAME,
    country_code: DEMO_SEED_COUNTRY_CODE,
    industry: DEMO_ZZ_BUSINESS_INDUSTRY,
  });

  if (error || !data) {
    throw new DemoSeedRefused(`Could not create the demo business: ${error ?? 'no row returned'}`);
  }

  step(`business "${DEMO_ZZ_BUSINESS_NAME}" created`);
  return { id: data.id, created: true };
}

// ── Pack ────────────────────────────────────────────────────────────────────

async function ensureDemoPack(admin: Db): Promise<{ pack: KnowledgePack; created: boolean }> {
  assertDemoPackVersion(DEMO_ZZ_KNOWLEDGE_VERSION);
  assertDemoJurisdiction(DEMO_ZZ_MANIFEST.countryCode, 'the manifest');

  const existing = await findPackByVersion(
    admin,
    DEMO_SEED_COUNTRY_CODE,
    DEMO_ZZ_KNOWLEDGE_VERSION,
  );

  // Refuses on published / superseded / rolled_back, before anything is written.
  assertPackIsSeedable(existing);

  if (existing) {
    step(`pack ${existing.version} exists in status "${existing.status}" — resuming`);
    return { pack: existing, created: false };
  }

  const { data, error } = await insertPack(admin, {
    country_code: DEMO_SEED_COUNTRY_CODE,
    version: DEMO_ZZ_KNOWLEDGE_VERSION,
    notes:
      'SYNTHETIC demonstration pack for Example Jurisdiction (ZZ). Contains no real legislation ' +
      'from any jurisdiction. Not for legal or business decisions.',
  });

  if (error || !data) {
    throw new DemoSeedRefused(`Could not create the demo pack: ${error ?? 'no row returned'}`);
  }

  step(`pack ${data.version} created in status "${data.status}"`);
  return { pack: data, created: true };
}

// ── Sources and chunks ──────────────────────────────────────────────────────

async function ingestManifest(
  admin: Db,
  packId: string,
): Promise<{ readiness: SourceReadiness[]; ingested: number; skipped: number }> {
  // `manifest_id` is nullable in the schema for rows written before the Day 5
  // migration. A null one here cannot be matched to a manifest entry, so it is
  // deliberately not indexed — it would be re-ingested rather than silently
  // treated as satisfying an entry it may have nothing to do with.
  const alreadyRegistered = new Map<string, KnowledgeSource>(
    (await listSourcesForPack(admin, packId))
      .filter((s): s is KnowledgeSource & { manifest_id: string } => s.manifest_id !== null)
      .map((s) => [s.manifest_id, s]),
  );

  const readiness: SourceReadiness[] = [];
  let ingested = 0;
  let skipped = 0;

  for (const entry of DEMO_ZZ_MANIFEST.entries) {
    // Per-entry, not once at the top. A corpus with one mislabelled entry must
    // not slip a foreign row past a check performed only on the manifest header.
    assertDemoJurisdiction(entry.countryCode, `manifest entry "${entry.manifestId}"`);

    const drafts = demoZzDraftsFor(entry.manifestId);
    if (drafts.length === 0) {
      throw new DemoSeedRefused(
        `Manifest entry "${entry.manifestId}" has no chunks. A source that produces no chunks ` +
          'fails the K7 §6 quality gate; refusing before writing anything.',
      );
    }

    const existing = alreadyRegistered.get(entry.manifestId);
    if (existing) {
      // Read the recorded outcome rather than assuming a previously registered
      // source validated. A resumed run must be gated on the same evidence a
      // fresh one is.
      const recorded = await latestValidationOutcome(admin, existing.id);
      if (!recorded) {
        throw new DemoSeedRefused(
          `Source ${entry.manifestId} is registered but has no validation record. Refusing to ` +
            'publish a pack containing a source whose validation cannot be produced.',
        );
      }

      step(`source ${entry.manifestId} already registered (validation "${recorded}") — skipped`);
      skipped += 1;
      readiness.push({
        sourceId: existing.id,
        outcome: recorded,
        // Filled in from the database below.
        chunkCount: 0,
        chunksMissingIdentity: 0,
        chunksMissingProvenance: 0,
      });
      continue;
    }

    const result = await ingestSource(admin, {
      registration: toRegistrationInput(entry, {
        knowledgePackId: packId,
        accessedAt: new Date().toISOString(),
      }),
      drafts,
      // A stable stand-in for the document text, so `content_hash` means
      // something. There is no fetched document, and none is implied.
      rawContent: drafts.map((d) => d.body).join('\n'),
      validator: 'demo-seed',
    });

    step(
      `source ${entry.manifestId} ingested — ${result.chunkIds.length} chunk(s), ` +
        `validation "${result.validationOutcome}"`,
    );
    ingested += 1;

    readiness.push({
      sourceId: result.source.id,
      outcome: result.validationOutcome,
      chunkCount: result.chunkIds.length,
      chunksMissingIdentity: 0,
      chunksMissingProvenance: 0,
    });
  }

  // Re-derive the chunk facts from the database rather than trusting the
  // in-memory tally. The quality gate exists to catch a pack that is not what
  // the pipeline believes it wrote, and a gate fed by the writer's own optimism
  // checks nothing.
  const chunks = await listChunksForPack(admin, packId);
  const sourcesById = new Map((await listSourcesForPack(admin, packId)).map((s) => [s.id, s]));

  const bySource = new Map<string, typeof chunks>();
  for (const chunk of chunks) {
    const list = bySource.get(chunk.knowledge_source_id) ?? [];
    list.push(chunk);
    bySource.set(chunk.knowledge_source_id, list);
  }

  const verified: SourceReadiness[] = readiness.map((r) => {
    const owned = bySource.get(r.sourceId) ?? [];
    const sourceUrl = sourcesById.get(r.sourceId)?.source_url ?? null;

    return {
      ...r,
      chunkCount: owned.length,
      chunksMissingIdentity: owned.filter((c) => !c.chunk_id).length,
      /**
       * K2 §4.3/§4.4, applied per chunk. A reviewer must be able to go and look
       * at the passage. A section reference does that; failing that, a source
       * URL does. A chunk with neither is uncitable in practice even though its
       * `chunk_id` binds it internally.
       */
      chunksMissingProvenance: owned.filter((c) => !c.section_reference && !sourceUrl).length,
    };
  });

  return { readiness: verified, ingested, skipped };
}

// ── Publication ─────────────────────────────────────────────────────────────

async function publishDemoPack(
  admin: Db,
  pack: KnowledgePack,
  readiness: readonly SourceReadiness[],
  ownerId: string,
): Promise<KnowledgePack> {
  const gate = runQualityGate(readiness);

  if (!gate.passed) {
    throw new DemoSeedRefused(
      `K7 §6 quality gate failed; nothing was published:\n    - ${gate.failures.join('\n    - ')}`,
    );
  }
  step(`quality gate passed — ${gate.totalChunks} chunk(s) across ${readiness.length} source(s)`);

  // draft → validating → staged, each transition checked against the K7 §4 state
  // machine rather than assumed.
  let current = pack;
  for (const next of ['validating', 'staged'] as const) {
    if (current.status === next) continue;
    assertPackTransition(current.status, next);
    const { data, error } = await updatePackStatus(admin, current.id, next);
    if (error || !data) {
      throw new DemoSeedRefused(`Could not move pack to "${next}": ${error ?? 'no row returned'}`);
    }
    current = data;
    step(`pack status → ${next}`);
  }

  const { data: published, error } = await publishPack(admin, {
    packId: current.id,
    approvedBy: ownerId,
    approvalNote:
      'SYNTHETIC demonstration corpus. Example Jurisdiction (ZZ) is fictional and this pack ' +
      'contains no real legislation. Published by scripts/seed-demo-pack.ts.',
  });

  if (error || !published) {
    throw new DemoSeedRefused(`Publication failed: ${error ?? 'no row returned'}`);
  }

  step(`pack ${published.version} published`);
  return published;
}

// ── Runner ──────────────────────────────────────────────────────────────────

export async function seedDemoPack(): Promise<void> {
  // Every guard runs before a single byte is written.
  const { ownerEmail } = assertDemoSeedAllowed(process.env);
  assertManifestValid(DEMO_ZZ_MANIFEST);
  assertDemoJurisdiction(DEMO_ZZ_MANIFEST.countryCode, 'the demo manifest');

  const admin = createAdminClient();
  if (!admin) {
    throw new DemoSeedRefused('createAdminClient() returned null — no service role key.');
  }

  console.error('\nSeeding the SYNTHETIC Example Jurisdiction (ZZ) demonstration pack.\n');

  const ownerId = await resolveOwnerId(admin, ownerEmail);
  step(`owner resolved: ${ownerEmail}`);

  await ensureDemoCountry(admin);
  const business = await ensureDemoBusiness(admin, ownerId);
  const { pack } = await ensureDemoPack(admin);
  const { readiness, ingested, skipped } = await ingestManifest(admin, pack.id);
  const published = await publishDemoPack(admin, pack, readiness, ownerId);

  const chunkTotal = readiness.reduce((sum, r) => sum + r.chunkCount, 0);

  console.log(
    [
      '',
      '─────────────────────────────────────────────────────────────',
      ' SYNTHETIC DEMONSTRATION PACK — Example Jurisdiction (ZZ)',
      '─────────────────────────────────────────────────────────────',
      ` country          ${DEMO_SEED_COUNTRY_CODE} (${DEMO_ZZ_COUNTRY_NAME}), is_active=false`,
      ` business         ${DEMO_ZZ_BUSINESS_NAME}`,
      `                  ${business.id}${business.created ? ' (created)' : ' (reused)'}`,
      ` knowledge pack   ${published.version}  status=${published.status}`,
      `                  ${published.id}`,
      ` sources          ${readiness.length} (${ingested} ingested, ${skipped} already present)`,
      ` chunks           ${chunkTotal}`,
      '',
      ' None of this is law. Example Jurisdiction is fictional, every URL is on',
      ' the reserved example.invalid domain, and no real legal text was fetched,',
      ' stored or published by this run.',
      '─────────────────────────────────────────────────────────────',
      '',
    ].join('\n'),
  );
}

// Executed directly, never on import — the guards module is imported by tests.
seedDemoPack().catch((error: unknown) => {
  if (error instanceof DemoSeedRefused) {
    console.error(`\n✗ ${error.message}\n`);
    process.exitCode = 1;
    return;
  }
  console.error('\n✗ Demo seed failed:', error);
  process.exitCode = 1;
});
