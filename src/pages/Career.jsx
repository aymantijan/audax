import { useMemo, useState } from 'react';
import { Briefcase, Plus, Trash2, Pencil, ArrowRight } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { useCareerStore } from '../store/careerStore';
import { CAREER_STAGES, LIFE_DOMAINS } from '../utils/constants';
import { fmtDateShort, todayKey } from '../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState } from '../components/common/ui';
import EntityFormModal from '../components/common/EntityFormModal';
import BadgeList from '../components/common/BadgeList';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };
const STAGE_COLOR = {
  Applied: 'var(--text-secondary)', Screening: 'var(--accent-primary)', Interview: 'var(--warning)',
  Offer: 'var(--accent-secondary)', Accepted: 'var(--success)', Rejected: 'var(--error)', Withdrawn: 'var(--text-secondary)',
};
const OPEN_STAGES = CAREER_STAGES.filter((s) => !['Rejected', 'Withdrawn', 'Accepted'].includes(s));

const blank = () => ({ company: '', role: '', domain: 'General', appliedDate: todayKey(), location: '', salary: '', url: '', notes: '' });
const appFields = [
  { name: 'company', label: 'Entreprise', type: 'text' },
  { name: 'role', label: 'Rôle', type: 'text' },
  { name: 'domain', label: 'Domaine', type: 'select', options: LIFE_DOMAINS },
  { name: 'appliedDate', label: 'Date de candidature', type: 'date' },
  { name: 'location', label: 'Lieu', type: 'text' },
  { name: 'salary', label: 'Salaire / rémunération', type: 'text' },
  { name: 'url', label: 'Lien annonce', type: 'text' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

export default function Career() {
  const { applications, addApplication, editApplication, deleteApplication, setStage, getBadges } = useCareerStore();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank());
  const [view, setView] = useState('kanban'); // 'kanban' | 'list'

  const byStage = useMemo(() => CAREER_STAGES.map((s) => ({ name: s, count: applications.filter((a) => a.stage === s).length })).filter((s) => s.count > 0), [applications]);
  const active = applications.filter((a) => OPEN_STAGES.includes(a.stage));
  const offers = applications.filter((a) => a.stage === 'Offer' || a.stage === 'Accepted').length;

  const submit = (e) => {
    e.preventDefault();
    const res = addApplication(form);
    if (!res.ok) return alert(res.error);
    setModal(false);
    setForm(blank());
  };
  // Only rendered for OPEN_STAGES (Applied/Screening/Interview/Offer), so the
  // next index is always a valid stage (Screening/Interview/Offer/Accepted).
  const advance = (app) => setStage(app.id, CAREER_STAGES[CAREER_STAGES.indexOf(app.stage) + 1]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Career</h1>
          <p className="text-mute text-sm mt-1">Candidatures, entretiens, offres — stages et emplois.</p>
        </div>
        <Button onClick={() => setModal(true)}><span className="flex items-center gap-2"><Plus size={16} /> Nouvelle candidature</span></Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Candidatures" value={applications.length} />
        <Stat label="En cours" value={active.length} />
        <Stat label="Entretiens décrochés" value={applications.filter((a) => CAREER_STAGES.indexOf(a.stage) >= CAREER_STAGES.indexOf('Interview')).length} />
        <Stat label="Offres" value={offers} color={offers ? 'var(--success)' : undefined} />
      </div>

      {byStage.length > 1 && (
        <Card title="Pipeline par étape">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byStage}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {byStage.map((s) => <Cell key={s.name} fill={STAGE_COLOR[s.name]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="flex gap-1 border-b border-line">
        {[{ key: 'kanban', label: 'Kanban' }, { key: 'list', label: 'Liste' }].map((t) => (
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
                    <span className="text-xs font-semibold text-mute uppercase tracking-wide">{stage}</span>
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
                        <div className="text-[11px] text-mute mt-1.5">{fmtDateShort(a.appliedDate)}</div>
                        {OPEN_STAGES.includes(a.stage) && (
                          <button className="mt-2 flex items-center gap-1 text-xs text-accent hover:underline cursor-pointer" onClick={() => advance(a)}>
                            Avancer <ArrowRight size={11} />
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
          <Card><EmptyState><Briefcase className="mx-auto mb-2 text-mute" size={26} />Aucune candidature. Loggez la première pour démarrer le pipeline.</EmptyState></Card>
        )
      ) : (
        <Card title={`Candidatures (${applications.length})`}>
          {applications.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-mute border-b border-line">
                    <th className="py-2 pr-4">Entreprise</th>
                    <th className="py-2 pr-4">Rôle</th>
                    <th className="py-2 pr-4">Domaine</th>
                    <th className="py-2 pr-4">Étape</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {[...applications].sort((a, b) => b.updatedAt - a.updatedAt).map((a) => (
                    <tr key={a.id} className="border-b border-line/50 hover:bg-surface/50">
                      <td className="py-2.5 pr-4">{a.company}</td>
                      <td className="py-2.5 pr-4 text-mute">{a.role}</td>
                      <td className="py-2.5 pr-4"><Badge>{a.domain}</Badge></td>
                      <td className="py-2.5 pr-4">
                        <Select value={a.stage} onChange={(e) => setStage(a.id, e.target.value)} options={CAREER_STAGES} className="!py-1 !px-2 text-xs w-32" />
                      </td>
                      <td className="py-2.5 pr-4 text-mute">{fmtDateShort(a.appliedDate)}</td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        <button className="text-mute hover:text-accent mr-3 cursor-pointer" onClick={() => setEditing(a)}><Pencil size={14} /></button>
                        <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Supprimer "${a.role} @ ${a.company}" ?`)) deleteApplication(a.id); }}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>Aucune candidature.</EmptyState>
          )}
        </Card>
      )}

      <BadgeList badges={getBadges()} />

      <Modal open={modal} onClose={() => setModal(false)} title="Nouvelle candidature">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Entreprise"><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} autoFocus /></Field>
            <Field label="Rôle"><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Domaine"><Select value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} options={LIFE_DOMAINS} /></Field>
            <Field label="Date"><Input type="date" value={form.appliedDate} onChange={(e) => setForm({ ...form, appliedDate: e.target.value })} /></Field>
            <Field label="Lieu"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Salaire / rémunération"><Input value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} /></Field>
            <Field label="Lien annonce"><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button type="submit">Créer</Button>
          </div>
        </form>
      </Modal>

      {editing && (
        <EntityFormModal
          open={!!editing}
          onClose={() => setEditing(null)}
          title="Éditer la candidature"
          fields={appFields}
          initial={editing}
          wide
          onSave={(values) => editApplication(editing.id, values)}
          onDelete={() => deleteApplication(editing.id)}
        />
      )}
    </div>
  );
}
