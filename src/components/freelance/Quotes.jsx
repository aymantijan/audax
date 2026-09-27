import { useState } from 'react';
import { Plus, Trash2, Download, FileText, Check, X } from 'lucide-react';
import { useFreelanceStore } from '../../store/freelanceStore';
import { invoiceTotals, fmtMoneyCur, addDaysKey } from '../../utils/invoice';
import { exportInvoicePDF } from '../../utils/invoice-pdf';
import { fmtDateShort, todayKey } from '../../utils/formatters';
import { Button, Field, Input, Modal, Badge, IconButton } from '../common/ui';
import { LineEditor, TotalsBox } from './LineEditor';
import { billingOf, unitShort } from '../../utils/billing';

const STATUS = {
  sent: { label: 'Envoyé', color: 'var(--accent-primary)' },
  accepted: { label: 'Accepté', color: 'var(--success)' },
  refused: { label: 'Refusé', color: 'var(--text-secondary)' },
  invoiced: { label: 'Facturé', color: 'var(--success)' },
};

function QuoteModal({ engagement, onClose }) {
  const { createQuote, invoiceSettings } = useFreelanceStore();
  const b = billingOf(engagement);
  const first = b.rates[0];
  const [lines, setLines] = useState([{ description: engagement.description || first.label, qty: 1, unit: unitShort(first), unitPrice: first.price || '', vatRate: '', discountPct: '' }]);
  const [f, setF] = useState({ date: todayKey(), validUntil: addDaysKey(todayKey(), 30), vatRate: invoiceSettings.vatRate || 0, discountPct: b.discountPct || '', notes: '' });
  const [error, setError] = useState('');
  const cur = engagement.currency;
  const doc = { ...f, lines: lines.map((l) => ({ ...l, vatRate: l.vatRate === '' ? null : Number(l.vatRate) })) };
  return (
    <Modal open onClose={onClose} title={`Nouveau devis — ${engagement.clientName}`} wide>
      <div className="space-y-4">
        <LineEditor lines={lines} setLines={setLines} defaultVat={f.vatRate} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF((p) => ({ ...p, date: e.target.value, validUntil: addDaysKey(e.target.value, 30) }))} /></Field>
          <Field label="Valable jusqu’au"><Input type="date" value={f.validUntil} onChange={(e) => setF((p) => ({ ...p, validUntil: e.target.value }))} /></Field>
          <Field label="TVA par défaut (%)"><Input type="number" min="0" step="0.1" value={f.vatRate} onChange={(e) => setF((p) => ({ ...p, vatRate: e.target.value }))} /></Field>
          <Field label="Remise globale (%)"><Input type="number" min="0" max="100" step="any" value={f.discountPct} onChange={(e) => setF((p) => ({ ...p, discountPct: e.target.value }))} placeholder="0" /></Field>
        </div>
        <Field label="Note (facultatif)"><Input value={f.notes} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} placeholder="ex. Délai de réalisation : 3 semaines" /></Field>
        <TotalsBox doc={doc} currency={cur} />
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
                <span className="ml-auto font-data text-sm">{fmtMoneyCur(invoiceTotals(q).due, q.currency)}</span>
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
