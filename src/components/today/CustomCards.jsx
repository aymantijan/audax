import { useState } from 'react';
import { Plus, Minus, Pencil, Trash2, StickyNote, Hash } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { deleteWithUndo } from '../../services/undo';
import { todayKey, uid } from '../../utils/formatters';
import { Card, Button, Field, Input, Textarea, Modal, IconButton } from '../common/ui';

// Personal cards on Aujourd'hui (chantier 5, J4): a note, or a counter of the
// day (glasses of water, cigarettes…). Saved on the profile, so every device
// shows them; ordered and hidden with the other cards (« Organiser »).

const lastDays = (n) => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return todayKey(d); });

function CustomCardForm({ open, card, onClose }) {
  const { user, updateProfile } = useAuthStore();
  const [f, setF] = useState(card || { type: 'note', title: '', text: '', goal: '' });
  const save = (e) => {
    e.preventDefault();
    if (!f.title.trim()) return;
    const list = user?.todayCards || [];
    const clean = { ...f, title: f.title.trim(), goal: f.type === 'counter' && Number(f.goal) > 0 ? Number(f.goal) : null };
    updateProfile({ todayCards: card ? list.map((c) => (c.id === card.id ? { ...c, ...clean } : c)) : [...list, { ...clean, id: uid() }] });
    onClose();
  };
  const chip = (on) => `ui-btn flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${on ? 'border-accent bg-accent/10 text-accent' : 'border-line text-mute'}`;
  return (
    <Modal open={open} onClose={onClose} title={card ? 'Modifier la carte' : 'Nouvelle carte'}>
      <form onSubmit={save} className="space-y-3">
        {!card && (
          <div className="flex gap-2" role="radiogroup" aria-label="Type de carte">
            <button type="button" role="radio" aria-checked={f.type === 'note'} className={chip(f.type === 'note')} onClick={() => setF({ ...f, type: 'note' })}><StickyNote size={15} /> Note</button>
            <button type="button" role="radio" aria-checked={f.type === 'counter'} className={chip(f.type === 'counter')} onClick={() => setF({ ...f, type: 'counter' })}><Hash size={15} /> Compteur</button>
          </div>
        )}
        <Field label="Titre"><Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={f.type === 'note' ? 'Ex. À ne pas oublier' : 'Ex. Verres d’eau'} /></Field>
        {f.type === 'note' ? (
          <Field label="Texte"><Textarea rows={4} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="Ce que tu veux voir chaque jour" /></Field>
        ) : (
          <Field label="Objectif du jour (facultatif)"><Input type="number" min="1" value={f.goal || ''} onChange={(e) => setF({ ...f, goal: e.target.value })} placeholder="Ex. 8" /></Field>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit">{card ? 'Enregistrer' : 'Ajouter'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function CustomCard({ card }) {
  const { user, updateProfile } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const today = todayKey();
  const counts = user?.todayCounts?.[card.id] || {};
  const n = counts[today] || 0;
  const bump = (d) => updateProfile({ todayCounts: { ...(user?.todayCounts || {}), [card.id]: { ...counts, [today]: Math.max(0, n + d) } } });
  const remove = () => deleteWithUndo(card.title, () => updateProfile({ todayCards: (user?.todayCards || []).filter((c) => c.id !== card.id) }));
  const actions = (
    <span className="flex items-center gap-1">
      <IconButton label={`Modifier ${card.title}`} onClick={() => setEditing(true)}><Pencil size={14} /></IconButton>
      <IconButton label={`Supprimer ${card.title}`} tone="danger" onClick={remove}><Trash2 size={14} /></IconButton>
    </span>
  );
  return (
    <>
      <Card title={card.title} action={actions}>
        {card.type === 'note' ? (
          <p className="text-sm whitespace-pre-line">{card.text || <span className="text-mute">Note vide — touche le crayon pour l’écrire.</span>}</p>
        ) : (
          <div className="flex items-center gap-4">
            <IconButton label={`Retirer 1 à ${card.title}`} onClick={() => bump(-1)} disabled={!n}><Minus size={18} /></IconButton>
            <div className="text-center">
              <div className="font-data text-3xl font-bold tabular-nums">{n}{card.goal ? <span className="text-mute text-lg">/{card.goal}</span> : null}</div>
              <div className="text-xs text-mute">aujourd’hui</div>
            </div>
            <IconButton label={`Ajouter 1 à ${card.title}`} onClick={() => bump(1)}><Plus size={18} /></IconButton>
            <div className="ml-auto flex items-end gap-1 h-8" aria-label="7 derniers jours">
              {lastDays(7).map((d) => {
                const v = counts[d] || 0;
                const max = Math.max(1, card.goal || 0, ...Object.values(counts));
                return <span key={d} title={`${d} : ${v}`} className="w-2 rounded-sm bg-accent/70" style={{ height: `${Math.max(8, (v / max) * 100)}%`, opacity: v ? 1 : 0.25 }} />;
              })}
            </div>
          </div>
        )}
      </Card>
      {editing && <CustomCardForm open card={card} onClose={() => setEditing(false)} />}
    </>
  );
}

// Cards for Today's list (same shape as the built-in ones: id, label, node).
export function useCustomCards() {
  const cards = useAuthStore((s) => s.user?.todayCards) || [];
  return cards.map((c) => ({ id: `custom-${c.id}`, label: `${c.type === 'note' ? 'Note' : 'Compteur'} : ${c.title}`, node: <CustomCard card={c} /> }));
}

export function AddCustomCardButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setOpen(true)}>
        <span className="flex items-center gap-1.5"><Plus size={13} /> Ajouter une carte (note ou compteur)</span>
      </Button>
      {open && <CustomCardForm open onClose={() => setOpen(false)} />}
    </>
  );
}
