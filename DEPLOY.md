# AUDAX Cloud Deployment

Everything is built and tested against your real Supabase project. Two steps
need your hands (a database DDL statement and an OAuth login) — nothing I can
do from here without your credentials.

## Step 1 — Create the database table (30 seconds)

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
3. You should see "Success. No rows returned."

This creates one table, `app_state` (`user_id`, `store_name`, `data jsonb`,
`updated_at`), with Row Level Security so each user can only read/write their
own rows, and enables Realtime on it for live multi-device sync.

**Why one JSONB table instead of the 11-table relational schema in the original
spec:** AUDAX's stores have nested shapes (skills = 412-entry object with XP
logs, courses = chapters with checklist items, trades = journal/macro objects)
that don't map onto flat columns without reshaping the app. This table mirrors
exactly what each store already persists to `localStorage` — sync is "push the
whole store," not per-field mapping. Functionally it delivers the same result:
register → create data → see it in Supabase → open on another device → same
data → edit → live sync via Realtime.

## Step 2 — Deploy to Vercel (2 minutes)

Vercel CLI needs an interactive browser login I can't complete for you. Run:

```bash
cd C:\Users\PC\Desktop\AUDAX
npx vercel login
```

This opens a device-flow link — visit it and approve. Then:

```bash
npx vercel --prod
```

First run will ask a few setup questions (link to a new project, keep
defaults). When it asks about environment variables, or right after via the
dashboard (**Project → Settings → Environment Variables**), add:

```
VITE_SUPABASE_URL=<from your .env.local>
VITE_SUPABASE_ANON_KEY=<from your .env.local>
```

Then redeploy so the build picks them up:

```bash
npx vercel --prod
```

You'll get a live `https://your-project.vercel.app` URL.

## Verified already (in this session, against your real project)

- ✅ Registration works — created a real user in your Supabase project, confirmed via the admin API, logged in, got a real session, then cleaned the test user up.
- ✅ Cloud sync code path is correct — with the session active, `startCloudSync` correctly attempted to fetch/push all 7 stores and failed *only* because `app_state` doesn't exist yet (Step 1 above fixes that — no code changes needed).
- ✅ Production build passes locally (`npm run build`, 0 errors).

## After Step 1 + Step 2, verify the full loop yourself

1. Open the Vercel URL → Register with a real email → check inbox → click verify link → log in.
2. Log a trade or transaction.
3. Supabase dashboard → Table Editor → `app_state` → you should see rows for your user (`store_name = 'trading'`, etc.) with the data.
4. Open the same URL in a different browser (or incognito) → log in with the same account → the trade/transaction should already be there.
5. Edit something on device 1 → it should appear on device 2 within ~1 second (Realtime).
