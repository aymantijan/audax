-- Chantier 8 (C3) · appearing in the ranking becomes a choice.
-- The app now writes a leaderboard row only for people who chose to appear
-- (user.leaderboardOptIn, under a pseudonym) and deletes its own row
-- otherwise — which needs a delete policy. Everyone starts hidden: existing
-- rows are removed; they come back as soon as someone opts in.
-- Safe to re-run.

drop policy if exists "delete own leaderboard_profiles" on public.leaderboard_profiles;
create policy "delete own leaderboard_profiles"
  on public.leaderboard_profiles for delete
  using (auth.uid() = user_id);

delete from public.leaderboard_profiles;
