import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Pencil, GraduationCap, Layers, ClipboardList, CalendarClock, Target, Settings2, ChevronRight, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { useLearningStore } from '../../store/learningStore';
import {
  termResult, requiredGrade, upcomingEvaluations, daysUntil, evalTypeLabel, normGrade, fmtGrade,
} from '../../utils/academic';
import { calculateCourseProgress } from '../../utils/course-progress';
import { todayKey } from '../../utils/formatters';
import { Button, Card } from '../common/ui';
import {
  useAcademicSettings, GradePill, StatusPill, MentionTag, BigStat, SectionHeader, tint, gradeColor, frDate, countdownLabel,
} from './design';
import { TermModal, ModuleModal, BulkImportModal, GradingSettingsModal, CourseFormModal } from './CursusModals';

// Semester progress through its dates (week X / Y).
function termProgress(term, today) {
  if (!term?.startDate || !term?.endDate) return null;
  const total = Math.max(1, daysUntil(term.endDate, term.startDate) + 1);
  const elapsed = Math.min(total, Math.max(0, daysUntil(today, term.startDate) + 1));
  return { pct: Math.round((elapsed / total) * 100), week: Math.max(1, Math.ceil(elapsed / 7)), weeks: Math.ceil(total / 7), notStarted: today < term.startDate, left: total - elapsed };
}

function EvalChips({ course, settings }) {
  const evals = course.evaluations || [];
  if (!evals.length) return <span className="text-[11px] text-mute">Aucune évaluation</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {evals.map((e) => {
        const g = normGrade(e, settings);
        return (
          <span key={e.id} className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[11px] text-mute whitespace-nowrap">
            {evalTypeLabel(e.type, true)} <span className="opacity-60">{e.weight}%</span>
            <span className="font-semibold tabular-nums" style={{ color: g == null ? 'var(--text-secondary)' : gradeColor(g, settings) }}>{g == null ? '—' : fmtGrade(g)}</span>
          </span>
        );
      })}
    </div>
  );
}

function NeededHint({ course, settings }) {
  const target = course.targetGrade ?? settings.passMark;
  const req = requiredGrade(course, target, settings);
  if (!req) return null;
  const label = course.targetGrade != null ? `pour ${fmtGrade(target)}` : 'pour valider';
  if (req.status === 'secured') return <span className="text-[11px] text-good flex items-center gap-1"><CheckCircle2 size={11} /> {course.targetGrade != null ? 'Objectif' : 'Validation'} assuré(e)</span>;
  if (req.status === 'impossible') return <span className="text-[11px] text-bad flex items-center gap-1"><AlertTriangle size={11} /> {label} : hors d'atteinte</span>;
  return (
    <span className="text-[11px] text-mute">
      Il te faut <b className="tabular-nums" style={{ color: gradeColor(req.needed, settings) }}>{fmtGrade(req.needed)}</b> {label}
    </span>
  );
}

function SubjectRow({ course, result, settings }) {
  const progress = calculateCourseProgress(course);
  return (
    <Link to={`/learning/course/${course.id}`}
      className="group grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_auto] gap-x-4 gap-y-1.5 items-center px-4 py-3 hover:bg-surface/60 transition-colors">
      <div className="min-w-0">
        <div className="font-medium text-sm text-ink truncate group-hover:text-accent transition-colors">{course.name}</div>
        <div className="text-[11px] text-mute mt-0.5 flex items-center gap-2 flex-wrap">
          <span>coef. {course.coefficient ?? 1}</span>
          {Number(course.credits) > 0 && <span>· {course.credits} crédits</span>}
          {course.chapters?.length > 0 && <span>· programme {progress}%</span>}
          {course.status === 'completed' && <span className="text-good">· terminé</span>}
        </div>
      </div>
      <div className="hidden sm:block min-w-0">
        <EvalChips course={course} settings={settings} />
        <div className="mt-1"><NeededHint course={course} settings={settings} /></div>
      </div>
      <div className="flex items-center gap-2 justify-end">
        <GradePill value={result.value} settings={settings} />
        <ChevronRight size={15} className="text-mute group-hover:text-accent" />
      </div>
      <div className="sm:hidden col-span-2"><NeededHint course={course} settings={settings} /></div>
    </Link>
  );
}

function UnitCard({ unit, settings, onEditModule, onAddSubject }) {
  const m = unit.module;
  return (
    <div className="rounded-xl border border-line bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line" style={{ background: tint(m ? 'var(--accent-primary)' : 'var(--text-secondary)', 6) }}>
        <Layers size={15} className="text-accent shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-ink truncate">{m ? m.name : 'Matière hors module'}</span>
            <StatusPill status={unit.status} />
          </div>
          <div className="text-[11px] text-mute mt-0.5">
            {m && <>coef. {unit.coefficient} · </>}{unit.subjects.length} matière{unit.subjects.length > 1 ? 's' : ''}
            {unit.credits > 0 && <> · {unit.credits} crédits</>}
          </div>
        </div>
        <div className="text-right">
          <GradePill value={unit.avg} settings={settings} size="lg" />
        </div>
        {m && (
          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded-md text-mute hover:text-accent hover:bg-surface cursor-pointer" title="Ajouter une matière" onClick={() => onAddSubject(m.id)}><Plus size={14} /></button>
            <button className="p-1.5 rounded-md text-mute hover:text-accent hover:bg-surface cursor-pointer" title="Modifier le module" onClick={() => onEditModule(m)}><Pencil size={13} /></button>
          </div>
        )}
      </div>
      {unit.subjects.length ? (
        <div className="divide-y divide-line/60">
          {unit.subjects.map(({ course, r }) => <SubjectRow key={course.id} course={course} result={r} settings={settings} />)}
        </div>
      ) : (
        <button onClick={() => onAddSubject(m?.id)} className="w-full px-4 py-4 text-sm text-mute hover:text-accent cursor-pointer text-left flex items-center gap-2">
          <Plus size={14} /> Ajouter la première matière de ce module
        </button>
      )}
    </div>
  );
}

function Onboarding({ onCreateTerm, onSettings, settings }) {
  const steps = [
    { icon: Settings2, title: 'Règles de notation', text: `Barème /${settings.scale}, validation à ${settings.passMark}, compensation, rattrapage.`, action: onSettings, cta: 'Configurer' },
    { icon: CalendarClock, title: 'Semestre', text: 'Créez S1 avec ses dates pour suivre les semaines.', action: onCreateTerm, cta: 'Créer S1' },
    { icon: ClipboardList, title: 'Matières', text: 'Collez la liste du syllabus : modules et coefficients en une fois.' },
    { icon: Target, title: 'Notes & objectifs', text: 'Saisissez vos notes : moyenne en direct et note nécessaire à l’examen.' },
  ];
  return (
    <div className="rounded-2xl border border-line p-6 sm:p-8" style={{ background: `linear-gradient(135deg, ${tint('var(--accent-primary)', 10)}, var(--bg-tertiary) 60%)` }}>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: tint('var(--accent-primary)', 18) }}>
          <GraduationCap size={22} className="text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-ink">Configurez votre cursus</h2>
          <p className="text-sm text-mute">Semestres, modules, coefficients et notes : votre moyenne calculée en temps réel.</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
        {steps.map((s, i) => (
          <div key={s.title} className="rounded-xl bg-card/80 border border-line p-4 flex flex-col">
            <div className="flex items-center gap-2 text-xs text-mute"><span className="w-5 h-5 rounded-full bg-surface border border-line flex items-center justify-center text-[10px] font-bold text-ink">{i + 1}</span><s.icon size={14} className="text-accent" /></div>
            <div className="font-semibold text-sm text-ink mt-2">{s.title}</div>
            <p className="text-xs text-mute mt-1 flex-1">{s.text}</p>
            {s.action && <Button variant={i === 1 ? 'primary' : 'secondary'} className="mt-3 !py-1.5" onClick={s.action}>{s.cta}</Button>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CursusView() {
  const courses = useLearningStore((s) => s.courses);
  const academic = useLearningStore((s) => s.academic);
  const setActiveTerm = useLearningStore((s) => s.setActiveTerm);
  const settings = useAcademicSettings();
  const today = todayKey();

  const [termModal, setTermModal] = useState(null); // null | { term }
  const [moduleModal, setModuleModal] = useState(null); // null | { module }
  const [subjectModal, setSubjectModal] = useState(null); // null | { moduleId }
  const [bulkOpen, setBulkOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const terms = academic.terms;
  const term = terms.find((t) => t.id === settings.activeTermId) || terms[terms.length - 1] || null;
  const result = useMemo(
    () => (term ? termResult(term.id, academic.modules, courses, settings) : null),
    [term, academic.modules, courses, settings.scale, settings.passMark, settings.eliminatoryMark, settings.subjectCompensation, settings.moduleCompensation, settings.retakeRule] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const nextExam = useMemo(() => {
    if (!term) return null;
    return upcomingEvaluations(result?.courses || [], today).find((x) => !x.past && normGrade(x.ev, settings) == null) || null;
  }, [result, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const prog = termProgress(term, today);

  const modals = (
    <>
      <TermModal open={!!termModal} onClose={() => setTermModal(null)} term={termModal?.term} />
      <ModuleModal open={!!moduleModal} onClose={() => setModuleModal(null)} termId={term?.id} module={moduleModal?.module} />
      <CourseFormModal open={!!subjectModal} onClose={() => setSubjectModal(null)} kind="academic" termId={term?.id} moduleId={subjectModal?.moduleId} />
      <BulkImportModal open={bulkOpen} onClose={() => setBulkOpen(false)} termId={term?.id} />
      <GradingSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );

  if (!term) {
    return (
      <>
        <Onboarding settings={settings} onCreateTerm={() => setTermModal({})} onSettings={() => setSettingsOpen(true)} />
        {modals}
      </>
    );
  }

  const units = [...result.units, ...(result.looseUnits.length ? [{
    module: null,
    subjects: result.looseUnits.flatMap((u) => u.subjects),
    avg: null, status: 'empty', credits: result.looseUnits.reduce((s, u) => s + (u.credits || 0), 0), coefficient: 1,
  }] : [])];
  const loose = units.find((u) => !u.module);
  if (loose) {
    // "Hors module" block: show the mean of its subjects for readability.
    const vals = loose.subjects.filter((x) => x.r.value != null);
    const w = vals.reduce((s, x) => s + (Number(x.course.coefficient) || 1), 0);
    loose.avg = w ? Math.round((vals.reduce((s, x) => s + x.r.value * (Number(x.course.coefficient) || 1), 0) / w) * 100) / 100 : null;
    loose.status = result.looseUnits.some((u) => u.status === 'at-risk' || u.status === 'failed') ? 'at-risk' : loose.avg == null ? 'empty' : 'in-progress';
  }
  const graded = result.courses.filter((c) => (c.evaluations || []).some((e) => normGrade(e, settings) != null)).length;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-2xl border border-line p-5 sm:p-6" style={{ background: `linear-gradient(135deg, ${tint('var(--accent-primary)', 10)}, var(--bg-tertiary) 55%)` }}>
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap text-xs text-mute">
              <GraduationCap size={13} className="text-accent" />
              <span>{settings.institution || 'Établissement'}{settings.program ? ` · ${settings.program}` : ''}</span>
              <button onClick={() => setSettingsOpen(true)} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 hover:text-ink hover:border-accent cursor-pointer">
                <Settings2 size={11} /> /{settings.scale} · validation {settings.passMark}
              </button>
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {terms.map((t) => (
                <button key={t.id} onClick={() => setActiveTerm(t.id)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold cursor-pointer transition-colors ${t.id === term.id ? 'bg-accent text-black' : 'bg-card/70 border border-line text-mute hover:text-ink'}`}>
                  {t.name}
                </button>
              ))}
              <button onClick={() => setTermModal({})} className="rounded-lg px-2.5 py-1.5 text-sm border border-dashed border-line text-mute hover:text-accent hover:border-accent cursor-pointer" title="Nouveau semestre"><Plus size={14} /></button>
              <button onClick={() => setTermModal({ term })} className="p-1.5 text-mute hover:text-accent cursor-pointer" title="Modifier le semestre"><Pencil size={13} /></button>
            </div>
            <div className="text-xs text-mute mt-2">
              {term.year && <>{term.year} · </>}
              {term.startDate ? <>{frDate(term.startDate)} → {frDate(term.endDate)}</> : <button className="underline cursor-pointer hover:text-ink" onClick={() => setTermModal({ term })}>ajouter les dates du semestre</button>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="secondary" onClick={() => setModuleModal({})}><span className="flex items-center gap-1.5"><Layers size={14} /> Module</span></Button>
            <Button variant="secondary" onClick={() => setBulkOpen(true)}><span className="flex items-center gap-1.5"><ClipboardList size={14} /> Coller une liste</span></Button>
            <Button onClick={() => setSubjectModal({})}><span className="flex items-center gap-1.5"><Plus size={15} /> Matière</span></Button>
          </div>
        </div>

        {prog && (
          <div className="mt-5">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-ink font-medium">{prog.notStarted ? `Début ${countdownLabel(daysUntil(term.startDate, today))}` : `Semaine ${Math.min(prog.week, prog.weeks)} / ${prog.weeks}`}</span>
              <span className="text-mute">{prog.left > 0 ? `${prog.left} jour(s) restants` : 'Semestre terminé'}</span>
            </div>
            <div className="h-2 rounded-full bg-surface overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${prog.pct}%`, background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))' }} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          <BigStat label="Moyenne du semestre" value={result.avg == null ? '—' : `${fmtGrade(result.avg)}/${settings.scale}`} color={gradeColor(result.avg, settings)}
            sub={result.avg == null ? 'aucune note saisie' : result.complete
              ? <span className="flex items-center gap-2"><MentionTag avg={result.avg} settings={settings} />{result.compensated ? '· par compensation' : ''}</span>
              : 'provisoire — notes connues uniquement'} />
          <BigStat label="Statut" value={<StatusPill status={result.status} />} sub={`${graded}/${result.courses.length} matière(s) notée(s)`} />
          <BigStat label="Crédits validés" value={result.creditsTotal ? `${result.creditsEarned}/${result.creditsTotal}` : '—'} sub={result.creditsTotal ? 'modules validés' : 'ajoutez les crédits'} />
          <BigStat label="Prochaine évaluation"
            value={nextExam ? countdownLabel(daysUntil(nextExam.ev.date, today)) : '—'}
            sub={nextExam ? `${evalTypeLabel(nextExam.ev.type, true)} · ${nextExam.course.name}` : 'datez vos évaluations'}
            color={nextExam && daysUntil(nextExam.ev.date, today) <= 7 ? 'var(--warning)' : undefined} />
        </div>
      </div>

      {/* Modules */}
      <SectionHeader icon={Layers} title="Modules & matières"
        subtitle="Cliquez une matière pour saisir ses notes, dates d'examen, emploi du temps et programme." />
      {units.length ? (
        <div className="space-y-3">
          {units.map((u) => (
            <UnitCard key={u.module?.id || 'loose'} unit={u} settings={settings}
              onEditModule={(m) => setModuleModal({ module: m })} onAddSubject={(moduleId) => setSubjectModal({ moduleId })} />
          ))}
        </div>
      ) : (
        <Card>
          <div className="text-center py-6">
            <ClipboardList size={26} className="mx-auto text-mute mb-2" />
            <p className="text-sm text-ink font-medium">Aucune matière dans {term.name}</p>
            <p className="text-xs text-mute mt-1">Le plus rapide : collez la liste des matières de votre syllabus.</p>
            <div className="flex justify-center gap-2 mt-4">
              <Button onClick={() => setBulkOpen(true)}>Coller une liste</Button>
              <Button variant="secondary" onClick={() => setSubjectModal({})}>Ajouter une matière</Button>
            </div>
          </div>
        </Card>
      )}
      {modals}
    </div>
  );
}
