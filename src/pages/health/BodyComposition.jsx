import { useState, useMemo } from 'react';
import { Trash2, FileDown, Camera } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useHealthStore } from '../../store/healthStore';
import { computeBMR, computeTDEE, ACTIVITY_MULTIPLIERS } from '../../utils/health-science';
import { todayKey } from '../../utils/formatters';
import { Card, Button, Field, Input, Select, EmptyState } from '../../components/common/ui';

const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;
const CALORIE_GOALS = [
  { key: 'cut20', label: 'Aggressive cut', pct: -0.2 },
  { key: 'cut10', label: 'Mild cut', pct: -0.1 },
  { key: 'maintain', label: 'Maintain', pct: 0 },
  { key: 'bulk10', label: 'Mild bulk', pct: 0.1 },
  { key: 'bulk20', label: 'Aggressive bulk', pct: 0.2 },
];

function readPhotoAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_PHOTO_BYTES) return reject(new Error('Photo is too large (max 1.5MB) — try a smaller image.'));
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

// jsPDF is loaded on demand (dynamic import) so its ~200KB (incl. html2canvas/
// purify deps it pulls transitively) doesn't bloat the Health page's initial chunk.
async function exportMonthlyReportPDF(bodyComp, prediction, extra = {}) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const monthAgo = Date.now() - 30 * 86400000;
  const monthEntries = [...bodyComp].filter((b) => new Date(b.date).getTime() >= monthAgo).sort((a, b) => (a.date < b.date ? -1 : 1));
  const latest = monthEntries[monthEntries.length - 1];
  const first = monthEntries[0];

  let y = 20;
  doc.setFontSize(18);
  doc.text('AUDAX — Monthly Health Report', 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleDateString()} · ${monthEntries.length} entries in the last 30 days`, 14, y);
  y += 12;

  doc.setTextColor(0);
  doc.setFontSize(13);
  doc.text('Summary', 14, y);
  y += 7;
  doc.setFontSize(10);
  const lines = [
    `Current weight: ${latest?.weightKg ?? '—'} kg`,
    `Weight change this month: ${first && latest && first.weightKg && latest.weightKg ? (latest.weightKg - first.weightKg).toFixed(1) : '—'} kg`,
    `Current body fat: ${latest?.bodyFatPct ?? '—'}% (${latest?.bodyFatMethod ?? 'n/a'})`,
    `Current waist: ${latest?.waistCm ?? '—'} cm`,
    '',
    `Predicted weekly rate (realistic): ${prediction.weeklyRateKg.realistic} kg/wk`,
    `Predicted 12-week change: conservative ${prediction.projectedChangeKg.conservative['12w']}kg · realistic ${prediction.projectedChangeKg.realistic['12w']}kg · optimistic ${prediction.projectedChangeKg.optimistic['12w']}kg`,
    `Prediction confidence: ${prediction.confidence}%`,
  ];
  for (const line of lines) {
    doc.text(line, 14, y);
    y += 6;
  }

  if (extra.program || extra.plan) {
    y += 6;
    doc.setFontSize(13);
    doc.text('Training & Nutrition Plan', 14, y);
    y += 7;
    doc.setFontSize(10);
    const planLines = [];
    if (extra.program) {
      planLines.push(`Program: ${extra.program.splitType.replace('_', ' ')}, ${extra.program.daysPerWeek}x/week`);
      if (extra.adherence?.percent != null) planLines.push(`Adherence: ${extra.adherence.percent}% of planned exercises logged (week ${extra.adherence.weeksElapsed}/${extra.adherence.totalWeeks})`);
    }
    if (extra.plan) {
      planLines.push(`Nutrition target: ${extra.plan.targetKcal} kcal/day (${extra.plan.targetMacros.proteinG}P / ${extra.plan.targetMacros.carbsG}C / ${extra.plan.targetMacros.fatG}F)`);
    }
    for (const line of planLines) { doc.text(line, 14, y); y += 6; }
  }

  y += 6;
  doc.setFontSize(13);
  doc.text('Entries (last 30 days)', 14, y);
  y += 7;
  doc.setFontSize(9);
  doc.text('Date', 14, y);
  doc.text('Weight (kg)', 60, y);
  doc.text('Waist (cm)', 110, y);
  doc.text('Body Fat %', 160, y);
  y += 5;
  doc.setDrawColor(200);
  doc.line(14, y, 196, y);
  y += 5;
  for (const b of monthEntries) {
    if (y > 280) { doc.addPage(); y = 20; }
    doc.text(b.date, 14, y);
    doc.text(String(b.weightKg ?? '—'), 60, y);
    doc.text(String(b.waistCm ?? '—'), 110, y);
    doc.text(String(b.bodyFatPct ?? '—'), 160, y);
    y += 6;
  }

  doc.save(`audax-body-comp-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function BodyComposition() {
  const { bodyComp, logBodyComp, deleteBodyComp, getWeightPrediction, getBodyCompPrecision, getSmoothedBodyCompTrend, getActiveProgram, getActiveCuratedProgram, getActiveNutritionPlan, getProgramAdherence, getCyclePhaseCoaching, isCyclePhaseHormonallyReliable } = useHealthStore();
  const cycleCoaching = getCyclePhaseCoaching();
  // Progesterone peaks mid-luteal and promotes fluid retention — a well-
  // documented ~0.5-1.4kg (up to ~2.3kg) scale increase that's water, not
  // fat, and resolves once the period starts. Shown so a normal premenstrual
  // fluctuation doesn't get misread as the diet/program failing. The luteal
  // mechanism assumes a real progesterone surge, generally suppressed under
  // hormonal contraception — menstrual-window bloating stays regardless.
  const showWaterRetentionNote = cycleCoaching?.phase === 'menstrual' || (cycleCoaching?.phase === 'luteal' && isCyclePhaseHormonallyReliable());
  const latest = [...bodyComp].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const precision = getBodyCompPrecision();
  const smoothed = getSmoothedBodyCompTrend();

  const [form, setForm] = useState({
    weightKg: latest?.weightKg || '',
    waistCm: latest?.waistCm || '',
    neckCm: latest?.neckCm || '',
    hipCm: latest?.hipCm || '',
    heightCm: latest?.heightCm || '',
    chestCm: latest?.chestCm || '',
    armCm: latest?.armCm || '',
    thighCm: latest?.thighCm || '',
    calfCm: latest?.calfCm || '',
    ageYears: latest?.ageYears || '',
    sex: latest?.sex || 'male',
    absRating: latest?.absRating || 5,
    visualBodyFatPct: '',
    photo: null,
    date: todayKey(),
  });
  const [photoError, setPhotoError] = useState('');
  const [activityLevel, setActivityLevel] = useState('moderate');

  const submit = (e) => {
    e.preventDefault();
    logBodyComp(form);
    setForm((f) => ({ ...f, photo: null, date: todayKey() }));
  };

  const onPhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    try {
      const dataUrl = await readPhotoAsDataUrl(file);
      setForm((f) => ({ ...f, photo: dataUrl }));
    } catch (err) {
      setPhotoError(err.message);
    }
  };

  const prediction = getWeightPrediction();

  const bmr = latest ? computeBMR({ weightKg: latest.weightKg, heightCm: latest.heightCm, age: latest.ageYears, sex: latest.sex }) : null;
  const tdee = bmr ? computeTDEE(bmr, activityLevel) : null;

  const trend = useMemo(
    () =>
      [...bodyComp]
        .sort((a, b) => (a.date > b.date ? 1 : -1))
        .map((b) => ({ date: b.date.slice(5), weight: b.weightKg, bodyFat: b.bodyFatPct, waist: b.waistCm })),
    [bodyComp]
  );

  return (
    <div className="space-y-6">
      {showWaterRetentionNote && (
        <div className="flex items-start gap-3 border border-line rounded-lg px-4 py-3 bg-card">
          <div className="text-sm text-mute">
            <span className="font-medium text-ink">{cycleCoaching.phase === 'luteal' ? 'Phase lutéale' : 'Phase menstruelle'} :</span>{' '}
            une prise de 0.5-1.4kg sur la balance (jusqu'à ~2.3kg selon les personnes) est normale à ce moment du cycle — c'est de la rétention d'eau liée à la progestérone, pas de la graisse. Ça se résorbe après le début des règles ; pas un signal d'échec du programme ou du plan nutritionnel.
          </div>
        </div>
      )}

      <Card title="Log Body Composition">
        <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Weight (kg)">
            <Input type="number" step="0.1" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} />
          </Field>
          <Field label="Date" hint="Backdate a missed entry">
            <Input type="date" value={form.date} max={todayKey()} onChange={(e) => e.target.value && setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Sex (for Navy formula)">
            <Select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
          </Field>
          <Field label="Height (cm)">
            <Input type="number" value={form.heightCm} onChange={(e) => setForm({ ...form, heightCm: e.target.value })} />
          </Field>
          <Field label="Age (years)" hint="For the BMR/TDEE estimate below">
            <Input type="number" min="10" max="100" value={form.ageYears} onChange={(e) => setForm({ ...form, ageYears: e.target.value })} />
          </Field>
          <Field label="Waist (cm)">
            <Input type="number" step="0.1" value={form.waistCm} onChange={(e) => setForm({ ...form, waistCm: e.target.value })} />
          </Field>
          <Field label="Neck (cm)">
            <Input type="number" step="0.1" value={form.neckCm} onChange={(e) => setForm({ ...form, neckCm: e.target.value })} />
          </Field>
          {form.sex === 'female' && (
            <Field label="Hip (cm)">
              <Input type="number" step="0.1" value={form.hipCm} onChange={(e) => setForm({ ...form, hipCm: e.target.value })} />
            </Field>
          )}
          <Field label="Chest (cm, optional)">
            <Input type="number" step="0.1" value={form.chestCm} onChange={(e) => setForm({ ...form, chestCm: e.target.value })} />
          </Field>
          <Field label="Arm (cm, optional)">
            <Input type="number" step="0.1" value={form.armCm} onChange={(e) => setForm({ ...form, armCm: e.target.value })} />
          </Field>
          <Field label="Thigh (cm, optional)">
            <Input type="number" step="0.1" value={form.thighCm} onChange={(e) => setForm({ ...form, thighCm: e.target.value })} />
          </Field>
          <Field label="Calf (cm, optional)">
            <Input type="number" step="0.1" value={form.calfCm} onChange={(e) => setForm({ ...form, calfCm: e.target.value })} />
          </Field>
          <Field label={`Visual abs rating: ${form.absRating}/10`}>
            <input type="range" min="1" max="10" value={form.absRating} onChange={(e) => setForm({ ...form, absRating: Number(e.target.value) })} className="w-full mt-2" />
          </Field>
          <Field label="Visual body-fat estimate % (optional fallback)">
            <Input type="number" step="0.1" value={form.visualBodyFatPct} onChange={(e) => setForm({ ...form, visualBodyFatPct: e.target.value })} placeholder="Used only if Navy formula inputs are incomplete" />
          </Field>
          <Field label="Progress photo (optional)" hint="Stored locally, max 1.5MB">
            <label className="flex items-center gap-2 border border-line rounded-lg px-3 py-2 text-xs text-mute cursor-pointer hover:text-ink">
              <Camera size={14} />
              {form.photo ? 'Photo attached ✓' : 'Choose photo…'}
              <input type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
            </label>
            {photoError && <p className="text-bad text-[11px] mt-1">{photoError}</p>}
          </Field>
          <div className="col-span-2 md:col-span-4">
            <Button type="submit" className="w-full">{form.date === todayKey() ? 'Log today' : `Log for ${form.date}`}</Button>
          </div>
        </form>
      </Card>

      {latest && (
        <Card title="Current Estimate">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-mute mb-1">Weight</div>
              <div className="text-xl font-bold">{latest.weightKg ?? '—'} kg</div>
            </div>
            <div>
              <div className="text-xs text-mute mb-1">Body Fat %</div>
              <div className="text-xl font-bold">{latest.bodyFatPct ?? '—'}%</div>
              <div className="text-[11px] text-mute">{latest.bodyFatMethod === 'navy' ? 'Navy method' : latest.bodyFatMethod === 'visual' ? 'Visual estimate' : ''}</div>
            </div>
            <div>
              <div className="text-xs text-mute mb-1">Waist</div>
              <div className="text-xl font-bold">{latest.waistCm ?? '—'} cm</div>
            </div>
          </div>
        </Card>
      )}

      {precision && (Object.values(precision.methods).some((v) => v != null) || precision.ffmi) && (
        <Card title="Précision — méthodes multiples">
          <div className="grid grid-cols-3 gap-3 text-center mb-3">
            {[['navy', 'Navy'], ['ymca', 'YMCA'], ['deurenberg', 'Deurenberg']].map(([key, label]) => (
              <div key={key} className="bg-surface border border-line rounded-lg p-2.5">
                <div className="text-[11px] text-mute mb-1">{label}</div>
                <div className="text-sm font-semibold">{precision.methods[key] != null ? `${precision.methods[key]}%` : '—'}</div>
              </div>
            ))}
          </div>
          {precision.ffmi && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><div className="text-xs text-mute mb-1">Masse maigre</div><div className="text-sm font-semibold">{precision.leanMassKg} kg</div></div>
              <div><div className="text-xs text-mute mb-1">FFMI</div><div className="text-sm font-semibold">{precision.ffmi.ffmi}</div></div>
              <div><div className="text-xs text-mute mb-1">FFMI normalisé</div><div className="text-sm font-semibold">{precision.ffmi.normalizedFfmi}</div></div>
            </div>
          )}
          <p className="text-[11px] text-mute mt-3">Le FFMI (masse maigre normalisée par la taille) est l'indicateur le plus fiable pour suivre la construction musculaire dans le temps — un FFMI qui monte à BF% stable ou en baisse = vrai gain musculaire.</p>
        </Card>
      )}

      {latest && (
        <Card title="Energy Needs (BMR / TDEE)">
          {bmr ? (
            <>
              <div className="grid grid-cols-2 gap-4 text-center mb-4">
                <div>
                  <div className="text-xs text-mute mb-1">BMR</div>
                  <div className="text-xl font-bold">{bmr} kcal/day</div>
                  <div className="text-[11px] text-mute">Mifflin-St Jeor, at rest</div>
                </div>
                <div>
                  <div className="text-xs text-mute mb-1">TDEE</div>
                  <div className="text-xl font-bold">{tdee} kcal/day</div>
                  <div className="text-[11px] text-mute">BMR × activity level</div>
                </div>
              </div>
              <Field label="Activity level">
                <Select
                  value={activityLevel}
                  onChange={(e) => setActivityLevel(e.target.value)}
                  options={Object.entries(ACTIVITY_MULTIPLIERS).map(([value, v]) => ({ value, label: v.label }))}
                />
              </Field>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
                {CALORIE_GOALS.map((g) => (
                  <div key={g.key} className="bg-surface border border-line rounded-lg p-2.5 text-center">
                    <div className="text-[11px] text-mute mb-1">{g.label}</div>
                    <div className="text-sm font-semibold">{Math.round(tdee * (1 + g.pct))}</div>
                    <div className="text-[10px] text-mute">kcal/day</div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-mute mt-3">
                An estimate, not a prescription — actual maintenance varies by individual. Track weight trend over 2-3 weeks at a target and adjust from there.
              </p>
            </>
          ) : (
            <EmptyState>Log weight, height, age, and sex above to estimate your energy needs.</EmptyState>
          )}
        </Card>
      )}

      <Card title="Weight Prediction" action={<Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => exportMonthlyReportPDF(bodyComp, prediction, { program: getActiveProgram() || getActiveCuratedProgram(), plan: getActiveNutritionPlan(), adherence: getProgramAdherence() })}><span className="flex items-center gap-2"><FileDown size={13} /> Export monthly PDF</span></Button>}>
        <div className="text-xs text-mute mb-3">Confidence: {prediction.confidence}% (based on days logged) · Efficiency multiplier: {prediction.efficiency}%</div>
        <div className="grid grid-cols-3 gap-3 text-center mb-3">
          {['conservative', 'realistic', 'optimistic'].map((k) => (
            <div key={k} className="bg-surface border border-line rounded-lg p-3">
              <div className="text-xs text-mute capitalize mb-1">{k}</div>
              <div className="text-sm font-semibold">{prediction.weeklyRateKg[k]} kg/wk</div>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-mute text-left">
                <th className="py-1">Horizon</th>
                <th>Conservative</th>
                <th>Realistic</th>
                <th>Optimistic</th>
              </tr>
            </thead>
            <tbody>
              {['4w', '8w', '12w', '26w'].map((h) => (
                <tr key={h} className="border-t border-line">
                  <td className="py-1.5">{h}</td>
                  <td>{prediction.projectedChangeKg.conservative[h]} kg</td>
                  <td>{prediction.projectedChangeKg.realistic[h]} kg</td>
                  <td>{prediction.projectedChangeKg.optimistic[h]} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Trends">
        {trend.length > 1 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="weight" stroke="#00d9ff" strokeWidth={1.5} strokeOpacity={0.4} dot={false} name="Weight (raw)" />
              <Line type="monotone" dataKey="bodyFat" stroke="#ff6b6b" strokeWidth={1.5} strokeOpacity={0.4} dot={false} name="Body fat (raw)" />
              <Line type="monotone" dataKey="waist" stroke="#00d97f" strokeWidth={1.5} strokeOpacity={0.4} dot={false} name="Waist (raw)" />
              <Line type="monotone" data={smoothed.weight.map((e) => ({ date: e.date.slice(5), weightMA: e.weightKgMA }))} dataKey="weightMA" stroke="#00d9ff" strokeWidth={2.5} dot={false} name="Weight (7j MA)" />
              <Line type="monotone" data={smoothed.bodyFat.map((e) => ({ date: e.date.slice(5), bodyFatMA: e.bodyFatPctMA }))} dataKey="bodyFatMA" stroke="#ff6b6b" strokeWidth={2.5} dot={false} name="Body fat (7j MA)" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState>Log a few entries to see trends.</EmptyState>
        )}
      </Card>

      {bodyComp.some((b) => b.photo) && (
        <Card title="Photo Timeline">
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {[...bodyComp].filter((b) => b.photo).sort((a, b) => (a.date < b.date ? -1 : 1)).map((b) => (
              <div key={b.id} className="text-center">
                <img src={b.photo} alt={b.date} className="w-full aspect-square rounded-lg object-cover border border-line" />
                <div className="text-[10px] text-mute mt-1">{b.date.slice(5)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {bodyComp.length > 0 && (
        <Card title="History">
          <ul className="space-y-1.5">
            {[...bodyComp].sort((a, b) => (a.date < b.date ? 1 : -1)).map((b) => (
              <li key={b.id} className="flex items-center justify-between text-sm bg-surface border border-line rounded-lg px-3 py-2">
                <span className="flex items-center gap-2">
                  {b.photo && <img src={b.photo} alt="" className="w-8 h-8 rounded object-cover" />}
                  <span className="text-mute text-xs">{b.date}</span>
                </span>
                <span>{b.weightKg ?? '—'}kg · BF {b.bodyFatPct ?? '—'}%</span>
                <button onClick={() => deleteBodyComp(b.id)} className="text-mute hover:text-bad cursor-pointer"><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
