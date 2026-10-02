-- Explicit legal status on knowledge sources.
--
-- Retrieval treated a null effective_date as "in force", so an instrument that is
-- ENACTED BUT NOT COMMENCED (e.g. the Data Protection Act 2025, whose commencement
-- is an appointed day the Minister has not yet fixed) would be served as current
-- law. Legal status must be represented explicitly, never inferred from the
-- absence of a date.
--
-- Retrieval treats only {in_force, base_text_amended} as CURRENT applicable law.
-- Everything else — enacted_not_in_force, repealed, spent, superseded, and the
-- fail-closed 'unresolved' — is excluded from current-law answers (it may still
-- be retrieved and cited for historical / future / commencement questions).

create type public.knowledge_source_legal_status as enum (
  'in_force',              -- in force; a commencement date is established
  'base_text_amended',    -- in force, but amended by later instruments (needs overlay)
  'enacted_not_in_force',  -- passed and assented; commencement not yet triggered
  'repealed',             -- repealed, no longer operative
  'spent',                -- expired by its own terms
  'superseded',           -- replaced by a later instrument
  'unresolved'            -- standing not established from a primary source (fail closed)
);

-- Fail closed: a source whose standing has not been asserted is NOT current law.
alter table public.knowledge_sources
  add column legal_status public.knowledge_source_legal_status not null default 'unresolved';

-- Existing rows predate this column. The only published pack is the synthetic
-- Example Jurisdiction (ZZ) demonstration corpus, which is in force by
-- construction; set it explicitly so its retrieval behaviour is unchanged.
update public.knowledge_sources set legal_status = 'in_force';
