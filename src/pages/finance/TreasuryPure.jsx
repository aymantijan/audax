import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend } from 'recharts';
import { Landmark } from 'lucide-react';
import { useAccountingStore } from '../../store/accountingStore';
import { accountsOfClass } from '../../utils/chart-of-accounts';
import { fmtMAD } from '../../utils/formatters';
import { Card, Stat, EmptyState } from '../../components/common/ui';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

export default function TreasuryPure() {
  const store = useAccountingStore();
  const balances = store.getBalances();
  const series = store.getMonthlySeries(6);
  const forecast = store.getTreasuryForecast(6);

  const cashAccounts = accountsOfClass(5)
    .map((a) => ({ ...a, solde: balances[a.code]?.balance || 0 }))
    .filter((a) => balances[a.code]);
  const totalTreso = cashAccounts.reduce((s, a) => s + a.solde, 0);

  // Runway : mois de décaissements couverts par la trésorerie actuelle.
  const avgDecaissements = series.slice(-3).reduce((a, m) => a + m.decaissements, 0) / 3;
  const runway = avgDecaissements > 0 ? totalTreso / avgDecaissements : null;

  if (!store.journal.length) {
    return (
      <Card>
        <EmptyState>La trésorerie (soldes, flux, prévisions) découle automatiquement des écritures de classe 5 au journal.</EmptyState>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Trésorerie totale (classe 5)" value={fmtMAD(totalTreso)} color={totalTreso >= 0 ? 'var(--accent-primary)' : 'var(--error)'} />
        <Stat
          label="Autonomie (runway)"
          value={runway === null ? '—' : `${runway.toFixed(1)} mois`}
          sub="Trésorerie / décaissements moyens (3 mois)"
          color={runway !== null && runway < 3 ? 'var(--error)' : runway !== null && runway < 6 ? 'var(--warning)' : undefined}
        />
        <Stat label="Solde budgété mensuel" value={fmtMAD(forecast.budgetNet)} sub="Issu de la gestion budgétaire" color={forecast.budgetNet >= 0 ? 'var(--success)' : 'var(--error)'} />
        <Stat label="Solde projeté à 6 mois" value={forecast.series.length ? fmtMAD(forecast.series[forecast.series.length - 1].solde) : '—'} />
      </div>

      <Card title="Soldes par compte de trésorerie">
        {cashAccounts.length ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {cashAccounts.map((a) => (
              <div key={a.code} className="bg-surface border border-line rounded-lg p-4 flex items-start gap-3">
                <Landmark size={18} className="text-mute mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-mute">{a.code} · {a.label}</div>
                  <div className="text-lg font-bold" style={{ color: a.solde >= 0 ? undefined : 'var(--error)' }}>{fmtMAD(a.solde)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>Aucun compte de trésorerie mouvementé.</EmptyState>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Encaissements vs Décaissements — 6 mois">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={series}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} formatter={(v) => fmtMAD(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="encaissements" name="Encaissements" fill="#00d97f" radius={[4, 4, 0, 0]} />
              <Bar dataKey="decaissements" name="Décaissements" fill="#ff6b6b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Solde de trésorerie — historique et prévision">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={[
                ...series.map((m) => ({ label: m.label, historique: m.solde })),
                ...forecast.series.map((f) => ({ label: f.label, prevision: f.solde })),
              ]}
            >
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip {...tooltipStyle} formatter={(v) => fmtMAD(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke="var(--error)" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="historique" name="Historique" stroke="#00d9ff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="prevision" name="Prévision (budget)" stroke="#b366ff" strokeWidth={2} strokeDasharray="6 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-mute mt-2">
            La prévision applique chaque mois le solde budgété net (budgets produits − budgets charges) au solde actuel — le budget de trésorerie découle des autres budgets.
          </p>
        </Card>
      </div>
    </div>
  );
}
