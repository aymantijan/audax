-- AUDAX Programme — Wave 1 tables (relational, NOT JSONB-blob).
-- Programme is 100% Supabase (no localStorage), unlike the rest of the app.
-- Run in Supabase Dashboard → SQL Editor → New Query → paste → Run.

-- ============================================================================
-- program_locations (independent, reusable across programs)
-- ============================================================================
create table if not exists public.program_locations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  type        text check (type in ('gym','home','outdoor','pool','studio','other')),
  address     text,
  created_at  timestamptz not null default now(),

  constraint unique_location_name unique (user_id, name)
);

alter table public.program_locations enable row level security;
drop policy if exists "users own locations" on public.program_locations;
create policy "users own locations" on public.program_locations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- programs
-- ============================================================================
create table if not exists public.programs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  status        text not null check (status in ('draft','active','archived')),
  start_date    date,
  end_date      date,
  activated_at  timestamptz,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_programs_user_status on public.programs(user_id, status);

alter table public.programs enable row level security;
drop policy if exists "users own programs" on public.programs;
create policy "users own programs" on public.programs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Trigger: at most one draft and one active per user
create or replace function public.check_single_draft_active()
returns trigger as $$
begin
  if NEW.status = 'draft' then
    if exists (
      select 1 from public.programs
      where user_id = NEW.user_id and status = 'draft' and id != NEW.id
    ) then
      raise exception 'Only one draft program allowed per user';
    end if;
  end if;
  if NEW.status = 'active' then
    if exists (
      select 1 from public.programs
      where user_id = NEW.user_id and status = 'active' and id != NEW.id
    ) then
      raise exception 'Only one active program allowed per user';
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists enforce_single_draft_active on public.programs;
create trigger enforce_single_draft_active
  before insert or update on public.programs
  for each row execute function public.check_single_draft_active();

-- ============================================================================
-- program_phases
-- ============================================================================
create table if not exists public.program_phases (
  id              uuid primary key default gen_random_uuid(),
  program_id      uuid not null references public.programs(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  phase_order     integer not null,
  start_date      date not null,
  end_date        date not null,
  objective       text,
  status          text not null default 'pending'
                    check (status in ('pending','active','completed','extended')),
  extension_days  integer default 0,
  extension_reason text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint unique_phase_order unique (program_id, phase_order),
  constraint valid_dates check (end_date >= start_date)
);

create index if not exists idx_phases_program on public.program_phases(program_id, phase_order);

alter table public.program_phases enable row level security;
drop policy if exists "users own phases" on public.program_phases;
create policy "users own phases" on public.program_phases
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- program_sessions (session DEFINITIONS within a phase)
-- ============================================================================
create table if not exists public.program_sessions (
  id            uuid primary key default gen_random_uuid(),
  phase_id      uuid not null references public.program_phases(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  session_key   text not null,
  label         text not null,
  type          text not null check (type in ('strength','cardio','sport','mobility','recovery')),
  estimated_duration_min integer,
  notes         text,
  created_at    timestamptz not null default now(),

  constraint unique_session_key unique (phase_id, session_key)
);

create index if not exists idx_sessions_phase on public.program_sessions(phase_id);

alter table public.program_sessions enable row level security;
drop policy if exists "users own sessions" on public.program_sessions;
create policy "users own sessions" on public.program_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- program_session_exercises
-- ============================================================================
create table if not exists public.program_session_exercises (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.program_sessions(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  exercise_order  integer not null,
  exercise_name   text not null,
  exercise_key    text,
  sets_count      integer not null default 3,
  reps_min        integer,
  reps_max        integer,
  reps_prefill    integer,
  rest_seconds    integer default 90,
  target_rpe      numeric(3,1) default 7.0,
  tempo           text,
  notes           text,
  created_at      timestamptz not null default now(),

  constraint unique_exercise_order unique (session_id, exercise_order)
);

create index if not exists idx_exercises_session on public.program_session_exercises(session_id, exercise_order);

alter table public.program_session_exercises enable row level security;
drop policy if exists "users own exercises" on public.program_session_exercises;
create policy "users own exercises" on public.program_session_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- program_weekly_structure (7 rows per phase, one per day-of-week)
-- ============================================================================
create table if not exists public.program_weekly_structure (
  id            uuid primary key default gen_random_uuid(),
  phase_id      uuid not null references public.program_phases(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  day_of_week   integer not null check (day_of_week between 0 and 6),
  is_rest_day   boolean not null default false,
  session_ids   uuid[] default '{}',
  scheduled_time time,
  duration_min  integer,
  location_id   uuid references public.program_locations(id) on delete set null,
  notes         text,
  created_at    timestamptz not null default now(),

  constraint unique_day_per_phase unique (phase_id, day_of_week)
);

create index if not exists idx_weekly_phase on public.program_weekly_structure(phase_id);

alter table public.program_weekly_structure enable row level security;
drop policy if exists "users own weekly" on public.program_weekly_structure;
create policy "users own weekly" on public.program_weekly_structure
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
