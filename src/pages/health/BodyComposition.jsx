import { useState, useMemo } from 'react';
import { Trash2, FileDown } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useHealthStore } from '../../store/healthStore';
import { Card, Button, Field, Input, Select, EmptyState } from '../../components/common/ui';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

// jsPDF is loaded on demand (dynamic import) so its ~200KB (incl. html2canvas/
// purify deps it pulls transitively) doesn't bloat the Health page's initial chunk.
async function exportMonthlyReportPDF(bodyComp, prediction) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const monthAgo = Date.now() - 30 * 86400000;
  const monthEntries = [...bodyComp].filter((b) => new Date(b.date).getTime() >= monthAgo).sort((a, b) => (a.date < b.date ? -1 : 1));
  const latest = monthEntries[monthEntries.length - 1];
  const first = monthEntries[0];

  let y = 20;
  doc.setFontSize(18);
  doc.text('AUDAX — Monthly Body Composition Report', 14, y);
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
  const { bodyComp, logBodyComp, deleteBodyComp, getWeightPrediction } = useHealthStore();
  const latest = [...bodyComp].sort((a, b) => (a.date < b.date ? 1 : -1))[0];

  const [form, setForm] = useState({
    weightKg: latest?.weightKg || '',
    waistCm: latest?.waistCm || '',
    neckCm: latest?.neckCm || '',
    hipCm: latest?.hipCm || '',
    heightCm: latest?.heightCm || '',
    sex: latest?.sex || 'male',
    absRating: latest?.absRating || 5,
    visualBodyFatPct: '',
  });

  const submit = (e) => {
    e.preventDefault();
    logBodyComp(form);
  };

  const prediction = getWeightPrediction();

  const trend = useMemo(
    () =>
      [...bodyComp]
        .sort((a, b) => (a.date > b.date ? 1 : -1))
        .map((b) => ({ date: b.date.slice(5), weight: b.weightKg, bodyFat: b.bodyFatPct, waist: b.waistCm })),
    [bodyComp]
  );

  return (
    <div className="space-y-6">
      <Card title="Log Body Composition">
        <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Weight (kg)">
            <Input type="number" step="0.1" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} />
          </Field>
          <Field label="Sex (for Navy formula)">
            <Select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
          </Field>
          <Field label="Height (cm)">
            <Input type="number" value={form.heightCm} onChange={(e) => setForm({ ...form, heightCm: e.target.value })} />
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
          <Field label={`Visual abs rating: ${form.absRating}/10`}>
            <input type="range" min="1" max="10" value={form.absRating} onChange={(e) => setForm({ ...form, absRating: Number(e.target.value) })} className="w-full mt-2" />
          </Field>
          <Field label="Visual body-fat estimate % (optional fallback)">
            <Input type="number" step="0.1" value={form.visualBodyFatPct} onChange={(e) => setForm({ ...form, visualBodyFatPct: e.target.value })} placeholder="Used only if Navy formula inputs are incomplete" />
          </Field>
          <div className="col-span-2 md:col-span-4">
            <Button type="submit" className="w-full">Log today</Button>
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

      <Card title="Weight Prediction" action={<Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => exportMonthlyReportPDF(bodyComp, prediction)}><span className="flex items-center gap-2"><FileDown size={13} /> Export monthly PDF</span></Button>}>
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
              <Line type="monotone" dataKey="weight" stroke="#00d9ff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="bodyFat" stroke="#ff6b6b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="waist" stroke="#00d97f" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState>Log a few entries to see trends.</EmptyState>
        )}
      </Card>

      {bodyComp.length > 0 && (
        <Card title="History">
          <ul className="space-y-1.5">
            {[...bodyComp].sort((a, b) => (a.date < b.date ? 1 : -1)).map((b) => (
              <li key={b.id} className="flex items-center justify-between text-sm bg-surface border border-line rounded-lg px-3 py-2">
                <span className="text-mute text-xs">{b.date}</span>
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
