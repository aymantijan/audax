import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Target, Trophy, AlertTriangle, CheckCircle2, Clock, Plus, HeartPulse, Wallet, GraduationCap, Megaphone, ChevronRight, Repeat, Flame } from 'lucide-react';
import { useAllGoals, GOAL_DOMAINS } from '../hooks/useAllGoals';
import { todayKey } from '../utils/formatters';
import { Card, ProgressBar } from '../components/common/ui';
import { SegmentedTabs, tint, countdownLabel } from '../components/learning/design';

const DOMAIN_ICONS = { health: HeartPulse, finance: Wallet, learning: GraduationCap, content: Megaphone, habits: Flame };
const STATUS = {
  achieved: { label: 'Atteint', color: 'var(--success)', Icon: CheckCircle2 },
  ontrack: { label: 'En bonne voie', color: 'var(--success)', Icon: CheckCircle2 },
  behind: { label: 'En retard', color: 'var(--warning)', Icon: AlertTriangle },
  active: { label: 'En cours', color: 'var(--accent-primary)', Icon: Clock },
};
const daysTo = (date, today) => Math.round((new Date(`${date}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000);

function GoalRow({ g, today }) {
  const d = GOAL_DOMAINS[g.domain];
  const Icon = DOMAIN_ICONS[g.domain];
  const st = STATUS[g.status];
  const days = g.targetDate ? daysTo(g.targetDate, today) : null;
  return (
    <Link to={g.link} className="group flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 hover:border-accent transition-colors">
      <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: tint(d.color, 15) }}><Icon size={16} style={{ color: d.color }} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink truncate">{g.title}</span>
          {g.recurring && <Repeat size={11} className="text-mute shrink-0" />}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex-1 max-w-xs"><ProgressBar value={g.progress ?? 0} height={5} color={g.status === 'achieved' ? 'var(--success)' : d.color} /></div>
          <span className="text-[11px] tabular-nums text-mute w-9">{g.progress ?? 0}%</span>
        </div>
        <div className="text-[11px] text-mute mt-1 truncate">{g.valueText}{g.detail ? ` · ${g.detail}` : ''}</div>
      </div>
      <div className="text-right shrink-0 hidden sm:block">
        <div className="text-[11px] font-semibold flex items-center gap-1 justify-end" style={{ color: st.color }}><st.Icon size={12} /> {st.label}</div>
        {days != null && g.status !== 'achieved' && (
          <div className={`text-[11px] mt-0.5 ${days < 0 ? 'text-bad' : days <= 14 ? 'text-warning' : 'text-mute'}`}>{days < 0 ? `échéance dépassée de ${-days} j` : countdownLabel(days)}</div>
        )}
      </div>
      <ChevronRight size={15} className="text-mute group-hover:text-accent shrink-0" />
    </Link>
  );
}

export default function GoalsHub() {
  const all = useAllGoals();
  const today = todayKey();
  const [domain, setDomain] = useState('all');
  const list = all.filter((g) => domain === 'all' || g.domain === domain);
  const recurring = list.filter((g) => g.recurring);
  const open = list.filter((g) => !g.recurring && g.status !== 'achieved')
    .sort((a, b) => (a.status === 'behind' ? -1 : 0) - (b.status === 'behind' ? -1 : 0) || (a.targetDate || '9999').localeCompare(b.targetDate || '9999'));
  const done = list.filter((g) => !g.recurring && g.status === 'achieved');
  const counts = {
    open: all.filter((g) => !g.recurring && g.status !== 'achieved').length,
    behind: all.filter((g) => !g.recurring && g.status === 'behind').length,
    ontrack: all.filter((g) => !g.recurring && g.status === 'ontrack').length,
    done: all.filter((g) => !g.recurring && g.status === 'achieved').length,
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-ink">Objectifs</h1>
        <p className="text-mute text-sm mt-1">Tous vos objectifs au même endroit — santé, argent, études, contenu, habitudes. Chacun se modifie dans sa section.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['En cours', counts.open, Target, 'var(--accent-primary)'],
          ['En bonne voie', counts.ontrack, CheckCircle2, 'var(--success)'],
          ['En retard', counts.behind, AlertTriangle, 'var(--warning)'],
          ['Atteints', counts.done, Trophy, 'var(--success)'],
        ].map(([label, v, Icon, color]) => (
          <div key={label} className="rounded-xl border border-line bg-card px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-mute flex items-center gap-1.5"><Icon size={12} style={{ color }} /> {label}</div>
            <div className="text-2xl font-bold tabular-nums mt-0.5" style={{ color: v ? color : undefined }}>{v}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SegmentedTabs value={domain} onChange={setDomain} tabs={[
          { key: 'all', label: 'Tous', count: all.filter((g) => !g.recurring).length },
          ...Object.entries(GOAL_DOMAINS).map(([k, d]) => ({ key: k, label: d.label, icon: DOMAIN_ICONS[k] })),
        ]} />
      </div>

      {open.length ? (
        <div className="space-y-2">{open.map((g) => <GoalRow key={g.key} g={g} today={today} />)}</div>
      ) : (
        <Card>
          <div className="text-center py-6 text-sm text-mute">Aucun objectif en cours{domain !== 'all' ? ` en ${GOAL_DOMAINS[domain].label}` : ''}.</div>
        </Card>
      )}

      {recurring.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-mute mb-2 flex items-center gap-1.5"><Repeat size={12} /> Objectifs récurrents</div>
          <div className="space-y-2">{recurring.map((g) => <GoalRow key={g.key} g={g} today={today} />)}</div>
        </div>
      )}

      <Card>
        <div className="text-sm font-semibold text-ink mb-3 flex items-center gap-1.5"><Plus size={14} className="text-accent" /> Créer un objectif</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {[
            ['health', 'Poids, force, sommeil, cardio…', '/health?tab=goals'],
            ['finance', 'Épargne, fonds d’urgence, patrimoine', '/finance?tab=goals'],
            ['learning', 'Note visée par matière, niveau de langue', '/learning?tab=cursus'],
            ['content', 'Publications par mois', '/content'],
            ['habits', 'Série visée sur une habitude', '/habits'],
          ].map(([k, desc, to]) => {
            const Icon = DOMAIN_ICONS[k];
            return (
              <Link key={k} to={to} className="rounded-xl border border-line p-3 hover:border-accent transition-colors">
                <div className="flex items-center gap-2 text-sm font-medium text-ink"><Icon size={15} style={{ color: GOAL_DOMAINS[k].color }} /> {GOAL_DOMAINS[k].label}</div>
                <div className="text-[11px] text-mute mt-1">{desc}</div>
              </Link>
            );
          })}
        </div>
      </Card>

      {done.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-mute mb-2 flex items-center gap-1.5"><Trophy size={12} /> Atteints</div>
          <div className="space-y-2 opacity-80">{done.map((g) => <GoalRow key={g.key} g={g} today={today} />)}</div>
        </div>
      )}
    </div>
  );
}
