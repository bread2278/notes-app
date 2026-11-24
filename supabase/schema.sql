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
