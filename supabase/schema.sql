-- Notes table + Row Level Security policies.
-- Run this in the Supabase Dashboard → SQL Editor.
-- Safe to re-run: it creates what's missing, re-applies the grant, and
-- recreates the four policies below. It never deletes notes.

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
              references auth.users (id) on delete cascade,
  title       text not null default '',
  content     text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists notes_user_id_idx on public.notes (user_id);

-- Input limits, enforced by the database itself. The app validates the same
-- rules with Zod in its Server Actions (lib/validation.ts), but the publishable
-- key lets anyone call Supabase directly, so the database is the layer that
-- can't be bypassed. NOT VALID: applies to every new insert/update without
-- re-checking rows that already exist, so this script never fails on old data.
alter table public.notes drop constraint if exists notes_title_length;
alter table public.notes add constraint notes_title_length
  check (char_length(title) <= 200) not valid;

alter table public.notes drop constraint if exists notes_content_length;
alter table public.notes add constraint notes_content_length
  check (char_length(content) <= 20000) not valid;

alter table public.notes drop constraint if exists notes_not_empty;
alter table public.notes add constraint notes_not_empty
  check (btrim(title) <> '' or btrim(content) <> '') not valid;

-- Let logged-in users touch the table at all; RLS below still limits them
-- to their own rows. Logged-out (anon) users get no grant and no access.
grant select, insert, update, delete on public.notes to authenticated;

-- Turn on RLS: with no matching policy, every request is denied.
alter table public.notes enable row level security;

-- Only logged-in users, and only for rows they own.
-- Anonymous (logged-out) requests match no policy, so they see nothing.
drop policy if exists "Users can view their own notes" on public.notes;
create policy "Users can view their own notes"
  on public.notes for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own notes" on public.notes;
create policy "Users can create their own notes"
  on public.notes for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- `with check` stops a user from reassigning a note to someone else.
drop policy if exists "Users can update their own notes" on public.notes;
create policy "Users can update their own notes"
  on public.notes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own notes" on public.notes;
create policy "Users can delete their own notes"
  on public.notes for delete to authenticated
  using ((select auth.uid()) = user_id);


-- ---------------------------------------------------------------------------
-- Weather cache: one row per city, refreshed by the server at most hourly.
-- Server-only. The Next.js server reads/writes it with the secret key
-- (service_role). Browsers, logged in or not, can't read or write it.
-- ---------------------------------------------------------------------------

create table if not exists public.weather_cache (
  city        text primary key,          -- normalized: lower(trim(city))
  location    text not null,             -- name WeatherAPI returned, e.g. "Dickson"
  temp_c      integer not null,
  temp_f      integer not null,
  condition   text not null,
  icon_url    text not null,
  fetched_at  timestamptz not null default now()
);

-- Remove any default access for the public roles...
revoke all on public.weather_cache from anon, authenticated;
-- ...and explicitly grant the server role what it needs (no delete needed).
grant select, insert, update on public.weather_cache to service_role;

-- Second lock: RLS on with no policies, so anon/authenticated get nothing even
-- if someone grants them access later. service_role bypasses RLS.
alter table public.weather_cache enable row level security;
