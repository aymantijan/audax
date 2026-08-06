import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Pencil, Lightbulb, CheckCircle2, Target, Landmark,
  LayoutList, TrendingUp, BookOpen, GanttChartSquare,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useBusinessStore } from '../../store/businessStore';
import GanttTab from './GanttChart';
import { BUSINESS_CHART_OF_ACCOUNTS, BUSINESS_ACCOUNT_CLASSES, BUSINESS_ENTRY_TEMPLATES } from '../../utils/business-accounts';
import { fmtMAD, fmtDate, todayKey } from '../../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Modal, Badge, EmptyState } from '../../components/common/ui';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

const PHASE_STATUS = [
  { value: 'upcoming', label: 'À venir', color: 'var(--text-secondary)' },
  { value: 'active', label: 'En cours', color: 'var(--warning)' },
  { value: 'done', label: 'Terminée', color: 'var(--success)' },
];
const STATUS_OPTIONS = [
  { value: 'idea', label: 'Idée' },
  { value: 'active', label: 'Actif' },
  { value: 'paused', label: 'En pause' },
  { value: 'closed', label: 'Clôturé' },
];

// Sélecteur de compte "business" — plus simple que Finance's AccountSelect
// (pas de comptes auxiliaires de trésorerie pour une compta "très simplifiée").
function BizAccountSelect({ value, onChange, classes }) {
  const allowed = classes?.length ? BUSINESS_CHART_OF_ACCOUNTS.filter((a) => classes.includes(a.cls)) : BUSINESS_CHART_OF_ACCOUNTS;
  const byClass = {};
  for (const a of allowed) (byClass[a.cls] ??= []).push(a);
  return (
    <Select value={value} onChange={onChange}>
      {Object.entries(byClass).map(([cls, accounts]) => (
        <optgroup key={cls} label={`Classe ${cls} — ${BUSINESS_ACCOUNT_CLASSES[cls].label}`}>
          {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.label}</option>)}
        </optgroup>
      ))}
    </Select>
  );
}

// Timeline horizontale proportionnelle : les phases en bandes, les événements
// (idées/faits) en points, positionnés sur un axe temporel commun.
function Timeline({ business }) {
  const allDates = [
    ...business.phases.flatMap((p) => [p.startDate, p.endDate].filter(Boolean)),
    ...business.events.map((e) => e.date),
  ].filter(Boolean).sort();

  if (!allDates.length) {
    return <EmptyState>Ajoutez des phases ou des événements (idées/faits) pour voir apparaître la timeline.</EmptyState>;
  }

  const minT = new Date(allDates[0] + 'T00:00:00').getTime();
  const maxT = new Date(allDates[allDates.length - 1] + 'T00:00:00').getTime();
  const span = Math.max(1, maxT - minT);
  const pct = (d) => ((new Date(d + 'T00:00:00').getTime() - minT) / span) * 100;
  const sortedEvents = [...business.events].sort((a, b) => (a.date < b.date ? -1 : 1));

  return (
    <div className="space-y-5">
      {business.phases.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-mute uppercase tracking-wide">Phases</div>
          {[...business.phases].sort((a, b) => a.order - b.order).map((p) => {
            const start = p.startDate || allDates[0];
            const end = p.endDate || start;
            const left = pct(start);
            const width = Math.max(1.5, pct(end) - left);
            const color = PHASE_STATUS.find((s) => s.value === p.status)?.color;
            return (
              <div key={p.id} className="flex items-center gap-3">
                <span className="text-xs w-32 truncate shrink-0" title={p.name}>{p.name}</span>
                <div className="flex-1 h-5 bg-surface border border-line rounded-full relative overflow-hidden">
                  <div className="absolute top-0 bottom-0 rounded-full" style={{ left: `${left}%`, width: `${width}%`, background: color }} title={`${p.startDate || '—'} → ${p.endDate || 'en cours'}`} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sortedEvents.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-xs text-mute uppercase tracking-wide">Idées & faits</div>
            <div className="flex items-center gap-3 text-[10px] text-mute">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent inline-block" /> Idée</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--success)' }} /> Fait</span>
            </div>
          </div>
          <div className="relative h-6 bg-surface border border-line rounded-full">
            {sortedEvents.map((e) => (
              <div key={e.id} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${pct(e.date)}%` }} title={`${e.date} · ${e.title}`}>
                <div className="w-3 h-3 rounded-full border-2 border-card" style={{ background: e.type === 'idea' ? 'var(--accent-primary)' : 'var(--success)' }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-mute mt-1">
            <span>{fmtDate(allDates[0])}</span>
            <span>{fmtDate(allDates[allDates.length - 1])}</span>
          </div>
        </div>
      )}
    </div>
  );
}

const blankPhase = () => ({ name: '', startDate: todayKey(), endDate: '', status: 'upcoming', notes: '' });
const blankEvent = () => ({ type: 'idea', title: '', description: '', date: todayKey(), phaseId: '' });
const blankKpi = () => ({ name: '', unit: '', target: '' });

export default function BusinessDetail() {
  const { id } = useParams();
  const store = useBusinessStore();
  const business = store.getBusiness(id);
  const [tab, setTab] = useState('overview');

  const [phaseModal, setPhaseModal] = useState(false);
  const [editingPhase, setEditingPhase] = useState(null);
  const [phaseForm, setPhaseForm] = useState(blankPhase());

  const [eventModal, setEventModal] = useState(false);
  const [eventForm, setEventForm] = useState(blankEvent());

  const [kpiModal, setKpiModal] = useState(false);
  const [kpiForm, setKpiForm] = useState(blankKpi());
  const [kpiLogValues, setKpiLogValues] = useState({}); // { [kpiId]: { date, value } }

  const [entryModal, setEntryModal] = useState(false);
  const [templateId, setTemplateId] = useState('expense');
  const tpl = BUSINESS_ENTRY_TEMPLATES.find((t) => t.id === templateId);
  const [entryForm, setEntryForm] = useState({ date: todayKey(), label: '', amount: '', debitAccount: '511', creditAccount: '611' });

  if (!business) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card><EmptyState>Business introuvable. <Link to="/deals" className="text-accent">Retour à Deals</Link></EmptyState></Card>
      </div>
    );
  }

  const openAddPhase = () => { setEditingPhase(null); setPhaseForm(blankPhase()); setPhaseModal(true); };
  const openEditPhase = (p) => { setEditingPhase(p); setPhaseForm({ name: p.name, startDate: p.startDate || '', endDate: p.endDate || '', status: p.status, notes: p.notes || '' }); setPhaseModal(true); };
  const submitPhase = (e) => {
    e.preventDefault();
    if (!phaseForm.name.trim()) return;
    if (editingPhase) store.editPhase(business.id, editingPhase.id, phaseForm);
    else store.addPhase(business.id, phaseForm);
    setPhaseModal(false);
  };

  const openAddEvent = (type) => { setEventForm({ ...blankEvent(), type }); setEventModal(true); };
  const submitEvent = (e) => {
    e.preventDefault();
    const res = store.addEvent(business.id, eventForm);
    if (!res.ok) return alert(res.error);
    setEventModal(false);
  };

  const openAddKpi = () => { setKpiForm(blankKpi()); setKpiModal(true); };
  const submitKpi = (e) => {
    e.preventDefault();
    const res = store.addKpi(business.id, kpiForm);
    if (!res.ok) return alert(res.error);
    setKpiModal(false);
  };
  const submitKpiLog = (kpiId) => {
    const v = kpiLogValues[kpiId] || {};
    if (v.value === undefined || v.value === '') return;
    store.logKpiValue(business.id, kpiId, v.date || todayKey(), v.value);
    setKpiLogValues({ ...kpiLogValues, [kpiId]: { date: todayKey(), value: '' } });
  };

  const pickTemplate = (id) => {
    const t = BUSINESS_ENTRY_TEMPLATES.find((x) => x.id === id);
    setTemplateId(id);
    setEntryForm((f) => ({ ...f, debitAccount: t.debit.default, creditAccount: t.credit.default }));
  };
  const submitEntry = (e) => {
    e.preventDefault();
    const amount = Number(entryForm.amount);
    if (!amount || amount <= 0 || !entryForm.label.trim()) return alert('Libellé et montant requis.');
    const res = store.addEntry(business.id, {
      date: entryForm.date,
      label: entryForm.label,
      lines: [{ account: entryForm.debitAccount, debit: amount, credit: 0 }, { account: entryForm.creditAccount, debit: 0, credit: amount }],
    });
    if (!res.ok) return alert(res.error);
    setEntryModal(false);
    setEntryForm({ date: todayKey(), label: '', amount: '', debitAccount: tpl.debit.default, creditAccount: tpl.credit.default });
  };

  const bs = store.getBalanceSheet(business.id);
  const cpcData = store.getCPC(business.id, todayKey().slice(0, 7));
  const treso = store.getTreasuryBalance(business.id);

  const TABS = [
    { key: 'overview', label: 'Vue d\'ensemble', icon: LayoutList },
    { key: 'phases', label: 'Phases', icon: Target },
    { key: 'gantt', label: 'Gantt', icon: GanttChartSquare },
    { key: 'events', label: 'Idées & Faits', icon: Lightbulb },
    { key: 'kpis', label: 'KPIs', icon: TrendingUp },
    { key: 'accounting', label: 'Comptabilité', icon: Landmark },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Link to="/deals" className="flex items-center gap-1.5 text-sm text-mute hover:text-ink w-fit">
        <ArrowLeft size={14} /> Deals
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{business.name}</h1>
            <Badge>{STATUS_OPTIONS.find((s) => s.value === business.status)?.label}</Badge>
          </div>
          {business.sector && <p className="text-mute text-sm mt-1">{business.sector}</p>}
          {business.description && <p className="text-sm mt-1">{business.description}</p>}
        </div>
        <Select value={business.status} onChange={(e) => store.editBusiness(business.id, { status: e.target.value })} options={STATUS_OPTIONS} className="w-36" />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => {
          const Icon = t.icon;
          const activeTab = t.key === tab;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${activeTab ? 'text-accent border-accent' : 'text-mute border-transparent hover:text-ink'}`}>
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Phases" value={`${business.phases.filter((p) => p.status === 'done').length}/${business.phases.length}`} sub="franchies" />
            <Stat label="Tâches" value={`${(business.tasks || []).filter((t) => t.status === 'done').length}/${(business.tasks || []).length}`} sub="terminées" />
            <Stat label="Événements" value={business.events.length} sub={`${business.events.filter((e) => e.type === 'idea').length} idées · ${business.events.filter((e) => e.type === 'fact').length} faits`} />
            <Stat label="Trésorerie" value={fmtMAD(treso)} color={treso >= 0 ? undefined : 'var(--error)'} />
            <Stat label="KPIs suivis" value={business.kpis.length} />
          </div>
          <Card title="Timeline">
            <Timeline business={business} />
          </Card>
        </div>
      )}

      {tab === 'phases' && (
        <Card title="Phases" action={<Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={openAddPhase}><span className="flex items-center gap-2"><Plus size={13} /> Phase</span></Button>}>
          {business.phases.length ? (
            <ul className="space-y-1.5">
              {[...business.phases].sort((a, b) => a.order - b.order).map((p) => (
                <li key={p.id} className="flex items-center gap-3 bg-surface border border-line rounded-lg px-3 py-2.5 text-sm flex-wrap">
                  <Badge color={PHASE_STATUS.find((s) => s.value === p.status)?.color}>{PHASE_STATUS.find((s) => s.value === p.status)?.label}</Badge>
                  <span className="flex-1 min-w-[8rem]">{p.name}</span>
                  <span className="text-mute text-xs">{p.startDate ? fmtDate(p.startDate) : '—'} → {p.endDate ? fmtDate(p.endDate) : '…'}</span>
                  <Select value={p.status} onChange={(e) => store.editPhase(business.id, p.id, { status: e.target.value })} options={PHASE_STATUS} className="!py-1 !px-2 text-xs w-32" />
                  <button className="text-mute hover:text-accent cursor-pointer" onClick={() => openEditPhase(p)} title="Modifier"><Pencil size={13} /></button>
                  <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Supprimer la phase "${p.name}" ?`)) store.deletePhase(business.id, p.id); }} title="Supprimer"><Trash2 size={13} /></button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Aucune phase. Définissez les grandes étapes de ce business (ex : Idéation, Validation, Lancement, Croissance).</EmptyState>
          )}
        </Card>
      )}

      {tab === 'gantt' && <GanttTab business={business} store={store} />}

      {tab === 'events' && (
        <div className="space-y-6">
          <div className="flex gap-2">
            <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => openAddEvent('idea')}><span className="flex items-center gap-2"><Lightbulb size={13} /> Nouvelle idée</span></Button>
            <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => openAddEvent('fact')}><span className="flex items-center gap-2"><CheckCircle2 size={13} /> Nouveau fait</span></Button>
          </div>
          <Card title={`Journal (${business.events.length})`}>
            {business.events.length ? (
              <ul className="space-y-1.5">
                {[...business.events].sort((a, b) => (a.date < b.date ? 1 : -1)).map((e) => (
                  <li key={e.id} className="flex items-start gap-3 bg-surface border border-line rounded-lg px-3 py-2.5 text-sm">
                    {e.type === 'idea' ? <Lightbulb size={15} className="text-accent shrink-0 mt-0.5" /> : <CheckCircle2 size={15} className="shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{e.title}</div>
                      {e.description && <div className="text-xs text-mute mt-0.5">{e.description}</div>}
                    </div>
                    <span className="text-mute text-xs whitespace-nowrap">{fmtDate(e.date)}</span>
                    <button className="text-mute hover:text-bad cursor-pointer" onClick={() => store.deleteEvent(business.id, e.id)}><Trash2 size={13} /></button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>Aucun événement. Loggez une idée ou un fait pour construire la timeline.</EmptyState>
            )}
          </Card>
        </div>
      )}

      {tab === 'kpis' && (
        <div className="space-y-6">
          <Card title="KPIs" action={<Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={openAddKpi}><span className="flex items-center gap-2"><Plus size={13} /> KPI</span></Button>}>
            {business.kpis.length ? (
              <div className="grid md:grid-cols-2 gap-4">
                {business.kpis.map((k) => {
                  const series = store.getKpiSeries(business.id, k.id);
                  const latest = series[series.length - 1];
                  return (
                    <div key={k.id} className="bg-surface border border-line rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{k.name}</span>
                        <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Supprimer le KPI "${k.name}" ?`)) store.deleteKpi(business.id, k.id); }}><Trash2 size={13} /></button>
                      </div>
                      <div className="text-xl font-bold mb-2">{latest ? latest.value : '—'} <span className="text-xs text-mute font-normal">{k.unit}</span>{k.target != null && <span className="text-xs text-mute font-normal"> / {k.target} cible</span>}</div>
                      {series.length > 1 && (
                        <ResponsiveContainer width="100%" height={100}>
                          <LineChart data={series}>
                            <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 9 }} tickFormatter={(d) => d.slice(5)} />
                            <YAxis hide domain={['auto', 'auto']} />
                            <Tooltip {...tooltipStyle} />
                            <Line type="monotone" dataKey="value" stroke="#00d9ff" strokeWidth={2} dot={{ r: 2 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                      <div className="flex gap-2 mt-2">
                        <Input type="date" value={kpiLogValues[k.id]?.date || todayKey()} onChange={(e) => setKpiLogValues({ ...kpiLogValues, [k.id]: { ...kpiLogValues[k.id], date: e.target.value } })} className="!py-1 !px-2 text-xs flex-1" />
                        <Input type="number" placeholder="valeur" value={kpiLogValues[k.id]?.value ?? ''} onChange={(e) => setKpiLogValues({ ...kpiLogValues, [k.id]: { ...kpiLogValues[k.id], value: e.target.value } })} className="!py-1 !px-2 text-xs w-24" />
                        <Button variant="secondary" className="!px-2.5 !py-1 text-xs" onClick={() => submitKpiLog(k.id)}>Log</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState>Aucun KPI. Ajoutez ce que vous voulez suivre (CA mensuel, clients actifs, taux de conversion…).</EmptyState>
            )}
          </Card>
        </div>
      )}

      {tab === 'accounting' && (
        <div className="space-y-6">
          <p className="text-xs text-mute -mt-2">Comptabilité générale marocaine très simplifiée, en partie double — isolée pour ce business.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Trésorerie" value={fmtMAD(treso)} color={treso >= 0 ? undefined : 'var(--error)'} />
            <Stat label="Actif total" value={fmtMAD(bs.actif.total)} />
            <Stat label="Produits (mois)" value={fmtMAD(cpcData.produitsCourants)} color="var(--success)" />
            <Stat label="Charges (mois)" value={fmtMAD(cpcData.chargesCourantes)} />
          </div>
          <Button onClick={() => setEntryModal(true)}><span className="flex items-center gap-2"><BookOpen size={15} /> Nouvelle écriture</span></Button>
          <Card title={`Journal (${business.journal.length})`}>
            {business.journal.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-mute border-b border-line">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Libellé</th>
                      <th className="py-2 pr-3">Lignes</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {[...business.journal].sort((a, b) => (a.date < b.date ? 1 : -1)).map((e) => (
                      <tr key={e.id} className="border-b border-line/40">
                        <td className="py-2 pr-3 whitespace-nowrap">{e.date}</td>
                        <td className="py-2 pr-3">{e.label}</td>
                        <td className="py-2 pr-3 text-xs text-mute">
                          {e.lines.map((l, i) => (
                            <div key={i}>{l.account} {l.debit ? `D ${fmtMAD(l.debit)}` : `C ${fmtMAD(l.credit)}`}</div>
                          ))}
                        </td>
                        <td className="py-2 text-right">
                          <button className="text-mute hover:text-bad cursor-pointer" onClick={() => store.deleteEntry(business.id, e.id)}><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState>Aucune écriture. Enregistrez le premier encaissement ou la première charge.</EmptyState>
            )}
          </Card>
        </div>
      )}

      {/* ── Modals ── */}
      <Modal open={phaseModal} onClose={() => setPhaseModal(false)} title={editingPhase ? 'Modifier la phase' : 'Nouvelle phase'}>
        <form onSubmit={submitPhase} className="space-y-3">
          <Field label="Nom">
            <Input value={phaseForm.name} onChange={(e) => setPhaseForm({ ...phaseForm, name: e.target.value })} placeholder="ex : Validation du marché" autoFocus />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Début">
              <Input type="date" value={phaseForm.startDate} onChange={(e) => setPhaseForm({ ...phaseForm, startDate: e.target.value })} />
            </Field>
            <Field label="Fin (optionnel)">
              <Input type="date" value={phaseForm.endDate} onChange={(e) => setPhaseForm({ ...phaseForm, endDate: e.target.value })} />
            </Field>
            <Field label="Statut">
              <Select value={phaseForm.status} onChange={(e) => setPhaseForm({ ...phaseForm, status: e.target.value })} options={PHASE_STATUS} />
            </Field>
          </div>
          <Field label="Notes (optionnel)">
            <Input value={phaseForm.notes} onChange={(e) => setPhaseForm({ ...phaseForm, notes: e.target.value })} />
          </Field>
          <div className="flex justify-between gap-3 pt-2 border-t border-line">
            {editingPhase ? (
              <Button type="button" variant="danger" onClick={() => { store.deletePhase(business.id, editingPhase.id); setPhaseModal(false); }}><span className="flex items-center gap-2"><Trash2 size={14} /> Supprimer</span></Button>
            ) : <span />}
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setPhaseModal(false)}>Annuler</Button>
              <Button type="submit">{editingPhase ? 'Enregistrer' : 'Créer'}</Button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal open={eventModal} onClose={() => setEventModal(false)} title={eventForm.type === 'idea' ? 'Nouvelle idée' : 'Nouveau fait'}>
        <form onSubmit={submitEvent} className="space-y-3">
          <div className="flex gap-2">
            {[{ value: 'idea', label: 'Idée' }, { value: 'fact', label: 'Fait' }].map((t) => (
              <button key={t.value} type="button" onClick={() => setEventForm({ ...eventForm, type: t.value })} className={`px-3 py-1.5 rounded-lg text-xs border cursor-pointer ${eventForm.type === t.value ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute'}`}>{t.label}</button>
            ))}
          </div>
          <Field label="Titre">
            <Input value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} placeholder={eventForm.type === 'idea' ? 'ex : Ajouter une offre en abonnement' : 'ex : Premier client signé'} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <Input type="date" value={eventForm.date} onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })} />
            </Field>
            <Field label="Phase liée (optionnel)">
              <Select value={eventForm.phaseId} onChange={(e) => setEventForm({ ...eventForm, phaseId: e.target.value })} options={[{ value: '', label: '—' }, ...business.phases.map((p) => ({ value: p.id, label: p.name }))]} />
            </Field>
          </div>
          <Field label="Description (optionnel)">
            <Input value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setEventModal(false)}>Annuler</Button>
            <Button type="submit">Enregistrer</Button>
          </div>
        </form>
      </Modal>

      <Modal open={kpiModal} onClose={() => setKpiModal(false)} title="Nouveau KPI">
        <form onSubmit={submitKpi} className="space-y-3">
          <Field label="Nom">
            <Input value={kpiForm.name} onChange={(e) => setKpiForm({ ...kpiForm, name: e.target.value })} placeholder="ex : Chiffre d'affaires mensuel" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unité (optionnel)">
              <Input value={kpiForm.unit} onChange={(e) => setKpiForm({ ...kpiForm, unit: e.target.value })} placeholder="ex : DH, clients, %" />
            </Field>
            <Field label="Cible (optionnel)">
              <Input type="number" value={kpiForm.target} onChange={(e) => setKpiForm({ ...kpiForm, target: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setKpiModal(false)}>Annuler</Button>
            <Button type="submit">Créer</Button>
          </div>
        </form>
      </Modal>

      <Modal open={entryModal} onClose={() => setEntryModal(false)} title="Nouvelle écriture">
        <form onSubmit={submitEntry} className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {BUSINESS_ENTRY_TEMPLATES.map((t) => (
              <button key={t.id} type="button" onClick={() => pickTemplate(t.id)} className={`px-3 py-1.5 rounded-lg text-xs border cursor-pointer ${t.id === templateId ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute'}`}>{t.label}</button>
            ))}
          </div>
          <p className="text-xs text-mute">{tpl.hint}</p>
          <Field label="Libellé">
            <Input value={entryForm.label} onChange={(e) => setEntryForm({ ...entryForm, label: e.target.value })} placeholder={tpl.label} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <Input type="date" value={entryForm.date} onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })} />
            </Field>
            <Field label="Montant (DH)">
              <Input type="number" step="any" min="0" value={entryForm.amount} onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Débit — ${tpl.debit.role}`}>
              <BizAccountSelect classes={tpl.debit.classes} value={entryForm.debitAccount} onChange={(e) => setEntryForm({ ...entryForm, debitAccount: e.target.value })} />
            </Field>
            <Field label={`Crédit — ${tpl.credit.role}`}>
              <BizAccountSelect classes={tpl.credit.classes} value={entryForm.creditAccount} onChange={(e) => setEntryForm({ ...entryForm, creditAccount: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setEntryModal(false)}>Annuler</Button>
            <Button type="submit">Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
