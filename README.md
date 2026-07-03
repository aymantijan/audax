# AUDAX — Life & Trading Companion

A local-first life & trading optimization platform: real-time P&L tracking with edge validation, academic progress, personal finance, energy/habit tracking with burnout early warning, a Shield Hero–style skill tree, and a unified synergy score across all domains.

## Stack

React 18 + Vite · Tailwind CSS 4 · Zustand (persisted) · Recharts · Zod · date-fns · lucide-react

**Local-first:** all data persists in browser localStorage (`audax-*` keys). No account, no server, works fully offline. JSON export/import in Settings is the backup mechanism. Optional Firebase cloud sync is planned as a later phase — the store layer is the only thing that needs a sync adapter.

**Navigation:** a fixed horizontal top navbar (`components/layout/Navbar.jsx`), full-width content below. Theme lives in the user profile (not a separate key), so the toggle stays in sync across reloads.

**Skill Tree map:** `components/skills/SkillTreeMap.jsx` renders the 211 skills as an interactive D3 collapsible tree (root → category → subcategory → skill). Drag to pan, scroll to zoom, click a branch to expand/collapse, click a skill for its detail modal. Search auto-expands and highlights matches (dimming the rest); a category filter and expand/collapse-all/fit controls sit above it. Node color: green = unlocked & practiced, blue = unlocked & untouched, gray = locked.

**One-time data wipe:** `services/storage.js` clears leftover demo data once per browser (guarded by the `audax-demo-cleared` flag) at module-import time — *before* any Zustand store hydrates, which is why it lives in an imported module rather than a React effect. Importing a backup calls `markDataSeeded()` so a restore is never wiped on reload.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
```

Deploy: push to a Git repo and import into Vercel (zero config — `vercel.json` handles SPA rewrites).

## Data model (all in `src/store/`, persisted via zustand/persist)

| Store | Contents |
|---|---|
| `authStore` | local profile: name, email, primary domain, theme |
| `tradingStore` | trades (prices, direction, PnL, pips, journal, linked skills) |
| `learningStore` | courses (credits, grades, readings, linked skills) |
| `financeStore` | transactions, monthly budgets, net worth snapshots |
| `habitStore` | habits (frequency, duration, target streak), daily logs, energy logs |
| `skillStore` | 412 predefined skills: level 1–5, XP, unlock prereqs, decay status, career track, manual acquisition |
| `dealsStore` | PE/VC/GE/RBF deals (type, size, role, status) with XP auto-award to PE skills |

## Core mechanics (`src/utils/`)

- **XP flow** — logging a trade awards +5 XP per linked skill; completing a course awards grade-based XP (A=15 … F=0); checking a habit awards its XP to its linked skill. Level-ups unlock dependent skills once prereqs hit Lv2+. Deleting a trade reverses its XP.
- **Skill decay** — checked on app load: >60 days unpracticed → warning, >90 days → drop one level.
- **Sleep quality** (`sleep-quality.js`) — duration base score + bedtime chronotype bonus (optimal 22:00–23:00), clamped 1–10.
- **Stress** (`stress-calculator.js`) — 10-item checklist (0–3 each) normalized to 1–10.
- **Burn rate** (`calculations.js`) — 7-day average daily loss projected monthly; green <5%, yellow 5–10%, red >10% of account, with runway estimate. Starting account value: $52,000 (`constants.js`).
- **Burnout triggers** (`burnout.js`) — low energy 3 days, high stress / poor sleep 5 of 7 days, habit compliance <30%, win-rate drop >15% vs 55% baseline.
- **Synergy** (`synergy.js`) — five 0–100 domain scores (trading, learning, finance, health, growth), plus average and weighted composite (primary domain ×0.75, others ×0.25). *Deviation from the original spec:* the spec's formulas divided each weighted sum by 3, which caps every score near 33 and breaks the green/yellow/red thresholds — implemented as proper 0–100 weighted averages instead.
- **Pre-trading checklist** — journaled <24h, stress ≤7, sleep >6h, energy >5, streak active. All green → "Clear to trade"; otherwise the Log Trade button stays disabled until an explicit "proceed at own risk" override.
- **Advanced analytics** (`analytics.js`) — annualized Sharpe/Sortino (daily returns vs. starting account, rf=0, √252), Calmar, recovery factor, max win/loss streaks, win rate by day-of-week, per-strategy comparison, instrument correlation matrix (daily P&L on ≥3 shared days), top-3 winner concentration, and macro-regime edge (win rate per macro tag).
- **Macro context** — each trade can be tagged with Fed policy / inflation / growth / risk sentiment / volatility / USD strength; the Macro Regime Edge card shows how the win rate splits per regime.

## Currency

Trading is denominated in **USD ($)**; personal finance (net worth, budgets, transactions, goals) is in **Moroccan dirhams (DH)** at a fixed 1 USD = 10 MAD peg (`USD_TO_MAD` in `formatters.js`). The only cross-domain conversion is a trading-account goal measured against a dirham target.

## Accounts (demo / real)

The profile holds two trading accounts — `demo` ($52k default) and an optional `real` account the user funds (broker, leverage, risk acknowledgement) — plus an `activeAccount` toggle (`AccountSwitcher`). Trades are tagged `accountType`; Trading and Dashboard scope all P&L/equity/burn/metrics to the active account using that account's initial balance. Skills, courses, habits, and deals are shared across both. Existing profiles are backfilled via the auth store's v1 `merge`.

## Career track & PE/Deals

The profile has a `careerGoal` (PE/GE/VC/RBF/Trading/Hybrid). Every skill carries a `track`; the Skill Tree map has a career-track filter. The **PE/Deals** tab (`dealsStore` + `pages/Deals.jsx`) logs deals (type/size/role/status) and auto-awards XP to the relevant PE/VC/GE/RBF skills (deal-type skills +10, deal-sourcing/valuation/modeling cross-cutting), reversed on delete.

## Auto-award & manual acquisition

Logging a trade now auto-awards XP beyond user-linked skills: strategy +5, instrument +5, discipline +2, each macro tag +3, profit +5 / loss-within-stop +3 (`autoAwardsFor` in `tradingStore`). Locked skills are skipped. A skill's detail modal has **"I've acquired this skill"** — sets it to Lv2 with 0 XP, flagged `manualAcquired`, unlocking dependents.

## Cloud auth + sync (optional — Supabase)

Real email/password auth, verification, reset, and 2FA are provided by Supabase and activate only when `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are set — otherwise the app stays local-first. Once logged in with a cloud account, all 7 stores (trading, finance, deals, learning, habits, skills, profile) sync to a single Supabase table (`app_state`: one JSONB row per store per user) with debounced push-on-change and Realtime pull for multi-device sync. See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) and [DEPLOY.md](DEPLOY.md). Services: `services/supabase.js`, `services/auth-supabase.js`, `services/cloud-sync.js`; UI: `components/auth/CloudAuthPanel.jsx`. Requires running `supabase/schema.sql` once in the Supabase SQL Editor (not automatable — no DDL access via the client keys).

## Skill tree (412 skills)

Base (211) in `src/utils/skill-tree-data.js` (Trading 60 · Finance 50 · Knowledge 71 · Soft Skills 20 · Discipline 10) merged with professional/academic skills in `src/utils/professional-skills.js` (Private Equity 42 · Growth Equity 24 · Venture Capital 26 · Revenue-Based Financing 16 · Advanced Trading 40 · Academics/ISCAE 53). Per the agreed scope, ISCAE is a **curated** academic set (real modules), not the spec's ~990 auto-generated nodes. Validated: 0 duplicate ids, 0 missing prereqs, 0 unreachable. The original base counts: "LvN" in a skill *name* is its tier in the progression chain (a separate node); each node also has its own internal level 1–5. A node unlocks when all its prerequisite nodes reach internal Lv2+. Nine foundation skills (Currency Pairs, Commodity Markets, Volatility/Correlation Analysis, Statistical Modeling, Technical Analysis) were added beyond the original spec because its prerequisites referenced skills it never defined — validated: no duplicate ids, no missing prereqs, no unreachable nodes.

## Templates

- **Courses** (`course-templates.js`) — 89 archetypes across Academic / Certification / Professional Training / Self-Directed / Micro-Course groups; picking one prefills the name and its suggested linked skills (locked skills are filtered out).
- **Habits** (`habit-templates.js`) — 55 templates across Trading / Learning / Finance / Health & Recovery / Reflection with frequency, duration, XP, mandatory flag, and linked skill.
- **Finance** — 50+ grouped expense categories, 9 income sources, fixed and %-of-income budgets, 10 asset + 6 liability types per net-worth snapshot, and financial goals with linear-pace forecasting from snapshot history.

## Structure

```
src/
├── pages/            Dashboard, Trading, Learning, Finance, Habits, Skills, Settings, Welcome
├── components/
│   ├── common/ui.jsx        shared kit: Card, Stat, Button, Modal, ProgressBar, Toast…
│   ├── common/SkillPicker   searchable selector over the 211-skill tree
│   ├── layout/MainLayout    horizontal Navbar + full-width content + toasts
│   ├── layout/Navbar        top nav: logo · links · theme · settings · profile · logout (+ mobile menu)
│   ├── skills/SkillTreeMap   D3 collapsible tree visualization (zoom/pan/search/filter)
│   └── trading/             TradeForm, PreTradingChecklist, BurnRateTracker, AdvancedAnalytics
├── store/            zustand stores (persisted)
├── hooks/useSynergy  live synergy + daily snapshot history for trends
├── utils/            calculations, synergy, burnout, sleep/stress, validators (zod), constants
└── styles/globals.css  theme tokens (dark default) mapped to Tailwind utilities
```

## Theming

Dark mode default. CSS variables in `globals.css` follow the spec palette exactly; toggling the sun/moon icon flips `data-theme` on `<html>`. Tailwind utilities (`bg-base`, `text-ink`, `border-line`, …) are mapped to the variables via `@theme inline`.
