import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Pencil, Target, CheckCircle2, Circle, Flag, BookOpen, GitBranch, Trophy, CalendarClock, Repeat } from 'lucide-react';
import { useCareerStore } from '../../store/careerStore';
import { useSkillStore } from '../../store/skillStore';
import { useLearningStore } from '../../store/learningStore';
import { useNetworkingStore } from '../../store/networkingStore';
import { useContentStore } from '../../store/contentStore';
import { SKILL_MAP, domainLabel } from '../../utils/constants';
import { calculateCourseProgress } from '../../utils/course-progress';
import { fmtDate, todayKey } from '../../utils/formatters';
import { useCareerDomains } from '../../hooks/useCareerDomains';
import { Card, Button, Field, Input, Select, Textarea, Modal, ProgressBar, EmptyState } from '../common/ui';
import SkillPicker from '../common/SkillPicker';
import { planProgress, weekRange } from '../../utils/career-plan';

const PLAN_TYPES = ['Stage', 'Stage de fin d’études (PFE)', 'Alternance', 'CDI', 'CDD', 'VIE / international', 'Freelance', 'Création d’entreprise', 'Autre'];

/** This week's career routine vs the weekly targets. */
export function useWeeklyRoutine() {
  const targets = useCareerStore((s) => s.weeklyTargets);
  const applications = useCareerStore((s) => s.applications);
  const contacts = useNetworkingStore((s) => s.contacts);
  const posts = useContentStore((s) => s.posts);
  return useMemo(() => {
    const [from, to] = weekRange();
    const inWeek = (d) => d && d >= from && d <= to;
    return [
      { key: 'applications', label: 'Candidatures', done: applications.filter((a) => inWeek(a.appliedDate)).length, target: targets?.applications ?? 3 },
      { key: 'touches', label: 'Échanges réseau', done: contacts.reduce((n, c) => n + (c.touches || []).filter((t) => inWeek(t.date)).length, 0), target: targets?.touches ?? 3 },
      { key: 'posts', label: 'Publications', done: posts.filter((p) => p.status === 'Publié' && inWeek(p.publishedDate)).length, target: targets?.posts ?? 1 },
    ];
  }, [targets, applications, contacts, posts]);
}

const STATUS = { achieved: ['Atteint', 'var(--success)'], ontrack: ['En bonne voie', 'var(--success)'], behind: ['En retard', 'var(--warning)'], active: ['En cours', 'var(--accent-primary)'] };

function PlanFormModal({ plan, onClose }) {
  const { addPlan, editPlan } = useCareerStore();
  const domainOptions = useCareerDomains();
  const [f, setF] = useState({ title: plan?.title || '', domain: plan?.domain || domainOptions[0]?.value || 'Général', type: plan?.type || PLAN_TYPES[0], targetDate: plan?.targetDate || '', why: plan?.why || '' });
  const [error, setError] = useState('');
  return (
    <Modal open onClose={onClose} title={plan ? 'Modifier l’objectif' : 'Nouvel objectif de carrière'} wide>
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        if (plan) { editPlan(plan.id, f); onClose(); return; }
        const res = addPlan(f);
        if (!res.ok) return setError(res.error);
        onClose();
      }}>
        <Field label="Objectif" hint="Un poste précis, pas « trouver un travail »"><Input value={f.title} onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))} placeholder="ex. Stage de fin d’études en M&A dans une banque d’affaires" autoFocus /></Field>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Type"><Select value={f.type} onChange={(e) => setF((p) => ({ ...p, type: e.target.value }))} options={PLAN_TYPES} /></Field>
          <Field label="Domaine"><Select value={f.domain} onChange={(e) => setF((p) => ({ ...p, domain: e.target.value }))} options={domainOptions} /></Field>
          <Field label="À atteindre avant le"><Input type="date" value={f.targetDate} onChange={(e) => setF((p) => ({ ...p, targetDate: e.target.value }))} /></Field>
        </div>
        <Field label="Pourquoi cet objectif ? (optionnel)"><Textarea rows={2} value={f.why} onChange={(e) => setF((p) => ({ ...p, why: e.target.value }))} placeholder="Ce qui vous motive, ce que ça débloque ensuite." /></Field>
        {error && <p className="text-bad text-sm">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit">{plan ? 'Enregistrer' : 'Créer'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function SkillModal({ planId, onClose }) {
  const addPlanItem = useCareerStore((s) => s.addPlanItem);
  const courses = useLearningStore((s) => s.courses);
  const [f, setF] = useState({ name: '', skillId: '', targetLevel: 3, courseId: '' });
  return (
    <Modal open onClose={onClose} title="Compétence à acquérir" wide>
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const name = f.name.trim() || SKILL_MAP[f.skillId]?.name || '';
        if (!name) return;
        addPlanItem(planId, 'skills', { name, skillId: f.skillId || '', targetLevel: Number(f.targetLevel) || 3, courseId: f.courseId || '' });
        onClose();
      }}>
        <Field label="Compétence" hint="ex. Modélisation LBO, Excel avancé, anglais B2, CFA niveau 1"><Input value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} autoFocus /></Field>
        <Field label="Relier à l’arbre de compétences (optionnel)" hint="Elle se coche seule quand ce nœud atteint le niveau visé">
          <SkillPicker multi={false} value={f.skillId} onChange={(id) => setF((p) => ({ ...p, skillId: id || '', name: p.name || SKILL_MAP[id]?.name || '' }))} placeholder="Rechercher une compétence…" />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          {f.skillId && <Field label="Niveau visé (1–5)"><Input type="number" min="1" max="5" value={f.targetLevel} onChange={(e) => setF((p) => ({ ...p, targetLevel: e.target.value }))} /></Field>}
          <Field label="Cours pour l’acquérir (optionnel)">
            <Select value={f.courseId} onChange={(e) => setF((p) => ({ ...p, courseId: e.target.value }))} options={[{ value: '', label: '— Aucun —' }, ...courses.filter((c) => c.status !== 'dropped').map((c) => ({ value: c.id, label: c.name }))]} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit">Ajouter</Button>
        </div>
      </form>
    </Modal>
  );
}

function PlanCard({ plan, onEdit }) {
  const { editPlan, deletePlan, addPlanItem, editPlanItem, deletePlanItem, applications } = useCareerStore();
  const skills = useSkillStore((s) => s.skills);
  const courses = useLearningStore((s) => s.courses);
  const [skillOpen, setSkillOpen] = useState(false);
  const [milestone, setMilestone] = useState({ title: '', due: '' });
  const pr = planProgress(plan, skills);
  const [label, color] = STATUS[pr.status];
  const linkedApps = applications.filter((a) => a.planId === plan.id);
  const daysLeft = plan.targetDate ? Math.ceil((new Date(`${plan.targetDate}T12:00:00`) - new Date(`${todayKey()}T12:00:00`)) / 86400000) : null;

  return (
    <Card>
      <div className="flex flex-wrap items-start gap-3">
        <Target size={20} className="text-accent shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{plan.title}</div>
          <div className="text-xs text-mute">
            {[plan.type, domainLabel(plan.domain), plan.targetDate ? `avant le ${fmtDate(plan.targetDate)}${daysLeft != null && plan.status !== 'achieved' ? ` (${daysLeft >= 0 ? `J-${daysLeft}` : `dépassé de ${-daysLeft} j`})` : ''}` : 'sans date'].filter(Boolean).join(' · ')}
          </div>
          {plan.why && <div className="text-xs text-mute italic mt-1">« {plan.why} »</div>}
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>{label}</span>
        <button className="p-1 text-mute hover:text-accent cursor-pointer" onClick={() => onEdit(plan)} title="Modifier"><Pencil size={14} /></button>
        <button className="p-1 text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Supprimer l’objectif « ${plan.title} » ?`)) deletePlan(plan.id); }} title="Supprimer"><Trash2 size={14} /></button>
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-xs text-mute mb-1"><span>Préparation</span><span className="tabular-nums">{pr.pct}%</span></div>
        <ProgressBar value={pr.pct} color={pr.status === 'behind' ? 'var(--warning)' : 'var(--accent-primary)'} />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-mute uppercase tracking-wide">Compétences à acquérir {plan.skills?.length ? `(${plan.skills.length - pr.skillsLeft}/${plan.skills.length})` : ''}</span>
            <button className="text-xs text-accent hover:underline cursor-pointer flex items-center gap-1" onClick={() => setSkillOpen(true)}><Plus size={12} /> Ajouter</button>
          </div>
          {(plan.skills || []).length ? (
            <ul className="space-y-1.5">
              {plan.skills.map((s) => {
                const done = pr.skillDone(s);
                const lvl = s.skillId ? skills[s.skillId]?.level || 0 : null;
                const course = s.courseId ? courses.find((c) => c.id === s.courseId) : null;
                const auto = s.skillId && !s.done && done;
                return (
                  <li key={s.id} className="flex items-start gap-2 text-sm">
                    <button className="mt-0.5 cursor-pointer" disabled={auto} onClick={() => editPlanItem(plan.id, 'skills', s.id, { done: !s.done })} title={auto ? 'Acquise (niveau atteint dans l’arbre)' : done ? 'Décocher' : 'Marquer comme acquise'}>
                      {done ? <CheckCircle2 size={15} className="text-good" /> : <Circle size={15} className="text-mute" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className={done ? 'text-mute line-through' : ''}>{s.name}</div>
                      <div className="text-[11px] text-mute flex flex-wrap gap-x-2">
                        {s.skillId && <Link to="/skills" className="flex items-center gap-1 hover:text-accent"><GitBranch size={10} /> niveau {lvl}/{s.targetLevel || 3}</Link>}
                        {course && <Link to={`/learning/course/${course.id}`} className="flex items-center gap-1 hover:text-accent"><BookOpen size={10} /> {course.name} · {calculateCourseProgress(course)}%</Link>}
                      </div>
                    </div>
                    <button className="text-mute hover:text-bad cursor-pointer" onClick={() => deletePlanItem(plan.id, 'skills', s.id)}><Trash2 size={12} /></button>
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-xs text-mute">Listez ce que les recruteurs attendent pour ce poste : c’est votre écart à combler.</p>}
        </div>

        <div>
          <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-2">Étapes clés</div>
          <ul className="space-y-1.5 mb-2">
            {[...(plan.milestones || [])].sort((a, b) => String(a.due || '9').localeCompare(String(b.due || '9'))).map((m) => {
              const late = !m.done && m.due && m.due < todayKey();
              return (
                <li key={m.id} className="flex items-start gap-2 text-sm">
                  <button className="mt-0.5 cursor-pointer" onClick={() => editPlanItem(plan.id, 'milestones', m.id, { done: !m.done })}>
                    {m.done ? <CheckCircle2 size={15} className="text-good" /> : <Flag size={15} className={late ? 'text-bad' : 'text-mute'} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className={m.done ? 'text-mute line-through' : ''}>{m.title}</div>
                    {m.due && <div className={`text-[11px] ${late ? 'text-bad' : 'text-mute'}`}>{late ? 'en retard · ' : ''}{fmtDate(m.due)}</div>}
                  </div>
                  <button className="text-mute hover:text-bad cursor-pointer" onClick={() => deletePlanItem(plan.id, 'milestones', m.id)}><Trash2 size={12} /></button>
                </li>
              );
            })}
          </ul>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!milestone.title.trim()) return; addPlanItem(plan.id, 'milestones', { title: milestone.title.trim(), due: milestone.due }); setMilestone({ title: '', due: '' }); }}>
            <Input value={milestone.title} onChange={(e) => setMilestone((m) => ({ ...m, title: e.target.value }))} placeholder="ex. CV relu par un alumni" />
            <Input type="date" value={milestone.due} onChange={(e) => setMilestone((m) => ({ ...m, due: e.target.value }))} className="w-40" />
            <Button type="submit" variant="secondary"><Plus size={14} /></Button>
          </form>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-line text-xs text-mute">
        <span>{linkedApps.length} candidature{linkedApps.length > 1 ? 's' : ''} liée{linkedApps.length > 1 ? 's' : ''}{linkedApps.some((a) => a.stage === 'Interview') ? ' · entretien en cours' : ''}{linkedApps.some((a) => a.stage === 'Offer') ? ' · offre reçue' : ''}</span>
        <span className="flex-1" />
        {plan.status !== 'achieved'
          ? <Button className="!py-1 !px-2.5 text-xs" onClick={() => editPlan(plan.id, { status: 'achieved' })}><span className="flex items-center gap-1.5"><Trophy size={13} /> Objectif atteint</span></Button>
          : <Button variant="secondary" className="!py-1 !px-2.5 text-xs" onClick={() => editPlan(plan.id, { status: 'active' })}>Rouvrir</Button>}
      </div>
      {skillOpen && <SkillModal planId={plan.id} onClose={() => setSkillOpen(false)} />}
    </Card>
  );
}

export default function CareerPlan() {
  const plans = useCareerStore((s) => s.plans) || [];
  const { weeklyTargets, setWeeklyTargets } = useCareerStore();
  const routine = useWeeklyRoutine();
  const [form, setForm] = useState(null); // plan | 'new'
  const [editTargets, setEditTargets] = useState(false);
  const active = plans.filter((p) => p.status !== 'achieved' && p.status !== 'dropped');
  const achieved = plans.filter((p) => p.status === 'achieved');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-mute">Où voulez-vous aller, pour quand, et que vous manque-t-il ? Vos objectifs apparaissent aussi dans <Link to="/goals" className="text-accent hover:underline">Objectifs</Link>.</p>
        <Button onClick={() => setForm('new')}><span className="flex items-center gap-1.5"><Plus size={15} /> Nouvel objectif</span></Button>
      </div>

      <Card title="Routine de la semaine" action={<button className="text-xs text-accent hover:underline cursor-pointer" onClick={() => setEditTargets((v) => !v)}>{editTargets ? 'Fermer' : 'Régler'}</button>}>
        <div className="grid sm:grid-cols-3 gap-4">
          {routine.map((r) => (
            <div key={r.key}>
              <div className="flex justify-between text-sm mb-1"><span>{r.label}</span><span className="tabular-nums text-mute">{r.done}/{r.target}</span></div>
              <ProgressBar value={r.target ? Math.min(100, (r.done / r.target) * 100) : 0} color={r.done >= r.target ? 'var(--success)' : 'var(--accent-primary)'} />
              {editTargets && <Input type="number" min="0" className="mt-2" value={weeklyTargets?.[r.key] ?? r.target} onChange={(e) => setWeeklyTargets({ [r.key]: e.target.value })} />}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-mute mt-3 flex items-center gap-1.5"><Repeat size={11} /> Pour ne pas y penser : créez les habitudes automatiques « Envoyer des candidatures », « Relancer / échanger avec un contact » et « Publier sur LinkedIn » (Habitudes › Nouvelle habitude › modèles). Elles se cochent seules.</p>
      </Card>

      {active.length ? active.map((p) => <PlanCard key={p.id} plan={p} onEdit={setForm} />) : (
        <Card><EmptyState><CalendarClock className="mx-auto mb-2 text-mute" size={24} />Aucun objectif. Commencez par un seul, précis et daté — par exemple votre prochain stage.</EmptyState></Card>
      )}

      {achieved.length > 0 && (
        <Card title={`Objectifs atteints (${achieved.length})`}>
          <ul className="space-y-1.5">
            {achieved.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <Trophy size={14} className="text-good" /><span className="flex-1">{p.title}</span>
                <span className="text-xs text-mute">{p.achievedAt ? fmtDate(p.achievedAt) : ''}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {form && <PlanFormModal plan={form === 'new' ? null : form} onClose={() => setForm(null)} />}
    </div>
  );
}

