import { useMemo, useState } from 'react';
import { FolderOpen, Link2, FileText, Youtube, Pencil, ExternalLink, ClipboardPaste, Camera, Loader2 } from 'lucide-react';
import { extractSyllabus, EXTRACT_ERRORS } from '../../services/extract';
import { ASSISTANT_ERRORS } from '../../services/assistant';
import { useLearningStore } from '../../store/learningStore';
import { detectLink, normalizeUrl, isUrl, parseLinkLines, parseProgramme } from '../../utils/links';
import { uid } from '../../utils/formatters';
import { toast } from '../../store/uiStore';
import { Button, Field, Input, Textarea, Modal } from '../common/ui';

// Course material stays where it is (chantier 9): Drive, OneDrive, Dropbox,
// a PDF… VAUDAX keeps the links. Rules: utils/links.js.

export function LinkIcon({ url, size = 14, className = '' }) {
  const d = detectLink(url);
  const Icon = d.folder ? FolderOpen : d.provider === 'youtube' ? Youtube : d.provider === 'pdf' || d.provider === 'gdocs' ? FileText : Link2;
  return <Icon size={size} className={className} aria-hidden="true" />;
}

// « Dossier du cours »: one big button to the course folder.
export function CourseFolder({ course }) {
  const updateCourse = useLearningStore((s) => s.updateCourse);
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(course.folderUrl || '');
  const d = course.folderUrl ? detectLink(course.folderUrl) : null;
  const save = (e) => {
    e.preventDefault();
    const clean = normalizeUrl(url);
    if (clean && !isUrl(clean)) return toast('Ce lien ne semble pas valide.', 'warning');
    updateCourse(course.id, { folderUrl: clean || null });
    setEditing(false);
  };
  return (
    <>
      {course.folderUrl ? (
        <div className="flex items-center gap-2 mt-3">
          <a href={course.folderUrl} target="_blank" rel="noreferrer" className="ui-btn inline-flex items-center gap-2 rounded-xl border border-accent/50 bg-accent/10 px-4 py-2.5 text-sm font-semibold text-accent hover:bg-accent/20">
            <FolderOpen size={17} /> Ouvrir le dossier du cours <span className="font-normal text-mute">· {d.label}</span> <ExternalLink size={13} />
          </a>
          <button type="button" aria-label="Changer le lien du dossier" title="Changer le lien du dossier" onClick={() => { setUrl(course.folderUrl); setEditing(true); }} className="ui-icon-btn inline-flex items-center justify-center p-1.5 text-mute hover:text-accent cursor-pointer"><Pencil size={14} /></button>
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="ui-btn mt-3 inline-flex items-center gap-2 rounded-xl border border-dashed border-line px-4 py-2.5 text-sm text-mute hover:text-ink hover:border-accent cursor-pointer">
          <FolderOpen size={16} /> Lier le dossier du cours (Drive, OneDrive, Dropbox…)
        </button>
      )}
      <Modal open={editing} onClose={() => setEditing(false)} title="Dossier du cours">
        <form onSubmit={save} className="space-y-3">
          <p className="text-sm text-mute">Tes cours, fiches et documents restent dans ton dossier habituel. Copie son lien de partage et colle-le ici : un appui suffira pour l’ouvrir.</p>
          <Field label="Lien du dossier"><Input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" /></Field>
          {url && isUrl(url) && <p className="text-xs text-mute flex items-center gap-1.5"><LinkIcon url={url} /> {detectLink(url).label}</p>}
          <div className="flex justify-between gap-2">
            {course.folderUrl ? <Button type="button" variant="ghost" onClick={() => { updateCourse(course.id, { folderUrl: null }); setEditing(false); }}>Retirer le lien</Button> : <span />}
            <div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => setEditing(false)}>Annuler</Button><Button type="submit">Enregistrer</Button></div>
          </div>
        </form>
      </Modal>
    </>
  );
}

// Several links pasted at once → resources (one per line).
export function PasteLinks({ courseId, onDone }) {
  const addResource = useLearningStore((s) => s.addResource);
  const [text, setText] = useState('');
  const rows = useMemo(() => parseLinkLines(text), [text]);
  const add = () => {
    for (const r of rows) addResource(courseId, { type: r.type, title: r.title, url: r.url, status: 'todo' });
    toast(`${rows.length} lien${rows.length > 1 ? 's' : ''} ajouté${rows.length > 1 ? 's' : ''}`, 'success');
    onDone();
  };
  return (
    <div className="space-y-3">
      <Field label="Colle un ou plusieurs liens, un par ligne" hint="« Titre | lien » ou juste le lien : le titre est deviné. Marche avec Drive, OneDrive, Dropbox, YouTube, un PDF, un site…">
        <Textarea autoFocus rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Cours magistral | https://drive.google.com/…\nhttps://youtu.be/…'} />
      </Field>
      {rows.length > 0 && (
        <ul className="rounded-lg border border-line divide-y divide-line/60 text-sm">
          {rows.map((r, i) => <li key={i} className="flex items-center gap-2 px-3 py-1.5"><LinkIcon url={r.url} className="text-mute shrink-0" /><span className="flex-1 truncate">{r.title}</span><span className="text-xs text-mute">{detectLink(r.url).label}</span></li>)}
        </ul>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>Annuler</Button>
        <Button type="button" disabled={!rows.length} onClick={add}>Ajouter {rows.length || ''} lien{rows.length > 1 ? 's' : ''}</Button>
      </div>
    </div>
  );
}

// The course plan pasted in one go → chapters and tasks, added after the existing ones.
export function PasteProgramme({ course, open, onClose }) {
  const updateCourse = useLearningStore((s) => s.updateCourse);
  const [text, setText] = useState('');
  const [reading, setReading] = useState(false);
  const chapters = useMemo(() => parseProgramme(text), [text]);
  const fromFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setReading(true);
    try {
      const lines = await extractSyllabus(file);
      if (lines) setText((t) => (t.trim() ? `${t.trim()}\n${lines}` : lines));
      else toast('Aucun plan trouvé sur ce document.', 'warning');
    } catch (err) {
      toast(EXTRACT_ERRORS[err.code] || ASSISTANT_ERRORS[err.code] || ASSISTANT_ERRORS.failed, 'error');
    }
    setReading(false);
  };
  const add = () => {
    const made = chapters.map((c) => ({ id: uid(), title: c.title, url: c.url || null, coefficient: 1, checklistItems: c.items.map((it) => ({ id: uid(), title: it.title, url: it.url || null, coefficient: 1, completed: false, completedDate: null })) }));
    updateCourse(course.id, { chapters: [...(course.chapters || []), ...made] });
    toast(`${made.length} chapitre${made.length > 1 ? 's' : ''} ajouté${made.length > 1 ? 's' : ''}`, 'success');
    setText('');
    onClose();
  };
  const tasks = chapters.reduce((a, c) => a + c.items.length, 0);
  return (
    <Modal open={open} onClose={onClose} title="Coller le programme" wide>
      <div className="space-y-3">
        <p className="text-sm text-mute">Copie le plan du cours (syllabus, sommaire du polycopié…) et colle-le : une ligne = un chapitre, une ligne qui commence par un tiret « - » = une tâche du chapitre au-dessus. Un lien dans une ligne y reste attaché.</p>
        <label className="ui-btn inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm cursor-pointer hover:border-accent">
          {reading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />} {reading ? 'Lecture du document…' : 'Depuis une photo ou un PDF du programme'}
          <input type="file" accept="image/*,application/pdf" className="sr-only" disabled={reading} onChange={fromFile} />
        </label>
        <Textarea autoFocus rows={9} value={text} onChange={(e) => setText(e.target.value)} placeholder={'1. Introduction\n- Lire le chapitre 1\n- Exercices 1 à 5\n2. Le bilan https://drive.google.com/…\n3. Le compte de résultat'} />
        {chapters.length > 0 && <p className="text-sm"><ClipboardPaste size={14} className="inline mr-1 text-accent" /> {chapters.length} chapitre{chapters.length > 1 ? 's' : ''}{tasks ? ` et ${tasks} tâche${tasks > 1 ? 's' : ''}` : ''} vont être ajoutés.</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="button" disabled={!chapters.length} onClick={add}>Ajouter</Button>
        </div>
      </div>
    </Modal>
  );
}
