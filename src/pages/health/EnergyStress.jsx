import { useState, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useHealthStore } from '../../store/healthStore';
import { todayKey } from '../../utils/formatters';
import { Card, Button, Field, Select, Input } from '../../components/common/ui';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };
const SLOTS = [
  { value: 'morning', label: 'Morning', color: '#00d9ff' },
  { value: 'postWorkout', label: 'Post-workout', color: '#00d97f' },
  { value: 'afternoon', label: 'Afternoon', color: '#ffa500' },
  { value: 'evening', label: 'Evening', color: '#7c5cff' },
];

export default function EnergyStress() {
  const { checkins, logCheckin } = useHealthStore();
  const [slot, setSlot] = useState('morning');
  const [energy, setEnergy] = useState(6);
  const [stress, setStress] = useState(4);
  const [note, setNote] = useState('');
  const [checkinDate, setCheckinDate] = useState(todayKey());

  const save = () => {
    logCheckin(slot, energy, stress, note, checkinDate);
    setNote('');
    setCheckinDate(todayKey());
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

  // Only draw a line for a slot that's actually been logged at least once —
  // previously morning/evening were hardcoded and postWorkout/afternoon data
  // was silently collected but never shown on either chart.
  const loggedSlots = useMemo(() => SLOTS.filter((s) => checkins.some((c) => c.slot === s.value)), [checkins]);

  return (
    <div className="space-y-6">
      <Card title="Check-in">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
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
          <Field label="Date" hint="Backdate a missed check-in">
            <Input type="date" value={checkinDate} max={todayKey()} onChange={(e) => e.target.value && setCheckinDate(e.target.value)} />
          </Field>
        </div>
        <Button className="mt-3" onClick={save}>{checkinDate === todayKey() ? 'Save check-in' : `Save check-in for ${checkinDate}`}</Button>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="7-Day Energy Trend — by time of day">
          {trend.length > 1 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis domain={[0, 10]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {loggedSlots.map((s) => (
                  <Line key={s.value} type="monotone" dataKey={`${s.value}Energy`} name={s.label} stroke={s.color} strokeWidth={2} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-mute text-sm py-6">Log a few check-ins across the day to see trends.</div>
          )}
        </Card>

        <Card title="7-Day Stress Trend — by time of day">
          {trend.length > 1 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis domain={[0, 10]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {loggedSlots.map((s) => (
                  <Line key={s.value} type="monotone" dataKey={`${s.value}Stress`} name={s.label} stroke={s.color} strokeWidth={2} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-mute text-sm py-6">Log a few check-ins across the day to see trends.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
