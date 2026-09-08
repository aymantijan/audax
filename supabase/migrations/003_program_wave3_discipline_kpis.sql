-- AUDAX Programme — Wave 3 tables (discipline, KPIs, goals, trophies, alerts).
-- Run in Supabase Dashboard → SQL Editor → New Query → paste → Run.
-- Depends on Wave 1+2.

-- ============================================================================
-- program_discipline_daily
-- One row per (program, date) — stores the computed discipline score breakdown.
-- Recomputed whenever a session log, override, or relevant health data changes.
-- ============================================================================
create table if not exists public.program_discipline_daily (
  id              uuid primary key default gen_random_uuid(),
  program_id      uuid not null references public.programs(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  score_date      date not null,

  -- 6 weighted components (all 0-100, then weighted into overall)
  timing_score    numeric(5,2),     -- 25%: how close to planned time
  completion_score numeric(5,2),    -- 30%: sessions done vs planned
  nutrition_score numeric(5,2),     -- 15%: nutrition template adherence
  sleep_score     numeric(5,2),     -- 10%: sleep consistency
  recovery_score  numeric(5,2),     -- 10%: recovery adherence
  habits_score    numeric(5,2),     -- 10%: linked habit completion

  -- Weighted overall
  overall_score   numeric(5,2) not null,

  -- Breakdown details (for tooltip / drill-down)
  details         jsonb,            -- { timing_details, completion_details, ... }

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint unique_discipline_day unique (program_id, score_date)
);

create index if not exists idx_discipline_program_date
  on public.program_discipline_daily(program_id, score_date);

alter table public.program_discipline_daily enable row level security;
drop policy if exists "users own discipline" on public.program_discipline_daily;
create policy "users own discipline" on public.program_discipline_daily
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- program_kpis
-- KPI definitions tracked for a program. Mix of library KPIs (by kpi_key)
-- and custom KPIs (user-defined formula/source).
-- ============================================================================
create table if not exists public.program_kpis (
  id              uuid primary key default gen_random_uuid(),
  program_id      uuid not null references public.programs(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,

  kpi_key         text,               -- library KPI key (null for custom)
  custom_name     text,               -- for custom KPIs
  custom_unit     text,               -- for custom KPIs
  custom_source   text,               -- 'manual' | 'computed' | data source path

  -- Target
  target_value    numeric,
  target_direction text check (target_direction in ('higher','lower','range','exact')),
  target_min      numeric,            -- for range targets
  target_max      numeric,

  -- Display
  display_order   integer default 0,
  is_pinned       boolean default false,

  created_at      timestamptz not null default now(),

  constraint unique_kpi_per_program unique (program_id, kpi_key)
);

create index if not exists idx_kpis_program
  on public.program_kpis(program_id);

alter table public.program_kpis enable row level security;
drop policy if exists "users own kpis" on public.program_kpis;
create policy "users own kpis" on public.program_kpis
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- program_kpi_values
-- Time-series of KPI measurements (one per day per KPI).
-- Library KPIs are auto-populated; custom ones are manual or triggered.
-- ============================================================================
create table if not exists public.program_kpi_values (
  id              uuid primary key default gen_random_uuid(),
  kpi_id          uuid not null references public.program_kpis(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  value_date      date not null,
  value           numeric not null,
  source          text default 'auto',  -- 'auto' | 'manual'
  created_at      timestamptz not null default now(),

  constraint unique_kpi_value_day unique (kpi_id, value_date)
);

create index if not exists idx_kpi_values_kpi_date
  on public.program_kpi_values(kpi_id, value_date);

alter table public.program_kpi_values enable row level security;
drop policy if exists "users own kpi values" on public.program_kpi_values;
create policy "users own kpi values" on public.program_kpi_values
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- program_goals
-- Goals tied to phases. A goal tracks a KPI toward a target and
-- becomes a trophy when achieved.
-- ============================================================================
create table if not exists public.program_goals (
  id              uuid primary key default gen_random_uuid(),
  program_id      uuid not null references public.programs(id) on delete cascade,
  phase_id        uuid references public.program_phases(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,

  title           text not null,
  description     text,

  -- What to track
  kpi_id          uuid references public.program_kpis(id) on delete set null,
  target_value    numeric,
  target_direction text check (target_direction in ('higher','lower','range','exact')),

  -- Progress
  current_value   numeric,
  progress_pct    numeric(5,2) default 0,
  achieved        boolean default false,
  achieved_at     timestamptz,

  -- Display
  priority        text default 'medium' check (priority in ('low','medium','high','critical')),
  display_order   integer default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_goals_program
  on public.program_goals(program_id);
create index if not exists idx_goals_phase
  on public.program_goals(phase_id);

alter table public.program_goals enable row level security;
drop policy if exists "users own goals" on public.program_goals;
create policy "users own goals" on public.program_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- program_trophies
-- Achieved goals become trophies — immutable records with a snapshot
-- of the achievement context (discipline score, duration, etc.).
-- ============================================================================
create table if not exists public.program_trophies (
  id              uuid primary key default gen_random_uuid(),
  program_id      uuid not null references public.programs(id) on delete cascade,
  goal_id         uuid references public.program_goals(id) on delete set null,
  user_id         uuid not null references auth.users(id) on delete cascade,

  title           text not null,
  description     text,
  trophy_type     text default 'goal' check (trophy_type in ('goal','milestone','discipline','custom')),

  -- Achievement snapshot
  achieved_value  numeric,
  target_value    numeric,
  discipline_score numeric(5,2),       -- discipline at time of achievement
  phase_name      text,
  program_name    text,
  duration_days   integer,             -- days from goal creation to achievement

  -- Visual
  icon            text default '🏆',
  tier            text default 'bronze' check (tier in ('bronze','silver','gold','diamond')),

  achieved_at     timestamptz not null default now()
);

create index if not exists idx_trophies_user
  on public.program_trophies(user_id, achieved_at desc);

alter table public.program_trophies enable row level security;
drop policy if exists "users own trophies" on public.program_trophies;
create policy "users own trophies" on public.program_trophies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- program_alerts
-- System-generated alerts (repeated delays, missed sessions, etc.)
-- ============================================================================
create table if not exists public.program_alerts (
  id              uuid primary key default gen_random_uuid(),
  program_id      uuid not null references public.programs(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  alert_type      text not null check (alert_type in (
    'repeated_delay','missed_streak','nutrition_gap','sleep_deficit',
    'overtraining_risk','goal_at_risk','discipline_drop','phase_ending'
  )),
  severity        text default 'warning' check (severity in ('info','warning','critical')),
  title           text not null,
  message         text not null,
  context         jsonb,               -- { dates, values, threshold, etc. }
  acknowledged    boolean default false,
  created_at      timestamptz not null default now()
);

create index if not exists idx_alerts_program
  on public.program_alerts(program_id, created_at desc);

alter table public.program_alerts enable row level security;
drop policy if exists "users own alerts" on public.program_alerts;
create policy "users own alerts" on public.program_alerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
