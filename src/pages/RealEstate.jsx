import { useMemo, useState } from 'react';
import { Building2, Plus, Trash2, Pencil, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { useRealEstateStore } from '../store/realEstateStore';
import { PROPERTY_TYPES, PROPERTY_STATUSES } from '../utils/constants';
import { fmtDateShort, fmtMAD, todayKey } from '../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState } from '../components/common/ui';
import EntityFormModal from '../components/common/EntityFormModal';
import BadgeList from '../components/common/BadgeList';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };
const STATUS_COLOR = { Recherche: 'var(--text-secondary)', 'Sous offre': 'var(--warning)', Acquis: 'var(--accent-primary)', Loué: 'var(--success)', Vendu: '#b366ff' };

const blank = () => ({ name: '', type: 'Appartement', status: 'Recherche', address: '', purchasePrice: '', currentValue: '', monthlyRent: '', monthlyExpenses: '', notes: '' });
const propertyFields = [
  { name: 'name', label: 'Nom du bien', type: 'text' },
  { name: 'type', label: 'Type', type: 'select', options: PROPERTY_TYPES },
  { name: 'status', label: 'Statut', type: 'select', options: PROPERTY_STATUSES },
  { name: 'address', label: 'Adresse', type: 'text' },
  { name: 'purchasePrice', label: "Prix d'achat (DH)", type: 'number' },
  { name: 'currentValue', label: 'Valeur actuelle (DH)', type: 'number' },
  { name: 'monthlyRent', label: 'Loyer mensuel (DH)', type: 'number' },
  { name: 'monthlyExpenses', label: 'Charges mensuelles (DH)', type: 'number' },
  { name: 'purchaseDate', label: "Date d'acquisition", type: 'date' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

export default function RealEstate() {
  const { properties, addProperty, editProperty, deleteProperty, setStatus, logRent, getBadges, getPortfolioStats, getCapRate } = useRealEstateStore();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [rentModal, setRentModal] = useState(null); // property id
  const [rentForm, setRentForm] = useState({ amount: '', note: '' });
  const [form, setForm] = useState(blank());

  const stats = getPortfolioStats();
  const byType = useMemo(
    () => PROPERTY_TYPES.map((t) => ({ name: t, count: properties.filter((p) => p.type === t).length })).filter((t) => t.count > 0),
    [properties]
  );
  const owned = properties.filter((p) => p.status === 'Acquis' || p.status === 'Loué');

  const submit = (e) => {
    e.preventDefault();
    const res = addProperty(form);
    if (!res.ok) return alert(res.error);
    setModal(false);
    setForm(blank());
  };
  const submitRent = (e) => {
    e.preventDefault();
    if (!rentForm.amount) return;
    logRent(rentModal, { date: todayKey(), amount: rentForm.amount, note: rentForm.note });
    setRentModal(null);
    setRentForm({ amount: '', note: '' });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Real Estate</h1>
          <p className="text-mute text-sm mt-1">Portefeuille locatif — biens, loyers, cash-flow.</p>
        </div>
        <Button onClick={() => setModal(true)}><span className="flex items-center gap-2"><Plus size={16} /> Nouveau bien</span></Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Biens possédés" value={stats.count} sub={`${properties.length} au total`} />
        <Stat label="Valeur du portefeuille" value={fmtMAD(stats.totalValue)} />
        <Stat label="Cash-flow mensuel" value={fmtMAD(stats.monthlyCashFlow)} color={stats.monthlyCashFlow >= 0 ? 'var(--success)' : 'var(--error)'} />
        <Stat label="Cap rate moyen" value={stats.avgCapRate != null ? `${stats.avgCapRate}%` : '—'} />
      </div>

      {byType.length > 1 && (
        <Card title="Répartition par type">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byType}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--accent-primary)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card title={`Biens (${properties.length})`}>
        {properties.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mute border-b border-line">
                  <th className="py-2 pr-4">Nom</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2 pr-4 text-right">Loyer/mois</th>
                  <th className="py-2 pr-4 text-right">Cap rate</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {[...properties].sort((a, b) => b.updatedAt - a.updatedAt).map((p) => {
                  const capRate = getCapRate(p);
                  return (
                    <tr key={p.id} className="border-b border-line/50 hover:bg-surface/50">
                      <td className="py-2.5 pr-4 font-medium">{p.name}</td>
                      <td className="py-2.5 pr-4"><Badge>{p.type}</Badge></td>
                      <td className="py-2.5 pr-4">
                        <Select value={p.status} onChange={(e) => setStatus(p.id, e.target.value)} options={PROPERTY_STATUSES} className="!py-1 !px-2 text-xs w-28" />
                      </td>
                      <td className="py-2.5 pr-4 text-right">{p.monthlyRent ? fmtMAD(p.monthlyRent) : '—'}</td>
                      <td className="py-2.5 pr-4 text-right" style={capRate != null ? { color: capRate >= 5 ? 'var(--success)' : capRate >= 2 ? 'var(--warning)' : 'var(--error)' } : undefined}>
                        {capRate != null ? `${capRate}%` : '—'}
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        {(p.status === 'Acquis' || p.status === 'Loué') && (
                          <button className="text-mute hover:text-good mr-3 cursor-pointer" title="Logger un loyer" onClick={() => setRentModal(p.id)}><TrendingUp size={14} /></button>
                        )}
                        <button className="text-mute hover:text-accent mr-3 cursor-pointer" onClick={() => setEditing(p)}><Pencil size={14} /></button>
                        <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Supprimer "${p.name}" ?`)) deleteProperty(p.id); }}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState><Building2 className="mx-auto mb-2 text-mute" size={26} />Aucun bien pour l'instant.</EmptyState>
        )}
      </Card>

      <BadgeList badges={getBadges()} />

      <Modal open={modal} onClose={() => setModal(false)} title="Nouveau bien">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom du bien"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></Field>
            <Field label="Type"><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={PROPERTY_TYPES} /></Field>
          </div>
          <Field label="Adresse"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Statut"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={PROPERTY_STATUSES} /></Field>
            <Field label="Prix d'achat (DH)"><Input type="number" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Loyer mensuel (DH)"><Input type="number" value={form.monthlyRent} onChange={(e) => setForm({ ...form, monthlyRent: e.target.value })} /></Field>
            <Field label="Charges mensuelles (DH)"><Input type="number" value={form.monthlyExpenses} onChange={(e) => setForm({ ...form, monthlyExpenses: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button type="submit">Créer</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!rentModal} onClose={() => setRentModal(null)} title="Logger un loyer reçu">
        <form onSubmit={submitRent} className="space-y-3">
          <Field label="Montant (DH)"><Input type="number" value={rentForm.amount} onChange={(e) => setRentForm({ ...rentForm, amount: e.target.value })} autoFocus /></Field>
          <Field label="Note"><Input value={rentForm.note} onChange={(e) => setRentForm({ ...rentForm, note: e.target.value })} placeholder="ex. Loyer août" /></Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setRentModal(null)}>Annuler</Button>
            <Button type="submit">Logger</Button>
          </div>
        </form>
      </Modal>

      {editing && (
        <EntityFormModal
          open={!!editing}
          onClose={() => setEditing(null)}
          title="Éditer le bien"
          fields={propertyFields}
          initial={editing}
          wide
          onSave={(values) => editProperty(editing.id, values)}
          onDelete={() => deleteProperty(editing.id)}
        />
      )}
    </div>
  );
}
