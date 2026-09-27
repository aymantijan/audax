import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Pencil, X, Copy, Undo2 } from 'lucide-react';
import { Button, Field, Input, Textarea } from '../common/ui';
import { ACTION_LABELS, normalizeAction } from '../../utils/assistant-actions';
import { CAPTURE_FIELDS, CAPTURE_KINDS } from '../../utils/quick-capture';
import { actionContext, applyAction, describeAction } from '../../services/assistant-actions';
import { toast } from '../../store/uiStore';

// Editable fields per action type ("Modifier"); flashcards: untick cards instead.
const EDIT = {
  study: [['date', 'Date', 'date'], ['minutes', 'Minutes'], ['focus', 'À travailler']],
  objective: [['title', 'Objectif']],
  budget: [['amount', 'Montant']],
  echeance: [['label', 'Libellé'], ['amount', 'Montant'], ['date', 'Date', 'date']],
  message: [['text', 'Message', 'textarea']],
};

// One prepared action: Valider / Modifier / Refuser. After "Valider": done,
// with "Annuler" (puts the data back) and a link to where it went.
export default function ActionCard({ action, state, onChange, onClose }) {
  const [edit, setEdit] = useState(null); // working copy while editing
  const [error, setError] = useState('');
  const a = edit || action;
  const status = state?.status || 'pending';

  const setField = (k, v) => setEdit((x) => (a.type === 'capture' ? { ...x, draft: { ...x.draft, [k]: v } } : { ...x, [k]: v }));

  const validate = async (override) => {
    setError('');
    const src = override || edit;
    const checked = src ? normalizeAction(src, actionContext()) : action;
    if (!checked) { setError('Vérifie les valeurs : une donnée manque ou n’est pas plausible.'); return; }
    if (checked.type === 'message') {
      try { await navigator.clipboard.writeText(checked.text); toast('Message copié : colle-le dans ta messagerie', 'success'); } catch { setError('Copie impossible : sélectionne le texte et copie-le.'); return; }
    }
    const res = applyAction(checked);
    if (!res.ok) { setError(res.error || 'Action impossible.'); return; }
    setEdit(null);
    onChange({ status: 'done', undo: res.undo, to: res.to, action: checked });
  };

  const fields = a.type === 'capture' ? CAPTURE_FIELDS[a.draft.kind] : EDIT[a.type];
  const shown = state?.action || a;
  const title = a.type === 'capture' ? `${ACTION_LABELS.capture} · ${CAPTURE_KINDS[a.draft.kind].label}` : ACTION_LABELS[a.type];

  return (
    <div className={`rounded-xl border p-3 space-y-2 text-sm ${status === 'pending' ? 'border-accent/60 bg-surface' : 'border-line bg-surface/50'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-mute">{title}</div>
          <div className={`font-medium break-words ${status === 'refused' ? 'line-through text-mute' : 'text-ink'}`}>{describeAction(shown)}</div>
        </div>
        {status === 'done' && <span className="shrink-0 flex items-center gap-1 text-xs text-good"><Check size={13} /> Fait</span>}
        {status === 'refused' && <span className="shrink-0 text-xs text-mute">Refusé</span>}
        {status === 'undone' && <span className="shrink-0 text-xs text-mute">Annulé</span>}
      </div>

      {a.type === 'message' && !edit && <p className="select-all whitespace-pre-wrap text-ink bg-card border border-line rounded-lg p-2.5 text-[13px]">{a.text}</p>}
      {a.type === 'flashcards' && (
        <ul className="space-y-1 max-h-40 overflow-y-auto">
          {(edit ? a : shown).cards.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              {edit && <input type="checkbox" className="mt-0.5 accent-[var(--accent-primary)]" checked={!c.off} onChange={() => setEdit((x) => ({ ...x, cards: x.cards.map((y, j) => (j === i ? { ...y, off: !y.off } : y)) }))} />}
              <span className={c.off ? 'line-through text-mute' : ''}><b className="font-medium text-ink">{c.front}</b> <span className="text-mute">→ {c.back}</span></span>
            </li>
          ))}
        </ul>
      )}

      {edit && fields && (
        <div className="grid grid-cols-2 gap-2">
          {fields.map(([k, label, type]) => {
            const v = a.type === 'capture' ? a.draft[k] : a[k];
            return (
              <div key={k} className={type === 'textarea' || k === 'title' || k === 'focus' ? 'col-span-2' : ''}>
                <Field label={label}>
                  {type === 'textarea'
                    ? <Textarea rows={5} value={v ?? ''} onChange={(e) => setField(k, e.target.value)} />
                    : <Input type={type === 'date' ? 'date' : 'text'} inputMode={type === 'number' || ['minutes', 'amount'].includes(k) ? 'decimal' : undefined} value={v ?? ''} onChange={(e) => setField(k, e.target.value)} />}
                </Field>
              </div>
            );
          })}
        </div>
      )}
      {error && <p className="text-xs text-bad">{error}</p>}

      {status === 'pending' && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => { setEdit(null); onChange({ status: 'refused' }); }}><span className="flex items-center gap-1"><X size={13} /> Refuser</span></Button>
          {!edit && (fields || a.type === 'flashcards') && <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setEdit({ ...action, ...(action.type === 'flashcards' ? { cards: action.cards.map((c) => ({ ...c })) } : {}) })}><span className="flex items-center gap-1"><Pencil size={13} /> Modifier</span></Button>}
          <Button className="!px-3 !py-1.5 text-xs" onClick={() => validate(a.type === 'flashcards' && edit ? { ...edit, cards: edit.cards.filter((c) => !c.off) } : undefined)}>
            <span className="flex items-center gap-1">{a.type === 'message' ? <Copy size={13} /> : <Check size={13} />} {a.type === 'message' ? 'Copier' : 'Valider'}</span>
          </Button>
        </div>
      )}
      {status === 'done' && (
        <div className="flex flex-wrap justify-end gap-3 text-xs">
          {state.undo && <button type="button" className="flex items-center gap-1 text-mute hover:text-ink cursor-pointer" onClick={() => { state.undo(); onChange({ status: 'undone', action: state.action }); }}><Undo2 size={12} /> Annuler</button>}
          {state.to && <Link to={state.to} onClick={onClose} className="text-accent hover:underline">Voir</Link>}
        </div>
      )}
    </div>
  );
}
