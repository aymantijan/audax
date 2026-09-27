import { useState } from 'react';
import { Plus, Trash2, Download, FileText, Check, X } from 'lucide-react';
import { useFreelanceStore } from '../../store/freelanceStore';
import { invoiceTotals, fmtMoneyCur, addDaysKey } from '../../utils/invoice';
import { exportInvoicePDF } from '../../utils/invoice-pdf';
import { fmtDateShort, todayKey } from '../../utils/formatters';
import { Button, Field, Input, Modal, Badge, IconButton } from '../common/ui';

const STATUS = {
  sent: { label: 'Envoyé', color: 'var(--accent-primary)' },
  accepted: { label: 'Accepté', color: 'var(--success)' },
  refused: { label: 'Refusé', color: 'var(--text-secondary)' },
  invoiced: { label: 'Facturé', color: 'var(--success)' },
};

function QuoteModal({ engagement, onClose }) {
  const { createQuote, invoiceSettings } = useFreelanceStore();
  const rate = Number(engagement.hourlyRate) || 0;
  const [lines, setLines] = useState([{ description: engagement.description || '', qty: 1, unitPrice: rate || '' }]);
  const [f, setF] = useState({ date: todayKey(), validUntil: addDaysKey(todayKey(), 30), vatRate: invoiceSettings.vatRate || 0, notes: '' });
  const [error, setError] = useState('');
  const totals = invoiceTotals({ lines, vatRate: f.vatRate });
  const cur = engagement.currency;
  const setLine = (i, k, v) => setLines((x) => x.map((y, j) => (j === i ? { ...y, [k]: v } : y)));
  return (
    <Modal open onClose={onClose} title={`Nouveau devis — ${engagement.clientName}`} wide>
      <div className="space-y-4">
        <div>
          <div className="grid grid-cols-12 gap-2 text-[11px] text-mute mb-1"><span className="col-span-7">Désignation</span><span className="col-span-2">Quantité</span><span className="col-span-2">Prix unitaire</span></div>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 mb-2">
              <Input className="col-span-7" value={l.description} onChange={(e) => setLine(i, 'description', e.target.value)} placeholder="ex. Audit et recommandations" aria-label="Désignation" />
              <Input className="col-span-2" type="number" min="0" step="any" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} aria-label="Quantité" />
              <Input className="col-span-2" type="number" min="0" step="any" value={l.unitPrice} onChange={(e) => setLine(i, 'unitPrice', e.target.value)} aria-label="Prix unitaire" />
              <IconButton className="col-span-1" label="Retirer la ligne" tone="danger" onClick={() => setLines((x) => x.filter((_, j) => j !== i))}><Trash2 size={14} /></IconButton>
            </div>
          ))}
          <button type="button" className="text-xs text-accent hover:underline cursor-pointer flex items-center gap-1" onClick={() => setLines((x) => [...x, { description: '', qty: 1, unitPrice: rate || '' }])}><Plus size={12} /> Ajouter une ligne</button>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF((p) => ({ ...p, date: e.target.value, validUntil: addDaysKey(e.target.value, 30) }))} /></Field>
          <Field label="Valable jusqu’au"><Input type="date" value={f.validUntil} onChange={(e) => setF((p) => ({ ...p, validUntil: e.target.value }))} /></Field>
          <Field label="TVA (%)"><Input type="number" min="0" step="0.1" value={f.vatRate} onChange={(e) => setF((p) => ({ ...p, vatRate: e.target.value }))} /></Field>
        </div>
        <Field label="Note (optionnel)"><Input value={f.notes} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} placeholder="ex. Délai de réalisation : 3 semaines" /></Field>
        <div className="rounded-lg bg-surface border border-line px-3 py-2 text-sm flex flex-wrap gap-x-5 justify-end">
          <span>HT {fmtMoneyCur(totals.subtotal, cur)}</span>
          {Number(f.vatRate) > 0 && <span>TVA {fmtMoneyCur(totals.vat, cur)}</span>}
          <b>Total {fmtMoneyCur(totals.total, cur)}</b>
        </div>
        {error && <p className="text-bad text-sm">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={() => { const res = createQuote(engagement.id, { ...f, lines }); if (!res.ok) return setError(res.error); onClose(); }}>
            <span className="flex items-center gap-1.5"><FileText size={14} /> Créer le devis</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Quotes of one client: PDF, accepted / refused, turn into an invoice.
export default function QuotesTab({ engagement }) {
  const { quotes = [], invoiceSettings, setQuoteStatus, quoteToInvoice, deleteQuote } = useFreelanceStore();
  const [creating, setCreating] = useState(false);
  const list = quotes.filter((q) => q.engagementId === engagement.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  const today = todayKey();
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-xs text-mute">Un devis accepté se transforme en facture en un geste, avec les mêmes lignes.</p>
        <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setCreating(true)}><span className="flex items-center gap-1.5"><Plus size={13} /> Nouveau devis</span></Button>
      </div>
      {list.length ? (
        <ul className="divide-y divide-line/60">
          {list.map((q) => {
            const expired = q.status === 'sent' && q.validUntil < today;
            return (
              <li key={q.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className="font-medium text-sm">{q.number}</span>
                <Badge color={expired ? 'var(--warning)' : STATUS[q.status].color}>{expired ? 'Expiré' : STATUS[q.status].label}</Badge>
                <span className="text-xs text-mute">{fmtDateShort(q.date)} · valable jusqu’au {fmtDateShort(q.validUntil)}</span>
                <span className="ml-auto font-data text-sm">{fmtMoneyCur(invoiceTotals(q).total, q.currency)}</span>
                <div className="flex items-center">
                  <IconButton label="Télécharger le PDF" onClick={() => exportInvoicePDF(q, engagement, invoiceSettings, { kind: 'quote' })}><Download size={14} /></IconButton>
                  {q.status === 'sent' && <IconButton label="Accepté par le client" onClick={() => setQuoteStatus(q.id, 'accepted')}><Check size={14} /></IconButton>}
                  {q.status === 'sent' && <IconButton label="Refusé" tone="danger" onClick={() => setQuoteStatus(q.id, 'refused')}><X size={14} /></IconButton>}
                  {(q.status === 'accepted' || q.status === 'sent') && (
                    <Button className="!px-2.5 !py-1 text-xs ml-1" onClick={() => { const r = quoteToInvoice(q.id); if (!r.ok) alert(r.error); }}>Facturer</Button>
                  )}
                  {q.status !== 'invoiced' && <IconButton label="Supprimer le devis" tone="danger" onClick={() => { if (confirm(`Supprimer le devis ${q.number} ?`)) deleteQuote(q.id); }}><Trash2 size={13} /></IconButton>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : <p className="text-sm text-mute py-2">Aucun devis pour ce client.</p>}
      {creating && <QuoteModal engagement={engagement} onClose={() => setCreating(false)} />}
    </div>
  );
}
