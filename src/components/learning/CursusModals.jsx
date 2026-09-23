import { useEffect, useMemo, useState } from 'react';
import { Settings2, Info } from 'lucide-react';
import { useLearningStore } from '../../store/learningStore';
import { useSkillStore } from '../../store/skillStore';
import { COURSE_TEMPLATES } from '../../utils/course-templates';
import {
  GRADING_PRESETS, EVALUATION_PRESETS, parseSubjectLines,
} from '../../utils/academic';
import { Button, Field, Input, Select, Modal, Textarea } from '../common/ui';
import SkillPicker from '../common/SkillPicker';
import { useAcademicSettings, tint } from './design';

const numOrNull = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));

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
  const { addModule, editModule, deleteModule } = useLearningStore();
  const [f, setF] = useState({});
  const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => {
    if (!open) return;
    setF(module ? { ...module, credits: module.credits ?? '' } : { name: '', coefficient: 1, credits: '' });
    setConfirmDel(false);
  }, [open, module]);

  const save = (e) => {
    e.preventDefault();
    if (!f.name?.trim()) return;
    const data = { name: f.name.trim(), coefficient: numOrNull(f.coefficient) || 1, credits: numOrNull(f.credits) };
    if (module) editModule(module.id, data);
    else addModule({ ...data, termId });
    onClose();
  };
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
  const [preset, setPreset] = useState('cc40');
  const rows = useMemo(() => parseSubjectLines(text), [text]);
  useEffect(() => { if (open) setText(''); }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Ajouter plusieurs matières" wide>
      <div className="space-y-4">
        <p className="text-sm text-mute">
          Collez la liste de votre semestre, <b className="text-ink">une matière par ligne</b> :
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
      eliminatoryMark: numOrNull(f.eliminatoryMark),
      subjectCompensation: !!f.subjectCompensation,
      moduleCompensation: !!f.moduleCompensation,
      retakeRule: f.retakeRule,
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
          <Field label="Note de validation"><Input type="number" step="0.25" value={f.passMark ?? ''} onChange={(e) => setF({ ...f, passMark: e.target.value })} /></Field>
          <Field label="Note éliminatoire" hint="Vide = aucune"><Input type="number" step="0.25" value={f.eliminatoryMark ?? ''} onChange={(e) => setF({ ...f, eliminatoryMark: e.target.value })} /></Field>
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

        <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: tint('var(--accent-primary)', 8), color: 'var(--text-secondary)' }}>
          <Info size={14} className="shrink-0 mt-0.5 text-accent" />
          Vérifiez ces règles dans le règlement pédagogique de votre établissement : toutes les moyennes, statuts et « notes nécessaires » en dépendent.
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
const blankForm = (kind, termId, moduleId, institution) => ({
  kind, name: '', termId: termId || '', moduleId: moduleId || '', coefficient: 1, credits: '',
  professor: '', institution: institution || '', targetGrade: '', preset: 'cc40', template: '',
  linkedSkills: [],
});

export function CourseFormModal({ open, onClose, kind: initialKind = 'academic', termId, moduleId, course, onCreated }) {
  const { addCourse, editCourse } = useLearningStore();
  const academic = useLearningStore((s) => s.academic);
  const skills = useSkillStore((s) => s.skills);
  const settings = useAcademicSettings();
  const [f, setF] = useState(blankForm(initialKind));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (course) {
      setF({
        ...blankForm(course.kind || 'free'),
        ...course,
        kind: course.kind || 'free',
        termId: course.termId || '', moduleId: course.moduleId || '',
        credits: course.credits ?? '', targetGrade: course.targetGrade ?? '',
      });
    } else {
      setF(blankForm(initialKind, termId || settings.activeTermId, moduleId, settings.institution));
    }
  }, [open, course]); // eslint-disable-line react-hooks/exhaustive-deps

  const isAcad = f.kind === 'academic';
  const termModules = academic.modules.filter((m) => m.termId === f.termId);

  const applyTemplate = (value) => {
    const [group, name] = value.split('||');
    const tpl = COURSE_TEMPLATES.find((g) => g.group === group)?.items.find((i) => i.name === name);
    if (!tpl) return setF({ ...f, template: value });
    setF({ ...f, template: value, name: tpl.name, linkedSkills: tpl.skills.filter((id) => skills[id] && !skills[id].locked) });
  };

  const submit = (e) => {
    e.preventDefault();
    if (!f.name.trim()) return setError('Le nom est obligatoire.');
    const target = numOrNull(f.targetGrade);
    if (isAcad && target != null && (target < 0 || target > settings.scale)) return setError(`La note visée doit être entre 0 et ${settings.scale}.`);
    const base = {
      kind: f.kind,
      name: f.name.trim(),
      professor: f.professor || '',
      institution: f.institution || '',
      credits: numOrNull(f.credits) ?? 0,
      linkedSkills: f.linkedSkills || [],
    };
    const acad = isAcad
      ? { termId: f.termId || null, moduleId: f.moduleId || null, coefficient: numOrNull(f.coefficient) || 1, targetGrade: target }
      : {};
    if (course) {
      editCourse(course.id, { ...base, ...acad });
    } else {
      const preset = EVALUATION_PRESETS.find((p) => p.key === f.preset);
      const id = addCourse({
        ...base, ...acad,
        expectedGrade: 'A', progressPercent: 0, chapters: [],
        evaluations: isAcad && preset ? preset.evals.map(([type, name, weight]) => ({ type, name, weight })) : [],
      });
      onCreated?.(id);
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={course ? 'Modifier' : isAcad ? 'Nouvelle matière' : 'Nouveau cours libre'}>
      <form onSubmit={submit} className="space-y-3">
        {!course && (
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-surface border border-line">
            {[['academic', 'Matière du cursus'], ['free', 'Cours libre / formation']].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setF({ ...f, kind: k })}
                className={`rounded-lg px-3 py-2 text-sm font-medium cursor-pointer transition-colors ${f.kind === k ? 'bg-card text-ink ring-1 ring-line shadow-sm' : 'text-mute hover:text-ink'}`}>
                {label}
              </button>
            ))}
          </div>
        )}

        {!isAcad && !course && (
          <Field label="Modèle (optionnel)" hint="Pré-remplit le nom et les compétences liées.">
            <Select value={f.template} onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">— Partir de zéro —</option>
              {COURSE_TEMPLATES.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map((i) => <option key={i.name} value={`${g.group}||${i.name}`}>{i.name}</option>)}
                </optgroup>
              ))}
            </Select>
          </Field>
        )}

        <Field label={isAcad ? 'Nom de la matière' : 'Nom du cours'}>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus placeholder={isAcad ? 'Comptabilité générale' : 'Price action — cours avancé'} />
        </Field>

        {isAcad ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Semestre">
                <Select value={f.termId} onChange={(e) => setF({ ...f, termId: e.target.value, moduleId: '' })}
                  options={[{ value: '', label: '— Aucun —' }, ...academic.terms.map((t) => ({ value: t.id, label: `${t.name}${t.year ? ` · ${t.year}` : ''}` }))]} />
              </Field>
              <Field label="Module">
                <Select value={f.moduleId} onChange={(e) => setF({ ...f, moduleId: e.target.value })}
                  options={[{ value: '', label: '— Sans module —' }, ...termModules.map((m) => ({ value: m.id, label: m.name }))]} />
              </Field>
              <Field label="Coefficient"><Input type="number" step="0.5" min="0.5" value={f.coefficient} onChange={(e) => setF({ ...f, coefficient: e.target.value })} /></Field>
              <Field label="Crédits (optionnel)"><Input type="number" min="0" value={f.credits} onChange={(e) => setF({ ...f, credits: e.target.value })} /></Field>
              <Field label={`Note visée (/${settings.scale})`}><Input type="number" step="0.25" value={f.targetGrade} onChange={(e) => setF({ ...f, targetGrade: e.target.value })} placeholder={`ex. ${Math.round(settings.scale * 0.7)}`} /></Field>
              <Field label="Professeur"><Input value={f.professor} onChange={(e) => setF({ ...f, professor: e.target.value })} /></Field>
            </div>
            {!course && (
              <Field label="Évaluations" hint="Vous pourrez ajuster les poids, dates et notes dans la matière.">
                <Select value={f.preset} onChange={(e) => setF({ ...f, preset: e.target.value })} options={EVALUATION_PRESETS.map((p) => ({ value: p.key, label: p.label }))} />
              </Field>
            )}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Plateforme / établissement"><Input value={f.institution} onChange={(e) => setF({ ...f, institution: e.target.value })} placeholder="Coursera, YouTube, livre…" /></Field>
            <Field label="Formateur"><Input value={f.professor} onChange={(e) => setF({ ...f, professor: e.target.value })} /></Field>
          </div>
        )}

        <Field label="Compétences liées (XP à la fin du cours)">
          <SkillPicker value={f.linkedSkills} onChange={(ids) => setF({ ...f, linkedSkills: ids })} />
        </Field>

        {error && <p className="text-bad text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit">{course ? 'Enregistrer' : 'Ajouter'}</Button>
        </div>
      </form>
    </Modal>
  );
}
