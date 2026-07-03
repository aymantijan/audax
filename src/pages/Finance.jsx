import { useEffect, useMemo, useState } from 'react';
// startOfMonth/differenceInDays and currentAccountValue no longer needed —
// the store's selectors own that logic now (single source of truth).
import { Plus, Trash2, Target, AlertTriangle, Pencil, Trophy } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useFinanceStore } from '../store/financeStore';
import { useTradingStore } from '../store/tradingStore';
import { EXPENSE_CATEGORY_GROUPS, INCOME_SOURCES, ASSET_TYPES, LIABILITY_TYPES, GOAL_TYPES } from '../utils/constants';
import { budgetSeverity } from '../utils/goals';
import { transactionSchema, validate } from '../utils/validators';
import { fmtMAD, fmtPct, fmtDateShort, fmtDate, usdToMad } from '../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Modal, ProgressBar, Badge, EmptyState } from '../components/common/ui';
import EntityFormModal from '../components/common/EntityFormModal';

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

const PIE_COLORS = ['#00d9ff', '#b366ff', '#00d97f', '#ffa500', '#ff6b6b', '#7aa2ff'];
const tooltipStyle = {
  contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 },
};

const blankTx = () => ({
  date: new Date().toISOString().slice(0, 10),
  amount: '',
  category: 'Groceries',
  description: '',
  type: 'expense',
  incomeSource: 'Demo Trading P&L',
});

export default function Finance() {
  // Subscribe to full store → any change re-renders Finance (and via same store, Dashboard).
  const financeStore = useFinanceStore();
  const tradingStore = useTradingStore();
  const {
    transactions, budgets, snapshots, goals, adjustments,
    addTransaction, editTransaction, deleteTransaction,
    addBudget, editBudget, deleteBudget,
    addSnapshot,
    addGoal, editGoal, deleteGoal,
    addAdjustment, editAdjustment, deleteAdjustment,
    checkGoalAchievement,
  } = financeStore;
  const [txModal, setTxModal] = useState(false);
  const [txForm, setTxForm] = useState(blankTx());
  const [txError, setTxError] = useState('');
  const [budgetModal, setBudgetModal] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ category: 'Groceries', amount: '', alertThreshold: 90, type: 'fixed' });
  const [snapModal, setSnapModal] = useState(false);
  const [snapForm, setSnapForm] = useState({});
  const [goalModal, setGoalModal] = useState(false);
  const [goalForm, setGoalForm] = useState({ name: '', type: 'netWorth', targetAmount: '', targetDate: '' });
  const [adjModal, setAdjModal] = useState(false);
  const [adjForm, setAdjForm] = useState({ type: 'Valuation', amount: '', reason: '' });

  // Edit modal state — one at a time.
  const [editing, setEditing] = useState(null); // { kind, data }
  const catOptions = EXPENSE_CATEGORY_GROUPS.flatMap((g) => g.items).map((c) => ({ value: c, label: c }));
  const editFields = {
    transaction: [
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'amount', label: 'Amount', type: 'number', step: 'any', currency: 'DH' },
      { name: 'type', label: 'Type', type: 'select', options: [{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }] },
      { name: 'category', label: 'Category', type: 'select', options: catOptions },
      { name: 'description', label: 'Description', type: 'text' },
    ],
    budget: [
      { name: 'category', label: 'Category', type: 'select', options: catOptions },
      { name: 'type', label: 'Type', type: 'select', options: [{ value: 'fixed', label: 'Fixed $' }, { value: 'percent', label: '% of income' }] },
      { name: 'amount', label: 'Amount', type: 'number', step: 'any', hint: 'DH/mo for fixed, % of income for percent' },
      { name: 'alertThreshold', label: 'Alert threshold (%)', type: 'number', min: 50, max: 100 },
    ],
    goal: [
      { name: 'name', label: 'Goal name', type: 'text' },
      { name: 'type', label: 'Tracks', type: 'select', options: GOAL_TYPES },
      { name: 'targetAmount', label: 'Target amount', type: 'number', step: 'any', currency: 'DH' },
      { name: 'targetDate', label: 'Target date', type: 'date' },
    ],
    adjustment: [
      { name: 'type', label: 'Type', type: 'select', options: ['Valuation', 'Currency', 'Hidden Asset', 'Off-Book Liability', 'Other'] },
      { name: 'amount', label: 'Amount', type: 'number', step: 'any', currency: 'DH', hint: 'Use +/- sign for direction' },
      { name: 'reason', label: 'Reason', type: 'text' },
    ],
  };
  const editHandlers = {
    transaction: { save: editTransaction, delete: deleteTransaction, title: 'Edit transaction' },
    budget: { save: editBudget, delete: deleteBudget, title: 'Edit budget' },
    goal: { save: editGoal, delete: deleteGoal, title: 'Edit goal' },
    adjustment: { save: editAdjustment, delete: deleteAdjustment, title: 'Edit adjustment' },
  };

  const monthTx = financeStore.getMonthTransactions();
  const income = financeStore.getMonthIncome();
  const expenses = financeStore.getMonthExpenses();
  const savingsRate = financeStore.getSavingsRate();
  const baseNetWorth = financeStore.getBaseNetWorth();
  const adjustmentsTotal = financeStore.getAdjustmentsTotal();
  const netWorth = financeStore.getNetWorth();

  const byCategory = useMemo(() => {
    const map = {};
    for (const t of monthTx.filter((t) => t.type === 'expense')) map[t.category] = (map[t.category] || 0) + t.amount;
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [monthTx]);

  const budgetRows = financeStore.getBudgetStatuses().map((b) => ({
    ...b,
    color: b.pct < 50 ? 'var(--success)' : b.pct <= 90 ? 'var(--warning)' : 'var(--error)',
  }));
  const overallAdherence = financeStore.getBudgetAdherence();

  // Momentum + goal rows come from selectors (same math the Dashboard sees).
  const { change: momChange } = financeStore.getSnapshotMomentum();
  const goalRows = financeStore.getGoalRows({ tradingAccountValueMad: usdToMad(tradingStore.accountValue()) });

  // Fire achievement rewards once when a goal crosses its target
  useEffect(() => {
    for (const g of goalRows) if (g.current !== null && g.current >= g.targetAmount) checkGoalAchievement(g.id, g.current);
  }, [goalRows, checkGoalAchievement]);

  // Budget overage warnings (10% orange, 25% red)
  const budgetWarnings = budgetRows
    .map((b) => ({ ...b, sev: budgetSeverity(b.spent, b.effAmount) }))
    .filter((b) => b.sev);

  const submitTx = (e) => {
    e.preventDefault();
    const res = validate(transactionSchema, txForm);
    if (!res.ok) return setTxError(res.error);
    addTransaction({ ...res.data, incomeSource: txForm.type === 'income' ? txForm.incomeSource : undefined });
    setTxModal(false);
    setTxForm(blankTx());
    setTxError('');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Finance</h1>
          <p className="text-mute text-sm mt-1">Budgets, spending, and net worth — in dirhams (DH). Trading stays in USD.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setGoalModal(true)}>
            <span className="flex items-center gap-2"><Target size={15} /> Goal</span>
          </Button>
          <Button variant="secondary" onClick={() => setAdjModal(true)}>
            <span className="flex items-center gap-2"><Pencil size={14} /> Adjustments</span>
          </Button>
          <Button variant="secondary" onClick={() => setSnapModal(true)}>Net worth snapshot</Button>
          <Button onClick={() => setTxModal(true)}>
            <span className="flex items-center gap-2"><Plus size={16} /> Transaction</span>
          </Button>
        </div>
      </div>

      {budgetWarnings.length > 0 && (
        <div className="space-y-2">
          {budgetWarnings.map((b) => (
            <div key={b.id} className={`border rounded-xl p-3 flex items-start gap-3 ${b.sev.level === 'red' ? 'border-bad/60 bg-bad/10' : 'border-warn/60 bg-warn/10'}`}>
              <AlertTriangle size={18} className={b.sev.level === 'red' ? 'text-bad shrink-0 mt-0.5' : 'text-warn shrink-0 mt-0.5'} />
              <div className="text-sm">
                <span className="font-semibold" style={{ color: b.sev.level === 'red' ? 'var(--error)' : 'var(--warning)' }}>{b.category}</span>
                <span className="text-mute"> · budget </span>{fmtMAD(b.effAmount)}
                <span className="text-mute"> · spent </span><span className="font-semibold">{fmtMAD(b.spent)}</span>
                <span className="text-mute"> · </span><span className={b.sev.level === 'red' ? 'text-bad' : 'text-warn'}>+{b.sev.over.toFixed(1)}% over</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat
          label="Net worth"
          value={netWorth !== null ? fmtMAD(netWorth) : '—'}
          sub={adjustmentsTotal !== 0 ? `${fmtMAD(baseNetWorth)} base · ${adjustmentsTotal >= 0 ? '+' : ''}${fmtMAD(adjustmentsTotal)} adj.` : (momChange !== null ? `${momChange >= 0 ? '+' : ''}${fmtMAD(momChange)} vs prev` : 'dirhams')}
          color={momChange !== null ? (momChange >= 0 ? 'var(--success)' : 'var(--error)') : undefined}
        />
        <Stat label="Income (MTD)" value={fmtMAD(income)} color="var(--success)" />
        <Stat label="Spending (MTD)" value={fmtMAD(expenses)} color={expenses > income && income > 0 ? 'var(--error)' : undefined} />
        <Stat label="Savings rate" value={income > 0 ? fmtPct(savingsRate) : '—'} color={savingsRate >= 20 ? 'var(--success)' : savingsRate < 0 ? 'var(--error)' : undefined} />
        <Stat label="Budget adherence" value={overallAdherence !== null ? fmtPct(overallAdherence) : '—'} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card title="Spending by Category (MTD)">
          {byCategory.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {byCategory.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} formatter={(v) => fmtMAD(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState>No expenses this month.</EmptyState>
          )}
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {byCategory.map((c, i) => (
              <span key={c.name} className="text-[11px] text-mute flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} /> {c.name}
              </span>
            ))}
          </div>
        </Card>

        <Card
          title="Budgets"
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
                      <button className="ml-2 text-mute hover:text-accent cursor-pointer" onClick={() => setEditing({ kind: 'budget', data: b })} title="Edit">
                        <Pencil size={12} className="inline" />
                      </button>
                      <button className="ml-1 text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Delete "${b.category}" budget?`)) deleteBudget(b.id); }}>
                        <Trash2 size={12} className="inline" />
                      </button>
                    </span>
                  </div>
                  <ProgressBar value={Math.min(100, b.pct)} color={b.color} />
                  {b.pct >= b.alertThreshold && (
                    <div className="text-[11px] text-bad mt-1">Over {b.alertThreshold}% of budget!</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>No budgets set. Add one per category.</EmptyState>
          )}
        </Card>

        <Card title="Net Worth Trend">
          {snapshots.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={snapshots.map((s) => ({ date: fmtDateShort(s.date), netWorth: s.netWorth }))}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip {...tooltipStyle} formatter={(v) => fmtMAD(v)} />
                <Line type="monotone" dataKey="netWorth" stroke="#b366ff" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState>Take at least two snapshots to see the trend.</EmptyState>
          )}
        </Card>
      </div>

      {goalRows.length > 0 && (
        <Card title="Financial Goals">
          <div className="grid md:grid-cols-2 gap-4">
            {goalRows.map((g) => (
              <div key={g.id} className="bg-surface border border-line rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-sm font-medium">{g.name}</div>
                    <div className="text-xs text-mute">
                      {fmtMAD(g.targetAmount)}{g.targetDate ? ` by ${fmtDate(g.targetDate)}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {g.achieved && (
                      <Badge color="var(--success)"><span className="flex items-center gap-1"><Trophy size={11} /> {g.badge}</span></Badge>
                    )}
                    {!g.achieved && g.onTrack !== null && (
                      <Badge color={g.onTrack ? 'var(--success)' : 'var(--error)'}>{g.onTrack ? 'on track' : 'off pace'}</Badge>
                    )}
                    <button className="text-mute hover:text-accent cursor-pointer" onClick={() => setEditing({ kind: 'goal', data: g })} title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Delete goal "${g.name}"?`)) deleteGoal(g.id); }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {g.progress !== null ? (
                  <>
                    <ProgressBar value={g.progress} color={g.progress >= 100 ? 'var(--success)' : 'var(--accent-primary)'} />
                    <div className="text-[11px] text-mute mt-1.5">
                      {fmtMAD(g.current)} of {fmtMAD(g.targetAmount)} ({Math.round(g.progress)}%)
                      {g.achieved && g.xpAwarded ? ` · achieved ${fmtDate(g.achievedAt)} · +${g.xpAwarded} XP` : (g.projected !== null && ` · pace projects ${fmtMAD(g.projected)} by target date`)}
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-mute">Take a net worth snapshot to start tracking progress.</div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title={`Transactions (${monthTx.length} this month)`}>
        {transactions.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mute border-b border-line">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Description</th>
                  <th className="py-2 pr-4 text-right">Amount</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {[...transactions]
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .slice(0, 50)
                  .map((t) => (
                    <tr key={t.id} className="border-b border-line/50 hover:bg-surface/50">
                      <td className="py-2.5 pr-4 whitespace-nowrap">{fmtDateShort(t.date)}</td>
                      <td className="py-2.5 pr-4 capitalize" style={{ color: t.type === 'income' ? 'var(--success)' : undefined }}>{t.type}</td>
                      <td className="py-2.5 pr-4">{t.category}</td>
                      <td className="py-2.5 pr-4 text-mute">{t.description}</td>
                      <td className="py-2.5 pr-4 text-right font-medium" style={{ color: t.type === 'income' ? 'var(--success)' : 'var(--error)' }}>
                        {t.type === 'income' ? '+' : '-'}{fmtMAD(t.amount)}
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        <button className="text-mute hover:text-accent mr-3 cursor-pointer" onClick={() => setEditing({ kind: 'transaction', data: t })} title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm('Delete this transaction?')) deleteTransaction(t.id); }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>No transactions yet.</EmptyState>
        )}
      </Card>

      {/* Transaction modal */}
      <Modal open={txModal} onClose={() => setTxModal(false)} title="Add Transaction">
        <form onSubmit={submitTx} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={txForm.type} onChange={(e) => setTxForm({ ...txForm, type: e.target.value })} options={['expense', 'income']} />
            </Field>
            <Field label="Date">
              <Input type="date" value={txForm.date} onChange={(e) => setTxForm({ ...txForm, date: e.target.value })} />
            </Field>
            <Field label="Amount (DH)">
              <Input type="number" step="any" value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} autoFocus />
            </Field>
            {txForm.type === 'expense' ? (
              <Field label="Category">
                <CategorySelect value={txForm.category} onChange={(e) => setTxForm({ ...txForm, category: e.target.value })} />
              </Field>
            ) : (
              <Field label="Source">
                <Select value={txForm.incomeSource} onChange={(e) => setTxForm({ ...txForm, incomeSource: e.target.value, category: 'Income' })} options={INCOME_SOURCES} />
              </Field>
            )}
          </div>
          <Field label="Description">
            <Input value={txForm.description} onChange={(e) => setTxForm({ ...txForm, description: e.target.value })} />
          </Field>
          {txError && <p className="text-bad text-sm">{txError}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setTxModal(false)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>

      {/* Budget modal */}
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

      {/* Goal modal */}
      <Modal open={goalModal} onClose={() => setGoalModal(false)} title="Add Financial Goal">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!goalForm.name.trim() || !Number(goalForm.targetAmount)) return;
            addGoal(goalForm);
            setGoalModal(false);
            setGoalForm({ name: '', type: 'netWorth', targetAmount: '', targetDate: '' });
          }}
        >
          <Field label="Goal name">
            <Input value={goalForm.name} onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })} placeholder='e.g. "Reach $100k net worth"' autoFocus />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Tracks">
              <Select value={goalForm.type} onChange={(e) => setGoalForm({ ...goalForm, type: e.target.value })} options={GOAL_TYPES} />
            </Field>
            <Field label="Target amount (DH)">
              <Input type="number" step="any" value={goalForm.targetAmount} onChange={(e) => setGoalForm({ ...goalForm, targetAmount: e.target.value })} />
            </Field>
            <Field label="Target date">
              <Input type="date" value={goalForm.targetDate} onChange={(e) => setGoalForm({ ...goalForm, targetDate: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setGoalModal(false)}>Cancel</Button>
            <Button type="submit">Set goal</Button>
          </div>
        </form>
      </Modal>

      {/* Net worth adjustments modal */}
      <Modal open={adjModal} onClose={() => setAdjModal(false)} title="Net Worth Adjustments">
        <div className="space-y-4">
          <div className="text-sm text-mute">
            Real wealth often lives off the balance sheet — private stakes, art, hardware-wallet crypto. Add adjustments here; they're summed into your total net worth.
          </div>
          <div className="text-sm">
            Base: <span className="text-ink font-medium">{fmtMAD(baseNetWorth || 0)}</span>{' '}
            · Adjustments: <span className="font-medium" style={{ color: adjustmentsTotal >= 0 ? 'var(--success)' : 'var(--error)' }}>{adjustmentsTotal >= 0 ? '+' : ''}{fmtMAD(adjustmentsTotal)}</span>
            {' '}· Total: <span className="text-ink font-semibold">{netWorth !== null ? fmtMAD(netWorth) : '—'}</span>
          </div>
          {adjustments.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {adjustments.map((a) => (
                <div key={a.id} className="flex items-center gap-3 text-sm border border-line rounded-lg px-3 py-2">
                  <Badge color="var(--accent-secondary)">{a.type}</Badge>
                  <span className="flex-1 text-mute truncate">{a.reason}</span>
                  <span className="font-medium" style={{ color: a.amount >= 0 ? 'var(--success)' : 'var(--error)' }}>{a.amount >= 0 ? '+' : ''}{fmtMAD(a.amount)}</span>
                  <button className="text-mute hover:text-accent cursor-pointer" onClick={() => { setAdjModal(false); setEditing({ kind: 'adjustment', data: a }); }} title="Edit">
                    <Pencil size={13} />
                  </button>
                  <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm('Delete this adjustment?')) deleteAdjustment(a.id); }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <form
            className="grid grid-cols-3 gap-3 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (!Number(adjForm.amount)) return;
              addAdjustment(adjForm);
              setAdjForm({ type: 'Valuation', amount: '', reason: '' });
            }}
          >
            <Field label="Type">
              <Select value={adjForm.type} onChange={(e) => setAdjForm({ ...adjForm, type: e.target.value })} options={['Valuation', 'Currency', 'Hidden Asset', 'Off-Book Liability', 'Other']} />
            </Field>
            <Field label="Amount (DH)">
              <Input type="number" step="any" value={adjForm.amount} onChange={(e) => setAdjForm({ ...adjForm, amount: e.target.value })} placeholder="+/-" />
            </Field>
            <Field label="Reason">
              <Input value={adjForm.reason} onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })} placeholder="e.g. private stake" />
            </Field>
            <Button type="submit" variant="secondary" className="col-span-3">Add adjustment</Button>
          </form>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setAdjModal(false)}>Done</Button>
          </div>
        </div>
      </Modal>

      {/* Net worth snapshot modal */}
      <Modal open={snapModal} onClose={() => setSnapModal(false)} title="Net Worth Snapshot">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const assets = Object.fromEntries(ASSET_TYPES.map((a) => [a.key, snapForm[a.key] || 0]));
            const liabilities = Object.fromEntries(LIABILITY_TYPES.map((l) => [l.key, snapForm[l.key] || 0]));
            addSnapshot(assets, liabilities);
            setSnapModal(false);
            setSnapForm({});
          }}
        >
          <div className="text-xs font-semibold text-mute uppercase tracking-wide">Assets</div>
          <div className="grid grid-cols-2 gap-3">
            {ASSET_TYPES.map((a) => (
              <Field key={a.key} label={a.label}>
                <Input type="number" step="any" value={snapForm[a.key] || ''} onChange={(e) => setSnapForm({ ...snapForm, [a.key]: e.target.value })} placeholder="0" />
              </Field>
            ))}
          </div>
          <div className="text-xs font-semibold text-mute uppercase tracking-wide pt-2">Liabilities</div>
          <div className="grid grid-cols-2 gap-3">
            {LIABILITY_TYPES.map((l) => (
              <Field key={l.key} label={l.label}>
                <Input type="number" step="any" value={snapForm[l.key] || ''} onChange={(e) => setSnapForm({ ...snapForm, [l.key]: e.target.value })} placeholder="0" />
              </Field>
            ))}
          </div>
          <div className="text-sm text-mute">
            Net worth:{' '}
            <span className="text-ink font-semibold">
              {fmtMAD(
                ASSET_TYPES.reduce((a, t) => a + (Number(snapForm[t.key]) || 0), 0) -
                  LIABILITY_TYPES.reduce((a, t) => a + (Number(snapForm[t.key]) || 0), 0)
              )}
            </span>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setSnapModal(false)}>Cancel</Button>
            <Button type="submit">Save snapshot</Button>
          </div>
        </form>
      </Modal>

      {/* Generic edit modal (transaction / budget / goal / adjustment) */}
      {editing && (
        <EntityFormModal
          open={!!editing}
          onClose={() => setEditing(null)}
          title={editHandlers[editing.kind].title}
          fields={editFields[editing.kind]}
          initial={editing.data}
          wide={editing.kind === 'transaction'}
          onSave={(values) => editHandlers[editing.kind].save(editing.data.id, values)}
          onDelete={() => editHandlers[editing.kind].delete(editing.data.id)}
        />
      )}
    </div>
  );
}
