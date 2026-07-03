# Cloud Auth Setup (Supabase)

AUDAX runs **local-first with no account by default**. The spec's Part 2 auth —
email verification, password reset, 2FA, JWT sessions — is genuinely server-side,
so it's provided through Supabase (a free hosted backend). Until you configure it,
the app uses the on-device local profile and nothing here is required.

## What's already built

- `src/services/supabase.js` — creates the client from env vars; exports `isSupabaseConfigured`.
- `src/services/auth-supabase.js` — `register`, `login`, `requestPasswordReset`, `updatePassword`, `enroll2FA` / `verify2FA`, `logout`, `getSession`, `onAuthChange`, plus `validatePasswordStrength` (min 12 chars · upper/lower/number/special, per spec).
- `src/components/auth/CloudAuthPanel.jsx` — the Welcome-screen login/register/forgot panel that appears **only when configured**.

Supabase handles the hard, must-be-server parts for real: **bcrypt password hashing**,
**email verification**, **secure password reset**, **JWT + refresh-token rotation**
(the SDK persists and auto-refreshes the session — the browser equivalent of the
spec's httpOnly-cookie flow), and **TOTP 2FA**. Rate limiting, HTTPS, and CORS are
enforced by Supabase's platform.

## Turn it on

1. Create a free project at https://supabase.com.
2. Project Settings → API: copy the **Project URL** and the **anon public** key.
3. In the repo root, copy `.env.example` to `.env` and fill in:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
4. In Supabase → Authentication → Providers, keep **Email** enabled (confirmation email on).
5. Authentication → URL Configuration: add your dev URL (e.g. `http://localhost:5173`)
   and your Vercel domain to the redirect allow-list.
6. Restart `npm run dev`. The Welcome screen now shows the cloud auth panel.

On Vercel, set the same two env vars in Project → Settings → Environment Variables.

## Cloud data sync (built — needs one SQL step from you)

Beyond auth, all 7 app stores (trading, finance, deals, learning, habits, skills,
and the local profile) now sync to Supabase when you're logged in with a cloud
account: `src/services/cloud-sync.js`. On login it hydrates local stores from
the cloud (or seeds the cloud from local data on first-ever login), then pushes
every subsequent change (debounced) and listens for Realtime updates from other
devices/tabs. Local-first is unaffected when not logged in with a cloud account.

**This requires one manual step:** run [`supabase/schema.sql`](supabase/schema.sql)
in your Supabase SQL Editor once (creates the `app_state` table + RLS policies).
See [DEPLOY.md](DEPLOY.md) for the full walkthrough and why it's one JSONB table
rather than the spec's 11 relational tables.

## What this does and doesn't do (be clear-eyed)

- **Does:** real credential gate, verified emails, secure resets, 2FA, cross-device identity, cross-device data sync (trades/finance/courses/habits/skills/deals) once the SQL step above is run.
- **Doesn't:** conflict-resolve concurrent edits from two devices at the same instant — it's last-write-wins per store, which is fine for a single user across their own devices but not built for true multi-user collaboration.
