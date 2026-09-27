-- 010 · Challenges between friends (private circle): a challenge is visible
-- only to its members; people join with a 6-character code; each member
-- publishes only their own score for the challenge's measure, never their data.
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  metric text not null check (metric in ('attendance', 'habits', 'focus', 'reading', 'workouts')),
  starts date not null,
  ends date not null check (ends >= starts),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.challenge_members (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 40),
  score numeric not null default 0,
  detail text not null default '' check (char_length(detail) <= 80),
  updated_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

alter table public.challenges enable row level security;
alter table public.challenge_members enable row level security;

-- Membership test outside RLS (avoids a policy that queries its own table).
create or replace function public.is_challenge_member(p_challenge uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.challenge_members where challenge_id = p_challenge and user_id = auth.uid());
$$;
revoke all on function public.is_challenge_member(uuid) from public, anon;
grant execute on function public.is_challenge_member(uuid) to authenticated;

drop policy if exists "challenges: members read" on public.challenges;
create policy "challenges: members read" on public.challenges for select to authenticated
  using (owner = auth.uid() or public.is_challenge_member(id));
drop policy if exists "challenges: owner creates" on public.challenges;
create policy "challenges: owner creates" on public.challenges for insert to authenticated
  with check (owner = auth.uid());
drop policy if exists "challenges: owner edits" on public.challenges;
create policy "challenges: owner edits" on public.challenges for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "challenges: owner deletes" on public.challenges;
create policy "challenges: owner deletes" on public.challenges for delete to authenticated
  using (owner = auth.uid());

drop policy if exists "members: members read" on public.challenge_members;
create policy "members: members read" on public.challenge_members for select to authenticated
  using (public.is_challenge_member(challenge_id));
-- The owner adds themself when creating; everyone else joins through join_challenge().
drop policy if exists "members: owner joins own" on public.challenge_members;
create policy "members: owner joins own" on public.challenge_members for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.challenges c where c.id = challenge_id and c.owner = auth.uid()));
drop policy if exists "members: own score" on public.challenge_members;
create policy "members: own score" on public.challenge_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "members: leave or owner removes" on public.challenge_members;
create policy "members: leave or owner removes" on public.challenge_members for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.challenges c where c.id = challenge_id and c.owner = auth.uid()));

-- Join with a code: returns the challenge id, or null when the code is unknown.
create or replace function public.join_challenge(p_code text, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then return null; end if;
  select id into cid from public.challenges where code = upper(trim(p_code));
  if cid is null then return null; end if;
  insert into public.challenge_members (challenge_id, user_id, display_name)
  values (cid, auth.uid(), left(coalesce(p_name, ''), 40))
  on conflict (challenge_id, user_id) do update set display_name = excluded.display_name;
  return cid;
end;
$$;
revoke all on function public.join_challenge(text, text) from public, anon;
grant execute on function public.join_challenge(text, text) to authenticated;

grant select, insert, update, delete on public.challenges, public.challenge_members to authenticated;
revoke all on public.challenges, public.challenge_members from anon;
