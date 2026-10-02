-- Commercial-publication eligibility (G11).
--
-- G11 is the Government of The Bahamas reuse restriction: official legislation
-- may be used privately, but a commercial entity must obtain permission to reuse
-- it. That is a PUBLICATION / REDISTRIBUTION gate, not an ingestion gate — we may
-- acquire and work with the source material for internal engineering, staging and
-- testing, but we may not publish protected source text as FoundryAI-served
-- content until permission is recorded.
--
-- This models that explicitly and fail-closed:
--   • every pack carries an eligibility state, defaulting to 'restricted';
--   • only a 'cleared' pack may be PUBLISHED (enforced atomically in the RPC);
--   • draft / validating / staged are unaffected — engineering can proceed.
--
-- A source being successfully retrieved never implies it is publishable. Clearing
-- is a separate, deliberate act recorded here.

create type public.commercial_publication_eligibility as enum (
  -- Not cleared for commercial redistribution. Ingest, stage and test only.
  'restricted',
  -- Permission obtained, or the content is FoundryAI-authored (e.g. a synthetic
  -- demonstration corpus). Publishable.
  'cleared'
);

alter table public.knowledge_packs
  add column commercial_publication_eligibility public.commercial_publication_eligibility
    not null default 'restricted';

-- The synthetic Example Jurisdiction (ZZ) pack is invented, FoundryAI-authored
-- content with no third-party copyright — it carries no reuse restriction and is
-- publishable. Every real-jurisdiction pack stays 'restricted' until cleared.
update public.knowledge_packs
   set commercial_publication_eligibility = 'cleared'
 where country_code = 'ZZ';

-- Enforce G11 at the atomic publication boundary. Only a cleared pack may be
-- published; the staged pack still exists for human review, it simply cannot be
-- promoted to a user-facing published pack while restricted.
create or replace function public.publish_knowledge_pack(
  p_pack_id uuid,
  p_approved_by uuid,
  p_approval_note text default null::text
)
  returns knowledge_packs
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
as $function$
declare
  target public.knowledge_packs;
begin
  select * into target from public.knowledge_packs where id = p_pack_id for update;
  if not found then
    raise exception 'Knowledge Pack % not found', p_pack_id using errcode = 'no_data_found';
  end if;
  if target.status <> 'staged' then
    raise exception 'K7 §8: only a staged pack may be published (current status: %)', target.status
      using errcode = 'check_violation';
  end if;
  -- G11: publication (redistribution) requires cleared commercial eligibility.
  if target.commercial_publication_eligibility <> 'cleared' then
    raise exception
      'G11: Knowledge Pack % is not cleared for commercial publication (eligibility: %). Record reuse permission before publishing.',
      p_pack_id, target.commercial_publication_eligibility
      using errcode = 'check_violation';
  end if;

  update public.knowledge_packs
     set status = 'superseded',
         superseded_at = now(),
         superseded_by_id = p_pack_id
   where country_code = target.country_code
     and status = 'published';

  update public.knowledge_packs
     set status = 'published',
         published_at = now(),
         published_by = p_approved_by,
         approval_note = p_approval_note
   where id = p_pack_id
  returning * into target;

  return target;
end;
$function$;
