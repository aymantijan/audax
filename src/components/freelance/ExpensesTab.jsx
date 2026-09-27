import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useFreelanceStore } from '../../store/freelanceStore';
import { fmtMoneyCur } from '../../utils/invoice';
import { fmtDateShort, todayKey } from '../../utils/formatters';
import { Button, Field, Input, EmptyState, IconButton } from '../common/ui';
import { toast } from '../../store/uiStore';

// Expenses made for a client (transport, purchases, km…), recharged on the
// next invoice with an optional markup — or kept as non-rebilled costs.
export default function ExpensesTab({ engagement, invoices }) {
  const { addExpense, deleteExpense } = useFreelanceStore();
  const cur = engagement.currency;
  const [f, setF] = useState({ label: '', amount: '', date: todayKey(), markupPct: '', vatRate: '', rebill: true });
  const list = [...(engagement.expenses || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <div className="space-y-3">
      <form className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end" onSubmit={(e) => {
        e.preventDefault();
        const r = addExpense(engagement.id, f);
        if (!r.ok) { toast(r.error, 'warning'); return; }
        setF((x) => ({ ...x, label: '', amount: '', markupPct: '', vatRate: '' }));
      }}>
        <div className="col-span-2"><Field label="Frais"><Input value={f.label} onChange={(e) => setF((x) => ({ ...x, label: e.target.value }))} placeholder="ex. Train aller-retour, 120 km" /></Field></div>
        <Field label={`Montant (${cur})`}><Input inputMode="decimal" value={f.amount} onChange={(e) => setF((x) => ({ ...x, amount: e.target.value }))} /></Field>
        <Field label="Marge (%)"><Input type="number" min="0" step="any" value={f.markupPct} onChange={(e) => setF((x) => ({ ...x, markupPct: e.target.value }))} placeholder="0" /></Field>
        <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF((x) => ({ ...x, date: e.target.value }))} /></Field>
        <Button type="submit"><span className="flex items-center gap-1.5"><Plus size={14} /> Ajouter</span></Button>
        <label className="col-span-2 sm:col-span-6 flex items-center gap-2 text-xs text-mute cursor-pointer">
          <input type="checkbox" className="accent-[var(--accent-primary)]" checked={f.rebill} onChange={(e) => setF((x) => ({ ...x, rebill: e.target.checked }))} />
          À refacturer au client (sinon, gardé comme coût de la mission)
        </label>
      </form>
      {list.length ? (
        <ul className="space-y-1.5">
          {list.map((x) => {
            const inv = x.invoiceId ? invoices.find((i) => i.id === x.invoiceId) : null;
            return (
              <li key={x.id} className="flex items-center gap-2 bg-surface border border-line rounded-lg px-3 py-2 text-sm">
                <span className="font-data font-medium">{fmtMoneyCur(x.amount, cur)}</span>
                <span className="flex-1 text-xs text-mute truncate">{fmtDateShort(x.date)} · {x.label}{x.markupPct ? ` · +${x.markupPct} %` : ''}</span>
                {inv ? <span className="text-[10px] text-good">refacturé · {inv.number}</span>
                  : x.rebill === false ? <span className="text-[10px] text-mute">non refacturé</span>
                    : <span className="text-[10px] text-warn">à refacturer</span>}
                {!inv && <IconButton label="Supprimer" tone="danger" onClick={() => deleteExpense(engagement.id, x.id)}><Trash2 size={13} /></IconButton>}
              </li>
            );
          })}
        </ul>
      ) : <EmptyState>Aucun frais.</EmptyState>}
    </div>
  );
}
