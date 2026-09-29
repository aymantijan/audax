import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { FAMILY_MAP, MODELS, familyIdOf } from '../../utils/skill-families';
import { GOAL_DOMAINS } from '../../hooks/useAllGoals';
import { todayKey } from '../../utils/formatters';
import { ProgressBar } from '../common/ui';

const daysTo = (date, today) => Math.round((new Date(`${date}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000);

// Status window: one tile per domain shown in the tree, computed from real data.
export function SkillProfile({ states, visibleIds, onModel }) {
  const tiles = MODELS.map((m) => {
    const fams = visibleIds.filter((id) => FAMILY_MAP[id]?.model === m.id).map((id) => ({ id, st: states[id] }));
    if (!fams.length) return null;
    const practised = fams.filter((f) => f.st.level > 0);
    const levels = practised.reduce((a, f) => a + f.st.level, 0);
    const best = practised.sort((a, b) => b.st.level - a.st.level || b.st.points - a.st.points)[0];
    return { m, total: fams.length, practised: practised.length, levels, mastered: fams.filter((f) => f.st.status === 'mastered').length, best };
  }).filter(Boolean);
  const maxLevels = Math.max(1, ...tiles.map((t) => t.levels));

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
      {tiles.map((t) => (
        <button key={t.m.id} type="button" onClick={() => onModel(t.m.id)} className="text-left bg-card border border-line rounded-xl p-3 hover:border-accent cursor-pointer">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium truncate">{t.m.label}</span>
            <span className="font-data text-lg font-bold">{t.levels}</span>
          </div>
          <div className="my-1.5"><ProgressBar value={t.levels} max={maxLevels} height={5} /></div>
          <div className="text-[11px] text-mute truncate">
            {t.practised}/{t.total} pratiquée{t.practised > 1 ? 's' : ''}{t.mastered ? ` · ${t.mastered} maîtrisée${t.mastered > 1 ? 's' : ''}` : ''}
          </div>
          {t.best && <div className="text-[11px] text-mute truncate">Meilleure : {FAMILY_MAP[t.best.id].name} (niv. {t.best.st.level})</div>}
        </button>
      ))}
    </div>
  );
}

// Upcoming dated goals (exams, career objectives, health/finance targets):
// countdown, readiness, and the compétences they rely on.
export function UpcomingTrials({ goals, states, onSkill }) {
  const today = todayKey();
  const list = goals
    .filter((g) => g.targetDate && g.targetDate >= today && g.status !== 'achieved' && !g.recurring && daysTo(g.targetDate, today) <= 120)
    .sort((a, b) => (a.targetDate < b.targetDate ? -1 : 1))
    .slice(0, 4);
  if (!list.length) return null;

  return (
    <div className="bg-card border border-line rounded-xl p-4">
      <div className="flex items-center gap-2 text-sm font-semibold mb-3"><CalendarClock size={15} className="text-accent" /> Prochaines échéances</div>
      <ul className="space-y-3.5">
        {list.map((g) => {
          const d = daysTo(g.targetDate, today);
          const fams = [...new Set((g.skills || []).map(familyIdOf))].filter((id) => FAMILY_MAP[id]);
          const urgent = d <= 7 && (g.progress ?? 0) < 70;
          return (
            <li key={g.key}>
              <div className="flex items-baseline gap-2">
                <span className="font-data text-sm font-bold shrink-0 w-14" style={{ color: urgent ? 'var(--warning)' : 'var(--accent-primary)' }}>{d === 0 ? 'Auj.' : `J-${d}`}</span>
                <Link to={g.link} className="text-sm truncate hover:text-accent flex-1">{g.title}</Link>
                <span className="text-[11px] text-mute shrink-0">{GOAL_DOMAINS[g.domain]?.label}</span>
              </div>
              <div className="pl-16 mt-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex-1"><ProgressBar value={g.progress ?? 0} max={100} height={5} color={urgent ? 'var(--warning)' : 'var(--success)'} /></div>
                  <span className="text-[11px] text-mute font-data shrink-0">prêt à {g.progress ?? 0} %</span>
                </div>
                {fams.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {fams.map((id) => (
                      <button key={id} type="button" onClick={() => onSkill(id)} className="px-2 py-0.5 rounded-full text-[11px] border border-line text-mute hover:text-accent hover:border-accent cursor-pointer">
                        {FAMILY_MAP[id].name} · niv. {states[id]?.level ?? 0}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
