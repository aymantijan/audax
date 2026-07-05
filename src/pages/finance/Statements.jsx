import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useAccountingStore } from '../../store/accountingStore';
import { fmtMAD, fmtPct } from '../../utils/formatters';
import { Card, EmptyState } from '../../components/common/ui';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

const PERIODS = [
  { id: 'month', label: 'Mois en cours' },
  { id: 'year', label: 'Année en cours' },
  { id: 'all', label: 'Depuis le début' },
];

function periodOf(id) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  if (id === 'month') return { from: `${y}-${m}-01`, to: `${y}-${m}-31` };
  if (id === 'year') return { from: `${y}-01-01`, to: `${y}-12-31` };
  return undefined;
}

function Row({ label, value, bold, indent, color }) {
  return (
    <div className={`flex justify-between py-1.5 text-sm ${bold ? 'font-semibold border-t border-line mt-1 pt-2' : ''} ${indent ? 'pl-4 text-mute' : ''}`}>
      <span>{label}</span>
      <span style={color ? { color } : undefined}>{fmtMAD(value)}</span>
    </div>
  );
}

export default function Statements() {
  const store = useAccountingStore();
  const [periodId, setPeriodId] = useState('month');
  const period = periodOf(periodId);

  const bs = store.getBalanceSheet();
  const c = store.getCPC(period);
  const e = store.getESG(period);
  const hasData = store.journal.length > 0;

  const bilanChart = [
    { name: 'Actif', Immobilisé: bs.actif.immobilise, Créances: bs.actif.creances, Trésorerie: bs.actif.tresorerie },
    { name: 'Passif', 'Capitaux & emprunts': bs.passif.capitaux, 'Dettes CT': bs.passif.dettesCT, 'Résultat': bs.passif.resultat },
  ];

  if (!hasData) {
    return (
      <Card>
        <EmptyState>Les états de synthèse (Bilan, CPC, ESG) se construisent automatiquement à partir du journal.</EmptyState>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── BILAN ── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card title="Bilan — Actif" className="lg:col-span-1">
          <Row label="Actif immobilisé (cl. 2)" value={bs.actif.immobilise} />
          {bs.actif.detailImmobilise.map((d) => <Row key={d.code} label={d.label} value={d.amount} indent />)}
          <Row label="Créances & avances (cl. 3)" value={bs.actif.creances} />
          {bs.actif.detailCreances.map((d) => <Row key={d.code} label={d.label} value={d.amount} indent />)}
          <Row label="Trésorerie (cl. 5)" value={bs.actif.tresorerie} />
          {bs.actif.detailTresorerie.map((d) => <Row key={d.code} label={d.label} value={d.amount} indent />)}
          <Row label="TOTAL ACTIF" value={bs.actif.total} bold color="var(--accent-primary)" />
        </Card>

        <Card title="Bilan — Passif" className="lg:col-span-1">
          <Row label="Capitaux & emprunts LT (cl. 1)" value={bs.passif.capitaux} />
          {bs.passif.detailCapitaux.map((d) => <Row key={d.code} label={d.label} value={d.amount} indent />)}
          <Row label="Dettes court terme (cl. 4)" value={bs.passif.dettesCT} />
          {bs.passif.detailDettesCT.map((d) => <Row key={d.code} label={d.label} value={d.amount} indent />)}
          <Row label="Résultat cumulé (7 − 6)" value={bs.passif.resultat} color={bs.passif.resultat >= 0 ? 'var(--success)' : 'var(--error)'} />
          <Row label="TOTAL PASSIF" value={bs.passif.total} bold color="var(--accent-primary)" />
          <p className="text-[11px] mt-2" style={{ color: bs.equilibre ? 'var(--success)' : 'var(--error)' }}>
            {bs.equilibre ? '✓ Actif = Passif : le bilan est équilibré (partie double respectée).' : '⚠ Bilan déséquilibré.'}
          </p>
        </Card>

        <Card title="Structure du bilan" className="lg:col-span-1">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={bilanChart}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} formatter={(v) => fmtMAD(v)} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="Immobilisé" stackId="a" fill="#7aa2ff" />
              <Bar dataKey="Créances" stackId="a" fill="#b366ff" />
              <Bar dataKey="Trésorerie" stackId="a" fill="#00d9ff" />
              <Bar dataKey="Capitaux & emprunts" stackId="a" fill="#00d97f" />
              <Bar dataKey="Dettes CT" stackId="a" fill="#ff6b6b" />
              <Bar dataKey="Résultat" stackId="a" fill="#ffa500" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── Période pour CPC & ESG ── */}
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriodId(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs border cursor-pointer ${p.id === periodId ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute hover:text-ink'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ── CPC ── */}
        <Card title="CPC — Compte de Produits et Charges">
          <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-1">Produits</div>
          {c.detailProduits.length ? c.detailProduits.map((d) => <Row key={d.code} label={`${d.code} ${d.label}`} value={d.amount} indent />) : <p className="text-xs text-mute pl-4 py-1">Aucun produit sur la période.</p>}
          <Row label="Total produits" value={c.produitsCourants + c.produitsExcep} bold color="var(--success)" />
          <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-1 mt-4">Charges</div>
          {c.detailCharges.length ? c.detailCharges.map((d) => <Row key={d.code} label={`${d.code} ${d.label}`} value={d.amount} indent />) : <p className="text-xs text-mute pl-4 py-1">Aucune charge sur la période.</p>}
          <Row label="Total charges" value={c.chargesCourantes + c.chargesExcep} bold color="var(--error)" />
          <Row label="RÉSULTAT NET" value={c.resultatNet} bold color={c.resultatNet >= 0 ? 'var(--success)' : 'var(--error)'} />
          <p className="text-[11px] text-mute mt-1">
            dont courant {fmtMAD(c.resultatCourant)} · exceptionnel {fmtMAD(c.resultatExcep)}
          </p>
        </Card>

        {/* ── ESG ── */}
        <Card title="ESG — État des Soldes de Gestion (cascade)">
          <Row label="Revenus d'activité" value={e.revenusActivite} color="var(--success)" />
          <Row label="− Dépenses de vie courante" value={-e.vieCourante} indent />
          <Row label="= Épargne brute (équiv. EBE)" value={e.epargneBrute} bold color={e.epargneBrute >= 0 ? 'var(--success)' : 'var(--error)'} />
          <Row label="− Impôts & assurances" value={-e.obligations} indent />
          <Row label="= Épargne après obligations" value={e.epargneApresObligations} bold />
          <Row label="+ Produits financiers" value={e.produitsFinanciers} indent />
          <Row label="− Charges financières" value={-e.chargesFinancieres} indent />
          <Row label="= Résultat courant" value={e.resultatCourant} bold />
          <Row label="± Éléments exceptionnels" value={e.exceptionnel} indent />
          <Row label="= RÉSULTAT NET (capacité d'épargne)" value={e.resultatNet} bold color={e.resultatNet >= 0 ? 'var(--success)' : 'var(--error)'} />
          <div className="mt-3 p-3 bg-surface rounded-lg text-sm flex justify-between">
            <span className="text-mute">Taux d'épargne de la période</span>
            <span className="font-bold" style={{ color: (e.tauxEpargne ?? 0) >= 20 ? 'var(--success)' : (e.tauxEpargne ?? 0) < 0 ? 'var(--error)' : 'var(--warning)' }}>
              {e.tauxEpargne !== null ? fmtPct(e.tauxEpargne, 1) : '—'}
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
