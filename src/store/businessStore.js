import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '../utils/formatters';
import { validateEntry, accountBalances, balanceSheet, cpc, financialAnalysis, treasuryBalance } from '../utils/accounting-engine';
import { BUSINESS_ACCOUNT_MAP } from '../utils/business-accounts';
import { cascadeSchedule, pruneDependencies } from '../utils/gantt';
import { useSkillStore } from './skillStore';
import { toast } from './uiStore';

const stamp = (obj) => ({ ...obj, updatedAt: Date.now() });

// Suivi de business "de A à Z" : phases (jalons datés), événements (idées &
// faits horodatés — la matière première de la timeline), KPIs + leurs relevés,
// et une comptabilité générale marocaine très simplifiée PAR business (son
// propre journal en partie double, réutilisant le même moteur pur que Finance
// — accounting-engine.js — avec le plan comptable allégé de business-accounts.js).
// On peut suivre plusieurs businesses en parallèle, chacun totalement isolé.
export const useBusinessStore = create(
  persist(
    (set, get) => ({
      businesses: [], // [{ id, name, sector, description, status, createdAt, updatedAt, phases:[], tasks:[], events:[], kpis:[], kpiLogs:[], journal:[] }]

      // ─────────── Businesses ───────────
      addBusiness: (data) => {
        if (!data.name?.trim()) return { ok: false, error: 'Le nom est requis.' };
        const biz = {
          id: uid(),
          name: data.name.trim(),
          sector: data.sector || '',
          description: data.description || '',
          status: data.status || 'idea', // 'idea' | 'active' | 'paused' | 'closed'
          createdAt: Date.now(),
          updatedAt: Date.now(),
          phases: [],
          events: [],
          kpis: [],
          kpiLogs: [],
          journal: [],
          tasks: [],
        };
        set({ businesses: [...get().businesses, biz] });
        useSkillStore.getState().awardXP('pe-deal-sourcing', 5, `business créé : ${biz.name}`);
        toast(`Business créé : ${biz.name}`, 'success');
        return { ok: true, id: biz.id };
      },
      editBusiness: (id, updates) => set({ businesses: get().businesses.map((b) => (b.id === id ? stamp({ ...b, ...updates }) : b)) }),
      deleteBusiness: (id) => set({ businesses: get().businesses.filter((b) => b.id !== id) }),
      getBusiness: (id) => get().businesses.find((b) => b.id === id),

      // ─────────── Phases ───────────
      addPhase: (bizId, data) => {
        if (!data.name?.trim()) return { ok: false, error: 'Le nom de la phase est requis.' };
        const biz = get().getBusiness(bizId);
        if (!biz) return { ok: false, error: 'Business introuvable.' };
        const phase = {
          id: uid(),
          name: data.name.trim(),
          startDate: data.startDate || null,
          endDate: data.endDate || null,
          status: data.status || 'upcoming', // 'upcoming' | 'active' | 'done'
          order: biz.phases.length,
          notes: data.notes || '',
          createdAt: Date.now(),
        };
        set({ businesses: get().businesses.map((b) => (b.id === bizId ? stamp({ ...b, phases: [...b.phases, phase] }) : b)) });
        return { ok: true, id: phase.id };
      },
      editPhase: (bizId, phaseId, updates) => {
        const biz = get().getBusiness(bizId);
        const phase = biz?.phases.find((p) => p.id === phaseId);
        const wasDone = phase?.status === 'done';
        set({
          businesses: get().businesses.map((b) =>
            b.id === bizId ? stamp({ ...b, phases: b.phases.map((p) => (p.id === phaseId ? { ...p, ...updates } : p)) }) : b
          ),
        });
        // XP au passage à 'done' — un jalon franchi, comparable à une phase Prop
        // Firm passée (Trading) : effort et rareté similaires pour un business.
        if (updates.status === 'done' && !wasDone && biz) {
          useSkillStore.getState().awardXP('pe-acquisition-valuation', 15, `phase franchie : ${phase?.name} (${biz.name})`);
          toast(`Phase franchie : ${phase?.name} · +15 XP`, 'success');
        }
      },
      deletePhase: (bizId, phaseId) =>
        set({
          businesses: get().businesses.map((b) =>
            b.id === bizId
              ? stamp({
                  ...b,
                  phases: b.phases.filter((p) => p.id !== phaseId),
                  tasks: pruneDependencies((b.tasks || []).filter((t) => t.phaseId !== phaseId)),
                })
              : b
          ),
        }),

      // ─────────── Tâches (par phase, avec dépendances — un vrai Gantt planifié) ───────────
      // Toute écriture qui touche aux dates ou aux dépendances repasse par
      // cascadeSchedule : un prédécesseur qu'on déplace repousse automatiquement
      // ses successeurs (planification finish-to-start), comme dans un vrai
      // outil de gestion de projet — pas juste des barres colorées indépendantes.
      addTask: (bizId, data) => {
        if (!data.name?.trim()) return { ok: false, error: 'Le nom de la tâche est requis.' };
        if (!data.phaseId) return { ok: false, error: 'La phase est requise.' };
        const biz = get().getBusiness(bizId);
        if (!biz) return { ok: false, error: 'Business introuvable.' };
        const start = data.startDate || new Date().toISOString().slice(0, 10);
        const milestone = !!data.milestone;
        const end = milestone ? start : data.endDate && data.endDate >= start ? data.endDate : start;
        const deps = Array.isArray(data.dependencies) ? data.dependencies.filter((d) => (biz.tasks || []).some((t) => t.id === d)) : [];
        const task = {
          id: uid(),
          phaseId: data.phaseId,
          name: data.name.trim(),
          startDate: start,
          endDate: end,
          milestone,
          dependencies: deps,
          progress: Math.max(0, Math.min(100, Number(data.progress) || 0)),
          status: data.status || 'todo', // 'todo' | 'in_progress' | 'done'
          order: (biz.tasks || []).length,
          createdAt: Date.now(),
        };
        const next = cascadeSchedule([...(biz.tasks || []), task]);
        set({ businesses: get().businesses.map((b) => (b.id === bizId ? stamp({ ...b, tasks: next }) : b)) });
        return { ok: true, id: task.id };
      },
      editTask: (bizId, taskId, updates) => {
        const biz = get().getBusiness(bizId);
        const task = (biz?.tasks || []).find((t) => t.id === taskId);
        if (!biz || !task) return;
        const wasDone = task.status === 'done';
        const clean = { ...updates };
        if (clean.progress != null) clean.progress = Math.max(0, Math.min(100, Number(clean.progress) || 0));
        if (clean.dependencies) clean.dependencies = clean.dependencies.filter((d) => d !== taskId && (biz.tasks || []).some((t) => t.id === d));
        const merged = { ...task, ...clean };
        if (merged.milestone) merged.endDate = merged.startDate;
        else if (merged.endDate < merged.startDate) merged.endDate = merged.startDate;
        const next = cascadeSchedule((biz.tasks || []).map((t) => (t.id === taskId ? merged : t)));
        set({ businesses: get().businesses.map((b) => (b.id === bizId ? stamp({ ...b, tasks: next }) : b)) });
        if (clean.status === 'done' && !wasDone) {
          useSkillStore.getState().awardXP('pe-deal-sourcing', 5, `tâche terminée : ${task.name} (${biz.name})`);
          toast(`Tâche terminée : ${task.name} · +5 XP`, 'success');
        }
      },
      deleteTask: (bizId, taskId) =>
        set({
          businesses: get().businesses.map((b) =>
            b.id === bizId ? stamp({ ...b, tasks: pruneDependencies((b.tasks || []).filter((t) => t.id !== taskId)) }) : b
          ),
        }),

      // ─────────── Événements (idées & faits — matière de la timeline) ───────────
      addEvent: (bizId, data) => {
        if (!data.title?.trim()) return { ok: false, error: 'Le titre est requis.' };
        const biz = get().getBusiness(bizId);
        if (!biz) return { ok: false, error: 'Business introuvable.' };
        const event = {
          id: uid(),
          type: data.type === 'fact' ? 'fact' : 'idea', // 'idea' | 'fact'
          title: data.title.trim(),
          description: data.description || '',
          date: data.date || new Date().toISOString().slice(0, 10),
          phaseId: data.phaseId || null,
          createdAt: Date.now(),
        };
        set({ businesses: get().businesses.map((b) => (b.id === bizId ? stamp({ ...b, events: [...b.events, event] }) : b)) });
        useSkillStore.getState().awardXP('pe-deal-sourcing', 2, `${event.type === 'idea' ? 'idée' : 'fait'} loggé : ${event.title}`);
        return { ok: true, id: event.id };
      },
      editEvent: (bizId, eventId, updates) =>
        set({ businesses: get().businesses.map((b) => (b.id === bizId ? stamp({ ...b, events: b.events.map((e) => (e.id === eventId ? { ...e, ...updates } : e)) }) : b)) }),
      deleteEvent: (bizId, eventId) =>
        set({ businesses: get().businesses.map((b) => (b.id === bizId ? stamp({ ...b, events: b.events.filter((e) => e.id !== eventId) }) : b)) }),

      // ─────────── KPIs ───────────
      addKpi: (bizId, data) => {
        if (!data.name?.trim()) return { ok: false, error: 'Le nom du KPI est requis.' };
        const kpi = { id: uid(), name: data.name.trim(), unit: data.unit || '', target: data.target !== '' && data.target != null ? Number(data.target) : null, createdAt: Date.now() };
        set({ businesses: get().businesses.map((b) => (b.id === bizId ? stamp({ ...b, kpis: [...b.kpis, kpi] }) : b)) });
        return { ok: true, id: kpi.id };
      },
      deleteKpi: (bizId, kpiId) =>
        set({
          businesses: get().businesses.map((b) =>
            b.id === bizId ? stamp({ ...b, kpis: b.kpis.filter((k) => k.id !== kpiId), kpiLogs: b.kpiLogs.filter((l) => l.kpiId !== kpiId) }) : b
          ),
        }),
      logKpiValue: (bizId, kpiId, date, value) => {
        const log = { id: uid(), kpiId, date: date || new Date().toISOString().slice(0, 10), value: Number(value) || 0, createdAt: Date.now() };
        set({ businesses: get().businesses.map((b) => (b.id === bizId ? stamp({ ...b, kpiLogs: [...b.kpiLogs.filter((l) => !(l.kpiId === kpiId && l.date === log.date)), log] }) : b)) });
      },
      deleteKpiLog: (bizId, logId) =>
        set({ businesses: get().businesses.map((b) => (b.id === bizId ? stamp({ ...b, kpiLogs: b.kpiLogs.filter((l) => l.id !== logId) }) : b)) }),
      getKpiSeries: (bizId, kpiId) =>
        (get().getBusiness(bizId)?.kpiLogs || []).filter((l) => l.kpiId === kpiId).sort((a, b) => (a.date < b.date ? -1 : 1)),

      // ─────────── Comptabilité générale (très simplifiée, par business) ───────────
      // Même moteur pur que Finance (accounting-engine.js), plan comptable allégé
      // (business-accounts.js) — chaque business a son propre journal isolé.
      addEntry: (bizId, entry) => {
        const res = validateEntry(entry, BUSINESS_ACCOUNT_MAP);
        if (!res.ok) return res;
        const clean = {
          id: uid(),
          date: entry.date,
          ref: entry.ref || `E${(get().getBusiness(bizId)?.journal.length || 0) + 1}`,
          label: entry.label.trim(),
          lines: res.lines.map((l) => ({ account: l.account, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set({ businesses: get().businesses.map((b) => (b.id === bizId ? stamp({ ...b, journal: [...b.journal, clean] }) : b)) });
        const award = useSkillStore.getState().awardXP;
        award('double-entry-lv1', 2, `écriture business : ${clean.label}`);
        award('journal-keeper-lv1', 1, `écriture business : ${clean.label}`);
        toast(`Écriture enregistrée : ${clean.label}`, 'success');
        return { ok: true, id: clean.id };
      },
      deleteEntry: (bizId, entryId) =>
        set({ businesses: get().businesses.map((b) => (b.id === bizId ? stamp({ ...b, journal: b.journal.filter((e) => e.id !== entryId) }) : b)) }),

      getBalances: (bizId) => accountBalances(get().getBusiness(bizId)?.journal || []),
      getBalanceSheet: (bizId, until) => balanceSheet(get().getBusiness(bizId)?.journal || [], until, BUSINESS_ACCOUNT_MAP),
      getCPC: (bizId, period) => cpc(get().getBusiness(bizId)?.journal || [], period, BUSINESS_ACCOUNT_MAP),
      getAnalysis: (bizId, until) => financialAnalysis(get().getBusiness(bizId)?.journal || [], until, BUSINESS_ACCOUNT_MAP),
      getTreasuryBalance: (bizId, until) => treasuryBalance(get().getBusiness(bizId)?.journal || [], until),

      resetAll: () => set({ businesses: [] }),
    }),
    { name: 'audax-business' }
  )
);
