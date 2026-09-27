// Assistant that PREPARES (phase 2, partie 13): after its answer, the model may
// add a block of proposed actions:
//   <<<ACTIONS
//   [{ "type": "...", ... }, ...]
//   ACTIONS>>>
// splitAnswer() hides that block from the text (also while it streams) and
// normalizeAction() checks each action against the person's own data before a
// card is shown. Nothing is applied here: services/assistant-actions.js does
// that, only after "Valider".
//
// Action types (names, never ids — resolved here):
//   capture    { draft }                       any draft of utils/quick-capture.js
//   study      { course, date, minutes, focus } a revision session in the week plan
//   flashcards { course, cards: [{front, back}] }
//   objective  { horizon: year|quarter|week, title }
//   habit_mini { habit }                        the habit's mini version (habit-coach)
//   budget     { category, amount, period: monthly|weekly|yearly }
//   echeance   { label, amount, date, kind: expense|income, recurrence: once|monthly|weekly|yearly }
//   message    { to, text }                     a text to copy (reminder…): never sent
//   invoice    { client }                       invoice with what is still to bill
import { normalizeDraft, fold } from './quick-capture.js';

export const ACTIONS_START = '<<<ACTIONS';
export const ACTIONS_END = 'ACTIONS>>>';
export const MAX_ACTIONS = 6;

export const ACTION_LABELS = {
  capture: 'À noter',
  study: 'Séance de révision',
  flashcards: 'Fiches de révision',
  objective: 'Objectif',
  habit_mini: 'Habitude en version mini',
  budget: 'Budget',
  echeance: 'Échéance',
  message: 'Message à envoyer',
  invoice: 'Facture',
};

// { text, actions: raw objects } — the text never shows the block, even half-streamed.
export function splitAnswer(full) {
  const s = String(full || '');
  const i = s.indexOf(ACTIONS_START);
  if (i < 0) {
    // Hide a marker still arriving ("<<<ACT…") at the very end of the stream.
    const tail = s.slice(-ACTIONS_START.length);
    for (let k = tail.length; k > 0; k -= 1) if (ACTIONS_START.startsWith(tail.slice(-k))) return { text: s.slice(0, s.length - k).trimEnd(), actions: [] };
    return { text: s, actions: [] };
  }
  const text = s.slice(0, i).trimEnd();
  const j = s.indexOf(ACTIONS_END, i);
  if (j < 0) return { text, actions: [], pending: true };
  let actions = [];
  try {
    const parsed = JSON.parse(s.slice(i + ACTIONS_START.length, j).replace(/```(json)?/g, '').trim());
    actions = Array.isArray(parsed) ? parsed : [];
  } catch { actions = []; }
  return { text, actions: actions.slice(0, MAX_ACTIONS) };
}

const byName = (list, name) => {
  const f = fold(name);
  if (!f) return null;
  return (list || []).find((x) => fold(x.name) === f) || (list || []).find((x) => fold(x.name).includes(f) || f.includes(fold(x.name))) || null;
};
const num = (v) => { const x = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0; };
const str = (v, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');

// ctx = captureContext() + { accounts: [{code, name, cls}] (classes 6/7), today }
export function normalizeAction(a, ctx = {}) {
  if (!a || typeof a !== 'object' || !ACTION_LABELS[a.type]) return null;
  const today = ctx.today;
  switch (a.type) {
    case 'capture': {
      const draft = normalizeDraft(a.draft, ctx);
      return draft ? { type: 'capture', draft } : null;
    }
    case 'study': {
      const c = byName(ctx.courses, a.course);
      const minutes = Math.round(num(a.minutes));
      if (!c || !(minutes >= 10 && minutes <= 480)) return null;
      const date = isDate(a.date) && a.date >= today ? a.date : today;
      return { type: 'study', courseId: c.id, course: c.name, date, minutes, focus: str(a.focus, 80) };
    }
    case 'flashcards': {
      const c = byName(ctx.courses, a.course);
      const cards = (Array.isArray(a.cards) ? a.cards : [])
        .map((x) => ({ front: str(x?.front, 300), back: str(x?.back, 600) }))
        .filter((x) => x.front && x.back).slice(0, 20);
      if (!c || !cards.length) return null;
      return { type: 'flashcards', courseId: c.id, course: c.name, cards };
    }
    case 'objective': {
      const horizon = ['year', 'quarter', 'week'].includes(a.horizon) ? a.horizon : 'week';
      const title = str(a.title, 120);
      return title ? { type: 'objective', horizon, title } : null;
    }
    case 'habit_mini': {
      const h = byName(ctx.habits, a.habit);
      return h ? { type: 'habit_mini', habitId: h.id, habit: h.name } : null;
    }
    case 'budget': {
      const acc = (ctx.accounts || []).filter((x) => x.cls === 6);
      const account = acc.find((x) => x.code === String(a.category)) || byName(acc, a.category);
      const amount = Math.round(num(a.amount) * 100) / 100;
      const period = ['monthly', 'weekly', 'yearly'].includes(a.period) ? a.period : 'monthly';
      if (!account || !(amount > 0)) return null;
      return { type: 'budget', account: account.code, category: account.name, amount, period };
    }
    case 'echeance': {
      const label = str(a.label, 80);
      const amount = Math.round(num(a.amount) * 100) / 100;
      const kind = a.kind === 'income' ? 'income' : 'expense';
      const recurrence = ['once', 'monthly', 'weekly', 'yearly'].includes(a.recurrence) ? a.recurrence : 'once';
      if (!label || !(amount > 0) || !isDate(a.date)) return null;
      return { type: 'echeance', label, amount, date: a.date, kind, recurrence };
    }
    case 'message': {
      const text = str(a.text, 2000);
      return text ? { type: 'message', to: str(a.to, 80), text } : null;
    }
    case 'invoice': {
      const c = byName(ctx.clients, a.client);
      return c ? { type: 'invoice', clientId: c.id, client: c.name } : null;
    }
    default:
      return null;
  }
}

export const normalizeActions = (list, ctx) => (list || []).map((a) => normalizeAction(a, ctx)).filter(Boolean).slice(0, MAX_ACTIONS);

// The instructions the model receives (server side, appended to its system prompt).
export const ACTIONS_PROMPT = [
  'Tu peux aussi PRÉPARER des actions que la personne validera elle-même, quand sa demande s’y prête (« prépare mes révisions », « fais-moi des fiches », « relance le client X », « note que… », « aide-moi sur mon budget »).',
  `Dans ce cas, termine ta réponse par un bloc exactement de cette forme, sur des lignes séparées : ${ACTIONS_START} puis un tableau JSON puis ${ACTIONS_END}.`,
  `Au plus ${MAX_ACTIONS} actions. Types possibles :`,
  '{"type":"study","course":nom exact d’une matière,"date":"AAAA-MM-JJ","minutes":nombre,"focus":quoi travailler} ;',
  '{"type":"flashcards","course":nom exact,"cards":[{"front":question,"back":réponse}]} (au plus 20, tirées de ses notes de cours) ;',
  '{"type":"objective","horizon":"week"|"quarter"|"year","title":…} ; {"type":"habit_mini","habit":nom exact} ;',
  '{"type":"budget","category":nom exact d’une catégorie de dépense,"amount":nombre,"period":"monthly"|"weekly"|"yearly"} ;',
  '{"type":"echeance","label":…,"amount":nombre,"date":"AAAA-MM-JJ","kind":"expense"|"income","recurrence":"once"|"monthly"|"weekly"|"yearly"} ;',
  '{"type":"message","to":destinataire,"text":message complet prêt à envoyer} (jamais envoyé par l’application : la personne le copie) ;',
  '{"type":"invoice","client":nom exact d’un client} ;',
  '{"type":"capture","draft":{"kind":"expense"|"income"|"workout"|"weight"|"sleep"|"water"|"study"|"habit"|"freelance",…}} pour noter un fait qu’elle te dit.',
  'N’utilise que des noms présents dans ses données. Aucune action pour une simple question. Ne parle pas du bloc dans ton texte : dis seulement « je t’ai préparé … à valider ».',
].join(' ');
