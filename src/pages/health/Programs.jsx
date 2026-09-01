import { useState } from 'react';
import { CheckCircle2, Pencil, RotateCcw, Save, X, Plus, Trash2, BookOpen, Calendar, AlertTriangle, Info } from 'lucide-react';
import { useHealthStore } from '../../store/healthStore';
import { CURATED_PROGRAMS } from '../../utils/curated-programs';
import { Card, Button, Badge, Input, Select, Textarea, EmptyState } from '../../components/common/ui';
import ProgramOnboarding from './ProgramOnboarding';

function SectionCard({ title, action, children }) {
  return <Card title={title} action={action}>{children}</Card>;
}

// Small "modified + revert" affordance, shared by every editable row below —
// same "original never mutated, revertible" pattern as SessionBlock's
// exercise variants, generalized to the other program sections
// (healthStore.js#applyProgramOverrides).
function RowActions({ overridden, onEdit, onReset }) {
  return (
    <span className="inline-flex items-center gap-1">
      {overridden && <button onClick={onReset} className="text-mute hover:text-warn cursor-pointer" title="Revenir à l'original"><RotateCcw size={12} /></button>}
      <button onClick={onEdit} className="text-mute hover:text-accent cursor-pointer" title="Modifier"><Pencil size={12} /></button>
    </span>
  );
}

// Inline editable exercise table — used both to display a session's
// exercises and (when `editable`) to build a variant. Never mutates the
// curated original: `onSave` hands the edited array up to saveProgramVariant.
function ExerciseTable({ exercises, editing, onChange }) {
  const update = (i, patch) => onChange(exercises.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const remove = (i) => onChange(exercises.filter((_, idx) => idx !== i));
  const add = () => onChange([...exercises, { name: '', setsReps: '', rest: '', rpe: '', note: '' }]);
  // RPE is optional per exercise (older/other curated programs may not set
  // it) — only render the column when at least one row actually has a value,
  // so a program without RPE data doesn't show an empty column.
  const hasRpe = exercises.some((e) => e.rpe);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-mute text-left">
            <th className="py-1.5 pr-2">Exercice</th>
            <th className="pr-2">Séries × Reps</th>
            <th className="pr-2">Repos</th>
            {(hasRpe || editing) && <th className="pr-2">RPE</th>}
            <th className="pr-2">Note</th>
            {editing && <th></th>}
          </tr>
        </thead>
        <tbody>
          {exercises.map((ex, i) => (
            <tr key={i} className="border-t border-line">
              {editing ? (
                <>
                  <td className="py-1 pr-2"><Input className="!py-1 !text-xs" value={ex.name} onChange={(e) => update(i, { name: e.target.value })} /></td>
                  <td className="py-1 pr-2"><Input className="!py-1 !text-xs w-24" value={ex.setsReps} onChange={(e) => update(i, { setsReps: e.target.value })} /></td>
                  <td className="py-1 pr-2"><Input className="!py-1 !text-xs w-16" value={ex.rest} onChange={(e) => update(i, { rest: e.target.value })} /></td>
                  <td className="py-1 pr-2"><Input className="!py-1 !text-xs w-12" value={ex.rpe || ''} onChange={(e) => update(i, { rpe: e.target.value })} /></td>
                  <td className="py-1 pr-2"><Input className="!py-1 !text-xs" value={ex.note} onChange={(e) => update(i, { note: e.target.value })} /></td>
                  <td><button onClick={() => remove(i)} className="text-mute hover:text-bad cursor-pointer"><Trash2 size={13} /></button></td>
                </>
              ) : (
                <>
                  <td className="py-1.5 pr-2">{ex.name}</td>
                  <td className="pr-2">{ex.setsReps}</td>
                  <td className="pr-2 text-mute">{ex.rest}</td>
                  {hasRpe && <td className="pr-2 text-mute">{ex.rpe || '—'}</td>}
                  <td className="pr-2 text-mute">{ex.note}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <Button variant="secondary" className="!py-1 !text-xs mt-2" onClick={add}><span className="flex items-center gap-1.5"><Plus size={12} /> Ajouter un exercice</span></Button>
      )}
    </div>
  );
}

function SessionBlock({ programId, sessionKey }) {
  const { getEffectiveExercises, saveProgramVariant, setVariantActive, deleteVariant } = useHealthStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const effective = getEffectiveExercises(programId, sessionKey);
  if (!effective) return null;

  const startEdit = () => { setDraft(effective.exercises.map((e) => ({ ...e }))); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setDraft(null); };
  const saveVariant = () => {
    saveProgramVariant(programId, sessionKey, draft);
    setEditing(false);
    setDraft(null);
  };

  return (
    <div className="border border-line rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{effective.label}</span>
          {effective.isVariant && <Badge color="var(--warning)">Variante active</Badge>}
        </div>
        {!editing ? (
          <div className="flex items-center gap-2">
            {effective.isVariant && (
              <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => { setVariantActive(effective.variantId, false); }}>
                <span className="flex items-center gap-1"><RotateCcw size={12} /> Original</span>
              </Button>
            )}
            <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={startEdit}>
              <span className="flex items-center gap-1"><Pencil size={12} /> Modifier</span>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={cancelEdit}><X size={12} /></Button>
            <Button className="!px-2 !py-1 text-xs" onClick={saveVariant}><span className="flex items-center gap-1"><Save size={12} /> Enregistrer comme variante</span></Button>
          </div>
        )}
      </div>
      <ExerciseTable exercises={editing ? draft : effective.exercises} editing={editing} onChange={setDraft} />
      {editing && (
        <p className="text-[11px] text-mute mt-2">
          Le programme original n'est jamais modifié — ceci enregistre une variante que tu pourras désactiver à tout moment pour revenir à la version d'origine.
        </p>
      )}
    </div>
  );
}

// One weekly-schedule day row — lets a user reassign which session (or rest)
// runs that day, and override the display time. `sessions` is the curated
// program's session dict, used to populate the picker and render the label.
function WeeklyDayRow({ programId, phaseKey, day, sessions }) {
  const { setProgramOverride, resetProgramOverride } = useHealthStore();
  const overridden = useHealthStore((s) => !!s.programOverrides[programId]?.weeklyStructure?.[phaseKey]?.[day.day]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const sessionOptions = [{ value: '', label: 'Repos (aucune séance)' }, ...Object.keys(sessions).map((k) => ({ value: k, label: sessions[k].label }))];

  const startEdit = () => { setDraft({ session: day.session || '', sessionTime: day.sessionTime || '' }); setEditing(true); };
  const save = () => {
    setProgramOverride(programId, 'weeklyStructure', { [phaseKey]: { [day.day]: { session: draft.session || null, sessionTime: draft.sessionTime } } });
    setEditing(false);
  };

  return (
    <tr className="border-t border-line align-top">
      <td className="py-1.5 pr-2 font-medium">{day.label}</td>
      <td className="pr-2 text-mute">{day.morning || '—'}</td>
      <td className="pr-2 text-mute">{day.midday || '—'}</td>
      {editing ? (
        <td className="py-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Select className="!py-1 !text-xs w-40" value={draft.session} onChange={(e) => setDraft({ ...draft, session: e.target.value })} options={sessionOptions} />
            <Input className="!py-1 !text-xs w-28" value={draft.sessionTime} onChange={(e) => setDraft({ ...draft, sessionTime: e.target.value })} placeholder="Horaire" />
            <button onClick={save} className="text-good cursor-pointer"><Save size={13} /></button>
            <button onClick={() => setEditing(false)} className="text-mute cursor-pointer"><X size={13} /></button>
          </div>
        </td>
      ) : (
        <td>
          <div className="flex items-center gap-2">
            <span>{day.session ? `${sessions[day.session]?.label} (${day.sessionTime})` : day.sessionTime || '—'}</span>
            {overridden && <Badge color="var(--warning)">Modifié</Badge>}
            <RowActions overridden={overridden} onEdit={startEdit} onReset={() => resetProgramOverride(programId, 'weeklyStructure', `${phaseKey}:${day.day}`)} />
          </div>
        </td>
      )}
    </tr>
  );
}

function MacrocycleRow({ programId, index, row }) {
  const { setProgramOverride, resetProgramOverride } = useHealthStore();
  const overridden = useHealthStore((s) => !!s.programOverrides[programId]?.macrocycle?.[index]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);

  const startEdit = () => { setDraft({ dates: row.dates, focus: row.focus, volume: row.volume, intensity: row.intensity }); setEditing(true); };
  const save = () => { setProgramOverride(programId, 'macrocycle', { [index]: draft }); setEditing(false); };
  const field = (key, width = 'w-28') => <Input className={`!py-1 !text-xs ${width}`} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />;

  return (
    <tr className="border-t border-line align-top">
      <td className="py-1.5 pr-2 font-medium">{row.block}</td>
      {editing ? (
        <>
          <td className="pr-2 py-1">{field('dates')}</td>
          <td className="pr-2 py-1">{field('focus')}</td>
          <td className="pr-2 py-1">{field('volume')}</td>
          <td className="pr-2 py-1">{field('intensity')}</td>
          <td className="pr-2 text-mute">{row.cardio}</td>
          <td>{row.agility}</td>
        </>
      ) : (
        <>
          <td className="pr-2 text-mute">{row.dates}</td>
          <td className="pr-2">{row.focus}</td>
          <td className="pr-2">{row.volume}</td>
          <td className="pr-2">{row.intensity}</td>
          <td className="pr-2">{row.cardio}</td>
          <td>{row.agility}</td>
        </>
      )}
      <td className="whitespace-nowrap">
        {editing ? (
          <span className="inline-flex items-center gap-1"><button onClick={save} className="text-good cursor-pointer"><Save size={13} /></button><button onClick={() => setEditing(false)} className="text-mute cursor-pointer"><X size={13} /></button></span>
        ) : (
          <span className="flex items-center gap-1.5">{overridden && <Badge color="var(--warning)">Modifié</Badge>}<RowActions overridden={overridden} onEdit={startEdit} onReset={() => resetProgramOverride(programId, 'macrocycle', String(index))} /></span>
        )}
      </td>
    </tr>
  );
}

function CardioRow({ programId, index, row }) {
  const { setProgramOverride, resetProgramOverride } = useHealthStore();
  const overridden = useHealthStore((s) => !!s.programOverrides[programId]?.cardioProgram?.[index]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);

  const startEdit = () => { setDraft({ course: row.course, velo: row.velo }); setEditing(true); };
  const save = () => { setProgramOverride(programId, 'cardioProgram', { [index]: draft }); setEditing(false); };

  return (
    <tr className="border-t border-line align-top">
      <td className="py-1.5 pr-2 font-medium">{row.block}</td>
      {editing ? (
        <>
          <td className="pr-2 py-1"><Input className="!py-1 !text-xs" value={draft.course} onChange={(e) => setDraft({ ...draft, course: e.target.value })} /></td>
          <td className="pr-2 py-1"><Input className="!py-1 !text-xs" value={draft.velo} onChange={(e) => setDraft({ ...draft, velo: e.target.value })} /></td>
        </>
      ) : (
        <>
          <td className="pr-2">{row.course}</td>
          <td className="pr-2">{row.velo}</td>
        </>
      )}
      <td className="text-mute">
        <div className="flex items-center gap-1.5">
          {row.logique}
          {editing ? (
            <span className="inline-flex items-center gap-1 shrink-0"><button onClick={save} className="text-good cursor-pointer"><Save size={13} /></button><button onClick={() => setEditing(false)} className="text-mute cursor-pointer"><X size={13} /></button></span>
          ) : (
            <span className="inline-flex items-center gap-1.5 shrink-0">{overridden && <Badge color="var(--warning)">Modifié</Badge>}<RowActions overridden={overridden} onEdit={startEdit} onReset={() => resetProgramOverride(programId, 'cardioProgram', String(index))} /></span>
          )}
        </div>
      </td>
    </tr>
  );
}

// items is edited as one line-per-drill textarea (split/joined on \n) rather
// than a per-item table — simpler for a short bullet list like this.
function AgilityBlock({ programId, index, block }) {
  const { setProgramOverride, resetProgramOverride } = useHealthStore();
  const overridden = useHealthStore((s) => !!s.programOverrides[programId]?.agilityMobility?.[index]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startEdit = () => { setDraft(block.items.join('\n')); setEditing(true); };
  const save = () => {
    setProgramOverride(programId, 'agilityMobility', { [index]: { items: draft.split('\n').map((s) => s.trim()).filter(Boolean) } });
    setEditing(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <div className="text-sm font-medium">{block.title}</div>
        {overridden && <Badge color="var(--warning)">Modifié</Badge>}
        {!editing && <RowActions overridden={overridden} onEdit={startEdit} onReset={() => resetProgramOverride(programId, 'agilityMobility', String(index))} />}
      </div>
      {editing ? (
        <div className="space-y-1.5">
          <Textarea className="!text-xs" rows={block.items.length + 1} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="flex gap-2">
            <Button className="!py-1 !text-xs" onClick={save}><span className="flex items-center gap-1"><Save size={12} /> Enregistrer</span></Button>
            <Button variant="ghost" className="!py-1 !text-xs" onClick={() => setEditing(false)}>Annuler</Button>
          </div>
        </div>
      ) : (
        <ul className="text-xs text-mute list-disc list-inside space-y-0.5">
          {block.items.map((it, j) => <li key={j}>{it}</li>)}
        </ul>
      )}
    </div>
  );
}

// Nutrition macros — a single edit toggle for the whole proteinPerKg/
// carbsPerKg/fatPerKg/calorieRule group (not per-field), since they're
// always adjusted together in practice.
function NutritionMacros({ programId, macros }) {
  const { setProgramOverride, resetProgramOverride } = useHealthStore();
  const overridden = useHealthStore((s) => !!s.programOverrides[programId]?.nutrition?.macros);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);

  const startEdit = () => { setDraft({ proteinPerKg: macros.proteinPerKg, carbsPerKg: macros.carbsPerKg, fatPerKg: macros.fatPerKg, calorieRule: macros.calorieRule }); setEditing(true); };
  const save = () => { setProgramOverride(programId, 'nutrition', { macros: draft }); setEditing(false); };

  if (editing) {
    return (
      <div className="space-y-2 mb-3">
        <div className="grid grid-cols-3 gap-3">
          <Input className="!text-xs" value={draft.proteinPerKg} onChange={(e) => setDraft({ ...draft, proteinPerKg: e.target.value })} placeholder="Protéines" />
          <Input className="!text-xs" value={draft.carbsPerKg} onChange={(e) => setDraft({ ...draft, carbsPerKg: e.target.value })} placeholder="Glucides" />
          <Input className="!text-xs" value={draft.fatPerKg} onChange={(e) => setDraft({ ...draft, fatPerKg: e.target.value })} placeholder="Lipides" />
        </div>
        <Textarea className="!text-xs" rows={2} value={draft.calorieRule} onChange={(e) => setDraft({ ...draft, calorieRule: e.target.value })} placeholder="Règle calorique" />
        <div className="flex gap-2">
          <Button className="!py-1 !text-xs" onClick={save}><span className="flex items-center gap-1"><Save size={12} /> Enregistrer</span></Button>
          <Button variant="ghost" className="!py-1 !text-xs" onClick={() => setEditing(false)}>Annuler</Button>
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="flex items-center justify-end gap-1.5 mb-1">
        {overridden && <Badge color="var(--warning)">Modifié</Badge>}
        <RowActions overridden={overridden} onEdit={startEdit} onReset={() => resetProgramOverride(programId, 'nutrition')} />
      </div>
      <div className="grid grid-cols-3 gap-3 text-center mb-3">
        <div><div className="text-xs text-mute mb-1">Protéines</div><div className="text-sm font-semibold">{macros.proteinPerKg}</div></div>
        <div><div className="text-xs text-mute mb-1">Glucides</div><div className="text-sm font-semibold">{macros.carbsPerKg}</div></div>
        <div><div className="text-xs text-mute mb-1">Lipides</div><div className="text-sm font-semibold">{macros.fatPerKg}</div></div>
      </div>
      <p className="text-[11px] text-mute">{macros.calorieRule}</p>
    </>
  );
}

export default function Programs() {
  const { activeCuratedProgramId, setActiveCuratedProgram, getActiveCuratedProgram, getEffectiveCuratedProgram, getCuratedProgramAdherence, getProgramProgressionSummary, programSchedule } = useHealthStore();
  const [viewingId, setViewingId] = useState(activeCuratedProgramId);
  const [onboardingFor, setOnboardingFor] = useState(null); // curated program object, or null
  const viewing = viewingId ? CURATED_PROGRAMS.find((p) => p.id === viewingId) : null;
  // Overrides apply whether or not the program is currently active — a user
  // can customize a program before ever activating it, and it's still there
  // when they do. `viewing` stays the true original (names/sessions/etc are
  // never overridden); `effective` is what actually schedules/logs/exports.
  const effective = viewing ? getEffectiveCuratedProgram(viewing.id) : null;
  const adherence = getCuratedProgramAdherence();
  const progression = getProgramProgressionSummary();

  // Always starts onboarding from the EFFECTIVE program so calendar-sync
  // scheduling (generateProgramSchedule) respects any saved overrides.
  const startOnboarding = (program) => {
    const eff = getEffectiveCuratedProgram(program.id) || program;
    setActiveCuratedProgram(program.id);
    setOnboardingFor(eff);
  };

  if (onboardingFor) {
    return (
      <ProgramOnboarding
        program={onboardingFor}
        onCancel={() => setOnboardingFor(null)}
        onDone={() => { setOnboardingFor(null); setViewingId(onboardingFor.id); }}
      />
    );
  }

  if (!viewing) {
    return (
      <div className="space-y-6">
        <Card title="Programmes disponibles">
          <div className="grid sm:grid-cols-2 gap-4">
            {CURATED_PROGRAMS.map((p) => (
              <div key={p.id} className="border border-line rounded-lg p-4 flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen size={14} className="text-accent" />
                  <span className="text-sm font-semibold">{p.name}</span>
                  {activeCuratedProgramId === p.id && <Badge color="var(--success)">Actif</Badge>}
                </div>
                <p className="text-xs text-mute mb-2">{p.subtitle}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {p.tags.map((t) => <Badge key={t}>{t}</Badge>)}
                </div>
                <div className="mt-auto flex gap-2">
                  <Button variant="secondary" className="flex-1 !py-1.5 text-xs" onClick={() => setViewingId(p.id)}>Voir le détail</Button>
                  {activeCuratedProgramId !== p.id && (
                    <Button className="!py-1.5 text-xs" onClick={() => startOnboarding(p)}>Activer</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
        {!CURATED_PROGRAMS.length && <EmptyState>Aucun programme disponible pour le moment.</EmptyState>}
      </div>
    );
  }

  const isActive = activeCuratedProgramId === viewing.id;
  const ws = effective.weeklyStructure;
  // A phase key is an array of day entries (each with a `.day`) — excludes
  // `notes` (also an array, but of plain strings) and `phaseSwitchDate`.
  const phaseKeys = Object.keys(ws).filter((k) => Array.isArray(ws[k]) && ws[k][0]?.day);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setViewingId(null)}>← Tous les programmes</Button>
        {isActive ? (
          <div className="flex items-center gap-2">
            <Badge color="var(--success)"><span className="flex items-center gap-1"><CheckCircle2 size={11} /> Programme actif</span></Badge>
            <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => startOnboarding(viewing)}>
              <span className="flex items-center gap-1"><Calendar size={12} /> {programSchedule?.curatedProgramId === viewing.id ? 'Reconfigurer le planning' : 'Configurer mon planning'}</span>
            </Button>
          </div>
        ) : (
          <Button className="!px-3 !py-1.5 text-xs" onClick={() => startOnboarding(viewing)}>Activer ce programme</Button>
        )}
      </div>

      <Card title={viewing.name} action={<span className="text-xs text-mute">{viewing.designedFor}</span>}>
        <p className="text-sm text-mute mb-2">{viewing.subtitle}</p>
        <p className="text-sm mb-3">{viewing.objective}</p>
        <div className="flex flex-wrap gap-1">{viewing.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div>
      </Card>

      {isActive && adherence?.plannedCount > 0 && (
        <SectionCard title="Adhérence cette semaine">
          <div className="text-sm">{adherence.matchedCount}/{adherence.plannedCount} exercices planifiés loggés cette semaine ({adherence.percent}%)</div>
        </SectionCard>
      )}

      {isActive && progression && (progression.nutritionAdherence || progression.weightTrend) && (
        <SectionCard title="Progression vers l'objectif (14 derniers jours)">
          <p className="text-xs text-mute mb-3 italic">"{progression.objective}"</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {progression.nutritionAdherence ? (
              <div className="text-sm space-y-1">
                <div className="text-xs text-mute uppercase tracking-wide mb-1">Nutrition</div>
                <div>{progression.nutritionAdherence.proteinMetPercent}% des jours loggés avec objectif protéine atteint</div>
                <div className="text-xs text-mute">
                  Moyenne {progression.nutritionAdherence.avgKcal} kcal/j vs cible {progression.nutritionAdherence.targetKcal} kcal/j
                  ({progression.nutritionAdherence.daysLogged} jour{progression.nutritionAdherence.daysLogged !== 1 ? 's' : ''} loggé{progression.nutritionAdherence.daysLogged !== 1 ? 's' : ''})
                </div>
              </div>
            ) : (
              <div className="text-xs text-mute">Nutrition : pas assez de repas loggés sur la période pour évaluer l'adhérence.</div>
            )}
            {progression.weightTrend ? (
              <div className="text-sm space-y-1">
                <div className="text-xs text-mute uppercase tracking-wide mb-1">Poids</div>
                <div>{progression.weightTrend.deltaKg > 0 ? '+' : ''}{progression.weightTrend.deltaKg}kg sur la période</div>
                <div className="text-xs text-mute">{progression.weightTrend.entriesLogged} pesées loggées</div>
                {progression.weightTrendCycleCaveat && (
                  <div className="text-xs text-mute italic">Phase du cycle actuelle — une partie de cette hausse est probablement de la rétention d'eau, pas de la graisse.</div>
                )}
              </div>
            ) : (
              <div className="text-xs text-mute">Poids : au moins 2 pesées sur 14 jours nécessaires pour voir une tendance.</div>
            )}
          </div>
        </SectionCard>
      )}

      {viewing.context && (viewing.context.phaseA || viewing.context.phaseB || viewing.context.note) && (
        <SectionCard title="Contexte">
          <div className="grid sm:grid-cols-2 gap-4 mb-3">
            {viewing.context.phaseA && (
              <div>
                <div className="text-sm font-medium">{viewing.context.phaseA.label}</div>
                <div className="text-xs text-mute mb-1">{viewing.context.phaseA.dateRange}</div>
                <ul className="text-xs list-disc list-inside space-y-0.5">{viewing.context.phaseA.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
              </div>
            )}
            {viewing.context.phaseB && (
              <div>
                <div className="text-sm font-medium">{viewing.context.phaseB.label}</div>
                <div className="text-xs text-mute mb-1">{viewing.context.phaseB.dateRange}</div>
                <ul className="text-xs list-disc list-inside space-y-0.5">{viewing.context.phaseB.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
              </div>
            )}
          </div>
          {viewing.context.note && <p className="text-xs text-mute">{viewing.context.note}</p>}
        </SectionCard>
      )}

      {viewing.scientificFramework?.length > 0 && (
        <SectionCard title="Cadre scientifique">
          <div className="space-y-3">
            {viewing.scientificFramework.map((s, i) => (
              <div key={i}>
                <div className="text-sm font-medium mb-1">{s.title}</div>
                <p className="text-xs text-mute">{s.body}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {viewing.splitRationale && (
        <SectionCard title="Pourquoi ce split">
          <p className="text-xs text-mute mb-3">{viewing.splitRationale.intro}</p>
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-xs">
              <thead><tr className="text-mute text-left"><th className="py-1.5 pr-2">Split</th><th className="pr-2">Fréquence/muscle</th><th className="pr-2">Meilleur pour</th><th>Compromis</th></tr></thead>
              <tbody>
                {viewing.splitRationale.table.map((s, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="py-1.5 pr-2 font-medium">{s.split}</td>
                    <td className="pr-2 text-mute">{s.frequency}</td>
                    <td className="pr-2">{s.bestFor}</td>
                    <td className="text-mute">{s.tradeoff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {viewing.splitRationale.recommendation && <p className="text-[11px] text-mute italic">{viewing.splitRationale.recommendation}</p>}
        </SectionCard>
      )}

      <SectionCard title="Macrocycle" action={<span className="text-[11px] text-mute flex items-center gap-1"><Pencil size={11} /> Modifiable par bloc</span>}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-mute text-left"><th className="py-1.5 pr-2">Bloc</th><th className="pr-2">Dates</th><th className="pr-2">Focus</th><th className="pr-2">Volume</th><th className="pr-2">Intensité</th><th className="pr-2">Cardio</th><th className="pr-2">Agilité</th><th></th></tr></thead>
            <tbody>
              {effective.macrocycle.map((b, i) => <MacrocycleRow key={i} programId={viewing.id} index={i} row={b} />)}
            </tbody>
          </table>
        </div>
        {viewing.macrocycleNote && <p className="text-[11px] text-mute mt-3 italic">{viewing.macrocycleNote}</p>}
      </SectionCard>

      {phaseKeys.map((phaseKey) => (
        <SectionCard key={phaseKey} title={`Structure hebdomadaire — ${phaseKey === 'phaseA' ? 'Phase A' : phaseKey === 'phaseB' ? 'Phase B' : 'Semaine type'}`} action={<span className="text-[11px] text-mute flex items-center gap-1"><Pencil size={11} /> Modifiable par jour</span>}>
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-xs">
              <thead><tr className="text-mute text-left"><th className="py-1.5 pr-2">Jour</th><th className="pr-2">Matin</th><th className="pr-2">Journée</th><th>Séance</th></tr></thead>
              <tbody>
                {ws[phaseKey].map((d) => <WeeklyDayRow key={d.day} programId={viewing.id} phaseKey={phaseKey} day={d} sessions={viewing.sessions} />)}
              </tbody>
            </table>
          </div>
          {ws.notes?.map((n, i) => <p key={i} className="text-[11px] text-mute mb-1">{n}</p>)}
        </SectionCard>
      ))}

      {viewing.warmupGuide && (
        <SectionCard title="Échauffement, tempo & RPE">
          <p className="text-xs text-mute mb-2 italic">S'applique à toutes les séances ci-dessous — décrit une fois ici plutôt que répété exercice par exercice.</p>
          <div className="mb-3">
            <div className="text-sm font-medium mb-1">Protocole général (chaque séance)</div>
            <ul className="text-xs text-mute list-disc list-inside space-y-0.5">
              {viewing.warmupGuide.generalWarmup.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
          <div className="mb-3">
            <div className="text-sm font-medium mb-1">Guide de tempo</div>
            <div className="space-y-1.5">
              {viewing.warmupGuide.tempoGuide.map((t, i) => (
                <div key={i} className="text-xs bg-surface border border-line rounded-lg px-3 py-2">
                  <span className="font-medium">{t.label}</span> — <span className="text-accent">{t.tempo}</span>
                  <div className="text-mute mt-0.5">{t.detail}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <div className="text-sm font-medium mb-1">Échelle RPE</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {viewing.warmupGuide.rpeScale.map((r, i) => (
                <div key={i} className="text-xs bg-surface border border-line rounded-lg px-2.5 py-1.5">
                  <span className="font-medium">{r.rpe}</span>
                  <div className="text-mute">{r.meaning}</div>
                </div>
              ))}
            </div>
          </div>
          {viewing.warmupGuide.restNote && <p className="text-[11px] text-mute font-medium">{viewing.warmupGuide.restNote}</p>}
        </SectionCard>
      )}

      <SectionCard title="Séances détaillées">
        <div className="space-y-4">
          {Object.keys(viewing.sessions).map((key) => <SessionBlock key={key} programId={viewing.id} sessionKey={key} />)}
        </div>
      </SectionCard>

      <SectionCard title="Volume hebdomadaire par groupe musculaire">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-mute text-left"><th className="py-1.5 pr-2">Groupe</th><th className="pr-2">Séries/semaine</th><th className="pr-2">Zone optimale</th>{viewing.weeklyVolume.some((v) => v.status) && <th>Statut</th>}</tr></thead>
            <tbody>
              {viewing.weeklyVolume.map((v) => (
                <tr key={v.group} className="border-t border-line align-top">
                  <td className="py-1.5 pr-2 font-medium">{v.group}</td>
                  <td className="pr-2">{v.sets}</td>
                  <td className="pr-2 text-mute">{v.zone}</td>
                  {v.status && (
                    <td className="py-1.5">
                      <div className={`flex items-start gap-1.5 ${v.status === 'attention' ? 'text-warn' : 'text-good'}`}>
                        {v.status === 'attention' ? <AlertTriangle size={12} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={12} className="shrink-0 mt-0.5" />}
                        {v.note && <span className="text-mute normal-case">{v.note}</span>}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {viewing.weeklyVolumeNote && <p className="text-[11px] text-mute mt-3 italic">{viewing.weeklyVolumeNote}</p>}
        {viewing.weeklyVolumeNotes?.length > 0 && (
          <div className="mt-3 space-y-2">
            {viewing.weeklyVolumeNotes.map((n, i) => <p key={i} className="text-[11px] text-mute">{n}</p>)}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Course & vélo — programmation par bloc" action={<span className="text-[11px] text-mute flex items-center gap-1"><Pencil size={11} /> Modifiable par bloc</span>}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-mute text-left"><th className="py-1.5 pr-2">Bloc</th><th className="pr-2">Course</th><th className="pr-2">Vélo</th><th>Logique</th></tr></thead>
            <tbody>
              {effective.cardioProgram.map((c, i) => <CardioRow key={i} programId={viewing.id} index={i} row={c} />)}
            </tbody>
          </table>
        </div>
        {viewing.cardioRule && <p className="text-xs mt-3 font-medium">{viewing.cardioRule}</p>}
      </SectionCard>

      <SectionCard title="Agilité & mobilité" action={<span className="text-[11px] text-mute flex items-center gap-1"><Pencil size={11} /> Modifiable par bloc</span>}>
        <div className="space-y-3">
          {effective.agilityMobility.map((a, i) => <AgilityBlock key={i} programId={viewing.id} index={i} block={a} />)}
        </div>
      </SectionCard>

      <SectionCard title="Nutrition & composition corporelle" action={<span className="text-[11px] text-mute flex items-center gap-1"><Pencil size={11} /> Macros modifiables</span>}>
        <p className="text-sm font-medium mb-1">{effective.nutrition.objective}</p>
        <p className="text-xs text-mute mb-3">{viewing.nutrition.intro}</p>
        <div className="space-y-2 mb-4">
          {viewing.nutrition.strategyByBodyfat.map((s, i) => (
            <div key={i} className="text-xs bg-surface border border-line rounded-lg px-3 py-2">
              <span className="font-medium">{s.condition} :</span> <span className="text-mute">{s.strategy}</span>
            </div>
          ))}
        </div>
        <NutritionMacros programId={viewing.id} macros={effective.nutrition.macros} />
      </SectionCard>

      {viewing.cognitivePerformance && (
        <SectionCard title="Sommeil, lifestyle & performance cognitive">
          <p className="text-xs text-mute mb-2">{viewing.cognitivePerformance.intro}</p>
          <ul className="text-xs list-disc list-inside space-y-1 mb-2">
            {viewing.cognitivePerformance.points.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
          <p className="text-xs font-medium">{viewing.cognitivePerformance.conclusion}</p>
        </SectionCard>
      )}

      <SectionCard title="Monitoring & auto-régulation">
        <div className="space-y-1.5 mb-3">
          {viewing.monitoring.autoRegulation.map((r, i) => (
            <div key={i} className="text-xs flex gap-2"><span className="font-medium shrink-0">{r.range} →</span><span className="text-mute">{r.action}</span></div>
          ))}
        </div>
        <div className="text-xs font-medium mb-1">Signaux d'alerte :</div>
        <ul className="text-xs text-mute list-disc list-inside mb-2">
          {viewing.monitoring.alertSignals.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
        <p className="text-xs">{viewing.monitoring.alertRule}</p>
      </SectionCard>

      <SectionCard title="Limites réelles">
        <ul className="text-xs text-mute list-disc list-inside space-y-1.5">
          {viewing.limits.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </SectionCard>

      {viewing.openItems && (
        <SectionCard title="Pistes ouvertes — pas encore intégrées">
          <p className="text-xs text-mute mb-2 flex items-start gap-1.5"><Info size={13} className="shrink-0 mt-0.5" /> {viewing.openItems.intro}</p>
          <ul className="text-xs text-mute list-disc list-inside space-y-1">
            {viewing.openItems.items.map((it, i) => <li key={i}>{it}</li>)}
          </ul>
        </SectionCard>
      )}

      {viewing.sources?.length > 0 && (
        <p className="text-[11px] text-mute">Sources : {viewing.sources.join(' · ')}</p>
      )}
    </div>
  );
}
