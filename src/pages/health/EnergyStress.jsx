import { useState, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useHealthStore } from '../../store/healthStore';
import { Card, Button, Field, Select, Input } from '../../components/common/ui';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };
const SLOTS = [
  { value: 'morning', label: 'Morning' },
  { value: 'postWorkout', label: 'Post-workout' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
];

export default function EnergyStress() {
  const { checkins, logCheckin } = useHealthStore();
  const [slot, setSlot] = useState('morning');
  const [energy, setEnergy] = useState(6);
  const [stress, setStress] = useState(4);
  const [note, setNote] = useState('');

  const save = () => {
    logCheckin(slot, energy, stress, note);
    setNote('');
  };

  const trend = useMemo(() => {
    const byDate = {};
    for (const c of checkins) {
      byDate[c.date] ||= { date: c.date.slice(5) };
      byDate[c.date][`${c.slot}Energy`] = c.energy;
      byDate[c.date][`${c.slot}Stress`] = c.stress;
    }
    return Object.values(byDate)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .slice(-7);
  }, [checkins]);

  return (
    <div className="space-y-6">
      <Card title="Check-in">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <Field label="Time of day">
            <Select value={slot} onChange={(e) => setSlot(e.target.value)} options={SLOTS} />
          </Field>
          <Field label={`Energy: ${energy}/10`}>
            <input type="range" min="1" max="10" value={energy} onChange={(e) => setEnergy(Number(e.target.value))} className="w-full" />
          </Field>
          <Field label={`Stress: ${stress}/10`}>
            <input type="range" min="1" max="10" value={stress} onChange={(e) => setStress(Number(e.target.value))} className="w-full" />
          </Field>
          <Field label="Note (optional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <Button className="mt-3" onClick={save}>Save check-in</Button>
      </Card>

      <Card title="7-Day Energy & Stress Trend">
        {trend.length > 1 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis domain={[0, 10]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="morningEnergy" name="Morning energy" stroke="#00d9ff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="eveningEnergy" name="Evening energy" stroke="#7c5cff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="eveningStress" name="Evening stress" stroke="#ff6b6b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center text-mute text-sm py-6">Log a few check-ins across the day to see trends.</div>
        )}
      </Card>
    </div>
  );
}
