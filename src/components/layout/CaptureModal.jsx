import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Loader2, Sparkles, TrendingUp, Wallet, Dumbbell, CalendarDays, Check, Pencil, X } from 'lucide-react';
import { Button, Field, Input, Modal } from '../common/ui';
import AccountSelect from '../common/AccountSelect';
import { useAuthStore } from '../../store/authStore';
import { useAccountingStore } from '../../store/accountingStore';
import { isModuleEnabled } from '../../utils/navigation';
import { parseCapture, normalizeDraft, describeDraft, CAPTURE_KINDS } from '../../utils/quick-capture';
import { captureContext, moneyAccounts, saveDraft } from '../../services/capture';
import { extractCapture, extractReceipt, EXTRACT_ERRORS } from '../../services/extract';
import { ASSISTANT_ERRORS } from '../../services/assistant';
import { formatMoney } from '../../utils/currency';
import { todayKey, fmtDateShort } from '../../utils/formatters';

const EXAMPLES = ['payé 120 courses', 'couru 5 km en 28 min', 'poids 72,4', 'dormi 7h30', 'révisé 45 min', 'bu 1,5 l d’eau', 'reçu 3000 salaire'];

// Editable fields of each kind of draft (the card's "Modifier").
const FIELDS = {
  expense: [['amount', 'Montant', 'number'], ['label', 'Libellé', 'text']],
  income: [['amount', 'Montant', 'number'], ['label', 'Libellé', 'text']],
  freelance: [['amount', 'Montant', 'number'], ['label', 'Libellé', 'text']],
  workout: [['exercise', 'Activité', 'text'], ['durationMin', 'Durée (min)', 'number'], ['distanceKm', 'Distance (km)', 'number']],
  weight: [['weightKg', 'Poids (kg)', 'number']],
  sleep: [['hours', 'Heures de sommeil', 'number']],
  water: [['ml', 'Quantité (ml)', 'number']],
  study: [['minutes', 'Durée (min)', 'number'], ['label', 'Sur quoi', 'text']],
  habit: [['value', 'Valeur (si mesurée)', 'number']],
};

const errorText = (err) => EXTRACT_ERRORS[err?.code] || ASSISTANT_ERRORS[err?.code] || ASSISTANT_ERRORS.failed;

// The + button's window: one sentence (or a photo of a receipt) → a draft card
// → Enregistrer / Modifier / Annuler. Nothing is saved before "Enregistrer".
export default function CaptureModal({ open, onClose, onQuickEntry }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const baseCurrency = useAccountingStore((s) => s.baseCurrency);
  const [text, setText] = useState('');
  const [draft, setDraft] = useState(null);
  const [accounts, setAccounts] = useState({ category: null, cash: null });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const inputRef = useRef(null);
  const photoRef = useRef(null);
  const example = useMemo(() => EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)], [open]);

  useEffect(() => {
    if (!open) return;
    setText(''); setDraft(null); setEditing(false); setBusy(''); setNote('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const show = (d) => {
    setDraft(d); setEditing(false); setNote('');
    setAccounts(d && (d.kind === 'expense' || d.kind === 'income') ? moneyAccounts(d) : { category: null, cash: d?.kind === 'freelance' ? '511' : null });
  };

  const understand = async () => {
    const t = text.trim();
    if (!t || busy) return;
    const ctx = captureContext();
    const local = parseCapture(t, ctx);
    if (local) { show(local); return; }
    setBusy('ai'); setNote(''); setDraft(null);
    try {
      const d = normalizeDraft(await extractCapture(t, ctx), ctx);
      if (d) show(d);
      else setNote('Je n’ai pas compris. Essaie par exemple « payé 120 courses » ou « couru 5 km en 28 min », ou utilise un raccourci ci-dessous.');
    } catch (err) {
      setNote(`Je n’ai pas reconnu cette phrase tout seul, et l’IA n’a pas pu répondre : ${errorText(err)}`);
    } finally {
      setBusy('');
    }
  };

  const readPhoto = async (file) => {
    setBusy('photo'); setNote(''); setDraft(null);
    try {
      const r = await extractReceipt(file);
      const d = r?.amount ? normalizeDraft({ kind: 'expense', amount: r.amount, currency: r.currency && r.currency !== baseCurrency ? r.currency : null, label: r.merchant || r.category || 'Achat', date: r.date }, captureContext()) : null;
      if (d) { show(d); setNote('Lu sur le reçu : vérifie avant d’enregistrer.'); } else setNote('Montant illisible sur la photo : écris-le plutôt (ex. « payé 120 courses »).');
    } catch (err) {
      setNote(errorText(err));
    } finally {
      setBusy('');
    }
  };

  const save = () => {
    const ctx = captureContext();
    const d = normalizeDraft(draft, ctx);
    if (!d) { setNote('Vérifie les valeurs : un montant, une durée ou une quantité manque ou n’est pas plausible.'); setEditing(true); return; }
    const res = saveDraft(d, accounts);
    if (!res.ok) { setNote(res.error || 'Enregistrement impossible.'); return; }
    onClose();
  };

  const setField = (k, v) => setDraft((x) => ({ ...x, [k]: v }));
  const money = (a, c) => formatMoney(a, c || baseCurrency);
  const K = draft ? CAPTURE_KINDS[draft.kind] : null;
  const shortcuts = [
    isModuleEnabled(user, 'trading') && { label: 'Trade', icon: TrendingUp, go: () => { onClose(); navigate('/trading?quickadd=trade'); } },
    { label: 'Dépense détaillée', icon: Wallet, go: () => { onClose(); onQuickEntry(); } },
    { label: 'Séance détaillée', icon: Dumbbell, go: () => { onClose(); navigate('/health?quickadd=workout'); } },
    { label: 'Emploi du temps (photo)', icon: CalendarDays, go: () => { onClose(); navigate('/learning?tab=timetable'); } },
  ].filter(Boolean);

  return (
    <Modal open={open} onClose={onClose} title="Noter quelque chose">
      <div className="space-y-4">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); understand(); }}>
          <input ref={inputRef} value={text} onChange={(e) => { setText(e.target.value); if (draft) setDraft(null); }} placeholder={`ex. ${example}`} aria-label="Ce que tu veux noter" maxLength={500}
            className="flex-1 min-w-0 bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-mute focus:outline-none focus:border-accent" />
          <input ref={photoRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) readPhoto(f); }} />
          <button type="button" onClick={() => photoRef.current?.click()} disabled={!!busy} aria-label="Photo d’un reçu" title="Photo d’un reçu"
            className="ui-btn shrink-0 flex items-center justify-center rounded-lg border border-line px-3 text-mute hover:text-ink hover:border-accent cursor-pointer disabled:opacity-50">
            {busy === 'photo' ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          </button>
          <Button type="submit" disabled={!text.trim() || !!busy}>{busy === 'ai' ? <Loader2 size={15} className="animate-spin" /> : 'OK'}</Button>
        </form>
        {busy === 'ai' && <p className="text-xs text-mute flex items-center gap-1.5"><Sparkles size={12} /> Je demande à l’IA…</p>}

        {draft && K && (
          <div className="rounded-xl border border-accent/60 bg-surface p-3 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-mute">{K.label} → {K.where}</div>
                <div className="text-base font-semibold text-ink font-data break-words">{describeDraft(draft, money)}</div>
                <div className="text-xs text-mute">{draft.date === todayKey() ? 'Aujourd’hui' : draft.date === todayKey(new Date(Date.now() - 86400000)) ? 'Hier' : fmtDateShort(draft.date)}</div>
              </div>
              {(draft.kind === 'expense' || draft.kind === 'income') && (
                <div className="flex shrink-0 rounded-lg border border-line p-0.5 text-xs">
                  {['expense', 'income'].map((k) => (
                    <button key={k} type="button" onClick={() => { const d = { ...draft, kind: k }; setDraft(d); setAccounts(moneyAccounts(d)); }}
                      className={`px-2 py-1 rounded-md cursor-pointer ${draft.kind === k ? 'bg-card text-ink ring-1 ring-line' : 'text-mute'}`}>{CAPTURE_KINDS[k].label}</button>
                  ))}
                </div>
              )}
            </div>

            {editing && (
              <div className="grid grid-cols-2 gap-2">
                {FIELDS[draft.kind].map(([k, label, type]) => (
                  <Field key={k} label={label}><Input inputMode={type === 'number' ? 'decimal' : undefined} value={draft[k] ?? ''} onChange={(e) => setField(k, e.target.value)} /></Field>
                ))}
                <Field label="Date"><Input type="date" max={todayKey()} value={draft.date} onChange={(e) => setField('date', e.target.value)} /></Field>
              </div>
            )}
            {(draft.kind === 'expense' || draft.kind === 'income') && (editing || accounts.category) && (
              <div className="grid grid-cols-2 gap-2">
                <Field label={draft.kind === 'expense' ? 'Catégorie' : 'Source'}><AccountSelect simple classes={[draft.kind === 'expense' ? 6 : 7]} value={accounts.category} onChange={(e) => setAccounts((a) => ({ ...a, category: e.target.value }))} /></Field>
                <Field label={draft.kind === 'expense' ? 'Payé avec' : 'Reçu sur'}><AccountSelect simple classes={[5]} value={accounts.cash} onChange={(e) => setAccounts((a) => ({ ...a, cash: e.target.value }))} /></Field>
              </div>
            )}
            {draft.kind === 'freelance' && (
              <Field label="Arrivé sur le compte"><AccountSelect simple classes={[5]} value={accounts.cash} onChange={(e) => setAccounts((a) => ({ ...a, cash: e.target.value }))} /></Field>
            )}

            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="secondary" onClick={() => setDraft(null)}><span className="flex items-center gap-1.5"><X size={14} /> Annuler</span></Button>
              {!editing && <Button variant="secondary" onClick={() => setEditing(true)}><span className="flex items-center gap-1.5"><Pencil size={14} /> Modifier</span></Button>}
              <Button onClick={save}><span className="flex items-center gap-1.5"><Check size={14} /> Enregistrer</span></Button>
            </div>
          </div>
        )}

        {note && <p className="text-sm text-mute">{note}</p>}

        {!draft && (
          <div>
            <div className="text-xs text-mute mb-1.5">Ou directement</div>
            <div className="flex flex-wrap gap-2">
              {shortcuts.map((s) => (
                <button key={s.label} type="button" onClick={s.go}
                  className="ui-btn flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-mute hover:text-ink hover:border-accent cursor-pointer">
                  <s.icon size={13} className="text-accent" /> {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
