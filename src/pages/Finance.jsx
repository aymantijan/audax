import { useState } from 'react';
import { LayoutDashboard, Receipt, PiggyBank, Landmark, LineChart } from 'lucide-react';
import Overview from './finance/Overview';
import Transactions from './finance/Transactions';
import BudgetCosts from './finance/BudgetCosts';
import Treasury from './finance/Treasury';
import RatiosWealth from './finance/RatiosWealth';

const TABS = [
  { key: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard, Component: Overview },
  { key: 'transactions', label: 'Transactions', icon: Receipt, Component: Transactions },
  { key: 'budget', label: 'Budget & Coûts', icon: PiggyBank, Component: BudgetCosts },
  { key: 'treasury', label: 'Trésorerie', icon: Landmark, Component: Treasury },
  { key: 'ratios', label: 'Ratios & Patrimoine', icon: LineChart, Component: RatiosWealth },
];

export default function Finance() {
  const [tab, setTab] = useState('overview');
  const Active = TABS.find((t) => t.key === tab)?.Component || Overview;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Finance</h1>
        <p className="text-mute text-sm mt-1">
          Gestion financière personnelle — comptabilité générale, comptabilité des coûts, gestion budgétaire et de trésorerie. Montants en dirhams (DH).
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
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
