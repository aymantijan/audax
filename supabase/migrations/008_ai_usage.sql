-- 008 · AI usage quota (F8): one row per person per day, incremented
-- atomically by the server (service role) before each Gemini call.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage: read own" on public.ai_usage;
create policy "ai_usage: read own" on public.ai_usage
  for select using (auth.uid() = user_id);

-- Returns the new count, or -1 when the daily limit is already reached.
create or replace function public.ai_usage_hit(p_user uuid, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.ai_usage (user_id, day, count)
  values (p_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update
    set count = public.ai_usage.count + 1
    where public.ai_usage.count < p_limit
  returning count into n;
  return coalesce(n, -1);
end;
$$;

revoke all on function public.ai_usage_hit(uuid, integer) from public, anon, authenticated;
grant execute on function public.ai_usage_hit(uuid, integer) to service_role;

-- Keep 90 days of counters.
select cron.schedule(
  'ai-usage-retention',
  '30 3 * * *',
  $$delete from public.ai_usage where day < (now() at time zone 'utc')::date - 90$$
)
where not exists (select 1 from cron.job where jobname = 'ai-usage-retention');
