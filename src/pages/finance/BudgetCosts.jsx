import { useState } from 'react';
import { Plus, Trash2, Pencil, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useFinanceStore } from '../../store/financeStore';
import { EXPENSE_CATEGORY_GROUPS } from '../../utils/constants';
import { fmtMAD, fmtPct } from '../../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Modal, ProgressBar, EmptyState } from '../../components/common/ui';
import EntityFormModal from '../../components/common/EntityFormModal';

function CategorySelect({ value, onChange }) {
  return (
    <Select value={value} onChange={onChange}>
      {EXPENSE_CATEGORY_GROUPS.map((g) => (
        <optgroup key={g.group} label={g.group}>
          {g.items.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}

const COST_COLORS = { fixed: '#7aa2ff', variable: '#00d9ff', exceptional: '#ffa500' };
const COST_LABELS = { fixed: 'Fixes', variable: 'Variables', exceptional: 'Exceptionnelles' };

export default function BudgetCosts() {
  const financeStore = useFinanceStore();
  const { budgets, addBudget, editBudget, deleteBudget } = financeStore;
  const [budgetModal, setBudgetModal] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ category: 'Groceries', amount: '', alertThreshold: 90, type: 'fixed' });
  const [editing, setEditing] = useState(null);

  const catOptions = EXPENSE_CATEGORY_GROUPS.flatMap((g) => g.items).map((c) => ({ value: c, label: c }));
  const editFields = [
    { name: 'category', label: 'Category', type: 'select', options: catOptions },
    { name: 'type', label: 'Type', type: 'select', options: [{ value: 'fixed', label: 'Fixed $' }, { value: 'percent', label: '% of income' }] },
    { name: 'amount', label: 'Amount', type: 'number', step: 'any', hint: 'DH/mo for fixed, % of income for percent' },
    { name: 'alertThreshold', label: 'Alert threshold (%)', type: 'number', min: 50, max: 100 },
  ];

  const budgetRows = financeStore.getBudgetStatuses().map((b) => ({
    ...b,
    color: b.pct < 50 ? 'var(--success)' : b.pct <= 90 ? 'var(--warning)' : 'var(--error)',
  }));
  const overallAdherence = financeStore.getBudgetAdherence();
  const costs = financeStore.getMonthCostBreakdown();
  const ratios = financeStore.getRatios();
  const costPie = Object.entries(costs)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: COST_LABELS[k], key: k, value: v }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Adhérence budgétaire" value={overallAdherence !== null ? fmtPct(overallAdherence) : '—'} />
        <Stat label="Charges fixes / revenu" value={ratios.fixedCostRatio !== null ? fmtPct(ratios.fixedCostRatio) : '—'} color={ratios.fixedCostRatio > 50 ? 'var(--error)' : undefined} />
        <Stat label="Charges variables / revenu" value={ratios.variableCostRatio !== null ? fmtPct(ratios.variableCostRatio) : '—'} />
        <Stat label="Charges exceptionnelles" value={fmtMAD(costs.exceptional)} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card title="Coûts fixes / variables / exceptionnels (MTD)" className="lg:col-span-1">
          {costPie.length ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={costPie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3}>
                    {costPie.map((c) => (
                      <Cell key={c.key} fill={COST_COLORS[c.key]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtMAD(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 mt-2 justify-center">
                {costPie.map((c) => (
                  <span key={c.key} className="text-[11px] text-mute flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: COST_COLORS[c.key] }} /> {c.name}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <EmptyState>No expenses this month.</EmptyState>
          )}
        </Card>

        <Card
          title="Budgets par catégorie"
          className="lg:col-span-2"
          action={
            <Button variant="ghost" onClick={() => setBudgetModal(true)}>
              <Plus size={15} />
            </Button>
          }
        >
          {budgetRows.length ? (
            <div className="space-y-4">
              {budgetRows.map((b) => (
                <div key={b.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{b.category}{b.type === 'percent' ? <span className="text-mute text-xs"> ({b.amount}% of income)</span> : ''}</span>
                    <span className="text-mute">
                      {fmtMAD(b.spent)} / {fmtMAD(b.effAmount)}
                      <button className="ml-2 text-mute hover:text-accent cursor-pointer" onClick={() => setEditing(b)} title="Edit">
                        <Pencil size={12} className="inline" />
                      </button>
                      <button className="ml-1 text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Delete "${b.category}" budget?`)) deleteBudget(b.id); }}>
                        <Trash2 size={12} className="inline" />
                      </button>
                    </span>
                  </div>
                  <ProgressBar value={Math.min(100, b.pct)} color={b.color} />
                  {b.pct >= b.alertThreshold && (
                    <div className="text-[11px] text-bad mt-1 flex items-center gap-1"><AlertTriangle size={11} /> Over {b.alertThreshold}% of budget!</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>No budgets set. Add one per category.</EmptyState>
          )}
        </Card>
      </div>

      <Modal open={budgetModal} onClose={() => setBudgetModal(false)} title="Add Budget">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!Number(budgetForm.amount)) return;
            addBudget({ ...budgetForm, period: 'monthly' });
            setBudgetModal(false);
            setBudgetForm({ category: 'Groceries', amount: '', alertThreshold: 90, type: 'fixed' });
          }}
        >
          <div className="grid grid-cols-3 gap-3">
            <Field label="Category">
              <CategorySelect value={budgetForm.category} onChange={(e) => setBudgetForm({ ...budgetForm, category: e.target.value })} />
            </Field>
            <Field label="Type">
              <Select
                value={budgetForm.type}
                onChange={(e) => setBudgetForm({ ...budgetForm, type: e.target.value })}
                options={[{ value: 'fixed', label: 'Fixed $' }, { value: 'percent', label: '% of income' }]}
              />
            </Field>
            <Field label={budgetForm.type === 'percent' ? '% of monthly income' : 'Monthly amount (DH)'}>
              <Input type="number" step="any" value={budgetForm.amount} onChange={(e) => setBudgetForm({ ...budgetForm, amount: e.target.value })} autoFocus />
            </Field>
          </div>
          <Field label={`Alert threshold: ${budgetForm.alertThreshold}%`}>
            <input type="range" min="50" max="100" value={budgetForm.alertThreshold} onChange={(e) => setBudgetForm({ ...budgetForm, alertThreshold: Number(e.target.value) })} className="w-full" />
          </Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setBudgetModal(false)}>Cancel</Button>
            <Button type="submit">Add budget</Button>
          </div>
        </form>
      </Modal>

      {editing && (
        <EntityFormModal
          open={!!editing}
          onClose={() => setEditing(null)}
          title="Edit budget"
          fields={editFields}
          initial={editing}
          onSave={(values) => editBudget(editing.id, values)}
          onDelete={() => deleteBudget(editing.id)}
        />
      )}
    </div>
  );
}
