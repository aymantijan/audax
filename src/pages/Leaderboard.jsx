import { useMemo, useState } from 'react';
import { Search, Crosshair, Trophy, ChevronLeft, ChevronRight, Star, Flame, Map, Users, Lock, Check } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useSkillStore } from '../store/skillStore';
import { useSynergy } from '../hooks/useSynergy';
import { LEADERBOARD, PERSONALITY_DOMAINS, PERSONALITY_COUNTRIES } from '../utils/personalities';
import { gradeFor, gradeForXpOnly, GRADES_LADDER, GRADE_ERAS } from '../utils/grades';
import { preview, CONSISTENCY_CONFIG } from '../utils/momentum';
import { todayKey } from '../utils/formatters';
import { Card, Stat, Badge, EmptyState } from '../components/common/ui';

const PAGE_SIZE = 50;

function YourGradeCard({ grade, consistency }) {
  const cColor = consistency.momentum >= 1.1 ? 'var(--success)' : consistency.momentum >= 0.95 ? 'var(--accent-primary)' : consistency.momentum >= 0.8 ? 'var(--warning)' : 'var(--error)';
  return (
    <Card className="md:col-span-2">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' }}>
          <Trophy size={28} className="text-black" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-mute uppercase tracking-wide">Grade {grade.current.level} · {grade.current.era}</div>
          <div className="text-xl font-bold truncate">{grade.current.name}</div>
          <div className="mt-2">
            <div className="flex justify-between text-[11px] text-mute mb-1">
              <span>{grade.next ? `Next: ${grade.next.name}` : 'Max grade reached'}</span>
              <span>{Math.round(grade.progress)}%</span>
            </div>
            <div className="w-full bg-surface rounded-full overflow-hidden h-2">
              <div className="h-full rounded-full" style={{ width: `${grade.progress}%`, background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))' }} />
            </div>
            {grade.next && (
              <div className="text-[10px] text-mute mt-1">
                Gate to next: {grade.next.xpRequired.toLocaleString()} XP · synergy {grade.next.scoreGate}
                {grade.scoreProgress < grade.xpProgress ? ' · raise your synergy score to advance' : ''}
              </div>
            )}
          </div>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-1 pl-4 border-l border-line shrink-0" title="Applies to every XP award app-wide — sustained daily activity compounds it toward 1.25×, a burst after a long gap dampens it toward 0.7×.">
          <div className="flex items-center gap-1.5 text-xs text-mute"><Flame size={13} style={{ color: cColor }} /> Consistency</div>
          <div className="text-lg font-bold" style={{ color: cColor }}>×{consistency.momentum.toFixed(2)}</div>
          <div className="text-[10px] text-mute">{consistency.streak > 0 ? `${consistency.streak}d streak` : consistency.missedDays > 0 ? `${consistency.missedDays}d missed` : 'start today'}</div>
        </div>
      </div>
    </Card>
  );
}

function RankingView() {
  const user = useAuthStore((s) => s.user);
  const lifetimeXP = useSkillStore((s) => s.getLifetimeXP());

  const [search, setSearch] = useState('');
  const [domain, setDomain] = useState('all');
  const [country, setCountry] = useState('all');
  const [page, setPage] = useState(0);

  const youName = `${user?.name || 'You'}`;

  const ranked = useMemo(() => {
    const rows = [
      ...LEADERBOARD.map((p) => ({ ...p, isYou: false })),
      { name: youName, domain: 'You', country: user?.careerGoal || '—', xp: lifetimeXP, note: 'That\'s you — climb the ranks.', isYou: true },
    ].sort((a, b) => b.xp - a.xp || (a.isYou ? 1 : 0));
    return rows.map((r, i) => ({ ...r, rank: i + 1, grade: gradeForXpOnly(r.xp) }));
  }, [lifetimeXP, youName, user?.careerGoal]);

  const me = ranked.find((r) => r.isYou);
  const total = ranked.length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ranked.filter((r) => {
      if (domain !== 'all' && r.domain !== domain && !r.isYou) return false;
      if (country !== 'all' && r.country !== country && !r.isYou) return false;
      if (q && !r.name.toLowerCase().includes(q) && !(r.note || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ranked, search, domain, country]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  const jumpToMe = () => {
    setSearch('');
    setDomain('all');
    setCountry('all');
    const idx = ranked.findIndex((r) => r.isYou);
    setPage(Math.floor(idx / PAGE_SIZE));
  };

  return (
    <div className="space-y-6">
      <Stat label="Your rank" value={me ? `#${me.rank}` : '—'} sub={`of ${total}`} color="var(--accent-primary)" />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <input
            className="w-full bg-surface border border-line rounded-lg pl-9 pr-3 py-2 text-sm text-ink placeholder:text-mute focus:outline-none focus:border-accent"
            placeholder="Search a name…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <select className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink" value={domain} onChange={(e) => { setDomain(e.target.value); setPage(0); }}>
          <option value="all">All domains</option>
          {PERSONALITY_DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink" value={country} onChange={(e) => { setCountry(e.target.value); setPage(0); }}>
          <option value="all">All countries</option>
          {PERSONALITY_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={jumpToMe} className="flex items-center gap-1.5 text-sm text-black bg-accent rounded-lg px-3 py-2 cursor-pointer font-semibold hover:opacity-90">
          <Crosshair size={14} /> My position
        </button>
      </div>

      <Card className="!p-0 overflow-hidden">
        {pageRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mute border-b border-line bg-surface/50">
                  <th className="py-2.5 px-4 w-16">Rank</th>
                  <th className="py-2.5 px-4">Name</th>
                  <th className="py-2.5 px-4 hidden sm:table-cell">Domain</th>
                  <th className="py-2.5 px-4 hidden md:table-cell">Country</th>
                  <th className="py-2.5 px-4 hidden lg:table-cell">Grade</th>
                  <th className="py-2.5 px-4 text-right">XP</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr
                    key={`${r.name}-${r.rank}`}
                    className="border-b border-line/40"
                    style={r.isYou ? { background: 'color-mix(in srgb, var(--accent-primary) 14%, transparent)' } : undefined}
                  >
                    <td className="py-2.5 px-4 font-semibold" style={r.isYou ? { color: 'var(--accent-primary)' } : r.rank <= 3 ? { color: 'var(--warning)' } : undefined}>
                      {r.rank <= 3 && !r.isYou ? ['🥇', '🥈', '🥉'][r.rank - 1] : `#${r.rank}`}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        {r.isYou && <Star size={13} className="text-accent shrink-0" fill="currentColor" />}
                        <span className={r.isYou ? 'font-bold text-accent' : 'font-medium'}>{r.name}</span>
                      </div>
                      {r.note && <div className="text-[11px] text-mute mt-0.5 max-w-md truncate">{r.note}</div>}
                    </td>
                    <td className="py-2.5 px-4 hidden sm:table-cell">
                      <Badge color={r.isYou ? 'var(--accent-primary)' : 'var(--accent-secondary)'}>{r.domain}</Badge>
                    </td>
                    <td className="py-2.5 px-4 hidden md:table-cell text-mute">{r.country}</td>
                    <td className="py-2.5 px-4 hidden lg:table-cell text-mute text-xs">{r.grade.name}</td>
                    <td className="py-2.5 px-4 text-right font-semibold tabular-nums">{r.xp.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8"><EmptyState>No one matches these filters.</EmptyState></div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-xs text-mute">
          Showing {filtered.length ? clampedPage * PAGE_SIZE + 1 : 0}–{Math.min(filtered.length, (clampedPage + 1) * PAGE_SIZE)} of {filtered.length}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={clampedPage === 0} className="flex items-center gap-1 text-sm border border-line rounded-lg px-3 py-1.5 cursor-pointer disabled:opacity-40 hover:border-accent">
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="text-sm text-mute">Page {clampedPage + 1} / {pageCount}</span>
          <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={clampedPage >= pageCount - 1} className="flex items-center gap-1 text-sm border border-line rounded-lg px-3 py-1.5 cursor-pointer disabled:opacity-40 hover:border-accent">
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function MilestonesView({ currentLevel }) {
  const [search, setSearch] = useState('');
  const [era, setEra] = useState('all');
  const [page, setPage] = useState(Math.floor((currentLevel - 1) / PAGE_SIZE));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return GRADES_LADDER.filter((g) => {
      if (era !== 'all' && g.era !== era) return false;
      if (q && !g.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, era]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  const jumpToMine = () => {
    setSearch('');
    setEra('all');
    setPage(Math.floor((currentLevel - 1) / PAGE_SIZE));
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-mute">
        All 500 grades — the XP and synergy score needed to reach each one. Grade N unlocks only once you meet <em>both</em> its XP threshold and its score gate.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <input
            className="w-full bg-surface border border-line rounded-lg pl-9 pr-3 py-2 text-sm text-ink placeholder:text-mute focus:outline-none focus:border-accent"
            placeholder="Search a grade name…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <select className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink" value={era} onChange={(e) => { setEra(e.target.value); setPage(0); }}>
          <option value="all">All eras</option>
          {GRADE_ERAS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <button onClick={jumpToMine} className="flex items-center gap-1.5 text-sm text-black bg-accent rounded-lg px-3 py-2 cursor-pointer font-semibold hover:opacity-90">
          <Crosshair size={14} /> My grade
        </button>
      </div>

      <Card className="!p-0 overflow-hidden">
        {pageRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mute border-b border-line bg-surface/50">
                  <th className="py-2.5 px-4 w-16">Lv</th>
                  <th className="py-2.5 px-4">Grade</th>
                  <th className="py-2.5 px-4 hidden sm:table-cell">Era</th>
                  <th className="py-2.5 px-4 text-right">XP required</th>
                  <th className="py-2.5 px-4 text-right hidden md:table-cell">Synergy gate</th>
                  <th className="py-2.5 px-4 text-center w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((g) => {
                  const achieved = g.level <= currentLevel;
                  const isCurrent = g.level === currentLevel;
                  return (
                    <tr
                      key={g.level}
                      className="border-b border-line/40"
                      style={isCurrent ? { background: 'color-mix(in srgb, var(--accent-primary) 16%, transparent)' } : undefined}
                    >
                      <td className="py-2.5 px-4 font-mono text-xs text-mute">{g.level}</td>
                      <td className="py-2.5 px-4">
                        <span className={isCurrent ? 'font-bold text-accent' : achieved ? 'font-medium' : 'text-mute'}>{g.name}</span>
                        {isCurrent && <Badge color="var(--accent-primary)"> you are here</Badge>}
                      </td>
                      <td className="py-2.5 px-4 hidden sm:table-cell text-mute text-xs">{g.era}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{g.xpRequired.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right hidden md:table-cell text-mute tabular-nums">{g.scoreGate}</td>
                      <td className="py-2.5 px-4 text-center">
                        {isCurrent ? (
                          <Star size={14} className="inline text-accent" fill="currentColor" />
                        ) : achieved ? (
                          <Check size={14} className="inline text-good" style={{ color: 'var(--success)' }} />
                        ) : (
                          <Lock size={13} className="inline text-mute" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8"><EmptyState>No grade matches these filters.</EmptyState></div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-xs text-mute">
          Showing {filtered.length ? clampedPage * PAGE_SIZE + 1 : 0}–{Math.min(filtered.length, (clampedPage + 1) * PAGE_SIZE)} of {filtered.length}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={clampedPage === 0} className="flex items-center gap-1 text-sm border border-line rounded-lg px-3 py-1.5 cursor-pointer disabled:opacity-40 hover:border-accent">
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="text-sm text-mute">Page {clampedPage + 1} / {pageCount}</span>
          <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={clampedPage >= pageCount - 1} className="flex items-center gap-1 text-sm border border-line rounded-lg px-3 py-1.5 cursor-pointer disabled:opacity-40 hover:border-accent">
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const lifetimeXP = useSkillStore((s) => s.getLifetimeXP());
  // Same fix as Learning.jsx: select the raw persisted state (stable reference)
  // and compute the live preview with useMemo, instead of calling a store
  // method that builds a fresh object inside the zustand selector itself.
  const consistencyRaw = useSkillStore((s) => s.consistency);
  const consistency = useMemo(() => preview(consistencyRaw, todayKey(), CONSISTENCY_CONFIG), [consistencyRaw]);
  const synergy = useSynergy();
  const [tab, setTab] = useState('ranking');

  const grade = gradeFor(lifetimeXP, synergy.weighted);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-mute text-sm mt-1">
          Your lifetime XP ranked against {LEADERBOARD.length} of history's greatest figures in finance, markets, business, mathematics and computing. Climb the ladder.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <YourGradeCard grade={grade} consistency={consistency} />
        <Stat label="Lifetime XP" value={lifetimeXP.toLocaleString()} sub={`synergy ${synergy.weighted}`} />
      </div>

      <div className="flex gap-1 border-b border-line">
        <button
          onClick={() => setTab('ranking')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${tab === 'ranking' ? 'text-accent border-accent' : 'text-mute border-transparent hover:text-ink'}`}
        >
          <Users size={15} /> Ranking
        </button>
        <button
          onClick={() => setTab('milestones')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${tab === 'milestones' ? 'text-accent border-accent' : 'text-mute border-transparent hover:text-ink'}`}
        >
          <Map size={15} /> Milestones
        </button>
      </div>

      {tab === 'ranking' ? <RankingView /> : <MilestonesView currentLevel={grade.current.level} />}
    </div>
  );
}
