import { useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, Download, Search } from 'lucide-react';
import { useFinanceStore } from '../../store/financeStore';
import { EXPENSE_CATEGORY_GROUPS, EXPENSE_CATEGORIES, INCOME_SOURCES, COST_TYPES, DEFAULT_COST_TYPE_BY_CATEGORY } from '../../utils/constants';
import { transactionSchema, validate } from '../../utils/validators';
import { fmtMAD, fmtDateShort, uid } from '../../utils/formatters';
import { Card, Button, Field, Input, Select, Modal, EmptyState } from '../../components/common/ui';
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

const blankTx = () => ({
  date: new Date().toISOString().slice(0, 10),
  amount: '',
  category: 'Groceries',
  description: '',
  type: 'expense',
  incomeSource: 'Demo Trading P&L',
  costType: 'variable',
});

function exportCsv(rows) {
  const header = ['date', 'type', 'category', 'costType', 'description', 'amount'];
  const lines = [header.join(',')];
  for (const t of rows) {
    lines.push(
      header
        .map((k) => {
          const v = t[k] ?? '';
          const s = String(v).replace(/"/g, '""');
          return /[",\n]/.test(s) ? `"${s}"` : s;
        })
        .join(',')
    );
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audax-transactions-${uid()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Transactions() {
  const { transactions, addTransaction, editTransaction, deleteTransaction } = useFinanceStore();
  const [txModal, setTxModal] = useState(false);
  const [txForm, setTxForm] = useState(blankTx());
  const [txError, setTxError] = useState('');
  const [editing, setEditing] = useState(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const catOptions = EXPENSE_CATEGORY_GROUPS.flatMap((g) => g.items).map((c) => ({ value: c, label: c }));
  const editFields = [
    { name: 'date', label: 'Date', type: 'date' },
    { name: 'amount', label: 'Amount', type: 'number', step: 'any', currency: 'DH' },
    { name: 'type', label: 'Type', type: 'select', options: [{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }] },
    { name: 'category', label: 'Category', type: 'select', options: catOptions },
    { name: 'costType', label: 'Cost type', type: 'select', options: COST_TYPES },
    { name: 'description', label: 'Description', type: 'text' },
  ];

  const filtered = useMemo(() => {
    return [...transactions]
      .filter((t) => (typeFilter === 'all' ? true : t.type === typeFilter))
      .filter((t) => (categoryFilter === 'all' ? true : t.category === categoryFilter))
      .filter((t) => (search ? `${t.description} ${t.category}`.toLowerCase().includes(search.toLowerCase()) : true))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, typeFilter, categoryFilter, search]);

  const submitTx = (e) => {
    e.preventDefault();
    const res = validate(transactionSchema, txForm);
    if (!res.ok) return setTxError(res.error);
    addTransaction({
      ...res.data,
      incomeSource: txForm.type === 'income' ? txForm.incomeSource : undefined,
      costType: txForm.type === 'expense' ? txForm.costType : undefined,
    });
    setTxModal(false);
    setTxForm(blankTx());
    setTxError('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mute" />
            <input
              className="bg-surface border border-line rounded-lg pl-8 pr-3 py-2 text-sm w-56 focus:outline-none focus:border-accent"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} options={[{ value: 'all', label: 'Tous types' }, { value: 'income', label: 'Revenus' }, { value: 'expense', label: 'Dépenses' }]} />
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} options={[{ value: 'all', label: 'Toutes catégories' }, ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))]} />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => exportCsv(filtered)} disabled={!filtered.length}>
            <span className="flex items-center gap-2"><Download size={15} /> Export CSV</span>
          </Button>
          <Button onClick={() => setTxModal(true)}>
            <span className="flex items-center gap-2"><Plus size={16} /> Transaction</span>
          </Button>
        </div>
      </div>

      <Card title={`Grand livre (${filtered.length} / ${transactions.length})`}>
        {filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mute border-b border-line">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Catégorie</th>
                  <th className="py-2 pr-4">Nature</th>
                  <th className="py-2 pr-4">Description</th>
                  <th className="py-2 pr-4 text-right">Montant</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((t) => (
                  <tr key={t.id} className="border-b border-line/50 hover:bg-surface/50">
                    <td className="py-2.5 pr-4 whitespace-nowrap">{fmtDateShort(t.date)}</td>
                    <td className="py-2.5 pr-4 capitalize" style={{ color: t.type === 'income' ? 'var(--success)' : undefined }}>{t.type}</td>
                    <td className="py-2.5 pr-4">{t.category}</td>
                    <td className="py-2.5 pr-4 text-xs text-mute capitalize">{t.type === 'expense' ? (t.costType || DEFAULT_COST_TYPE_BY_CATEGORY[t.category] || 'variable') : '—'}</td>
                    <td className="py-2.5 pr-4 text-mute">{t.description}</td>
                    <td className="py-2.5 pr-4 text-right font-medium" style={{ color: t.type === 'income' ? 'var(--success)' : 'var(--error)' }}>
                      {t.type === 'income' ? '+' : '-'}{fmtMAD(t.amount)}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <button className="text-mute hover:text-accent mr-3 cursor-pointer" onClick={() => setEditing(t)} title="Edit">
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
          <EmptyState>Aucune transaction ne correspond à ces filtres.</EmptyState>
        )}
      </Card>

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
              <>
                <Field label="Category">
                  <CategorySelect
                    value={txForm.category}
                    onChange={(e) => setTxForm({ ...txForm, category: e.target.value, costType: DEFAULT_COST_TYPE_BY_CATEGORY[e.target.value] || 'variable' })}
                  />
                </Field>
                <Field label="Cost type" hint="Comptabilité de coûts : fixe / variable / exceptionnel">
                  <Select value={txForm.costType} onChange={(e) => setTxForm({ ...txForm, costType: e.target.value })} options={COST_TYPES} />
                </Field>
              </>
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

      {editing && (
        <EntityFormModal
          open={!!editing}
          onClose={() => setEditing(null)}
          title="Edit transaction"
          fields={editFields}
          initial={editing}
          wide
          onSave={(values) => editTransaction(editing.id, values)}
          onDelete={() => deleteTransaction(editing.id)}
        />
      )}
    </div>
  );
}
