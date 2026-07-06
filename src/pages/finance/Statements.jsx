import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useAccountingStore } from '../../store/accountingStore';
import { CORRECTION_TYPES } from '../../utils/chart-of-accounts';
import { fmtMAD, fmtPct } from '../../utils/formatters';
import { Card, Button, Field, Input, Select, Modal, Badge, EmptyState } from '../../components/common/ui';
import AccountSelect from '../../components/common/AccountSelect';

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

const blankCorrection = () => ({ type: 'plus-value', label: '', amount: '', account: '', date: new Date().toISOString().slice(0, 10) });

export default function Statements() {
  const store = useAccountingStore();
  const { corrections, addCorrection, editCorrection, deleteCorrection } = store;
  const [periodId, setPeriodId] = useState('month');
  const period = periodOf(periodId);

  const bs = store.getBalanceSheet();
  const c = store.getCPC(period);
  const e = store.getESG(period);
  const netWorth = store.getNetWorth();
  const hasData = store.journal.length > 0;

  const [corrModal, setCorrModal] = useState(false);
  const [corrForm, setCorrForm] = useState(blankCorrection());
  const [editingCorr, setEditingCorr] = useState(null);

  const submitCorrection = (e2) => {
    e2.preventDefault();
    if (!corrForm.label.trim() || !Number(corrForm.amount)) return;
    const payload = { ...corrForm, account: corrForm.account || undefined };
    if (editingCorr) editCorrection(editingCorr.id, payload);
    else addCorrection(payload);
    setCorrModal(false);
    setEditingCorr(null);
    setCorrForm(blankCorrection());
  };

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
          <div className="mt-3 pt-3 border-t border-line">
            <Row label="Total Actif" value={bs.actif.total} />
            <Row label="− Total des dettes" value={-store.getAnalysis().dettesTotales} indent />
            <Row label="= ACTIF NET COMPTABLE (ANC)" value={netWorth.anc} bold color="var(--accent-secondary)" />
          </div>
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

      {/* ── ANC → ANCC : corrections de valeur ── */}
      <Card
        title="Actif Net Comptable Corrigé (ANCC)"
        action={
          <Button variant="ghost" onClick={() => { setEditingCorr(null); setCorrForm(blankCorrection()); setCorrModal(true); }}>
            <Plus size={15} />
          </Button>
        }
      >
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <Row label="Actif Net Comptable (ANC)" value={netWorth.anc} />
            <Row label="+ Plus-values sur éléments d'actif" value={netWorth.plusValues} indent color="var(--success)" />
            <Row label="− Moins-values sur éléments d'actif" value={-netWorth.moinsValues} indent color="var(--error)" />
            <Row label="= ACTIF NET COMPTABLE CORRIGÉ (ANCC)" value={netWorth.ancc} bold color="var(--accent-primary)" />
            <p className="text-[11px] text-mute mt-2">
              L'ANC vient automatiquement du journal (Actif − Dettes). Les corrections ci-contre reflètent l'écart entre la valeur comptable (coût historique) et la valeur réelle actuelle de vos biens.
            </p>
          </div>
          <div>
            {corrections.length ? (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {corrections.map((cr) => (
                  <div key={cr.id} className="flex items-center gap-2 text-sm border border-line rounded-lg px-3 py-2">
                    <Badge color={cr.type === 'plus-value' ? 'var(--success)' : 'var(--error)'}>{cr.type === 'plus-value' ? 'Plus-value' : 'Moins-value'}</Badge>
                    <span className="flex-1 truncate">{cr.label}</span>
                    <span className="font-medium" style={{ color: cr.type === 'plus-value' ? 'var(--success)' : 'var(--error)' }}>
                      {cr.type === 'plus-value' ? '+' : '−'}{fmtMAD(cr.amount)}
                    </span>
                    <button className="text-mute hover:text-accent cursor-pointer" onClick={() => { setEditingCorr(cr); setCorrForm({ ...cr, account: cr.account || '' }); setCorrModal(true); }} title="Modifier">
                      <Pencil size={13} />
                    </button>
                    <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Supprimer "${cr.label}" ?`)) deleteCorrection(cr.id); }} title="Supprimer">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState>Aucune correction. Ajoutez une plus/moins-value pour passer de l'ANC à l'ANCC.</EmptyState>
            )}
          </div>
        </div>
      </Card>

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

      <Modal open={corrModal} onClose={() => { setCorrModal(false); setEditingCorr(null); }} title={editingCorr ? 'Modifier la correction' : "Ajouter une plus/moins-value"}>
        <form onSubmit={submitCorrection} className="space-y-3">
          <Field label="Type">
            <Select value={corrForm.type} onChange={(e2) => setCorrForm({ ...corrForm, type: e2.target.value })} options={CORRECTION_TYPES} />
          </Field>
          <Field label="Libellé">
            <Input value={corrForm.label} onChange={(e2) => setCorrForm({ ...corrForm, label: e2.target.value })} placeholder="ex : Réévaluation appartement" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Montant (DH)">
              <Input type="number" step="any" min="0" value={corrForm.amount} onChange={(e2) => setCorrForm({ ...corrForm, amount: e2.target.value })} />
            </Field>
            <Field label="Date">
              <Input type="date" value={corrForm.date} onChange={(e2) => setCorrForm({ ...corrForm, date: e2.target.value })} />
            </Field>
          </div>
          <Field label="Élément d'actif concerné (optionnel)">
            <AccountSelect classes={[2, 3, 5]} value={corrForm.account} onChange={(e2) => setCorrForm({ ...corrForm, account: e2.target.value })} />
          </Field>
          <div className="flex justify-between gap-3 pt-2 border-t border-line">
            {editingCorr ? (
              <Button type="button" variant="danger" onClick={() => { deleteCorrection(editingCorr.id); setCorrModal(false); setEditingCorr(null); }}>
                <span className="flex items-center gap-2"><Trash2 size={14} /> Supprimer</span>
              </Button>
            ) : <span />}
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => { setCorrModal(false); setEditingCorr(null); }}>Annuler</Button>
              <Button type="submit">{editingCorr ? 'Enregistrer' : 'Ajouter'}</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
