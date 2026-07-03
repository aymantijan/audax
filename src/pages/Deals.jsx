import { useMemo, useState } from 'react';
import { Plus, Trash2, Briefcase, Pencil } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { useDealsStore } from '../store/dealsStore';
import { DEAL_TYPES, DEAL_ROLES, DEAL_STATUS, DEAL_SKILL, SKILL_MAP } from '../utils/constants';
import { fmtMoney, fmtDateShort } from '../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Modal, Badge, EmptyState } from '../components/common/ui';
import EntityFormModal from '../components/common/EntityFormModal';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };
const STATUS_COLOR = { ongoing: 'var(--accent-primary)', completed: 'var(--success)', passed: 'var(--text-secondary)' };
const blank = () => ({ name: '', type: 'LBO', size: '', role: 'Modeling', status: 'ongoing', firm: '', date: new Date().toISOString().slice(0, 10), notes: '' });

export default function Deals() {
  const { deals, addDeal, editDeal, deleteDeal } = useDealsStore();
  const [editing, setEditing] = useState(null);
  const editFields = [
    { name: 'name', label: 'Deal name', type: 'text' },
    { name: 'type', label: 'Type', type: 'select', options: DEAL_TYPES },
    { name: 'role', label: 'Your role', type: 'select', options: DEAL_ROLES },
    { name: 'status', label: 'Status', type: 'select', options: DEAL_STATUS },
    { name: 'size', label: 'Deal size', type: 'number', step: 'any', currency: '$' },
    { name: 'firm', label: 'Firm / sponsor', type: 'text' },
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
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">PE / Deals</h1>
          <p className="text-mute text-sm mt-1">Log deals you work on — each awards XP to the relevant PE/VC/RBF skills.</p>
        </div>
        <Button onClick={() => setModal(true)}>
          <span className="flex items-center gap-2"><Plus size={16} /> Log Deal</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Deals logged" value={deals.length} sub={`${completed} completed`} />
        <Stat label="Total deal size" value={fmtMoney(totalSize)} sub="cumulative" />
        <Stat label="Ongoing" value={deals.filter((d) => d.status === 'ongoing').length} />
        <Stat label="Deal types" value={byType.length} sub={`of ${DEAL_TYPES.length}`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Deals by Type">
          {byType.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byType}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {byType.map((d) => <Cell key={d.name} fill="#b366ff" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState><Briefcase className="mx-auto mb-2 text-mute" size={26} />No deals yet. Log your first to start earning PE XP.</EmptyState>
          )}
        </Card>

        <Card title="Skills a Deal Builds">
          <p className="text-xs text-mute mb-3">Logging a deal auto-awards XP to these skills (by type):</p>
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

      <Card
        title={`Deal Log (${filtered.length})`}
        action={
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} options={[{ value: 'all', label: 'All statuses' }, ...DEAL_STATUS.map((s) => ({ value: s, label: s }))]} />
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
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4 text-right">Size</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className="border-b border-line/50 hover:bg-surface/50">
                    <td className="py-2.5 pr-4 whitespace-nowrap">{fmtDateShort(d.date)}</td>
                    <td className="py-2.5 pr-4">
                      {d.name}
                      {d.firm && <span className="text-mute text-xs"> · {d.firm}</span>}
                    </td>
                    <td className="py-2.5 pr-4">{d.type}</td>
                    <td className="py-2.5 pr-4 text-mute">{d.role}</td>
                    <td className="py-2.5 pr-4 text-right">{d.size ? fmtMoney(d.size) : '—'}</td>
                    <td className="py-2.5 pr-4"><Badge color={STATUS_COLOR[d.status]}>{d.status}</Badge></td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <button className="text-mute hover:text-accent mr-3 cursor-pointer" onClick={() => setEditing(d)} title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm('Delete this deal? Its XP will be reversed.')) deleteDeal(d.id); }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>No deals match.</EmptyState>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Log Deal">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Deal name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Project Atlas — SaaS LBO" autoFocus />
          </Field>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Type">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={DEAL_TYPES} />
            </Field>
            <Field label="Your role">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={DEAL_ROLES} />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={DEAL_STATUS} />
            </Field>
            <Field label="Deal size ($)">
              <Input type="number" step="any" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} />
            </Field>
            <Field label="Firm / sponsor">
              <Input value={form.firm} onChange={(e) => setForm({ ...form, firm: e.target.value })} />
            </Field>
            <Field label="Date">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
          </div>
          <Field label="Notes">
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Thesis, your contribution, outcome…" />
          </Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit">Log deal</Button>
          </div>
        </form>
      </Modal>

      {editing && (
        <EntityFormModal
          open={!!editing}
          onClose={() => setEditing(null)}
          title="Edit deal"
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
