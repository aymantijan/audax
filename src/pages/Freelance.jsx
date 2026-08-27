import { useMemo, useState } from 'react';
import { Briefcase, Plus, Trash2, Pencil, Clock, DollarSign } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useFreelanceStore } from '../store/freelanceStore';
import { ENGAGEMENT_STATUSES } from '../utils/constants';
import { fmtDateShort, fmtMAD, todayKey } from '../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState } from '../components/common/ui';
import EntityFormModal from '../components/common/EntityFormModal';
import BadgeList from '../components/common/BadgeList';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };
const STATUS_COLOR = { Prospect: 'var(--text-secondary)', Actif: 'var(--success)', 'En pause': 'var(--warning)', 'Terminé': 'var(--accent-secondary)' };

const blank = () => ({ clientName: '', description: '', status: 'Prospect', hourlyRate: '', startDate: todayKey(), notes: '' });
const engagementFields = [
  { name: 'clientName', label: 'Client', type: 'text' },
  { name: 'description', label: 'Description de la mission', type: 'text' },
  { name: 'status', label: 'Statut', type: 'select', options: ENGAGEMENT_STATUSES },
  { name: 'hourlyRate', label: 'Taux horaire (DH)', type: 'number' },
  { name: 'startDate', label: 'Date de début', type: 'date' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

// Client detail: log hours / payments, mirrors Networking's ContactDetailModal
// (re-derived from the live store by id, never a stale click-time snapshot).
function EngagementDetailModal({ engagement, onClose, logHours, deleteTimeLog, logPayment }) {
  const [hours, setHours] = useState('');
  const [hoursNote, setHoursNote] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  if (!engagement) return null;

  const submitHours = (e) => {
    e.preventDefault();
    if (!hours) return;
    logHours(engagement.id, { date: todayKey(), hours, note: hoursNote });
    setHours(''); setHoursNote('');
  };
  const submitPayment = (e) => {
    e.preventDefault();
    if (!amount) return;
    logPayment(engagement.id, { date: todayKey(), amount, note: paymentNote });
    setAmount(''); setPaymentNote('');
  };

  return (
    <Modal open={!!engagement} onClose={onClose} title={engagement.clientName} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-mute">
          {engagement.description && <span>{engagement.description}</span>}
          <Badge color={STATUS_COLOR[engagement.status]}>{engagement.status}</Badge>
          {engagement.hourlyRate > 0 && <span>{fmtMAD(engagement.hourlyRate)}/h</span>}
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-surface border border-line rounded-lg py-2"><div className="text-lg font-bold">{engagement.hoursLogged || 0}h</div><div className="text-[10px] text-mute">loggées</div></div>
          <div className="bg-surface border border-line rounded-lg py-2"><div className="text-lg font-bold">{fmtMAD(engagement.paidTotal || 0)}</div><div className="text-[10px] text-mute">payé</div></div>
          <div className="bg-surface border border-line rounded-lg py-2"><div className="text-lg font-bold">{fmtMAD(engagement.invoicedTotal || 0)}</div><div className="text-[10px] text-mute">facturé</div></div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <form onSubmit={submitHours} className="space-y-2 bg-surface border border-line rounded-lg p-3">
            <Field label="Logger des heures"><Input type="number" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="2.5" /></Field>
            <Field label="Note"><Input value={hoursNote} onChange={(e) => setHoursNote(e.target.value)} placeholder="ex. Refonte du dashboard" /></Field>
            <div className="flex justify-end"><Button type="submit"><span className="flex items-center gap-2"><Clock size={14} /> Logger</span></Button></div>
          </form>
          <form onSubmit={submitPayment} className="space-y-2 bg-surface border border-line rounded-lg p-3">
            <Field label="Logger un paiement reçu"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" /></Field>
            <Field label="Note"><Input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="ex. Facture #12" /></Field>
            <div className="flex justify-end"><Button type="submit"><span className="flex items-center gap-2"><DollarSign size={14} /> Logger</span></Button></div>
          </form>
        </div>

        <div>
          <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-2">Historique des heures ({(engagement.timeLogs || []).length})</div>
          {engagement.timeLogs?.length ? (
            <ul className="space-y-1.5 max-h-40 overflow-y-auto">
              {[...engagement.timeLogs].sort((a, b) => (a.date < b.date ? 1 : -1)).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 bg-surface border border-line rounded-lg px-3 py-2 text-sm">
                  <div><span className="font-medium">{t.hours}h</span> <span className="text-xs text-mute">{fmtDateShort(t.date)}{t.note ? ` · ${t.note}` : ''}</span></div>
                  <button className="text-mute hover:text-bad cursor-pointer shrink-0" onClick={() => deleteTimeLog(engagement.id, t.id)}><Trash2 size={13} /></button>
                </li>
              ))}
            </ul>
          ) : <EmptyState>Aucune heure loggée.</EmptyState>}
        </div>
      </div>
    </Modal>
  );
}

export default function Freelance() {
  const { engagements, addEngagement, editEngagement, deleteEngagement, setStatus, logHours, deleteTimeLog, logPayment, getBadges, getMonthStats } = useFreelanceStore();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [form, setForm] = useState(blank());
  const detail = engagements.find((e) => e.id === detailId) || null;

  const active = engagements.filter((e) => e.status === 'Actif');
  const monthStats = getMonthStats();
  const totalPaid = engagements.reduce((a, e) => a + (e.paidTotal || 0), 0);
  const byClient = useMemo(
    () => [...engagements].filter((e) => e.hoursLogged > 0).sort((a, b) => b.hoursLogged - a.hoursLogged).slice(0, 8).map((e) => ({ name: e.clientName, hours: e.hoursLogged })),
    [engagements]
  );

  const submit = (e) => {
    e.preventDefault();
    const res = addEngagement(form);
    if (!res.ok) return alert(res.error);
    setModal(false);
    setForm(blank());
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Freelance</h1>
          <p className="text-mute text-sm mt-1">Clients, missions, heures et paiements — la pratique indépendante.</p>
        </div>
        <Button onClick={() => setModal(true)}><span className="flex items-center gap-2"><Plus size={16} /> Nouveau client</span></Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Clients actifs" value={active.length} sub={`${engagements.length} au total`} />
        <Stat label="Heures ce mois-ci" value={monthStats.hours} />
        <Stat label="Revenu ce mois-ci" value={fmtMAD(monthStats.revenue)} color={monthStats.revenue ? 'var(--success)' : undefined} />
        <Stat label="Revenu total" value={fmtMAD(totalPaid)} />
      </div>

      {byClient.length > 1 && (
        <Card title="Heures par client">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byClient} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="hours" radius={[0, 4, 4, 0]} fill="var(--accent-primary)" />
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
                  <th className="py-2 pr-4">Client</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2 pr-4 text-right">Heures</th>
                  <th className="py-2 pr-4 text-right">Payé</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {[...engagements].sort((a, b) => b.updatedAt - a.updatedAt).map((e) => (
                  <tr key={e.id} className="border-b border-line/50 hover:bg-surface/50">
                    <td className="py-2.5 pr-4"><button className="hover:text-accent cursor-pointer text-left font-medium" onClick={() => setDetailId(e.id)}>{e.clientName}</button></td>
                    <td className="py-2.5 pr-4">
                      <Select value={e.status} onChange={(ev) => setStatus(e.id, ev.target.value)} options={ENGAGEMENT_STATUSES} className="!py-1 !px-2 text-xs w-28" />
                    </td>
                    <td className="py-2.5 pr-4 text-right">{e.hoursLogged || 0}h</td>
                    <td className="py-2.5 pr-4 text-right">{fmtMAD(e.paidTotal || 0)}</td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <button className="text-mute hover:text-accent mr-3 cursor-pointer" onClick={() => setEditing(e)}><Pencil size={14} /></button>
                      <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Supprimer "${e.clientName}" ?`)) deleteEngagement(e.id); }}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState><Briefcase className="mx-auto mb-2 text-mute" size={26} />Aucun client pour l'instant.</EmptyState>
        )}
      </Card>

      <BadgeList badges={getBadges()} />

      <Modal open={modal} onClose={() => setModal(false)} title="Nouveau client">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Client"><Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} autoFocus /></Field>
          <Field label="Description de la mission"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Statut"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={ENGAGEMENT_STATUSES} /></Field>
            <Field label="Taux horaire (DH)"><Input type="number" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} /></Field>
            <Field label="Date de début"><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button type="submit">Créer</Button>
          </div>
        </form>
      </Modal>

      {editing && (
        <EntityFormModal
          open={!!editing}
          onClose={() => setEditing(null)}
          title="Éditer le client"
          fields={engagementFields}
          initial={editing}
          wide
          onSave={(values) => editEngagement(editing.id, values)}
          onDelete={() => deleteEngagement(editing.id)}
        />
      )}

      <EngagementDetailModal engagement={detail} onClose={() => setDetailId(null)} logHours={logHours} deleteTimeLog={deleteTimeLog} logPayment={logPayment} />
    </div>
  );
}
