import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Briefcase, Plus, Trash2, Pencil, ArrowRight, AlertTriangle, Download, UserRound, Compass, IdCard, Users, Megaphone, History, Tags, BellRing, Target, Flag } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { useCareerStore } from '../store/careerStore';
import { useNetworkingStore } from '../store/networkingStore';
import { CAREER_STAGES, DEFAULT_CAREER_DOMAINS, stageLabel, domainLabel } from '../utils/constants';
import { fmtDateShort, todayKey } from '../utils/formatters';
import { exportCareerReportPDF } from '../utils/career-report-pdf';
import { useCareerDomains } from '../hooks/useCareerDomains';
import { Card, Stat, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState } from '../components/common/ui';
import EntityFormModal from '../components/common/EntityFormModal';
import BadgeList from '../components/common/BadgeList';
import CareerProfile from '../components/career/CareerProfile';
import CareerHistory from '../components/career/CareerHistory';
import CareerPlan, { useWeeklyRoutine } from '../components/career/CareerPlan';
import Networking from './Networking';
import Content from './Content';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };
const STAGE_COLOR = {
  Applied: 'var(--text-secondary)', Screening: 'var(--accent-primary)', Interview: 'var(--warning)',
  Offer: 'var(--accent-secondary)', Accepted: 'var(--success)', Rejected: 'var(--error)', Withdrawn: 'var(--text-secondary)',
};
const OPEN_STAGES = CAREER_STAGES.filter((s) => !['Rejected', 'Withdrawn', 'Accepted'].includes(s));
const STAGE_OPTIONS = CAREER_STAGES.map((s) => ({ value: s, label: stageLabel(s) }));

const SPACES = [
  { key: 'pilotage', label: 'Pilotage', desc: 'Candidatures & prochaines actions', icon: Compass },
  { key: 'plan', label: 'Plan', desc: 'Objectifs, écarts, routine', icon: Target },
  { key: 'profil', label: 'Profil', desc: 'CV, parcours, compétences', icon: IdCard },
  { key: 'reseau', label: 'Réseau', desc: 'Contacts & relances', icon: Users },
  { key: 'visibilite', label: 'Visibilité', desc: 'Publications & marque perso', icon: Megaphone },
  { key: 'historique', label: 'Historique', desc: 'Tout votre parcours', icon: History },
];

const blank = () => ({ company: '', role: '', domain: 'Général', appliedDate: todayKey(), location: '', salary: '', url: '', notes: '', referralContactId: '', planId: '' });
// referralContactId's options depend on the live contacts list, so this is a
// function of contacts rather than a static array.
const appFields = (contacts, domainOptions, planOptions = []) => [
  { name: 'company', label: 'Entreprise', type: 'text' },
  { name: 'role', label: 'Poste', type: 'text' },
  { name: 'domain', label: 'Domaine', type: 'select', options: domainOptions },
  { name: 'appliedDate', label: 'Date de candidature', type: 'date' },
  { name: 'location', label: 'Lieu', type: 'text' },
  { name: 'salary', label: 'Salaire / rémunération', type: 'text' },
  { name: 'url', label: 'Lien annonce', type: 'text' },
  {
    name: 'referralContactId', label: 'Contact référent (Réseau)', type: 'select',
    options: [{ value: '', label: '— Aucun —' }, ...contacts.map((c) => ({ value: c.id, label: c.org ? `${c.name} · ${c.org}` : c.name }))],
    hint: "Un contact lié reçoit une relance planifiée quand la candidature avance d'étape.",
  },
  ...(planOptions.length ? [{ name: 'planId', label: 'Objectif de carrière', type: 'select', options: [{ value: '', label: '— Aucun —' }, ...planOptions] }] : []),
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

function DomainsModal({ onClose }) {
  const { domains, setDomains } = useCareerStore();
  const [text, setText] = useState((domains?.length ? domains : DEFAULT_CAREER_DOMAINS).join('\n'));
  return (
    <Modal open onClose={onClose} title="Mes domaines de carrière">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setDomains(text.split('\n')); onClose(); }}>
        <p className="text-xs text-mute">Un domaine par ligne — ils servent à classer candidatures, contacts et publications. Les domaines déjà utilisés restent disponibles.</p>
        <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex justify-between gap-2">
          <Button type="button" variant="secondary" onClick={() => setText(DEFAULT_CAREER_DOMAINS.join('\n'))}>Liste par défaut</Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
            <Button type="submit">Enregistrer</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function Pilotage() {
  const { applications, addApplication, editApplication, deleteApplication, setStage, getBadges, getStaleApplications, getConversionStats } = useCareerStore();
  const contacts = useNetworkingStore((s) => s.contacts);
  const getFollowUpAlerts = useNetworkingStore((s) => s.getFollowUpAlerts);
  const domainOptions = useCareerDomains();
  const plans = useCareerStore((s) => s.plans) || [];
  const planOptions = plans.filter((p) => p.status !== 'achieved' && p.status !== 'dropped').map((p) => ({ value: p.id, label: p.title }));
  const routine = useWeeklyRoutine();
  const today = todayKey();
  const in7 = new Date(`${today}T12:00:00`); in7.setDate(in7.getDate() + 7);
  const soon = in7.toLocaleDateString('sv-SE');
  const dueMilestones = plans.filter((p) => p.status !== 'achieved' && p.status !== 'dropped')
    .flatMap((p) => (p.milestones || []).filter((m) => !m.done && m.due && m.due <= soon).map((m) => ({ ...m, plan: p })))
    .sort((a, b) => a.due.localeCompare(b.due));
  const navigate = useNavigate();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank());
  const [view, setView] = useState('kanban');

  const byStage = useMemo(() => CAREER_STAGES.map((s) => ({ name: stageLabel(s), key: s, count: applications.filter((a) => a.stage === s).length })).filter((s) => s.count > 0), [applications]);
  const active = applications.filter((a) => OPEN_STAGES.includes(a.stage));
  const offers = applications.filter((a) => a.stage === 'Offer' || a.stage === 'Accepted').length;
  const stale = useMemo(() => getStaleApplications(), [applications]); // eslint-disable-line react-hooks/exhaustive-deps
  const followUps = useMemo(() => getFollowUpAlerts(7), [contacts]); // eslint-disable-line react-hooks/exhaustive-deps
  const conversion = useMemo(() => getConversionStats(), [applications]); // eslint-disable-line react-hooks/exhaustive-deps
  const contactName = (id) => contacts.find((c) => c.id === id)?.name;

  const submit = (e) => {
    e.preventDefault();
    const res = addApplication(form);
    if (!res.ok) return alert(res.error);
    setModal(false);
    setForm(blank());
  };
  const advance = (app) => setStage(app.id, CAREER_STAGES[CAREER_STAGES.indexOf(app.stage) + 1]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {applications.length > 0 && (
          <Button variant="secondary" onClick={() => exportCareerReportPDF(applications, conversion)}><span className="flex items-center gap-2"><Download size={16} /> Rapport PDF</span></Button>
        )}
        <Button onClick={() => setModal(true)}><span className="flex items-center gap-2"><Plus size={16} /> Nouvelle candidature</span></Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Candidatures" value={applications.length} />
        <Stat label="En cours" value={active.length} />
        <Stat label="Candidature → entretien" value={`${conversion.appliedToInterviewPct}%`} sub={`${conversion.interview}/${conversion.applied}`} />
        <Stat label="Offres" value={offers} color={offers ? 'var(--success)' : undefined} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {routine.map((r) => (
          <button key={r.key} onClick={() => navigate('/career?tab=plan')} className="text-left rounded-xl border border-line bg-card px-3 py-2 cursor-pointer hover:border-accent">
            <div className="text-[11px] text-mute">{r.label} cette semaine</div>
            <div className="text-lg font-bold tabular-nums" style={{ color: r.done >= r.target && r.target ? 'var(--success)' : undefined }}>{r.done}<span className="text-sm text-mute font-normal">/{r.target}</span></div>
          </button>
        ))}
      </div>

      {(stale.length > 0 || followUps.length > 0 || dueMilestones.length > 0) && (
        <Card title="Prochaines actions">
          <div className="space-y-1.5">
            {dueMilestones.map((m) => (
              <button key={`m-${m.id}`} onClick={() => navigate('/career?tab=plan')}
                className={`w-full text-left flex items-center gap-2 text-sm rounded-lg px-3 py-2 cursor-pointer border ${m.due < today ? 'border-bad/40 bg-bad/5' : 'border-line'}`}>
                <Flag size={14} className={m.due < today ? 'text-bad' : 'text-accent'} />
                <span className="flex-1"><b>{m.title}</b> <span className="text-mute">— {m.plan.title}</span></span>
                <span className="text-xs text-mute">{m.due < today ? 'en retard' : fmtDateShort(m.due)}</span>
              </button>
            ))}
            {followUps.map(({ contact, overdue }) => (
              <button key={`f-${contact.id}`} onClick={() => navigate(`/career?tab=reseau&contact=${contact.id}`)}
                className={`w-full text-left flex items-center gap-2 text-sm rounded-lg px-3 py-2 cursor-pointer border ${overdue ? 'border-bad/40 bg-bad/5' : 'border-line'}`}>
                <BellRing size={14} className={overdue ? 'text-bad' : 'text-accent'} />
                <span className="flex-1">Relancer <b>{contact.name}</b>{contact.org ? ` (${contact.org})` : ''}</span>
                <span className="text-xs text-mute">{overdue ? 'en retard' : fmtDateShort(contact.nextFollowUpDate)}</span>
              </button>
            ))}
            {stale.map(({ app, lastMoveDate }) => (
              <button key={`s-${app.id}`} onClick={() => setEditing(app)} className="w-full text-left flex items-center gap-2 text-sm rounded-lg px-3 py-2 cursor-pointer border border-warn/40 bg-warn/5">
                <AlertTriangle size={14} className="text-warn" />
                <span className="flex-1">Relancer ou clôturer <b>{app.role}</b> @ {app.company}</span>
                <span className="text-xs text-mute">« {stageLabel(app.stage)} » depuis {fmtDateShort(lastMoveDate)}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {byStage.length > 1 && (
        <Card title="Candidatures par étape">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byStage}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" name="Candidatures" radius={[4, 4, 0, 0]}>
                {byStage.map((s) => <Cell key={s.key} fill={STAGE_COLOR[s.key]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="flex gap-1 border-b border-line">
        {[{ key: 'kanban', label: 'Tableau' }, { key: 'list', label: 'Liste' }].map((t) => (
          <button key={t.key} onClick={() => setView(t.key)} className={`px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px cursor-pointer transition-colors ${view === t.key ? 'text-accent border-accent' : 'text-mute border-transparent hover:text-ink'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {view === 'kanban' ? (
        applications.length ? (
          <div className="grid md:grid-cols-4 gap-3 overflow-x-auto">
            {CAREER_STAGES.filter((s) => s !== 'Withdrawn').map((stage) => {
              const items = applications.filter((a) => a.stage === stage);
              if (!items.length && !OPEN_STAGES.includes(stage)) return null;
              return (
                <div key={stage} className="min-w-[220px]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: STAGE_COLOR[stage] }} />
                    <span className="text-xs font-semibold text-mute uppercase tracking-wide">{stageLabel(stage)}</span>
                    <span className="text-xs text-mute">({items.length})</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((a) => (
                      <div key={a.id} className="bg-card border border-line rounded-lg p-3 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium">{a.role}</div>
                            <div className="text-xs text-mute">{a.company}</div>
                          </div>
                          <button className="text-mute hover:text-accent cursor-pointer shrink-0" onClick={() => setEditing(a)}><Pencil size={12} /></button>
                        </div>
                        <div className="text-[11px] text-mute mt-1.5">{fmtDateShort(a.appliedDate)} · {domainLabel(a.domain)}</div>
                        {a.referralContactId && contactName(a.referralContactId) && (
                          <button className="flex items-center gap-1 text-[11px] text-accent hover:underline cursor-pointer mt-1" onClick={() => navigate(`/career?tab=reseau&contact=${a.referralContactId}`)} title="Ouvrir le contact référent">
                            <UserRound size={10} /> {contactName(a.referralContactId)}
                          </button>
                        )}
                        {OPEN_STAGES.includes(a.stage) && (
                          <button className="mt-2 flex items-center gap-1 text-xs text-accent hover:underline cursor-pointer" onClick={() => advance(a)}>
                            Étape suivante : {stageLabel(CAREER_STAGES[CAREER_STAGES.indexOf(a.stage) + 1])} <ArrowRight size={11} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Card><EmptyState><Briefcase className="mx-auto mb-2 text-mute" size={26} />Aucune candidature. Ajoutez la première — stage, PFE, alternance ou emploi.</EmptyState></Card>
        )
      ) : (
        <Card title={`Candidatures (${applications.length})`}>
          {applications.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-mute border-b border-line">
                    <th className="py-2 pr-4">Entreprise</th><th className="py-2 pr-4">Poste</th><th className="py-2 pr-4">Domaine</th>
                    <th className="py-2 pr-4">Étape</th><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Référent</th><th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {[...applications].sort((a, b) => b.updatedAt - a.updatedAt).map((a) => (
                    <tr key={a.id} className="border-b border-line/50 hover:bg-surface/50">
                      <td className="py-2.5 pr-4">{a.company}</td>
                      <td className="py-2.5 pr-4 text-mute">{a.role}</td>
                      <td className="py-2.5 pr-4"><Badge>{domainLabel(a.domain)}</Badge></td>
                      <td className="py-2.5 pr-4"><Select value={a.stage} onChange={(e) => setStage(a.id, e.target.value)} options={STAGE_OPTIONS} className="!py-1 !px-2 text-xs w-32" /></td>
                      <td className="py-2.5 pr-4 text-mute">{fmtDateShort(a.appliedDate)}</td>
                      <td className="py-2.5 pr-4">
                        {a.referralContactId && contactName(a.referralContactId) ? (
                          <button className="flex items-center gap-1 text-xs text-accent hover:underline cursor-pointer" onClick={() => navigate(`/career?tab=reseau&contact=${a.referralContactId}`)}>
                            <UserRound size={11} /> {contactName(a.referralContactId)}
                          </button>
                        ) : <span className="text-mute text-xs">—</span>}
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        <button className="text-mute hover:text-accent mr-3 cursor-pointer" onClick={() => setEditing(a)}><Pencil size={14} /></button>
                        <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Supprimer "${a.role} @ ${a.company}" ?`)) deleteApplication(a.id); }}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState>Aucune candidature.</EmptyState>}
        </Card>
      )}

      <BadgeList badges={getBadges()} />

      <Modal open={modal} onClose={() => setModal(false)} title="Nouvelle candidature">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Entreprise"><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} autoFocus /></Field>
            <Field label="Poste"><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="ex. Stage analyste M&A" /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Domaine"><Select value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} options={domainOptions} /></Field>
            <Field label="Date"><Input type="date" value={form.appliedDate} onChange={(e) => setForm({ ...form, appliedDate: e.target.value })} /></Field>
            <Field label="Lieu"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Salaire / rémunération"><Input value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} /></Field>
            <Field label="Lien annonce"><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></Field>
          </div>
          <Field label="Contact référent (Réseau)"
            hint={contacts.some((c) => c.org && form.company && c.org.toLowerCase() === form.company.toLowerCase()) ? '💡 Contact(s) chez cette entreprise en tête de liste.' : "Un contact lié reçoit une relance planifiée quand la candidature avance d'étape."}>
            <Select value={form.referralContactId} onChange={(e) => setForm({ ...form, referralContactId: e.target.value })}
              options={[
                { value: '', label: '— Aucun —' },
                ...[...contacts].sort((a, b) => {
                  const aMatch = a.org && form.company && a.org.toLowerCase() === form.company.toLowerCase();
                  const bMatch = b.org && form.company && b.org.toLowerCase() === form.company.toLowerCase();
                  return aMatch === bMatch ? 0 : aMatch ? -1 : 1;
                }).map((c) => ({ value: c.id, label: c.org ? `${c.name} · ${c.org}` : c.name })),
              ]} />
          </Field>
          {planOptions.length > 0 && (
            <Field label="Objectif de carrière servi par cette candidature">
              <Select value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })} options={[{ value: '', label: '— Aucun —' }, ...planOptions]} />
            </Field>
          )}
          <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button type="submit">Créer</Button>
          </div>
        </form>
      </Modal>

      {editing && (
        <EntityFormModal open={!!editing} onClose={() => setEditing(null)} title="Modifier la candidature" fields={appFields(contacts, domainOptions, planOptions)}
          initial={editing} wide onSave={(values) => editApplication(editing.id, values)} onDelete={() => deleteApplication(editing.id)} />
      )}
    </div>
  );
}

export default function Career({ initialTab }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [space, setSpace] = useState(() => (SPACES.some((s) => s.key === tabParam) ? tabParam : initialTab || 'pilotage'));
  const [domainsOpen, setDomainsOpen] = useState(false);

  useEffect(() => { if (tabParam && tabParam !== space && SPACES.some((s) => s.key === tabParam)) setSpace(tabParam); }, [tabParam]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (searchParams.get('tab') !== space) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', space);
      if (space !== 'reseau') next.delete('contact');
      setSearchParams(next, { replace: true });
    }
  }, [space]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Carrière</h1>
          <p className="text-mute text-sm mt-1">Candidatures, profil, réseau et visibilité — votre progression professionnelle au même endroit.</p>
        </div>
        <Button variant="secondary" onClick={() => setDomainsOpen(true)}><span className="flex items-center gap-1.5"><Tags size={15} /> Domaines</span></Button>
      </div>

      <nav className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 rounded-2xl border border-line bg-surface p-1.5" aria-label="Espaces carrière">
        {SPACES.map((sp) => {
          const Icon = sp.icon;
          const active = sp.key === space;
          return (
            <button key={sp.key} onClick={() => setSpace(sp.key)} aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-1.5 py-2.5 text-center transition-colors cursor-pointer sm:flex-row sm:gap-2.5 sm:px-3 sm:text-left ${active ? 'bg-card text-ink shadow-sm ring-1 ring-line' : 'text-mute hover:bg-card/50 hover:text-ink'}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-accent/15 text-accent' : 'bg-card/60'}`}><Icon size={17} /></span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold sm:text-sm">{sp.label}</span>
                <span className="hidden truncate text-[11px] text-mute lg:block">{sp.desc}</span>
              </span>
            </button>
          );
        })}
      </nav>

      {space === 'pilotage' && <Pilotage />}
      {space === 'plan' && <CareerPlan />}
      {space === 'profil' && <CareerProfile />}
      {space === 'reseau' && <Networking embedded />}
      {space === 'visibilite' && <Content embedded />}
      {space === 'historique' && <CareerHistory />}
      {domainsOpen && <DomainsModal onClose={() => setDomainsOpen(false)} />}
    </div>
  );
}
