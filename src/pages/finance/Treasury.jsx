import { useState } from 'react';
import { Plus, Trash2, Pencil, Power } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, ReferenceLine } from 'recharts';
import { useFinanceStore } from '../../store/financeStore';
import { EXPENSE_CATEGORY_GROUPS, INCOME_SOURCES, RECURRING_FREQUENCIES } from '../../utils/constants';
import { fmtMAD } from '../../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Modal, Badge, EmptyState } from '../../components/common/ui';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

const blankRecurring = () => ({ type: 'expense', category: 'Rent / Mortgage', incomeSource: 'Salary', amount: '', frequency: 'monthly', description: '' });

export default function Treasury() {
  const financeStore = useFinanceStore();
  const { recurring, addRecurring, editRecurring, deleteRecurring, toggleRecurring } = financeStore;
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(blankRecurring());

  const liquidAssets = financeStore.getLiquidAssets();
  const runway = financeStore.getRunway();
  const history = financeStore.getCashFlowHistory(6);
  const forecast = financeStore.getCashFlowForecast(6);
  const recurringMonthlyNet = financeStore.getRecurringMonthlyNet();
  const forecastData = forecast.map((f) => ({ label: `M+${f.month}`, balance: f.balance }));

  const submit = (e) => {
    e.preventDefault();
    if (!Number(form.amount)) return;
    addRecurring({
      type: form.type,
      category: form.type === 'expense' ? form.category : form.incomeSource,
      amount: form.amount,
      frequency: form.frequency,
      description: form.description,
    });
    setModal(false);
    setForm(blankRecurring());
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Actifs liquides" value={fmtMAD(liquidAssets)} />
        <Stat
          label="Autonomie (runway)"
          value={runway === null ? '—' : Number.isFinite(runway) ? `${runway.toFixed(1)} mois` : '∞'}
          color={runway !== null && Number.isFinite(runway) && runway < 3 ? 'var(--error)' : runway !== null && Number.isFinite(runway) && runway < 6 ? 'var(--warning)' : undefined}
        />
        <Stat label="Flux récurrent net / mois" value={fmtMAD(recurringMonthlyNet)} color={recurringMonthlyNet >= 0 ? 'var(--success)' : 'var(--error)'} sub={recurring.filter((r) => r.active !== false).length ? undefined : 'Basé sur la moyenne historique (aucune récurrence active)'} />
        <Stat label="Solde projeté à 6 mois" value={forecastData.length ? fmtMAD(forecastData[forecastData.length - 1].balance) : '—'} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Flux de trésorerie — 6 derniers mois">
          {history.some((m) => m.income || m.expenses) ? (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={history}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip {...tooltipStyle} formatter={(v) => fmtMAD(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="net" name="Flux net" fill="#00d97f" radius={[4, 4, 0, 0]}>
                  {history.map((h, i) => (
                    <Cell key={i} fill={h.net >= 0 ? '#00d97f' : '#ff6b6b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState>Pas encore assez de données.</EmptyState>
          )}
        </Card>

        <Card title="Projection de trésorerie — 6 prochains mois">
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={forecastData}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip {...tooltipStyle} formatter={(v) => fmtMAD(v)} />
              <ReferenceLine y={0} stroke="var(--error)" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="balance" name="Solde liquide projeté" stroke="#00d9ff" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-mute mt-2">
            Projection linéaire basée sur les récurrences actives (ou la moyenne des 3 derniers mois si aucune n'est définie).
          </p>
        </Card>
      </div>

      <Card
        title="Budget de trésorerie — récurrences"
        action={
          <Button variant="ghost" onClick={() => setModal(true)}>
            <Plus size={15} />
          </Button>
        }
      >
        {recurring.length ? (
          <div className="space-y-2">
            {recurring.map((r) => (
              <div key={r.id} className="flex items-center gap-3 text-sm border border-line rounded-lg px-3 py-2">
                <Badge color={r.type === 'income' ? 'var(--success)' : 'var(--error)'}>{r.type === 'income' ? 'Revenu' : 'Dépense'}</Badge>
                <span className="flex-1 truncate">{r.category}{r.description ? ` · ${r.description}` : ''}</span>
                <span className="text-mute text-xs capitalize">{r.frequency}</span>
                <span className="font-medium w-24 text-right" style={{ color: r.type === 'income' ? 'var(--success)' : 'var(--error)' }}>
                  {r.type === 'income' ? '+' : '-'}{fmtMAD(r.amount)}
                </span>
                <button className={`cursor-pointer ${r.active === false ? 'text-mute' : 'text-accent'}`} onClick={() => toggleRecurring(r.id)} title={r.active === false ? 'Activate' : 'Deactivate'}>
                  <Power size={13} />
                </button>
                <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm('Delete this recurring item?')) deleteRecurring(r.id); }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>Aucune récurrence. Ajoutez vos revenus/dépenses récurrents pour affiner la projection.</EmptyState>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Add Recurring Item">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={['expense', 'income']} />
            </Field>
            <Field label="Frequency">
              <Select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} options={RECURRING_FREQUENCIES} />
            </Field>
            {form.type === 'expense' ? (
              <Field label="Category">
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {EXPENSE_CATEGORY_GROUPS.map((g) => (
                    <optgroup key={g.group} label={g.group}>
                      {g.items.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="Source">
                <Select value={form.incomeSource} onChange={(e) => setForm({ ...form, incomeSource: e.target.value })} options={INCOME_SOURCES} />
              </Field>
            )}
            <Field label="Amount (DH)">
              <Input type="number" step="any" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} autoFocus />
            </Field>
          </div>
          <Field label="Description">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Loyer appartement" />
          </Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit">Add</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
