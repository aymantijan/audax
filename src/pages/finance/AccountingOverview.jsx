import { useMemo } from 'react';
import { AlertTriangle, AlertCircle, BookOpen } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from 'recharts';
import { useAccountingStore } from '../../store/accountingStore';
import { ACCOUNT_MAP } from '../../utils/chart-of-accounts';
import { fmtMAD, fmtPct } from '../../utils/formatters';
import { Card, Stat, EmptyState } from '../../components/common/ui';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };
const PIE_COLORS = ['#00d9ff', '#b366ff', '#00d97f', '#ffa500', '#ff6b6b', '#7aa2ff', '#f7c948', '#9ae6b4'];

export default function AccountingOverview() {
  const store = useAccountingStore();
  const period = store.currentMonthPeriod();
  const c = store.getCPC(period);
  const e = store.getESG(period);
  const a = store.getAnalysis();
  const series = store.getMonthlySeries(6);
  const variance = store.getBudgetVariance();

  const alerts = useMemo(() => {
    const out = [];
    if (a.tresorerieNette < 0) out.push({ id: 'tn', level: 'red', cat: 'Trésorerie', msg: `Trésorerie nette négative : ${fmtMAD(a.tresorerieNette)}` });
    if (a.fondsRoulement < 0) out.push({ id: 'fr', level: 'red', cat: 'Équilibre', msg: 'Fonds de roulement négatif — les emplois durables ne sont pas couverts.' });
    for (const v of variance.filter((x) => x.cls === 6 && !x.favorable && x.amount > 0)) {
      out.push({ id: `b-${v.id}`, level: v.reel > v.amount * 1.25 ? 'red' : 'orange', cat: 'Budget', msg: `${v.label} : ${fmtMAD(v.reel)} dépensés pour ${fmtMAD(v.amount)} budgétés (${fmtPct(v.realisation ?? 0, 0)})` });
    }
    if (e.tauxEpargne !== null && e.tauxEpargne < 0) out.push({ id: 'ep', level: 'red', cat: 'Épargne', msg: `Taux d'épargne négatif ce mois : ${fmtPct(e.tauxEpargne, 1)}` });
    else if (e.tauxEpargne !== null && e.tauxEpargne < 10) out.push({ id: 'ep2', level: 'orange', cat: 'Épargne', msg: `Taux d'épargne faible ce mois : ${fmtPct(e.tauxEpargne, 1)}` });
    const order = { red: 0, orange: 1 };
    return out.sort((x, y) => order[x.level] - order[y.level]);
  }, [a, variance, e]);

  const chargesPie = c.detailCharges.slice(0, 8).map((d) => ({ name: `${d.code} ${ACCOUNT_MAP[d.code]?.label || ''}`, value: d.amount }));

  if (!store.journal.length) {
    return (
      <Card>
        <EmptyState>
          <BookOpen className="mx-auto mb-2 text-mute" size={28} />
          <p className="mb-1 font-medium text-ink">Votre comptabilité personnelle démarre au Journal.</p>
          Saisissez vos « Soldes d'ouverture » (onglet Journal → Nouvelle écriture), puis chaque opération en partie double.
          Bilan, CPC, ESG, analyse, budget et trésorerie se rempliront automatiquement.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((al) => (
            <div key={al.id} className={`border rounded-xl p-3 flex items-start gap-3 ${al.level === 'red' ? 'border-bad/60 bg-bad/10' : 'border-warn/60 bg-warn/10'}`}>
              {al.level === 'red' ? <AlertTriangle size={18} className="text-bad shrink-0 mt-0.5" /> : <AlertCircle size={18} className="text-warn shrink-0 mt-0.5" />}
              <div className="text-sm">
                <span className="font-semibold text-[11px] uppercase tracking-wide" style={{ color: al.level === 'red' ? 'var(--error)' : 'var(--warning)' }}>{al.cat}</span>
                <span className="text-mute"> — </span>{al.msg}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat label="Trésorerie nette" value={fmtMAD(a.tresorerieNette)} color={a.tresorerieNette >= 0 ? 'var(--accent-primary)' : 'var(--error)'} />
        <Stat label="Patrimoine net" value={fmtMAD(a.capitauxPropres)} />
        <Stat label="Produits (mois)" value={fmtMAD(c.produitsCourants + c.produitsExcep)} color="var(--success)" />
        <Stat label="Charges (mois)" value={fmtMAD(c.chargesCourantes + c.chargesExcep)} />
        <Stat
          label="Taux d'épargne (mois)"
          value={e.tauxEpargne !== null ? fmtPct(e.tauxEpargne, 1) : '—'}
          color={(e.tauxEpargne ?? 0) >= 20 ? 'var(--success)' : (e.tauxEpargne ?? 0) < 0 ? 'var(--error)' : undefined}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Produits vs Charges — 6 mois">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={series}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} formatter={(v) => fmtMAD(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Bar dataKey="produits" name="Produits (cl. 7)" fill="#00d97f" radius={[4, 4, 0, 0]} />
              <Bar dataKey="charges" name="Charges (cl. 6)" fill="#ff6b6b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Répartition des charges du mois (par compte)">
          {chargesPie.length ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={chargesPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {chargesPie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v) => fmtMAD(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {chargesPie.map((p, i) => (
                  <span key={p.name} className="text-[11px] text-mute flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} /> {p.name}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <EmptyState>Aucune charge ce mois-ci.</EmptyState>
          )}
        </Card>
      </div>
    </div>
  );
}
