import { Sparkles, GraduationCap } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAccountingStore } from '../../store/accountingStore';
import { uiLevelOf } from '../../utils/ui-level';
import { Card } from '../common/ui';
import DisplayControls from '../common/DisplayControls';

const LEVELS = [
  { value: 'simple', label: 'Simple', icon: Sparkles, text: 'L’essentiel, en mots de tous les jours : cocher, noter, voir ta semaine.' },
  { value: 'expert', label: 'Expert', icon: GraduationCap, text: 'Tous les outils : compétences, chronologie, défis, analyses, comptabilité, termes techniques expliqués au toucher.' },
];

// Paramètres → Affichage (chantier 4): reading comfort + Simple / Expert.
export default function DisplayCard() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const setFinanceMode = useAccountingStore((s) => s.setUiMode);
  const level = uiLevelOf(user);

  const choose = (value) => {
    updateProfile({ uiLevel: value });
    setFinanceMode?.(value); // Finances follows (it keeps its own switch too)
  };

  return (
    <Card title="Affichage">
      <DisplayControls />
      <div className="mt-5">
        <div className="text-sm font-medium mb-1.5">Niveau de détail</div>
        <div className="grid sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Niveau de détail">
          {LEVELS.map(({ value, label, icon: Icon, text }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={level === value}
              onClick={() => choose(value)}
              className={`ui-btn text-left rounded-xl border p-3 cursor-pointer ${level === value ? 'border-accent bg-accent/10' : 'border-line hover:border-accent/50'}`}
            >
              <span className={`flex items-center gap-2 font-semibold ${level === value ? 'text-accent' : 'text-ink'}`}><Icon size={16} /> {label}</span>
              <span className="block text-xs text-mute mt-1">{text}</span>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
