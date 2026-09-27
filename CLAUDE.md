# Vaudax — règles du projet

Programme en cours : **THE BIG PLAN** (https://claude.ai/artifact/J11wncYdy83wzX6W3a5CsY).
Phase 1 « Restructuration » (oct → déc 2026), étapes 0 → 5. Travaille UN chantier par session
(ex. « F2 · synchronisation »), et termine-le avant d'en ouvrir un autre.

## Comment parler à l'utilisateur
- Français simple, phrases courtes, zéro jargon non expliqué. Il ne lit pas le code.
- Message ambigu ou multi-points → poser la question AVANT de coder. Ne jamais deviner.
- Pas de vocabulaire « conte de fée » dans les livrables (pas de royaume, tomes…) : ton de projet sérieux.
- Dire honnêtement ce qui est testé, ce qui ne l'est pas, et ce qui reste à faire de son côté.

## Décisions prises (27 sept 2026) — ne pas rediscuter
1. Nom : **VAUDAX** partout (fait). Les clés techniques `audax-*` (localStorage, sauvegardes) ne changent JAMAIS.
2. Interface en **tutoiement** partout, en français. **Exception : le Trading reste en anglais.**
3. IA du site : **Gemini, offre gratuite uniquement**. **Budget du projet = 0** : aucune dépense, jamais (pas d'IA payante,
   pas de store payant, pas d'offre Vercel/Supabase payante). Ne JAMAIS redemander un budget ou un plafond.
4. **Cercle privé** d'abord (pas d'ouverture publique : loi 09-08 / CNDP non traitée).
5. Mode de notation « classique » : une matière sous la note éliminatoire bloque le semestre.
6. Modules secondaires (Ingénierie, Immobilier, Levée de fonds, Création) **masqués** pour les nouveaux utilisateurs, activables.

## Principe clé : pour tous les profils
Site multi-utilisateurs (chaque personne sur ses appareils, son compte). Aucune fonction, aucun texte,
aucun exemple ne doit supposer un métier, une école (ISCAE), un pays ou une devise (MAD). Les cas
particuliers = des modèles configurables parmi d'autres.

## Stack
React 18 + Vite 6 + Tailwind 4, Zustand (persist localStorage), PWA (vite-plugin-pwa, `public/sw-push.js`),
Supabase (auth + table `app_state` : une ligne JSON par utilisateur et par store), API Vercel dans `api/`.
- Synchro cloud : `src/services/cloud-sync.js` (REGISTRY = les 21 stores ; `fillDefaults` / `mergeFirstSync`
  dans `src/utils/fill-defaults.js` ; propriétaire des données locales par compte).
- `financeStore.js` est l'ancienne compta (morte) ; la vraie est `accountingStore.js`.
- Rappels push : `api/class-reminders.js` (cours + Santé), appelé toutes les 5 min par pg_cron Supabase
  (`supabase/migrations/005_class_reminders_cron.sql`, authentification par nonce, aucun secret dans le SQL).
- IA (étape 4, fait) : **Gemini offre gratuite** uniquement, via `api/_lib/gemini.js` (clé `GEMINI_API_KEY` côté Vercel,
  projet Google SANS facturation). Assistant unique `api/assistant.js` (réponse en flux) + coachs Trading/Santé/Ingénierie
  (`api/_lib/coach.js`). Garde commune `api/_lib/ai-guard.js` : utilisateur connecté + 30 questions/jour/personne
  (table `ai_usage`, migration 008 appliquée). Le navigateur construit le résumé des données : `src/utils/assistant-context.js`.
- Navigation (étape 3, fait) : source unique `src/utils/navigation.js` (modules, pôles, activation). Accueil : `src/utils/onboarding-plan.js`.

## Design (étape 2, fait)
- Composants communs dans `src/components/common/ui.jsx` : Card, Stat, Button, IconButton, Field/Input/Select,
  Modal (panneau par le bas sur téléphone, Échap), DataTable (cartes sur téléphone), EmptyState (icône + bouton),
  Badge, ProgressBar, playSeal (l'unique animation de validation). Graphiques : `components/common/chart-theme.js`.
  Planning : `components/common/gantt/GanttChart.jsx`. Page de référence : `/design`.
- Couleurs = variables CSS de `src/styles/globals.css` (jamais de couleur en dur). Chiffres : classe `font-data`.
- Aucun écran au-dessus de 600 lignes : découper en composants (`scratchpad split_file.py` recalcule les imports).

## Commandes
- `npm run dev` — serveur de dev (le démarrer via preview_start, jamais en Bash).
- `npm run build` — doit passer avant tout commit.
- `npm test` — `node --test tests/*.test.mjs` (aucune dépendance). Les modules testés importent avec
  l'extension `.js` explicite (ils sont aussi importés par `api/` en Node pur).

## Vérifier dans l'application sans toucher aux vraies données
1. Créer `.env.uitest.local` avec `VITE_SUPABASE_URL=` et `VITE_SUPABASE_ANON_KEY=` vides.
2. Ajouter temporairement à `.claude/launch.json` : `{"name":"uitest","runtimeExecutable":"npx","runtimeArgs":["vite","--mode","uitest","--port","5199"],"port":5199}`.
3. preview_start `uitest`, profil local (nom + genre obligatoires).
4. APRÈS : supprimer `.env.uitest.local` et remettre `launch.json` (`git checkout -- .claude/launch.json`).

## Définition de « terminé »
Build OK → `npm test` vert → vérification dans l'app de test → commit (message en anglais, conventionnel)
→ `git push origin main` (GitHub Actions : tests puis déploiement Vercel ; vérifier avec `gh run list`)
→ mémoire du projet mise à jour → compte rendu en français simple.
Ne jamais commiter du travail qui n'est pas le tien sans le signaler.
