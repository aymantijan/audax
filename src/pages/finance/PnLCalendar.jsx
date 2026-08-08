import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAccountingStore } from '../../store/accountingStore';
import { classOf } from '../../utils/chart-of-accounts';
import { fmtMAD, fmtSignedMAD, fmtDateShort } from '../../utils/formatters';
import { Card, EmptyState } from '../../components/common/ui';

// Calendrier du résultat comptable (produits − charges) JOUR PAR JOUR — même
// principe que le calendrier P&L du Trading, mais sur le journal comptable
// (classes 6 & 7) plutôt que sur les trades : vert = jour bénéficiaire, rouge
// = jour déficitaire, intensité proportionnelle au montant.
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const pad2 = (n) => String(n).padStart(2, '0');
const dateKey = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

export default function PnLCalendar() {
  const { journal, getDailyResults, getAccountMap } = useAccountingStore();
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const accountMap = getAccountMap();

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Grille calée sur lundi (convention FR), contrairement à Date.getDay() qui
  // démarre à dimanche=0 — même decalage que getPeriodBounds côté Budget.
  const leadingBlanks = (firstDay.getDay() + 6) % 7;

  const monthFrom = dateKey(year, month, 1);
  const monthTo = dateKey(year, month, daysInMonth);
  const dailyMap = useMemo(() => getDailyResults(monthFrom, monthTo), [getDailyResults, monthFrom, monthTo, journal]);

  const cells = useMemo(() => {
    const out = Array(leadingBlanks).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const key = dateKey(year, month, d);
      const r = dailyMap[key];
      out.push({ day: d, key, resultat: r ? r.resultat : null, produits: r?.produits, charges: r?.charges });
    }
    return out;
  }, [year, month, daysInMonth, leadingBlanks, dailyMap]);

  const monthResults = cells.filter(Boolean).filter((c) => c.resultat != null).map((c) => c.resultat);
  const maxAbs = Math.max(1, ...monthResults.map((r) => Math.abs(r)));
  const monthTotal = monthResults.reduce((a, r) => a + r, 0);
  const daysWithActivity = monthResults.length;
  const bestDay = monthResults.length ? Math.max(...monthResults) : null;
  const worstDay = monthResults.length ? Math.min(...monthResults) : null;

  const cellColor = (resultat) => {
    if (resultat == null) return 'transparent';
    const intensity = 0.15 + (Math.abs(resultat) / maxAbs) * 0.55;
    return resultat >= 0 ? `rgba(0, 217, 127, ${intensity})` : `rgba(255, 107, 107, ${intensity})`;
  };

  // Détail du jour sélectionné : une ligne par mouvement de résultat (compte
  // classe 6 ou 7) — une écriture qui répartit une dépense sur plusieurs
  // comptes apparaît donc en plusieurs lignes, comme labelBreakdown ailleurs.
  const selectedLines = useMemo(() => {
    if (!selectedDay) return [];
    return journal
      .filter((e) => e.date === selectedDay)
      .flatMap((e) =>
        e.lines
          .filter((l) => classOf(l.account) === 6 || classOf(l.account) === 7)
          .map((l) => ({
            entryId: e.id,
            label: e.label,
            account: l.account,
            accountLabel: accountMap[l.account]?.label || l.account,
            cls: classOf(l.account),
            amount:
              classOf(l.account) === 7
                ? (Number(l.credit) || 0) - (Number(l.debit) || 0)
                : -((Number(l.debit) || 0) - (Number(l.credit) || 0)),
          }))
      )
      .filter((x) => x.amount !== 0)
      .sort((a, b) => b.amount - a.amount);
  }, [journal, selectedDay, accountMap]);

  const goToday = () => { setCursor(new Date()); setSelectedDay(null); };
  const shiftMonth = (delta) => { setCursor(new Date(year, month + delta, 1)); setSelectedDay(null); };

  return (
    <div className="space-y-6">
      <Card
        title="Calendrier P&L"
        action={
          <div className="flex items-center gap-2">
            <button className="text-mute hover:text-accent cursor-pointer" onClick={() => shiftMonth(-1)}><ChevronLeft size={16} /></button>
            <button className="text-xs text-mute hover:text-accent cursor-pointer min-w-[110px] text-center" onClick={goToday}>
              {firstDay.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </button>
            <button className="text-mute hover:text-accent cursor-pointer" onClick={() => shiftMonth(1)}><ChevronRight size={16} /></button>
          </div>
        }
      >
        {journal.length ? (
          <>
            <div className="flex flex-wrap items-center gap-4 mb-3 text-xs text-mute">
              <span>Résultat du mois : <span className="font-semibold" style={{ color: monthTotal >= 0 ? 'var(--success)' : 'var(--error)' }}>{fmtSignedMAD(monthTotal)}</span></span>
              <span>{daysWithActivity} jour{daysWithActivity === 1 ? '' : 's'} avec mouvement</span>
              {bestDay != null && <span>Meilleur jour : <span className="text-success">{fmtSignedMAD(bestDay)}</span></span>}
              {worstDay != null && <span>Pire jour : <span className="text-bad">{fmtSignedMAD(worstDay)}</span></span>}
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
                    disabled={c.resultat == null}
                    onClick={() => setSelectedDay(selectedDay === c.key ? null : c.key)}
                    className={`aspect-square rounded-md text-[11px] flex flex-col items-center justify-center transition-transform ${c.resultat != null ? 'cursor-pointer hover:scale-105' : ''} ${selectedDay === c.key ? 'ring-2 ring-accent' : ''}`}
                    style={{ background: cellColor(c.resultat), color: c.resultat != null ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                    title={c.resultat != null ? `${fmtSignedMAD(c.resultat)} · produits ${fmtMAD(c.produits)} · charges ${fmtMAD(c.charges)}` : undefined}
                  >
                    <span>{c.day}</span>
                  </button>
                )
              )}
            </div>

            {selectedDay && (
              <div className="mt-4 pt-4 border-t border-line">
                <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-2">
                  {fmtDateShort(selectedDay)} — {selectedLines.length} mouvement{selectedLines.length > 1 ? 's' : ''}
                </div>
                {selectedLines.length ? (
                  <ul className="space-y-1.5">
                    {selectedLines.map((l, i) => (
                      <li key={`${l.entryId}-${i}`} className="flex items-center justify-between text-sm bg-surface border border-line rounded-lg px-3 py-2">
                        <span>{l.label} <span className="text-mute text-xs">· {l.accountLabel}</span></span>
                        <span className="font-medium" style={{ color: l.amount >= 0 ? 'var(--success)' : 'var(--error)' }}>{fmtSignedMAD(l.amount)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-mute">Aucun mouvement de résultat ce jour-là.</p>
                )}
              </div>
            )}
          </>
        ) : (
          <EmptyState>Aucune écriture au journal pour l'instant.</EmptyState>
        )}
      </Card>
    </div>
  );
}
