import { useMemo, useState } from 'react';
import { Plus, Trash2, AlertTriangle, Bell, BellOff } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useAccountingStore } from '../../store/accountingStore';
import { monthKey } from '../../utils/accounting-engine';
import { fmtMAD, fmtPct } from '../../utils/formatters';
import { Card, Stat, Button, Field, Input, Modal, Badge, ProgressBar, EmptyState } from '../../components/common/ui';
import AccountSelect from '../../components/common/AccountSelect';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

export default function Budget() {
  const { budgets, setBudget, deleteBudget, getBudgetVariance, getBudgetAlerts, budgetAlerts, setBudgetAlertsEnabled } = useAccountingStore();
  const [mk, setMk] = useState(monthKey(new Date().toISOString().slice(0, 10)));
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ account: '621', amount: '' });
  const overruns = getBudgetAlerts();

  const toggleAlerts = async () => {
    if (budgetAlerts.enabled) return setBudgetAlertsEnabled(false);
    if (typeof Notification === 'undefined') return;
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission === 'granted') setBudgetAlertsEnabled(true);
  };

  const variance = useMemo(() => getBudgetVariance(mk), [getBudgetVariance, mk, budgets]);
  const charges = variance.filter((v) => v.cls === 6);
  const produits = variance.filter((v) => v.cls === 7);

  const totBudgetCharges = charges.reduce((a, v) => a + v.amount, 0);
  const totReelCharges = charges.reduce((a, v) => a + v.reel, 0);
  const totBudgetProduits = produits.reduce((a, v) => a + v.amount, 0);
  const totReelProduits = produits.reduce((a, v) => a + v.reel, 0);
  const soldeBudgete = totBudgetProduits - totBudgetCharges;
  const soldeReel = totReelProduits - totReelCharges;

  const chartData = variance.map((v) => ({ name: `${v.account}`, Budget: v.amount, 'Réel': v.reel }));

  const submit = (e) => {
    e.preventDefault();
    if (!Number(form.amount) || Number(form.amount) < 0) return;
    setBudget(form.account, form.amount);
    setModal(false);
    setForm({ account: '621', amount: '' });
  };

  const VarianceTable = ({ rows, title, natureCharges }) => (
    <Card title={title}>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-mute border-b border-line">
                <th className="py-2 pr-3">Compte</th>
                <th className="py-2 pr-3 text-right">Budget</th>
                <th className="py-2 pr-3 text-right">Réel</th>
                <th className="py-2 pr-3 text-right">Écart</th>
                <th className="py-2 pr-3 text-right">Réalisation</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} className="border-b border-line/40">
                  <td className="py-2 pr-3"><span className="text-mute text-xs mr-1">{v.account}</span>{v.label}</td>
                  <td className="py-2 pr-3 text-right">{fmtMAD(v.amount)}</td>
                  <td className="py-2 pr-3 text-right font-medium">{fmtMAD(v.reel)}</td>
                  <td className="py-2 pr-3 text-right">
                    <Badge color={v.favorable ? 'var(--success)' : 'var(--error)'}>
                      {v.ecart >= 0 ? '+' : ''}{fmtMAD(v.ecart)} · {v.favorable ? 'favorable' : 'défavorable'}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3 text-right w-40">
                    {v.realisation !== null ? (
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-20"><ProgressBar value={Math.min(150, v.realisation)} max={natureCharges ? 100 : Math.max(100, v.realisation)} color={natureCharges ? (v.realisation > 100 ? 'var(--error)' : v.realisation > 85 ? 'var(--warning)' : 'var(--success)') : 'var(--accent-primary)'} height={6} /></div>
                        <span className="text-xs text-mute w-12 text-right">{fmtPct(v.realisation, 0)}</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="py-2 text-right">
                    <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Supprimer le budget ${v.label} ?`)) deleteBudget(v.id); }}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>Aucun budget {natureCharges ? 'de charges' : 'de produits'} défini.</EmptyState>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Field label="Mois analysé">
          <Input type="month" value={mk} onChange={(e) => setMk(e.target.value)} className="w-44" />
        </Field>
        <div className="flex items-center gap-3">
          <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={toggleAlerts}>
            <span className="flex items-center gap-2">
              {budgetAlerts.enabled ? <Bell size={13} /> : <BellOff size={13} />}
              {budgetAlerts.enabled ? 'Rappels activés' : 'Activer les rappels'}
            </span>
          </Button>
          <Button onClick={() => setModal(true)}>
            <span className="flex items-center gap-2"><Plus size={16} /> Définir un budget</span>
          </Button>
        </div>
      </div>

      {overruns.length > 0 && (
        <Card title={`Dépassement de budget (${overruns.length})`} action={<AlertTriangle size={16} className="text-bad" />}>
          <ul className="space-y-1.5">
            {overruns.map((v) => (
              <li key={v.id} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm flex-wrap border ${v.severity.level === 'red' ? 'bg-bad/10 border-bad/40' : 'bg-warn/10 border-warn/40'}`}>
                <AlertTriangle size={14} className={v.severity.level === 'red' ? 'text-bad shrink-0' : 'text-warn shrink-0'} />
                <span className="flex-1 min-w-[10rem]">{v.label}</span>
                <span className="font-medium">{fmtMAD(v.reel)} / {fmtMAD(v.amount)}</span>
                <Badge color={v.severity.level === 'red' ? 'var(--error)' : 'var(--warning)'}>+{Math.round(v.severity.over)}%</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Produits — budget vs réel" value={fmtMAD(totReelProduits)} sub={`Budget : ${fmtMAD(totBudgetProduits)}`} color="var(--success)" />
        <Stat label="Charges — budget vs réel" value={fmtMAD(totReelCharges)} sub={`Budget : ${fmtMAD(totBudgetCharges)}`} color={totReelCharges > totBudgetCharges ? 'var(--error)' : undefined} />
        <Stat label="Solde budgété" value={fmtMAD(soldeBudgete)} sub="Σ budgets produits − Σ budgets charges" />
        <Stat label="Solde réel" value={fmtMAD(soldeReel)} color={soldeReel >= soldeBudgete ? 'var(--success)' : 'var(--warning)'} sub={`Écart global : ${soldeReel - soldeBudgete >= 0 ? '+' : ''}${fmtMAD(soldeReel - soldeBudgete)}`} />
      </div>

      {variance.length > 0 && (
        <Card title={`Budget vs Réel — ${mk}`}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} formatter={(v) => fmtMAD(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Budget" fill="#7aa2ff" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Réel" fill="#00d9ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <VarianceTable rows={charges} title="Budgets de charges — contrôle des écarts" natureCharges />
        <VarianceTable rows={produits} title="Budgets de produits — objectifs de revenus" />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Définir un budget mensuel">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Compte (charge à plafonner ou produit à viser)">
            <AccountSelect classes={[6, 7]} value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} />
          </Field>
          <Field label="Montant mensuel (DH)">
            <Input type="number" step="any" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} autoFocus />
          </Field>
          <p className="text-xs text-mute">
            Convention : pour une charge, dépasser le budget = écart défavorable ; pour un produit, dépasser l'objectif = écart favorable.
          </p>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button type="submit">Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
