-- F7 · error log: crashes seen by users' browsers (window errors, unhandled
-- promise rejections, React error boundary). Written by the app (anon or
-- signed-in), readable only from the Supabase dashboard / service role.
-- Sizes are capped so the table can't be used to store anything else.
-- Safe to re-run.

create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('error', 'unhandledrejection', 'react')),
  message text not null check (length(message) <= 1000),
  stack text check (stack is null or length(stack) <= 4000),
  url text check (url is null or length(url) <= 500),
  app_version text check (app_version is null or length(app_version) <= 40),
  user_agent text check (user_agent is null or length(user_agent) <= 300)
);
create index if not exists idx_client_errors_at on public.client_errors (at desc);

alter table public.client_errors enable row level security;

-- Insert only: anonymous rows, or rows tagged with the caller's own id. No
-- select/update/delete policy → nobody can read or alter the log from the app.
drop policy if exists "insert client_errors" on public.client_errors;
create policy "insert client_errors"
  on public.client_errors for insert
  to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- Keep 90 days.
select cron.unschedule(jobid) from cron.job where jobname = 'audax-client-errors-retention';
select cron.schedule('audax-client-errors-retention', '17 3 * * *', $job$ delete from public.client_errors where at < now() - interval '90 days' $job$);
