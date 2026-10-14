import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartPulse, Wallet, GraduationCap, Flame, PenLine, ChevronRight } from 'lucide-react';
import { useHabitStore } from '../../store/habitStore';
import { periodOf } from '../../utils/objectives';
import { todayKey } from '../../utils/formatters';
import { toast } from '../../store/uiStore';
import { Modal, Button, Field, Input, Select } from '../common/ui';

// One « Nouvel objectif » for every kind of goal (chantier 5, O1): it asks
// what to follow, then opens the right form — or creates a free goal here.
const KINDS = [
  { key: 'health', icon: HeartPulse, label: 'Santé', desc: 'Poids, sport, sommeil, une mesure…', to: '/health?tab=goals&new=1' },
  { key: 'money', icon: Wallet, label: 'Argent', desc: 'Mettre de côté, rembourser, un patrimoine…', to: '/finance?tab=goals&new=1' },
  { key: 'study', icon: GraduationCap, label: 'Études', desc: 'Une note visée, un niveau de langue…', to: '/learning?tab=cursus' },
  { key: 'habit', icon: Flame, label: 'Une habitude', desc: 'Tenir une série de jours', to: '/habits?new=1' },
  { key: 'free', icon: PenLine, label: 'Objectif libre', desc: 'En une phrase : « Lire 10 livres cette année »' },
];

const HORIZONS = [
  { value: 'week', label: 'Cette semaine' },
  { value: 'quarter', label: 'Ce trimestre' },
  { value: 'year', label: 'Cette année' },
];

export default function NewGoalModal({ open, onClose }) {
  const navigate = useNavigate();
  const addObjective = useHabitStore((s) => s.addObjective);
  const [free, setFree] = useState(null); // { title, horizon }

  const close = () => { setFree(null); onClose(); };
  const choose = (k) => {
    if (k.key === 'free') return setFree({ title: '', horizon: 'year' });
    close();
    navigate(k.to);
  };
  const saveFree = (e) => {
    e.preventDefault();
    if (!free.title.trim()) return;
    addObjective({ horizon: free.horizon, period: periodOf(free.horizon, todayKey()), title: free.title.trim() });
    toast('Objectif ajouté', 'success');
    close();
  };

  return (
    <Modal open={open} onClose={close} title={free ? 'Objectif libre' : 'Que veux-tu atteindre ?'}>
      {free ? (
        <form onSubmit={saveFree} className="space-y-3">
          <Field label="Ton objectif"><Input autoFocus value={free.title} onChange={(e) => setFree({ ...free, title: e.target.value })} placeholder="Ex. Lire 10 livres" /></Field>
          <Field label="Pour quand ?"><Select value={free.horizon} onChange={(e) => setFree({ ...free, horizon: e.target.value })} options={HORIZONS} /></Field>
          <div className="flex justify-between gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setFree(null)}>Retour</Button>
            <Button type="submit">Ajouter</Button>
          </div>
        </form>
      ) : (
        <ul className="space-y-2">
          {KINDS.map((k) => (
            <li key={k.key}>
              <button type="button" onClick={() => choose(k)} className="ui-btn w-full flex items-center gap-3 rounded-xl border border-line p-3 text-left hover:border-accent cursor-pointer">
                <span className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0"><k.icon size={18} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-ink">{k.label}</span>
                  <span className="block text-xs text-mute">{k.desc}</span>
                </span>
                <ChevronRight size={16} className="text-mute shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
