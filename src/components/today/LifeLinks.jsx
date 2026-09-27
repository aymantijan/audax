import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useAccountingStore } from '../../store/accountingStore';
import { useTradingStore } from '../../store/tradingStore';
import { useHealthStore } from '../../store/healthStore';
import { useHabitStore } from '../../store/habitStore';
import { useFocusStore } from '../../store/focusStore';
import { useLearningStore } from '../../store/learningStore';
import { useFreelanceStore } from '../../store/freelanceStore';
import { timelineData } from '../../services/life-timeline';
import { lifeLinks } from '../../utils/life-timeline';
import { formatMoney } from '../../utils/currency';
import { fmtDateShort, todayKey } from '../../utils/formatters';

// Shared by the Chronologie page and the Bilan card: the person's data for the
// timeline, the links between sections, and the list of findings (click = days).
// Re-read the stores whenever one of them changes.
export function useTimelineData() {
  const deps = [
    useAccountingStore((s) => s.journal), useTradingStore((s) => s.trades), useHealthStore((s) => s.workouts),
    useHealthStore((s) => s.bodyComp), useHabitStore((s) => s.energyLogs), useHabitStore((s) => s.logs),
    useFocusStore((s) => s.sessions), useLearningStore((s) => s.attendance), useFreelanceStore((s) => s.engagements),
  ];
  return useMemo(() => timelineData(), deps); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useLifeLinks() {
  const data = useTimelineData();
  const base = useAccountingStore((s) => s.baseCurrency);
  return useMemo(() => lifeLinks(data, { money: (n) => formatMoney(n, base), today: todayKey() }), [data, base]);
}

function Finding({ f }) {
  const [open, setOpen] = useState(false);
  const fmt = (v) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('fr-FR') : String(Math.round(v * 10) / 10).replace('.', ','));
  return (
    <li className="border-b border-line/60 last:border-0 py-2.5">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full text-left flex items-start gap-2 cursor-pointer">
        {open ? <ChevronDown size={15} className="mt-0.5 shrink-0 text-mute" /> : <ChevronRight size={15} className="mt-0.5 shrink-0 text-mute" />}
        <span className="text-sm">
          <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ background: f.better ? 'var(--success)' : 'var(--warning)' }} />
          {f.text} <span className="text-[11px] text-mute">({f.detail})</span>
        </span>
      </button>
      {open && (
        <div className="grid sm:grid-cols-2 gap-3 mt-2 pl-6 text-xs">
          {[['with', 'Jours « avec »'], ['without', 'Jours « sans »']].map(([k, label]) => (
            <div key={k}>
              <div className="text-mute mb-1">{label} ({f.days[k].length})</div>
              <ul className="max-h-40 overflow-y-auto space-y-0.5 font-data">
                {[...f.days[k]].sort((a, b) => (a.date < b.date ? 1 : -1)).map((d) => (
                  <li key={d.date} className="flex justify-between gap-3"><span>{fmtDateShort(d.date)}</span><span>{fmt(d.value)}</span></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

export function LinksList({ links, max }) {
  const list = max ? links.findings.slice(0, max) : links.findings;
  if (!list.length) return null;
  return <ul>{list.map((f) => <Finding key={f.key} f={f} />)}</ul>;
}

