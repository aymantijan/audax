// Applies an action the assistant PREPARED, once the person clicked "Valider"
// (checks: utils/assistant-actions.js). Every apply takes a copy of the data it
// touches, so "Annuler" puts it back exactly; a journal of what was applied is
// kept on this device (localStorage 'vaudax-assistant-log', last 200).
import { useAccountingStore } from '../store/accountingStore';
import { useFreelanceStore } from '../store/freelanceStore';
import { useHabitStore } from '../store/habitStore';
import { useFlashcardStore } from '../store/flashcardStore';
import { useHealthStore } from '../store/healthStore';
import { useFocusStore } from '../store/focusStore';
import { useLearningStore } from '../store/learningStore';
import { toast } from '../store/uiStore';
import { captureContext, saveDraft } from './capture';
import { periodOf } from '../utils/objectives';
import { miniChanges } from '../utils/habit-coach';
import { guessCategory } from '../utils/bank-import';
import { unbilledItems, mergeRefs } from '../utils/billing';
import { addDaysKey } from '../utils/invoice';
import { describeDraft } from '../utils/quick-capture';
import { formatMoney } from '../utils/currency';
import { fmtDateShort, todayKey } from '../utils/formatters';

const LOG_KEY = 'vaudax-assistant-log';

export function actionContext() {
  const map = useAccountingStore.getState().getAccountMap();
  const accounts = Object.values(map).filter((a) => a.cls === 6 || a.cls === 7).map((a) => ({ code: a.code, name: a.label, cls: a.cls }));
  return { ...captureContext(), accounts };
}

const money = (n) => formatMoney(n, useAccountingStore.getState().baseCurrency);
const PERIOD_LABEL = { monthly: 'par mois', weekly: 'par semaine', yearly: 'par an' };
const HORIZON_LABEL = { week: 'cette semaine', quarter: 'ce trimestre', year: 'cette année' };

// One line for the card.
export function describeAction(a) {
  switch (a.type) {
    case 'capture': return describeDraft(a.draft, (x, c) => formatMoney(x, c || useAccountingStore.getState().baseCurrency));
    case 'study': return `${a.course} · ${fmtDateShort(a.date)} · ${a.minutes} min${a.focus ? ` — ${a.focus}` : ''}`;
    case 'flashcards': return `${a.cards.length} fiche(s) · ${a.course}`;
    case 'objective': return `${a.title} (${HORIZON_LABEL[a.horizon]})`;
    case 'habit_mini': {
      const h = useHabitStore.getState().habits.find((x) => x.id === a.habitId);
      const m = h ? miniChanges(h) : null;
      return m ? `${a.habit} : ${m.text}` : `${a.habit} : pas de version mini possible`;
    }
    case 'budget': return `${a.category} · ${money(a.amount)} ${PERIOD_LABEL[a.period]}`;
    case 'echeance': return `${a.label} · ${money(a.amount)} · ${fmtDateShort(a.date)}${a.recurrence !== 'once' ? ` (${PERIOD_LABEL[a.recurrence]})` : ''}`;
    case 'message': return a.to ? `Pour ${a.to}` : 'Message';
    case 'invoice': {
      const e = useFreelanceStore.getState().engagements.find((x) => x.id === a.clientId);
      const items = e ? unbilledItems(e, todayKey()).filter((i) => !i.hidden) : [];
      const total = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
      return items.length ? `${a.client} · ${items.length} ligne(s) · ${formatMoney(total, e.currency)} HT` : `${a.client} · rien à facturer pour l’instant`;
    }
    default: return '';
  }
}

// Data (not functions) of the stores an action touches, to restore on "Annuler".
const STORES = {
  accounting: useAccountingStore, freelance: useFreelanceStore, habits: useHabitStore,
  flashcards: useFlashcardStore, health: useHealthStore, focus: useFocusStore, learning: useLearningStore,
};
const TOUCHES = {
  capture: ['accounting', 'freelance', 'health', 'habits', 'focus'],
  study: ['habits'], flashcards: ['flashcards'], objective: ['habits'], habit_mini: ['habits'],
  budget: ['accounting'], echeance: ['accounting'], invoice: ['freelance'], message: [],
};
const dataOf = (store) => Object.fromEntries(Object.entries(store.getState()).filter(([, v]) => typeof v !== 'function'));

function snapshot(type) {
  const snap = (TOUCHES[type] || []).map((k) => [STORES[k], dataOf(STORES[k])]);
  return () => { for (const [store, data] of snap) store.setState(data); };
}

function logAction(a, summary) {
  try {
    const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    log.unshift({ at: Date.now(), type: a.type, summary });
    localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, 200)));
  } catch { /* storage unavailable: the journal is a convenience */ }
}
export function readActionLog() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { return []; }
}

// → { ok, error?, undo?, to? }
export function applyAction(a) {
  const summary = describeAction(a);
  const undo = snapshot(a.type);
  const res = run(a);
  if (!res.ok) { undo(); return res; }
  logAction(a, summary);
  return { ...res, undo: TOUCHES[a.type]?.length ? () => { undo(); toast('Annulé', 'info'); } : null };
}

function run(a) {
  switch (a.type) {
    case 'capture':
      return saveDraft(a.draft);
    case 'study': {
      const o = useHabitStore.getState().addObjective({ horizon: 'week', period: periodOf('week', a.date), title: `Réviser ${a.course} · ${fmtDateShort(a.date)} · ${a.minutes} min${a.focus ? ` — ${a.focus}` : ''}` });
      if (!o) return { ok: false, error: 'Séance impossible à ajouter.' };
      toast('Séance ajoutée à ton plan de la semaine', 'success');
      return { ok: true, to: '/goals' };
    }
    case 'flashcards': {
      const fs = useFlashcardStore.getState();
      fs.addCards(fs.ensureCourseDeck(a.courseId), a.cards);
      return { ok: true, to: '/learning?tab=review' };
    }
    case 'objective': {
      const o = useHabitStore.getState().addObjective({ horizon: a.horizon, period: periodOf(a.horizon, todayKey()), title: a.title });
      if (!o) return { ok: false, error: 'Objectif vide.' };
      toast('Objectif ajouté', 'success');
      return { ok: true, to: '/goals' };
    }
    case 'habit_mini': {
      const hs = useHabitStore.getState();
      const h = hs.habits.find((x) => x.id === a.habitId);
      const m = h && !h.mini ? miniChanges(h) : null;
      if (!m) return { ok: false, error: h?.mini ? 'Cette habitude est déjà en version mini.' : 'Pas de version mini possible pour cette habitude.' };
      hs.applyMini(h.id, m.changes);
      return { ok: true, to: '/habits' };
    }
    case 'budget': {
      const period = a.period === 'weekly' ? { type: 'weekly' } : { type: 'calendar', months: a.period === 'yearly' ? 12 : 1 };
      useAccountingStore.getState().addBudget(a.account, a.amount, period);
      toast(`Budget ajouté : ${a.category}`, 'success');
      return { ok: true, to: '/finance' };
    }
    case 'echeance': {
      const acc = useAccountingStore.getState();
      const category = guessCategory(acc.journal, a.label, a.kind).account;
      const res = acc.addEcheance({
        label: a.label, amount: a.amount, dueDate: a.date, recurrence: a.recurrence, templateId: a.kind,
        debitAccount: a.kind === 'expense' ? category : '511', creditAccount: a.kind === 'expense' ? '511' : category,
      });
      return res.ok ? { ok: true, to: '/finance' } : res;
    }
    case 'message':
      return { ok: true };
    case 'invoice': {
      const fs = useFreelanceStore.getState();
      const e = fs.engagements.find((x) => x.id === a.clientId);
      if (!e) return { ok: false, error: 'Client introuvable.' };
      const today = todayKey();
      const items = unbilledItems(e, today);
      const chosen = items.filter((i) => !i.hidden);
      if (!chosen.length) return { ok: false, error: 'Rien à facturer pour ce client.' };
      const covered = items.filter((i) => i.hidden && chosen.some((c) => c.key === `ret-${i.key.slice(4)}`));
      const st = fs.invoiceSettings;
      const b = e.billing || {};
      const res = fs.createInvoice(e.id, {
        date: today, dueDate: addDaysKey(today, Number(st.paymentTermsDays) || 30), vatRate: st.vatRate || 0,
        discountPct: b.discountPct || '', withholdingPct: b.withholdingPct || '', deposit: '', notes: '',
        lines: chosen.map((i) => ({ description: i.description, qty: i.qty, unit: i.unit, unitPrice: i.unitPrice, vatRate: i.vatRate ?? '', discountPct: '' })),
        refs: mergeRefs([...chosen, ...covered]),
      });
      return res.ok ? { ok: true, to: '/freelance' } : res;
    }
    default:
      return { ok: false, error: 'Action inconnue.' };
  }
}
