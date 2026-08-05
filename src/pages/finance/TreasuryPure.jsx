import { useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend } from 'recharts';
import { Landmark, Plus, Pencil, Archive, ArchiveRestore, Trash2, AlertTriangle } from 'lucide-react';
import { useAccountingStore } from '../../store/accountingStore';
import { accountsOfClass } from '../../utils/chart-of-accounts';
import { fmtMAD, fmtDate } from '../../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Modal, Badge, EmptyState } from '../../components/common/ui';
import { toast } from '../../store/uiStore';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

const blankSubForm = (parentCode) => ({ parentCode, name: '', bank: '' });

export default function TreasuryPure() {
  const store = useAccountingStore();
  const { treasuryAccounts, addTreasuryAccount, editTreasuryAccount, archiveTreasuryAccount, unarchiveTreasuryAccount, deleteTreasuryAccount } = store;
  const balances = store.getBalances();
  const series = store.getMonthlySeries(6);
  const forecast = store.getTreasuryForecast(6);

  const [subModal, setSubModal] = useState(false);
  const [editingSub, setEditingSub] = useState(null);
  const [subForm, setSubForm] = useState(blankSubForm('511'));
  const [horizonDays, setHorizonDays] = useState(90);
  const [includeTradingPayout, setIncludeTradingPayout] = useState(false);
  const forecastV2 = store.getTreasuryForecastV2(horizonDays, { includeTradingPayout });
  const tradingPayoutEstimate = store.getTradingPayoutEstimate();

  // Chaque compte collectif de classe 5 (511, 512, 514...) affiche son solde
  // propre + celui de tous ses comptes auxiliaires réunis — un compte
  // auxiliaire (ex: "CIH") est un compte de trésorerie à part entière au
  // journal (classOf le traite comme classe 5), juste rattaché visuellement.
  const parents = accountsOfClass(5);
  const groups = parents.map((p) => {
    const subs = treasuryAccounts.filter((a) => a.parentCode === p.code);
    const parentBalance = balances[p.code]?.balance || 0;
    const total = subs.reduce((s, a) => s + (balances[a.code]?.balance || 0), parentBalance);
    return { ...p, parentBalance, subs, total };
  });
  const totalTreso = groups.reduce((s, g) => s + g.total, 0);

  const avgDecaissements = series.slice(-3).reduce((a, m) => a + m.decaissements, 0) / 3;
  const runway = avgDecaissements > 0 ? totalTreso / avgDecaissements : null;

  const openNewSub = (parentCode) => { setEditingSub(null); setSubForm(blankSubForm(parentCode)); setSubModal(true); };
  const openEditSub = (a) => { setEditingSub(a); setSubForm({ parentCode: a.parentCode, name: a.name, bank: a.bank || '' }); setSubModal(true); };
  const closeSubModal = () => { setSubModal(false); setEditingSub(null); };

  const submitSub = (e) => {
    e.preventDefault();
    if (!subForm.name.trim()) return toast('Le nom du compte est requis.', 'error');
    if (editingSub) {
      editTreasuryAccount(editingSub.id, { name: subForm.name, bank: subForm.bank });
      toast(`Compte auxiliaire modifié : ${subForm.name}`, 'success');
    } else {
      const res = addTreasuryAccount(subForm);
      if (!res.ok) return toast(res.error, 'error');
    }
    closeSubModal();
  };

  const removeSub = (a) => {
    if (!confirm(`Supprimer le compte "${a.name}" ?`)) return;
    const res = deleteTreasuryAccount(a.id);
    if (!res.ok) toast(res.error, 'error');
  };

  const parentLabel = accountsOfClass(5).find((p) => p.code === subForm.parentCode)?.label;

  if (!store.journal.length && !treasuryAccounts.length) {
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

      <Card title="Comptes de trésorerie">
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.code} className="border border-line rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Landmark size={16} className="text-mute shrink-0" />
                  <span className="font-medium">{g.code} · {g.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold" style={{ color: g.total >= 0 ? undefined : 'var(--error)' }}>{fmtMAD(g.total)}</span>
                  <button className="text-mute hover:text-accent cursor-pointer" onClick={() => openNewSub(g.code)} title="Ajouter un compte auxiliaire">
                    <Plus size={15} />
                  </button>
                </div>
              </div>
              {g.subs.length ? (
                <ul className="space-y-1.5">
                  {g.subs.map((a) => (
                    <li key={a.id} className={`flex items-center gap-2 text-sm bg-surface border border-line rounded-lg px-3 py-2 ${a.archived ? 'opacity-50' : ''}`}>
                      <span className="flex-1 truncate">
                        {a.name} {a.bank && <span className="text-mute text-xs">· {a.bank}</span>}
                      </span>
                      {a.archived && <Badge color="var(--text-secondary)">Archivé</Badge>}
                      <span className="font-medium whitespace-nowrap" style={{ color: (balances[a.code]?.balance || 0) >= 0 ? undefined : 'var(--error)' }}>
                        {fmtMAD(balances[a.code]?.balance || 0)}
                      </span>
                      <button className="text-mute hover:text-accent cursor-pointer" onClick={() => openEditSub(a)} title="Modifier"><Pencil size={13} /></button>
                      {a.archived ? (
                        <button className="text-mute hover:text-accent cursor-pointer" onClick={() => unarchiveTreasuryAccount(a.id)} title="Réactiver"><ArchiveRestore size={13} /></button>
                      ) : (
                        <button className="text-mute hover:text-warn cursor-pointer" onClick={() => archiveTreasuryAccount(a.id)} title="Archiver"><Archive size={13} /></button>
                      )}
                      <button className="text-mute hover:text-bad cursor-pointer" onClick={() => removeSub(a)} title="Supprimer"><Trash2 size={13} /></button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-mute">Aucun compte auxiliaire — les écritures sur « {g.label} » sont suivies globalement.</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {store.journal.length > 0 && (
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
      )}

      <Card
        title="Prévision détaillée (jour par jour)"
        action={
          <div className="flex items-center gap-2">
            <Select value={horizonDays} onChange={(e) => setHorizonDays(Number(e.target.value))} className="!py-1 !px-2 text-xs w-32" options={[{ value: 30, label: '30 jours' }, { value: 60, label: '60 jours' }, { value: 90, label: '90 jours' }, { value: 180, label: '180 jours' }, { value: 365, label: '1 an' }]} />
          </div>
        }
      >
        <p className="text-[11px] text-mute mb-3">
          Combine le solde actuel, les habitudes réelles détectées dans le journal (comptes non couverts par une échéance active), et les échéances programmées à leur date exacte.
        </p>
        <label className="flex items-center gap-2 text-xs text-mute mb-3 cursor-pointer w-fit">
          <input type="checkbox" checked={includeTradingPayout} onChange={(e) => setIncludeTradingPayout(e.target.checked)} />
          Inclure une estimation de payout trading ({fmtMAD(tradingPayoutEstimate)}/mois, 80% du P&L réalisé sur 30j des comptes Broker/Prop Firm)
        </label>

        {forecastV2.alerts.length > 0 && (
          <div className="flex items-center gap-2 text-sm border border-bad/50 bg-bad/10 text-bad rounded-lg px-4 py-2.5 mb-3">
            <AlertTriangle size={15} className="shrink-0" />
            Risque de découvert : solde projeté négatif à partir du {fmtDate(forecastV2.alerts[0].date)} ({fmtMAD(forecastV2.alerts[0].solde)})
          </div>
        )}

        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={forecastV2.series}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} interval={Math.ceil(forecastV2.series.length / 12)} />
            <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} domain={['auto', 'auto']} />
            <Tooltip {...tooltipStyle} formatter={(v) => fmtMAD(v)} />
            <ReferenceLine y={0} stroke="var(--error)" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="solde" name="Solde projeté" stroke="#00d9ff" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-[11px] text-mute mt-2">
          {forecastV2.echeancesInWindow} occurrence{forecastV2.echeancesInWindow !== 1 ? 's' : ''} d'échéance dans la fenêtre · habitude libre estimée : {fmtMAD(forecastV2.freeHabitMonthly)}/mois
        </p>
      </Card>

      <Modal open={subModal} onClose={closeSubModal} title={editingSub ? 'Modifier le compte auxiliaire' : 'Nouveau compte auxiliaire de trésorerie'}>
        <form onSubmit={submitSub} className="space-y-3">
          <div className="text-xs text-mute">
            Rattaché à : <span className="text-ink font-medium">{subForm.parentCode} · {parentLabel}</span>
          </div>
          <Field label="Nom du compte">
            <Input value={subForm.name} onChange={(e) => setSubForm({ ...subForm, name: e.target.value })} placeholder="ex : CIH" autoFocus />
          </Field>
          <Field label="Banque / plateforme (optionnel)">
            <Input value={subForm.bank} onChange={(e) => setSubForm({ ...subForm, bank: e.target.value })} placeholder="ex : CIH Bank" />
          </Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={closeSubModal}>Annuler</Button>
            <Button type="submit">{editingSub ? 'Enregistrer' : 'Créer'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
