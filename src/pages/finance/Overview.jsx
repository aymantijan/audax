import { useMemo } from 'react';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { useFinanceStore } from '../../store/financeStore';
import { fmtMAD, fmtPct } from '../../utils/formatters';
import { Card, Stat, EmptyState } from '../../components/common/ui';

const PIE_COLORS = ['#00d9ff', '#b366ff', '#00d97f', '#ffa500', '#ff6b6b', '#7aa2ff'];
const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

export default function Overview() {
  const financeStore = useFinanceStore();
  const income = financeStore.getMonthIncome();
  const expenses = financeStore.getMonthExpenses();
  const savingsRate = financeStore.getSavingsRate();
  const netWorth = financeStore.getNetWorth();
  const runway = financeStore.getRunway();
  const alerts = financeStore.getAlerts();
  const monthTx = financeStore.getMonthTransactions();
  const cashFlowHistory = financeStore.getCashFlowHistory(6);

  const byCategory = useMemo(() => {
    const map = {};
    for (const t of monthTx.filter((t) => t.type === 'expense')) map[t.category] = (map[t.category] || 0) + t.amount;
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [monthTx]);

  return (
    <div className="space-y-6">
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div key={a.id} className={`border rounded-xl p-3 flex items-start gap-3 ${a.level === 'red' ? 'border-bad/60 bg-bad/10' : 'border-warn/60 bg-warn/10'}`}>
              {a.level === 'red' ? <AlertTriangle size={18} className="text-bad shrink-0 mt-0.5" /> : <AlertCircle size={18} className="text-warn shrink-0 mt-0.5" />}
              <div className="text-sm">
                <span className="font-semibold text-[11px] uppercase tracking-wide" style={{ color: a.level === 'red' ? 'var(--error)' : 'var(--warning)' }}>{a.category}</span>
                <span className="text-mute"> — </span>{a.message}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat label="Net worth" value={netWorth !== null ? fmtMAD(netWorth) : '—'} />
        <Stat label="Revenus (MTD)" value={fmtMAD(income)} color="var(--success)" />
        <Stat label="Dépenses (MTD)" value={fmtMAD(expenses)} color={expenses > income && income > 0 ? 'var(--error)' : undefined} />
        <Stat label="Taux d'épargne" value={income > 0 ? fmtPct(savingsRate) : '—'} color={savingsRate >= 20 ? 'var(--success)' : savingsRate < 0 ? 'var(--error)' : undefined} />
        <Stat
          label="Autonomie (runway)"
          value={runway === null ? '—' : Number.isFinite(runway) ? `${runway.toFixed(1)} mois` : '∞'}
          color={runway !== null && Number.isFinite(runway) && runway < 3 ? 'var(--error)' : runway !== null && Number.isFinite(runway) && runway < 6 ? 'var(--warning)' : undefined}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Compte de résultat — 6 derniers mois">
          {cashFlowHistory.some((m) => m.income || m.expenses) ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={cashFlowHistory}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip {...tooltipStyle} formatter={(v) => fmtMAD(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="income" name="Revenus" fill="#00d97f" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Dépenses" fill="#ff6b6b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState>Pas encore assez de données.</EmptyState>
          )}
        </Card>

        <Card title="Répartition des dépenses (MTD)">
          {byCategory.length ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v) => fmtMAD(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {byCategory.map((c, i) => (
                  <span key={c.name} className="text-[11px] text-mute flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} /> {c.name}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <EmptyState>No expenses this month.</EmptyState>
          )}
        </Card>
      </div>
    </div>
  );
}
