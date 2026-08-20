import { useState } from 'react';
import { CheckCircle2, Pencil, RotateCcw, Save, X, Plus, Trash2, BookOpen, Calendar } from 'lucide-react';
import { useHealthStore } from '../../store/healthStore';
import { CURATED_PROGRAMS } from '../../utils/curated-programs';
import { Card, Button, Badge, Input, EmptyState } from '../../components/common/ui';
import ProgramOnboarding from './ProgramOnboarding';

function SectionCard({ title, action, children }) {
  return <Card title={title} action={action}>{children}</Card>;
}

// Inline editable exercise table — used both to display a session's
// exercises and (when `editable`) to build a variant. Never mutates the
// curated original: `onSave` hands the edited array up to saveProgramVariant.
function ExerciseTable({ exercises, editing, onChange }) {
  const update = (i, patch) => onChange(exercises.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const remove = (i) => onChange(exercises.filter((_, idx) => idx !== i));
  const add = () => onChange([...exercises, { name: '', setsReps: '', rest: '', note: '' }]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-mute text-left">
            <th className="py-1.5 pr-2">Exercice</th>
            <th className="pr-2">Séries × Reps</th>
            <th className="pr-2">Repos</th>
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
                  <td className="py-1 pr-2"><Input className="!py-1 !text-xs" value={ex.note} onChange={(e) => update(i, { note: e.target.value })} /></td>
                  <td><button onClick={() => remove(i)} className="text-mute hover:text-bad cursor-pointer"><Trash2 size={13} /></button></td>
                </>
              ) : (
                <>
                  <td className="py-1.5 pr-2">{ex.name}</td>
                  <td className="pr-2">{ex.setsReps}</td>
                  <td className="pr-2 text-mute">{ex.rest}</td>
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

export default function Programs() {
  const { activeCuratedProgramId, setActiveCuratedProgram, getActiveCuratedProgram, getCuratedProgramAdherence, getProgramProgressionSummary, programSchedule } = useHealthStore();
  const [viewingId, setViewingId] = useState(activeCuratedProgramId);
  const [onboardingFor, setOnboardingFor] = useState(null); // curated program object, or null
  const viewing = viewingId ? CURATED_PROGRAMS.find((p) => p.id === viewingId) : null;
  const adherence = getCuratedProgramAdherence();
  const progression = getProgramProgressionSummary();

  const startOnboarding = (program) => {
    setActiveCuratedProgram(program.id);
    setOnboardingFor(program);
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
  const ws = viewing.weeklyStructure;
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

      <SectionCard title="Macrocycle">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-mute text-left"><th className="py-1.5 pr-2">Bloc</th><th className="pr-2">Dates</th><th className="pr-2">Focus</th><th className="pr-2">Volume</th><th className="pr-2">Intensité</th><th className="pr-2">Cardio</th><th>Agilité</th></tr></thead>
            <tbody>
              {viewing.macrocycle.map((b, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="py-1.5 pr-2 font-medium">{b.block}</td>
                  <td className="pr-2 text-mute">{b.dates}</td>
                  <td className="pr-2">{b.focus}</td>
                  <td className="pr-2">{b.volume}</td>
                  <td className="pr-2">{b.intensity}</td>
                  <td className="pr-2">{b.cardio}</td>
                  <td>{b.agility}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {viewing.macrocycleNote && <p className="text-[11px] text-mute mt-3 italic">{viewing.macrocycleNote}</p>}
      </SectionCard>

      {phaseKeys.map((phaseKey) => (
        <SectionCard key={phaseKey} title={`Structure hebdomadaire — ${phaseKey === 'phaseA' ? 'Phase A' : phaseKey === 'phaseB' ? 'Phase B' : 'Semaine type'}`}>
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-xs">
              <thead><tr className="text-mute text-left"><th className="py-1.5 pr-2">Jour</th><th className="pr-2">Matin</th><th className="pr-2">Journée</th><th>Séance</th></tr></thead>
              <tbody>
                {ws[phaseKey].map((d) => (
                  <tr key={d.day} className="border-t border-line">
                    <td className="py-1.5 pr-2 font-medium">{d.label}</td>
                    <td className="pr-2 text-mute">{d.morning || '—'}</td>
                    <td className="pr-2 text-mute">{d.midday || '—'}</td>
                    <td>{d.session ? `${viewing.sessions[d.session]?.label} (${d.sessionTime})` : d.sessionTime || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ws.notes?.map((n, i) => <p key={i} className="text-[11px] text-mute mb-1">{n}</p>)}
        </SectionCard>
      ))}

      <SectionCard title="Séances détaillées">
        <div className="space-y-4">
          {Object.keys(viewing.sessions).map((key) => <SessionBlock key={key} programId={viewing.id} sessionKey={key} />)}
        </div>
      </SectionCard>

      <SectionCard title="Volume hebdomadaire par groupe musculaire">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-mute text-left"><th className="py-1.5 pr-2">Groupe</th><th className="pr-2">Séries/semaine</th><th>Zone optimale</th></tr></thead>
            <tbody>
              {viewing.weeklyVolume.map((v) => (
                <tr key={v.group} className="border-t border-line">
                  <td className="py-1.5 pr-2">{v.group}</td>
                  <td className="pr-2">{v.sets}</td>
                  <td className="text-mute">{v.zone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {viewing.weeklyVolumeNote && <p className="text-[11px] text-mute mt-3 italic">{viewing.weeklyVolumeNote}</p>}
      </SectionCard>

      <SectionCard title="Course & vélo — programmation par bloc">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-mute text-left"><th className="py-1.5 pr-2">Bloc</th><th className="pr-2">Course</th><th className="pr-2">Vélo</th><th>Logique</th></tr></thead>
            <tbody>
              {viewing.cardioProgram.map((c, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="py-1.5 pr-2 font-medium">{c.block}</td>
                  <td className="pr-2">{c.course}</td>
                  <td className="pr-2">{c.velo}</td>
                  <td className="text-mute">{c.logique}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {viewing.cardioRule && <p className="text-xs mt-3 font-medium">{viewing.cardioRule}</p>}
      </SectionCard>

      <SectionCard title="Agilité & mobilité">
        <div className="space-y-3">
          {viewing.agilityMobility.map((a, i) => (
            <div key={i}>
              <div className="text-sm font-medium mb-1">{a.title}</div>
              <ul className="text-xs text-mute list-disc list-inside space-y-0.5">
                {a.items.map((it, j) => <li key={j}>{it}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Nutrition & composition corporelle">
        <p className="text-sm font-medium mb-1">{viewing.nutrition.objective}</p>
        <p className="text-xs text-mute mb-3">{viewing.nutrition.intro}</p>
        <div className="space-y-2 mb-4">
          {viewing.nutrition.strategyByBodyfat.map((s, i) => (
            <div key={i} className="text-xs bg-surface border border-line rounded-lg px-3 py-2">
              <span className="font-medium">{s.condition} :</span> <span className="text-mute">{s.strategy}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 text-center mb-3">
          <div><div className="text-xs text-mute mb-1">Protéines</div><div className="text-sm font-semibold">{viewing.nutrition.macros.proteinPerKg}</div></div>
          <div><div className="text-xs text-mute mb-1">Glucides</div><div className="text-sm font-semibold">{viewing.nutrition.macros.carbsPerKg}</div></div>
          <div><div className="text-xs text-mute mb-1">Lipides</div><div className="text-sm font-semibold">{viewing.nutrition.macros.fatPerKg}</div></div>
        </div>
        <p className="text-[11px] text-mute">{viewing.nutrition.macros.calorieRule}</p>
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

      {viewing.sources?.length > 0 && (
        <p className="text-[11px] text-mute">Sources : {viewing.sources.join(' · ')}</p>
      )}
    </div>
  );
}
