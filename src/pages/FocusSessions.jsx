import { useMemo, useState } from 'react';
import { Timer, Plus, Trash2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { useFocusStore } from '../store/focusStore';
import { FOCUS_DOMAINS } from '../utils/constants';
import { todayKey } from '../utils/formatters';
import { toast } from '../store/uiStore';
import { Card, Stat, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState } from '../components/common/ui';
import BadgeList from '../components/common/BadgeList';
import { StudyTimerCard, domainLabel } from '../components/learning/StudyTimer';
import { useLearningStore } from '../store/learningStore';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };
const DOMAIN_COLOR = {
  Trading: 'var(--success)', PE: 'var(--accent-secondary)', Engineering: 'var(--warning)', Business: '#b366ff',
  Learning: '#66ccff', Health: '#ff6b6b', Networking: '#0a66c2', Career: 'var(--accent-primary)', Content: '#ff9f43', Projects: '#00d9ff', General: 'var(--text-secondary)',
};

const blank = () => ({ domain: 'General', durationMinutes: '', date: todayKey(), notes: '' });

export default function FocusSessions() {
  const { sessions, logSession, deleteSession, getBadges } = useFocusStore();
  const courses = useLearningStore((s) => s.courses);
  const courseName = (id) => courses.find((c) => c.id === id)?.name;
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
    () => FOCUS_DOMAINS.map((d) => ({ key: d, name: domainLabel(d), minutes: sessions.filter((s) => s.domain === d).reduce((a, s) => a + s.durationMinutes, 0) })).filter((d) => d.minutes > 0),
    [sessions]
  );

  const submit = (e) => {
    e.preventDefault();
    const res = logSession(form);
    if (!res.ok) return toast(res.error, 'error');
    setModal(false);
    setForm(blank());
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deep Work</h1>
          <p className="text-mute text-sm mt-1">Tout votre temps de concentration, par domaine. Le même chrono que dans Apprentissage : il continue quand vous changez de page.</p>
        </div>
        <Button variant="secondary" onClick={() => setModal(true)}><span className="flex items-center gap-2"><Plus size={16} /> Ajouter une session</span></Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Aujourd'hui" value={`${todayMinutes} min`} />
        <Stat label="Cette semaine" value={`${weekMinutes} min`} />
        <Stat label="Total" value={`${totalHours} h`} />
        <Stat label="Sessions" value={sessions.length} />
      </div>

      <StudyTimerCard allDomains />

      {byDomain.length > 1 && (
        <Card title="Minutes par domaine">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byDomain} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
              <Tooltip {...tooltipStyle} formatter={(v) => [`${v} min`, 'Temps']} />
              <Bar dataKey="minutes" radius={[0, 4, 4, 0]}>
                {byDomain.map((d) => <Cell key={d.key} fill={DOMAIN_COLOR[d.key]} />)}
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
                <Badge color={DOMAIN_COLOR[s.domain]}>{domainLabel(s.domain)}</Badge>
                <span className="font-medium">{s.durationMinutes} min</span>
                <span className="text-mute text-xs">{new Date(s.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                {(courseName(s.courseId) || s.notes) && <span className="text-mute text-xs flex-1 truncate">{[courseName(s.courseId), s.notes].filter(Boolean).join(' · ')}</span>}
                <button className="text-mute hover:text-bad cursor-pointer ml-auto" onClick={() => deleteSession(s.id)}><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState><Timer className="mx-auto mb-2 text-mute" size={26} />Aucune session pour l'instant. Lancez le chrono ou ajoutez une session passée.</EmptyState>
        )}
      </Card>

      <BadgeList badges={getBadges()} />

      <Modal open={modal} onClose={() => setModal(false)} title="Ajouter une session">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Domaine"><Select value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} options={FOCUS_DOMAINS.map((d) => ({ value: d, label: domainLabel(d) }))} /></Field>
            <Field label="Durée (minutes)"><Input type="number" min="1" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} autoFocus /></Field>
          </div>
          <Field label="Date"><Input type="date" value={form.date} max={todayKey()} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Notes (optionnel)"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button type="submit">Ajouter</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
