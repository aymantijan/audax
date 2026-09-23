-- AUDAX Programme — Migration 004
-- 1) Per-session time slots: each session of a day gets its own time / duration
--    / location (e.g. cardio 06:05 fasted, strength 17:00). The day-level
--    scheduled_time stays as the default for sessions without their own slot.
--    session_slots = { "<session_id>": { "time": "06:05", "duration_min": 40,
--                                        "location_id": "<uuid>" | null } }
-- 2) New session type 'agility' (ladder, reactivity, sprints with direction change).
-- 3) Structured session config (cardio modality + target zone) instead of
--    encoding it in the free-text notes.
-- Idempotent — safe to run twice.

alter table public.program_weekly_structure
  add column if not exists session_slots jsonb not null default '{}'::jsonb;

alter table public.program_sessions
  add column if not exists config jsonb not null default '{}'::jsonb;

alter table public.program_sessions
  drop constraint if exists program_sessions_type_check;
alter table public.program_sessions
  add constraint program_sessions_type_check
  check (type in ('strength','cardio','sport','mobility','recovery','agility'));
