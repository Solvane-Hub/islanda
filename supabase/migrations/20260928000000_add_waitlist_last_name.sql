-- Add last name support to the public waitlist.
-- Existing waitlist records remain valid and are not deleted.

alter table public.waitlist_signups
  add column if not exists last_name text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'waitlist_signups_last_name_check'
      and conrelid = 'public.waitlist_signups'::regclass
  ) then
    alter table public.waitlist_signups
      add constraint waitlist_signups_last_name_check
      check (
        last_name is null
        or char_length(btrim(last_name)) between 1 and 100
      );
  end if;
end;
$$;

comment on column public.waitlist_signups.last_name
  is 'Last name supplied by the waitlist visitor.';
