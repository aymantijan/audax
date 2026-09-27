-- Reminders by Web Push every 5 minutes (api/class-reminders.js): classes
-- (heads-up, check-in nudge, notes after class) + Santé (meals, bedtime,
-- weigh-in). Vercel's Hobby plan only allows daily crons, so Supabase
-- schedules it: pg_cron fires, pg_net calls the endpoint.
--
-- Auth without any secret in this script: each run inserts a one-time nonce
-- that the endpoint consumes with the service-role key. The table has RLS on
-- and no policy, so only the database / service role can touch it.
-- Safe to re-run.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.cron_nonces (
  nonce uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.cron_nonces enable row level security;

select cron.unschedule(jobid) from cron.job where jobname = 'audax-class-reminders';

select cron.schedule(
  'audax-class-reminders',
  '*/5 * * * *',
  $job$
  with n as (insert into public.cron_nonces default values returning nonce)
  select net.http_get(
    url := 'https://vaudax.vercel.app/api/class-reminders?nonce=' || (select nonce from n)::text,
    timeout_milliseconds := 20000
  );
  $job$
);

-- Check: select jobid, status, start_time from cron.job_run_details order by start_time desc limit 5;
--        select status_code, left(content, 200) from net._http_response order by created desc limit 5;
