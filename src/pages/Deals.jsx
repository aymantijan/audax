import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Briefcase, Pencil } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { useDealsStore } from '../store/dealsStore';
import { DEAL_TYPES, DEAL_ROLES, DEAL_STATUS, DEAL_STATUS_LABEL, DEAL_STATUS_OPTIONS, DEAL_SKILL, DEAL_STAGES, SKILL_MAP } from '../utils/constants';
import { fmtMoney, fmtDateShort } from '../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Modal, Badge, EmptyState } from '../components/common/ui';
import EntityFormModal from '../components/common/EntityFormModal';
import BadgeList from '../components/common/BadgeList';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };
const STATUS_COLOR = { ongoing: 'var(--accent-primary)', completed: 'var(--success)', passed: 'var(--text-secondary)' };
const STAGE_STATUS_COLOR = { 'not-started': 'var(--text-secondary)', 'in-progress': 'var(--warning)', blocked: 'var(--error)', done: 'var(--success)' };
const blank = () => ({ name: '', type: 'LBO', size: '', role: 'Modeling', status: 'ongoing', firm: '', date: new Date().toISOString().slice(0, 10), notes: '' });

export default function PrivateEquity() {
  const { deals, addDeal, editDeal, deleteDeal, getBadges } = useDealsStore();
  const [editing, setEditing] = useState(null);
  const editFields = [
    { name: 'name', label: 'Nom du deal', type: 'text' },
    { name: 'type', label: 'Type', type: 'select', options: DEAL_TYPES },
    { name: 'role', label: 'Ton rôle', type: 'select', options: DEAL_ROLES },
    { name: 'status', label: 'Statut', type: 'select', options: DEAL_STATUS_OPTIONS },
    { name: 'size', label: 'Taille du deal', type: 'number', step: 'any', currency: '$' },
    { name: 'firm', label: 'Fonds / sponsor', type: 'text' },
    { name: 'date', label: 'Date', type: 'date' },
    { name: 'notes', label: 'Notes', type: 'text' },
  ];
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(blank());
  const [filter, setFilter] = useState('all');

  const completed = deals.filter((d) => d.status === 'completed').length;
  const totalSize = deals.reduce((a, d) => a + d.size, 0);
  const byType = useMemo(
    () => DEAL_TYPES.map((t) => ({ name: t, count: deals.filter((d) => d.type === t).length })).filter((d) => d.count > 0),
    [deals]
  );
  // Pipeline funnel — how many deals currently sit at (or past) each stage.
  // Past-stage deals count toward earlier stages too (a deal in Closing has
  // cleared every prior gate), giving the classic decreasing funnel shape.
  const byStage = useMemo(
    () => DEAL_STAGES.map((label, i) => ({ name: label, count: deals.filter((d) => (d.stageIndex ?? 0) >= i).length })),
    [deals]
  );
  const filtered = useMemo(
    () => [...deals].filter((d) => filter === 'all' || d.status === filter).sort((a, b) => new Date(b.date) - new Date(a.date)),
    [deals, filter]
  );

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    addDeal(form);
    setModal(false);
    setForm(blank());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-mute text-sm">Ajoute un deal, puis ouvre-le pour découper le travail en tâches : chaque tâche terminée fait progresser la compétence visée.</p>
        <Button onClick={() => setModal(true)}>
          <span className="flex items-center gap-2"><Plus size={16} /> Ajouter un deal</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Deals suivis" value={deals.length} sub={`${completed} conclu${completed > 1 ? 's' : ''}`} />
        <Stat label="Taille totale" value={fmtMoney(totalSize)} sub="cumulée" />
        <Stat label="En cours" value={deals.filter((d) => d.status === 'ongoing').length} />
        <Stat label="Types de deals" value={byType.length} sub={`sur ${DEAL_TYPES.length}`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Deals par type">
          {byType.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byType}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {byType.map((d) => <Cell key={d.name} fill="var(--accent-secondary)" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState><Briefcase className="mx-auto mb-2 text-mute" size={26} />Aucun deal pour l’instant. Ajoute le premier pour commencer à progresser.</EmptyState>
          )}
        </Card>

        <Card title="Compétences développées">
          <p className="text-xs text-mute mb-3">Les tâches de chaque type de deal font progresser ces compétences (modifiable tâche par tâche) :</p>
          <div className="space-y-2.5">
            {DEAL_TYPES.map((t) => (
              <div key={t} className="text-sm">
                <Badge color="var(--accent-secondary)">{t}</Badge>
                <span className="text-mute ml-2">{(DEAL_SKILL[t] || []).map((id) => SKILL_MAP[id]?.name).filter(Boolean).join(', ')}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {deals.length > 0 && (
        <Card title="Pipeline par étape">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byStage}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={55} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--accent-primary)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card
        title={`Tous les deals (${filtered.length})`}
        action={
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} options={[{ value: 'all', label: 'Tous les statuts' }, ...DEAL_STATUS_OPTIONS]} />
        }
      >
        {filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mute border-b border-line">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Deal</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Rôle</th>
                  <th className="py-2 pr-4 text-right">Taille</th>
                  <th className="py-2 pr-4">Étape</th>
                  <th className="py-2 pr-4">Tâches</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const tasks = d.tasks || [];
                  const done = tasks.filter((t) => t.status === 'done').length;
                  return (
                    <tr key={d.id} className="border-b border-line/50 hover:bg-surface/50">
                      <td className="py-2.5 pr-4 whitespace-nowrap">{fmtDateShort(d.date)}</td>
                      <td className="py-2.5 pr-4">
                        <Link to={`/deals/${d.id}`} className="hover:text-accent">{d.name}</Link>
                        {d.firm && <span className="text-mute text-xs"> · {d.firm}</span>}
                      </td>
                      <td className="py-2.5 pr-4">{d.type}</td>
                      <td className="py-2.5 pr-4 text-mute">{d.role}</td>
                      <td className="py-2.5 pr-4 text-right">{d.size ? fmtMoney(d.size) : '—'}</td>
                      <td className="py-2.5 pr-4"><Badge color={STAGE_STATUS_COLOR[d.stageStatus] || 'var(--text-secondary)'}>{DEAL_STAGES[d.stageIndex ?? 0]}</Badge></td>
                      <td className="py-2.5 pr-4 text-mute">{tasks.length ? `${done}/${tasks.length}` : '—'}</td>
                      <td className="py-2.5 pr-4"><Badge color={STATUS_COLOR[d.status]}>{DEAL_STATUS_LABEL[d.status] || d.status}</Badge></td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        <button className="text-mute hover:text-accent mr-3 cursor-pointer" onClick={() => setEditing(d)} title="Modifier">
                          <Pencil size={14} />
                        </button>
                        <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm('Supprimer ce deal ? Ses tâches et l’XP gagnée seront annulées.')) deleteDeal(d.id); }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>Aucun deal ne correspond.</EmptyState>
        )}
      </Card>

      <BadgeList badges={getBadges()} />

      <Modal open={modal} onClose={() => setModal(false)} title="Ajouter un deal">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Nom du deal">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex. Projet Atlas — LBO SaaS" autoFocus />
          </Field>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Type">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={DEAL_TYPES} />
            </Field>
            <Field label="Ton rôle">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={DEAL_ROLES} />
            </Field>
            <Field label="Statut">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={DEAL_STATUS_OPTIONS} />
            </Field>
            <Field label="Taille du deal ($)">
              <Input type="number" step="any" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} />
            </Field>
            <Field label="Fonds / sponsor">
              <Input value={form.firm} onChange={(e) => setForm({ ...form, firm: e.target.value })} />
            </Field>
            <Field label="Date">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
          </div>
          <Field label="Notes">
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Thèse, ta contribution, résultat…" />
          </Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button type="submit">Ajouter</Button>
          </div>
        </form>
      </Modal>

      {editing && (
        <EntityFormModal
          open={!!editing}
          onClose={() => setEditing(null)}
          title="Modifier le deal"
          fields={editFields}
          initial={editing}
          wide
          onSave={(values) => editDeal(editing.id, values)}
          onDelete={() => deleteDeal(editing.id)}
        />
      )}
    </div>
  );
}
