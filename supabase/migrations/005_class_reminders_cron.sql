-- Class reminders by Web Push every 5 minutes (api/class-reminders.js).
-- Vercel's Hobby plan only allows daily crons, so Supabase schedules it:
-- pg_cron fires, pg_net calls the endpoint with the CRON_SECRET bearer.
--
-- Run ONCE in Supabase → SQL Editor, after replacing <CRON_SECRET> with the
-- value of the CRON_SECRET environment variable set on Vercel.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Re-running replaces the job instead of duplicating it.
select cron.unschedule('audax-class-reminders')
where exists (select 1 from cron.job where jobname = 'audax-class-reminders');

select cron.schedule(
  'audax-class-reminders',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://vaudax.vercel.app/api/class-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>'),
    timeout_milliseconds := 20000
  );
  $$
);

-- Check: select * from cron.job_run_details order by start_time desc limit 5;
--        select status_code, content from net._http_response order by created desc limit 5;
