import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, ArrowRight, Flame, Award, Rocket } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useAuthStore } from '../store/authStore';
import { useTradingStore } from '../store/tradingStore';
import { useLearningStore } from '../store/learningStore';
import { useFinanceStore } from '../store/financeStore';
import { useHabitStore } from '../store/habitStore';
import { useSkillStore } from '../store/skillStore';
import { useDealsStore } from '../store/dealsStore';
import { useSynergy } from '../hooks/useSynergy';
import { synergyColor } from '../utils/synergy';
import { habitCompliance, weightedGPA, habitStreak } from '../utils/calculations';
import { checkBurnoutTriggers } from '../utils/burnout';
import { GRADE_POINTS, SKILL_MAP, LEVEL_NAMES } from '../utils/constants';
import { fmtMoney, fmtSignedMoney, fmtMAD, fmtPct, fmtDate, todayKey } from '../utils/formatters';
import { Card, Stat, Badge, EmptyState } from '../components/common/ui';
import { ChevronDown, ChevronRight } from 'lucide-react';
import AccountSwitcher from '../components/common/AccountSwitcher';
import { startOfMonth } from 'date-fns';

export default function Dashboard() {
  const [demoOpen, setDemoOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const trades = useTradingStore((s) => s.trades);
  const tradingStore = useTradingStore();
  const courses = useLearningStore((s) => s.courses);
  const financeStore = useFinanceStore();
  const goals = useFinanceStore((s) => s.goals);
  const skills = useSkillStore((s) => s.skills);
  const deals = useDealsStore((s) => s.deals);
  const { habits, logs, energyLogs } = useHabitStore();
  const synergy = useSynergy();

  const PE_TRACKS = ['PE', 'GE', 'VC', 'RBF'];
  const peSkillsUnlocked = Object.values(skills).filter((s) => !s.locked && PE_TRACKS.includes(SKILL_MAP[s.id]?.track)).length;
  const peSkillsTotal = Object.values(skills).filter((s) => PE_TRACKS.includes(SKILL_MAP[s.id]?.track)).length;
  const dealSize = deals.reduce((a, d) => a + (d.size || 0), 0);

  const today = todayKey();
  const activeAccount = user?.activeAccount || 'demo';
  const acctTrades = tradingStore.getAccountTrades(activeAccount);
  const monthTrades = acctTrades.filter((t) => new Date(t.date) >= startOfMonth(new Date()));
  const monthStats = tradingStore.getMonthStats(activeAccount);
  const account = tradingStore.accountValue(activeAccount);

  const hasReal = !!user?.accounts?.real;
  const demoStats = tradingStore.getStats('demo');
  const demoAccount = tradingStore.accountValue('demo');
  const gpa = weightedGPA(courses, GRADE_POINTS);
  // Selector = single source of truth; automatically includes NW adjustments now.
  const netWorth = financeStore.getNetWorth();
  const todayEnergy = energyLogs.find((l) => l.date === today);

  const activeHabits = habits.filter((h) => !h.archived);
  const doneToday = activeHabits.filter((h) => logs.some((l) => l.habitId === h.id && l.date === today && l.completed));

  const burnout = useMemo(
    () => checkBurnoutTriggers({ energyLogs, compliance: habitCompliance(activeHabits, logs, 7, today), trades: acctTrades }),
    [energyLogs, activeHabits, logs, acctTrades, today]
  );

  const focusItems = useMemo(() => {
    const items = [];
    if (activeHabits.length - doneToday.length > 0)
      items.push({ to: '/habits', text: `Complete ${activeHabits.length - doneToday.length} remaining habit(s)` });
    if (!todayEnergy) items.push({ to: '/habits', text: 'Log your morning energy & sleep check-in' });
    const unjournaled = monthTrades.filter((t) => !t.journal?.reasoning);
    if (unjournaled.length) items.push({ to: '/trading', text: `Journal ${unjournaled.length} trade(s) missing reasoning` });
    const lowest = Object.entries(synergy.scores).sort((a, b) => a[1] - b[1])[0];
    if (lowest) items.push({ to: domainRoute(lowest[0]), text: `Boost your weakest domain: ${lowest[0]} (${lowest[1]}/100)` });
    if (!items.length) items.push({ to: '/', text: 'All clear — protect the streak.' });
    return items;
  }, [activeHabits, doneToday, todayEnergy, monthTrades, synergy.scores]);

  const radarData = Object.entries(synergy.scores).map(([domain, score]) => ({
    domain: domain[0].toUpperCase() + domain.slice(1),
    score,
  }));

  // Skills gaining the most XP this month
  const fastestSkills = useMemo(() => {
    const ms = startOfMonth(new Date()).getTime();
    return Object.values(skills)
      .map((s) => ({ id: s.id, level: s.level, xpMonth: (s.xpLog || []).filter((e) => e.date >= ms && e.amount > 0).reduce((a, e) => a + e.amount, 0) }))
      .filter((s) => s.xpMonth > 0)
      .sort((a, b) => b.xpMonth - a.xpMonth)
      .slice(0, 5);
  }, [skills]);

  // Level-ups in the last 30 days
  const milestones = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return Object.values(skills)
      .flatMap((s) => (s.levelUpDates || []).filter((d) => d >= cutoff).map((d) => ({ id: s.id, date: d, level: s.level })))
      .sort((a, b) => b.date - a.date)
      .slice(0, 5);
  }, [skills]);

  const topStreaks = useMemo(
    () =>
      activeHabits
        .map((h) => ({ ...h, streak: habitStreak(h.id, logs, today) }))
        .filter((h) => h.streak > 0)
        .sort((a, b) => b.streak - a.streak)
        .slice(0, 5),
    [activeHabits, logs, today]
  );

  const upcomingGoals = useMemo(
    () => goals.filter((g) => g.targetDate).sort((a, b) => (a.targetDate < b.targetDate ? -1 : 1)).slice(0, 3),
    [goals]
  );

  const TrendIcon = synergy.trend > 0.5 ? TrendingUp : synergy.trend < -0.5 ? TrendingDown : Minus;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {user?.name}</h1>
          <p className="text-mute text-sm mt-1">
            Track: <span className="text-accent font-medium">{user?.careerGoal || 'Hybrid'}</span> · here's where you stand today.
          </p>
        </div>
        <AccountSwitcher />
      </div>

      {burnout.burnoutRisk && (
        <div className="border border-bad/50 bg-bad/10 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-bad font-semibold">
            <AlertTriangle size={18} /> Burnout risk detected ({burnout.overallSeverity})
          </div>
          {burnout.triggers.map((t) => (
            <div key={t.trigger} className="text-sm">
              <span className="text-ink">{t.message}</span>
              <span className="text-mute"> — {t.recommendation}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Stat label="Account value" value={fmtMoney(account)} />
        <Stat
          label="Month P&L"
          value={fmtSignedMoney(monthStats.totalPnl)}
          color={monthStats.totalPnl >= 0 ? 'var(--success)' : 'var(--error)'}
        />
        <Stat label="Win rate (month)" value={monthStats.count ? fmtPct(monthStats.winRate) : '—'} sub={`${monthStats.count} trades`} />
        <Stat label="GPA" value={gpa !== null ? gpa.toFixed(2) : '—'} sub={`${courses.filter((c) => c.status === 'active').length} active courses`} />
        <Stat label="Net worth" value={netWorth !== null ? fmtMAD(netWorth) : '—'} sub="dirhams" />
        <Stat
          label="Energy today"
          value={todayEnergy ? `${todayEnergy.energyStartLevel}/10` : '—'}
          sub={todayEnergy ? `Stress ${todayEnergy.stressLevel}/10` : 'Not logged yet'}
        />
      </div>

      {hasReal && activeAccount === 'real' && (
        <div className="border border-line rounded-xl bg-card">
          <button onClick={() => setDemoOpen((v) => !v)} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm cursor-pointer text-left">
            {demoOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span className="text-mute">Demo account (learning)</span>
            <span className="ml-auto text-mute">{fmtMoney(demoAccount)} · {demoStats.count} trades{demoStats.count ? ` · ${Math.round(demoStats.winRate)}% win` : ''}</span>
          </button>
          {demoOpen && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4 pb-4">
              <Stat label="Demo value" value={fmtMoney(demoAccount)} />
              <Stat label="Demo P&L" value={fmtSignedMoney(demoStats.totalPnl)} color={demoStats.totalPnl >= 0 ? 'var(--success)' : 'var(--error)'} />
              <Stat label="Demo win rate" value={demoStats.count ? fmtPct(demoStats.winRate) : '—'} sub={`${demoStats.wins}W / ${demoStats.losses}L`} />
              <Stat label="Demo trades" value={demoStats.count} sub="learning + validation" />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Deals logged" value={deals.length} sub={deals.length ? fmtMoney(dealSize) + ' total' : 'PE / VC track'} />
        <Stat label="PE/VC skills" value={`${peSkillsUnlocked}/${peSkillsTotal}`} sub="unlocked" />
        <Stat label="Courses" value={courses.length} sub={`${courses.filter((c) => c.status === 'completed').length} completed`} />
        <Stat label="Skills unlocked" value={Object.values(skills).filter((s) => !s.locked).length} sub={`of ${Object.values(skills).length}`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Synergy Score">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-5xl font-bold" style={{ color: synergyColor(synergy.weighted) }}>
                {synergy.weighted}
              </div>
              <div className="text-xs text-mute mt-1">weighted / 100</div>
              <div className="flex items-center gap-1 text-sm mt-3" style={{ color: synergy.trend >= 0 ? 'var(--success)' : 'var(--error)' }}>
                <TrendIcon size={16} />
                {synergy.trend >= 0 ? '+' : ''}
                {synergy.trend.toFixed(1)} vs yesterday
              </div>
              <div className="text-xs text-mute mt-2">
                Average: <span className="text-ink">{synergy.average}</span> · Primary: <span className="text-accent capitalize">{synergy.primaryDomain}</span>
              </div>
            </div>
            <div className="flex-1 h-52">
              <ResponsiveContainer>
                <RadarChart data={radarData} outerRadius="75%">
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="domain" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                  <Radar dataKey="score" stroke="#00d9ff" fill="#00d9ff" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2 mt-4">
            {Object.entries(synergy.scores).map(([domain, score]) => (
              <div key={domain} className="text-center">
                <div className="text-lg font-semibold" style={{ color: synergyColor(score) }}>
                  {Math.round(score)}
                </div>
                <div className="text-[10px] text-mute capitalize">{domain}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Daily Focus Board">
          {focusItems.length ? (
            <ul className="space-y-3">
              {focusItems.map((item, i) => (
                <li key={i}>
                  <Link to={item.to} className="flex items-center justify-between bg-surface border border-line rounded-lg px-4 py-3 text-sm hover:border-accent transition-colors">
                    <span>{item.text}</span>
                    <ArrowRight size={15} className="text-mute" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Nothing pending.</EmptyState>
          )}
          <div className="mt-4 text-xs text-mute">
            Habits today: <span className="text-ink">{doneToday.length}/{activeHabits.length}</span>
          </div>
        </Card>
      </div>

      {synergy.history.length > 1 && (
        <Card title="Synergy Trend (30 days)">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={synergy.history}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="weighted" stroke="#00d9ff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="average" stroke="#b366ff" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <Card title="Skills Growing Fastest">
          {fastestSkills.length ? (
            <ul className="space-y-2.5">
              {fastestSkills.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <Rocket size={14} className="text-accent shrink-0" />
                  <span className="flex-1 truncate">{SKILL_MAP[s.id]?.name}</span>
                  <Badge color="var(--accent-primary)">+{s.xpMonth} XP</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No XP earned this month yet.</EmptyState>
          )}
        </Card>

        <Card title="Best Habit Streaks">
          {topStreaks.length ? (
            <ul className="space-y-2.5">
              {topStreaks.map((h) => (
                <li key={h.id} className="flex items-center gap-2 text-sm">
                  <Flame size={14} className="text-warn shrink-0" />
                  <span className="flex-1 truncate">{h.name}</span>
                  <Badge color="var(--warning)">{h.streak}d{h.targetStreak ? ` / ${h.targetStreak}` : ''}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No active streaks. Check a habit today.</EmptyState>
          )}
        </Card>

        <Card title="Milestones & Deadlines">
          {milestones.length || upcomingGoals.length ? (
            <ul className="space-y-2.5">
              {milestones.map((m, i) => (
                <li key={`m${i}`} className="flex items-center gap-2 text-sm">
                  <Award size={14} className="text-accent2 shrink-0" />
                  <span className="flex-1 truncate">
                    {SKILL_MAP[m.id]?.name} hit Lv{m.level} ({LEVEL_NAMES[m.level]})
                  </span>
                  <span className="text-[11px] text-mute">{fmtDate(m.date)}</span>
                </li>
              ))}
              {upcomingGoals.map((g) => (
                <li key={g.id} className="flex items-center gap-2 text-sm">
                  <ArrowRight size={14} className="text-mute shrink-0" />
                  <span className="flex-1 truncate">{g.name}</span>
                  <span className="text-[11px] text-mute">{fmtDate(g.targetDate)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Level-ups and goal deadlines will appear here.</EmptyState>
          )}
        </Card>
      </div>
    </div>
  );
}

function domainRoute(domain) {
  return { trading: '/trading', learning: '/learning', finance: '/finance', health: '/habits', growth: '/skills' }[domain] || '/';
}
