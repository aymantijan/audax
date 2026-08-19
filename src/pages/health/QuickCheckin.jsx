import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Moon, Zap, Scale, Droplet, Utensils, AlertTriangle, Info } from 'lucide-react';
import { useHealthStore } from '../../store/healthStore';
import { useHabitStore } from '../../store/habitStore';
import { todayKey } from '../../utils/formatters';
import { Card, Button, Field, Input, Select } from '../../components/common/ui';

const nowHHMM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

export default function QuickCheckin() {
  const { logBodyComp, logCheckin, logWater, logMeal, mealTemplates, logMealTemplate, bodyComp, healthProfile, getChronoSummary } = useHealthStore();
  const { energyLogs, saveEnergyLog, logNap } = useHabitStore();
  const [open, setOpen] = useState(false);

  const today = todayKey();
  const latestBodyComp = [...bodyComp].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const todayEnergyLog = energyLogs.find((l) => l.date === today);

  const [weightKg, setWeightKg] = useState(latestBodyComp?.weightKg || '');
  const [weightTime, setWeightTime] = useState(nowHHMM());
  const [sleepHours, setSleepHours] = useState(todayEnergyLog?.sleepData?.sleepHours || 7.5);
  const [sleepQuality, setSleepQuality] = useState(todayEnergyLog?.sleepData?.sleepQualityScore || 7);
  const [bedTime, setBedTime] = useState(todayEnergyLog?.sleepData?.sleepStartTime || '23:00');
  const [wakeTime, setWakeTime] = useState(todayEnergyLog?.sleepData?.wakeTime || '07:00');
  const [napTime, setNapTime] = useState('');
  const [napMin, setNapMin] = useState('');
  const [energy, setEnergy] = useState(6);
  const [stress, setStress] = useState(4);
  const [waterMl, setWaterMl] = useState(250);
  const [mealTemplateId, setMealTemplateId] = useState('');
  const [mealTime, setMealTime] = useState(nowHHMM());

  const chrono = useMemo(() => getChronoSummary(today), [getChronoSummary, today, bodyComp, mealTemplateId]);

  const saveWeight = () => {
    if (!weightKg) return;
    logBodyComp({ ...latestBodyComp, weightKg, time: weightTime, sex: latestBodyComp?.sex || healthProfile.sex || 'male' });
  };
  const saveSleep = () => {
    saveEnergyLog({ date: today, sleepData: { sleepHours: Number(sleepHours), sleepQualityScore: Number(sleepQuality), sleepStartTime: bedTime, wakeTime }, energyStartLevel: todayEnergyLog?.energyStartLevel ?? energy, stressLevel: todayEnergyLog?.stressLevel ?? stress });
  };
  const saveNap = () => {
    if (!napTime || !napMin) return;
    logNap(today, napTime, napMin);
    setNapTime(''); setNapMin('');
  };
  const saveEnergyStress = () => logCheckin('morning', energy, stress, '', today);
  const saveWater = () => logWater(waterMl, today);
  const saveMeal = () => {
    if (!mealTemplateId) return;
    logMealTemplate(mealTemplateId, today);
    setMealTemplateId('');
  };

  return (
    <Card
      title="Check-in du jour"
      action={<button onClick={() => setOpen((o) => !o)} className="text-mute hover:text-ink cursor-pointer">{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>}
    >
      {!open ? (
        <button onClick={() => setOpen(true)} className="w-full text-left text-sm text-mute cursor-pointer">
          Sommeil · Énergie · Poids · Eau · Repas — 30 secondes. Cliquer pour ouvrir.
        </button>
      ) : (
        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="border border-line rounded-lg p-3">
              <div className="text-xs font-semibold flex items-center gap-1.5 mb-2"><Moon size={13} /> Sommeil</div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <Field label="Heures"><Input type="number" step="0.5" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} /></Field>
                <Field label="Qualité /10"><Input type="number" min="1" max="10" value={sleepQuality} onChange={(e) => setSleepQuality(e.target.value)} /></Field>
                <Field label="Coucher"><Input type="time" value={bedTime} onChange={(e) => setBedTime(e.target.value)} /></Field>
                <Field label="Lever"><Input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} /></Field>
              </div>
              <Button className="!px-3 !py-1.5 text-xs w-full" onClick={saveSleep}>Enregistrer sommeil</Button>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Input type="time" value={napTime} onChange={(e) => setNapTime(e.target.value)} placeholder="Heure sieste" />
                <Input type="number" value={napMin} onChange={(e) => setNapMin(e.target.value)} placeholder="Durée (min)" />
              </div>
              <Button variant="secondary" className="!px-3 !py-1.5 text-xs w-full mt-2" onClick={saveNap}>+ Sieste</Button>
            </div>

            <div className="border border-line rounded-lg p-3">
              <div className="text-xs font-semibold flex items-center gap-1.5 mb-2"><Zap size={13} /> Énergie & Stress</div>
              <Field label={`Énergie: ${energy}/10`}><input type="range" min="1" max="10" value={energy} onChange={(e) => setEnergy(Number(e.target.value))} className="w-full" /></Field>
              <Field label={`Stress: ${stress}/10`}><input type="range" min="1" max="10" value={stress} onChange={(e) => setStress(Number(e.target.value))} className="w-full" /></Field>
              <Button className="!px-3 !py-1.5 text-xs w-full mt-2" onClick={saveEnergyStress}>Enregistrer</Button>
            </div>

            <div className="border border-line rounded-lg p-3">
              <div className="text-xs font-semibold flex items-center gap-1.5 mb-2"><Scale size={13} /> Poids</div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <Field label="Poids (kg)"><Input type="number" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} /></Field>
                <Field label="Heure"><Input type="time" value={weightTime} onChange={(e) => setWeightTime(e.target.value)} /></Field>
              </div>
              <Button className="!px-3 !py-1.5 text-xs w-full" onClick={saveWeight}>Enregistrer poids</Button>
              {healthProfile.reminderPrefs?.weighInTime && <div className="text-[11px] text-mute mt-1">Heure cible : {healthProfile.reminderPrefs.weighInTime}</div>}
            </div>

            <div className="border border-line rounded-lg p-3">
              <div className="text-xs font-semibold flex items-center gap-1.5 mb-2"><Droplet size={13} /> Eau</div>
              <div className="flex gap-1.5 flex-wrap mb-2">
                {[250, 500, 750].map((ml) => (
                  <Button key={ml} variant="secondary" className="!px-2.5 !py-1 text-xs" onClick={() => logWater(ml, today)}>+{ml}ml</Button>
                ))}
              </div>
              {chrono.hydrationGaps.lastIntakeHoursAgo != null && (
                <div className="text-[11px] text-mute">Dernière eau il y a {chrono.hydrationGaps.lastIntakeHoursAgo}h</div>
              )}
            </div>
          </div>

          <div className="border border-line rounded-lg p-3">
            <div className="text-xs font-semibold flex items-center gap-1.5 mb-2"><Utensils size={13} /> Repas rapide</div>
            <div className="flex gap-2">
              <Select className="flex-1" value={mealTemplateId} onChange={(e) => setMealTemplateId(e.target.value)}>
                <option value="">Choisir un modèle favori…</option>
                {mealTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
              <Button onClick={saveMeal} disabled={!mealTemplateId}>Logger</Button>
            </div>
            {chrono.fastingWindows.currentFastHours != null && (
              <div className="text-[11px] text-mute mt-1">Aucun repas aujourd'hui — jeûne en cours: {chrono.fastingWindows.currentFastHours}h</div>
            )}
          </div>

          {chrono.alerts.length > 0 && (
            <div className="space-y-1.5">
              {chrono.alerts.map((a) => (
                <div key={a.id} className={`flex items-start gap-2 text-xs border rounded-lg px-3 py-2 ${a.level === 'warning' ? 'border-warning/40 bg-warning/10 text-warning' : 'border-line bg-surface text-mute'}`}>
                  {a.level === 'warning' ? <AlertTriangle size={12} className="shrink-0 mt-0.5" /> : <Info size={12} className="shrink-0 mt-0.5" />}
                  {a.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
