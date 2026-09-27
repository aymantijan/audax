import { useEffect, useMemo, useState } from 'react';
import { Settings2, Info } from 'lucide-react';
import { useLearningStore } from '../../store/learningStore';
import { GRADING_PRESETS, EVALUATION_PRESETS, parseSubjectLines } from '../../utils/academic';
import { Button, Field, Input, Select, Modal, Textarea } from '../common/ui';
import { useAcademicSettings, tint } from './design';
import { numOrNull } from './cursus-utils';

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer py-1">
      <input type="checkbox" className="mt-1 accent-[var(--accent-primary)]" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm text-ink">{label}</span>
        {hint && <span className="block text-[11px] text-mute">{hint}</span>}
      </span>
    </label>
  );
}

// ── Semester ─────────────────────────────────────────────────────────────
export function TermModal({ open, onClose, term }) {
  const { addTerm, editTerm, deleteTerm } = useLearningStore();
  const terms = useLearningStore((s) => s.academic.terms);
  const [f, setF] = useState({});
  useEffect(() => {
    if (!open) return;
    setF(term || { name: `S${terms.length + 1}`, year: '2026-2027', startDate: '', endDate: '' });
  }, [open, term]); // eslint-disable-line react-hooks/exhaustive-deps
  const [confirmDel, setConfirmDel] = useState(false);

  const save = (e) => {
    e.preventDefault();
    if (!f.name?.trim()) return;
    if (term) editTerm(term.id, f);
    else addTerm(f);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={term ? 'Modifier le semestre' : 'Nouveau semestre'}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom"><Input value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="S1" autoFocus /></Field>
          <Field label="Année universitaire"><Input value={f.year || ''} onChange={(e) => setF({ ...f, year: e.target.value })} placeholder="2026-2027" /></Field>
          <Field label="Début"><Input type="date" value={f.startDate || ''} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
          <Field label="Fin (après les examens)"><Input type="date" value={f.endDate || ''} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
          <Field label="Début des partiels" hint="Laisse vide si elle est inconnue. Les matières réglées « jusqu’aux partiels » s’arrêtent à cette date.">
            <Input type="date" value={f.midtermsDate || ''} onChange={(e) => setF({ ...f, midtermsDate: e.target.value })} />
          </Field>
        </div>
        <div className="flex items-center gap-3 pt-2">
          {term && (confirmDel ? (
            <span className="flex items-center gap-2 text-xs">
              <span className="text-bad">Supprimer ? Les matières sont conservées.</span>
              <Button type="button" variant="danger" onClick={() => { deleteTerm(term.id); onClose(); }}>Oui</Button>
              <Button type="button" variant="ghost" onClick={() => setConfirmDel(false)}>Non</Button>
            </span>
          ) : (
            <Button type="button" variant="ghost" onClick={() => setConfirmDel(true)}>Supprimer</Button>
          ))}
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
            <Button type="submit">Enregistrer</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ── Module (UE) ──────────────────────────────────────────────────────────
export function ModuleModal({ open, onClose, termId, module }) {
  const { addModule, editModule, deleteModule, editCourse } = useLearningStore();
  const courses = useLearningStore((s) => s.courses);
  const modules = useLearningStore((s) => s.academic.modules);
  const [f, setF] = useState({});
  const [picked, setPicked] = useState({}); // courseId -> coefficient (string) for subjects in this module
  const [confirmDel, setConfirmDel] = useState(false);
  const subjects = courses.filter((c) => c.kind === 'academic' && c.termId === termId && c.status !== 'dropped');
  useEffect(() => {
    if (!open) return;
    setF(module ? { ...module, credits: module.credits ?? '' } : { name: '', coefficient: 1, credits: '' });
    setPicked(Object.fromEntries(subjects.filter((c) => module && c.moduleId === module.id).map((c) => [c.id, String(c.coefficient ?? 1)])));
    setConfirmDel(false);
  }, [open, module]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (e) => {
    e.preventDefault();
    if (!f.name?.trim()) return;
    const data = { name: f.name.trim(), coefficient: numOrNull(f.coefficient) || 1, credits: numOrNull(f.credits) };
    let id = module?.id;
    if (module) editModule(module.id, data);
    else id = addModule({ ...data, termId });
    // Subjects ticked join this module (with their coefficient inside it); unticked ones leave it.
    for (const c of subjects) {
      if (picked[c.id] != null) {
        const coefficient = numOrNull(picked[c.id]) || 1;
        if (c.moduleId !== id || Number(c.coefficient ?? 1) !== coefficient) editCourse(c.id, { moduleId: id, coefficient });
      } else if (c.moduleId === id) editCourse(c.id, { moduleId: null });
    }
    onClose();
  };
  const moduleName = (id) => modules.find((m) => m.id === id)?.name;
  return (
    <Modal open={open} onClose={onClose} title={module ? 'Modifier le module' : 'Nouveau module'}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Nom du module" hint="Ex. « Fondamentaux de gestion », « Méthodes quantitatives »">
          <Input value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Coefficient dans le semestre"><Input type="number" step="0.5" min="0.5" value={f.coefficient ?? 1} onChange={(e) => setF({ ...f, coefficient: e.target.value })} /></Field>
          <Field label="Crédits (optionnel)" hint="Vide = somme des matières"><Input type="number" min="0" value={f.credits ?? ''} onChange={(e) => setF({ ...f, credits: e.target.value })} /></Field>
        </div>
        {subjects.length > 0 && (
          <div>
            <div className="text-xs text-mute mb-1.5">Matières de ce module <span className="opacity-70">· coefficient de chaque matière dans le module</span></div>
            <div className="rounded-lg border border-line divide-y divide-line/60 max-h-64 overflow-y-auto">
              {subjects.map((c) => {
                const on = picked[c.id] != null;
                const elsewhere = !on && c.moduleId && c.moduleId !== module?.id ? moduleName(c.moduleId) : null;
                return (
                  <div key={c.id} className="flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-surface/60">
                    <label className="flex-1 min-w-0 flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" className="accent-[var(--accent-primary)]" checked={on}
                        onChange={(e) => setPicked((cur) => { const n = { ...cur }; if (e.target.checked) n[c.id] = String(c.coefficient ?? 1); else delete n[c.id]; return n; })} />
                      <span className="flex-1 min-w-0 truncate text-ink">{c.name}{elsewhere && <span className="text-[11px] text-mute"> · dans « {elsewhere} »</span>}</span>
                    </label>
                    {on && (
                      <input type="number" step="0.5" min="0.5" value={picked[c.id]} aria-label={`Coefficient de ${c.name}`}
                        onChange={(e) => setPicked((cur) => ({ ...cur, [c.id]: e.target.value }))} title="Coefficient dans le module"
                        className="w-16 bg-surface border border-line rounded-md px-2 py-1 text-sm text-ink text-center focus:outline-none focus:border-accent" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 pt-2">
          {module && (confirmDel ? (
            <span className="flex items-center gap-2 text-xs">
              <span className="text-bad">Supprimer ? Ses matières restent dans le semestre.</span>
              <Button type="button" variant="danger" onClick={() => { deleteModule(module.id); onClose(); }}>Oui</Button>
              <Button type="button" variant="ghost" onClick={() => setConfirmDel(false)}>Non</Button>
            </span>
          ) : (
            <Button type="button" variant="ghost" onClick={() => setConfirmDel(true)}>Supprimer</Button>
          ))}
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
            <Button type="submit">Enregistrer</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ── Bulk import (paste the syllabus) ─────────────────────────────────────
export function BulkImportModal({ open, onClose, termId }) {
  const importSubjects = useLearningStore((s) => s.importSubjects);
  const [text, setText] = useState('');
  const defaultPreset = useAcademicSettings().defaultEvalPreset || 'cc40';
  const [preset, setPreset] = useState(defaultPreset);
  const rows = useMemo(() => parseSubjectLines(text), [text]);
  useEffect(() => { if (open) { setText(''); setPreset(defaultPreset); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal open={open} onClose={onClose} title="Ajouter plusieurs matières" wide>
      <div className="space-y-4">
        <p className="text-sm text-mute">
          Colle la liste de ton semestre, <b className="text-ink">une matière par ligne</b> :
          <code className="ml-1 text-xs bg-surface border border-line rounded px-1.5 py-0.5">Matière ; coefficient ; module ; crédits</code>.
          Seul le nom est obligatoire. Les modules sont créés automatiquement.
        </p>
        <Textarea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Comptabilité générale ; 3 ; Fondamentaux de gestion ; 4\nMathématiques financières ; 2 ; Méthodes quantitatives\nStatistiques ; 2 ; Méthodes quantitatives\nAnglais des affaires ; 1 ; Langues'}
        />
        <Field label="Répartition des évaluations par défaut" hint="Modifiable ensuite matière par matière.">
          <Select value={preset} onChange={(e) => setPreset(e.target.value)} options={EVALUATION_PRESETS.map((p) => ({ value: p.key, label: p.label }))} />
        </Field>
        {rows.length > 0 && (
          <div className="rounded-lg border border-line overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs text-mute">
                <tr><th className="text-left px-3 py-2">Matière</th><th className="px-3 py-2">Coef.</th><th className="text-left px-3 py-2">Module</th><th className="px-3 py-2">Crédits</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-line/60">
                    <td className="px-3 py-1.5">{r.name}</td>
                    <td className="px-3 py-1.5 text-center tabular-nums">{r.coefficient}</td>
                    <td className="px-3 py-1.5 text-mute">{r.module || '—'}</td>
                    <td className="px-3 py-1.5 text-center tabular-nums">{r.credits ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button disabled={!rows.length} onClick={() => { importSubjects(termId, rows, preset); onClose(); }}>
            Ajouter {rows.length || ''} matière{rows.length > 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Timetable import (paste the weekly planning) ─────────────────────────
export function EvaluationSplitModal({ open, onClose, termId }) {
  const apply = useLearningStore((s) => s.applyEvaluationPreset);
  const courses = useLearningStore((s) => s.courses);
  const settings = useAcademicSettings();
  const [preset, setPreset] = useState('cc_cf_tass');
  useEffect(() => { if (open) setPreset(settings.defaultEvalPreset || 'cc_cf_tass'); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const subjects = courses.filter((c) => c.kind === 'academic' && c.termId === termId);
  const graded = subjects.filter((c) => (c.evaluations || []).some((e) => e.grade != null && e.grade !== ''));
  const chosen = EVALUATION_PRESETS.find((p) => p.key === preset);

  return (
    <Modal open={open} onClose={onClose} title="Répartition des évaluations">
      <div className="space-y-4">
        <p className="text-sm text-mute">
          Applique la même répartition à <b className="text-ink">toutes les matières du semestre</b> ({subjects.length}).
          Elle devient aussi la répartition par défaut des nouvelles matières. Une matière différente se modifie ensuite sur sa page.
        </p>
        <Field label="Répartition">
          <Select value={preset} onChange={(e) => setPreset(e.target.value)} options={EVALUATION_PRESETS.filter((p) => p.evals.length).map((p) => ({ value: p.key, label: p.label }))} />
        </Field>
        {chosen && (
          <div className="flex flex-wrap gap-1.5">
            {chosen.evals.map(([, name, w]) => <span key={name} className="text-xs rounded-md border border-line px-2 py-1 text-mute">{name} <b className="text-ink">{w} %</b></span>)}
          </div>
        )}
        {graded.length > 0 && (
          <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-mute">
            Déjà notée{graded.length > 1 ? 's' : ''}, donc inchangée{graded.length > 1 ? 's' : ''} : {graded.map((c) => c.name).join(', ')}.
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button disabled={!subjects.length || subjects.length === graded.length} onClick={() => { apply(termId, preset); onClose(); }}>
            Appliquer à {subjects.length - graded.length} matière{subjects.length - graded.length > 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Grading rules ────────────────────────────────────────────────────────
export function GradingSettingsModal({ open, onClose }) {
  const settings = useAcademicSettings();
  const update = useLearningStore((s) => s.updateAcademicSettings);
  const [f, setF] = useState(settings);
  useEffect(() => { if (open) setF(settings); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyPreset = (key) => {
    const p = GRADING_PRESETS.find((x) => x.key === key);
    if (p) setF((cur) => ({ ...cur, ...p.settings }));
  };
  const save = (e) => {
    e.preventDefault();
    const scale = numOrNull(f.scale) || 20;
    update({
      institution: f.institution || '',
      program: f.program || '',
      scale,
      passMark: numOrNull(f.passMark) ?? scale / 2,
      subjectPassMark: numOrNull(f.subjectPassMark),
      modulePassMark: numOrNull(f.modulePassMark),
      eliminatoryMark: numOrNull(f.eliminatoryMark),
      subjectCompensation: !!f.subjectCompensation,
      moduleCompensation: !!f.moduleCompensation,
      retakeRule: f.retakeRule,
      arriveBeforeMin: Math.max(0, numOrNull(f.arriveBeforeMin) ?? 5),
      classReminderMin: Math.max(0, numOrNull(f.classReminderMin) ?? 0),
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Établissement & règles de notation" wide>
      <form onSubmit={save} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Établissement"><Input value={f.institution || ''} onChange={(e) => setF({ ...f, institution: e.target.value })} placeholder="ISCAE, Sorbonne, MIT…" /></Field>
          <Field label="Programme / filière"><Input value={f.program || ''} onChange={(e) => setF({ ...f, program: e.target.value })} placeholder="Programme Grande École — 1re année" /></Field>
        </div>

        <div>
          <div className="text-xs text-mute mb-2">Partir d'un modèle</div>
          <div className="flex flex-wrap gap-2">
            {GRADING_PRESETS.map((p) => (
              <button key={p.key} type="button" onClick={() => applyPreset(p.key)}
                className="rounded-lg border border-line px-3 py-1.5 text-xs text-mute hover:text-ink hover:border-accent cursor-pointer transition-colors">
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Noté sur"><Input type="number" min="1" value={f.scale ?? ''} onChange={(e) => setF({ ...f, scale: e.target.value })} /></Field>
          <Field label="Validation du semestre"><Input type="number" step="0.25" value={f.passMark ?? ''} onChange={(e) => setF({ ...f, passMark: e.target.value })} /></Field>
          <Field label="Note éliminatoire" hint="Vide = aucune"><Input type="number" step="0.25" value={f.eliminatoryMark ?? ''} onChange={(e) => setF({ ...f, eliminatoryMark: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Validation d’une matière" hint="Vide = même note que le semestre. ISCAE : 7">
            <Input type="number" step="0.25" value={f.subjectPassMark ?? ''} onChange={(e) => setF({ ...f, subjectPassMark: e.target.value })} />
          </Field>
          <Field label="Validation d’un module" hint="Vide = même note que le semestre. ISCAE : 8">
            <Input type="number" step="0.25" value={f.modulePassMark ?? ''} onChange={(e) => setF({ ...f, modulePassMark: e.target.value })} />
          </Field>
        </div>

        <div className="rounded-xl border border-line p-3 space-y-1">
          <Toggle checked={f.subjectCompensation} onChange={(v) => setF({ ...f, subjectCompensation: v })}
            label="Compensation entre matières d'un module"
            hint="Un module est validé si sa moyenne atteint la note de validation, même avec une matière en dessous (sauf note éliminatoire)." />
          <Toggle checked={f.moduleCompensation} onChange={(v) => setF({ ...f, moduleCompensation: v })}
            label="Compensation entre modules du semestre"
            hint="Le semestre est validé si sa moyenne atteint la note de validation, sans module sous la note éliminatoire." />
        </div>

        <Field label="Rattrapage">
          <Select value={f.retakeRule} onChange={(e) => setF({ ...f, retakeRule: e.target.value })} options={[
            { value: 'capped', label: 'Meilleure note, plafonnée à la note de validation' },
            { value: 'max', label: 'Meilleure des deux notes' },
            { value: 'replace', label: 'La note de rattrapage remplace la moyenne' },
          ]} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Assiduité : être en salle (min avant)" hint="Pointer « En salle » avant compte comme à l’heure.">
            <Input type="number" min="0" max="60" value={f.arriveBeforeMin ?? 5} onChange={(e) => setF({ ...f, arriveBeforeMin: e.target.value })} />
          </Field>
          <Field label="Rappel avant chaque cours (min)" hint="0 = pas de rappel. L’app doit être ouverte.">
            <Input type="number" min="0" max="180" value={f.classReminderMin ?? 20} onChange={(e) => setF({ ...f, classReminderMin: e.target.value })} />
          </Field>
        </div>

        <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: tint('var(--accent-primary)', 8), color: 'var(--text-secondary)' }}>
          <Info size={14} className="shrink-0 mt-0.5 text-accent" />
          Vérifie ces règles dans le règlement pédagogique de ton établissement : toutes les moyennes, statuts et « notes nécessaires » en dépendent.
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit"><span className="flex items-center gap-2"><Settings2 size={14} /> Enregistrer</span></Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Subject (academic) or free course ────────────────────────────────────

// Moved to their own files; re-exported so existing imports keep working.
export { TimetableImportModal } from './TimetableImportModal';
export { CourseFormModal } from './CourseFormModal';
