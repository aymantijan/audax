import { useState } from 'react';
import { Plus, Pencil, Trash2, Download, Briefcase, GraduationCap, Award, Languages, Sparkles, Link2, X } from 'lucide-react';
import { useCareerStore } from '../../store/careerStore';
import { useAuthStore } from '../../store/authStore';
import { EXPERIENCE_TYPES, LANGUAGE_LEVELS } from '../../utils/constants';
import { exportCvPDF, fmtMonth } from '../../utils/cv-pdf';
import { Card, Button, Field, Input, Select, Textarea, Modal, ProgressBar, EmptyState } from '../common/ui';

// Fields of each dated section (month inputs: 'YYYY-MM').
const SECTIONS = {
  experiences: {
    title: 'Expériences', add: 'Ajouter une expérience', icon: Briefcase, empty: 'Stages, jobs, missions, associatif…',
    fields: [
      { name: 'title', label: 'Poste', required: true }, { name: 'org', label: 'Organisation', required: true },
      { name: 'type', label: 'Type', type: 'select', options: EXPERIENCE_TYPES }, { name: 'location', label: 'Lieu' },
      { name: 'start', label: 'Début', type: 'month' }, { name: 'end', label: 'Fin', type: 'month' },
      { name: 'current', label: 'En cours', type: 'checkbox' },
      { name: 'description', label: 'Missions et résultats (une ligne par point)', type: 'textarea', wide: true },
    ],
    line: (x) => `${x.title}${x.org ? ` — ${x.org}` : ''}`, sub: (x) => [x.type, x.location].filter(Boolean).join(' · '),
  },
  education: {
    title: 'Formation', add: 'Ajouter une formation', icon: GraduationCap, empty: 'École, diplôme, spécialisation…',
    fields: [
      { name: 'school', label: 'École / université', required: true }, { name: 'degree', label: 'Diplôme', required: true },
      { name: 'field', label: 'Spécialité' }, { name: 'start', label: 'Début', type: 'month' }, { name: 'end', label: 'Fin', type: 'month' },
      { name: 'current', label: 'En cours', type: 'checkbox' },
      { name: 'notes', label: 'Mentions, cours clés, projets', type: 'textarea', wide: true },
    ],
    line: (x) => `${x.degree}${x.school ? ` — ${x.school}` : ''}`, sub: (x) => x.field || '',
  },
  certifications: {
    title: 'Certifications', add: 'Ajouter une certification', icon: Award, empty: 'CFA, AMF, Bloomberg, Excel, langues…',
    fields: [
      { name: 'name', label: 'Certification', required: true }, { name: 'issuer', label: 'Organisme' },
      { name: 'date', label: 'Obtenue en', type: 'month' }, { name: 'url', label: 'Lien de vérification' },
    ],
    line: (x) => x.name, sub: (x) => x.issuer || '',
  },
};

const range = (x) => {
  const a = fmtMonth(x.start || x.date);
  const b = x.current ? 'aujourd’hui' : fmtMonth(x.end);
  return x.date ? a : [a, b].filter(Boolean).join(' → ');
};
const sortDesc = (list) => [...list].sort((a, b) => String(b.start || b.date || '').localeCompare(String(a.start || a.date || '')));

function ItemModal({ section, item, onClose }) {
  const { addProfileItem, editProfileItem } = useCareerStore();
  const def = SECTIONS[section];
  const [f, setF] = useState(() => Object.fromEntries(def.fields.map((fl) => [fl.name, item?.[fl.name] ?? (fl.type === 'checkbox' ? false : fl.type === 'select' ? fl.options[0] : '')])));
  const [error, setError] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const missing = def.fields.find((fl) => fl.required && !String(f[fl.name] || '').trim());
    if (missing) return setError(`« ${missing.label} » est requis.`);
    const data = { ...f, end: f.current ? '' : f.end };
    if (item) editProfileItem(section, item.id, data); else addProfileItem(section, data);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={item ? `Modifier — ${def.title}` : def.add} wide>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          {def.fields.map((fl) => {
            const set = (v) => setF((p) => ({ ...p, [fl.name]: v }));
            if (fl.type === 'checkbox') return (
              <label key={fl.name} className="flex items-center gap-2 text-sm cursor-pointer self-end pb-2">
                <input type="checkbox" className="accent-[var(--accent-primary)]" checked={!!f[fl.name]} onChange={(e) => set(e.target.checked)} /> {fl.label}
              </label>
            );
            if (fl.type === 'month' && fl.name === 'end' && f.current) return <div key={fl.name} />;
            return (
              <div key={fl.name} className={fl.wide ? 'sm:col-span-2' : ''}>
                <Field label={fl.label}>
                  {fl.type === 'select' ? <Select value={f[fl.name]} onChange={(e) => set(e.target.value)} options={fl.options} />
                    : fl.type === 'textarea' ? <Textarea rows={4} value={f[fl.name]} onChange={(e) => set(e.target.value)} />
                      : <Input type={fl.type === 'month' ? 'month' : 'text'} value={f[fl.name]} onChange={(e) => set(e.target.value)} />}
                </Field>
              </div>
            );
          })}
        </div>
        {error && <p className="text-bad text-sm">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit">{item ? 'Enregistrer' : 'Ajouter'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function SectionCard({ section, onEdit }) {
  const items = useCareerStore((s) => s.profile[section]) || [];
  const deleteProfileItem = useCareerStore((s) => s.deleteProfileItem);
  const def = SECTIONS[section];
  const Icon = def.icon;
  return (
    <Card title={def.title} action={<button className="text-xs text-accent hover:underline cursor-pointer flex items-center gap-1" onClick={() => onEdit(section, null)}><Plus size={12} /> Ajouter</button>}>
      {items.length ? (
        <ul className="space-y-3">
          {sortDesc(items).map((x) => (
            <li key={x.id} className="flex items-start gap-3">
              <Icon size={16} className="text-accent mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{def.line(x)}</div>
                <div className="text-xs text-mute">{[range(x), def.sub(x)].filter(Boolean).join(' · ')}</div>
                {(x.description || x.notes) && <div className="text-xs text-mute mt-1 whitespace-pre-line">{x.description || x.notes}</div>}
              </div>
              <button className="p-1 text-mute hover:text-accent cursor-pointer" onClick={() => onEdit(section, x)} title="Modifier"><Pencil size={13} /></button>
              <button className="p-1 text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm('Supprimer cet élément ?')) deleteProfileItem(section, x.id); }} title="Supprimer"><Trash2 size={13} /></button>
            </li>
          ))}
        </ul>
      ) : <EmptyState>{def.empty}</EmptyState>}
    </Card>
  );
}

export default function CareerProfile() {
  const { profile, setProfileFields, addProfileItem, deleteProfileItem } = useCareerStore();
  const userName = useAuthStore((s) => s.user?.name) || '';
  const [editing, setEditing] = useState(null); // { section, item }
  const [idForm, setIdForm] = useState(null);
  const [skill, setSkill] = useState('');
  const [lang, setLang] = useState({ name: '', level: 'B2' });

  const checks = [
    !!profile.headline, !!profile.summary, (profile.experiences || []).length > 0, (profile.education || []).length > 0,
    (profile.skills || []).length >= 3, (profile.languages || []).length > 0, !!(profile.email || profile.phone),
  ];
  const completeness = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const addSkill = () => { const v = skill.trim(); if (v && !(profile.skills || []).includes(v)) setProfileFields({ skills: [...(profile.skills || []), v] }); setSkill(''); };

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-lg font-bold">{userName || 'Votre nom'}</div>
            <div className="text-sm text-accent">{profile.headline || 'Titre professionnel — ex. « Étudiant ISCAE · Finance de marché »'}</div>
            <div className="text-xs text-mute mt-1">{[profile.location, profile.email, profile.phone].filter(Boolean).join(' · ') || 'Lieu, email, téléphone'}</div>
            {profile.summary && <p className="text-sm text-mute mt-2 whitespace-pre-line">{profile.summary}</p>}
            {(profile.links || []).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {profile.links.map((l) => <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline flex items-center gap-1"><Link2 size={11} /> {l.label || l.url}</a>)}
              </div>
            )}
          </div>
          <div className="w-full sm:w-44 shrink-0">
            <div className="flex justify-between text-xs text-mute mb-1"><span>Profil complet</span><span className="tabular-nums">{completeness}%</span></div>
            <ProgressBar value={completeness} color={completeness >= 85 ? 'var(--success)' : 'var(--accent-primary)'} />
            <div className="flex flex-col gap-2 mt-3">
              <Button variant="secondary" className="!py-1.5 text-xs" onClick={() => setIdForm({ headline: profile.headline, summary: profile.summary, location: profile.location, email: profile.email, phone: profile.phone, links: (profile.links || []).map((l) => `${l.label} | ${l.url}`).join('\n') })}><span className="flex items-center justify-center gap-1.5"><Pencil size={13} /> Identité</span></Button>
              <Button className="!py-1.5 text-xs" onClick={() => exportCvPDF(profile, userName)}><span className="flex items-center justify-center gap-1.5"><Download size={13} /> CV en PDF</span></Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        <SectionCard section="experiences" onEdit={(section, item) => setEditing({ section, item })} />
        <SectionCard section="education" onEdit={(section, item) => setEditing({ section, item })} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Compétences">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(profile.skills || []).map((s) => (
              <span key={s} className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-line text-xs">
                <Sparkles size={10} className="text-accent" /> {s}
                <button className="text-mute hover:text-bad cursor-pointer" onClick={() => setProfileFields({ skills: profile.skills.filter((x) => x !== s) })}><X size={10} /></button>
              </span>
            ))}
            {!(profile.skills || []).length && <span className="text-xs text-mute">Excel avancé, modélisation financière, Python, analyse technique…</span>}
          </div>
          <div className="flex gap-2">
            <Input value={skill} onChange={(e) => setSkill(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }} placeholder="Ajouter une compétence" />
            <Button variant="secondary" onClick={addSkill}><Plus size={14} /></Button>
          </div>
        </Card>
        <Card title="Langues">
          <ul className="space-y-1.5 mb-3">
            {(profile.languages || []).map((l) => (
              <li key={l.id} className="flex items-center gap-2 text-sm">
                <Languages size={13} className="text-accent" /><span className="flex-1">{l.name}</span><span className="text-xs text-mute">{l.level}</span>
                <button className="text-mute hover:text-bad cursor-pointer" onClick={() => deleteProfileItem('languages', l.id)}><X size={12} /></button>
              </li>
            ))}
            {!(profile.languages || []).length && <li className="text-xs text-mute">Arabe, français, anglais…</li>}
          </ul>
          <div className="flex gap-2">
            <Input value={lang.name} onChange={(e) => setLang({ ...lang, name: e.target.value })} placeholder="Langue" />
            <Select value={lang.level} onChange={(e) => setLang({ ...lang, level: e.target.value })} options={LANGUAGE_LEVELS} className="w-36" />
            <Button variant="secondary" onClick={() => { if (lang.name.trim()) { addProfileItem('languages', { name: lang.name.trim(), level: lang.level }); setLang({ name: '', level: 'B2' }); } }}><Plus size={14} /></Button>
          </div>
        </Card>
        <SectionCard section="certifications" onEdit={(section, item) => setEditing({ section, item })} />
      </div>

      {editing && <ItemModal section={editing.section} item={editing.item} onClose={() => setEditing(null)} />}

      {idForm && (
        <Modal open onClose={() => setIdForm(null)} title="Identité professionnelle" wide>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const links = idForm.links.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
              const [label, url] = line.includes('|') ? line.split('|').map((x) => x.trim()) : [line, line];
              return { id: `${label}-${url}`, label, url: /^https?:\/\//i.test(url) ? url : `https://${url}` };
            });
            setProfileFields({ headline: idForm.headline.trim(), summary: idForm.summary.trim(), location: idForm.location.trim(), email: idForm.email.trim(), phone: idForm.phone.trim(), links });
            setIdForm(null);
          }}>
            <Field label="Titre professionnel"><Input value={idForm.headline} onChange={(e) => setIdForm({ ...idForm, headline: e.target.value })} placeholder="Étudiant ISCAE · Finance de marché & trading" autoFocus /></Field>
            <Field label="Résumé (3–4 lignes)"><Textarea rows={4} value={idForm.summary} onChange={(e) => setIdForm({ ...idForm, summary: e.target.value })} placeholder="Qui vous êtes, ce que vous apportez, ce que vous cherchez." /></Field>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Ville"><Input value={idForm.location} onChange={(e) => setIdForm({ ...idForm, location: e.target.value })} /></Field>
              <Field label="Email"><Input value={idForm.email} onChange={(e) => setIdForm({ ...idForm, email: e.target.value })} /></Field>
              <Field label="Téléphone"><Input value={idForm.phone} onChange={(e) => setIdForm({ ...idForm, phone: e.target.value })} /></Field>
            </div>
            <Field label="Liens (un par ligne : Nom | adresse)" hint="ex. LinkedIn | linkedin.com/in/votre-profil"><Textarea rows={3} value={idForm.links} onChange={(e) => setIdForm({ ...idForm, links: e.target.value })} /></Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setIdForm(null)}>Annuler</Button>
              <Button type="submit">Enregistrer</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
