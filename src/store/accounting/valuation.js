// Slice of accountingStore.js (split mechanically, F3 — see scripts in the plan):
// section text moved verbatim, composed back in ../accountingStore.js.
import { uid } from '../../utils/formatters';
import { accountBalances, treasuryBalance, netWorthHistory, paceFromEdges } from '../../utils/accounting-engine';
import { calculateGoalXP, badgeForGoal } from '../../utils/goals';
import { useSkillStore } from '../skillStore';
import { toast } from '../uiStore';
import { stamp, localDateKey } from './helpers';

export const valuationSlice = (set, get) => ({
      // ─────────── Corrections de valeur (ANC → ANCC) ───────────
      addCorrection: (data) => {
        const c = { ...data, id: uid(), amount: Number(data.amount), createdAt: Date.now(), updatedAt: Date.now() };
        set({ corrections: [...get().corrections, c] });
        // Another real gap: financial-statements-lv1 ("Read your own Bilan,
        // CPC, and ESG fluently") never received XP anywhere — an ANC→ANCC
        // correction is exactly that skill in action (recognizing your ANC
        // doesn't reflect real value and adjusting it).
        useSkillStore.getState().awardXP('financial-statements-lv1', 3, `correction ajoutée : ${c.label}`);
        toast(`Correction ajoutée : ${c.label}`, 'success');
        get().checkBadges();
      },
      editCorrection: (id, updates) =>
        set({ corrections: get().corrections.map((c) => (c.id === id ? stamp({ ...c, ...updates, amount: Number(updates.amount ?? c.amount) }) : c)) }),
      deleteCorrection: (id) => set({ corrections: get().corrections.filter((c) => c.id !== id) }),

      // ─────────── Objectifs financiers (v2, 2026-09-23) ───────────
      // Chaque objectif d'épargne a SON argent — plus de mesure partagée :
      //  • 'envelope' : argent mis de côté sur vos comptes (contributions
      //    affectées, sans mouvement bancaire) — la somme des enveloppes ne
      //    peut pas dépasser la trésorerie disponible ;
      //  • 'account'  : un compte de trésorerie dédié (livret, sous-compte) —
      //    progression = son solde, point de départ figé à la création ;
      //  • 'networth' : jalon de patrimoine net, point de départ figé.
      // L'ancien type 'treasury' (tous les objectifs mesuraient le MÊME solde
      // total → double comptage, objectif "atteint" dès sa création) est lu
      // comme une enveloppe vide à alimenter.
      addGoal: (data) => {
        const kind = data.kind || (data.type === 'networth' ? 'networth' : 'envelope');
        const targetAmount = Number(data.targetAmount);
        if (!data.name?.trim() || !(targetAmount > 0)) return { ok: false, error: 'Nom et montant cible requis.' };
        let startAmount = null;
        let contributions = [];
        if (kind === 'account') {
          if (!data.account) return { ok: false, error: 'Choisis le compte dédié.' };
          startAmount = accountBalances(get().journal)[data.account]?.balance || 0;
          if (startAmount >= targetAmount) return { ok: false, error: `Ce compte contient déjà ${Math.round(startAmount)} DH : fixez une cible plus haute.` };
        } else if (kind === 'networth') {
          startAmount = get().getNetWorth().ancc;
          if (startAmount >= targetAmount) return { ok: false, error: `Ton patrimoine net est déjà de ${Math.round(startAmount)} DH : fixe une cible plus haute.` };
        } else {
          const initial = Number(data.initialAmount) || 0;
          if (initial > 0) {
            const { unallocated } = get().getGoalAllocation();
            if (initial > unallocated + 0.005) return { ok: false, error: `Seulement ${Math.round(unallocated)} DH non affectés sur tes comptes.` };
            if (initial >= targetAmount) return { ok: false, error: 'Le montant de départ atteint déjà la cible.' };
            contributions = [{ id: uid(), date: localDateKey(new Date()), amount: initial, note: 'Épargne déjà constituée' }];
          }
        }
        const goal = {
          id: uid(), kind, name: data.name.trim(), targetAmount, targetDate: data.targetDate || '',
          account: kind === 'account' ? data.account : null, startAmount, contributions,
          achieved: false, achievedAt: null, createdAt: Date.now(), updatedAt: Date.now(),
        };
        set({ goals: [...get().goals, goal] });
        toast(`Objectif créé : ${goal.name}`, 'success');
        return { ok: true, id: goal.id };
      },
      editGoal: (id, updates) =>
        set({ goals: get().goals.map((g) => (g.id === id ? stamp({ ...g, name: updates.name ?? g.name, targetDate: updates.targetDate ?? g.targetDate, targetAmount: Number(updates.targetAmount ?? g.targetAmount) }) : g)) }),
      deleteGoal: (id) => set({ goals: get().goals.filter((g) => g.id !== id) }),

      // Put money aside for an envelope goal (negative = take it back).
      contributeGoal: (id, amount, note = '') => {
        const g = get().goals.find((x) => x.id === id);
        const amt = Math.round(Number(amount) * 100) / 100;
        if (!g || !amt) return { ok: false, error: 'Montant invalide.' };
        const kind = g.kind || (g.type === 'networth' ? 'networth' : 'envelope');
        if (kind !== 'envelope') return { ok: false, error: 'Cet objectif suit un compte : faites un virement vers ce compte.' };
        const current = (g.contributions || []).reduce((s, c) => s + Number(c.amount), 0);
        if (amt > 0) {
          const { unallocated } = get().getGoalAllocation();
          if (amt > unallocated + 0.005) return { ok: false, error: `Seulement ${Math.round(unallocated)} DH non affectés sur tes comptes.` };
        } else if (-amt > current + 0.005) return { ok: false, error: `L'enveloppe ne contient que ${Math.round(current)} DH.` };
        set({ goals: get().goals.map((x) => (x.id === id ? stamp({ ...x, kind, contributions: [...(x.contributions || []), { id: uid(), date: localDateKey(new Date()), amount: amt, note }] }) : x)) });
        return { ok: true };
      },

      // Money on your accounts vs money already earmarked by envelope goals.
      getGoalAllocation: () => {
        const treasury = treasuryBalance(get().journal);
        const balances = accountBalances(get().journal);
        let allocated = 0;
        let dedicated = 0;
        for (const g of get().goals) {
          if (g.achieved) continue;
          const kind = g.kind || (g.type === 'networth' ? 'networth' : 'envelope');
          if (kind === 'envelope') allocated += (g.contributions || []).reduce((s, c) => s + Number(c.amount), 0);
          if (kind === 'account' && g.account) dedicated += balances[g.account]?.balance || 0;
        }
        const r = (v) => Math.round(v * 100) / 100;
        return { treasury: r(treasury), allocated: r(allocated), dedicated: r(dedicated), unallocated: r(treasury - allocated - dedicated) };
      },

      // Lignes enrichies pour l'UI : valeur actuelle, rythme, effort mensuel, projection.
      getGoalRows: () => {
        const journal = get().journal;
        const corrections = get().corrections;
        const balances = accountBalances(journal);
        const nwHist = netWorthHistory(journal, corrections, 6);
        const nwPace = paceFromEdges(nwHist, 'ancc');
        const nwCurrent = get().getNetWorth().ancc;
        const now = Date.now();
        const todayK = localDateKey(new Date());
        const monthsUntil = (date) => Math.max(0, (new Date(`${date}T12:00:00`).getTime() - now) / (30.44 * 86400000));

        return get().goals.map((raw) => {
          const kind = raw.kind || (raw.type === 'networth' ? 'networth' : 'envelope');
          const g = { ...raw, kind, type: kind === 'networth' ? 'networth' : 'treasury', contributions: raw.contributions || [] };
          // Achieved goals are closed: frozen at the amount actually reached.
          if (g.achieved) {
            const amount = g.achievedAmount ?? g.targetAmount;
            const progress = g.targetAmount > 0 ? Math.max(0, Math.min(100, (amount / g.targetAmount) * 100)) : null;
            return { ...g, current: amount, pace: null, progress, projected: null, onTrack: null, neededPerMonth: null };
          }
          const ageMonths = (now - (g.createdAt || now)) / (30.44 * 86400000);
          let current; let pace = null;
          let judgeAge = ageMonths;
          if (kind === 'envelope') {
            current = g.contributions.reduce((s, c) => s + Number(c.amount), 0);
            // Rhythm is judged from the first real contribution, not creation
            // (a migrated or brand-new envelope isn't "late" before its first euro).
            const firstReal = g.contributions.filter((c) => c.note !== 'Épargne déjà constituée').map((c) => c.date).sort()[0];
            judgeAge = firstReal ? (now - new Date(`${firstReal}T12:00:00`).getTime()) / (30.44 * 86400000) : 0;
            const since = localDateKey(new Date(now - 90 * 86400000));
            const recent = g.contributions.filter((c) => c.date >= since && c.note !== 'Épargne déjà constituée').reduce((s, c) => s + Number(c.amount), 0);
            pace = recent / Math.min(3, Math.max(1, ageMonths));
          } else if (kind === 'account') {
            current = balances[g.account]?.balance || 0;
            pace = g.startAmount != null ? (current - g.startAmount) / Math.max(1, ageMonths) : null;
          } else {
            current = nwCurrent;
            pace = nwPace;
          }
          current = Math.round(current * 100) / 100;
          // Progress from the starting point for account / net-worth goals
          // (legacy goals without a start fall back to current/target).
          const base = kind !== 'envelope' && g.startAmount != null && g.startAmount < g.targetAmount ? g.startAmount : 0;
          const progress = g.targetAmount > base ? Math.max(0, Math.min(100, ((current - base) / (g.targetAmount - base)) * 100)) : null;
          const left = g.targetDate && g.targetDate > todayK ? monthsUntil(g.targetDate) : null;
          const remaining = Math.max(0, g.targetAmount - current);
          const neededPerMonth = left != null ? Math.round(remaining / Math.max(0.5, left)) : null;
          const projected = left != null && pace != null ? Math.round(current + pace * left) : null;
          // Too young to judge a rhythm → no verdict rather than a false alarm.
          const onTrack = projected != null && judgeAge >= 1 ? projected >= g.targetAmount : null;
          return { ...g, current, pace, progress, projected, onTrack, neededPerMonth, monthsLeft: left };
        });
      },

      // Idempotent : XP + badge une seule fois, au franchissement du seuil.
      // achievedAmount freezes what getGoalRows() displays forever after —
      // see its comment above for why that matters.
      checkGoalAchievement: (goalId, current) => {
        const goal = get().goals.find((g) => g.id === goalId);
        if (!goal || goal.achieved || current < goal.targetAmount) return;
        const xp = calculateGoalXP(goal.targetAmount);
        const badge = badgeForGoal(goal.targetAmount);
        set({ goals: get().goals.map((g) => (g.id === goalId ? stamp({ ...g, achieved: true, achievedAt: Date.now(), achievedAmount: current, xpAwarded: xp, badge }) : g)) });
        const skillId = (goal.kind || goal.type) === 'networth' ? 'ratio-analysis-lv1' : 'treasury-planning-lv1';
        useSkillStore.getState().awardXP(skillId, xp, `objectif atteint : ${goal.name}`);
        toast(`🎉 Objectif atteint : ${goal.name} · +${xp} XP · Badge : ${badge}`, 'success');
        get().checkBadges();
      },
});
