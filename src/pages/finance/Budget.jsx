import { Fragment, useMemo, useState } from 'react';
import { Plus, Trash2, AlertTriangle, Bell, BellOff, ChevronRight, ChevronDown, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useAccountingStore } from '../../store/accountingStore';
import { DEFAULT_BUDGET_PERIOD } from '../../utils/accounting-engine';
import { fmtMAD, fmtPct } from '../../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Modal, Badge, ProgressBar, EmptyState } from '../../components/common/ui';
import AccountSelect from '../../components/common/AccountSelect';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

const CALENDAR_PRESETS = [
  { value: 1, label: 'Mensuel' },
  { value: 2, label: 'Bimensuel (2 mois)' },
  { value: 3, label: 'Trimestriel' },
  { value: 6, label: 'Semestriel' },
  { value: 12, label: 'Annuel' },
  { value: 'custom', label: 'Nombre de mois personnalisé…' },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

// Formulaire local de période → objet `period` prêt pour addBudget/editBudget. Séparé de
// `period` lui-même pour permettre une saisie intermédiaire incomplète (ex :
// "custom" sans months encore choisi) sans casser getPeriodBounds ailleurs.
const emptyPeriodForm = () => ({ type: 'calendar', months: 1, customMonths: '', startDate: todayISO(), endDate: todayISO(), recurring: true });

function periodFormToPeriod(pf) {
  if (pf.type === 'weekly') return { type: 'weekly' };
  if (pf.type === 'custom') return { type: 'custom', startDate: pf.startDate, endDate: pf.endDate, recurring: pf.recurring };
  const months = pf.months === 'custom' ? Math.max(1, Number(pf.customMonths) || 1) : Number(pf.months) || 1;
  return { type: 'calendar', months };
}

// Étiquette compacte du type de période — sert à distinguer, sur le graphique
// et dans la liste, plusieurs budgets qui partagent le même compte (ex : un
// plafond hebdomadaire et un plafond annuel sur "Loisirs").
function periodTag(period) {
  const p = period || DEFAULT_BUDGET_PERIOD;
  if (p.type === 'weekly') return 'Hebdo';
  if (p.type === 'custom') return 'Perso';
  const months = Number(p.months) || 1;
  return { 1: 'Mens.', 3: 'Trim.', 6: 'Semes.', 12: 'Annuel' }[months] || `${months}m`;
}

function periodToPeriodForm(period) {
  const p = period || DEFAULT_BUDGET_PERIOD;
  if (p.type === 'weekly') return { ...emptyPeriodForm(), type: 'weekly' };
  if (p.type === 'custom') return { ...emptyPeriodForm(), type: 'custom', startDate: p.startDate || todayISO(), endDate: p.endDate || todayISO(), recurring: !!p.recurring };
  const isPreset = CALENDAR_PRESETS.some((o) => o.value === p.months);
  return { ...emptyPeriodForm(), type: 'calendar', months: isPreset ? p.months : 'custom', customMonths: isPreset ? '' : String(p.months || 1) };
}

// Sélecteur de type de période — mensuel/bimensuel/trimestriel/etc (n mois),
// hebdomadaire (lundi→dimanche) ou personnalisé (dates exactes, ponctuel ou récurrent).
function PeriodFields({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-3 rounded-lg border border-line p-3">
      <Field label="Type de période">
        <Select
          value={value.type}
          onChange={(e) => set({ type: e.target.value })}
          options={[
            { value: 'calendar', label: 'Mensuel / bimensuel / trimestriel / annuel…' },
            { value: 'weekly', label: 'Hebdomadaire (lundi → dimanche)' },
            { value: 'custom', label: 'Personnalisé (dates exactes)' },
          ]}
        />
      </Field>

      {value.type === 'calendar' && (
        <Field label="Durée" hint="Ancré sur les cycles calendaires civils (ex : trimestre = Jan-Mar, Avr-Juin…).">
          <Select value={value.months} onChange={(e) => set({ months: e.target.value === 'custom' ? 'custom' : Number(e.target.value) })} options={CALENDAR_PRESETS} />
          {value.months === 'custom' && (
            <Input type="number" min="1" step="1" placeholder="Nombre de mois" className="mt-2" value={value.customMonths} onChange={(e) => set({ customMonths: e.target.value })} />
          )}
        </Field>
      )}

      {value.type === 'weekly' && <p className="text-xs text-mute">La période court toujours du lundi au dimanche, quel que soit le jour où vous consultez.</p>}

      {value.type === 'custom' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date de début">
              <Input type="date" value={value.startDate} onChange={(e) => set({ startDate: e.target.value })} />
            </Field>
            <Field label="Date de fin">
              <Input type="date" value={value.endDate} onChange={(e) => set({ endDate: e.target.value })} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={value.recurring} onChange={(e) => set({ recurring: e.target.checked })} />
            Se répète en boucle (même durée, indéfiniment)
          </label>
          {!value.recurring && <p className="text-xs text-mute">Sans répétition, la période reste fixe : ces dates exactes, une seule fois.</p>}
        </>
      )}
    </div>
  );
}

// Panneau "raisonné" d'un budget : où on en est dans la période (rythme +
// projection fin de période), comparaison à son propre historique, ce qui a
// concrètement été acheté/encaissé (par tiers), et les mouvements inhabituels
// — répond à "qu'est-ce qui explique ce chiffre ?", pas juste "combien".
function BudgetInsightsPanel({ v, refDate, natureCharges }) {
  // Lecture directe (pas de selector hook) : un selector qui retourne un objet
  // recalculé à chaque appel casse le cache de useSyncExternalStore (boucle
  // infinie). Le parent (Budget) est déjà abonné au store entier, donc ce
  // composant est re-rendu à chaque changement pertinent sans s'abonner lui-même.
  const insights = useAccountingStore.getState().getBudgetInsights(v.id, refDate);
  if (!insights) return null;

  const paceBadge = insights.pace && v.amount > 0 && (
    natureCharges
      ? insights.pace.projected > v.amount
        ? { color: 'var(--error)', text: 'dépassement prévu' }
        : { color: 'var(--success)', text: 'dans les clous' }
      : insights.pace.projected >= v.amount
        ? { color: 'var(--success)', text: 'objectif en vue' }
        : { color: 'var(--warning)', text: 'objectif menacé' }
  );
  const historyBadge = insights.vsHistoryPct !== null && (
    natureCharges
      ? { color: insights.vsHistoryPct > 0 ? 'var(--error)' : 'var(--success)' }
      : { color: insights.vsHistoryPct >= 0 ? 'var(--success)' : 'var(--warning)' }
  );

  return (
    <div className="p-4 space-y-4 bg-surface/30 rounded-lg">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-mute uppercase tracking-wide mb-2">Rythme sur la période</div>
          {insights.pace ? (
            <div className="space-y-1.5">
              <div className="text-xs text-mute">Jour {insights.pace.elapsedDays} / {insights.pace.totalDays} · {fmtPct(insights.pace.elapsedPct, 0)}</div>
              <ProgressBar value={insights.pace.elapsedPct} height={5} />
              <div className="text-sm">
                Projection fin de période : <span className="font-semibold">{fmtMAD(insights.pace.projected)}</span>
                {paceBadge && <span className="ml-2"><Badge color={paceBadge.color}>{paceBadge.text}</Badge></span>}
              </div>
            </div>
          ) : (
            <p className="text-xs text-mute">Période passée ou future — pas de rythme en cours à calculer.</p>
          )}
        </div>

        <div>
          <div className="text-xs text-mute uppercase tracking-wide mb-2">Comparaison historique</div>
          {insights.historyAvg !== null ? (
            <div className="space-y-1 text-sm">
              <div className="text-xs text-mute">Moyenne des {insights.history.length} périodes précédentes : {fmtMAD(insights.historyAvg)}</div>
              <div>
                Cette période : <span className="font-semibold">{fmtMAD(insights.reel)}</span>
                {historyBadge && (
                  <span className="ml-2">
                    <Badge color={historyBadge.color}>{insights.vsHistoryPct >= 0 ? '+' : ''}{fmtPct(insights.vsHistoryPct, 0)} vs historique</Badge>
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-mute">Pas assez d'historique sur ce compte pour comparer.</p>
          )}
        </div>
      </div>

      <div>
        <div className="text-xs text-mute uppercase tracking-wide mb-2">Répartition par libellé</div>
        {insights.topLabels.length ? (
          <ul className="space-y-1">
            {insights.topLabels.slice(0, 6).map((t) => (
              <li key={t.label} className="flex items-center justify-between text-sm gap-3">
                <span className="truncate">{t.label}{t.count > 1 && <span className="text-mute text-xs"> ×{t.count}</span>}</span>
                <span className="font-medium shrink-0">{fmtMAD(t.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-mute">Aucun mouvement sur cette période.</p>
        )}
      </div>

      {insights.anomalies.length > 0 && (
        <div>
          <div className="text-xs text-mute uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <AlertCircle size={12} className="text-warn" /> Mouvements inhabituels (nettement au-dessus de la moyenne historique)
          </div>
          <ul className="space-y-1">
            {insights.anomalies.map((a, i) => (
              <li key={i} className="flex items-center justify-between text-sm gap-3 text-warn">
                <span className="truncate">{new Date(`${a.date}T00:00:00`).toLocaleDateString('fr-FR')} · {a.label}</span>
                <span className="font-medium shrink-0">{fmtMAD(a.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Budget() {
  const { budgets, addBudget, editBudget, deleteBudget, getBudgetVariance, getBudgetAlerts, budgetAlerts, setBudgetAlertsEnabled } = useAccountingStore();
  const [refDate, setRefDate] = useState(todayISO());
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = nouveau budget, sinon id du budget édité
  const [form, setForm] = useState({ account: '621', amount: '' });
  const [periodForm, setPeriodForm] = useState(emptyPeriodForm());
  const [expandedId, setExpandedId] = useState(null);
  const overruns = getBudgetAlerts();

  const toggleAlerts = async () => {
    if (budgetAlerts.enabled) return setBudgetAlertsEnabled(false);
    if (typeof Notification === 'undefined') return;
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission === 'granted') setBudgetAlertsEnabled(true);
  };

  const variance = useMemo(() => getBudgetVariance(refDate), [getBudgetVariance, refDate, budgets]);
  const charges = variance.filter((v) => v.cls === 6);
  const produits = variance.filter((v) => v.cls === 7);

  const totBudgetCharges = charges.reduce((a, v) => a + v.amount, 0);
  const totReelCharges = charges.reduce((a, v) => a + v.reel, 0);
  const totBudgetProduits = produits.reduce((a, v) => a + v.amount, 0);
  const totReelProduits = produits.reduce((a, v) => a + v.reel, 0);
  const soldeBudgete = totBudgetProduits - totBudgetCharges;
  const soldeReel = totReelProduits - totReelCharges;

  // `${compte} ${période}` : plusieurs budgets peuvent partager le même
  // compte (voir accountingStore#addBudget), le libellé les distingue sur le graphique.
  const chartData = variance.map((v) => ({ name: `${v.account} ${periodTag(v.period)}`, Budget: v.amount, 'Réel': v.reel }));

  const openNew = () => {
    setEditingId(null);
    setForm({ account: '621', amount: '' });
    setPeriodForm(emptyPeriodForm());
    setModal(true);
  };

  const openEdit = (v) => {
    setEditingId(v.id);
    setForm({ account: v.account, amount: String(v.amount) });
    setPeriodForm(periodToPeriodForm(v.period));
    setModal(true);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!Number(form.amount) || Number(form.amount) < 0) return;
    const period = periodFormToPeriod(periodForm);
    if (editingId) editBudget(editingId, { account: form.account, amount: form.amount, period });
    else addBudget(form.account, form.amount, period);
    setModal(false);
  };

  const VarianceTable = ({ rows, title, natureCharges }) => (
    <Card title={title}>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-mute border-b border-line">
                <th className="py-2 w-6" />
                <th className="py-2 pr-3">Compte</th>
                <th className="py-2 pr-3">Période</th>
                <th className="py-2 pr-3 text-right">Budget</th>
                <th className="py-2 pr-3 text-right">Réel</th>
                <th className="py-2 pr-3 text-right">Écart</th>
                <th className="py-2 pr-3 text-right">Réalisation</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <Fragment key={v.id}>
                  <tr className="border-b border-line/40">
                    <td className="py-2 pl-1">
                      <button className="text-mute hover:text-accent cursor-pointer" onClick={() => setExpandedId(expandedId === v.id ? null : v.id)} title="Analyser ce budget">
                        {expandedId === v.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </td>
                    <td className="py-2 pr-3"><span className="text-mute text-xs mr-1">{v.account}</span>{v.label}</td>
                    <td className="py-2 pr-3">
                      <button className="text-left text-xs text-mute hover:text-accent cursor-pointer underline decoration-dotted" onClick={() => openEdit(v)} title="Modifier la période">
                        {v.periodLabel}
                      </button>
                    </td>
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
                  {expandedId === v.id && (
                    <tr className="border-b border-line/40">
                      <td colSpan={8} className="p-0 pb-3">
                        <BudgetInsightsPanel v={v} refDate={refDate} natureCharges={natureCharges} />
                      </td>
                    </tr>
                  )}
                </Fragment>
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
        <Field label="Date analysée" hint="Chaque budget applique sa propre période autour de cette date.">
          <Input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} className="w-44" />
        </Field>
        <div className="flex items-center gap-3">
          <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={toggleAlerts}>
            <span className="flex items-center gap-2">
              {budgetAlerts.enabled ? <Bell size={13} /> : <BellOff size={13} />}
              {budgetAlerts.enabled ? 'Rappels activés' : 'Activer les rappels'}
            </span>
          </Button>
          <Button onClick={openNew}>
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
        <Card title={`Budget vs Réel — au ${new Date(`${refDate}T00:00:00`).toLocaleDateString('fr-FR')}`}>
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

      <Modal open={modal} onClose={() => setModal(false)} title={editingId ? 'Modifier le budget' : 'Définir un budget'}>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Compte (charge à plafonner ou produit à viser)" hint="Plusieurs budgets peuvent coexister sur le même compte (ex : un plafond hebdo ET un plafond annuel).">
            <AccountSelect classes={[6, 7]} value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} />
          </Field>
          <Field label="Montant du plafond/objectif sur la période (DH)">
            <Input type="number" step="any" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} autoFocus />
          </Field>
          <PeriodFields value={periodForm} onChange={setPeriodForm} />
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
