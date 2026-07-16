import { useState } from 'react';
import { LayoutDashboard, BookOpen, Library, FileSpreadsheet, LineChart, PiggyBank, Landmark, Target, HeartCrack } from 'lucide-react';
import { useHabitStore } from '../store/habitStore';
import { todayKey } from '../utils/formatters';
import AccountingOverview from './finance/AccountingOverview';
import Journal from './finance/Journal';
import Ledger from './finance/Ledger';
import Statements from './finance/Statements';
import Analysis from './finance/Analysis';
import Budget from './finance/Budget';
import TreasuryPure from './finance/TreasuryPure';
import Goals from './finance/Goals';

// Système financier personnel interconnecté, fondé sur la comptabilité générale
// en partie double (inspiration : plan comptable marocain adapté à une personne
// physique). Le Journal est la source unique ; Bilan, CPC, ESG, analyse
// financière, gestion budgétaire, trésorerie et objectifs en découlent automatiquement.
const TABS = [
  { key: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard, Component: AccountingOverview },
  { key: 'journal', label: 'Journal', icon: BookOpen, Component: Journal },
  { key: 'ledger', label: 'Grand Livre & Balance', icon: Library, Component: Ledger },
  { key: 'statements', label: 'Bilan · CPC · ESG', icon: FileSpreadsheet, Component: Statements },
  { key: 'analysis', label: 'Analyse & Ratios', icon: LineChart, Component: Analysis },
  { key: 'budget', label: 'Budget', icon: PiggyBank, Component: Budget },
  { key: 'treasury', label: 'Trésorerie', icon: Landmark, Component: TreasuryPure },
  { key: 'goals', label: 'Objectifs', icon: Target, Component: Goals },
];

export default function Finance() {
  const [tab, setTab] = useState('overview');
  const Active = TABS.find((t) => t.key === tab)?.Component || AccountingOverview;
  const todayEnergyLog = useHabitStore((s) => s.energyLogs.find((l) => l.date === todayKey()));

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Finance</h1>
        <p className="text-mute text-sm mt-1">
          Comptabilité personnelle en partie double — journal, états de synthèse, analyse financière, budget, trésorerie et objectifs. Montants en dirhams (DH).
        </p>
      </div>

      {todayEnergyLog && todayEnergyLog.stressLevel > 7 && (
        <div className="flex items-center gap-2 text-sm border border-bad/50 bg-bad/10 text-bad rounded-lg px-4 py-3">
          <HeartCrack size={16} className="shrink-0" />
          Stress is high today ({todayEnergyLog.stressLevel}/10) — avoid non-essential purchases for the next 24h. High-stress spending tends to be emotional, not planned.
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
                active ? 'text-accent border-accent' : 'text-mute border-transparent hover:text-ink'
              }`}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      <Active />
    </div>
  );
}
