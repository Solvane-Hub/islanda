-- Corpus integrity: instrument role, canonical provisions, stable manifest join.
--
-- Three silent failure modes found in the Nova v0.1 review, all of which fail in
-- the UNSAFE direction — they make an amendment caveat disappear rather than
-- appear. See docs/nova-v0.1-review.md §6.1–§6.3.
--
-- 1. AMENDING ACTS ARE INSTRUCTIONAL, NOT SUBSTANTIVE.
--    An amending Act does not state law, it states edits: "Section 6 of the
--    principal Act is amended, in paragraph (b), by the deletion of the words
--    ...". That is a valid, citable, Authority-5 verbatim quotation and a
--    useless answer. Nothing previously stopped retrieval ranking it above the
--    provision it edits, because it contains the same query terms.
--
-- 2. PROVISION MATCHING USED DISPLAY STRINGS.
--    'Section 56' matched 'section 56' and nothing else. An amendment repealing
--    and replacing section 56 would not attach to a chunk labelled
--    'Section 56(1)', so repealed text would be shown with no caveat.
--
-- 3. THE MANIFEST JOINED ON A URL.
--    A changed government URL silently detached the amendment chain, and a
--    broken join is indistinguishable from "no amendments exist".
--
-- Schema-only. No DML (Engineering Standards).

-- ── Instrument role ────────────────────────────────────────────────────────
--
-- `unknown` is deliberately included and deliberately the default.
--
-- This is NOT the mistake corrected in 20260823000000, where `freshness_state`
-- defaulted to 'current'. That default made an ASSERTION nobody had verified.
-- 'unknown' asserts nothing: it records that a chunk predates classification,
-- and the retrieval layer ranks it last and excludes it from leading an answer.
-- The default is what makes this migration safe against rows written before
-- today, while still failing closed.
--
-- The application layer accepts only 'substantive' and 'amending_instruction'
-- at registration (lib/validation/knowledge.ts), so no new chunk can be
-- 'unknown'.
create type public.instrument_role as enum (
  'substantive',
  'amending_instruction',
  'unknown'
);

alter table public.knowledge_chunks
  add column instrument_role public.instrument_role not null default 'unknown';

comment on column public.knowledge_chunks.instrument_role is
  'Whether this chunk states law (substantive) or edits it (amending_instruction). '
  'Substantive chunks rank ahead of amending instructions, because an edit instruction '
  'quoted to a founder is grounded, cited and useless. `unknown` predates classification, '
  'ranks last, and may not lead an answer.';

-- ── Canonical provision identifiers ────────────────────────────────────────
--
-- Structured identity rather than a display string. `s.56(1)` is inside `s.56`;
-- `s.56A` is a different section entirely and usually exists because an
-- amending Act inserted it. Derivation and matching live in lib/knowledge/provision.ts.

alter table public.knowledge_chunks
  add column provision_id text,
  add column amends_provision text;

comment on column public.knowledge_chunks.provision_id is
  'Canonical id of the provision this chunk IS, e.g. ''s.56(1)'', ''sch.2''. '
  'Null where the source has no provision structure, or where section_reference '
  'could not be parsed — which the Assistant Service reports as unresolved rather '
  'than treating as "no amendments".';

comment on column public.knowledge_chunks.amends_provision is
  'For an amending_instruction chunk: the canonical id of the provision in the '
  'PRINCIPAL instrument that this chunk edits. Null for substantive chunks.';

-- An amending instruction that does not say what it amends cannot be attached
-- to anything, and would surface as a free-floating edit. Refuse it at the
-- boundary rather than discovering it at retrieval time.
alter table public.knowledge_chunks
  add constraint knowledge_chunks_amending_names_target
  check (instrument_role <> 'amending_instruction' or amends_provision is not null);

create index knowledge_chunks_role_idx
  on public.knowledge_chunks (knowledge_pack_id, instrument_role);

create index knowledge_chunks_provision_idx
  on public.knowledge_chunks (knowledge_pack_id, provision_id)
  where provision_id is not null;

create index knowledge_chunks_amends_idx
  on public.knowledge_chunks (knowledge_pack_id, amends_provision)
  where amends_provision is not null;

-- ── Stable manifest join ───────────────────────────────────────────────────
--
-- Replaces matching `knowledge_sources.source_url` against the manifest's
-- `canonicalUrl`. Nullable at the database level so the column can be added to
-- an existing table; required by `registerSourceSchema` for every new source,
-- and an unresolvable reference fails closed in services/nova/answer.ts.

alter table public.knowledge_sources
  add column manifest_id text;

comment on column public.knowledge_sources.manifest_id is
  'Stable key into the Knowledge Pack source manifest (services/knowledge/manifests). '
  'The amendment chain is resolved through this, never through source_url: a changed '
  'government URL must not silently detach a source from its amendments.';

alter table public.knowledge_sources
  add constraint knowledge_sources_manifest_unique
  unique (knowledge_pack_id, manifest_id);
