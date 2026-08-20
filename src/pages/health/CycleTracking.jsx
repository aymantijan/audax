import { useState, useMemo } from 'react';
import { Trash2, Plus, X, Sparkles, Dumbbell } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useHealthStore } from '../../store/healthStore';
import { useHabitStore } from '../../store/habitStore';
import { CYCLE_PHASE_LABEL, CYCLE_PHASE_COLOR, estimateCycleLength } from '../../utils/health-science';
import { fmtDateShort, todayKey } from '../../utils/formatters';
import { Card, Button, Field, Input, Select, Badge, EmptyState } from '../../components/common/ui';

const SYMPTOMS = ['Cramps', 'Fatigue', 'Bloating', 'Headache', 'Mood swings', 'Breast tenderness', 'Acne', 'Cravings'];
const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

// Shared by energyByPhase and rpeByPhase below — which phase `dateStr` falls
// in, given the cycle-start dates logged so far and an estimated cycle
// length. Same day-of-cycle boundaries as computeCyclePhase in
// health-science.js, duplicated here (not imported) because this needs to
// classify a whole history of past dates against their OWN nearest-preceding
// cycle start, not just "today" against the latest one.
function phaseForDate(dateStr, cycleStartDates, cycleLen) {
  const cyclesBefore = cycleStartDates.filter((d) => d <= dateStr);
  if (!cyclesBefore.length) return null;
  const lastStart = cyclesBefore[cyclesBefore.length - 1];
  const dayOfCycle = Math.floor((new Date(dateStr) - new Date(lastStart)) / 86400000) + 1;
  if (dayOfCycle <= 5) return 'menstrual';
  if (dayOfCycle <= cycleLen * 0.46) return 'follicular';
  if (dayOfCycle <= cycleLen * 0.54) return 'ovulation';
  if (dayOfCycle <= cycleLen) return 'luteal';
  return null;
}

export default function CycleTracking() {
  const { cycleLogs, logCycleStart, deleteCycleLog, markPeriodEnd, getCyclePhase, getCyclePhaseCoaching, getCycleHealthFlag, getActiveProgram, getActiveCuratedProgram, customCycleSymptoms, addCustomSymptom, removeCustomSymptom, workouts, performanceLogs, healthProfile, setHealthProfile, isCyclePhaseHormonallyReliable, getPregnancyInfo, getPostpartumInfo } = useHealthStore();
  const lifeStage = healthProfile.lifeStage || 'none';
  const pregnancyInfo = getPregnancyInfo();
  const postpartumInfo = getPostpartumInfo();
  const hormonallyReliable = isCyclePhaseHormonallyReliable();
  const energyLogs = useHabitStore((s) => s.energyLogs);
  const [flow, setFlow] = useState('medium');
  const [symptoms, setSymptoms] = useState([]);
  const [notes, setNotes] = useState('');
  const [newSymptom, setNewSymptom] = useState('');
  const [startDate, setStartDate] = useState(todayKey());
  const [endDate, setEndDate] = useState(todayKey());

  const phase = getCyclePhase();
  const coaching = getCyclePhaseCoaching();
  const healthFlag = getCycleHealthFlag();
  const activeProgram = getActiveProgram() || getActiveCuratedProgram();
  const allSymptoms = [...SYMPTOMS, ...customCycleSymptoms];

  // Symptom "severity" proxied by count of symptoms logged per entry — a
  // simple, transparent trend without inventing a 1-10 severity scale nobody
  // asked to fill in.
  const symptomTrend = useMemo(
    () => [...cycleLogs].sort((a, b) => (a.date < b.date ? -1 : 1)).map((c) => ({ date: c.date.slice(5), count: c.symptoms.length })),
    [cycleLogs]
  );
  const toggleSymptom = (s) => setSymptoms((arr) => (arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]));

  const save = () => {
    logCycleStart(startDate, flow, symptoms, notes);
    setSymptoms([]);
    setNotes('');
    setStartDate(todayKey());
  };

  const submitCustomSymptom = (e) => {
    e.preventDefault();
    if (!newSymptom.trim()) return;
    addCustomSymptom(newSymptom.trim());
    setNewSymptom('');
  };

  // The most recent period-start log without a recorded end date — surfaces a
  // "mark ended" action instead of forcing a second explicit start-date entry.
  const openPeriod = [...cycleLogs].reverse().find((c) => !c.endDate);

  // Average energy by cycle phase — a light correlation view without needing
  // a full Pearson r (phase is categorical, not continuous). Uses the SAME
  // estimated cycle length as the "Current Phase" card above (previously
  // hardcoded to 28 here, which could silently disagree with that card).
  const { energyByPhase, cycleLen } = useMemo(() => {
    const dates = cycleLogs.map((c) => c.date).sort();
    if (dates.length < 2 || !hormonallyReliable) return { energyByPhase: null, cycleLen: null };
    const cycleLen = estimateCycleLength(dates) || 28;
    const buckets = { menstrual: [], follicular: [], ovulation: [], luteal: [] };
    for (const log of energyLogs) {
      const p = phaseForDate(log.date, dates, cycleLen);
      if (p && log.energyStartLevel != null) buckets[p].push(log.energyStartLevel);
    }
    const avg = (arr) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);
    return { energyByPhase: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, avg(v)])), cycleLen };
  }, [cycleLogs, energyLogs, hormonallyReliable]);

  // Average RPE (perceived exertion, 1-10) by cycle phase, from this
  // person's own logged gym sets — not a generic claim about "energy may be
  // lower", but their OWN training data: did sessions genuinely feel harder
  // in one phase than another. Same phase-bucketing as energyByPhase above,
  // reusing the same estimated cycle length so the two views never disagree.
  const rpeByPhase = useMemo(() => {
    const dates = cycleLogs.map((c) => c.date).sort();
    if (dates.length < 2 || !hormonallyReliable) return null;
    const len = estimateCycleLength(dates) || 28;
    const buckets = { menstrual: [], follicular: [], ovulation: [], luteal: [] };
    for (const w of workouts) {
      if (w.type !== 'strength' || !w.sets) continue;
      const p = phaseForDate(w.date, dates, len);
      if (!p) continue;
      for (const s of w.sets) if (s.rpe != null) buckets[p].push(Number(s.rpe));
    }
    const avg = (arr) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);
    const result = Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, { avg: avg(v), n: v.length }]));
    return Object.values(result).some((r) => r.avg != null) ? result : null;
  }, [cycleLogs, workouts, hormonallyReliable]);

  // Average resting HR by cycle phase — progesterone raises basal body
  // temperature and resting heart rate through the luteal phase (a
  // consistently replicated finding, e.g. used clinically as a fertility-
  // awareness marker), so a self-logged uptick isn't a fitness regression.
  // Gated behind hormonallyReliable for the same reason as rpeByPhase.
  const restingHrByPhase = useMemo(() => {
    const dates = cycleLogs.map((c) => c.date).sort();
    if (dates.length < 2 || !hormonallyReliable) return null;
    const len = estimateCycleLength(dates) || 28;
    const buckets = { menstrual: [], follicular: [], ovulation: [], luteal: [] };
    for (const p of performanceLogs) {
      if (p.restingHr == null) continue;
      const phaseKey = phaseForDate(p.date, dates, len);
      if (phaseKey) buckets[phaseKey].push(Number(p.restingHr));
    }
    const avg = (arr) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);
    const result = Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, { avg: avg(v), n: v.length }]));
    return Object.values(result).some((r) => r.avg != null) ? result : null;
  }, [cycleLogs, performanceLogs, hormonallyReliable]);

  // Predicted next period = last start + estimated cycle length. A rough
  // calendar projection, not a fertility/ovulation prediction.
  const predictedNext = useMemo(() => {
    if (!cycleLogs.length) return null;
    const lastStart = [...cycleLogs].map((c) => c.date).sort().at(-1);
    const len = (cycleLogs.length >= 2 ? estimateCycleLength(cycleLogs.map((c) => c.date).sort()) : null) || 28;
    const d = new Date(lastStart + 'T00:00:00');
    d.setDate(d.getDate() + len);
    return d.toISOString().slice(0, 10);
  }, [cycleLogs]);

  return (
    <div className="space-y-6">
      <Card title="Étape de vie">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Situation actuelle">
            <Select
              value={lifeStage}
              onChange={(e) => setHealthProfile({ lifeStage: e.target.value })}
              options={[
                { value: 'none', label: 'Aucune de ces situations' },
                { value: 'pregnant', label: 'Enceinte' },
                { value: 'postpartum', label: 'Post-partum' },
                { value: 'perimenopause', label: 'Périménopause' },
                { value: 'menopause', label: 'Ménopause' },
              ]}
            />
          </Field>
          {lifeStage === 'pregnant' && (
            <Field label="Date des dernières règles (référence médicale standard)">
              <Input type="date" value={healthProfile.pregnancyStartDate || ''} max={todayKey()} onChange={(e) => setHealthProfile({ pregnancyStartDate: e.target.value || null })} />
            </Field>
          )}
          {lifeStage === 'postpartum' && (
            <Field label="Date d'accouchement">
              <Input type="date" value={healthProfile.postpartumStartDate || ''} max={todayKey()} onChange={(e) => setHealthProfile({ postpartumStartDate: e.target.value || null })} />
            </Field>
          )}
        </div>
        {lifeStage === 'postpartum' && (
          <label className="flex items-center gap-2 text-sm mt-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!healthProfile.breastfeeding}
              onChange={(e) => setHealthProfile({ breastfeeding: e.target.checked })}
              className="cursor-pointer"
            />
            J'allaite
          </label>
        )}
      </Card>

      {lifeStage === 'pregnant' ? (
        <Card title="Grossesse">
          {pregnancyInfo ? (
            <div className="text-sm space-y-2">
              <div className="flex items-center gap-3">
                <Badge color="var(--accent-primary)">Trimestre {pregnancyInfo.trimester}</Badge>
                <span className="text-mute">Semaine {pregnancyInfo.weeks} d'aménorrhée</span>
              </div>
              <p className="text-xs text-mute">Le suivi de cycle, les phases folliculaire/ovulation/lutéale et leurs conseils associés sont désactivés — ton plan nutritionnel intègre déjà le supplément calorique du trimestre (voir Nutrition). Toute activité sportive doit rester validée par ta sage-femme/médecin, en particulier après le 1er trimestre (éviter les positions allongées sur le dos prolongées, les sports de contact et à risque de chute).</p>
            </div>
          ) : (
            <p className="text-xs text-mute">Renseigne la date de tes dernières règles ci-dessus pour estimer ton trimestre.</p>
          )}
        </Card>
      ) : lifeStage === 'postpartum' ? (
        <Card title="Post-partum">
          {postpartumInfo ? (
            <div className="text-sm space-y-2">
              <div className="flex items-center gap-3">
                <Badge color="var(--accent-primary)">{postpartumInfo.weeks} semaine{postpartumInfo.weeks > 1 ? 's' : ''} post-partum</Badge>
                {postpartumInfo.breastfeeding && postpartumInfo.kcalBump > 0 && <span className="text-mute">+{postpartumInfo.kcalBump} kcal/j allaitement</span>}
              </div>
              <p className="text-xs text-mute">La reprise du sport doit être validée par ton médecin (souvent au minimum 6 semaines, plus après une césarienne), en particulier pour le renforcement abdominal et le périnée.</p>
              {postpartumInfo.breastfeeding ? (
                <p className="text-xs text-mute">Allaitement : besoin calorique et hydrique plus élevés, déjà reflétés dans ton plan nutritionnel (voir Nutrition) tant que tu restes dans les 12 premiers mois.</p>
              ) : (
                <p className="text-xs text-mute">Coche "J'allaite" ci-dessus si c'est le cas, pour que ton plan nutritionnel intègre le supplément calorique correspondant.</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-mute">Renseigne ta date d'accouchement ci-dessus.</p>
          )}
        </Card>
      ) : lifeStage === 'menopause' ? (
        <Card title="Ménopause">
          <p className="text-sm text-mute">Le suivi de cycle est désactivé (plus de règles attendues). Deux points bien documentés à cet âge : le besoin en calcium/vitamine D augmente (déjà reflété dans tes cibles nutrition) et le travail en résistance (musculation) devient particulièrement important pour la densité osseuse — ton programme actif reste pertinent tel quel de ce point de vue.</p>
        </Card>
      ) : (
        <>
      {phase && (
        <Card title="Current Phase">
          <div className="flex items-center gap-4 flex-wrap">
            <Badge color={CYCLE_PHASE_COLOR[phase.phase]}>{CYCLE_PHASE_LABEL[phase.phase]}</Badge>
            {phase.dayOfCycle && <span className="text-sm text-mute">Day {phase.dayOfCycle} of ~{phase.cycleLength}</span>}
            {predictedNext && <span className="text-sm text-mute">· Next period expected ~{fmtDateShort(predictedNext)}</span>}
          </div>
        </Card>
      )}

      <label className="flex items-start gap-2.5 border border-line rounded-lg px-4 py-3 bg-card cursor-pointer text-sm">
        <input
          type="checkbox"
          checked={!!healthProfile.hormonalContraception}
          onChange={(e) => setHealthProfile({ hormonalContraception: e.target.checked })}
          className="mt-0.5 cursor-pointer"
        />
        <span>
          Je suis sous contraception hormonale (pilule, DIU hormonal, implant…)
          <span className="block text-xs text-mute mt-0.5">Désactive les conseils basés sur les phases folliculaire/ovulation/lutéale, qui supposent un cycle ovulatoire naturel — le suivi du saignement reste inchangé.</span>
        </span>
      </label>

      {coaching?.note && (
        <div className="flex items-start gap-3 border border-line rounded-lg px-4 py-3 bg-card">
          <Sparkles size={16} className="text-accent shrink-0 mt-0.5" />
          <div className="text-sm">
            {coaching.note}
            {activeProgram && coaching.trainingLoadHint && (
              <div className="flex items-center gap-1.5 text-xs text-mute mt-1.5">
                <Dumbbell size={12} />
                {coaching.trainingLoadHint === 'push_ok' && "Ton programme actif peut être suivi tel quel — c'est une fenêtre souvent favorable."}
                {coaching.trainingLoadHint === 'lighter_ok' && 'Si besoin, réduis légèrement charge/volume sur ton programme actif aujourd\'hui — ce n\'est pas une obligation.'}
                {coaching.trainingLoadHint === 'moderate' && 'Ton programme actif reste adapté — reste simplement à l\'écoute si l\'énergie fluctue.'}
              </div>
            )}
          </div>
        </div>
      )}

      {openPeriod && (
        <div className="flex items-center justify-between gap-3 border border-line rounded-lg px-4 py-3 bg-card">
          <span className="text-sm">Period started {fmtDateShort(openPeriod.date)} — still open.</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={endDate}
              min={openPeriod.date}
              max={todayKey()}
              onChange={(e) => e.target.value && setEndDate(e.target.value)}
              className="bg-surface border border-line rounded px-1.5 py-0.5 text-[11px] text-ink cursor-pointer"
            />
            <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => markPeriodEnd(openPeriod.id, endDate)}>Mark ended</Button>
          </div>
        </div>
      )}

      {healthFlag?.regularity && (healthFlag.regularity.status === 'late' || healthFlag.regularity.status === 'irregular') && (
        <Card title="Régularité du cycle">
          <div className="flex items-start gap-2.5 text-sm">
            <Badge color="var(--warning)">{healthFlag.regularity.status === 'late' ? 'En retard' : 'Irrégulier'}</Badge>
            <div className="flex-1">
              {healthFlag.regularity.status === 'late' ? (
                <p>Ton dernier cycle a démarré il y a {healthFlag.regularity.daysSinceLast} jours, contre une moyenne habituelle d'environ {healthFlag.regularity.avgLength}j — un retard ponctuel est normal, mais si ça se répète ça vaut le coup d'en parler à un·e professionnel·le de santé.</p>
              ) : (
                <p>Tes cycles varient d'environ {healthFlag.regularity.variability}j entre le plus court et le plus long (moyenne ~{healthFlag.regularity.avgLength}j) — au-delà de ~9j d'écart est considéré irrégulier. Rien d'alarmant en soi, mais utile à surveiller dans le temps.</p>
              )}
              {healthFlag.energyAvailabilityCaution && (
                <p className="mt-2 text-xs text-mute">Sur les 14 derniers jours, ton apport calorique moyen est nettement sous ta cible du plan nutritionnel — un déficit énergétique prolongé peut être un facteur d'irrégularité du cycle. Si ça persiste, c'est aussi un point à mentionner à un·e professionnel·le de santé.</p>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card title="Log Period Start">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <Field label="Flow">
            <Select value={flow} onChange={(e) => setFlow(e.target.value)} options={[{ value: 'light', label: 'Light' }, { value: 'medium', label: 'Medium' }, { value: 'heavy', label: 'Heavy' }]} />
          </Field>
          <Field label="Start date" hint="Backdate a missed entry">
            <Input type="date" value={startDate} max={todayKey()} onChange={(e) => e.target.value && setStartDate(e.target.value)} />
          </Field>
          <Field label="Notes (optional)">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          {allSymptoms.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSymptom(s)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border cursor-pointer transition-colors ${
                symptoms.includes(s) ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute'
              }`}
            >
              {s}
              {customCycleSymptoms.includes(s) && (
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => { e.stopPropagation(); removeCustomSymptom(s); }}
                  className="hover:text-bad"
                >
                  <X size={11} />
                </span>
              )}
            </button>
          ))}
        </div>
        <form onSubmit={submitCustomSymptom} className="flex gap-2 mb-3">
          <Input value={newSymptom} onChange={(e) => setNewSymptom(e.target.value)} placeholder="Add a custom symptom…" className="flex-1 !py-1.5 text-xs" />
          <Button type="submit" variant="ghost" className="!px-2 !py-1"><Plus size={13} /></Button>
        </form>
        <Button onClick={save}>{startDate === todayKey() ? 'Log today as period start' : `Log ${startDate} as period start`}</Button>
      </Card>

      {energyByPhase && (
        <Card title="Energy by Phase" action={cycleLen && <span className="text-xs text-mute">est. cycle length: {cycleLen}d</span>}>
          <div className="grid grid-cols-4 gap-3 text-center">
            {Object.entries(energyByPhase).map(([phaseKey, val]) => (
              <div key={phaseKey}>
                <div className="text-xs text-mute mb-1">{CYCLE_PHASE_LABEL[phaseKey]}</div>
                <div className="text-lg font-semibold" style={{ color: CYCLE_PHASE_COLOR[phaseKey] }}>{val ?? '—'}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {rpeByPhase && (
        <Card title="Effort perçu par phase (RPE)" action={cycleLen && <span className="text-xs text-mute">est. cycle length: {cycleLen}d</span>}>
          <div className="grid grid-cols-4 gap-3 text-center">
            {Object.entries(rpeByPhase).map(([phaseKey, { avg, n }]) => (
              <div key={phaseKey}>
                <div className="text-xs text-mute mb-1">{CYCLE_PHASE_LABEL[phaseKey]}</div>
                <div className="text-lg font-semibold" style={{ color: CYCLE_PHASE_COLOR[phaseKey] }}>{avg ?? '—'}</div>
                <div className="text-[10px] text-mute">{n} série{n > 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-mute mt-2">RPE moyen (1-10) de tes séries loggées, par phase du cycle — basé sur tes propres données d'entraînement.</p>
        </Card>
      )}

      {restingHrByPhase && (
        <Card title="FC au repos par phase" action={cycleLen && <span className="text-xs text-mute">est. cycle length: {cycleLen}d</span>}>
          <div className="grid grid-cols-4 gap-3 text-center">
            {Object.entries(restingHrByPhase).map(([phaseKey, { avg, n }]) => (
              <div key={phaseKey}>
                <div className="text-xs text-mute mb-1">{CYCLE_PHASE_LABEL[phaseKey]}</div>
                <div className="text-lg font-semibold" style={{ color: CYCLE_PHASE_COLOR[phaseKey] }}>{avg ?? '—'}</div>
                <div className="text-[10px] text-mute">{n} mesure{n > 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-mute mt-2">FC au repos moyenne (bpm), par phase — une hausse en phase lutéale est normale (progestérone) et pas un signe de fatigue.</p>
        </Card>
      )}

      {symptomTrend.length > 1 && (
        <Card title="Symptom Trend">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={symptomTrend}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} formatter={(v) => [`${v} symptôme(s)`, '']} />
              <Bar dataKey="count" fill="#ff6b6b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-mute mt-2">Nombre de symptômes cochés par entrée — une tendance simple, pas une échelle de sévérité clinique.</p>
        </Card>
      )}

      <Card title="History">
        {cycleLogs.length ? (
          <ul className="space-y-1.5">
            {[...cycleLogs].reverse().map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm bg-surface border border-line rounded-lg px-3 py-2">
                <span>
                  {c.date}{c.endDate ? ` → ${c.endDate}` : ''} · {c.flow}{c.symptoms.length ? ` · ${c.symptoms.join(', ')}` : ''}
                </span>
                <button onClick={() => deleteCycleLog(c.id)} className="text-mute hover:text-bad cursor-pointer"><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>No cycle entries yet.</EmptyState>
        )}
      </Card>
        </>
      )}
    </div>
  );
}
