import { useMemo, useState, lazy, Suspense } from 'react';
import { Droplets, Plus, SlidersHorizontal, Wallet, Zap } from 'lucide-react';
import { useHabitStore } from '../../store/habitStore';
import { useHealthStore } from '../../store/healthStore';
import { useAccountingStore } from '../../store/accountingStore';
import { computeToday } from '../finance/todayMoney';
import { fmtMAD, todayKey } from '../../utils/formatters';
import { Button, Card, playSeal } from '../common/ui';

const QuickEntryModal = lazy(() => import('../finance/QuickEntryModal'));

const QUICK_STATES = [
  { key: 'tired', emoji: '😴', label: 'Fatigué', sub: 'Sommeil court', energy: 4, sleepHours: 6, sleepScore: 5, stress: 6 },
  { key: 'good', emoji: '🙂', label: 'Normal', sub: 'Journée classique', energy: 7, sleepHours: 7.5, sleepScore: 7, stress: 3 },
  { key: 'great', emoji: '⚡', label: 'En forme', sub: 'Bien reposé', energy: 9, sleepHours: 8, sleepScore: 9, stress: 2 },
];

export function QuickCheckinPresets({ today, onOpenFull }) {
  const saveEnergyLog = useHabitStore((s) => s.saveEnergyLog);

  const pick = (preset, e) => {
    playSeal(e.currentTarget);
    saveEnergyLog({
      date: today,
      energyStartLevel: preset.energy,
      sleepData: {
        sleepHours: preset.sleepHours,
        sleepStartTime: '23:30',
        wakeTime: '07:00',
        sleepQualityScore: preset.sleepScore,
      },
      stressLevel: preset.stress,
    });
  };

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-3 gap-2">
        {QUICK_STATES.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={(e) => pick(p, e)}
            className="flex flex-col items-center justify-center gap-0.5 rounded-xl border border-line bg-surface px-2.5 py-2.5 text-center hover:border-accent hover:bg-card transition-colors cursor-pointer"
          >
            <span className="text-lg leading-none">{p.emoji}</span>
            <span className="text-xs font-semibold text-ink mt-1">{p.label}</span>
            <span className="text-[0.6875rem] text-mute">{p.sub}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-mute pt-0.5">
        <span>1 toucher pour noter ta forme du matin</span>
        <button
          type="button"
          onClick={onOpenFull}
          className="inline-flex items-center gap-1 text-accent hover:underline cursor-pointer"
        >
          <SlidersHorizontal size={12} /> Détailler
        </button>
      </div>
    </div>
  );
}

export function QuickWaterBar({ today }) {
  const waterLogs = useHealthStore((s) => s.waterLogs);
  const waterTargetMl = useHealthStore((s) => s.waterTargetMl);
  const logWater = useHealthStore((s) => s.logWater);

  const todayMl = useMemo(
    () => (waterLogs || []).filter((w) => w.date === today).reduce((a, w) => a + (Number(w.amountMl) || 0), 0),
    [waterLogs, today]
  );
  const targetL = ((waterTargetMl || 2000) / 1000).toFixed(1).replace('.0', '');
  const currentL = (todayMl / 1000).toFixed(2).replace(/\.?0+$/, '');

  return (
    <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <Droplets size={16} className={todayMl >= (waterTargetMl || 2000) ? 'text-good shrink-0' : 'text-accent shrink-0'} />
        <span className="text-xs text-ink font-medium truncate">
          Eau : <b className="font-data">{todayMl ? `${currentL} L` : '0 L'}</b>
          <span className="text-mute"> / {targetL} L</span>
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={(e) => { playSeal(e.currentTarget); logWater(250, today); }}
          className="ui-btn rounded-lg border border-line bg-card px-2.5 py-1 text-xs font-semibold text-ink hover:border-accent cursor-pointer"
        >
          + 250 ml
        </button>
        <button
          type="button"
          onClick={(e) => { playSeal(e.currentTarget); logWater(500, today); }}
          className="ui-btn rounded-lg border border-line bg-card px-2.5 py-1 text-xs font-semibold text-mute hover:text-ink hover:border-accent cursor-pointer"
        >
          + 500 ml
        </button>
      </div>
    </div>
  );
}

export function TodayMoneyQuickCard({ children }) {
  const store = useAccountingStore();
  const { journal, echeances, goals, budgets } = store;
  const [quickOpen, setQuickOpen] = useState(false);

  const info = useMemo(() => computeToday(store), [journal, echeances, goals, budgets]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasActivity = journal.length > 0 || echeances.length > 0 || budgets.length > 0;

  return (
    <Card
      title={<span className="flex items-center gap-2"><Wallet size={15} className="text-accent" /> Argent du jour</span>}
      action={
        <Button className="!px-2.5 !py-1 text-xs" onClick={() => setQuickOpen(true)}>
          <span className="flex items-center gap-1"><Plus size={13} /> Dépense</span>
        </Button>
      }
    >
      {hasActivity ? (
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <div className="rounded-xl border border-line bg-surface px-3 py-2">
            <div className="text-[0.6875rem] text-mute">Budget / jour restant</div>
            <div className="text-[1rem] font-bold font-data text-ink mt-0.5">{fmtMAD(Math.max(0, info.perDay))}</div>
          </div>
          <div className="rounded-xl border border-line bg-surface px-3 py-2">
            <div className="text-[0.6875rem] text-mute">Dépensé aujourd’hui</div>
            <div className="text-[1rem] font-bold font-data text-ink mt-0.5">{fmtMAD(info.spentToday)}</div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 text-xs text-mute mb-2">
          <span>Note tes dépenses en 1 clic sans quitter cet écran.</span>
          <button type="button" onClick={() => setQuickOpen(true)} className="text-accent hover:underline font-medium shrink-0 cursor-pointer">
            <span className="inline-flex items-center gap-1"><Zap size={12} /> Saisie éclair</span>
          </button>
        </div>
      )}
      {children}
      <Suspense fallback={null}>
        {quickOpen && <QuickEntryModal open={quickOpen} onClose={() => setQuickOpen(false)} />}
      </Suspense>
    </Card>
  );
}
