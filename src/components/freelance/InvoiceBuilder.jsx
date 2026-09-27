import { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { useFreelanceStore } from '../../store/freelanceStore';
import { unbilledItems, billingOf, mergeRefs } from '../../utils/billing';
import { addDaysKey, fmtMoneyCur } from '../../utils/invoice';
import { todayKey } from '../../utils/formatters';
import { Button, Field, Input, Modal } from '../common/ui';
import { LineEditor, TotalsBox, blankLine } from './LineEditor';

// New invoice: pick what is still to bill (work at the right rate, days, units,
// subscription period, schedule step, commissions, expenses), add catalogue or
// free lines, then discounts, withholding and deposit.
export default function InvoiceBuilder({ engagement, onClose }) {
  const { createInvoice, invoiceSettings } = useFreelanceStore();
  const today = todayKey();
  const b = billingOf(engagement);
  const items = useMemo(() => unbilledItems(engagement, today), [engagement, today]);
  const visible = items.filter((i) => !i.hidden);
  const [picked, setPicked] = useState(() => new Set(visible.map((i) => i.key)));
  const [extra, setExtra] = useState(visible.length ? [] : [blankLine()]);
  const [f, setF] = useState({
    date: today, dueDate: addDaysKey(today, Number(invoiceSettings.paymentTermsDays) || 30),
    vatRate: invoiceSettings.vatRate || 0, discountPct: b.discountPct || '', withholdingPct: b.withholdingPct || '', deposit: '', notes: '',
  });
  const [error, setError] = useState('');
  const cur = engagement.currency;

  const chosen = visible.filter((i) => picked.has(i.key));
  // Work covered by a subscription goes with the invoice that bills its period.
  // (work of a period is marked with the invoice that bills that same period's fee)
  const covered = items.filter((i) => i.hidden && chosen.some((c) => c.key === `ret-${i.key.slice(4)}`));
  const lines = [
    ...chosen.map((i) => ({ description: i.description, qty: i.qty, unit: i.unit, unitPrice: i.unitPrice, vatRate: i.vatRate ?? '', discountPct: '' })),
    ...extra,
  ];
  const doc = { ...f, lines: lines.map((l) => ({ ...l, vatRate: l.vatRate === '' ? null : Number(l.vatRate) })) };

  const submit = () => {
    const res = createInvoice(engagement.id, {
      ...f, lines, refs: mergeRefs([...chosen, ...covered]),
    });
    if (!res.ok) { setError(res.error); return; }
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Nouvelle facture — ${engagement.clientName}`} wide>
      <div className="space-y-4">
        {visible.length > 0 ? (
          <div>
            <div className="text-xs text-mute mb-1.5">Ce qu’il reste à facturer</div>
            <ul className="space-y-1 max-h-48 overflow-y-auto">
              {visible.map((i) => (
                <li key={i.key}>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" className="accent-[var(--accent-primary)]" checked={picked.has(i.key)}
                      onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(i.key); else n.delete(i.key); return n; })} />
                    <span className="flex-1">{i.description}{i.due ? <span className="text-xs text-mute"> · prévu le {i.due}</span> : null}</span>
                    <span className="text-xs font-data whitespace-nowrap">{i.qty} × {fmtMoneyCur(i.unitPrice, cur)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : <p className="text-sm text-mute">Rien d’enregistré à facturer pour ce client : ajoute des lignes ci-dessous (ou depuis ton catalogue).</p>}

        <div>
          <div className="text-xs text-mute mb-1.5">Autres lignes</div>
          <LineEditor lines={extra} setLines={setExtra} defaultVat={f.vatRate} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF((p) => ({ ...p, date: e.target.value, dueDate: addDaysKey(e.target.value, Number(invoiceSettings.paymentTermsDays) || 30) }))} /></Field>
          <Field label="Échéance"><Input type="date" value={f.dueDate} onChange={(e) => setF((p) => ({ ...p, dueDate: e.target.value }))} /></Field>
          <Field label="TVA par défaut (%)"><Input type="number" min="0" step="0.1" value={f.vatRate} onChange={(e) => setF((p) => ({ ...p, vatRate: e.target.value }))} /></Field>
          <Field label="Remise globale (%)"><Input type="number" min="0" max="100" step="any" value={f.discountPct} onChange={(e) => setF((p) => ({ ...p, discountPct: e.target.value }))} placeholder="0" /></Field>
          <Field label="Retenue à la source (%)" hint="Si le client retient un impôt sur ta facture."><Input type="number" min="0" max="100" step="any" value={f.withholdingPct} onChange={(e) => setF((p) => ({ ...p, withholdingPct: e.target.value }))} placeholder="0" /></Field>
          <Field label={`Acompte déjà versé (${cur})`}><Input type="number" min="0" step="any" value={f.deposit} onChange={(e) => setF((p) => ({ ...p, deposit: e.target.value }))} placeholder="0" /></Field>
        </div>
        <Field label="Note sur la facture (facultatif)"><Input value={f.notes} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} /></Field>
        <TotalsBox doc={doc} currency={cur} />
        {error && <p className="text-bad text-sm">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={submit}><span className="flex items-center gap-1.5"><FileText size={14} /> Créer la facture {invoiceSettings.prefix}-{f.date.slice(0, 4)}-{String(invoiceSettings.nextNumber || 1).padStart(3, '0')}</span></Button>
        </div>
      </div>
    </Modal>
  );
}
