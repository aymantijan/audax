import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, Library, FileSpreadsheet, LineChart, PiggyBank, Landmark, Target, HeartCrack, Tag, CalendarClock,
  CalendarDays, Crown, Wallet, ArrowLeftRight, Gem, Calculator, Sparkles, GraduationCap, Sun,
} from 'lucide-react';
import { useHabitStore } from '../store/habitStore';
import { useAccountingStore } from '../store/accountingStore';
import { todayKey } from '../utils/formatters';
import { useFinanceMode } from '../components/finance/financeMode';
import AccountingOverview from './finance/AccountingOverview';
import FinanceToday from './finance/FinanceToday';
import Journal from './finance/Journal';
import Ledger from './finance/Ledger';
import Statements from './finance/Statements';
import Analysis from './finance/Analysis';
import Budget from './finance/Budget';
import Echeances from './finance/Echeances';
import TreasuryPure from './finance/TreasuryPure';
import Goals from './finance/Goals';
import Labels from './finance/Labels';
import PnLCalendar from './finance/PnLCalendar';
import WealthRank from './finance/WealthRank';

// Système financier personnel en partie double (plan comptable marocain adapté
// à une personne physique). Le Journal reste la source unique ; l'interface est
// organisée en 5 espaces orientés usage, avec un mode Simple (vocabulaire du
// quotidien) et un mode Expert (partie double, grand livre, états de synthèse).
// Les clés de page ne changent pas : les liens ?tab= existants restent valides.
const SPACES = [
  {
    key: 'home', label: 'Aujourd’hui', desc: 'Reste à dépenser, échéances', icon: Sun,
    pages: [
      { key: 'today', label: 'Aujourd’hui', icon: Sun, Component: FinanceToday },
      { key: 'overview', label: 'Vue du mois', icon: LayoutDashboard, Component: AccountingOverview },
    ],
  },
  {
    key: 'spend', label: 'Dépenses & budget', desc: 'Opérations, budget, catégories', icon: Wallet,
    pages: [
      { key: 'journal', label: 'Opérations', expertLabel: 'Journal', icon: BookOpen, Component: Journal },
      { key: 'budget', label: 'Budget', icon: PiggyBank, Component: Budget },
      { key: 'labels', label: 'Libellés', icon: Tag, Component: Labels },
      { key: 'pnlCalendar', label: 'Calendrier', expertLabel: 'Calendrier P&L', icon: CalendarDays, Component: PnLCalendar },
    ],
  },
  {
    key: 'cash', label: 'Trésorerie', desc: 'Comptes, échéances, prévisions', icon: ArrowLeftRight,
    pages: [
      { key: 'treasury', label: 'Trésorerie', icon: Landmark, Component: TreasuryPure },
      { key: 'echeances', label: 'Échéances', icon: CalendarClock, Component: Echeances },
    ],
  },
  {
    key: 'wealth', label: 'Épargne & patrimoine', desc: 'Objectifs, richesse nette', icon: Gem,
    pages: [
      { key: 'goals', label: 'Objectifs', icon: Target, Component: Goals },
      { key: 'wealthRank', label: 'Rang de richesse', icon: Crown, Component: WealthRank },
    ],
  },
  {
    key: 'books', label: 'Comptabilité', desc: 'Grand livre, bilan, ratios', icon: Calculator, expertOnly: true,
    pages: [
      { key: 'ledger', label: 'Grand livre & balance', icon: Library, Component: Ledger },
      { key: 'statements', label: 'Bilan · CPC · ESG', icon: FileSpreadsheet, Component: Statements },
      { key: 'analysis', label: 'Analyse & ratios', icon: LineChart, Component: Analysis },
    ],
  },
];

function ModeSwitch({ mode, onChange }) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-surface p-1" role="radiogroup" aria-label="Niveau d'affichage">
      {[['simple', 'Simple', Sparkles], ['expert', 'Expert', GraduationCap]].map(([key, label, Icon]) => (
        <button key={key} role="radio" aria-checked={mode === key} onClick={() => onChange(key)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${mode === key ? 'bg-card text-ink shadow-sm ring-1 ring-line' : 'text-mute hover:text-ink'}`}>
          <Icon size={13} className={mode === key ? 'text-accent' : ''} /> {label}
        </button>
      ))}
    </div>
  );
}

export default function Finance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = useFinanceMode();
  const setUiMode = useAccountingStore((s) => s.setUiMode);
  const storedMode = useAccountingStore((s) => s.uiMode);
  // Freeze the default on first visit — otherwise a new user's first entry
  // would silently flip the interface from Simple to Expert.
  useEffect(() => { if (!storedMode) setUiMode(mode); }, [storedMode]); // eslint-disable-line react-hooks/exhaustive-deps
  // Post the automatic échéances that fell due since the last visit.
  const autoPostEcheances = useAccountingStore((s) => s.autoPostEcheances);
  useEffect(() => { autoPostEcheances(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const todayEnergyLog = useHabitStore((s) => s.energyLogs.find((l) => l.date === todayKey()));

  const spaces = useMemo(() => SPACES.filter((sp) => !sp.expertOnly || mode === 'expert'), [mode]);
  const allPages = useMemo(() => spaces.flatMap((sp) => sp.pages.map((p) => ({ ...p, space: sp.key }))), [spaces]);

  // QuickAdd deep-links as /finance?quickadd=journal (Journal opens its form);
  // GlobalSearch as /finance?tab=<key>.
  const [page, setPage] = useState(() => (searchParams.get('quickadd') === 'journal' ? 'journal' : searchParams.get('tab') || 'today'));
  const current = allPages.find((p) => p.key === page) || allPages[0];
  const currentSpace = spaces.find((sp) => sp.key === current.space);
  const [lastInSpace, setLastInSpace] = useState({});

  useEffect(() => {
    setLastInSpace((m) => ({ ...m, [current.space]: current.key }));
    if (searchParams.get('tab') !== current.key) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', current.key);
      setSearchParams(next, { replace: true });
    }
  }, [current.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const Active = current.Component;
  const pageLabel = (p) => (mode === 'expert' && p.expertLabel ? p.expertLabel : p.label);

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink">Finances</h1>
          <p className="text-mute text-sm mt-1">
            {mode === 'simple'
              ? 'Vos dépenses, revenus, budget, épargne et patrimoine — sans jargon comptable. Montants en dirhams (DH).'
              : 'Comptabilité personnelle en partie double : journal, états de synthèse, analyse, budget, trésorerie et objectifs. Montants en dirhams (DH).'}
          </p>
        </div>
        <ModeSwitch mode={mode} onChange={setUiMode} />
      </div>

      {todayEnergyLog && todayEnergyLog.stressLevel > 7 && (
        <div className="flex items-center gap-2 text-sm border border-bad/50 bg-bad/10 text-bad rounded-xl px-4 py-3">
          <HeartCrack size={16} className="shrink-0" />
          Stress élevé aujourd’hui ({todayEnergyLog.stressLevel}/10) : évitez les achats non essentiels pendant 24 h. Les dépenses sous stress sont souvent émotionnelles, pas planifiées.
        </div>
      )}

      {/* Level 1 — spaces */}
      <nav className={`grid ${spaces.length === 5 ? 'grid-cols-5' : 'grid-cols-4'} gap-1.5 rounded-2xl border border-line bg-surface p-1.5`} aria-label="Espaces finances">
        {spaces.map((sp) => {
          const Icon = sp.icon;
          const active = sp.key === currentSpace.key;
          return (
            <button key={sp.key} onClick={() => setPage(lastInSpace[sp.key] || sp.pages[0].key)} aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-2.5 text-center transition-colors cursor-pointer sm:flex-row sm:gap-2.5 sm:px-3 sm:text-left ${active ? 'bg-card text-ink shadow-sm ring-1 ring-line' : 'text-mute hover:bg-card/50 hover:text-ink'}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-accent/15 text-accent' : 'bg-card/60'}`}><Icon size={17} /></span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold sm:text-sm">{sp.label}</span>
                <span className="hidden truncate text-[11px] text-mute lg:block">{sp.desc}</span>
              </span>
            </button>
          );
        })}
      </nav>

      {/* Level 2 — pages of the space */}
      {currentSpace.pages.length > 1 && (
        <div className="-mt-1 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {currentSpace.pages.map((p) => {
            const Icon = p.icon;
            const active = p.key === current.key;
            return (
              <button key={p.key} onClick={() => setPage(p.key)}
                className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer ${active ? 'border-accent text-accent' : 'border-transparent text-mute hover:text-ink'}`}>
                <Icon size={15} /> {pageLabel(p)}
              </button>
            );
          })}
        </div>
      )}

      <Active />
    </div>
  );
}
