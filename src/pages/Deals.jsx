import { useState } from 'react';
import { Briefcase, Rocket } from 'lucide-react';
import PrivateEquity from './deals/PrivateEquity';
import Businesses from './deals/Businesses';

const TABS = [
  { key: 'pe', label: 'Private Equity', icon: Briefcase, Component: PrivateEquity },
  { key: 'business', label: 'Business Projects', icon: Rocket, Component: Businesses },
];

export default function Deals() {
  const [tab, setTab] = useState('pe');
  const Active = TABS.find((t) => t.key === tab)?.Component || PrivateEquity;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Deals</h1>
        <p className="text-mute text-sm mt-1">Private equity deal log and end-to-end business project tracking.</p>
      </div>

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
