import { useState } from 'react';
import { ArrowUp, ArrowDown, Eye, EyeOff, Pencil, Trash2, Plus, Check } from 'lucide-react';
import { useHabitStore } from '../../store/habitStore';
import { HABIT_CATEGORIES } from '../../utils/constants';
import { Modal, Button, Input } from '../common/ui';
import { catLabel } from './habit-ui';

// « Organiser » (chantier 5, H1/H2): the order of the habits — arrows rather
// than drag-and-drop, easier for everyone — and the categories: hide the
// built-in ones you don't use, create, rename or remove your own.
export default function HabitOrganizer({ open, onClose }) {
  const [tab, setTab] = useState('order');
  const habits = useHabitStore((s) => s.habits);
  const moveHabit = useHabitStore((s) => s.moveHabit);
  const custom = useHabitStore((s) => s.customCategories || []);
  const hidden = useHabitStore((s) => s.hiddenCategories || []);
  const { addCategory, renameCategory, removeCategory, toggleCategoryHidden } = useHabitStore();
  const [renaming, setRenaming] = useState(null); // { from, to }
  const [draft, setDraft] = useState('');

  const active = habits.filter((h) => !h.archived);
  const countOf = (c) => active.filter((h) => h.category === c).length;
  const tabCls = (t) => `flex-1 rounded-lg px-3 py-2 text-sm font-medium cursor-pointer ${tab === t ? 'bg-card text-ink shadow-sm ring-1 ring-line' : 'text-mute hover:text-ink'}`;

  return (
    <Modal open={open} onClose={onClose} title="Organiser mes habitudes">
      <div className="flex gap-1 rounded-xl border border-line bg-surface p-1 mb-4" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'order'} className={tabCls('order')} onClick={() => setTab('order')}>Ordre</button>
        <button type="button" role="tab" aria-selected={tab === 'categories'} className={tabCls('categories')} onClick={() => setTab('categories')}>Catégories</button>
      </div>

      {tab === 'order' ? (
        active.length ? (
          <ol className="space-y-1.5">
            {active.map((h, i) => (
              <li key={h.id} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
                <span className="text-xs text-mute tabular-nums w-5">{i + 1}</span>
                <span className="flex-1 min-w-0 truncate text-sm">{h.name}</span>
                <button type="button" aria-label={`Monter ${h.name}`} disabled={i === 0} onClick={() => moveHabit(h.id, -1)} className="ui-icon-btn p-1.5 rounded-lg text-mute hover:text-ink disabled:opacity-30 cursor-pointer"><ArrowUp size={16} /></button>
                <button type="button" aria-label={`Descendre ${h.name}`} disabled={i === active.length - 1} onClick={() => moveHabit(h.id, 1)} className="ui-icon-btn p-1.5 rounded-lg text-mute hover:text-ink disabled:opacity-30 cursor-pointer"><ArrowDown size={16} /></button>
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-mute">Aucune habitude active.</p>
      ) : (
        <div className="space-y-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-mute mb-2">Tes catégories</div>
            <ul className="space-y-1.5">
              {custom.map((c) => (
                <li key={c} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
                  {renaming?.from === c ? (
                    <>
                      <Input autoFocus aria-label={`Nouveau nom pour ${c}`} value={renaming.to} onChange={(e) => setRenaming({ from: c, to: e.target.value })} />
                      <button type="button" aria-label="Valider le nouveau nom" onClick={() => { renameCategory(c, renaming.to); setRenaming(null); }} className="ui-icon-btn p-1.5 text-accent cursor-pointer"><Check size={16} /></button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 min-w-0 truncate text-sm">{c} <span className="text-xs text-mute">· {countOf(c)} habitude{countOf(c) > 1 ? 's' : ''}</span></span>
                      <button type="button" aria-label={`Renommer ${c}`} onClick={() => setRenaming({ from: c, to: c })} className="ui-icon-btn p-1.5 text-mute hover:text-ink cursor-pointer"><Pencil size={15} /></button>
                      <button type="button" aria-label={`Retirer ${c} de la liste`} title="Les habitudes gardent ce nom de catégorie" onClick={() => removeCategory(c)} className="ui-icon-btn p-1.5 text-mute hover:text-bad cursor-pointer"><Trash2 size={15} /></button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <form className="flex gap-2 mt-2" onSubmit={(e) => { e.preventDefault(); if (addCategory(draft)) setDraft(''); }}>
              <Input aria-label="Nouvelle catégorie" placeholder="Nouvelle catégorie (ex. Famille)" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <Button type="submit" variant="secondary"><span className="flex items-center gap-1"><Plus size={15} /> Ajouter</span></Button>
            </form>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-mute mb-2">Catégories proposées</div>
            <ul className="space-y-1.5">
              {HABIT_CATEGORIES.map((c) => {
                const off = hidden.includes(c);
                return (
                  <li key={c} className={`flex items-center gap-2 rounded-lg border border-line px-3 py-2 ${off ? 'opacity-60' : 'bg-surface'}`}>
                    <span className="flex-1 text-sm">{catLabel(c)} <span className="text-xs text-mute">· {countOf(c)}</span></span>
                    <button type="button" aria-pressed={!off} onClick={() => toggleCategoryHidden(c)} className="ui-btn flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-mute hover:text-ink cursor-pointer">
                      {off ? <><EyeOff size={14} /> Masquée</> : <><Eye size={14} /> Proposée</>}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-mute mt-2">Une catégorie masquée n’est plus proposée ; les habitudes déjà rangées dedans ne changent pas.</p>
          </div>
        </div>
      )}
    </Modal>
  );
}
