import { useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend } from 'recharts';
import { useAccountingStore } from '../../store/accountingStore';
import { financialAnalysis } from '../../utils/accounting-engine';
import { fmtMAD, fmtPct } from '../../utils/formatters';
import { Card, Stat, EmptyState } from '../../components/common/ui';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

export default function Analysis() {
  const store = useAccountingStore();
  const journal = store.journal;
  const a = store.getAnalysis();
  const series = store.getMonthlySeries(12);

  // Progression du patrimoine : analyse bilancielle à la fin de chaque mois.
  const patrimoineSeries = useMemo(() => {
    return series.map((m) => {
      const fa = financialAnalysis(journal, `${m.key}-31`);
      return {
        label: m.label,
        patrimoine: fa.capitauxPropres,
        FR: fa.fondsRoulement,
        BFR: fa.bfr,
        TN: fa.tresorerieNette,
      };
    });
  }, [journal, series]);

  if (!journal.length) {
    return (
      <Card>
        <EmptyState>L'analyse financière (FR, BFR, TN, ratios) se calcule automatiquement dès les premières écritures.</EmptyState>
      </Card>
    );
  }

  const r = a.ratios;
  const diagnostic =
    a.tresorerieNette >= 0 && a.fondsRoulement >= 0
      ? { text: 'Équilibre financier sain : le financement permanent couvre les emplois durables, et la trésorerie nette est positive.', color: 'var(--success)' }
      : a.fondsRoulement < 0
        ? { text: 'Déséquilibre : le fonds de roulement est négatif — les emplois longs sont financés par des ressources courtes.', color: 'var(--error)' }
        : { text: 'Vigilance : trésorerie nette négative — le BFR absorbe plus que le fonds de roulement.', color: 'var(--warning)' };

  return (
    <div className="space-y-6">
      {/* ── Équilibre financier ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Fonds de roulement (FR)" value={fmtMAD(a.fondsRoulement)} sub="Financement permanent − Actif immobilisé" color={a.fondsRoulement >= 0 ? 'var(--success)' : 'var(--error)'} />
        <Stat label="Besoin en FR (BFR)" value={fmtMAD(a.bfr)} sub="Créances − Dettes court terme" />
        <Stat label="Trésorerie nette (TN)" value={fmtMAD(a.tresorerieNette)} sub="TN = FR − BFR" color={a.tresorerieNette >= 0 ? 'var(--success)' : 'var(--error)'} />
        <Stat label="Patrimoine net" value={fmtMAD(a.capitauxPropres)} sub="Capitaux propres + résultat cumulé" color="var(--accent-primary)" />
      </div>

      <div className="border rounded-xl p-3 text-sm" style={{ borderColor: diagnostic.color, background: `color-mix(in srgb, ${diagnostic.color} 8%, transparent)` }}>
        <span style={{ color: diagnostic.color }} className="font-medium">Diagnostic : </span>{diagnostic.text}
      </div>

      {/* ── Ratios ── */}
      <Card title="Ratios d'analyse financière">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Stat label="Autonomie financière" value={r.autonomieFinanciere !== null ? fmtPct(r.autonomieFinanciere, 1) : '—'} sub="Capitaux propres / Total passif" color={r.autonomieFinanciere !== null && r.autonomieFinanciere < 50 ? 'var(--warning)' : undefined} />
          <Stat label="Endettement" value={r.endettement !== null ? fmtPct(r.endettement, 1) : '—'} sub="Dettes totales / Total passif" color={r.endettement !== null && r.endettement > 50 ? 'var(--error)' : undefined} />
          <Stat label="Liquidité générale" value={r.liquiditeGenerale !== null ? r.liquiditeGenerale.toFixed(2) : '—'} sub="(Créances + Tréso) / Dettes CT" color={r.liquiditeGenerale !== null && r.liquiditeGenerale < 1 ? 'var(--error)' : undefined} />
          <Stat label="Liquidité immédiate" value={r.liquiditeImmediate !== null ? r.liquiditeImmediate.toFixed(2) : '—'} sub="Trésorerie / Dettes CT" />
          <Stat label="Couverture des immobilisations" value={r.couvertureImmobilisations !== null ? fmtPct(r.couvertureImmobilisations, 0) : '—'} sub="Fin. permanent / Actif immobilisé" color={r.couvertureImmobilisations !== null && r.couvertureImmobilisations < 100 ? 'var(--warning)' : undefined} />
        </div>
      </Card>

      {/* ── Progression historique ── */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Progression du patrimoine net — 12 mois">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={patrimoineSeries}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip {...tooltipStyle} formatter={(v) => fmtMAD(v)} />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Line type="monotone" dataKey="patrimoine" name="Patrimoine net" stroke="#b366ff" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="FR / BFR / TN — évolution">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={patrimoineSeries}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip {...tooltipStyle} formatter={(v) => fmtMAD(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Line type="monotone" dataKey="FR" stroke="#00d97f" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="BFR" stroke="#ffa500" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="TN" stroke="#00d9ff" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Résultat mensuel (produits − charges) — 12 mois">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={series}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
            <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
            <Tooltip {...tooltipStyle} formatter={(v) => fmtMAD(v)} />
            <ReferenceLine y={0} stroke="var(--border)" />
            <Bar dataKey="resultat" name="Résultat" radius={[4, 4, 0, 0]}>
              {series.map((m, i) => (
                <Cell key={i} fill={m.resultat >= 0 ? '#00d97f' : '#ff6b6b'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
