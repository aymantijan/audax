import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fmtSignedMoney, fmtDateShort } from '../../utils/formatters';
import { Card, EmptyState } from '../common/ui';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function PnLCalendar({ trades, currency = 'USD' }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  const dailyMap = useMemo(() => {
    const map = {};
    for (const t of trades) {
      const day = String(t.date).slice(0, 10);
      (map[day] ??= { pnl: 0, count: 0 }).pnl += t.pnl;
      map[day].count++;
    }
    return map;
  }, [trades]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstDay.getDay();

  const cells = useMemo(() => {
    const out = Array(leadingBlanks).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      out.push({ day: d, key, ...dailyMap[key] });
    }
    return out;
  }, [year, month, daysInMonth, leadingBlanks, dailyMap]);

  const monthPnls = cells.filter(Boolean).filter((c) => c.pnl != null).map((c) => c.pnl);
  const maxAbs = Math.max(1, ...monthPnls.map((p) => Math.abs(p)));
  const monthTotal = monthPnls.reduce((a, p) => a + p, 0);
  const daysTraded = monthPnls.length;

  const cellColor = (pnl) => {
    if (pnl == null) return 'transparent';
    const intensity = 0.15 + (Math.abs(pnl) / maxAbs) * 0.55;
    return pnl >= 0 ? `rgba(0, 217, 127, ${intensity})` : `rgba(255, 107, 107, ${intensity})`;
  };

  const selectedTrades = selectedDay ? trades.filter((t) => t.date === selectedDay).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)) : [];

  const goToday = () => { setCursor(new Date()); setSelectedDay(null); };
  const shiftMonth = (delta) => { setCursor(new Date(year, month + delta, 1)); setSelectedDay(null); };

  return (
    <Card
      title="P&L Calendar"
      action={
        <div className="flex items-center gap-2">
          <button className="text-mute hover:text-accent cursor-pointer" onClick={() => shiftMonth(-1)}><ChevronLeft size={16} /></button>
          <button className="text-xs text-mute hover:text-accent cursor-pointer min-w-[90px] text-center" onClick={goToday}>
            {firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </button>
          <button className="text-mute hover:text-accent cursor-pointer" onClick={() => shiftMonth(1)}><ChevronRight size={16} /></button>
        </div>
      }
    >
      {trades.length ? (
        <>
          <div className="flex items-center gap-4 mb-3 text-xs text-mute">
            <span>Month P&L: <span className="font-semibold" style={{ color: monthTotal >= 0 ? 'var(--success)' : 'var(--error)' }}>{fmtSignedMoney(monthTotal, currency)}</span></span>
            <span>{daysTraded} day{daysTraded === 1 ? '' : 's'} traded</span>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-mute mb-1">
            {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((c, i) =>
              c === null ? (
                <div key={`blank-${i}`} />
              ) : (
                <button
                  key={c.key}
                  type="button"
                  disabled={c.pnl == null}
                  onClick={() => setSelectedDay(selectedDay === c.key ? null : c.key)}
                  className={`aspect-square rounded-md text-[11px] flex flex-col items-center justify-center transition-transform ${c.pnl != null ? 'cursor-pointer hover:scale-105' : ''} ${selectedDay === c.key ? 'ring-2 ring-accent' : ''}`}
                  style={{ background: cellColor(c.pnl), color: c.pnl != null ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                  title={c.pnl != null ? `${fmtSignedMoney(c.pnl, currency)} · ${c.count} trade${c.count > 1 ? 's' : ''}` : undefined}
                >
                  <span>{c.day}</span>
                </button>
              )
            )}
          </div>

          {selectedDay && (
            <div className="mt-4 pt-4 border-t border-line">
              <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-2">{fmtDateShort(selectedDay)} — {selectedTrades.length} trade{selectedTrades.length > 1 ? 's' : ''}</div>
              <ul className="space-y-1.5">
                {selectedTrades.map((t) => (
                  <li key={t.id} className="flex items-center justify-between text-sm bg-surface border border-line rounded-lg px-3 py-2">
                    <span>{t.instrument} · {t.strategy} · <span className="capitalize text-mute">{t.direction}</span></span>
                    <span className="font-medium" style={{ color: t.pnl >= 0 ? 'var(--success)' : 'var(--error)' }}>{fmtSignedMoney(t.pnl, currency)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <EmptyState>No trades yet.</EmptyState>
      )}
    </Card>
  );
}
