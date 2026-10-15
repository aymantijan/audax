import { useEffect, useMemo, useState } from 'react';
import { Search, Crosshair, Trophy, ChevronLeft, ChevronRight, Star, Flame, Map, Users, Lock, Check, Globe } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useSkillStore } from '../store/skillStore';
import { useSynergy } from '../hooks/useSynergy';
import { gradeFor, gradeForXpOnly, GRADES_LADDER, GRADE_ERAS } from '../utils/grades';
import { preview, CONSISTENCY_CONFIG } from '../utils/momentum';
import { XP_DOMAINS, XP_DOMAIN_LABELS, domainXpBreakdown } from '../utils/xp-domains';
import { todayKey } from '../utils/formatters';
import { Card, Stat, Badge, EmptyState } from '../components/common/ui';
import { fetchLeaderboardProfiles } from '../services/cloud-sync';
import LeaderboardOptIn from '../components/settings/LeaderboardOptIn';
import { getSession } from '../services/auth-supabase';
import { isSupabaseConfigured } from '../services/supabase';

const PAGE_SIZE = 50;

function YourGradeCard({ grade, consistency }) {
  const cColor = consistency.momentum >= 1.1 ? 'var(--success)' : consistency.momentum >= 0.95 ? 'var(--accent-primary)' : consistency.momentum >= 0.8 ? 'var(--warning)' : 'var(--error)';
  return (
    <Card className="md:col-span-2">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' }}>
          <Trophy size={28} className="text-on-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-mute uppercase tracking-wide">Grade {grade.current.level} · {grade.current.era}</div>
          <div className="text-xl font-bold truncate">{grade.current.name}</div>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-mute mb-1">
              <span>{grade.next ? `Suivant : ${grade.next.name}` : 'Grade maximal atteint'}</span>
              <span>{Math.round(grade.progress)}%</span>
            </div>
            <div className="w-full bg-surface rounded-full overflow-hidden h-2">
              <div className="h-full rounded-full" style={{ width: `${grade.progress}%`, background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))' }} />
            </div>
            {grade.next && (
              <div className="text-[0.6875rem] text-mute mt-1">
                Pour le suivant : {grade.next.xpRequired.toLocaleString()} XP · synergie {grade.next.scoreGate}
                {grade.scoreProgress < grade.xpProgress ? ' · augmente ton score de synergie pour avancer' : ''}
              </div>
            )}
          </div>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-1 pl-4 border-l border-line shrink-0" title="S’applique à toute l’XP gagnée : une activité régulière le fait monter jusqu’à 1,25×, un rattrapage après une longue pause le fait descendre jusqu’à 0,7×.">
          <div className="flex items-center gap-1.5 text-xs text-mute"><Flame size={13} style={{ color: cColor }} /> Régularité</div>
          <div className="text-lg font-bold" style={{ color: cColor }}>×{consistency.momentum.toFixed(2)}</div>
          <div className="text-[0.6875rem] text-mute">{consistency.streak > 0 ? `${consistency.streak} j d’affilée` : consistency.missedDays > 0 ? `${consistency.missedDays} j manqué${consistency.missedDays > 1 ? 's' : ''}` : 'commence aujourd’hui'}</div>
        </div>
      </div>
    </Card>
  );
}

// Shows the raw XP split across the 5 life domains (see utils/xp-domains.js)
// — purely informational since grade progression was switched back to raw
// Lifetime XP (no diminishing returns): this just answers "where is my XP
// actually coming from", it no longer explains a grading mechanic.
function DomainBalanceCard({ domainXP }) {
  const total = XP_DOMAINS.reduce((a, d) => a + domainXP[d], 0);
  const max = Math.max(1, ...XP_DOMAINS.map((d) => domainXP[d]));
  return (
    <Card title="Répartition par domaine">
      {total === 0 ? (
        <EmptyState>Gagne un peu d’XP pour voir ta répartition par domaine.</EmptyState>
      ) : (
        <div className="space-y-2.5">
          {/* Trading XP earned before the module was removed (2026-10-09) still shows; never an empty Trading row. */}
          {XP_DOMAINS.filter((d) => d !== 'trading' || domainXP[d] > 0).map((d) => {
            const xp = domainXP[d];
            const pct = total > 0 ? Math.round((xp / total) * 100) : 0;
            return (
              <div key={d}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{XP_DOMAIN_LABELS[d]}</span>
                  <span className="text-mute">{xp.toLocaleString()} XP · {pct}%</span>
                </div>
                <div className="w-full bg-surface rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${max > 0 ? (xp / max) * 100 : 0}%`, background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// Users only (2026-10-09): the famous personalities are gone. You, plus the
// other VAUDAX users from the public leaderboard_profiles table (see
// services/cloud-sync.js) — empty when Supabase isn't configured or this
// account isn't cloud-synced (local-only accounts never appear on it).
function RankingView() {
  const user = useAuthStore((s) => s.user);
  const lifetimeXP = useSkillStore((s) => s.getLifetimeXP());

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [realUsers, setRealUsers] = useState([]);
  const [cloudStatus, setCloudStatus] = useState(isSupabaseConfigured ? 'loading' : 'unconfigured');

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      const session = await getSession();
      if (!session?.user) {
        if (!cancelled) setCloudStatus('signed-out');
        return;
      }
      const { ok, profiles } = await fetchLeaderboardProfiles();
      if (cancelled) return;
      setRealUsers(
        profiles
          .filter((p) => p.user_id !== session.user.id) // the "toi" row below comes from live local state
          .map((p) => ({ name: p.display_name || 'Utilisateur VAUDAX', occupation: p.career_goal || '', xp: p.lifetime_xp || 0, isYou: false }))
      );
      setCloudStatus(ok ? 'ready' : 'error');
    })();
    return () => { cancelled = true; };
  }, []);

  const youName = `${(user?.leaderboardOptIn && user?.leaderboardName) || user?.name || 'Toi'}${user?.leaderboardOptIn ? '' : ' (visible par toi seul·e)'}`;

  const ranked = useMemo(() => {
    const rows = [
      ...realUsers,
      { name: youName, occupation: user?.occupation || '', xp: lifetimeXP, isYou: true },
    ].sort((a, b) => b.xp - a.xp || (a.isYou ? 1 : 0));
    return rows.map((r, i) => ({ ...r, rank: i + 1, grade: gradeForXpOnly(r.xp) }));
  }, [lifetimeXP, youName, user?.occupation, realUsers]);

  const me = ranked.find((r) => r.isYou);
  const total = ranked.length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? ranked.filter((r) => r.isYou || r.name.toLowerCase().includes(q)) : ranked;
  }, [ranked, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  const jumpToMe = () => {
    setSearch('');
    const idx = ranked.findIndex((r) => r.isYou);
    setPage(Math.floor(idx / PAGE_SIZE));
  };

  return (
    <div className="space-y-6">
      <Stat label="Ton rang" value={me ? `#${me.rank}` : '—'} sub={`sur ${total}`} color="var(--accent-primary)" />

      {cloudStatus !== 'ready' && (
        <div className="text-xs text-mute bg-surface border border-line rounded-lg px-3 py-2 flex items-center gap-2">
          <Globe size={13} className="shrink-0" />
          {cloudStatus === 'unconfigured' && 'La synchronisation n’est pas configurée sur ce site : le classement avec les autres utilisateurs de VAUDAX en a besoin.'}
          {cloudStatus === 'signed-out' && 'Connecte-toi (Paramètres → Synchronisation) pour voir les autres utilisateurs de VAUDAX et apparaître dans le classement.'}
          {cloudStatus === 'loading' && 'Chargement des autres utilisateurs…'}
          {cloudStatus === 'error' && 'Impossible de charger les autres utilisateurs pour l’instant : seul ton rang est affiché.'}
        </div>
      )}

      {total > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
            <input
              className="w-full bg-surface border border-line rounded-lg pl-9 pr-3 py-2 text-sm text-ink placeholder:text-mute focus:outline-none focus:border-accent"
              placeholder="Chercher un nom…"
              aria-label="Chercher un nom"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
          </div>
          <button onClick={jumpToMe} className="flex items-center gap-1.5 text-sm text-on-accent bg-accent rounded-lg px-3 py-2 cursor-pointer font-semibold hover:opacity-90">
            <Crosshair size={14} /> Ma position
          </button>
        </div>
      )}

      <Card className="!p-0 overflow-hidden">
        {pageRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mute border-b border-line bg-surface/50">
                  <th className="py-2.5 px-4 w-16">Rang</th>
                  <th className="py-2.5 px-4">Nom</th>
                  <th className="py-2.5 px-4 hidden md:table-cell">Grade</th>
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
                      #{r.rank}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        {r.isYou && <Star size={13} className="text-accent shrink-0" fill="currentColor" />}
                        <span className={r.isYou ? 'font-bold text-accent' : 'font-medium'}>{r.name}</span>
                        {r.isYou && <span className="text-xs text-mute">(toi)</span>}
                      </div>
                      {r.occupation && <div className="text-xs text-mute mt-0.5 max-w-md truncate">{r.occupation}</div>}
                    </td>
                    <td className="py-2.5 px-4 hidden md:table-cell text-mute text-xs">{r.grade.name}</td>
                    <td className="py-2.5 px-4 text-right font-semibold tabular-nums">{r.xp.toLocaleString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8"><EmptyState>Personne ne correspond à cette recherche.</EmptyState></div>
        )}
      </Card>

      {pageCount > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-mute">
            {clampedPage * PAGE_SIZE + 1}–{Math.min(filtered.length, (clampedPage + 1) * PAGE_SIZE)} sur {filtered.length}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={clampedPage === 0} className="flex items-center gap-1 text-sm border border-line rounded-lg px-3 py-1.5 cursor-pointer disabled:opacity-40 hover:border-accent">
              <ChevronLeft size={14} /> Précédent
            </button>
            <span className="text-sm text-mute">Page {clampedPage + 1} / {pageCount}</span>
            <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={clampedPage >= pageCount - 1} className="flex items-center gap-1 text-sm border border-line rounded-lg px-3 py-1.5 cursor-pointer disabled:opacity-40 hover:border-accent">
              Suivant <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
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
        Les 500 grades, avec l’XP et le score de synergie nécessaires pour chacun. Un grade ne se débloque que si tu atteins <em>à la fois</em> son seuil d’XP et son seuil de score.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <input
            className="w-full bg-surface border border-line rounded-lg pl-9 pr-3 py-2 text-sm text-ink placeholder:text-mute focus:outline-none focus:border-accent"
            placeholder="Chercher un grade…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <select className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink" value={era} onChange={(e) => { setEra(e.target.value); setPage(0); }}>
          <option value="all">Toutes les époques</option>
          {GRADE_ERAS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <button onClick={jumpToMine} className="flex items-center gap-1.5 text-sm text-on-accent bg-accent rounded-lg px-3 py-2 cursor-pointer font-semibold hover:opacity-90">
          <Crosshair size={14} /> Mon grade
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
                  <th className="py-2.5 px-4 hidden sm:table-cell">Époque</th>
                  <th className="py-2.5 px-4 text-right">XP requise</th>
                  <th className="py-2.5 px-4 text-right hidden md:table-cell">Seuil de synergie</th>
                  <th className="py-2.5 px-4 text-center w-24">Statut</th>
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
                        {isCurrent && <Badge color="var(--accent-primary)"> tu es ici</Badge>}
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
          <div className="p-8"><EmptyState>Aucun grade ne correspond à ces filtres.</EmptyState></div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-xs text-mute">
          Showing {filtered.length ? clampedPage * PAGE_SIZE + 1 : 0}–{Math.min(filtered.length, (clampedPage + 1) * PAGE_SIZE)} of {filtered.length}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={clampedPage === 0} className="flex items-center gap-1 text-sm border border-line rounded-lg px-3 py-1.5 cursor-pointer disabled:opacity-40 hover:border-accent">
            <ChevronLeft size={14} /> Précédent
          </button>
          <span className="text-sm text-mute">Page {clampedPage + 1} / {pageCount}</span>
          <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={clampedPage >= pageCount - 1} className="flex items-center gap-1 text-sm border border-line rounded-lg px-3 py-1.5 cursor-pointer disabled:opacity-40 hover:border-accent">
            Suivant <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const lifetimeXP = useSkillStore((s) => s.getLifetimeXP());
  // Raw stable slice (not a getter that builds a fresh object every call —
  // see the useSyncExternalStore infinite-loop note in project memory),
  // derived value computed in a useMemo instead.
  const skillsRaw = useSkillStore((s) => s.skills);
  const domainXP = useMemo(() => domainXpBreakdown(skillsRaw), [skillsRaw]);
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
        <h1 className="text-2xl font-bold">Classement</h1>
        <p className="text-mute text-sm mt-1">
          Ton XP totale comparée à celle des autres utilisateurs de VAUDAX.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <YourGradeCard grade={grade} consistency={consistency} />
        <Stat label="XP totale" value={lifetimeXP.toLocaleString()} sub={`synergie ${synergy.weighted}`} />
      </div>

      <DomainBalanceCard domainXP={domainXP} />

      <div className="flex gap-1 border-b border-line">
        <button
          onClick={() => setTab('ranking')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${tab === 'ranking' ? 'text-accent border-accent' : 'text-mute border-transparent hover:text-ink'}`}
        >
          <Users size={15} /> Classement
        </button>
        <button
          onClick={() => setTab('milestones')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${tab === 'milestones' ? 'text-accent border-accent' : 'text-mute border-transparent hover:text-ink'}`}
        >
          <Map size={15} /> Paliers
        </button>
      </div>

      {tab === 'ranking' ? <><LeaderboardOptIn /><RankingView /></> : <MilestonesView currentLevel={grade.current.level} />}
    </div>
  );
}
