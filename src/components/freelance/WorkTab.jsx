import { useMemo, useState } from 'react';
import { Clock, Trash2, Percent, FileText } from 'lucide-react';
import { useFreelanceStore } from '../../store/freelanceStore';
import { billingOf, rateOf, qtyOf, unitShort, blockAllocation, commissionOf, unbilledItems, itemsValue } from '../../utils/billing';
import { fmtMoneyCur } from '../../utils/invoice';
import { fmtDateShort, todayKey } from '../../utils/formatters';
import { Button, Field, Input, Select, EmptyState, IconButton } from '../common/ui';

// Work of one client: entries at any of its rates (hours, days, units) and,
// when the client pays a commission, the operations it is computed on.
export default function WorkTab({ engagement, invoices, onInvoice }) {
  const { logWork, logCommission, deleteTimeLog } = useFreelanceStore();
  const b = billingOf(engagement);
  const cur = engagement.currency;
  const [w, setW] = useState({ qty: '', rateId: b.rates[0].id, note: '', date: todayKey() });
  const [c, setC] = useState({ revenue: '', costs: '', base: '', note: '', date: todayKey() });
  const rate = rateOf(b, w.rateId);
  const covered = useMemo(() => (b.block?.enabled ? blockAllocation(engagement.timeLogs || [], engagement.blockPurchases, b).covered : new Set()), [engagement, b]);
  const toBill = useMemo(() => itemsValue(unbilledItems(engagement, todayKey())), [engagement]);
  const onProfit = b.commission?.on === 'profit';

  const statusOf = (t) => {
    const inv = t.invoiceId ? invoices.find((i) => i.id === t.invoiceId) : null;
    if (inv) return <span className="text-[10px] text-good">facturé · {inv.number}</span>;
    if (b.fixed?.enabled && t.kind !== 'commission') return <span className="text-[10px] text-mute">suivi (forfait)</span>;
    if (covered.has(t.id)) return <span className="text-[10px] text-mute">décompté du paquet</span>;
    return <span className="text-[10px] text-warn">à facturer</span>;
  };

  return (
    <div className="space-y-4">
      <form className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end" onSubmit={(e) => { e.preventDefault(); if (!(Number(String(w.qty).replace(',', '.')) > 0)) return; logWork(engagement.id, w); setW((x) => ({ ...x, qty: '', note: '' })); }}>
        {b.rates.length > 1 && (
          <Field label="Prestation"><Select value={w.rateId} onChange={(e) => setW((x) => ({ ...x, rateId: e.target.value }))} options={b.rates.map((r) => ({ value: r.id, label: `${r.label} (${fmtMoneyCur(r.price, cur)} / ${unitShort(r)})` }))} /></Field>
        )}
        <Field label={`Quantité (${unitShort(rate)})`}><Input inputMode="decimal" value={w.qty} onChange={(e) => setW((x) => ({ ...x, qty: e.target.value }))} placeholder={rate.unit === 'h' ? '2,5' : '1'} /></Field>
        <Field label="Date"><Input type="date" value={w.date} onChange={(e) => setW((x) => ({ ...x, date: e.target.value }))} /></Field>
        <Field label="Travail réalisé"><Input value={w.note} onChange={(e) => setW((x) => ({ ...x, note: e.target.value }))} placeholder="ex. Réunion de lancement" /></Field>
        <Button type="submit"><span className="flex items-center gap-1.5"><Clock size={14} /> Ajouter</span></Button>
      </form>

      {b.commission?.enabled && (
        <form className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end rounded-lg border border-line p-3" onSubmit={(e) => {
          e.preventDefault();
          if (onProfit ? !(c.revenue !== '') : !(Number(c.base) > 0)) return;
          logCommission(engagement.id, { ...c, on: onProfit ? 'profit' : 'amount' });
          setC((x) => ({ ...x, revenue: '', costs: '', base: '', note: '' }));
        }}>
          <div className="col-span-2 sm:col-span-5 text-xs text-mute flex items-center gap-1.5"><Percent size={12} /> Commission de {b.commission.pct || 0} % {onProfit ? 'sur le bénéfice net' : 'sur le montant'}</div>
          {onProfit ? (
            <>
              <Field label={`Ventes (${cur})`}><Input inputMode="decimal" value={c.revenue} onChange={(e) => setC((x) => ({ ...x, revenue: e.target.value }))} /></Field>
              <Field label={`Coûts (${cur})`}><Input inputMode="decimal" value={c.costs} onChange={(e) => setC((x) => ({ ...x, costs: e.target.value }))} /></Field>
            </>
          ) : (
            <Field label={`Montant (${cur})`}><Input inputMode="decimal" value={c.base} onChange={(e) => setC((x) => ({ ...x, base: e.target.value }))} /></Field>
          )}
          <Field label="Date"><Input type="date" value={c.date} onChange={(e) => setC((x) => ({ ...x, date: e.target.value }))} /></Field>
          <Field label="Libellé"><Input value={c.note} onChange={(e) => setC((x) => ({ ...x, note: e.target.value }))} placeholder="ex. Ventes de septembre" /></Field>
          <Button type="submit" variant="secondary">Ajouter</Button>
        </form>
      )}

      {(engagement.timeLogs || []).length ? (
        <ul className="space-y-1.5 max-h-64 overflow-y-auto">
          {[...engagement.timeLogs].sort((a, x) => (a.date < x.date ? 1 : -1)).map((t) => {
            const r = rateOf(b, t.rateId);
            const com = t.kind === 'commission' ? commissionOf(t, b) : null;
            return (
              <li key={t.id} className="flex items-center gap-2 bg-surface border border-line rounded-lg px-3 py-2 text-sm">
                <span className="font-medium font-data whitespace-nowrap">{com ? fmtMoneyCur(com.amount, cur) : `${qtyOf(t)} ${unitShort(r)}`}</span>
                <span className="flex-1 text-xs text-mute min-w-0 truncate">
                  {fmtDateShort(t.date)} · {com ? com.description : `${r.label}${t.note ? ` — ${t.note}` : ''}`}
                </span>
                {statusOf(t)}
                {!t.invoiceId && <IconButton label="Supprimer" tone="danger" onClick={() => deleteTimeLog(engagement.id, t.id)}><Trash2 size={13} /></IconButton>}
              </li>
            );
          })}
        </ul>
      ) : <EmptyState>Rien de noté pour l’instant.</EmptyState>}

      {toBill > 0 && (
        <Button onClick={onInvoice}><span className="flex items-center gap-1.5"><FileText size={14} /> Facturer ({fmtMoneyCur(toBill, cur)} à facturer)</span></Button>
      )}
    </div>
  );
}
