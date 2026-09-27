import { useEffect, useState } from 'react';
import { useLearningStore } from '../../store/learningStore';
import { useSkillStore } from '../../store/skillStore';
import { COURSE_TEMPLATES } from '../../utils/course-templates';
import { EVALUATION_PRESETS } from '../../utils/academic';
import { Button, Field, Input, Select, Modal } from '../common/ui';
import SkillPicker from '../common/SkillPicker';
import { useAcademicSettings } from './design';
import { numOrNull } from './cursus-utils';

export const blankForm = (kind, termId, moduleId, institution, preset) => ({
  kind, name: '', termId: termId || '', moduleId: moduleId || '', coefficient: 1, credits: '',
  professor: '', institution: institution || '', targetGrade: '', preset: preset || 'cc40', template: '',
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
      setF(blankForm(initialKind, termId || settings.activeTermId, moduleId, settings.institution, settings.defaultEvalPreset));
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
              <Field label="Évaluations" hint="Tu pourras ajuster les poids, dates et notes dans la matière.">
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
