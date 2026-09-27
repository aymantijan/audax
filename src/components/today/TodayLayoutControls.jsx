import { useState } from 'react';
import { ArrowUp, ArrowDown, Eye, EyeOff, LayoutList, RotateCcw } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { arrangeCards, moveCard, toggleCard } from '../../utils/today-layout';
import { Button, Modal, IconButton } from '../common/ui';

// "Aujourd'hui | Bilan" — one page, two views.
export function TodayTabs({ view, onChange }) {
  const tabs = [['today', 'Aujourd’hui'], ['bilan', 'Bilan']];
  return (
    <div className="inline-flex rounded-xl border border-line bg-surface p-1" role="tablist" aria-label="Vue">
      {tabs.map(([k, label]) => (
        <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => onChange(k)}
          className={`ui-btn rounded-lg px-4 py-1.5 text-sm font-medium cursor-pointer transition-colors ${view === k ? 'bg-card text-accent shadow-sm ring-1 ring-line' : 'text-mute hover:text-ink'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

// Reorder / hide the cards of Aujourd'hui. Saved in the profile (synced).
export function OrganizeButton({ cards }) {
  const { user, updateProfile } = useAuthStore();
  const [open, setOpen] = useState(false);
  const layout = user?.todayLayout || { order: [], hidden: [] };
  const ids = cards.map((c) => c.id);
  const ordered = arrangeCards(cards, { order: layout.order });
  const hidden = new Set(layout.hidden || []);
  const save = (next) => updateProfile({ todayLayout: next });
  return (
    <>
      <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setOpen(true)}>
        <span className="flex items-center gap-1.5"><LayoutList size={14} /> Organiser</span>
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Organiser Aujourd’hui">
        <p className="text-sm text-mute mb-3">Monte, descends ou masque les cartes. Le même ordre s’affiche sur tous tes appareils.</p>
        <ul className="divide-y divide-line/60 border border-line rounded-lg">
          {ordered.map((c, i) => (
            <li key={c.id} className={`flex items-center gap-2 px-3 py-2 ${hidden.has(c.id) ? 'opacity-50' : ''}`}>
              <span className="text-sm flex-1">{c.label}</span>
              <IconButton label={`Monter ${c.label}`} disabled={i === 0} onClick={() => save(moveCard(ids, layout, c.id, -1))}><ArrowUp size={15} /></IconButton>
              <IconButton label={`Descendre ${c.label}`} disabled={i === ordered.length - 1} onClick={() => save(moveCard(ids, layout, c.id, 1))}><ArrowDown size={15} /></IconButton>
              <IconButton label={hidden.has(c.id) ? `Afficher ${c.label}` : `Masquer ${c.label}`} onClick={() => save(toggleCard(layout, c.id))}>
                {hidden.has(c.id) ? <EyeOff size={15} /> : <Eye size={15} />}
              </IconButton>
            </li>
          ))}
        </ul>
        <div className="flex justify-between mt-4">
          <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => save({ order: [], hidden: [] })}><span className="flex items-center gap-1.5"><RotateCcw size={13} /> Ordre par défaut</span></Button>
          <Button onClick={() => setOpen(false)}>Terminé</Button>
        </div>
      </Modal>
    </>
  );
}
