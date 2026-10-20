import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite, type Transaction } from '@electric-sql/pglite';

/**
 * An isolated PostgreSQL 17 for migration tests — PGlite, in process, no network.
 *
 * Every repo migration is replayed in order on top of minimal stand-ins for what
 * Supabase provides before any project migration runs: the API roles, the
 * `auth` and `storage` schemas, and the default privileges read from
 * production's `pg_default_acl`. That last part matters: a CHECK constraint
 * calling a function the inserting role cannot execute fails only when the
 * privileges are real (20261019200000 shipped exactly that bug, caught here).
 *
 * What this cannot test: Supabase Auth and PostgREST. The RLS suite
 * (tests/rls) covers those against a real project.
 */
export const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');

const SUPABASE_STANDINS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text, email_confirmed_at timestamptz, created_at timestamptz default now(),
  last_sign_in_at timestamptz, banned_until timestamptz, deleted_at timestamptz,
  is_anonymous boolean default false, raw_app_meta_data jsonb, raw_user_meta_data jsonb
);
create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid, status text, factor_type text);
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], owner uuid, created_at timestamptz default now());
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text,
  owner uuid, owner_id text, created_at timestamptz default now(), metadata jsonb);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema auth, storage to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema storage grant all on tables to anon, authenticated, service_role;
alter default privileges in schema storage grant all on functions to anon, authenticated, service_role;
alter default privileges in schema storage grant all on sequences to anon, authenticated, service_role;
`;

/** SQL as production received it: LF line endings (the Windows checkout has CRLF). */
export function readSql(file: string): string {
  return readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/** A fresh database with every migration up to and including `upTo` applied. */
export async function databaseAt(upTo: string): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STANDINS);
  for (const file of migrationFiles()) {
    if (file.slice(0, 14) > upTo) continue;
    try {
      await db.exec(readSql(path.join(MIGRATIONS_DIR, file)));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }
  return db;
}

export interface Claims {
  role: 'anon' | 'authenticated' | 'service_role';
  sub?: string;
  aal?: 'aal1' | 'aal2';
}

/** Runs `fn` in a transaction as an API role with these JWT claims, as PostgREST would. */
export function as<T>(db: PGlite, claims: Claims, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${claims.role}`);
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    return fn(tx);
  });
}
