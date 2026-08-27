import { useEffect, useMemo, useRef, useState } from 'react';
import { Timer, Play, Square, Plus, Trash2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { useFocusStore } from '../store/focusStore';
import { FOCUS_DOMAINS } from '../utils/constants';
import { fmtDateShort, todayKey } from '../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState } from '../components/common/ui';
import BadgeList from '../components/common/BadgeList';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };
const DOMAIN_COLOR = {
  Trading: 'var(--success)', PE: 'var(--accent-secondary)', Engineering: 'var(--warning)', Business: '#b366ff',
  Learning: '#66ccff', Health: '#ff6b6b', Networking: '#0a66c2', Career: 'var(--accent-primary)', Content: '#ff9f43', Projects: '#00d9ff', General: 'var(--text-secondary)',
};

function fmtHMS(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function LiveTimer({ onLog }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [domain, setDomain] = useState('General');
  const startRef = useRef(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [running]);

  const start = () => { startRef.current = Date.now(); setElapsed(0); setRunning(true); };
  const stop = () => {
    setRunning(false);
    const minutes = Math.max(1, Math.round(elapsed / 60));
    onLog({ domain, durationMinutes: minutes, date: todayKey() });
    setElapsed(0);
  };

  return (
    <Card title="Timer">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="text-4xl font-mono font-bold tabular-nums">{fmtHMS(elapsed)}</div>
          {!running ? (
            <Select value={domain} onChange={(e) => setDomain(e.target.value)} options={FOCUS_DOMAINS} className="w-40" />
          ) : (
            <Badge color={DOMAIN_COLOR[domain]}>{domain}</Badge>
          )}
        </div>
        {!running ? (
          <Button onClick={start}><span className="flex items-center gap-2"><Play size={15} /> Démarrer</span></Button>
        ) : (
          <Button variant="danger" onClick={stop}><span className="flex items-center gap-2"><Square size={15} /> Arrêter & logger</span></Button>
        )}
      </div>
    </Card>
  );
}

const blank = () => ({ domain: 'General', durationMinutes: '', date: todayKey(), notes: '' });

export default function FocusSessions() {
  const { sessions, logSession, deleteSession, getBadges } = useFocusStore();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(blank());
  const today = todayKey();

  const todayMinutes = useMemo(() => sessions.filter((s) => s.date === today).reduce((a, s) => a + s.durationMinutes, 0), [sessions, today]);
  const weekMinutes = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    return sessions.filter((s) => s.date >= weekAgo).reduce((a, s) => a + s.durationMinutes, 0);
  }, [sessions]);
  const totalHours = Math.round((sessions.reduce((a, s) => a + s.durationMinutes, 0) / 60) * 10) / 10;
  const byDomain = useMemo(
    () => FOCUS_DOMAINS.map((d) => ({ name: d, minutes: sessions.filter((s) => s.domain === d).reduce((a, s) => a + s.durationMinutes, 0) })).filter((d) => d.minutes > 0),
    [sessions]
  );

  const submit = (e) => {
    e.preventDefault();
    const res = logSession(form);
    if (!res.ok) return alert(res.error);
    setModal(false);
    setForm(blank());
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deep Work</h1>
          <p className="text-mute text-sm mt-1">Sessions de concentration par domaine — la discipline rendue mesurable.</p>
        </div>
        <Button variant="secondary" onClick={() => setModal(true)}><span className="flex items-center gap-2"><Plus size={16} /> Logger manuellement</span></Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Aujourd'hui" value={`${todayMinutes} min`} />
        <Stat label="Cette semaine" value={`${weekMinutes} min`} />
        <Stat label="Total" value={`${totalHours} h`} />
        <Stat label="Sessions" value={sessions.length} />
      </div>

      <LiveTimer onLog={logSession} />

      {byDomain.length > 1 && (
        <Card title="Minutes par domaine">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byDomain} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
              <Tooltip {...tooltipStyle} formatter={(v) => [`${v} min`, 'Temps']} />
              <Bar dataKey="minutes" radius={[0, 4, 4, 0]}>
                {byDomain.map((d) => <Cell key={d.name} fill={DOMAIN_COLOR[d.name]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card title={`Sessions (${sessions.length})`}>
        {sessions.length ? (
          <ul className="space-y-1.5 max-h-96 overflow-y-auto">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 bg-surface border border-line rounded-lg px-3 py-2.5 text-sm">
                <Badge color={DOMAIN_COLOR[s.domain]}>{s.domain}</Badge>
                <span className="font-medium">{s.durationMinutes} min</span>
                <span className="text-mute text-xs">{fmtDateShort(s.date)}</span>
                {s.notes && <span className="text-mute text-xs flex-1 truncate">{s.notes}</span>}
                <button className="text-mute hover:text-bad cursor-pointer ml-auto" onClick={() => deleteSession(s.id)}><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState><Timer className="mx-auto mb-2 text-mute" size={26} />Aucune session pour l'instant. Lance le timer ou logue une session passée.</EmptyState>
        )}
      </Card>

      <BadgeList badges={getBadges()} />

      <Modal open={modal} onClose={() => setModal(false)} title="Logger une session">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Domaine"><Select value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} options={FOCUS_DOMAINS} /></Field>
            <Field label="Durée (minutes)"><Input type="number" min="1" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} autoFocus /></Field>
          </div>
          <Field label="Date"><Input type="date" value={form.date} max={todayKey()} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Notes (optionnel)"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button type="submit">Logger</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
