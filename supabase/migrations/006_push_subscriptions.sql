-- Web Push subscriptions (api/push-subscribe.js writes them with the caller's
-- own JWT; api/class-reminders.js reads them with the service role).
-- Defined in schema.sql but had never been applied to the production project
-- (found 2026-09-27: the reminders cron answered "Failed to read push
-- subscriptions"). Adds the UPDATE policy that the endpoint's upsert
-- (Prefer: resolution=merge-duplicates) needs when a device re-subscribes.
-- Safe to re-run.

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

drop policy if exists "update own push_subscriptions" on public.push_subscriptions;
create policy "update own push_subscriptions"
  on public.push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own push_subscriptions" on public.push_subscriptions;
create policy "delete own push_subscriptions"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);
