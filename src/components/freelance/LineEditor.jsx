import { Plus, Trash2, BookOpen } from 'lucide-react';
import { useFreelanceStore } from '../../store/freelanceStore';
import { invoiceTotals, fmtMoneyCur } from '../../utils/invoice';
import { Input, IconButton } from '../common/ui';

export const blankLine = (price = '') => ({ description: '', qty: 1, unit: '', unitPrice: price, vatRate: '', discountPct: '' });

// Lines of a quote or an invoice: description, quantity, unit, price, VAT and
// discount per line, plus the catalogue of usual services.
export function LineEditor({ lines, setLines, defaultVat }) {
  const catalog = useFreelanceStore((s) => s.invoiceSettings.catalog) || [];
  const set = (i, k, v) => setLines((x) => x.map((y, j) => (j === i ? { ...y, [k]: v } : y)));
  const cell = 'text-xs';
  return (
    <div className="space-y-2">
      <div className="hidden sm:grid grid-cols-12 gap-2 text-[11px] text-mute">
        <span className="col-span-4">Désignation</span><span className="col-span-1">Qté</span><span className="col-span-2">Unité</span>
        <span className="col-span-2">Prix unitaire</span><span className="col-span-1">TVA %</span><span className="col-span-1">Remise %</span>
      </div>
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-6 sm:grid-cols-12 gap-2 items-center border-b border-line/50 pb-2 sm:border-0 sm:pb-0">
          <Input className={`col-span-6 sm:col-span-4 ${cell}`} value={l.description} onChange={(e) => set(i, 'description', e.target.value)} placeholder="Désignation" aria-label="Désignation" />
          <Input className={`col-span-1 ${cell}`} type="number" min="0" step="any" value={l.qty} onChange={(e) => set(i, 'qty', e.target.value)} aria-label="Quantité" />
          <Input className={`col-span-2 ${cell}`} value={l.unit} onChange={(e) => set(i, 'unit', e.target.value)} placeholder="h, jour, article…" aria-label="Unité" />
          <Input className={`col-span-2 ${cell}`} type="number" min="0" step="any" value={l.unitPrice} onChange={(e) => set(i, 'unitPrice', e.target.value)} aria-label="Prix unitaire" />
          <Input className={`col-span-1 ${cell}`} type="number" min="0" step="0.1" value={l.vatRate} onChange={(e) => set(i, 'vatRate', e.target.value)} placeholder={String(defaultVat ?? 0)} aria-label="TVA en %" />
          <Input className={`col-span-1 sm:col-span-1 ${cell}`} type="number" min="0" max="100" step="any" value={l.discountPct} onChange={(e) => set(i, 'discountPct', e.target.value)} placeholder="0" aria-label="Remise en %" />
          <IconButton className="col-span-1 sm:col-span-1" label="Retirer la ligne" tone="danger" onClick={() => setLines((x) => x.filter((_, j) => j !== i))}><Trash2 size={14} /></IconButton>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="text-xs text-accent hover:underline cursor-pointer flex items-center gap-1" onClick={() => setLines((x) => [...x, blankLine()])}><Plus size={12} /> Ajouter une ligne</button>
        {catalog.length > 0 && (
          <label className="text-xs text-mute flex items-center gap-1.5">
            <BookOpen size={12} />
            <select className="bg-surface border border-line rounded-md px-2 py-1 text-xs text-ink" value="" onChange={(e) => {
              const c = catalog.find((x) => x.id === e.target.value);
              if (c) setLines((x) => [...x.filter((y) => String(y.description).trim() || Number(y.unitPrice)), { description: c.label, qty: 1, unit: c.unit, unitPrice: c.price, vatRate: c.vatRate ?? '', discountPct: '' }]);
            }}>
              <option value="">Depuis le catalogue…</option>
              {catalog.map((c) => <option key={c.id} value={c.id}>{c.label} · {c.price}{c.unit ? ` / ${c.unit}` : ''}</option>)}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}

// Totals block: excl. tax, discount, VAT per rate, incl. tax, withholding, deposit, due.
export function TotalsBox({ doc, currency }) {
  const t = invoiceTotals(doc);
  const row = (label, v, strong) => (
    <div className={`flex justify-between gap-6 ${strong ? 'font-semibold text-ink' : 'text-mute'}`}><span>{label}</span><span className="font-data">{fmtMoneyCur(v, currency)}</span></div>
  );
  return (
    <div className="rounded-lg bg-surface border border-line px-3 py-2 text-sm space-y-0.5 sm:ml-auto sm:w-80">
      {t.discount > 0 && row('Remises', -t.discount)}
      {row('Total hors taxes', t.subtotal)}
      {Object.entries(t.vatByRate).map(([r, v]) => row(`TVA ${String(r).replace('.', ',')} %`, v))}
      {row(t.vat ? 'Total TTC' : 'Total', t.total, !t.withholding && !t.deposit)}
      {t.withholding > 0 && row(`Retenue à la source ${doc.withholdingPct} %`, -t.withholding)}
      {t.deposit > 0 && row('Acompte déjà versé', -t.deposit)}
      {(t.withholding > 0 || t.deposit > 0) && row('Net à payer', t.due, true)}
    </div>
  );
}
