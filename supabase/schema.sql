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

-- Enable realtime (multi-device live sync) on this table. Guarded so
-- re-running this whole script (e.g. to pick up a later addition further
-- down, like leaderboard_profiles) never aborts on "already a member of
-- publication" — Supabase's SQL Editor treats that as a hard error that
-- stops the rest of the script from running, not a warning to skip past.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_state'
  ) then
    alter publication supabase_realtime add table public.app_state;
  end if;
end $$;

-- Web Push subscriptions (see api/push-subscribe.js, api/push-send-test.js).
-- One row per browser/device the user has granted notification permission on
-- (endpoint is unique per browser install, so re-subscribing the same device
-- upserts rather than duplicating). RLS scopes every read/write to the
-- caller's own rows via their Supabase JWT — the API functions never touch a
-- service-role key, they authenticate as the calling user and let RLS do the
-- scoping, same as app_state above. There is currently no server-side cron
-- that reads across ALL users' subscriptions to auto-send condition-based
-- reminders (habits not done, échéances overdue, etc.) — that would need a
-- service-role key and was deliberately left as a follow-up decision, not
-- built silently; see the comment in api/push-subscribe.js.
create table if not exists public.push_subscriptions (
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "select own push_subscriptions" on public.push_subscriptions;
create policy "select own push_subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "insert own push_subscriptions" on public.push_subscriptions;
create policy "insert own push_subscriptions"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "delete own push_subscriptions" on public.push_subscriptions;
create policy "delete own push_subscriptions"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

-- Public leaderboard profiles (see src/services/cloud-sync.js's
-- pushLeaderboardProfile). Deliberately a SEPARATE, minimal table rather than
-- loosening app_state's RLS — app_state rows hold everything (trades, health
-- logs, journal entries...), so making any of it cross-user-readable would
-- leak real financial/health data. This table holds only what a leaderboard
-- needs: display name, career track, and a lifetime XP number, kept in sync
-- client-side whenever the user's `skills` store changes. Any signed-in user
-- can read every row (that's the point of a leaderboard); a user can only
-- write their own row.
create table if not exists public.leaderboard_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  career_goal text,
  lifetime_xp integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.leaderboard_profiles enable row level security;

drop policy if exists "select all leaderboard_profiles" on public.leaderboard_profiles;
create policy "select all leaderboard_profiles"
  on public.leaderboard_profiles for select
  using (auth.uid() is not null);

drop policy if exists "upsert own leaderboard_profiles" on public.leaderboard_profiles;
create policy "upsert own leaderboard_profiles"
  on public.leaderboard_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own leaderboard_profiles" on public.leaderboard_profiles;
create policy "update own leaderboard_profiles"
  on public.leaderboard_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Personal API key for external read access to a user's own AUDAX data (see
-- src/pages/Settings.jsx's "API Access" section and api/finance-data.js).
-- Only a SHA-256 HASH of the key is ever stored — the raw key is shown to
-- the user exactly once at generation time, client-side, and never sent
-- anywhere or persisted in plaintext. RLS still scopes reads to the owner
-- (so a signed-in user can see whether/when they have a key, never the key
-- itself, which was never stored). api/finance-data.js looks rows up by
-- key_hash using a service-role key (bypassing RLS) because the caller
-- presents a raw API key, not a Supabase session — same justified exception
-- as reminders-cron.js's cross-user read.
create table if not exists public.api_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.api_keys enable row level security;

drop policy if exists "select own api_keys" on public.api_keys;
create policy "select own api_keys"
  on public.api_keys for select
  using (auth.uid() = user_id);

drop policy if exists "upsert own api_keys" on public.api_keys;
create policy "upsert own api_keys"
  on public.api_keys for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own api_keys" on public.api_keys;
create policy "update own api_keys"
  on public.api_keys for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own api_keys" on public.api_keys;
create policy "delete own api_keys"
  on public.api_keys for delete
  using (auth.uid() = user_id);
