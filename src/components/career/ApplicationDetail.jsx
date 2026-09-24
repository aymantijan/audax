import { useState } from 'react';
import { Plus, Trash2, Mail, CalendarClock, CheckCircle2, Star } from 'lucide-react';
import { useCareerStore } from '../../store/careerStore';
import { useNetworkingStore } from '../../store/networkingStore';
import { APPLICATION_TYPES, INTERVIEW_KINDS, CURRENCIES, DEFAULT_ASK_THEM, stageLabel, CAREER_STAGES } from '../../utils/constants';
import { fmtDate, todayKey } from '../../utils/formatters';
import { useCareerDomains } from '../../hooks/useCareerDomains';
import { Button, Field, Input, Select, Textarea, Modal } from '../common/ui';

const TABS = [['infos', 'Infos'], ['entretiens', 'Entretiens'], ['prep', 'Préparation'], ['offre', 'Offre']];
const Stars = ({ value, onChange }) => (
  <span className="inline-flex gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <button key={n} type="button" onClick={() => onChange(n === value ? null : n)} className="cursor-pointer" title={`${n}/5`}>
        <Star size={15} className={n <= (value || 0) ? 'text-warn fill-current' : 'text-mute'} />
      </button>
    ))}
  </span>
);

function Infos({ app, onClose }) {
  const { editApplication, deleteApplication, plans } = useCareerStore();
  const contacts = useNetworkingStore((s) => s.contacts);
  const domainOptions = useCareerDomains();
  const [f, setF] = useState({ company: app.company, role: app.role, type: app.type || '', domain: app.domain, appliedDate: app.appliedDate, location: app.location || '', salary: app.salary || '', url: app.url || '', referralContactId: app.referralContactId || '', planId: app.planId || '', notes: app.notes || '' });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const openPlans = (plans || []).filter((p) => p.status !== 'dropped');
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); editApplication(app.id, f); onClose(); }}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Entreprise"><Input value={f.company} onChange={set('company')} /></Field>
        <Field label="Poste"><Input value={f.role} onChange={set('role')} /></Field>
        <Field label="Type"><Select value={f.type} onChange={set('type')} options={[{ value: '', label: '—' }, ...APPLICATION_TYPES.map((t) => ({ value: t, label: t }))]} /></Field>
        <Field label="Domaine"><Select value={f.domain} onChange={set('domain')} options={domainOptions} /></Field>
        <Field label="Date de candidature"><Input type="date" value={f.appliedDate} onChange={set('appliedDate')} /></Field>
        <Field label="Lieu"><Input value={f.location} onChange={set('location')} /></Field>
        <Field label="Rémunération annoncée"><Input value={f.salary} onChange={set('salary')} /></Field>
        <Field label="Lien annonce"><Input value={f.url} onChange={set('url')} /></Field>
        <Field label="Contact référent"><Select value={f.referralContactId} onChange={set('referralContactId')} options={[{ value: '', label: '— Aucun —' }, ...contacts.map((c) => ({ value: c.id, label: c.org ? `${c.name} · ${c.org}` : c.name }))]} /></Field>
        {openPlans.length > 0 && <Field label="Objectif de carrière"><Select value={f.planId} onChange={set('planId')} options={[{ value: '', label: '— Aucun —' }, ...openPlans.map((p) => ({ value: p.id, label: p.title }))]} /></Field>}
      </div>
      <Field label="Notes"><Textarea rows={3} value={f.notes} onChange={set('notes')} /></Field>
      <div className="flex justify-between gap-2">
        <Button type="button" variant="danger" onClick={() => { if (confirm(`Supprimer « ${app.role} @ ${app.company} » ?`)) { deleteApplication(app.id); onClose(); } }}>Supprimer</Button>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Fermer</Button>
          <Button type="submit">Enregistrer</Button>
        </div>
      </div>
    </form>
  );
}

function Interviews({ app }) {
  const { addInterview, editInterview, deleteInterview } = useCareerStore();
  const [f, setF] = useState({ date: todayKey(), time: '', kind: INTERVIEW_KINDS[0], with: '' });
  const today = todayKey();
  const list = [...(app.interviews || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <div className="space-y-4">
      {list.length ? list.map((i) => {
        const past = i.date <= today;
        return (
          <div key={i.id} className="rounded-lg border border-line p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CalendarClock size={15} className={past ? 'text-mute' : 'text-accent'} />
              <span className="text-sm font-medium flex-1">{i.kind}{i.with ? ` · avec ${i.with}` : ''}</span>
              <span className="text-xs text-mute">{fmtDate(i.date)}{i.time ? ` · ${i.time}` : ''}{!past ? ' · à venir' : ''}</span>
              <button className="text-mute hover:text-bad cursor-pointer" onClick={() => deleteInterview(app.id, i.id)}><Trash2 size={13} /></button>
            </div>
            {past && (
              <>
                <Textarea rows={2} value={i.notes} onChange={(e) => editInterview(app.id, i.id, { notes: e.target.value })} placeholder="Questions posées, ce qui a marché, ce qu’il faut améliorer…" />
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-mute">Ressenti <Stars value={i.feeling} onChange={(v) => editInterview(app.id, i.id, { feeling: v })} /></span>
                  <span className="flex-1" />
                  {i.thankYouSent
                    ? <span className="flex items-center gap-1 text-good"><CheckCircle2 size={13} /> Remerciement envoyé</span>
                    : <Button variant="secondary" className="!py-1 !px-2 text-xs" onClick={() => editInterview(app.id, i.id, { thankYouSent: true })}><span className="flex items-center gap-1"><Mail size={12} /> Remerciement envoyé</span></Button>}
                </div>
              </>
            )}
          </div>
        );
      }) : <p className="text-sm text-mute">Aucun entretien pour l’instant.</p>}
      <form className="rounded-lg border border-dashed border-line p-3 grid sm:grid-cols-5 gap-2 items-end" onSubmit={(e) => { e.preventDefault(); addInterview(app.id, f); setF((p) => ({ ...p, with: '' })); }}>
        <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF((p) => ({ ...p, date: e.target.value }))} /></Field>
        <Field label="Heure"><Input type="time" value={f.time} onChange={(e) => setF((p) => ({ ...p, time: e.target.value }))} /></Field>
        <Field label="Type"><Select value={f.kind} onChange={(e) => setF((p) => ({ ...p, kind: e.target.value }))} options={INTERVIEW_KINDS} /></Field>
        <Field label="Avec"><Input value={f.with} onChange={(e) => setF((p) => ({ ...p, with: e.target.value }))} placeholder="Nom / rôle" /></Field>
        <Button type="submit"><span className="flex items-center gap-1"><Plus size={14} /> Ajouter</span></Button>
      </form>
      <p className="text-[11px] text-mute">Après chaque entretien, un rappel de remerciement apparaît dans « Prochaines actions » jusqu’à ce que vous le marquiez envoyé.</p>
    </div>
  );
}

function Prep({ app }) {
  const { setPrep, questions, stories } = useCareerStore();
  const prep = { companyNotes: '', questionIds: [], storyIds: [], askThem: '', ...(app.prep || {}) };
  const toggle = (k, id) => setPrep(app.id, { [k]: prep[k].includes(id) ? prep[k].filter((x) => x !== id) : [...prep[k], id] });
  return (
    <div className="space-y-4">
      <Field label={`Pourquoi ${app.company} ? Actualité, chiffres, culture, personnes rencontrées`}>
        <Textarea rows={4} value={prep.companyNotes} onChange={(e) => setPrep(app.id, { companyNotes: e.target.value })} placeholder="3 raisons précises de vouloir cette entreprise, une opération récente, le nom de votre interlocuteur…" />
      </Field>
      <div>
        <div className="text-xs text-mute mb-1.5">Questions à préparer ({prep.questionIds.length})</div>
        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
          {(questions || []).map((q) => {
            const on = prep.questionIds.includes(q.id);
            return <button key={q.id} type="button" onClick={() => toggle('questionIds', q.id)} className={`text-left px-2 py-1 rounded-lg border text-[11px] cursor-pointer ${on ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute hover:text-ink'}`}>{q.question}</button>;
          })}
        </div>
      </div>
      <div>
        <div className="text-xs text-mute mb-1.5">Histoires STAR à placer ({prep.storyIds.length})</div>
        {(stories || []).length ? (
          <div className="flex flex-wrap gap-1.5">
            {stories.map((s) => {
              const on = prep.storyIds.includes(s.id);
              return <button key={s.id} type="button" onClick={() => toggle('storyIds', s.id)} className={`px-2 py-1 rounded-lg border text-[11px] cursor-pointer ${on ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute hover:text-ink'}`}>{s.title}</button>;
            })}
          </div>
        ) : <p className="text-[11px] text-mute">Écrivez vos histoires dans Carrière › Entretiens : vous les réutiliserez d’un entretien à l’autre.</p>}
      </div>
      <Field label="Questions à leur poser">
        <Textarea rows={4} value={prep.askThem || ''} onChange={(e) => setPrep(app.id, { askThem: e.target.value })} placeholder={DEFAULT_ASK_THEM} />
      </Field>
      {!prep.askThem && <button type="button" className="text-xs text-accent hover:underline cursor-pointer" onClick={() => setPrep(app.id, { askThem: DEFAULT_ASK_THEM })}>Utiliser les questions suggérées</button>}
    </div>
  );
}

function Offer({ app }) {
  const setOffer = useCareerStore((s) => s.setOffer);
  const [f, setF] = useState({ salary: '', currency: 'MAD', bonus: '', benefits: '', location: app.location || '', startDate: '', deadline: '', learning: null, career: null, culture: null, notes: '', ...(app.offer || {}) });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setOffer(app.id, { ...f, salary: Number(f.salary) || 0, bonus: Number(f.bonus) || 0 }); }}>
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Rémunération mensuelle"><Input type="number" min="0" value={f.salary} onChange={set('salary')} /></Field>
        <Field label="Devise"><Select value={f.currency} onChange={set('currency')} options={CURRENCIES} /></Field>
        <Field label="Bonus / primes (par an)"><Input type="number" min="0" value={f.bonus} onChange={set('bonus')} /></Field>
        <Field label="Lieu"><Input value={f.location} onChange={set('location')} /></Field>
        <Field label="Début"><Input type="date" value={f.startDate} onChange={set('startDate')} /></Field>
        <Field label="Réponse attendue avant le"><Input type="date" value={f.deadline} onChange={set('deadline')} /></Field>
      </div>
      <Field label="Avantages (logement, transport, télétravail…)"><Input value={f.benefits} onChange={set('benefits')} /></Field>
      <div className="grid sm:grid-cols-3 gap-3 text-sm">
        <div><div className="text-xs text-mute mb-1">Apprentissage</div><Stars value={f.learning} onChange={(v) => setF((p) => ({ ...p, learning: v }))} /></div>
        <div><div className="text-xs text-mute mb-1">Perspectives de carrière</div><Stars value={f.career} onChange={(v) => setF((p) => ({ ...p, career: v }))} /></div>
        <div><div className="text-xs text-mute mb-1">Culture / équipe</div><Stars value={f.culture} onChange={(v) => setF((p) => ({ ...p, culture: v }))} /></div>
      </div>
      <Field label="Notes"><Textarea rows={2} value={f.notes} onChange={set('notes')} /></Field>
      <div className="flex justify-between gap-2">
        {app.offer ? <Button type="button" variant="secondary" onClick={() => setOffer(app.id, null)}>Retirer l’offre</Button> : <span />}
        <Button type="submit">Enregistrer l’offre</Button>
      </div>
      <p className="text-[11px] text-mute">Toutes les offres enregistrées se comparent dans Carrière › Entretiens › Comparer les offres.</p>
    </form>
  );
}

export default function ApplicationDetail({ appId, onClose, initialTab = 'infos' }) {
  const app = useCareerStore((s) => s.applications.find((a) => a.id === appId));
  const setStage = useCareerStore((s) => s.setStage);
  const [tab, setTab] = useState(initialTab);
  if (!app) return null;
  return (
    <Modal open onClose={onClose} title={`${app.role} — ${app.company}`} wide>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1 border-b border-line flex-1">
          {TABS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px cursor-pointer ${tab === k ? 'text-accent border-accent' : 'text-mute border-transparent hover:text-ink'}`}>
              {l}{k === 'entretiens' && app.interviews?.length ? ` (${app.interviews.length})` : ''}{k === 'offre' && app.offer ? ' ✓' : ''}
            </button>
          ))}
        </div>
        <Select value={app.stage} onChange={(e) => setStage(app.id, e.target.value)} options={CAREER_STAGES.map((s) => ({ value: s, label: stageLabel(s) }))} className="!py-1 text-xs w-36" />
      </div>
      {tab === 'infos' && <Infos app={app} onClose={onClose} />}
      {tab === 'entretiens' && <Interviews app={app} />}
      {tab === 'prep' && <Prep app={app} />}
      {tab === 'offre' && <Offer app={app} />}
    </Modal>
  );
}
