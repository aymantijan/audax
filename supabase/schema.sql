-- AUDAX cloud sync schema.
--
-- One JSONB row per (user, store) rather than one table per entity type.
-- Why: AUDAX's stores (skills = 412-entry object w/ XP logs, courses = nested
-- chapter/checklist JSONB, trades = nested journal/macro objects) don't map
-- cleanly onto flat relational columns without reshaping the app. This table
-- mirrors exactly what each Zustand store already persists to localStorage,
-- so sync is "push the whole store state up," not per-field mapping — far
-- less surface area for bugs, same end-user result (cross-device sync).
--
-- Run this once in Supabase Dashboard -> SQL Editor -> New Query -> paste -> Run.

create table if not exists public.app_state (
  user_id uuid not null references auth.users (id) on delete cascade,
  store_name text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, store_name)
);

create index if not exists idx_app_state_user on public.app_state (user_id);

alter table public.app_state enable row level security;

drop policy if exists "select own app_state" on public.app_state;
create policy "select own app_state"
  on public.app_state for select
  using (auth.uid() = user_id);

drop policy if exists "insert own app_state" on public.app_state;
create policy "insert own app_state"
  on public.app_state for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own app_state" on public.app_state;
create policy "update own app_state"
  on public.app_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own app_state" on public.app_state;
create policy "delete own app_state"
  on public.app_state for delete
  using (auth.uid() = user_id);

-- Enable realtime (multi-device live sync) on this table.
-- If this errors with "already a member", that's fine — it means it's already enabled.
alter publication supabase_realtime add table public.app_state;
