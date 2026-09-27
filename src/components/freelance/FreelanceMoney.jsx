import { useMemo, useState } from 'react';
import { Copy, BellRing, Check } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useFreelanceStore } from '../../store/freelanceStore';
import { useAccountingStore } from '../../store/accountingStore';
import { overdueInvoices, monthlyRevenue, reminderMessage, invoiceTotals, fmtMoneyCur } from '../../utils/invoice';
import { fmtDateShort, fmtMAD, todayKey } from '../../utils/formatters';
import { tooltipStyle, axisTick, gridProps } from '../common/chart-theme';
import { Card, Button } from '../common/ui';
import { toast } from '../../store/uiStore';

// Late invoices, with a ready-to-send reminder (copied, never sent for you).
export function RemindersCard({ onOpenClient }) {
  const { invoices, engagements, invoiceSettings, markInvoiceReminded } = useFreelanceStore();
  const [shown, setShown] = useState(null);
  const late = overdueInvoices(invoices, todayKey());
  if (!late.length) return null;
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); toast('Relance copiée : colle-la dans ton e-mail.', 'success'); } catch { toast('Copie impossible : sélectionne le texte à la main.', 'warning'); }
  };
  return (
    <Card title={<span className="flex items-center gap-2"><BellRing size={15} /> À relancer ({late.length})</span>}>
      <ul className="divide-y divide-line/60">
        {late.map(({ inv, daysLate }) => {
          const client = engagements.find((e) => e.id === inv.engagementId);
          const text = reminderMessage(inv, client || {}, invoiceSettings, { daysLate, count: (inv.reminders || []).length });
          const last = (inv.reminders || []).slice(-1)[0];
          return (
            <li key={inv.id} className="py-2.5 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <button type="button" className="font-medium hover:text-accent cursor-pointer" onClick={() => onOpenClient(inv.engagementId)}>{client?.clientName || 'Client'}</button>
                <span className="text-mute">{inv.number}</span>
                <span className="text-bad text-xs">{daysLate} j de retard</span>
                {last && <span className="text-xs text-mute">· relancé le {fmtDateShort(last)}</span>}
                <span className="ml-auto font-data">{fmtMoneyCur(invoiceTotals(inv).due, inv.currency)}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setShown(shown === inv.id ? null : inv.id)}>{shown === inv.id ? 'Masquer le message' : 'Voir le message de relance'}</Button>
                <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => copy(text)}><span className="flex items-center gap-1.5"><Copy size={13} /> Copier</span></Button>
                <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => { markInvoiceReminded(inv.id); toast('Relance notée.', 'success'); }}><span className="flex items-center gap-1.5"><Check size={13} /> J’ai relancé</span></Button>
              </div>
              {shown === inv.id && <pre className="whitespace-pre-wrap text-xs bg-surface border border-line rounded-lg p-3 select-all">{text}</pre>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// Money received per month over the last 12 months, in the base currency.
export function RevenueCard() {
  const engagements = useFreelanceStore((s) => s.engagements);
  const acc = useAccountingStore.getState();
  const data = useMemo(() => {
    const toBase = (amt, cur) => (cur && cur !== acc.baseCurrency && acc.toBase ? acc.toBase(amt, cur) : amt);
    return monthlyRevenue(engagements, todayKey(), 12, toBase).map((m) => ({ ...m, label: new Date(`${m.month}-15T12:00:00`).toLocaleDateString('fr-FR', { month: 'short' }) }));
  }, [engagements]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = data.reduce((a, m) => a + m.amount, 0);
  if (!total) return null;
  return (
    <Card title="Chiffre d’affaires encaissé (12 mois)" action={<span className="font-data text-sm">{fmtMAD(total)}</span>}>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" tick={axisTick} />
          <YAxis tick={axisTick} width={56} />
          <Tooltip {...tooltipStyle} formatter={(v) => fmtMAD(v)} />
          <Bar dataKey="amount" name="Encaissé" radius={[4, 4, 0, 0]} fill="var(--accent-primary)" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
