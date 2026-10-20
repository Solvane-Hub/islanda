-- ============================================================================
-- FoundryAI · Post-competition · Secure document storage (P3)
-- Migration: 20260908010000_business_documents_storage
--
-- Creates the PRIVATE storage bucket that backs `business_documents`, and
-- per-business RLS on the objects so a stored file can never cross a business
-- ownership boundary — the same guarantee the table already has, extended to the
-- bytes.
--
-- Path convention: `<business_id>/<document_id>/<filename>`. The first path
-- segment is the owning business; every policy authorises against it through the
-- single `app.business_access()` predicate (ADR-0009, ADR-0006). A malformed
-- path with no folder yields a null business id and is denied — fails closed.
--
-- The bucket is PRIVATE (public = false): there is no public URL for a business
-- document. Access is only ever a short-lived signed URL minted server-side
-- after an ownership check.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('business-documents', 'business-documents', false)
on conflict (id) do nothing;

-- storage.objects already has RLS enabled by Supabase. One policy per operation,
-- scoped TO authenticated, ownership via the first path segment. NO delete
-- policy: like every business-owned table, removal is not exposed through the API.

create policy "business_documents_objects_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'business-documents'
    and app.business_access(nullif((storage.foldername(name))[1], '')::uuid)
  );

create policy "business_documents_objects_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'business-documents'
    and app.business_access(nullif((storage.foldername(name))[1], '')::uuid)
  );

create policy "business_documents_objects_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'business-documents'
    and app.business_access(nullif((storage.foldername(name))[1], '')::uuid)
  )
  with check (
    bucket_id = 'business-documents'
    and app.business_access(nullif((storage.foldername(name))[1], '')::uuid)
  );
