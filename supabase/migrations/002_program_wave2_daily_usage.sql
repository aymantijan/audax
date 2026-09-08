-- AUDAX Programme — Wave 2 tables (daily usage, overrides, nutrition, habits).
-- Run in Supabase Dashboard → SQL Editor → New Query → paste → Run.
-- Depends on Wave 1 (001_create_program_tables.sql).

-- ============================================================================
-- program_event_overrides
-- Per-occurrence overrides: reschedule, swap session, cancel, change exercises.
-- The original weekly_structure + session_exercises are NEVER mutated.
-- An override targets a specific (date, session_id) pair.
-- ============================================================================
create table if not exists public.program_event_overrides (
  id              uuid primary key default gen_random_uuid(),
  program_id      uuid not null references public.programs(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  target_date     date not null,
  original_session_id uuid references public.program_sessions(id) on delete cascade,

  -- What changed
  action          text not null check (action in ('reschedule','swap','cancel','modify_exercises')),
  new_date        date,                    -- for reschedule
  new_time        time,                    -- for reschedule
  new_session_id  uuid references public.program_sessions(id) on delete set null,  -- for swap
  new_location_id uuid references public.program_locations(id) on delete set null,
  exercise_overrides jsonb,                -- for modify_exercises: [{exercise_id, sets_count, reps_min, reps_max, ...}]

  -- Justification (discipline system reads this)
  reason_code     text,                    -- from the barème (e.g. 'transport_public', 'maladie_legere')
  reason_note     text,                    -- free text

  -- Cascade tracking: when a cancel cascades remaining sessions
  cascade_applied boolean default false,

  created_at      timestamptz not null default now(),

  constraint unique_override unique (program_id, target_date, original_session_id)
);

create index if not exists idx_overrides_program_date
  on public.program_event_overrides(program_id, target_date);

alter table public.program_event_overrides enable row level security;
drop policy if exists "users own overrides" on public.program_event_overrides;
create policy "users own overrides" on public.program_event_overrides
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- program_session_logs
-- Actual execution of a planned session. One row per session performed.
-- Links back to the session definition + the date it was planned for.
-- Exercises performed stored as JSONB (denormalized snapshot of what was done).
-- ============================================================================
create table if not exists public.program_session_logs (
  id              uuid primary key default gen_random_uuid(),
  program_id      uuid not null references public.programs(id) on delete cascade,
  phase_id        uuid not null references public.program_phases(id) on delete cascade,
  session_id      uuid not null references public.program_sessions(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  planned_date    date not null,
  actual_date     date not null,

  -- Timing (discipline reads these)
  planned_time    time,                    -- from weekly_structure.scheduled_time
  actual_start    timestamptz,
  actual_end      timestamptz,
  duration_min    integer,

  -- Location
  location_id     uuid references public.program_locations(id) on delete set null,

  -- Exercises performed: snapshot array
  -- [{exercise_name, exercise_key, planned_sets, planned_reps, planned_rpe,
  --   actual_sets: [{reps, weight_kg, rpe, rest_seconds, form_rating}], notes}]
  exercises_performed jsonb not null default '[]',

  -- Overall session data
  session_rpe     numeric(3,1),            -- overall RPE for the session
  energy_level    integer check (energy_level between 1 and 10),
  notes           text,

  -- Status
  status          text not null default 'completed'
                    check (status in ('completed','partial','skipped')),

  created_at      timestamptz not null default now()
);

create index if not exists idx_session_logs_program_date
  on public.program_session_logs(program_id, planned_date);
create index if not exists idx_session_logs_session
  on public.program_session_logs(session_id);

alter table public.program_session_logs enable row level security;
drop policy if exists "users own session logs" on public.program_session_logs;
create policy "users own session logs" on public.program_session_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- program_nutrition_templates
-- Per-phase nutrition templates built from food items.
-- A phase can have multiple templates (e.g. training day, rest day, high carb).
-- ============================================================================
create table if not exists public.program_nutrition_templates (
  id              uuid primary key default gen_random_uuid(),
  phase_id        uuid not null references public.program_phases(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  template_type   text not null default 'training'
                    check (template_type in ('training','rest','high_carb','low_carb','refeed','custom')),

  -- Macro targets (auto-calculated from items, but user can override)
  target_kcal     integer,
  target_protein_g integer,
  target_carbs_g  integer,
  target_fat_g    integer,
  target_fiber_g  integer,

  -- Meals: [{meal_label, time, items: [{food_key, food_name, grams, kcal, protein, carbs, fat, fiber}]}]
  meals           jsonb not null default '[]',

  -- Micro targets (optional, auto-computed)
  micro_targets   jsonb,                   -- {vitamin_d_iu, iron_mg, calcium_mg, ...}

  notes           text,
  is_default      boolean default false,   -- one default per (phase, template_type)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_nutrition_templates_phase
  on public.program_nutrition_templates(phase_id);

alter table public.program_nutrition_templates enable row level security;
drop policy if exists "users own nutrition templates" on public.program_nutrition_templates;
create policy "users own nutrition templates" on public.program_nutrition_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- program_habit_links
-- Bidirectional linking between programme sessions/phases and habits.
-- A habit completion can partially fulfil a programme requirement and vice versa.
-- ============================================================================
create table if not exists public.program_habit_links (
  id              uuid primary key default gen_random_uuid(),
  program_id      uuid not null references public.programs(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,

  -- What in the programme
  phase_id        uuid references public.program_phases(id) on delete cascade,
  session_id      uuid references public.program_sessions(id) on delete cascade,

  -- What habit (stored by habit_id from habitStore — not a FK since habits
  -- are in localStorage/healthStore, not Supabase)
  habit_id        text not null,
  habit_name      text not null,           -- denormalized for display

  -- Link config
  link_type       text not null default 'session_completes_habit'
                    check (link_type in (
                      'session_completes_habit',   -- logging a session auto-completes the habit
                      'habit_fulfils_session',     -- completing the habit counts as session done
                      'bidirectional',             -- both directions
                      'partial'                    -- habit partially fulfils session (e.g. 50%)
                    )),
  fulfilment_percent integer default 100 check (fulfilment_percent between 1 and 100),

  created_at      timestamptz not null default now(),

  constraint unique_habit_link unique (program_id, session_id, habit_id)
);

create index if not exists idx_habit_links_program
  on public.program_habit_links(program_id);

alter table public.program_habit_links enable row level security;
drop policy if exists "users own habit links" on public.program_habit_links;
create policy "users own habit links" on public.program_habit_links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
