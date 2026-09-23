import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, BookOpen, ExternalLink, Trash2, Minus, CheckCircle2, Circle, PlayCircle, Library } from 'lucide-react';
import { useLearningStore } from '../../store/learningStore';
import { useReadingsStore } from '../../store/readingsStore';
import { useFlashcardStore } from '../../store/flashcardStore';
import { useSkillStore } from '../../store/skillStore';
import {
  TRACK_TYPES, LANGUAGES, CEFR, GENERIC_LEVELS, roadmapFor, RESOURCE_TYPES, resourceLabel, resourcesOf,
} from '../../utils/tracks';
import { Button, Card, Field, Input, Modal, Select, ProgressBar } from '../common/ui';
import SkillPicker from '../common/SkillPicker';
import { SectionHeader, tint } from './design';

// Skill ids suggested per track type (only unlocked ones are applied).
const SUGGESTED_SKILLS = {
  trading: ['trading-discipline-lv1', 'risk-management-lv1', 'technical-analysis-lv1'],
  language: ['written-communication-lv1'],
  skill: [],
  topic: [],
};

// ── Create / edit a track ────────────────────────────────────────────────
export function TrackFormModal({ open, onClose, course, onCreated }) {
  const { addCourse, editCourse } = useLearningStore();
  const addDeck = useFlashcardStore((s) => s.addDeck);
  const skills = useSkillStore((s) => s.skills);
  const [f, setF] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setF(course
      ? { trackType: course.trackType || 'topic', name: course.name, language: course.language || 'Anglais', level: course.level || '', targetLevel: course.targetLevel || '', goal: course.goal || '', targetDate: course.targetDate || '', weeklyHours: course.weeklyHours ?? '', institution: course.institution || '', linkedSkills: course.linkedSkills || [], roadmap: false }
      : { trackType: 'language', name: '', language: 'Anglais', level: 'B1', targetLevel: 'C1', goal: '', targetDate: '', weeklyHours: 3, institution: '', linkedSkills: [], roadmap: true });
  }, [open, course]);

  const type = f.trackType;
  const setType = (t) => {
    const lv = t === 'language' ? { level: 'B1', targetLevel: 'C1' } : { level: 'L1', targetLevel: 'L3' };
    setF((x) => ({ ...x, trackType: t, ...(course ? {} : lv), linkedSkills: (SUGGESTED_SKILLS[t] || []).filter((id) => skills[id] && !skills[id].locked) }));
  };

  const submit = (e) => {
    e.preventDefault();
    const name = f.name.trim() || (type === 'language' ? `${f.language} — ${f.level} → ${f.targetLevel}` : '');
    if (!name) return setError('Donnez un nom au parcours.');
    const data = {
      kind: 'free', trackType: type, name,
      language: type === 'language' ? f.language : null,
      level: f.level || null, targetLevel: f.targetLevel || null,
      goal: f.goal.trim(), targetDate: f.targetDate || null,
      weeklyHours: f.weeklyHours === '' ? null : Number(f.weeklyHours),
      institution: f.institution || '', linkedSkills: f.linkedSkills || [],
    };
    if (course) {
      editCourse(course.id, data);
    } else {
      const id = addCourse({
        ...data, professor: '', credits: 0, expectedGrade: 'A', progressPercent: 0,
        levelHistory: f.level ? [{ level: f.level, date: new Date().toISOString().slice(0, 10) }] : [],
        chapters: f.roadmap ? roadmapFor({ trackType: type, level: f.level, targetLevel: f.targetLevel }) : [],
        resources: [],
      });
      if (type === 'language') addDeck({ name: `Vocabulaire — ${f.language}`, courseId: id });
      onCreated?.(id);
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={course ? 'Modifier le parcours' : 'Nouveau parcours'} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TRACK_TYPES.map((t) => {
            const Icon = t.icon;
            const active = type === t.value;
            return (
              <button key={t.value} type="button" onClick={() => setType(t.value)}
                className="rounded-xl border p-3 text-left cursor-pointer transition-colors"
                style={active ? { borderColor: t.color, background: tint(t.color, 12) } : { borderColor: 'var(--border)' }}>
                <Icon size={18} style={{ color: t.color }} />
                <div className="text-sm font-semibold text-ink mt-1.5">{t.label}</div>
                <div className="text-[10px] text-mute leading-snug mt-0.5">{t.desc}</div>
              </button>
            );
          })}
        </div>

        {type === 'language' && (
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Langue"><Select value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })} options={LANGUAGES} /></Field>
            <Field label="Niveau actuel"><Select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} options={[{ value: 'A0', label: 'Débutant complet' }, ...CEFR.map((l) => ({ value: l.value, label: l.label }))]} /></Field>
            <Field label="Niveau visé"><Select value={f.targetLevel} onChange={(e) => setF({ ...f, targetLevel: e.target.value })} options={CEFR.map((l) => ({ value: l.value, label: l.label }))} /></Field>
          </div>
        )}
        {type !== 'language' && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Niveau actuel"><Select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} options={GENERIC_LEVELS.map((l) => ({ value: l.value, label: l.label }))} /></Field>
            <Field label="Niveau visé"><Select value={f.targetLevel} onChange={(e) => setF({ ...f, targetLevel: e.target.value })} options={GENERIC_LEVELS.map((l) => ({ value: l.value, label: l.label }))} /></Field>
          </div>
        )}

        <Field label="Nom du parcours" hint={type === 'language' ? 'Laissez vide pour « Anglais — B1 → C1 ».' : undefined}>
          <Input value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })}
            placeholder={type === 'trading' ? 'Devenir trader rentable — price action' : type === 'skill' ? 'Maîtriser Excel pour la finance' : type === 'language' ? '' : 'Comprendre la macroéconomie'} />
        </Field>
        <Field label="Objectif concret (optionnel)">
          <Input value={f.goal || ''} onChange={(e) => setF({ ...f, goal: e.target.value })}
            placeholder={type === 'language' ? 'Obtenir 100+ au TOEFL / tenir un entretien en anglais' : type === 'trading' ? 'Passer un challenge prop firm' : 'Ce que vous saurez faire à la fin'} />
        </Field>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Échéance (optionnel)"><Input type="date" value={f.targetDate || ''} onChange={(e) => setF({ ...f, targetDate: e.target.value })} /></Field>
          <Field label="Heures / semaine visées"><Input type="number" min="0" step="0.5" value={f.weeklyHours ?? ''} onChange={(e) => setF({ ...f, weeklyHours: e.target.value })} /></Field>
          <Field label="Plateforme / école (optionnel)"><Input value={f.institution || ''} onChange={(e) => setF({ ...f, institution: e.target.value })} placeholder="British Council, Udemy…" /></Field>
        </div>
        {!course && (
          <label className="flex items-start gap-2 text-sm cursor-pointer rounded-lg border border-line p-3">
            <input type="checkbox" className="mt-0.5 accent-[var(--accent-primary)]" checked={f.roadmap} onChange={(e) => setF({ ...f, roadmap: e.target.checked })} />
            <span>
              <span className="text-ink">Pré-remplir la feuille de route</span>
              <span className="block text-[11px] text-mute">
                {type === 'language' ? 'Objectifs « je sais faire » du CECRL pour chaque niveau à franchir. Un paquet de fiches de vocabulaire est aussi créé.'
                  : type === 'trading' ? '6 étapes : bases, analyse technique, gestion du risque, psychologie, backtest, exécution.'
                    : '4 étapes : fondamentaux, pratique guidée, projet, approfondissement.'} Modifiable ensuite.
              </span>
            </span>
          </label>
        )}
        <Field label="Compétences liées (XP à la fin du parcours)">
          <SkillPicker value={f.linkedSkills || []} onChange={(ids) => setF({ ...f, linkedSkills: ids })} />
        </Field>
        {error && <p className="text-bad text-sm">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit">{course ? 'Enregistrer' : 'Créer le parcours'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Add a resource (book from the Library, video, link…) ─────────────────
export function ResourceModal({ open, onClose, courseId }) {
  const addResource = useLearningStore((s) => s.addResource);
  const { library, addBookToLibrary, addToReading, isReading, seedCatalog } = useReadingsStore();
  const [type, setType] = useState('book');
  const [q, setQ] = useState('');
  const [f, setF] = useState({ title: '', url: '', author: '', pages: '' });
  useEffect(() => { if (open) { setType('book'); setQ(''); setF({ title: '', url: '', author: '', pages: '' }); seedCatalog?.(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return library.filter((b) => b.title.toLowerCase().includes(s) || (b.author || '').toLowerCase().includes(s)).slice(0, 8);
  }, [library, q]);

  const linkBook = (bookId, title) => {
    if (!isReading(bookId)) addToReading(bookId);
    addResource(courseId, { type: 'book', title, bookId, status: 'doing' });
    onClose();
  };
  const createBook = () => {
    if (!f.title.trim() || !Number(f.pages)) return;
    const id = addBookToLibrary({ title: f.title.trim(), author: f.author.trim() || 'Inconnu', pages: Number(f.pages), genre: 'Business & Economics', year: new Date().getFullYear(), description: '', popularity: 50, linkedSkills: [] });
    linkBook(id, f.title.trim());
  };
  const addOther = (e) => {
    e.preventDefault();
    if (!f.title.trim()) return;
    addResource(courseId, { type, title: f.title.trim(), url: f.url.trim(), status: 'todo' });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Ajouter une ressource">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {RESOURCE_TYPES.map((r) => (
            <button key={r.value} type="button" onClick={() => setType(r.value)}
              className={`rounded-lg px-2.5 py-1 text-xs border cursor-pointer ${type === r.value ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute hover:text-ink'}`}>{r.label}</button>
          ))}
        </div>

        {type === 'book' ? (
          <>
            <Field label="Chercher dans la bibliothèque" hint="Le livre est suivi à un seul endroit : ses pages lues s'affichent ici et dans Lectures.">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Titre ou auteur…"
                  className="w-full bg-surface border border-line rounded-lg pl-9 pr-3 py-2 text-sm text-ink placeholder:text-mute focus:outline-none focus:border-accent" />
              </div>
            </Field>
            {matches.length > 0 && (
              <div className="rounded-lg border border-line divide-y divide-line/60 max-h-60 overflow-y-auto">
                {matches.map((b) => (
                  <button key={b.id} type="button" onClick={() => linkBook(b.id, b.title)} className="w-full text-left px-3 py-2 hover:bg-surface cursor-pointer flex items-center gap-3">
                    <BookOpen size={14} className="text-mute shrink-0" />
                    <span className="min-w-0 flex-1"><span className="block text-sm text-ink truncate">{b.title}</span><span className="text-[11px] text-mute">{b.author} · {b.pages} p.</span></span>
                    {isReading(b.id) && <span className="text-[10px] text-good">déjà en lecture</span>}
                  </button>
                ))}
              </div>
            )}
            <div className="rounded-lg border border-dashed border-line p-3 space-y-2">
              <div className="text-xs text-mute">Pas dans la bibliothèque ? Ajoutez-le :</div>
              <div className="grid grid-cols-[1fr_1fr_5rem] gap-2">
                <Input placeholder="Titre" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
                <Input placeholder="Auteur" value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} />
                <Input placeholder="Pages" type="number" min="1" value={f.pages} onChange={(e) => setF({ ...f, pages: e.target.value })} />
              </div>
              <div className="flex justify-end"><Button variant="secondary" className="!py-1.5" disabled={!f.title.trim() || !Number(f.pages)} onClick={createBook}><span className="flex items-center gap-1"><Plus size={13} /> Ajouter le livre</span></Button></div>
            </div>
          </>
        ) : (
          <form onSubmit={addOther} className="space-y-3">
            <Field label="Titre"><Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={type === 'video' ? 'Chaîne YouTube, playlist…' : type === 'course' ? 'Cours Coursera / Udemy…' : 'Titre'} /></Field>
            <Field label="Lien (optionnel)"><Input type="url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://…" /></Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
              <Button type="submit">Ajouter</Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

const STATUS = [
  { value: 'todo', label: 'À faire', Icon: Circle, color: 'var(--text-secondary)' },
  { value: 'doing', label: 'En cours', Icon: PlayCircle, color: 'var(--accent-primary)' },
  { value: 'done', label: 'Terminé', Icon: CheckCircle2, color: 'var(--success)' },
];
const nextStatus = (s) => STATUS[(STATUS.findIndex((x) => x.value === s) + 1) % STATUS.length].value;

// ── Resources card (course page) ─────────────────────────────────────────
export function ResourcesCard({ course }) {
  const { editResource, deleteResource } = useLearningStore();
  const { library, progress, addPage, removePage, setPagesRead, totalPagesFor } = useReadingsStore();
  const [open, setOpen] = useState(false);
  const [pageDraft, setPageDraft] = useState({});
  const resources = resourcesOf(course);
  const done = resources.filter((r) => r.status === 'done' || (r.bookId && progress.find((p) => p.bookId === r.bookId)?.status === 'completed')).length;

  return (
    <Card>
      <SectionHeader icon={Library} title="Ressources" subtitle={`${done}/${resources.length} terminée(s) · livres suivis avec vos Lectures`}
        action={<Button variant="secondary" className="!py-1.5" onClick={() => setOpen(true)}><span className="flex items-center gap-1"><Plus size={13} /> Ressource</span></Button>} />
      {resources.length ? (
        <div className="space-y-2">
          {resources.map((r) => {
            const book = r.bookId ? library.find((b) => b.id === r.bookId) : null;
            const prog = r.bookId ? progress.find((p) => p.bookId === r.bookId) : null;
            const total = prog ? totalPagesFor(prog) : 0;
            const pct = prog && total ? Math.round((prog.pagesRead / total) * 100) : 0;
            const st = STATUS.find((s) => s.value === (prog?.status === 'completed' ? 'done' : r.status)) || STATUS[0];
            return (
              <div key={r.id} className="rounded-lg border border-line p-2.5">
                <div className="flex items-center gap-2">
                  <button disabled={!!prog} onClick={() => editResource(course.id, r.id, { status: nextStatus(r.status) })} title={prog ? 'Suivi par les pages lues' : 'Changer le statut'} className="cursor-pointer disabled:cursor-default shrink-0">
                    <st.Icon size={16} style={{ color: st.color }} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm truncate ${st.value === 'done' ? 'text-mute line-through' : 'text-ink'}`}>{r.title}</div>
                    <div className="text-[10px] text-mute">{resourceLabel(r.type)}{book?.author ? ` · ${book.author}` : ''}</div>
                  </div>
                  {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="p-1 text-mute hover:text-accent" title="Ouvrir"><ExternalLink size={13} /></a>}
                  <button className="p-1 text-mute hover:text-bad cursor-pointer" title="Retirer" onClick={() => deleteResource(course.id, r.id)}><Trash2 size={12} /></button>
                </div>
                {prog && (
                  <div className="mt-2 pl-6">
                    <ProgressBar value={pct} height={5} color={pct >= 100 ? 'var(--success)' : 'var(--accent-primary)'} />
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-mute">
                      <span className="tabular-nums">{prog.pagesRead}/{total} p. · {pct}%</span>
                      <div className="ml-auto flex items-center gap-1">
                        <button className="p-1 rounded border border-line hover:text-ink cursor-pointer disabled:opacity-40" disabled={prog.pagesRead <= 0} onClick={() => removePage(prog.id)}><Minus size={10} /></button>
                        <button className="p-1 rounded border border-line hover:text-ink cursor-pointer disabled:opacity-40" disabled={prog.status === 'completed'} onClick={() => addPage(prog.id)}><Plus size={10} /></button>
                        <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); const v = Number(pageDraft[r.id]); if (v >= 0) setPagesRead(prog.id, v); setPageDraft((d) => ({ ...d, [r.id]: '' })); }}>
                          <input type="number" min="0" placeholder="page" value={pageDraft[r.id] ?? ''} onChange={(e) => setPageDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                            className="w-16 bg-surface border border-line rounded px-1.5 py-0.5 text-[11px] text-ink" />
                        </form>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-mute">Livres, vidéos, cours en ligne, podcasts, outils… Les livres viennent de votre <Link to="/learning?tab=readings" className="text-accent underline">bibliothèque</Link>.</p>
      )}
      <ResourceModal open={open} onClose={() => setOpen(false)} courseId={course.id} />
    </Card>
  );
}
