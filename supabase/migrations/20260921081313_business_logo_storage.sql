-- ============================================================================
-- Islanda · Post-competition · Business logo storage (P7 Business Passport)
--
-- Adds one nullable column to `businesses` recording where the business's own
-- uploaded logo lives, plus a dedicated storage bucket for it.
--
-- Modeled directly on `business-documents` (same private bucket, same
-- per-business RLS via `app.business_access()` on the path's first segment,
-- ADR-0006/ADR-0009) rather than inventing a new access model. Display uses a
-- signed URL minted server-side, exactly like a document's view URL — there
-- is no public endpoint for a business's logo any more than for its documents.
--
-- Path convention: `<business_id>/logo.png`. One current logo per business,
-- no history — replace overwrites the same object, remove deletes it.
-- ============================================================================

alter table public.businesses
  add column logo_storage_path text null;

comment on column public.businesses.logo_storage_path is
  'Path of this business''s uploaded logo inside the business-logos bucket (<business_id>/logo.png), or null if none has been uploaded. Presentation only — never a source of business facts.';

insert into storage.buckets (id, name, public)
values ('business-logos', 'business-logos', false)
on conflict (id) do nothing;

create policy "business_logos_objects_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'business-logos'
    and app.business_access(nullif((storage.foldername(name))[1], '')::uuid)
  );

create policy "business_logos_objects_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'business-logos'
    and app.business_access(nullif((storage.foldername(name))[1], '')::uuid)
  );

create policy "business_logos_objects_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'business-logos'
    and app.business_access(nullif((storage.foldername(name))[1], '')::uuid)
  )
  with check (
    bucket_id = 'business-logos'
    and app.business_access(nullif((storage.foldername(name))[1], '')::uuid)
  );

create policy "business_logos_objects_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'business-logos'
    and app.business_access(nullif((storage.foldername(name))[1], '')::uuid)
  );
