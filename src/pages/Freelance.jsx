import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Plus, Trash2, Pencil, Clock, FileText, Download, CheckCircle2, Settings2, Receipt, Ban, BookCheck } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useFreelanceStore } from '../store/freelanceStore';
import { useAccountingStore } from '../store/accountingStore';
import { useCareerStore } from '../store/careerStore';
import { useAuthStore } from '../store/authStore';
import { ENGAGEMENT_STATUSES, CURRENCIES } from '../utils/constants';
import { fmtDateShort, fmtMAD, todayKey } from '../utils/formatters';
import { invoiceTotals, fmtMoneyCur, addDaysKey } from '../utils/invoice';
import { exportInvoicePDF } from '../utils/invoice-pdf';
import { Card, Stat, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState } from '../components/common/ui';
import AccountSelect from '../components/common/AccountSelect';
import BadgeList from '../components/common/BadgeList';
import { tooltipStyle } from '../components/common/chart-theme';
import QuotesTab from '../components/freelance/Quotes';
import { RemindersCard, RevenueCard } from '../components/freelance/FreelanceMoney';

const STATUS_COLOR = { Prospect: 'var(--text-secondary)', Actif: 'var(--success)', 'En pause': 'var(--warning)', 'Terminé': 'var(--accent-secondary)' };
const INV_STATUS = { sent: ['À encaisser', 'var(--warning)'], paid: ['Payée', 'var(--success)'], cancelled: ['Annulée', 'var(--text-secondary)'] };

const useBase = () => useAccountingStore((s) => s.baseCurrency) || 'MAD';
function useToBase() {
  const acc = useAccountingStore();
  return (amt, cur) => (cur && cur !== acc.baseCurrency ? acc.toBase(amt, cur) : amt);
}

const blank = (base) => ({ clientName: '', description: '', status: 'Prospect', hourlyRate: '', currency: base, startDate: todayKey(), clientEmail: '', clientAddress: '', clientTaxId: '', notes: '' });

function ClientForm({ initial, onSubmit, submitLabel, onCancel }) {
  const [f, setF] = useState(initial);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit(f); }}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Client"><Input value={f.clientName} onChange={set('clientName')} autoFocus /></Field>
        <Field label="Mission"><Input value={f.description} onChange={set('description')} placeholder="ex. Modèle financier pour levée de fonds" /></Field>
        <Field label="Statut"><Select value={f.status} onChange={set('status')} options={ENGAGEMENT_STATUSES} /></Field>
        <Field label="Date de début"><Input type="date" value={f.startDate} onChange={set('startDate')} /></Field>
        <Field label="Devise de facturation"><Select value={f.currency} onChange={set('currency')} options={CURRENCIES} /></Field>
        <Field label={`Taux horaire (${f.currency})`}><Input type="number" min="0" step="any" value={f.hourlyRate} onChange={set('hourlyRate')} /></Field>
        <Field label="Email du client"><Input value={f.clientEmail} onChange={set('clientEmail')} /></Field>
        <Field label="Identifiant fiscal du client (ICE…)"><Input value={f.clientTaxId} onChange={set('clientTaxId')} /></Field>
      </div>
      <Field label="Adresse du client (pour la facture)"><Textarea rows={2} value={f.clientAddress} onChange={set('clientAddress')} /></Field>
      <Field label="Notes"><Textarea rows={2} value={f.notes} onChange={set('notes')} /></Field>
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>}
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}

function SettingsModal({ onClose }) {
  const { invoiceSettings, setInvoiceSettings } = useFreelanceStore();
  const userName = useAuthStore((s) => s.user?.name) || '';
  const profile = useCareerStore((s) => s.profile);
  const [f, setF] = useState({ ...invoiceSettings, issuerName: invoiceSettings.issuerName || userName, issuerEmail: invoiceSettings.issuerEmail || profile?.email || '', issuerPhone: invoiceSettings.issuerPhone || profile?.phone || '', issuerAddress: invoiceSettings.issuerAddress || profile?.location || '' });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  return (
    <Modal open onClose={onClose} title="Mes informations de facturation" wide>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setInvoiceSettings({ ...f, nextNumber: Math.max(1, Number(f.nextNumber) || 1), paymentTermsDays: Number(f.paymentTermsDays) || 30, vatRate: Number(f.vatRate) || 0 }); onClose(); }}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nom ou raison sociale"><Input value={f.issuerName} onChange={set('issuerName')} /></Field>
          <Field label="Email"><Input value={f.issuerEmail} onChange={set('issuerEmail')} /></Field>
          <Field label="Téléphone"><Input value={f.issuerPhone} onChange={set('issuerPhone')} /></Field>
          <Field label="Identifiants (ICE, IF, n° auto-entrepreneur…)"><Input value={f.taxIds} onChange={set('taxIds')} /></Field>
        </div>
        <Field label="Adresse"><Textarea rows={2} value={f.issuerAddress} onChange={set('issuerAddress')} /></Field>
        <Field label="Coordonnées de paiement (RIB, IBAN, PayPal…)"><Textarea rows={2} value={f.bankDetails} onChange={set('bankDetails')} /></Field>
        <div className="grid sm:grid-cols-4 gap-3">
          <Field label="Préfixe"><Input value={f.prefix} onChange={set('prefix')} /></Field>
          <Field label="Prochain n°"><Input type="number" min="1" value={f.nextNumber} onChange={set('nextNumber')} /></Field>
          <Field label="Délai de paiement (jours)"><Input type="number" min="0" value={f.paymentTermsDays} onChange={set('paymentTermsDays')} /></Field>
          <Field label="TVA par défaut (%)"><Input type="number" min="0" step="0.1" value={f.vatRate} onChange={set('vatRate')} /></Field>
        </div>
        <Field label="Mention en bas de facture" hint="Ton statut fiscal détermine la mention exacte (TVA ou exonération) : vérifie-la auprès d’un comptable."><Input value={f.footer} onChange={set('footer')} /></Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit">Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}

function InvoiceModal({ engagement, onClose }) {
  const { createInvoice, invoiceSettings } = useFreelanceStore();
  const unbilled = (engagement.timeLogs || []).filter((t) => !t.invoiceId).sort((a, b) => a.date.localeCompare(b.date));
  const [picked, setPicked] = useState(unbilled.map((t) => t.id));
  const [extra, setExtra] = useState([]);
  const [f, setF] = useState({ date: todayKey(), dueDate: addDaysKey(todayKey(), Number(invoiceSettings.paymentTermsDays) || 30), vatRate: invoiceSettings.vatRate || 0, notes: '' });
  const [error, setError] = useState('');
  const rate = Number(engagement.hourlyRate) || 0;
  const lines = [
    ...unbilled.filter((t) => picked.includes(t.id)).map((t) => ({ description: `${t.note || engagement.description || 'Prestation'} (${fmtDateShort(t.date)})`, qty: t.hours, unitPrice: rate })),
    ...extra,
  ];
  const totals = invoiceTotals({ lines, vatRate: f.vatRate });
  const cur = engagement.currency;
  return (
    <Modal open onClose={onClose} title={`Nouvelle facture — ${engagement.clientName}`} wide>
      <div className="space-y-4">
        {unbilled.length > 0 ? (
          <div>
            <div className="text-xs text-mute mb-1.5">Heures non facturées ({unbilled.reduce((a, t) => a + t.hours, 0)} h à {fmtMoneyCur(rate, cur)}/h)</div>
            <ul className="space-y-1 max-h-40 overflow-y-auto">
              {unbilled.map((t) => (
                <li key={t.id}>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" className="accent-[var(--accent-primary)]" checked={picked.includes(t.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, t.id] : p.filter((x) => x !== t.id)))} />
                    <span className="flex-1">{t.note || 'Prestation'} <span className="text-xs text-mute">{fmtDateShort(t.date)}</span></span>
                    <span className="text-xs tabular-nums">{t.hours} h</span>
                  </label>
                </li>
              ))}
            </ul>
            {!rate && <p className="text-[11px] text-warn mt-1">Aucun taux horaire sur ce client : renseigne-le (onglet Client) ou ajoute des lignes au forfait.</p>}
          </div>
        ) : <p className="text-sm text-mute">Aucune heure à facturer : ajoute des lignes au forfait ci-dessous.</p>}

        <div>
          <div className="text-xs text-mute mb-1.5">Lignes au forfait</div>
          {extra.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 mb-2">
              <Input className="col-span-7" value={l.description} onChange={(e) => setExtra((x) => x.map((y, j) => (j === i ? { ...y, description: e.target.value } : y)))} placeholder="Désignation" />
              <Input className="col-span-2" type="number" min="0" step="any" value={l.qty} onChange={(e) => setExtra((x) => x.map((y, j) => (j === i ? { ...y, qty: e.target.value } : y)))} />
              <Input className="col-span-2" type="number" min="0" step="any" value={l.unitPrice} onChange={(e) => setExtra((x) => x.map((y, j) => (j === i ? { ...y, unitPrice: e.target.value } : y)))} placeholder="Prix" />
              <button className="col-span-1 text-mute hover:text-bad cursor-pointer" onClick={() => setExtra((x) => x.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
            </div>
          ))}
          <button className="text-xs text-accent hover:underline cursor-pointer flex items-center gap-1" onClick={() => setExtra((x) => [...x, { description: '', qty: 1, unitPrice: '' }])}><Plus size={12} /> Ajouter une ligne</button>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF((p) => ({ ...p, date: e.target.value, dueDate: addDaysKey(e.target.value, Number(invoiceSettings.paymentTermsDays) || 30) }))} /></Field>
          <Field label="Échéance"><Input type="date" value={f.dueDate} onChange={(e) => setF((p) => ({ ...p, dueDate: e.target.value }))} /></Field>
          <Field label="TVA (%)"><Input type="number" min="0" step="0.1" value={f.vatRate} onChange={(e) => setF((p) => ({ ...p, vatRate: e.target.value }))} /></Field>
        </div>
        <Field label="Note sur la facture (optionnel)"><Input value={f.notes} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} /></Field>
        <div className="rounded-lg bg-surface border border-line px-3 py-2 text-sm flex flex-wrap gap-x-5 justify-end">
          <span>HT {fmtMoneyCur(totals.subtotal, cur)}</span>
          {Number(f.vatRate) > 0 && <span>TVA {fmtMoneyCur(totals.vat, cur)}</span>}
          <b>Total {fmtMoneyCur(totals.total, cur)}</b>
        </div>
        {error && <p className="text-bad text-sm">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={() => {
            const res = createInvoice(engagement.id, { ...f, lines, timeLogIds: picked });
            if (!res.ok) return setError(res.error);
            onClose();
          }}><span className="flex items-center gap-1.5"><FileText size={14} /> Créer la facture {invoiceSettings.prefix}-{f.date.slice(0, 4)}-{String(invoiceSettings.nextNumber || 1).padStart(3, '0')}</span></Button>
        </div>
      </div>
    </Modal>
  );
}

function PayModal({ title, amountText, onConfirm, onClose, askAmount = false }) {
  const [f, setF] = useState({ date: todayKey(), account: '511', post: true, amount: '', note: '' });
  return (
    <Modal open onClose={onClose} title={title}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (askAmount && !(Number(f.amount) > 0)) return; onConfirm({ date: f.date, account: f.post ? f.account : '', amount: f.amount, note: f.note }); onClose(); }}>
        {amountText && <div className="text-sm">Montant : <b>{amountText}</b></div>}
        {askAmount && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Montant reçu"><Input type="number" min="0" step="any" value={f.amount} onChange={(e) => setF((p) => ({ ...p, amount: e.target.value }))} autoFocus /></Field>
            <Field label="Note"><Input value={f.note} onChange={(e) => setF((p) => ({ ...p, note: e.target.value }))} placeholder="ex. acompte" /></Field>
          </div>
        )}
        <Field label="Reçu le"><Input type="date" value={f.date} onChange={(e) => setF((p) => ({ ...p, date: e.target.value }))} /></Field>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" className="accent-[var(--accent-primary)]" checked={f.post} onChange={(e) => setF((p) => ({ ...p, post: e.target.checked }))} />
          Enregistrer ce revenu dans Finances
        </label>
        {f.post && <Field label="Arrivé sur le compte"><AccountSelect classes={[5]} simple value={f.account} onChange={(e) => setF((p) => ({ ...p, account: e.target.value }))} /></Field>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit"><span className="flex items-center gap-1.5"><CheckCircle2 size={14} /> Confirmer</span></Button>
        </div>
      </form>
    </Modal>
  );
}

function EngagementDetail({ engagementId, onClose }) {
  const store = useFreelanceStore();
  const { logHours, deleteTimeLog, logPayment, deletePayment, postPayment, cancelInvoice, payInvoice, editEngagement, deleteEngagement, invoiceSettings } = store;
  const engagement = store.engagements.find((e) => e.id === engagementId);
  const invoices = (store.invoices || []).filter((i) => i.engagementId === engagementId).sort((a, b) => (a.date < b.date ? 1 : -1));
  const [tab, setTab] = useState('heures');
  const [hours, setHours] = useState({ hours: '', note: '', date: todayKey() });
  const [newInvoice, setNewInvoice] = useState(false);
  const [paying, setPaying] = useState(null); // invoice | 'free' | { post: paymentId }
  if (!engagement) return null;
  const cur = engagement.currency;
  const unbilledH = (engagement.timeLogs || []).filter((t) => !t.invoiceId).reduce((a, t) => a + t.hours, 0);
  const outstanding = invoices.filter((i) => i.status === 'sent').reduce((a, i) => a + invoiceTotals(i).total, 0);
  const quoteCount = (store.quotes || []).filter((q) => q.engagementId === engagementId).length;
  const tabs = [['heures', `Heures (${engagement.hoursLogged || 0} h)`], ['devis', `Devis (${quoteCount})`], ['factures', `Factures (${invoices.length})`], ['paiements', `Paiements (${(engagement.payments || []).length})`], ['client', 'Client']];

  return (
    <Modal open onClose={onClose} title={engagement.clientName} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-surface border border-line rounded-lg py-2"><div className="text-lg font-bold">{unbilledH} h</div><div className="text-[10px] text-mute">à facturer</div></div>
          <div className="bg-surface border border-line rounded-lg py-2"><div className="text-lg font-bold text-warn">{fmtMoneyCur(outstanding, cur)}</div><div className="text-[10px] text-mute">à encaisser</div></div>
          <div className="bg-surface border border-line rounded-lg py-2"><div className="text-lg font-bold text-good">{fmtMoneyCur(engagement.paidTotal || 0, cur)}</div><div className="text-[10px] text-mute">encaissé</div></div>
          <div className="bg-surface border border-line rounded-lg py-2"><div className="text-lg font-bold">{engagement.hourlyRate ? fmtMoneyCur(engagement.hourlyRate, cur) : '—'}</div><div className="text-[10px] text-mute">par heure</div></div>
        </div>
        <div className="flex gap-1 border-b border-line overflow-x-auto">
          {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap cursor-pointer ${tab === k ? 'text-accent border-accent' : 'text-mute border-transparent hover:text-ink'}`}>{l}</button>)}
        </div>

        {tab === 'devis' && <QuotesTab engagement={engagement} />}

        {tab === 'heures' && (
          <div className="space-y-3">
            <form className="grid sm:grid-cols-4 gap-2 items-end" onSubmit={(e) => { e.preventDefault(); if (!(Number(hours.hours) > 0)) return; logHours(engagement.id, hours); setHours((h) => ({ ...h, hours: '', note: '' })); }}>
              <Field label="Heures"><Input type="number" step="0.25" min="0" value={hours.hours} onChange={(e) => setHours((h) => ({ ...h, hours: e.target.value }))} placeholder="2,5" /></Field>
              <Field label="Date"><Input type="date" value={hours.date} onChange={(e) => setHours((h) => ({ ...h, date: e.target.value }))} /></Field>
              <Field label="Travail réalisé"><Input value={hours.note} onChange={(e) => setHours((h) => ({ ...h, note: e.target.value }))} placeholder="ex. Modèle DCF" /></Field>
              <Button type="submit"><span className="flex items-center gap-1.5"><Clock size={14} /> Ajouter</span></Button>
            </form>
            {(engagement.timeLogs || []).length ? (
              <ul className="space-y-1.5 max-h-56 overflow-y-auto">
                {[...engagement.timeLogs].sort((a, b) => (a.date < b.date ? 1 : -1)).map((t) => {
                  const inv = t.invoiceId ? invoices.find((i) => i.id === t.invoiceId) : null;
                  return (
                    <li key={t.id} className="flex items-center gap-2 bg-surface border border-line rounded-lg px-3 py-2 text-sm">
                      <span className="font-medium w-12">{t.hours} h</span>
                      <span className="flex-1 text-xs text-mute">{fmtDateShort(t.date)}{t.note ? ` · ${t.note}` : ''}</span>
                      {inv ? <span className="text-[10px] text-good">facturée · {inv.number}</span> : <span className="text-[10px] text-warn">à facturer</span>}
                      {!inv && <button className="text-mute hover:text-bad cursor-pointer" onClick={() => deleteTimeLog(engagement.id, t.id)}><Trash2 size={13} /></button>}
                    </li>
                  );
                })}
              </ul>
            ) : <EmptyState>Aucune heure.</EmptyState>}
            {unbilledH > 0 && <Button onClick={() => setNewInvoice(true)}><span className="flex items-center gap-1.5"><FileText size={14} /> Facturer ces heures</span></Button>}
          </div>
        )}

        {tab === 'factures' && (
          <div className="space-y-3">
            <Button onClick={() => setNewInvoice(true)}><span className="flex items-center gap-1.5"><Plus size={14} /> Nouvelle facture</span></Button>
            {invoices.length ? (
              <ul className="space-y-2">
                {invoices.map((inv) => {
                  const [label, color] = INV_STATUS[inv.status];
                  const late = inv.status === 'sent' && inv.dueDate < todayKey();
                  return (
                    <li key={inv.id} className="flex flex-wrap items-center gap-2 border border-line rounded-lg px-3 py-2 text-sm">
                      <Receipt size={15} className="text-accent" />
                      <span className="font-medium">{inv.number}</span>
                      <span className="text-xs text-mute">{fmtDateShort(inv.date)} · échéance {fmtDateShort(inv.dueDate)}</span>
                      <span className="text-xs font-semibold" style={{ color: late ? 'var(--error)' : color }}>{late ? 'En retard' : label}</span>
                      <span className="flex-1 text-right font-semibold tabular-nums">{fmtMoneyCur(invoiceTotals(inv).total, inv.currency)}</span>
                      <button className="p-1 text-mute hover:text-accent cursor-pointer" title="PDF" onClick={() => exportInvoicePDF(inv, engagement, invoiceSettings)}><Download size={14} /></button>
                      {inv.status === 'sent' && <Button className="!py-1 !px-2 text-xs" onClick={() => setPaying(inv)}>Encaisser</Button>}
                      {inv.status === 'sent' && <button className="p-1 text-mute hover:text-bad cursor-pointer" title="Annuler la facture" onClick={() => { if (confirm(`Annuler la facture ${inv.number} ? Son numéro ne sera pas réutilisé.`)) cancelInvoice(inv.id); }}><Ban size={14} /></button>}
                    </li>
                  );
                })}
              </ul>
            ) : <EmptyState>Aucune facture pour ce client.</EmptyState>}
          </div>
        )}

        {tab === 'paiements' && (
          <div className="space-y-3">
            <Button variant="secondary" onClick={() => setPaying('free')}><span className="flex items-center gap-1.5"><Plus size={14} /> Paiement sans facture (acompte…)</span></Button>
            {(engagement.payments || []).length ? (
              <ul className="space-y-1.5">
                {[...engagement.payments].sort((a, b) => (a.date < b.date ? 1 : -1)).map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 bg-surface border border-line rounded-lg px-3 py-2 text-sm">
                    <span className="font-semibold tabular-nums text-good">{fmtMoneyCur(p.amount, cur)}</span>
                    <span className="flex-1 text-xs text-mute">{fmtDateShort(p.date)}{p.note ? ` · ${p.note}` : ''}</span>
                    {p.entryId ? <Link to="/finance?tab=journal" className="text-[11px] text-good flex items-center gap-1 hover:underline"><BookCheck size={12} /> dans Finances</Link>
                      : <button className="text-[11px] text-accent hover:underline cursor-pointer" onClick={() => setPaying({ post: p.id })}>Comptabiliser</button>}
                    <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm('Supprimer ce paiement ? Son écriture dans Finances sera supprimée aussi.')) deletePayment(engagement.id, p.id); }}><Trash2 size={13} /></button>
                  </li>
                ))}
              </ul>
            ) : <EmptyState>Aucun paiement.</EmptyState>}
          </div>
        )}

        {tab === 'client' && (
          <ClientForm initial={{ clientName: engagement.clientName, description: engagement.description || '', status: engagement.status, hourlyRate: engagement.hourlyRate || '', currency: engagement.currency || 'MAD', startDate: engagement.startDate || todayKey(), clientEmail: engagement.clientEmail || '', clientAddress: engagement.clientAddress || '', clientTaxId: engagement.clientTaxId || '', notes: engagement.notes || '' }}
            submitLabel="Enregistrer" onSubmit={(f) => editEngagement(engagement.id, f)} />
        )}
        {tab === 'client' && <button className="text-xs text-bad hover:underline cursor-pointer" onClick={() => { if (confirm(`Supprimer « ${engagement.clientName} » et son historique ?`)) { deleteEngagement(engagement.id); onClose(); } }}>Supprimer ce client</button>}
      </div>

      {newInvoice && <InvoiceModal engagement={engagement} onClose={() => { setNewInvoice(false); setTab('factures'); }} />}
      {paying && paying !== 'free' && !paying.post && <PayModal title={`Encaisser ${paying.number}`} amountText={fmtMoneyCur(invoiceTotals(paying).total, paying.currency)} onClose={() => setPaying(null)} onConfirm={({ date, account }) => payInvoice(paying.id, { date, account })} />}
      {paying === 'free' && <PayModal title="Paiement reçu" askAmount onClose={() => setPaying(null)} onConfirm={({ date, account, amount, note }) => logPayment(engagement.id, { date, amount, note, account })} />}
      {paying?.post && <PayModal title="Comptabiliser ce paiement" onClose={() => setPaying(null)} onConfirm={({ account }) => account && postPayment(engagement.id, paying.post, account)} />}
    </Modal>
  );
}

export default function Freelance() {
  const { engagements, invoices, addEngagement, setStatus, getBadges, getMonthStats } = useFreelanceStore();
  const base = useBase();
  const toBase = useToBase();
  const [modal, setModal] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const active = engagements.filter((e) => e.status === 'Actif');
  const monthStats = getMonthStats();
  const curOf = (id) => engagements.find((e) => e.id === id)?.currency;
  const totalPaid = engagements.reduce((a, e) => a + toBase(e.paidTotal || 0, e.currency), 0);
  const open = (invoices || []).filter((i) => i.status === 'sent');
  const outstanding = open.reduce((a, i) => a + toBase(invoiceTotals(i).total, i.currency || curOf(i.engagementId)), 0);
  const overdue = open.filter((i) => i.dueDate < todayKey());
  const byClient = useMemo(
    () => [...engagements].filter((e) => e.hoursLogged > 0).sort((a, b) => b.hoursLogged - a.hoursLogged).slice(0, 8).map((e) => ({ name: e.clientName, hours: e.hoursLogged })),
    [engagements]
  );
  const outstandingOf = (id) => (invoices || []).filter((i) => i.engagementId === id && i.status === 'sent').reduce((a, i) => a + invoiceTotals(i).total, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Freelance</h1>
          <p className="text-mute text-sm mt-1">Devis, heures, factures, relances et paiements : chaque paiement reçu arrive dans Finances.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setSettingsOpen(true)}><span className="flex items-center gap-1.5"><Settings2 size={15} /> Facturation</span></Button>
          <Button onClick={() => setModal(true)}><span className="flex items-center gap-2"><Plus size={16} /> Nouveau client</span></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Clients actifs" value={active.length} sub={`${engagements.length} au total`} />
        <Stat label="Heures ce mois-ci" value={monthStats.hours} />
        <Stat label="Encaissé ce mois-ci" value={fmtMAD(monthStats.revenue)} color={monthStats.revenue ? 'var(--success)' : undefined} sub={`total ${fmtMAD(totalPaid)}`} />
        <Stat label="À encaisser" value={fmtMAD(outstanding)} color={overdue.length ? 'var(--error)' : outstanding ? 'var(--warning)' : undefined} sub={overdue.length ? `${overdue.length} facture(s) en retard` : `${open.length} facture(s) en attente`} />
      </div>

      <RemindersCard onOpenClient={setDetailId} />
      <RevenueCard />

      {byClient.length > 1 && (
        <Card title="Heures par client">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byClient} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="hours" name="Heures" radius={[0, 4, 4, 0]} fill="var(--accent-primary)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card title={`Clients (${engagements.length})`}>
        {engagements.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mute border-b border-line">
                  <th className="py-2 pr-4">Client</th><th className="py-2 pr-4">Statut</th><th className="py-2 pr-4 text-right">Heures</th>
                  <th className="py-2 pr-4 text-right">À encaisser</th><th className="py-2 pr-4 text-right">Encaissé</th><th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {[...engagements].sort((a, b) => b.updatedAt - a.updatedAt).map((e) => {
                  const due = outstandingOf(e.id);
                  return (
                    <tr key={e.id} className="border-b border-line/50 hover:bg-surface/50">
                      <td className="py-2.5 pr-4"><button className="hover:text-accent cursor-pointer text-left font-medium" onClick={() => setDetailId(e.id)}>{e.clientName}</button><div className="text-[11px] text-mute">{e.description}</div></td>
                      <td className="py-2.5 pr-4"><Select value={e.status} onChange={(ev) => setStatus(e.id, ev.target.value)} options={ENGAGEMENT_STATUSES} className="!py-1 !px-2 text-xs w-28" /></td>
                      <td className="py-2.5 pr-4 text-right">{e.hoursLogged || 0} h</td>
                      <td className="py-2.5 pr-4 text-right" style={{ color: due ? 'var(--warning)' : undefined }}>{due ? fmtMoneyCur(due, e.currency) : '—'}</td>
                      <td className="py-2.5 pr-4 text-right">{fmtMoneyCur(e.paidTotal || 0, e.currency || base)}</td>
                      <td className="py-2.5 text-right"><button className="text-mute hover:text-accent cursor-pointer" onClick={() => setDetailId(e.id)}><Pencil size={14} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState><Briefcase className="mx-auto mb-2 text-mute" size={26} />Aucun client pour l’instant.</EmptyState>}
      </Card>

      <BadgeList badges={getBadges()} />

      {modal && (
        <Modal open onClose={() => setModal(false)} title="Nouveau client" wide>
          <ClientForm initial={blank(base)} submitLabel="Créer" onCancel={() => setModal(false)}
            onSubmit={(f) => { const res = addEngagement(f); if (!res.ok) return alert(res.error); setModal(false); setDetailId(res.id); }} />
        </Modal>
      )}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {detailId && <EngagementDetail key={detailId} engagementId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
