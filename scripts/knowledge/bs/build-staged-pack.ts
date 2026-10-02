import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { KnowledgePack } from '@/types/knowledge';
import { createAdminClient } from '@/lib/supabase/admin';
import { insertBusiness, listActiveBusinesses } from '@/lib/db/businesses';
import { findPackByVersion, insertPack, updatePackStatus } from '@/lib/db/knowledge/packs';
import { listChunksForPack } from '@/lib/db/knowledge/chunks';
import { latestValidationOutcome, listSourcesForPack } from '@/lib/db/knowledge/sources';
import { ingestSource } from '@/services/knowledge/ingestion';
import {
  assertPackTransition,
  runQualityGate,
  type SourceReadiness,
} from '@/services/knowledge/publishing';
import {
  assertManifestValid,
  findEntry,
  toRegistrationInput,
} from '@/services/knowledge/manifests/types';
import { BAHAMAS_MANIFEST } from '@/services/knowledge/manifests/bahamas';
import { segmentLegalText, type InstrumentKind } from '@/services/knowledge/segmentation';
import type { DraftChunkInput } from '@/lib/validation/knowledge';

/**
 * Build a STAGED (never published) Bahamas Knowledge Pack from the real,
 * already-extracted corpus, for human review.
 *
 * ⚠ **This script never publishes and never clears G11.** It drives the pack only
 *   as far as `staged`. The pack is created with the default commercial-publication
 *   eligibility (`restricted`), so even a later accidental publish call is refused
 *   by `publish_knowledge_pack`. Staged packs are invisible to Nova (retrieval
 *   reads `published` only), so nothing here exposes protected source text.
 *
 * ⚠ **It writes only the sources it can segment cleanly.** `STAGE_MANIFEST_IDS`
 *   lists the instruments whose first-pass segmentation was reviewed as clean
 *   enough to stage. The rest await segmenter hardening or manual segmentation.
 *
 * Source text is read from `.corpus/bs/` (gitignored, produced by
 * acquire-sources.ts). It is NOT fetched here and NOT committed.
 *
 * Usage:
 *   BS_BUILD_STAGED=1 BS_OWNER_EMAIL=you@example.com \
 *     npx tsx --env-file=.env.local scripts/knowledge/bs/build-staged-pack.ts
 */

type Db = SupabaseClient<Database>;

/**
 * All six real instruments, base Acts first. The segmenter (v2) emits clean
 * provisions and fails closed on the rest; legal status flows from the manifest,
 * so DPA 2025 enters as enacted_not_in_force and is kept out of current-law
 * retrieval while remaining citable for commencement questions.
 */
const STAGE_MANIFEST_IDS = [
  'BS-VAT-ACT-CH370A-REPRINT-2024',
  'BS-DPA-CH324A-2003',
  'BS-VAT-AMD-2025-NO3',
  'BS-VAT-AMD-2025-NO45',
  'BS-VAT-AMD-2026-NO4',
  'BS-VAT-AMD-2026-NO19',
  'BS-DPA-2025-NO74',
] as const;

/**
 * Provisions held back from a source for human review — appointed-day clauses
 * that are NOT yet in force, so they must not be ingested into an in-force source
 * where they would be treated as current law.
 *
 * 2026-0019 section 4 (Second Schedule, Part I Exempt Supplies) commences "on
 * such date as the Minister may appoint" (section 1(3)); no day has been fixed,
 * so it is held rather than presented as current.
 */
const HELD_PROVISIONS: Readonly<Record<string, readonly string[]>> = {
  'BS-VAT-AMD-2026-NO19': ['section 4'],
};

const PACK_VERSION = 'BS-v0.1';
const DEMO_BUSINESS_NAME = 'Island Eats Bahamas — DEMO';
const DEMO_BUSINESS_INDUSTRY = 'food_service';
const CORPUS_DIR = resolve(process.cwd(), '.corpus', 'bs');

class BuildRefused extends Error {}

function step(msg: string): void {
  console.error(`  · ${msg}`);
}

async function resolveOwnerId(admin: Db, email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new BuildRefused(`Could not list auth users: ${error.message}`);
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    throw new BuildRefused(
      `No account exists for ${email}. Sign in to the app first; this script creates no accounts.`,
    );
  }
  return user.id;
}

async function ensureDemoBusiness(admin: Db, ownerId: string): Promise<string> {
  const existing = (await listActiveBusinesses(admin)).find(
    (b) => b.owner_id === ownerId && b.country_code === 'BS' && b.name === DEMO_BUSINESS_NAME,
  );
  if (existing) {
    step(`business "${DEMO_BUSINESS_NAME}" already exists — reused (${existing.id})`);
    return existing.id;
  }
  const { data, error } = await insertBusiness(admin, {
    owner_id: ownerId,
    name: DEMO_BUSINESS_NAME,
    country_code: 'BS',
    industry: DEMO_BUSINESS_INDUSTRY,
  });
  if (error || !data) throw new BuildRefused(`Could not create demo business: ${error}`);
  step(`business "${DEMO_BUSINESS_NAME}" created (${data.id})`);
  return data.id;
}

async function ensurePack(admin: Db): Promise<KnowledgePack> {
  const existing = await findPackByVersion(admin, 'BS', PACK_VERSION);
  if (existing) {
    if (['published', 'superseded', 'rolled_back'].includes(existing.status)) {
      throw new BuildRefused(
        `Pack ${PACK_VERSION} is "${existing.status}" and immutable (K7 §4.3). Refusing.`,
      );
    }
    step(`pack ${PACK_VERSION} exists in status "${existing.status}" — resuming`);
    return existing;
  }
  const { data, error } = await insertPack(admin, {
    country_code: 'BS',
    version: PACK_VERSION,
    notes:
      'REAL Bahamas legislation, first staged iteration for human review. Contains verbatim ' +
      'Government of The Bahamas source text; commercial-publication eligibility is restricted ' +
      'until reuse permission is recorded (G11). Not published; not for legal decisions.',
  });
  if (error || !data) throw new BuildRefused(`Could not create pack: ${error}`);
  if (data.commercial_publication_eligibility !== 'restricted') {
    throw new BuildRefused(
      `New pack eligibility is "${data.commercial_publication_eligibility}", expected fail-closed ` +
        '"restricted". Refusing.',
    );
  }
  step(`pack ${PACK_VERSION} created — status "${data.status}", eligibility "restricted"`);
  return data;
}

/** Read + segment one source into ingestion-ready drafts, or refuse. */
function draftsFor(manifestId: string): readonly DraftChunkInput[] {
  const entry = findEntry(BAHAMAS_MANIFEST, manifestId);
  if (!entry) throw new BuildRefused(`No manifest entry "${manifestId}".`);
  const txt = resolve(CORPUS_DIR, `${manifestId}.raw.txt`);
  if (!existsSync(txt)) {
    throw new BuildRefused(
      `Missing extraction ${txt}. Run acquire-sources.ts then extract-raw.ts.`,
    );
  }
  const kind: InstrumentKind = entry.amends !== null ? 'amending_act' : 'substantive_act';
  const result = segmentLegalText(readFileSync(txt, 'utf8'), { kind });
  if (result.outcome !== 'segmented') {
    throw new BuildRefused(`Source "${manifestId}" is not cleanly segmentable: ${result.reason}`);
  }
  const held = new Set(HELD_PROVISIONS[manifestId] ?? []);
  return result.chunks.filter((c) => !held.has(c.draft.sectionReference ?? '')).map((c) => c.draft);
}

async function ingestStagedSources(
  admin: Db,
  packId: string,
  packVersion: string,
): Promise<SourceReadiness[]> {
  const alreadyRegistered = new Map(
    (await listSourcesForPack(admin, packId))
      .filter((s): s is typeof s & { manifest_id: string } => s.manifest_id !== null)
      .map((s) => [s.manifest_id, s]),
  );

  const readiness: SourceReadiness[] = [];
  for (const manifestId of STAGE_MANIFEST_IDS) {
    const entry = findEntry(BAHAMAS_MANIFEST, manifestId)!;
    const drafts = draftsFor(manifestId);

    const existing = alreadyRegistered.get(manifestId);
    if (existing) {
      const outcome = await latestValidationOutcome(admin, existing.id);
      if (!outcome) throw new BuildRefused(`Source ${manifestId} registered without validation.`);
      step(`source ${manifestId} already registered (validation "${outcome}") — skipped`);
      readiness.push({
        sourceId: existing.id,
        outcome,
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
      rawContent: readFileSync(resolve(CORPUS_DIR, `${manifestId}.raw.txt`), 'utf8'),
      validator: 'bs-staged-build',
    });
    step(
      `source ${manifestId} ingested — ${result.chunkIds.length} chunk(s), validation "${result.validationOutcome}"`,
    );
    readiness.push({
      sourceId: result.source.id,
      outcome: result.validationOutcome,
      chunkCount: result.chunkIds.length,
      chunksMissingIdentity: 0,
      chunksMissingProvenance: 0,
    });
  }

  // Re-derive chunk facts from the database — the gate must not trust the writer.
  void packVersion;
  const chunks = await listChunksForPack(admin, packId);
  const sourcesById = new Map((await listSourcesForPack(admin, packId)).map((s) => [s.id, s]));
  const bySource = new Map<string, typeof chunks>();
  for (const c of chunks) {
    const list = bySource.get(c.knowledge_source_id) ?? [];
    list.push(c);
    bySource.set(c.knowledge_source_id, list);
  }
  return readiness.map((r) => {
    const owned = bySource.get(r.sourceId) ?? [];
    const sourceUrl = sourcesById.get(r.sourceId)?.source_url ?? null;
    return {
      ...r,
      chunkCount: owned.length,
      chunksMissingIdentity: owned.filter((c) => !c.chunk_id).length,
      chunksMissingProvenance: owned.filter((c) => !c.section_reference && !sourceUrl).length,
    };
  });
}

async function toStaged(
  admin: Db,
  pack: KnowledgePack,
  readiness: SourceReadiness[],
): Promise<KnowledgePack> {
  const gate = runQualityGate(readiness);
  if (!gate.passed) {
    throw new BuildRefused(`K7 §6 quality gate failed:\n    - ${gate.failures.join('\n    - ')}`);
  }
  step(`quality gate passed — ${gate.totalChunks} chunk(s) across ${readiness.length} source(s)`);

  let current = pack;
  for (const next of ['validating', 'staged'] as const) {
    if (current.status === next) continue;
    assertPackTransition(current.status, next);
    const { data, error } = await updatePackStatus(admin, current.id, next);
    if (error || !data) throw new BuildRefused(`Could not move pack to "${next}": ${error}`);
    current = data;
    step(`pack status → ${next}`);
  }
  return current;
}

async function main(): Promise<void> {
  if (process.env.BS_BUILD_STAGED !== '1') {
    throw new BuildRefused('Set BS_BUILD_STAGED=1 to run. Refusing by default.');
  }
  const ownerEmail = process.env.BS_OWNER_EMAIL;
  if (!ownerEmail) throw new BuildRefused('Set BS_OWNER_EMAIL to the demo owner’s account email.');

  assertManifestValid(BAHAMAS_MANIFEST);

  const admin = createAdminClient();
  if (!admin) throw new BuildRefused('createAdminClient() returned null — no service role key.');

  console.error('\nBuilding STAGED Bahamas pack (real corpus, human-review boundary).\n');
  const ownerId = await resolveOwnerId(admin, ownerEmail);
  step(`owner resolved: ${ownerEmail}`);
  const businessId = await ensureDemoBusiness(admin, ownerId);
  const pack = await ensurePack(admin);
  const readiness = await ingestStagedSources(admin, pack.id, pack.version);
  const staged = await toStaged(admin, pack, readiness);

  if (staged.status !== 'staged')
    throw new BuildRefused(`Expected staged, got "${staged.status}".`);
  if (staged.commercial_publication_eligibility !== 'restricted') {
    throw new BuildRefused('Eligibility drifted from restricted. Refusing to leave it.');
  }

  const chunkTotal = readiness.reduce((s, r) => s + r.chunkCount, 0);
  console.log(
    [
      '',
      '──────────────────────────────────────────────',
      ' BAHAMAS STAGED PACK — for human review only',
      '──────────────────────────────────────────────',
      ` demo business   ${DEMO_BUSINESS_NAME} (${businessId})`,
      ` pack            ${staged.version}  status=${staged.status}`,
      `                 eligibility=${staged.commercial_publication_eligibility} (NOT publishable)`,
      `                 ${staged.id}`,
      ` sources staged  ${readiness.length} of ${STAGE_MANIFEST_IDS.length}`,
      ` chunks          ${chunkTotal}`,
      '',
      ' Staged is invisible to Nova (retrieval reads published only). Nothing was',
      ' published; G11 eligibility remains restricted.',
      '──────────────────────────────────────────────',
      '',
    ].join('\n'),
  );
}

main().catch((e: unknown) => {
  if (e instanceof BuildRefused) {
    console.error(`\n✗ ${e.message}\n`);
    process.exitCode = 1;
    return;
  }
  console.error('\n✗ BS staged build failed:', e);
  process.exitCode = 1;
});
